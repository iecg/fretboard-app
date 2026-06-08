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
import { practiceLensAtom, practiceCuesAtom, noteSemanticMapAtom, nextChordTonesAtom, commonTonesWithNextAtom, nextChordGuideTonesAtom, nextChordGuideToneLabelsAtom, nextTargetToneLabelsAtom, beatPositionAtom, activeStepDurationBeatsAtom, computeLeadInWindowMs, isInLeadInWindow, isInPlanningWindow, activeChordTonesAtom, incomingTonesAtom, departingTonesAtom, leadInActiveAtom, leadInDurationMsAtom, stepRelativeFraction, planningWindowActiveAtom, isInCountdownWindow, computeCountdownTickFractions, guideCountdownWindowMsAtom, guideCountdownActiveAtom, guideCountdownTickFractionsAtom } from "./practiceLensAtoms";
import { progressionStepsAtom, activeProgressionStepIndexAtom, progressionTempoBpmAtom, progressionStepDeadlineAtom, beatsPerBarAtom, activeResolvedProgressionStepAtom, displayedStepIndexPrimitiveAtom, setProgressionActiveStepIndexAtom, setProgressionPlayingAtom, progressionLoopEnabledAtom, progressionPlayingStateAtom, progressionStepDurationMsAtom, progressionBarDurationMsAtom } from "./progressionAtoms";
import { progressionVisualFrameAtom } from "./progressionVisualAtoms";
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

  it("triad next chord (no 7th) returns only the 3rd (I→V in C Major: G major → B)", () => {
    const store = makeDefaultStore();
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones).toEqual(new Set(["B"]));
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

  it("seventh chord returns the 3rd and 7th (G7 → B, F)", () => {
    const store = makeDefaultStore();
    const steps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "7" } : s,
    ));
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set(["B", "F"]));
  });

  it("dim7 next chord returns only the b3 (G dim7: b3=A#; bb7 is not a guide tone)", () => {
    // dim7's bb7 is not a GUIDE_TONE_RAW entry, so the guide-tone set is just
    // the b3 (A# for root G) — never the perfect 5th D.
    const store = makeDefaultStore();
    const steps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "dim7" } : s,
    ));
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set(["A#"]));
  });

  it("returns empty set when progression is empty", () => {
    const store = makeDefaultStore();
    store.set(progressionStepsAtom, []);
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set());
  });

  it("wraps around: last step's next guide tones come from the first step (C major → E)", () => {
    const store = makeDefaultStore();
    store.set(activeProgressionStepIndexAtom, 3);
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones).toEqual(new Set(["E"]));
  });

  it("labels map gives each guide tone its function in the next chord (triad → 3)", () => {
    const store = makeDefaultStore();
    expect(store.get(nextChordGuideToneLabelsAtom)).toEqual(
      new Map([["B", "3"]]),
    );
  });

  it("labels map for a seventh chord uses 3 and b7", () => {
    const store = makeDefaultStore();
    const steps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "7" } : s,
    ));
    expect(store.get(nextChordGuideToneLabelsAtom)).toEqual(
      new Map([["B", "3"], ["F", "b7"]]),
    );
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

// ---------------------------------------------------------------------------
// computeLeadInWindowMs / isInLeadInWindow
// ---------------------------------------------------------------------------

