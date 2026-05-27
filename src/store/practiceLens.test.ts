// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStore } from "jotai";
import type { PracticeLens } from "@fretflow/core";
import { k } from "../utils/storage";
import { practiceLensAtom, chordHiddenNotesAtom, chordTypeAtom } from "./chordOverlayAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { practiceCuesAtom, lensAvailabilityAtom, noteSemanticMapAtom, nextChordTonesAtom, commonTonesWithNextAtom, nextChordGuideTonesAtom, beatPositionAtom, activeStepDurationBeatsAtom } from "./practiceLensAtoms";
import { progressionStepsAtom, activeProgressionStepIndexAtom, progressionTempoBpmAtom, progressionStepDeadlineAtom, beatsPerBarAtom, activeResolvedProgressionStepAtom, displayedStepIndexPrimitiveAtom, setProgressionActiveStepIndexAtom, setProgressionPlayingAtom } from "./progressionAtoms";
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
  // Phase 2.5: the chord is owned by the active progression step. Tests
  // start with a one-step progression seeded to the test's chord; Setup
  // entries that pass `chordRoot`/`chordType` update the active step via
  // `updateActiveChordAtom`. To disable the chord overlay, set `chordType: null`.
  //
  // `degree: "ii"` resolves in every diatonic scale (Major, Natural Minor,
  // Dorian, Minor Pentatonic, …) so tests can swap scales freely without
  // accidentally turning the step `unavailable`.
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
  lens?: PracticeLens;
  scaleVisible?: boolean;
  hidden?: Set<string>;
};

function setUp(o: Setup = {}) {
  const store = makeStore();
  if (o.scaleRoot !== undefined) store.set(rootNoteAtom, o.scaleRoot);
  if (o.scale !== undefined) {
    store.set(scaleNameAtom, o.scale);
    // Reseat the step's degree on the tonic of the new scale so the
    // resolver never returns `unavailable` for legitimate test scenarios.
    store.set(updateActiveChordAtom, {
      degree: tonicDegreeFor(o.scale) as import("@fretflow/core").DegreeId,
    });
  }
  // Overlay-off path: empty progression so no active chord exists.
  if (o.overlayMode === "off") {
    store.set(progressionStepsAtom, []);
  } else {
    // Apply chord patches via the active step's manualRoot / qualityOverride.
    const patch: { root?: string | null; quality?: string | null; degree?: import("@fretflow/core").DegreeId } = {};
    if (o.chordRoot !== undefined) patch.root = o.chordRoot;
    if (o.chordType !== undefined) patch.quality = o.chordType;
    if (o.chordDegree !== undefined) {
      // chordDegree=null clears the chord by emptying the progression.
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
  if (o.lens !== undefined) store.set(practiceLensAtom, o.lens);
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

describe("practiceLensAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to tones", () => {
    expect(makeStore().get(practiceLensAtom)).toBe("tones");
  });

  it.each<{ label: string; key: string; value: string; expected: string }>([
    { label: "reads stored value tones", key: "practiceLens", value: "tones", expected: "tones" },
    { label: "reads stored value lead", key: "practiceLens", value: "lead", expected: "lead" },
    { label: "migrates viewMode=chord → tones", key: "viewMode", value: "chord", expected: "tones" },
    { label: "migrates viewMode=outside → lead", key: "viewMode", value: "outside", expected: "lead" },
    { label: "migrates viewMode=compare → tones (default)", key: "viewMode", value: "compare", expected: "tones" },
    { label: "migrates stored targets-color → tones (removed lens)", key: "practiceLens", value: "targets-color", expected: "tones" },
    { label: "migrates stored color → tones (removed lens)", key: "practiceLens", value: "color", expected: "tones" },
    { label: "ignores invalid stored value, falls back to default", key: "practiceLens", value: "invalid-lens", expected: "tones" },
  ])("$label", ({ key, value, expected }) => {
    localStorage.setItem(k(key), value);
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe(expected);
    unsub();
  });
});

describe("practiceLensAtom — migration to tones+lead (Task 4.1)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy targets → tones", () => {
    localStorage.setItem(k("practiceLens"), "targets");
    const store = createStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("tones");
    unsub();
  });

  it("migrates legacy guide-tones → tones", () => {
    localStorage.setItem(k("practiceLens"), "guide-tones");
    const store = createStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("tones");
    unsub();
  });

  it("migrates legacy tension → lead", () => {
    localStorage.setItem(k("practiceLens"), "tension");
    const store = createStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("lead");
    unsub();
  });

  it("lensAvailabilityAtom returns exactly two entries", () => {
    const store = createStore();
    expect(store.get(lensAvailabilityAtom)).toHaveLength(2);
  });
});

