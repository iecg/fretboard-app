// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStore } from "jotai";
import {
  chordHiddenNotesAtom,
  chordTypeAtom,
  chordLookupAtom,
} from "./chordOverlayAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import { practiceCuesAtom, noteSemanticMapAtom, nextChordTonesAtom, commonTonesWithNextAtom, nextChordGuideTonesAtom, beatPositionAtom, activeStepDurationBeatsAtom } from "./practiceLensAtoms";
import { progressionStepsAtom, activeProgressionStepIndexAtom, progressionTempoBpmAtom, progressionStepDeadlineAtom, beatsPerBarAtom, activeResolvedProgressionStepAtom, displayedStepIndexPrimitiveAtom, setProgressionActiveStepIndexAtom, setProgressionPlayingAtom, progressionLoopEnabledAtom, progressionPlayingStateAtom } from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom, scaleVisibleAtom, colorNotesAtom, effectiveColorNotesAtom, toggleScaleVisibleAtom } from "./scaleAtoms";
import { effectiveShapeDataAtom } from "./shapeAtoms";
import { updateActiveChordAtom } from "./songStateAtoms";
import { getDegreesForScale } from "@fretflow/core";
import type { ProgressionStep } from "../progressions/progressionDomain";

/** Returns the tonic degree (semitone 0) of `scaleName` — every diatonic
 * scale has one — so a test step seeded with it always resolves. */
function tonicDegreeFor(scaleName: string): string {
  const degrees = getDegreesForScale(scaleName);
  return degrees[0] ?? "i";
}

function makeStore() {
  const store = createStore();
  store.set(progressionStepsAtom, [
    {
      id: "test-step",
      degree: "ii",
      duration: { value: 1, unit: "bar" },
      qualityOverride: null,
      manualRoot: "C",
    },
  ]);
  return store;
}

type Setup = {
  scaleRoot?: string;
  scale?: string;
  chordRoot?: string | null;
  chordType?: string | null;
  chordDegree?: string | null;
  /** Set to `"off"` to disable the chord overlay (empties the progression). */
  overlayMode?: string;
  scaleVisible?: boolean;
  hidden?: Set<string>;
};

function setUp(o: Setup = {}) {
  const store = makeStore();
  if (o.scaleRoot !== undefined) store.set(rootNoteAtom, o.scaleRoot);
  if (o.scale !== undefined) {
    store.set(scaleNameAtom, o.scale);
    store.set(updateActiveChordAtom, {
      degree: tonicDegreeFor(o.scale) as import("@fretflow/core").DegreeId,
    });
  }
  if (o.overlayMode === "off") {
    store.set(progressionStepsAtom, []);
  } else {
    const patch: { root?: string | null; quality?: string | null; degree?: import("@fretflow/core").DegreeId } = {};
    if (o.chordRoot !== undefined) patch.root = o.chordRoot;
    if (o.chordType !== undefined) patch.quality = o.chordType;
    if (o.chordDegree !== undefined) {
      if (o.chordDegree === null) {
        store.set(progressionStepsAtom, []);
      } else {
        patch.degree = o.chordDegree as import("@fretflow/core").DegreeId;
      }
    }
    if (Object.keys(patch).length > 0) {
      store.set(updateActiveChordAtom, patch);
    }
  }
  if (o.scaleVisible !== undefined) store.set(scaleVisibleAtom, o.scaleVisible);
  if (o.hidden !== undefined) store.set(chordHiddenNotesAtom, o.hidden);
  return store;
}

function setChordViaProgression(store: ReturnType<typeof createStore>, patch: { root?: string | null; quality?: string | null }) {
  store.set(updateActiveChordAtom, patch);
}

function disableChordOverlay(store: ReturnType<typeof createStore>) {
  store.set(progressionStepsAtom, [] as ProgressionStep[]);
}

// ---------------------------------------------------------------------------
// practiceCuesAtom — always-Lead tension behavior
// ---------------------------------------------------------------------------