describe("computeLeadInWindowMs", () => {
  it("returns the proportional window for a long step", () => {
    expect(computeLeadInWindowMs(2000)).toBe(1000);
  });
  it("clamps up to the readable floor for a short step", () => {
    expect(computeLeadInWindowMs(800)).toBe(600);
  });
  it("never exceeds the step duration", () => {
    expect(computeLeadInWindowMs(400)).toBe(400);
  });
  it("returns 0 for a non-positive step", () => {
    expect(computeLeadInWindowMs(0)).toBe(0);
    expect(computeLeadInWindowMs(-100)).toBe(0);
  });

  // Bar cap: chords longer than one bar preview over their final bar only.
  it("caps a long (4-bar) chord's lead-in at one bar", () => {
    // 8000ms step (4 bars), 2000ms bar. Proportional 50% = 4000ms (2 bars),
    // capped to one bar = 2000ms.
    expect(computeLeadInWindowMs(8000, 2000)).toBe(2000);
  });
  it("caps a 2-bar chord at one bar", () => {
    // 4000ms step, 2000ms bar. Proportional = 2000ms, equal to the cap.
    expect(computeLeadInWindowMs(4000, 2000)).toBe(2000);
  });
  it("leaves a 1-bar chord at its proportional window (cap does not bind)", () => {
    // 2000ms step == 1 bar. Proportional = 1000ms, below the 2000ms cap.
    expect(computeLeadInWindowMs(2000, 2000)).toBe(1000);
  });
  it("still honors the readable floor for a short chord under the cap", () => {
    // 800ms step, 2000ms bar. Proportional 400 < floor 600 → 600.
    expect(computeLeadInWindowMs(800, 2000)).toBe(600);
  });
  it("treats an Infinity bar (no cap) as the pure proportional window", () => {
    expect(computeLeadInWindowMs(8000, Infinity)).toBe(4000);
    expect(computeLeadInWindowMs(8000)).toBe(4000);
  });
});

describe("isInLeadInWindow", () => {
  it("is true once elapsed fraction crosses the window start", () => {
    expect(isInLeadInWindow(0.49, 2000)).toBe(false);
    expect(isInLeadInWindow(0.5, 2000)).toBe(true);
    expect(isInLeadInWindow(0.95, 2000)).toBe(true);
  });
  it("is false for a non-positive step", () => {
    expect(isInLeadInWindow(0.9, 0)).toBe(false);
  });
  it("starts later for a long chord when the bar cap applies", () => {
    // 8000ms step, 2000ms bar → window 2000ms → starts at fraction 0.75
    // (vs 0.5 uncapped). The preview is the final bar only.
    expect(isInLeadInWindow(0.74, 8000, 2000)).toBe(false);
    expect(isInLeadInWindow(0.76, 8000, 2000)).toBe(true);
    // Uncapped (no bar) the same step would already be in-window at 0.6.
    expect(isInLeadInWindow(0.6, 8000)).toBe(true);
  });
});

