// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStore } from "jotai";
import type { PracticeLens } from "@fretflow/core";
import { k } from "../utils/storage";
import { practiceLensAtom, chordHiddenNotesAtom, chordTypeAtom } from "./chordOverlayAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { practiceCuesAtom, showChordPracticeBarAtom, practiceBarLensLabelAtom, practiceBarChordGroupAtom, practiceBarLandOnGroupAtom, lensAvailabilityAtom, noteSemanticMapAtom, nextChordTonesAtom, commonTonesWithNextAtom, beatPositionAtom, activeStepDurationBeatsAtom } from "./practiceLensAtoms";
import { progressionStepsAtom, activeProgressionStepIndexAtom, progressionTempoBpmAtom, progressionStepDeadlineAtom, beatsPerBarAtom } from "./progressionAtoms";
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
      const store = makeChordStore("Major", "G", "Dominant 7th", "tones");
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
      const cues = makeChordStore("Major", "C", "Major Triad", "tones").get(practiceCuesAtom);
      expect(cues[0]!.notes.map((n) => n.intervalName)).toEqual(["1", "3", "5"]);
    });

    it("returns empty cues when chord overlay is off", () => {
      const store = setUp({ overlayMode: "off", lens: "tones" });
      expect(store.get(practiceCuesAtom)).toHaveLength(0);
    });

    it("guide tone notes have role=guide-tone", () => {
      const store = makeChordStore("Major", "G", "Dominant 7th", "tones");
      const cues = store.get(practiceCuesAtom);
      const guideToneCue = cues.find((c) => c.kind === "guide-tones");
      expect(guideToneCue).toBeDefined();
      expect(guideToneCue!.notes.every((n) => n.role === "guide-tone")).toBe(true);
    });
  });

  describe("lead lens", () => {
    it("returns land-on + tension cues when chord has outside-scale tones", () => {
      const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad", lens: "lead" });
      expect(store.get(practiceCuesAtom).map((c) => c.kind)).toEqual(["land-on", "tension"]);
    });

    it("tension notes include outside chord root and have resolvesTo targets", () => {
      const store = makeChordStore("Major", "C", "Minor Triad", "lead");
      setChordViaProgression(store, { root: "C#" }); // outside the C major scale
      const tensionCue = store.get(practiceCuesAtom).find((c) => c.kind === "tension");
      expect(tensionCue).toBeDefined();
      expect(tensionCue!.notes.map((n) => n.internalNote)).toContain("C#");
      expect(tensionCue!.notes.some((n) => n.resolvesTo !== undefined)).toBe(true);
    });

    it("returns only land-on when chord is fully in-scale (no outside tones)", () => {
      const kinds = makeChordStore("Major", "C", "Major Triad", "lead").get(practiceCuesAtom).map((c) => c.kind);
      expect(kinds).toContain("land-on");
      expect(kinds).not.toContain("tension");
    });

    it("finds resolution target within 2 semitones for pentatonic scale", () => {
      const store = setUp({ scaleRoot: "C", scale: "Minor Pentatonic", chordRoot: "D", chordType: "Minor Triad", lens: "lead" });
      const tensionCue = store.get(practiceCuesAtom).find((c) => c.kind === "tension");
      expect(tensionCue!.notes.find((n) => n.internalNote === "D")?.resolvesTo).toBeDefined();
    });
  });

  describe("LENS_REGISTRY — chord-overlay lens model", () => {
    it("does not include targets-color or color lenses", () => {
      const store = setUp({ chordRoot: "C", chordType: "Major Triad" });
      const ids = store.get(lensAvailabilityAtom).map((l) => l.id);
      expect(ids).not.toContain("targets-color");
      expect(ids).not.toContain("color");
    });

    it("contains exactly tones and lead lenses", () => {
      const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major 7th" });
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
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad" });
    const s = store.get(noteSemanticMapAtom).get("C#");
    expect(s).toBeDefined();
    expect(s!.isChordRoot).toBe(true);
    expect(s!.isTension).toBe(true);
    expect(s!.isInScale).toBe(false);
  });

  it("identifies guide tones (3rd and 7th) correctly", () => {
    const map = setUp({ scaleRoot: "G", scale: "Major", chordRoot: "G", chordType: "Dominant 7th" }).get(noteSemanticMapAtom);
    expect(map.get("B")?.isGuideTone).toBe(true);
    expect(map.get("F")?.isGuideTone).toBe(true);
    expect(map.get("D")?.isGuideTone).toBe(false);
  });

  it("a note can be both color tone and chord tone", () => {
    const f = setUp({ scaleRoot: "G", scale: "Mixolydian", chordRoot: "G", chordType: "Dominant 7th" })
      .get(noteSemanticMapAtom).get("F");
    expect(f?.isColorTone).toBe(true);
    expect(f?.isChordTone).toBe(true);
  });

  it("returns empty map when chord overlay is off", () => {
    expect(setUp({ overlayMode: "off" }).get(noteSemanticMapAtom).size).toBe(0);
  });

  it("hidden chord root no longer carries chord-root semantics", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major Triad" });
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
    const store = setUp({ scaleRoot: "C", scale: "Major" });
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

describe("showChordPracticeBarAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when chord overlay is off", () => {
    expect(setUp({ overlayMode: "off" }).get(showChordPracticeBarAtom)).toBe(false);
  });

  it.each(["tones", "lead"] as const)(
    "returns true when chord is active regardless of lens (%s)",
    (lens) => {
      const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major Triad", lens });
      expect(store.get(showChordPracticeBarAtom)).toBe(true);
    },
  );

  it("returns true for Am chord on Am scale (previously suppressed)", () => {
    const store = setUp({ scaleRoot: "A", scale: "Natural Minor", chordRoot: "A", chordType: "Minor Triad", lens: "tones" });
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
  });
});

describe("practiceBarChordGroupAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows scale-relative interval for outside-scale tones (no memberName fallback)", () => {
    // C# Minor Triad (C#, E, G#) against C Major — C# and G# are outside the scale.
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad" });
    expect(store.get(practiceBarChordGroupAtom).notes.map((n) => [n.internalNote, n.intervalName])).toEqual([
      ["C#", "♭2"], ["E", "3"], ["G#", "♭6"],
    ]);
  });

  it("is lens-independent — same chord regardless of active lens", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Dominant 7th" });
    const notesByLens: Record<string, string[]> = {};
    for (const lens of ["tones", "lead"] as const) {
      store.set(practiceLensAtom, lens);
      notesByLens[lens] = store.get(practiceBarChordGroupAtom).notes.map((n) => n.internalNote);
    }
    expect(notesByLens.tones).toEqual(notesByLens.lead);
  });

  it("always contains all chord members", () => {
    const notes = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "G", chordType: "Dominant 7th" })
      .get(practiceBarChordGroupAtom).notes.map((n) => n.internalNote);
    expect(notes).toEqual(expect.arrayContaining(["G", "B", "D", "F"]));
  });

  it("outside chord root carries both isChordRoot and isTension", () => {
    const cSharp = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad" })
      .get(practiceBarChordGroupAtom).notes.find((n) => n.internalNote === "C#");
    expect(cSharp).toBeDefined();
    expect(cSharp!.isChordRoot).toBe(true);
    expect(cSharp!.isTension).toBe(true);
    expect(cSharp!.isInScale).toBe(false);
  });

  it("guide tones carry isGuideTone, ordinary chord tones do not", () => {
    const group = setUp({ scaleRoot: "G", scale: "Major", chordRoot: "G", chordType: "Dominant 7th" })
      .get(practiceBarChordGroupAtom);
    expect(group.notes.find((n) => n.internalNote === "B")?.isGuideTone).toBe(true);
    expect(group.notes.find((n) => n.internalNote === "F")?.isGuideTone).toBe(true);
    expect(group.notes.find((n) => n.internalNote === "D")?.isGuideTone).toBe(false);
  });
});

describe("practiceBarLandOnGroupAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("tones lens — contains guide-tone (3rd/7th) members", () => {
    const notes = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "G", chordType: "Dominant 7th", lens: "tones" })
      .get(practiceBarLandOnGroupAtom).notes.map((n) => n.internalNote);
    expect(notes).toEqual(expect.arrayContaining(["B", "F"]));
    expect(notes).not.toContain("D");
    expect(notes).not.toContain("G");
  });

  it("lead lens — contains only outside-scale chord members with resolutions", () => {
    const notes = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad", lens: "lead" })
      .get(practiceBarLandOnGroupAtom).notes;
    const internals = notes.map((n) => n.internalNote);
    expect(internals).toEqual(expect.arrayContaining(["C#", "G#"]));
    expect(internals).not.toContain("E");
    const cSharp = notes.find((n) => n.internalNote === "C#");
    expect(cSharp?.isChordRoot).toBe(true);
    expect(cSharp?.isTension).toBe(true);
    expect(cSharp?.resolvesTo).toBeDefined();
  });

  it.each(["tones", "lead"] as const)("group label is 'Land on' for %s lens", (lens) => {
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major Triad", lens });
    expect(store.get(practiceBarLandOnGroupAtom).label).toBe("Land on");
  });
});

describe("practiceBarLensLabelAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when chord overlay is off", () => {
    expect(setUp({ overlayMode: "off" }).get(practiceBarLensLabelAtom)).toBeNull();
  });

  it.each<[PracticeLens, string]>([
    ["tones", "Tones"],
    ["lead", "Lead"],
  ])("returns %s label = %s", (lens, label) => {
    const store = setUp({ chordRoot: "C", chordType: "Major Triad", lens });
    expect(store.get(practiceBarLensLabelAtom)).toBe(label);
  });
});