describe("practiceCuesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns land-on + tension cues when chord has outside-scale tones", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C#", chordType: "m" });
    expect(store.get(practiceCuesAtom).map((c) => c.kind)).toEqual(["land-on", "tension"]);
  });

  it("tension notes include outside chord root and have resolvesTo targets", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C#", chordType: "m" });
    const tensionCue = store.get(practiceCuesAtom).find((c) => c.kind === "tension");
    expect(tensionCue).toBeDefined();
    expect(tensionCue!.notes.map((n) => n.internalNote)).toContain("C#");
    expect(tensionCue!.notes.some((n) => n.resolvesTo !== undefined)).toBe(true);
  });

  it("returns only land-on when chord is fully in-scale (no outside tones)", () => {
    const kinds = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C", chordType: "M" }).get(practiceCuesAtom).map((c) => c.kind);
    expect(kinds).toContain("land-on");
    expect(kinds).not.toContain("tension");
  });

  it("finds resolution target within 2 semitones for pentatonic scale", () => {
    const store = setUp({ scaleRoot: "C", scale: "minor pentatonic", chordRoot: "D", chordType: "m" });
    const tensionCue = store.get(practiceCuesAtom).find((c) => c.kind === "tension");
    expect(tensionCue!.notes.find((n) => n.internalNote === "D")?.resolvesTo).toBeDefined();
  });

  it("returns empty cues when chord overlay is off", () => {
    const store = setUp({ overlayMode: "off" });
    expect(store.get(practiceCuesAtom)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// noteSemanticMapAtom
// ---------------------------------------------------------------------------

describe("noteSemanticMapAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("correctly identifies outside chord root as both isChordRoot and isTension", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C#", chordType: "m" });
    const s = store.get(noteSemanticMapAtom).get("C#");
    expect(s).toBeDefined();
    expect(s!.isChordRoot).toBe(true);
    expect(s!.isTension).toBe(true);
    expect(s!.isInScale).toBe(false);
  });

  it("identifies guide tones (3rd and 7th) correctly", () => {
    const map = setUp({ scaleRoot: "G", scale: "major", chordRoot: "G", chordType: "7" }).get(noteSemanticMapAtom);
    expect(map.get("B")?.isGuideTone).toBe(true);
    expect(map.get("F")?.isGuideTone).toBe(true);
    expect(map.get("D")?.isGuideTone).toBe(false);
  });

  it("a note can be both color tone and chord tone", () => {
    const f = setUp({ scaleRoot: "G", scale: "mixolydian", chordRoot: "G", chordType: "7" })
      .get(noteSemanticMapAtom).get("F");
    expect(f?.isColorTone).toBe(true);
    expect(f?.isChordTone).toBe(true);
  });

  it("returns empty map when chord overlay is off", () => {
    expect(setUp({ overlayMode: "off" }).get(noteSemanticMapAtom).size).toBe(0);
  });

  it("hidden chord root no longer carries chord-root semantics", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C", chordType: "M" });
    const before = store.get(noteSemanticMapAtom).get("C");
    expect(before?.isChordRoot).toBe(true);
    expect(before?.isChordTone).toBe(true);

    store.set(chordHiddenNotesAtom, new Set(["C"]));
    const after = store.get(noteSemanticMapAtom).get("C");
    expect(after).toBeDefined();
    expect(after!.isChordTone).toBe(false);
    expect(after!.isChordRoot).toBe(false);
  });

  it("uses progression chord semantics even with one-string fingering pattern", () => {
    const store = setUp({ scaleRoot: "C", scale: "major" });
    store.set(progressionStepsAtom, [
      { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(fingeringPatternAtom, "one-string");

    const map = store.get(noteSemanticMapAtom);
    expect(map.get("G")?.isChordRoot).toBe(true);
    expect(map.get("G")?.isDiatonicChord).toBe(true);
    expect(map.get("B")?.isDiatonicChord).toBe(true);
    expect(map.get("D")?.isDiatonicChord).toBe(true);
    expect(map.get("C")?.isDiatonicChord).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chord overlay does not control scale visibility
// ---------------------------------------------------------------------------

describe("chord overlay does not control scale visibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enabling chord overlay does not change effectiveShapeDataAtom highlightNotes count", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", scaleVisible: true, overlayMode: "off" });
    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;
    store.set(progressionStepsAtom, [
      { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "M", manualRoot: "C" },
    ]);
    expect(store.get(effectiveShapeDataAtom).highlightNotes.length).toBe(before);
  });

  it("disabling chord overlay does not change scale highlight notes", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", scaleVisible: true, chordType: "M" });
    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;
    disableChordOverlay(store);
    expect(store.get(effectiveShapeDataAtom).highlightNotes.length).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// color notes are scale-owned — independent of chord overlay
// ---------------------------------------------------------------------------

describe("color notes are scale-owned — independent of chord overlay", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("colorNotesAtom returns color notes for Minor Blues scale without chord overlay", () => {
    expect(setUp({ scaleRoot: "C", scale: "minor blues" }).get(colorNotesAtom).length).toBeGreaterThan(0);
  });

  it("colorNotesAtom is unaffected by chord type changes", () => {
    const store = setUp({ scaleRoot: "C", scale: "minor blues" });
    const before = store.get(colorNotesAtom);
    setChordViaProgression(store, { quality: "7" });
    expect(store.get(colorNotesAtom)).toEqual(before);
  });

  it("effectiveColorNotesAtom is cleared by scaleVisible=false, not by chord overlay", () => {
    const store = setUp({ scaleRoot: "C", scale: "minor blues", chordType: "7", scaleVisible: true });
    expect(store.get(effectiveColorNotesAtom).length).toBeGreaterThan(0);
    store.set(toggleScaleVisibleAtom);
    expect(store.get(effectiveColorNotesAtom)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// noteSemanticMapAtom scaleDegree + isDiatonicChord
// ---------------------------------------------------------------------------

describe("noteSemanticMapAtom — scaleDegree and isDiatonicChord", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("every in-scale note in C Major has a non-undefined scaleDegree", () => {
    const map = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C", chordType: "M" }).get(noteSemanticMapAtom);
    for (const note of ["C", "D", "E", "F", "G", "A", "B"]) {
      expect(map.get(note), `expected semantics for ${note}`).toBeDefined();
      expect(map.get(note)!.scaleDegree, `expected scaleDegree for ${note}`).toBeDefined();
    }
  });

  it("out-of-scale notes have scaleDegree undefined", () => {
    const map = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C#", chordType: "m" }).get(noteSemanticMapAtom);
    const cSharp = map.get("C#");
    expect(cSharp).toBeDefined();
    expect(cSharp!.isInScale).toBe(false);
    expect(cSharp!.scaleDegree).toBeUndefined();
  });

  it("isDiatonicChord is true for chord tone when degree mode matches diatonic chord", () => {
    const map = setUp({ scaleRoot: "C", scale: "major", chordDegree: "I", overlayMode: "degree" }).get(noteSemanticMapAtom);
    for (const note of ["E", "G"]) {
      const s = map.get(note);
      expect(s, `expected semantics for ${note}`).toBeDefined();
      expect(s!.isChordTone).toBe(true);
      expect(s!.isDiatonicChord, `isDiatonicChord should be true for ${note}`).toBe(true);
    }
  });

  it("isDiatonicChord is false when the quality override does not match the diatonic chord", () => {
    const map = setUp({ scaleRoot: "C", scale: "major", chordDegree: "I", chordType: "m" }).get(noteSemanticMapAtom);
    for (const note of ["C", "E", "G"]) {
      const s = map.get(note);
      if (s?.isChordTone) expect(s.isDiatonicChord).toBeFalsy();
    }
  });

  it("isDiatonicChord is false when a non-diatonic quality override is set in degree mode", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", chordDegree: "I", chordType: "m" });

    expect(store.get(chordTypeAtom)).toBe("m");

    const map = store.get(noteSemanticMapAtom);
    expect(map.size).toBeGreaterThan(0);
    const gSem = map.get("G");
    expect(gSem?.isChordTone).toBe(true);
    expect(gSem?.isDiatonicChord).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// nextChordTonesAtom / commonTonesWithNextAtom
// ---------------------------------------------------------------------------

describe("nextChordTonesAtom / commonTonesWithNextAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("nextChordTonesAtom returns the notes of the step after the active step", () => {
    const store = makeDefaultStore();
    expect(store.get(nextChordTonesAtom)).toEqual(new Set(["G", "B", "D"]));
  });

  it("commonTonesWithNextAtom is the intersection of active and next chord tones", () => {
    const store = makeDefaultStore();
    expect(store.get(commonTonesWithNextAtom)).toEqual(new Set(["G"]));
  });

  it("nextChordTonesAtom does not wrap around when loop is disabled and active step is the last step", () => {
    const store = makeAtomStore([
      [scaleNameAtom, "major"],
      [rootNoteAtom, "C"],
      [progressionLoopEnabledAtom, false],
      [progressionPlayingStateAtom, true],
      [progressionStepsAtom, [
        { id: "1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "2", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]],
      [displayedStepIndexPrimitiveAtom, 1],
    ]);
    expect(store.get(nextChordTonesAtom)).toEqual(new Set());
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set());
  });

  it("nextChordTonesAtom still wraps around when loop is enabled and active step is the last step", () => {
    const store = makeAtomStore([
      [scaleNameAtom, "major"],
      [rootNoteAtom, "C"],
      [progressionLoopEnabledAtom, true],
      [progressionPlayingStateAtom, true],
      [progressionStepsAtom, [
        { id: "1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "2", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]],
      [displayedStepIndexPrimitiveAtom, 1],
    ]);
    expect(store.get(nextChordTonesAtom)).toEqual(new Set(["C", "E", "G"]));
  });

  it("nextChordTonesAtom returns the same step's tones when progression has one step", () => {
    const store = makeDefaultStore();
    const allSteps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, [allSteps[0]!]);
    expect(store.get(nextChordTonesAtom)).toEqual(new Set(["C", "E", "G"]));
  });

  it("nextChordTonesAtom returns empty set when progression is empty", () => {
    const store = makeDefaultStore();
    store.set(progressionStepsAtom, []);
    expect(store.get(nextChordTonesAtom)).toEqual(new Set());
  });

  it("commonTonesWithNextAtom returns empty set when progression is empty", () => {
    const store = makeDefaultStore();
    store.set(progressionStepsAtom, []);
    expect(store.get(commonTonesWithNextAtom)).toEqual(new Set());
  });
});

// ---------------------------------------------------------------------------
// activeStepDurationBeatsAtom / beatPositionAtom
// ---------------------------------------------------------------------------

describe("activeStepDurationBeatsAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("returns 0 when there are no progression steps", () => {
    const store = makeDefaultStore();
    store.set(progressionStepsAtom, []);
    expect(store.get(activeStepDurationBeatsAtom)).toBe(0);
  });

  it("returns beatsPerBar for a 1-bar step with default 4/4", () => {
    const store = makeDefaultStore();
    expect(store.get(activeStepDurationBeatsAtom)).toBe(4);
  });

  it("reflects beatsPerBar changes", () => {
    const store = makeDefaultStore();
    store.set(beatsPerBarAtom, 3);
    expect(store.get(activeStepDurationBeatsAtom)).toBe(3);
  });

  it("returns value directly for beat-unit duration", () => {
    const store = makeDefaultStore();
    store.set(progressionStepsAtom, [
      { id: "test-beat", degree: "I", duration: { value: 2, unit: "beat" }, qualityOverride: null, manualRoot: null },
    ]);
    expect(store.get(activeStepDurationBeatsAtom)).toBe(2);
  });
});

describe("beatPositionAtom (Task 4.3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("returns 0 when deadline is null (paused / not running)", () => {
    const store = makeDefaultStore();
    expect(store.get(progressionStepDeadlineAtom)).toBeNull();
    expect(store.get(beatPositionAtom)).toBe(0);
  });

  it("derives beat position from deadline + tempo at two points in time", () => {
    vi.useFakeTimers();
    {
      const store = makeDefaultStore();
      store.set(progressionTempoBpmAtom, 120);
      store.set(progressionStepDeadlineAtom, Date.now() + 2000);
      expect(store.get(beatPositionAtom)).toBeCloseTo(0, 1);
    }
    vi.advanceTimersByTime(500);
    {
      const store = makeDefaultStore();
      store.set(progressionTempoBpmAtom, 120);
      store.set(progressionStepDeadlineAtom, Date.now() + 1500);
      expect(store.get(beatPositionAtom)).toBeCloseTo(1, 1);
    }
  });

  it("clamps to stepDurationBeats when deadline is in the past", () => {
    vi.useFakeTimers();
    const store = makeDefaultStore();
    store.set(progressionTempoBpmAtom, 120);
    store.set(progressionStepDeadlineAtom, Date.now() - 1000);
    expect(store.get(beatPositionAtom)).toBe(4);
  });

  it("clamps to 0 when deadline is far in the future (beatsRemaining > stepDurationBeats)", () => {
    vi.useFakeTimers();
    const store = makeDefaultStore();
    store.set(progressionTempoBpmAtom, 120);
    store.set(progressionStepDeadlineAtom, Date.now() + 10000);
    expect(store.get(beatPositionAtom)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// nextChordGuideTonesAtom
// ---------------------------------------------------------------------------

describe("nextChordGuideTonesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("returns the 3rd and 7th of the next chord (I→V in C Major: G Major has no 7th → returns 3rd B)", () => {
    const store = makeDefaultStore();
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones).toEqual(new Set(["B"]));
  });

  it("returns both 3rd and 7th for a seventh chord", () => {
    const store = makeDefaultStore();
    const steps = store.get(progressionStepsAtom);
    const updatedSteps = steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "7" } : s
    );
    store.set(progressionStepsAtom, updatedSteps);
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones.has("B")).toBe(true);
    expect(guideTones.has("F")).toBe(true);
    expect(guideTones.size).toBe(2);
  });

  it("returns empty set when next chord has no guide tones (power chord)", () => {
    const store = makeDefaultStore();
    const steps = store.get(progressionStepsAtom);
    const updatedSteps = steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "5" } : s
    );
    store.set(progressionStepsAtom, updatedSteps);
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set());
  });

  it("returns empty set when progression is empty", () => {
    const store = makeDefaultStore();
    store.set(progressionStepsAtom, []);
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set());
  });

  it("wraps around: last step's next guide tones come from the first step", () => {
    const store = makeDefaultStore();
    store.set(activeProgressionStepIndexAtom, 3);
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones.has("E")).toBe(true);
    expect(guideTones.size).toBe(1);
  });
});