describe("isInPlanningWindow", () => {
  it("is active before the landing window for a single-bar step (runway starts at onset)", () => {
    // step 2000, bar 2000: landing = 1000ms (50%); planning span = whole step.
    // planning = [0, 0.5); landing = [0.5, 1].
    expect(isInPlanningWindow(0.0, 2000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.3, 2000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.5, 2000, 2000)).toBe(false); // landing, not planning
    expect(isInPlanningWindow(0.7, 2000, 2000)).toBe(false);
  });

  it("caps the runway at 2 bars on a long chord (no preview earlier than 2 bars out)", () => {
    // step 8000, bar 2000: landing = 2000 (1-bar cap); planning span = 4000 (2 bars).
    // planning = [0.5, 0.75); landing = [0.75, 1].
    expect(isInPlanningWindow(0.4, 8000, 2000)).toBe(false); // >2 bars out
    expect(isInPlanningWindow(0.5, 8000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.74, 8000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.75, 8000, 2000)).toBe(false); // landing
  });

  it("has no room when the landing floor eats the runway (very fast tempo)", () => {
    // step 1000, bar 200: planning span = min(1000, 400) = 400; landing floor = 600.
    // 400 <= 600 -> no planning room at all.
    expect(isInPlanningWindow(0.1, 1000, 200)).toBe(false);
    expect(isInPlanningWindow(0.5, 1000, 200)).toBe(false);
  });

  it("uses the proportional landing window when no bar length is given", () => {
    // step 8000, no bar: landing = 4000 (50%); planning span = 8000.
    // planning = [0, 0.5).
    expect(isInPlanningWindow(0.3, 8000)).toBe(true);
    expect(isInPlanningWindow(0.5, 8000)).toBe(false);
  });

  it("returns false for a non-positive step duration", () => {
    expect(isInPlanningWindow(0.5, 0, 2000)).toBe(false);
    expect(isInPlanningWindow(0.5, -100, 2000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isInCountdownWindow — single continuous countdown window
// ---------------------------------------------------------------------------

describe("isInCountdownWindow", () => {
  it("is active across the whole step when step <= 2 bars", () => {
    // step 2000, bar 2000: window = min(2000, 4000) = 2000 -> start fraction 0
    expect(isInCountdownWindow(0, 2000, 2000)).toBe(true);
    expect(isInCountdownWindow(0.99, 2000, 2000)).toBe(true);
  });

  it("caps the window at 2 bars for long chords", () => {
    // step 8000, bar 2000: window = min(8000, 4000) = 4000 -> start fraction 0.5
    expect(isInCountdownWindow(0.49, 8000, 2000)).toBe(false);
    expect(isInCountdownWindow(0.5, 8000, 2000)).toBe(true);
  });

  it("returns false for a non-positive step duration", () => {
    expect(isInCountdownWindow(0.5, 0, 2000)).toBe(false);
    expect(isInCountdownWindow(0.5, -100, 2000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeCountdownTickFractions — beat/bar boundary notches, capped at 4
// ---------------------------------------------------------------------------

describe("computeCountdownTickFractions", () => {
  it("anchor tick at 0 plus one per beat boundary when <= 4 beats", () => {
    // 4 beats -> 4 segments -> anchor 0 + interior ticks at 1/4, 2/4, 3/4
    expect(computeCountdownTickFractions(4000, 1000, 4000)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("two beats yields the anchor plus a single midpoint tick", () => {
    expect(computeCountdownTickFractions(2000, 1000, 4000)).toEqual([0, 0.5]);
  });

  it("suppresses ticks below 2 beats", () => {
    expect(computeCountdownTickFractions(1000, 1000, 4000)).toEqual([]);
  });

  it("collapses to bar boundaries when > 4 beats and bars in 2..4", () => {
    // 8 beats, 2 bars -> segment by bar -> anchor 0 + tick at 0.5
    expect(computeCountdownTickFractions(8000, 1000, 4000)).toEqual([0, 0.5]);
    // 12 beats, 3 bars -> anchor 0 + ticks at 1/3, 2/3
    expect(computeCountdownTickFractions(12000, 1000, 4000)).toEqual([0, 1 / 3, 2 / 3]);
  });

  it("falls back to 4 even segments when bars also exceed 4", () => {
    // 20 beats, 5 bars -> 4 even segments -> anchor 0 + 0.25, 0.5, 0.75
    expect(computeCountdownTickFractions(20000, 1000, 4000)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("returns [] for non-positive window or beat length", () => {
    expect(computeCountdownTickFractions(0, 1000, 4000)).toEqual([]);
    expect(computeCountdownTickFractions(4000, 0, 4000)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// transition delta atoms
// ---------------------------------------------------------------------------

describe("transition delta atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("activeChordTonesAtom returns the active chord's tones", () => {
    const store = makeDefaultStore();
    expect(store.get(activeChordTonesAtom)).toEqual(new Set(["C", "E", "G"]));
  });
  it("incomingTonesAtom = next − current", () => {
    const store = makeDefaultStore();
    expect(store.get(incomingTonesAtom)).toEqual(new Set(["B", "D"]));
  });
  it("departingTonesAtom = current − next", () => {
    const store = makeDefaultStore();
    expect(store.get(departingTonesAtom)).toEqual(new Set(["C", "E"]));
  });
  it("returns empty deltas when there is no next chord", () => {
    const store = makeDefaultStore();
    store.set(progressionStepsAtom, []);
    expect(store.get(incomingTonesAtom).size).toBe(0);
    expect(store.get(departingTonesAtom).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// transition perf budget
// ---------------------------------------------------------------------------

describe("transition perf budget", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Seed a store with a playing two-step I→V progression.
   * Mirrors the pattern in the "leadInActiveAtom / leadInDurationMsAtom" block.
   */
  function makePlayingStore() {
    const store = createStore();
    // Subscribe once to trigger atomWithStorage init (same as other makeDefaultStore helpers).
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    store.set(progressionPlayingStateAtom, true);
    return store;
  }

  it("frame writes within a phase do not notify the note-driving atoms", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 5000);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false });
    store.get(leadInActiveAtom);
    store.get(incomingTonesAtom);

    let leadInNotifs = 0;
    let incomingNotifs = 0;
    const u1 = store.sub(leadInActiveAtom, () => { leadInNotifs++; });
    const u2 = store.sub(incomingTonesAtom, () => { incomingNotifs++; });

    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.11, localFraction: 0.11, paused: false });
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.12, localFraction: 0.12, paused: false });
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.13, localFraction: 0.13, paused: false });

    expect(leadInNotifs).toBe(0);
    expect(incomingNotifs).toBe(0);
    u1(); u2();
  });

  it("crossing the lead-in threshold notifies leadInActiveAtom exactly once", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false });
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 300);
    store.get(leadInActiveAtom);

    let notifs = 0;
    const u = store.sub(leadInActiveAtom, () => { notifs++; });

    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 300);
    expect(notifs).toBe(1);
    expect(store.get(leadInActiveAtom)).toBe(true);
    u();
  });
});

// ---------------------------------------------------------------------------
// leadInActiveAtom / leadInDurationMsAtom
// ---------------------------------------------------------------------------

describe("leadInActiveAtom / leadInDurationMsAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("leadInDurationMsAtom matches the bar-capped window of the active step", () => {
    const store = makeDefaultStore();
    const stepMs = store.get(progressionStepDurationMsAtom);
    const barMs = store.get(progressionBarDurationMsAtom);
    expect(store.get(leadInDurationMsAtom)).toBe(computeLeadInWindowMs(stepMs, barMs));
  });

  it("caps leadInDurationMsAtom at one bar for a multi-bar chord", () => {
    const store = makeDefaultStore();
    // Replace the active step with a 4-bar chord.
    store.set(progressionStepsAtom, [
      { id: "long", degree: "I", duration: { value: 4, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    const barMs = store.get(progressionBarDurationMsAtom);
    const stepMs = store.get(progressionStepDurationMsAtom);
    // ~4 bars (per-call rounding makes 4-bar ≠ exactly 4× a 1-bar value).
    expect(stepMs).toBeGreaterThan(barMs * 3);
    // Proportional would be ~2 bars; the cap pins it to one bar.
    expect(store.get(leadInDurationMsAtom)).toBe(barMs);
  });

  it("is false when not playing", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, false);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.9, localFraction: 0.9, paused: false });
    expect(store.get(leadInActiveAtom)).toBe(false);
  });

  it("is false while paused", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.9, localFraction: 0.9, paused: true });
    expect(store.get(leadInActiveAtom)).toBe(false);
  });

  it("flips true once the playhead crosses the window start", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 0);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false });
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 300);
    expect(store.get(leadInActiveAtom)).toBe(false);
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 300);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });

  // Boundary-gap coherence: the audio frame advances to the next step urgently,
  // but the displayed step index is deferred via startTransition (the fretboard
  // shape advances a few frames later). The lead-in highlight must hold through
  // this gap so the ghost promotes in the SAME commit the shape advances —
  // otherwise the highlight turns off before the next shape appears (the
  // flow-breaking delay).
  it("stays true during the boundary gap (audio advanced, displayed step deferred)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    // Displayed (deferred) step still 0; audio frame already crossed into step 1
    // at the very start of that step (localFraction ~0).
    store.set(displayedStepIndexPrimitiveAtom, 0);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0, paused: false });
    expect(store.get(leadInActiveAtom)).toBe(true);
  });

  it("is false at the very start of a step once active+displayed agree (not yet in its lead-in window)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(activeProgressionStepIndexAtom, 1);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0.05, paused: false });
    store.set(progressionStepDeadlineAtom, Date.now() + store.get(progressionStepDurationMsAtom));
    expect(store.get(leadInActiveAtom)).toBe(false);
  });

  // Regression (root cause): going C→G the guide ring for Am — the chord AFTER
  // the next one — flashed right at the transition. At a boundary the displayed
  // step advances ~one audio-lookahead BEFORE the deadline is refreshed:
  // setActiveStep updates the timeline (→ visual clock → displayed) at SCHEDULE
  // time, but the active-index + deadline refresh runs from a Tone.Draw callback
  // at the audio ONSET. In that window `displayed` is the new chord while the
  // deadline still reflects the previous chord AND is still slightly in the
  // FUTURE — so a step fraction reads ~1.0 (in-window) and, with displayed
  // already advanced, nextChordGuideTonesAtom points at the chord-after-next.
  it("suppresses lead-in during the boundary lookahead (displayed advanced, active+deadline not yet refreshed, old deadline still slightly future)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    // Displayed advanced to step 1 (timeline/visual clock at schedule time);
    // active still 0 and the deadline still the previous step's, ~80ms out.
    store.set(activeProgressionStepIndexAtom, 0);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0, paused: false });
    store.set(progressionStepDeadlineAtom, Date.now() + 80);
    // Old code: deadline is future so the now>=deadline guard misses it; the step
    // fraction clamps to ~0.97 → in window → TRUE (the Am flash). The
    // active!==displayed guard is what makes this false.
    expect(store.get(leadInActiveAtom)).toBe(false);
  });

  it("is false when the deadline is null (timing not yet established)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(activeProgressionStepIndexAtom, 0);
    store.set(displayedStepIndexPrimitiveAtom, 0);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false });
    store.set(progressionStepDeadlineAtom, null);
    expect(store.get(leadInActiveAtom)).toBe(false);
  });
});