describe("showChordPracticeBarAtom — scale visibility independence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each<[string, string, string]>([
    ["in-scale chord", "C", "Major Triad"],
    ["chord with outside tones", "C#", "Minor Triad"],
  ])("shows the dock when scale visibility is off (%s)", (_label, chordRoot, chordType) => {
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot, chordType, lens: "tones", scaleVisible: false });
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
  });

  it("dock visibility does not change when toggling scaleVisibleAtom", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Dominant 7th", lens: "tones" });
    store.set(scaleVisibleAtom, true);
    const visibleOn = store.get(showChordPracticeBarAtom);
    store.set(scaleVisibleAtom, false);
    expect(store.get(showChordPracticeBarAtom)).toBe(visibleOn);
  });
});

describe("chord overlay does not control scale visibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enabling chord overlay does not change effectiveShapeDataAtom highlightNotes count", () => {
    // Start with the overlay off (empty progression) then add a chord.
    const store = setUp({ scaleRoot: "C", scale: "Major", scaleVisible: true, overlayMode: "off" });
    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;
    store.set(progressionStepsAtom, [
      { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
    ]);
    expect(store.get(effectiveShapeDataAtom).highlightNotes.length).toBe(before);
  });

  it("disabling chord overlay does not change scale highlight notes", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", scaleVisible: true, chordType: "Major Triad" });
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
    const store = setUp({ scaleRoot: "C", scale: "Major", scaleVisible: true, chordType: "Major Triad", lens: "tones" });
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
    expect(setUp({ scaleRoot: "C", scale: "Minor Blues" }).get(colorNotesAtom).length).toBeGreaterThan(0);
  });

  it("colorNotesAtom is unaffected by chord type changes", () => {
    const store = setUp({ scaleRoot: "C", scale: "Minor Blues" });
    const before = store.get(colorNotesAtom);
    setChordViaProgression(store, { quality: "Dominant 7th" });
    expect(store.get(colorNotesAtom)).toEqual(before);
  });

  it("effectiveColorNotesAtom is cleared by scaleVisible=false, not by chord overlay", () => {
    const store = setUp({ scaleRoot: "C", scale: "Minor Blues", chordType: "Dominant 7th", scaleVisible: true });
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
    const map = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major Triad" }).get(noteSemanticMapAtom);
    for (const note of ["C", "D", "E", "F", "G", "A", "B"]) {
      expect(map.get(note), `expected semantics for ${note}`).toBeDefined();
      expect(map.get(note)!.scaleDegree, `expected scaleDegree for ${note}`).toBeDefined();
    }
  });

  it("out-of-scale notes have scaleDegree undefined", () => {
    const map = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad" }).get(noteSemanticMapAtom);
    const cSharp = map.get("C#");
    expect(cSharp).toBeDefined();
    expect(cSharp!.isInScale).toBe(false);
    expect(cSharp!.scaleDegree).toBeUndefined();
  });

  it("isDiatonicChord is true for chord tone when degree mode matches diatonic chord", () => {
    const map = setUp({ scaleRoot: "C", scale: "Major", chordDegree: "I", overlayMode: "degree" }).get(noteSemanticMapAtom);
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
    const map = setUp({ scaleRoot: "C", scale: "Major", chordDegree: "I", chordType: "Minor Triad" }).get(noteSemanticMapAtom);
    for (const note of ["C", "E", "G"]) {
      const s = map.get(note);
      if (s?.isChordTone) expect(s.isDiatonicChord).toBeFalsy();
    }
  });

  it("isDiatonicChord is false when a non-diatonic quality override is set in degree mode", () => {
    // The chord is owned by the active progression step. Seed a step at
    // degree=I with a qualityOverride of "Minor Triad" — the diatonic
    // quality at I in C Major is Major Triad, so the override produces a
    // non-diatonic chord even though the cached degree is "I".
    const store = setUp({ scaleRoot: "C", scale: "Major", chordDegree: "I", chordType: "Minor Triad" });

    expect(store.get(chordTypeAtom)).toBe("Minor Triad");

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