describe("chord-visual derivations follow displayedProgressionStepIndexAtom during playback", () => {
  it("activeResolvedProgressionStepAtom mirrors RAF-written index while playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(setProgressionPlayingAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    expect(store.get(activeResolvedProgressionStepAtom)?.degree).toBe("V");
  });

  it("activeResolvedProgressionStepAtom falls back to logical when not playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    expect(store.get(activeResolvedProgressionStepAtom)?.degree).toBe("I");
  });
});

describe("noteSemanticMapAtom — referential stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reuses the same chord lookup and noteSemanticMap references when chord semantics are unchanged", () => {
    const store = setUp({
      scaleRoot: "G",
      scale: "mixolydian",
      chordRoot: "G",
      chordType: "7",
    });

    const firstLookup = store.get(chordLookupAtom);
    const firstMap = store.get(noteSemanticMapAtom);

    store.set(
      progressionStepsAtom,
      store.get(progressionStepsAtom).map((step) => ({ ...step })),
    );

    const secondLookup = store.get(chordLookupAtom);
    const secondMap = store.get(noteSemanticMapAtom);

    expect(secondLookup).toBe(firstLookup);
    expect(secondMap).toBe(firstMap);
  });

  it("returns the same noteSemanticMap reference when a color-note update is value-equal", () => {
    const store = setUp({
      scaleRoot: "G",
      scale: "mixolydian",
      chordRoot: "G",
      chordType: "7",
    });

    const first = store.get(noteSemanticMapAtom);
    const stepsCopy = store.get(progressionStepsAtom).map((s) => ({ ...s }));
    store.set(progressionStepsAtom, stepsCopy);
    const second = store.get(noteSemanticMapAtom);

    expect(second).toBe(first);
  });
});