describe("stepRelativeFraction", () => {
  it("returns 0 when there is no deadline", () => {
    expect(stepRelativeFraction(null, 1000, 2000)).toBe(0);
  });
  it("returns 0 for a non-positive step duration", () => {
    expect(stepRelativeFraction(3000, 1000, 0)).toBe(0);
  });
  it("is ~0 at the start of the step (full duration remaining)", () => {
    expect(stepRelativeFraction(1000 + 2000, 1000, 2000)).toBeCloseTo(0, 5);
  });
  it("is 0.5 halfway through the step", () => {
    expect(stepRelativeFraction(1000 + 1000, 1000, 2000)).toBeCloseTo(0.5, 5);
  });
  it("clamps to [0,1] past the deadline", () => {
    expect(stepRelativeFraction(500, 1000, 2000)).toBe(1);
  });
});

describe("leadInActiveAtom — fires once per chord (multi-bar)", () => {
  beforeEach(() => { localStorage.clear(); });

  function makeMultiBarStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    store.set(progressionStepsAtom, [
      { id: "long", degree: "I", duration: { value: 4, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(progressionPlayingStateAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 0);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false });
    return store;
  }

  it("is FALSE during an earlier bar of a multi-bar chord", () => {
    const store = makeMultiBarStore();
    const barMs = store.get(progressionBarDurationMsAtom);
    store.set(progressionStepDeadlineAtom, Date.now() + 2.5 * barMs);
    expect(store.get(leadInActiveAtom)).toBe(false);
  });

  it("is TRUE only in the final bar of a multi-bar chord", () => {
    const store = makeMultiBarStore();
    const barMs = store.get(progressionBarDurationMsAtom);
    store.set(progressionStepDeadlineAtom, Date.now() + 0.5 * barMs);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });
});

describe("planningWindowActiveAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("is false when not playing", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, false);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.3, localFraction: 0.3, paused: false });
    expect(store.get(planningWindowActiveAtom)).toBe(false);
  });

  it("is false while paused", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.3, localFraction: 0.3, paused: true });
    expect(store.get(planningWindowActiveAtom)).toBe(false);
  });

  it("is true in the planning runway and false once inside the landing window (mutually exclusive)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(activeProgressionStepIndexAtom, 1);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0, paused: false });
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));

    // Just BEFORE the landing window opens -> planning active, lead-in inactive.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 300);
    expect(store.get(planningWindowActiveAtom)).toBe(true);
    expect(store.get(leadInActiveAtom)).toBe(false);

    // Just AFTER the landing window opens -> planning inactive, lead-in active.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 300);
    expect(store.get(planningWindowActiveAtom)).toBe(false);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });

  it("is false during the boundary gap (landing owns it, not planning)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    // Audio frame already crossed into step 1; displayed step still deferred at 0.
    store.set(displayedStepIndexPrimitiveAtom, 0);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0, paused: false });
    expect(store.get(planningWindowActiveAtom)).toBe(false);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });
});