describe("practiceCuesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const makeChordStore = (scale: string, root: string, chordType: string, lens: PracticeLens) =>
    setUp({ scaleRoot: root, scale, chordRoot: root, chordType, lens });

  describe("tones lens", () => {
    it("returns land-on + guide-tones cues for a seventh chord (3rd + 7th)", () => {
      const store = makeChordStore("major", "G", "7", "tones");
      const cues = store.get(practiceCuesAtom);
      expect(cues.length).toBe(2);
      expect(cues[0]!.kind).toBe("land-on");
      expect(cues[0]!.label).toBe("Land on");
      expect(cues[1]!.kind).toBe("guide-tones");
      expect(cues[1]!.label).toBe("Guide tones");
      const noteNames = cues[1]!.notes.map((n) => n.internalNote);
      expect(noteNames).toContain("B");
      expect(noteNames).toContain("F");
    });

    it("uses scale degrees for in-scale note labels", () => {
      const cues = makeChordStore("major", "C", "M", "tones").get(practiceCuesAtom);
      expect(cues[0]!.notes.map((n) => n.intervalName)).toEqual(["1", "3", "5"]);
    });

    it("returns empty cues when chord overlay is off", () => {
      const store = setUp({ overlayMode: "off", lens: "tones" });
      expect(store.get(practiceCuesAtom)).toHaveLength(0);
    });

    it("guide tone notes have role=guide-tone", () => {
      const store = makeChordStore("major", "G", "7", "tones");
      const cues = store.get(practiceCuesAtom);
      const guideToneCue = cues.find((c) => c.kind === "guide-tones");
      expect(guideToneCue).toBeDefined();
      expect(guideToneCue!.notes.every((n) => n.role === "guide-tone")).toBe(true);
    });
  });

  describe("lead lens", () => {
    it("returns land-on + tension cues when chord has outside-scale tones", () => {
      const store = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C#", chordType: "m", lens: "lead" });
      expect(store.get(practiceCuesAtom).map((c) => c.kind)).toEqual(["land-on", "tension"]);
    });

    it("tension notes include outside chord root and have resolvesTo targets", () => {
      const store = makeChordStore("major", "C", "m", "lead");
      setChordViaProgression(store, { root: "C#" }); // outside the C major scale
      const tensionCue = store.get(practiceCuesAtom).find((c) => c.kind === "tension");
      expect(tensionCue).toBeDefined();
      expect(tensionCue!.notes.map((n) => n.internalNote)).toContain("C#");
      expect(tensionCue!.notes.some((n) => n.resolvesTo !== undefined)).toBe(true);
    });

    it("returns only land-on when chord is fully in-scale (no outside tones)", () => {
      const kinds = makeChordStore("major", "C", "M", "lead").get(practiceCuesAtom).map((c) => c.kind);
      expect(kinds).toContain("land-on");
      expect(kinds).not.toContain("tension");
    });

    it("finds resolution target within 2 semitones for pentatonic scale", () => {
      const store = setUp({ scaleRoot: "C", scale: "minor pentatonic", chordRoot: "D", chordType: "m", lens: "lead" });
      const tensionCue = store.get(practiceCuesAtom).find((c) => c.kind === "tension");
      expect(tensionCue!.notes.find((n) => n.internalNote === "D")?.resolvesTo).toBeDefined();
    });
  });

  describe("LENS_REGISTRY — chord-overlay lens model", () => {
    it("does not include targets-color or color lenses", () => {
      const store = setUp({ chordRoot: "C", chordType: "M" });
      const ids = store.get(lensAvailabilityAtom).map((l) => l.id);
      expect(ids).not.toContain("targets-color");
      expect(ids).not.toContain("color");
    });

    it("contains exactly tones and lead lenses", () => {
      const store = setUp({ scaleRoot: "C", scale: "major", chordRoot: "C", chordType: "maj7" });
      const ids = store.get(lensAvailabilityAtom).map((l) => l.id);
      expect(ids).toEqual(expect.arrayContaining(["tones", "lead"]));
      expect(ids).toHaveLength(2);
    });
  });
});

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
    // C is still in the C Major scale, so it remains in the map but loses chord roles.
    expect(after).toBeDefined();
    expect(after!.isChordTone).toBe(false);
    expect(after!.isChordRoot).toBe(false);
  });

  it("uses progression chord semantics even with one-string fingering pattern", () => {
    // With one-string pattern, chord overlay is no longer disabled.
    // The progression step (V = G Major Triad, diatonic) is the active chord source.
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


describe("chord overlay does not control scale visibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enabling chord overlay does not change effectiveShapeDataAtom highlightNotes count", () => {
    // Start with the overlay off (empty progression) then add a chord.
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

describe("Chord Tones lens does not hide scale notes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("effectiveShapeDataAtom highlightNotes unchanged when switching between lenses", () => {
    const store = setUp({ scaleRoot: "C", scale: "major", scaleVisible: true, chordType: "M", lens: "tones" });
    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;
    store.set(practiceLensAtom, "lead");
    expect(store.get(effectiveShapeDataAtom).highlightNotes.length).toBe(before);
  });
});

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
// Phase 04 — noteSemanticMapAtom scaleDegree + isDiatonicChord
// ---------------------------------------------------------------------------

describe("noteSemanticMapAtom — Phase 04 scaleDegree and isDiatonicChord", () => {
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
    // Degree=I in C Major's diatonic chord is Major Triad; overriding to
    // Minor Triad produces a non-diatonic chord.
    const map = setUp({ scaleRoot: "C", scale: "major", chordDegree: "I", chordType: "m" }).get(noteSemanticMapAtom);
    for (const note of ["C", "E", "G"]) {
      const s = map.get(note);
      if (s?.isChordTone) expect(s.isDiatonicChord).toBeFalsy();
    }
  });

  it("isDiatonicChord is false when a non-diatonic quality override is set in degree mode", () => {
    // The chord is owned by the active progression step. Seed a step at
    // degree=I with a qualityOverride of "m" — the diatonic
    // quality at I in C Major is Major Triad, so the override produces a
    // non-diatonic chord even though the cached degree is "I".
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
// Task 4.2 — nextChordTonesAtom / commonTonesWithNextAtom
// ---------------------------------------------------------------------------

describe("nextChordTonesAtom / commonTonesWithNextAtom (Task 4.2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Uses a raw createStore() with no overrides so the default progression
   * (I-V-vi-IV in C Major) and active index (0) take effect.
   * Active step 0 = C Major Triad {C,E,G}; next step (index 1) = G Major Triad {G,B,D}.
   */
  function makeDefaultStore() {
    const store = createStore();
    // Trigger atomWithStorage initialisation for atoms that read from localStorage.
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("nextChordTonesAtom returns the notes of the step after the active step", () => {
    const store = makeDefaultStore();
    // Default: active = 0 (C Major Triad), next = 1 (G Major Triad).
    expect(store.get(nextChordTonesAtom)).toEqual(new Set(["G", "B", "D"]));
  });

  it("commonTonesWithNextAtom is the intersection of active and next chord tones", () => {
    const store = makeDefaultStore();
    // C Major {C,E,G} ∩ G Major {G,B,D} = {G}
    expect(store.get(commonTonesWithNextAtom)).toEqual(new Set(["G"]));
  });

  it("nextChordTonesAtom wraps around when the active step is the last step", () => {
    const store = makeDefaultStore();
    // Set active to the last step (index 3 = IV = F Major Triad {F,A,C}).
    // Next wraps to index 0 = I = C Major Triad {C,E,G}.
    store.set(activeProgressionStepIndexAtom, 3);
    expect(store.get(nextChordTonesAtom)).toEqual(new Set(["C", "E", "G"]));
  });

  it("nextChordTonesAtom returns the same step's tones when progression has one step", () => {
    const store = makeDefaultStore();
    const allSteps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, [allSteps[0]!]);
    // Single step = I in C Major = C Major Triad {C, E, G}. Next wraps to itself.
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
// Task 4.3 — activeStepDurationBeatsAtom / beatPositionAtom
// ---------------------------------------------------------------------------

describe("activeStepDurationBeatsAtom (Task 4.3)", () => {
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
    // Default step 0 is degree "I", duration { value: 1, unit: "bar" }.
    // Default beatsPerBar = 4 → 1 * 4 = 4 beats.
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
    // progressionStepDeadlineAtom defaults to null
    expect(store.get(progressionStepDeadlineAtom)).toBeNull();
    expect(store.get(beatPositionAtom)).toBe(0);
  });

  it("derives beat position from deadline + tempo at two points in time", () => {
    vi.useFakeTimers();
    // T=0: 2s until deadline at 120 BPM => 4 beats remaining, stepDuration=4 => position 0
    {
      const store = makeDefaultStore();
      store.set(progressionTempoBpmAtom, 120);
      store.set(progressionStepDeadlineAtom, Date.now() + 2000);
      // stepDurationBeats = 4, beatsRemaining = 4 => beatPosition = 0
      expect(store.get(beatPositionAtom)).toBeCloseTo(0, 1);
    }
    vi.advanceTimersByTime(500);
    // T=500ms: 1.5s until deadline at 120 BPM => 3 beats remaining => position 1
    {
      const store = makeDefaultStore();
      store.set(progressionTempoBpmAtom, 120);
      store.set(progressionStepDeadlineAtom, Date.now() + 1500);
      // stepDurationBeats = 4, beatsRemaining = 3 => beatPosition = 1
      expect(store.get(beatPositionAtom)).toBeCloseTo(1, 1);
    }
  });

  it("clamps to stepDurationBeats when deadline is in the past", () => {
    vi.useFakeTimers();
    const store = makeDefaultStore();
    store.set(progressionTempoBpmAtom, 120);
    // deadline already passed
    store.set(progressionStepDeadlineAtom, Date.now() - 1000);
    // secondsRemaining = 0 => beatsRemaining = 0 => beatPosition = stepDurationBeats (4)
    expect(store.get(beatPositionAtom)).toBe(4);
  });

  it("clamps to 0 when deadline is far in the future (beatsRemaining > stepDurationBeats)", () => {
    vi.useFakeTimers();
    const store = makeDefaultStore();
    store.set(progressionTempoBpmAtom, 120);
    // 10s deadline at 120 BPM = 20 beats remaining, stepDurationBeats = 4
    // Math.max(0, 4 - 20) = 0
    store.set(progressionStepDeadlineAtom, Date.now() + 10000);
    expect(store.get(beatPositionAtom)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 4.5 — nextChordGuideTonesAtom
// ---------------------------------------------------------------------------

describe("nextChordGuideTonesAtom (Task 4.5)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    // Trigger atomWithStorage initialisation.
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("returns the 3rd and 7th of the next chord (I→V in C Major: G Major has no 7th → returns 3rd B)", () => {
    const store = makeDefaultStore();
    // Default: active = 0 (C Major Triad), next = 1 (G Major Triad).
    // G Major Triad members: root G, 3rd B, 5th D. GUIDE_TONE_RAW = {b3,3,b7,7}.
    // Only B (3rd) qualifies.
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones).toEqual(new Set(["B"]));
  });

  it("returns both 3rd and 7th for a seventh chord", () => {
    const store = makeDefaultStore();
    // Override step 1 (G Major Triad → G Dominant 7th via qualityOverride).
    // G Dominant 7th: G(root), B(3), D(5), F(b7). Guide tones: B (3rd) and F (b7).
    const steps = store.get(progressionStepsAtom);
    const updatedSteps = steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "7" } : s
    );
    store.set(progressionStepsAtom, updatedSteps);
    const guideTones = store.get(nextChordGuideTonesAtom);
    // G Dominant 7th: G(root), B(3), D(5), F(b7). Guide tones: B and F.
    expect(guideTones.has("B")).toBe(true);
    expect(guideTones.has("F")).toBe(true);
    expect(guideTones.size).toBe(2);
  });

  it("returns empty set when next chord has no guide tones (power chord)", () => {
    const store = makeDefaultStore();
    // Override step 1 with Power Chord (5) via qualityOverride.
    // Power Chord (5): root + 5th only — no 3rd or 7th → no guide tones.
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
    // Set active to the last step (index 3 = IV = F Major Triad).
    // Next wraps to index 0 = I = C Major Triad {C,E,G}. Guide tone: E (3rd).
    store.set(activeProgressionStepIndexAtom, 3);
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones.has("E")).toBe(true);
    // C Major Triad: only 3rd (E) is a guide tone (no 7th).
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
    store.set(setProgressionActiveStepIndexAtom, 0);   // logical = 0
    store.set(setProgressionPlayingAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 1);     // RAF advances to 1
    expect(store.get(activeResolvedProgressionStepAtom)?.degree).toBe("V");
  });

  it("activeResolvedProgressionStepAtom falls back to logical when not playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(displayedStepIndexPrimitiveAtom, 1);     // stale RAF write
    expect(store.get(activeResolvedProgressionStepAtom)?.degree).toBe("I");
  });
});

describe("noteSemanticMapAtom — referential stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the same noteSemanticMap reference when a color-note update is value-equal", () => {
    const store = setUp({
      scaleRoot: "G",
      scale: "mixolydian",
      chordRoot: "G",
      chordType: "7",
    });

    const first = store.get(noteSemanticMapAtom);
    // Write a structurally-equal copy of the progression steps. The new array
    // reference forces noteSemanticMapAtom to re-evaluate, but the recomputed
    // semantics are value-equal — value-based memoization must return the
    // original Map reference instead of leaking a fresh one.
    const stepsCopy = store.get(progressionStepsAtom).map((s) => ({ ...s }));
    store.set(progressionStepsAtom, stepsCopy);
    const second = store.get(noteSemanticMapAtom);

    expect(second).toBe(first);
  });
});