describe("guide countdown atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makePlayingStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    store.set(progressionPlayingStateAtom, true);
    return store;
  }

  it("guideCountdownWindowMsAtom = min(step, 2·bar)", () => {
    const store = makePlayingStore();
    const step = store.get(progressionStepDurationMsAtom);
    const bar = store.get(progressionBarDurationMsAtom);
    expect(store.get(guideCountdownWindowMsAtom)).toBe(Math.min(step, 2 * bar));
  });

  it("guideCountdownTickFractionsAtom matches the pure helper for the active step", () => {
    const store = makePlayingStore();
    const windowMs = store.get(guideCountdownWindowMsAtom);
    const bar = store.get(progressionBarDurationMsAtom);
    const beatsPerBar = store.get(beatsPerBarAtom);
    const beatMs = beatsPerBar > 0 ? bar / beatsPerBar : 0;
    expect(store.get(guideCountdownTickFractionsAtom)).toEqual(
      computeCountdownTickFractions(windowMs, beatMs, bar),
    );
  });

  it("guideCountdownActiveAtom is false outside the window and true inside", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    const stepMs = store.get(progressionStepDurationMsAtom);
    const bar = store.get(progressionBarDurationMsAtom);
    const windowMs = Math.min(stepMs, 2 * bar);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false });

    // Deadline far in the future → step barely started → outside the window.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 1000);
    expect(store.get(guideCountdownActiveAtom)).toBe(false);

    // Deadline inside the window → active.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 50);
    expect(store.get(guideCountdownActiveAtom)).toBe(true);
  });

  it("guideCountdownActiveAtom holds across the boundary gap (audio ahead of displayed)", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    // Audio frame already on the next step while the fretboard still shows step 0.
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0.0, localFraction: 0.0, paused: false });
    expect(store.get(guideCountdownActiveAtom)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// practiceLensAtom
// ---------------------------------------------------------------------------

describe("practiceLensAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'guide'", () => {
    const store = createStore();
    expect(store.get(practiceLensAtom)).toBe("guide");
  });

  it("accepts 'root' and 'common'", () => {
    const store = createStore();
    store.set(practiceLensAtom, "root");
    expect(store.get(practiceLensAtom)).toBe("root");
    store.set(practiceLensAtom, "common");
    expect(store.get(practiceLensAtom)).toBe("common");
  });

  it("discards a legacy invalid stored value, healing to 'guide'", () => {
    localStorage.setItem("fretflow:practiceLens", JSON.stringify("tones"));
    const store = createStore();
    expect(store.get(practiceLensAtom)).toBe("guide");
  });
});

describe("nextTargetToneLabelsAtom — lens-aware targets", () => {
  // Seed: active step Dm7 (degree ii in C major), next step G7 (degree V).
  // G7 = G B D F → guide tones B(3) F(b7); root G.
  function makeIIVStore() {
    const store = createStore();
    store.set(scaleNameAtom, "major");
    store.set(rootNoteAtom, "C");
    store.set(progressionStepsAtom, [
      { id: "s1", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "s2", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7", manualRoot: null },
    ] as ProgressionStep[]);
    store.set(activeProgressionStepIndexAtom, 0); // active = Dm7, next = G7
    return store;
  }

  it("guide lens → next chord's 3rd & 7th with interval labels", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "guide");
    const labels = store.get(nextTargetToneLabelsAtom);
    expect(new Set(labels.keys())).toEqual(new Set(["B", "F"])); // G7 3rd + b7
    expect(labels.get("B")).toBe("3");
    expect(labels.get("F")).toBe("b7");
  });

  it("root lens → next chord's root labeled 'R'", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "root");
    const labels = store.get(nextTargetToneLabelsAtom);
    expect(new Set(labels.keys())).toEqual(new Set(["G"]));
    expect(labels.get("G")).toBe("R");
  });

  it("common lens → empty map (no aim ring)", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "common");
    expect(store.get(nextTargetToneLabelsAtom).size).toBe(0);
  });

  it("nextChordGuideToneLabelsAtom is an alias of nextTargetToneLabelsAtom", () => {
    expect(nextChordGuideToneLabelsAtom).toBe(nextTargetToneLabelsAtom);
  });

  it("nextChordGuideTonesAtom tracks the active lens's target set", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "root");
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set(["G"]));
  });
});
