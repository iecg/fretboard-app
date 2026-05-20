// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import type { PracticeLens } from "@fretflow/core";
import { k } from "../utils/storage";
import {
  practiceLensAtom,
  practiceCuesAtom,
  showChordPracticeBarAtom,
  practiceBarLensLabelAtom,
  practiceBarChordGroupAtom,
  practiceBarLandOnGroupAtom,
  lensAvailabilityAtom,
  noteSemanticMapAtom,
  rootNoteAtom,
  scaleNameAtom,
  scaleVisibleAtom,
  chordRootAtom,
  chordTypeAtom,
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordHiddenNotesAtom,
  fingeringPatternAtom,
  progressionStepsAtom,
} from "./atoms";

function makeStore() {
  const store = createStore();
  // Phase B "always-on DAW" removed the progression gate. progressionStepsAtom
  // defaults to a non-empty progression (I-V-vi-IV), which would drive the
  // chord overlay. These tests exercise the manual/degree chord path in
  // isolation, so seed an empty progression to disable the progression source.
  store.set(progressionStepsAtom, []);
  return store;
}

type Setup = {
  scaleRoot?: string;
  scale?: string;
  chordRoot?: string | null;
  chordType?: string | null;
  chordDegree?: string | null;
  overlayMode?: string;
  lens?: PracticeLens;
  scaleVisible?: boolean;
  hidden?: Set<string>;
};

function setUp(o: Setup = {}) {
  const store = makeStore();
  if (o.scaleRoot !== undefined) store.set(rootNoteAtom, o.scaleRoot);
  if (o.scale !== undefined) store.set(scaleNameAtom, o.scale);
  if (o.chordRoot !== undefined) store.set(chordRootAtom, o.chordRoot as never);
  if (o.chordType !== undefined) store.set(chordTypeAtom, o.chordType as never);
  if (o.chordDegree !== undefined) store.set(chordDegreeAtom, o.chordDegree as never);
  if (o.overlayMode !== undefined) store.set(chordOverlayModeAtom, o.overlayMode as never);
  if (o.lens !== undefined) store.set(practiceLensAtom, o.lens);
  if (o.scaleVisible !== undefined) store.set(scaleVisibleAtom, o.scaleVisible);
  if (o.hidden !== undefined) store.set(chordHiddenNotesAtom, o.hidden);
  return store;
}

describe("practiceLensAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to targets", () => {
    expect(makeStore().get(practiceLensAtom)).toBe("targets");
  });

  it.each<{ label: string; key: string; value: string; expected: string }>([
    { label: "reads stored value", key: "practiceLens", value: "targets", expected: "targets" },
    { label: "migrates viewMode=chord → targets", key: "viewMode", value: "chord", expected: "targets" },
    { label: "migrates viewMode=outside → tension", key: "viewMode", value: "outside", expected: "tension" },
    { label: "migrates viewMode=compare → targets (default)", key: "viewMode", value: "compare", expected: "targets" },
    { label: "migrates stored targets-color → targets (removed lens)", key: "practiceLens", value: "targets-color", expected: "targets" },
    { label: "migrates stored color → targets (removed lens)", key: "practiceLens", value: "color", expected: "targets" },
    { label: "ignores invalid stored value, falls back to default", key: "practiceLens", value: "invalid-lens", expected: "targets" },
  ])("$label", ({ key, value, expected }) => {
    localStorage.setItem(k(key), value);
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe(expected);
    unsub();
  });
});

describe("practiceCuesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const makeChordStore = (scale: string, root: string, chordType: string, lens: PracticeLens) =>
    setUp({ scaleRoot: root, scale, chordRoot: root, chordType, lens });

  describe("targets lens", () => {
    it("returns a land-on cue with all chord tones", () => {
      const store = makeChordStore("Major", "C", "Major Triad", "targets");
      const cues = store.get(practiceCuesAtom);
      expect(cues.length).toBe(1);
      expect(cues[0]!.kind).toBe("land-on");
      expect(cues[0]!.label).toBe("Land on");
      expect(cues[0]!.notes.map((n) => n.internalNote)).toEqual(expect.arrayContaining(["C", "E", "G"]));
    });

    it("uses scale degrees for in-scale note labels", () => {
      const cues = makeChordStore("Major", "C", "Major Triad", "targets").get(practiceCuesAtom);
      expect(cues[0]!.notes.map((n) => n.intervalName)).toEqual(["1", "3", "5"]);
    });

    it("returns empty cues when chord overlay is off", () => {
      const store = setUp({ overlayMode: "off", lens: "targets" });
      expect(store.get(practiceCuesAtom)).toHaveLength(0);
    });
  });

  describe("guide-tones lens", () => {
    it("returns land-on + guide-tones cues for a seventh chord (3rd + 7th)", () => {
      const store = makeChordStore("Major", "G", "Dominant 7th", "guide-tones");
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

    it("guide tones for a triad returns land-on first, then guide-tones with the 3rd", () => {
      const store = makeChordStore("Major", "C", "Major Triad", "guide-tones");
      const cues = store.get(practiceCuesAtom);
      expect(cues.length).toBe(2);
      expect(cues[0]!.kind).toBe("land-on");
      expect(cues[1]!.kind).toBe("guide-tones");
      const noteNames = cues[1]!.notes.map((n) => n.internalNote);
      expect(noteNames).toContain("E");
    });

    it("shows only land-on for power chord (no 3rd/7th)", () => {
      const store = makeChordStore("Major", "G", "Power Chord (5)", "guide-tones");
      const cues = store.get(practiceCuesAtom);
      expect(cues.length).toBe(1);
      expect(cues[0]!.kind).toBe("land-on");
    });

    it("guide tone notes have role=guide-tone", () => {
      const store = makeChordStore("Major", "G", "Dominant 7th", "guide-tones");
      const cues = store.get(practiceCuesAtom);
      const guideToneCue = cues.find((c) => c.kind === "guide-tones");
      expect(guideToneCue).toBeDefined();
      expect(guideToneCue!.notes.every((n) => n.role === "guide-tone")).toBe(true);
    });
  });

  describe("tension lens", () => {
    it("returns land-on + tension cues when chord has outside-scale tones", () => {
      const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad", lens: "tension" });
      expect(store.get(practiceCuesAtom).map((c) => c.kind)).toEqual(["land-on", "tension"]);
    });

    it("tension notes include outside chord root and have resolvesTo targets", () => {
      const store = makeChordStore("Major", "C", "Minor Triad", "tension");
      store.set(chordRootAtom, "C#"); // outside the C major scale
      const tensionCue = store.get(practiceCuesAtom).find((c) => c.kind === "tension");
      expect(tensionCue).toBeDefined();
      expect(tensionCue!.notes.map((n) => n.internalNote)).toContain("C#");
      expect(tensionCue!.notes.some((n) => n.resolvesTo !== undefined)).toBe(true);
    });

    it("returns only land-on when chord is fully in-scale (no outside tones)", () => {
      const kinds = makeChordStore("Major", "C", "Major Triad", "tension").get(practiceCuesAtom).map((c) => c.kind);
      expect(kinds).toContain("land-on");
      expect(kinds).not.toContain("tension");
    });

    it("finds resolution target within 2 semitones for pentatonic scale", () => {
      const store = setUp({ scaleRoot: "C", scale: "Minor Pentatonic", chordRoot: "D", chordType: "Minor Triad", lens: "tension" });
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

    it("contains exactly Chord Tones, Guide Tones, and Tension", () => {
      const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major 7th" });
      const ids = store.get(lensAvailabilityAtom).map((l) => l.id);
      expect(ids).toEqual(expect.arrayContaining(["targets", "guide-tones", "tension"]));
      expect(ids).toHaveLength(3);
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
      { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
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

  it.each(["targets", "guide-tones", "tension"] as const)(
    "returns true when chord is active regardless of lens (%s)",
    (lens) => {
      const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major Triad", lens });
      expect(store.get(showChordPracticeBarAtom)).toBe(true);
    },
  );

  it("returns true for Am chord on Am scale (previously suppressed)", () => {
    const store = setUp({ scaleRoot: "A", scale: "Natural Minor", chordRoot: "A", chordType: "Minor Triad", lens: "targets" });
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
    for (const lens of ["targets", "guide-tones", "tension"] as const) {
      store.set(practiceLensAtom, lens);
      notesByLens[lens] = store.get(practiceBarChordGroupAtom).notes.map((n) => n.internalNote);
    }
    expect(notesByLens.targets).toEqual(notesByLens["guide-tones"]);
    expect(notesByLens.targets).toEqual(notesByLens.tension);
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

  it("targets lens — contains all chord members", () => {
    const notes = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Major Triad", lens: "targets" })
      .get(practiceBarLandOnGroupAtom).notes.map((n) => n.internalNote);
    expect(notes).toEqual(expect.arrayContaining(["C", "E", "G"]));
  });

  it("guide-tones lens — contains only 3rd/7th members", () => {
    const notes = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "G", chordType: "Dominant 7th", lens: "guide-tones" })
      .get(practiceBarLandOnGroupAtom).notes.map((n) => n.internalNote);
    expect(notes).toEqual(expect.arrayContaining(["B", "F"]));
    expect(notes).not.toContain("D");
    expect(notes).not.toContain("G");
  });

  it("tension lens — contains only outside-scale chord members with resolutions", () => {
    const notes = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C#", chordType: "Minor Triad", lens: "tension" })
      .get(practiceBarLandOnGroupAtom).notes;
    const internals = notes.map((n) => n.internalNote);
    expect(internals).toEqual(expect.arrayContaining(["C#", "G#"]));
    expect(internals).not.toContain("E");
    const cSharp = notes.find((n) => n.internalNote === "C#");
    expect(cSharp?.isChordRoot).toBe(true);
    expect(cSharp?.isTension).toBe(true);
    expect(cSharp?.resolvesTo).toBeDefined();
  });

  it.each(["targets", "guide-tones", "tension"] as const)("group label is 'Land on' for %s lens", (lens) => {
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
    ["targets", "Chord Tones"],
    ["guide-tones", "Guide Tones"],
    ["tension", "Tension"],
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
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot, chordType, lens: "targets", scaleVisible: false });
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
  });

  it("dock visibility does not change when toggling scaleVisibleAtom", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", chordRoot: "C", chordType: "Dominant 7th", lens: "targets" });
    store.set(scaleVisibleAtom, true);
    const visibleOn = store.get(showChordPracticeBarAtom);
    store.set(scaleVisibleAtom, false);
    expect(store.get(showChordPracticeBarAtom)).toBe(visibleOn);
  });
});

import {
  colorNotesAtom,
  effectiveColorNotesAtom,
  effectiveShapeDataAtom,
  toggleScaleVisibleAtom,
} from "./atoms";

describe("chord overlay does not control scale visibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enabling chord overlay does not change effectiveShapeDataAtom highlightNotes count", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", scaleVisible: true });
    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;
    store.set(chordTypeAtom, "Major Triad");
    expect(store.get(effectiveShapeDataAtom).highlightNotes.length).toBe(before);
  });

  it("disabling chord overlay does not change scale highlight notes", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", scaleVisible: true, chordType: "Major Triad" });
    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;
    store.set(chordTypeAtom, null);
    expect(store.get(effectiveShapeDataAtom).highlightNotes.length).toBe(before);
  });
});

describe("Chord Tones lens does not hide scale notes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("effectiveShapeDataAtom highlightNotes unchanged when switching between lenses", () => {
    const store = setUp({ scaleRoot: "C", scale: "Major", scaleVisible: true, chordType: "Major Triad", lens: "targets" });
    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;
    store.set(practiceLensAtom, "guide-tones");
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
    store.set(chordTypeAtom, "Dominant 7th");
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

  it.each<[string, Setup]>([
    ["chordOverlayMode is manual", { scaleRoot: "C", scale: "Major", overlayMode: "manual", chordRoot: "C", chordType: "Major Triad" }],
    ["chordDegree is null (overlay off)", { scaleRoot: "C", scale: "Major", chordDegree: null, overlayMode: "degree", chordRoot: "C", chordType: "Major Triad" }],
  ])("isDiatonicChord is false when %s", (_label, opts) => {
    const map = setUp(opts).get(noteSemanticMapAtom);
    for (const note of ["C", "E", "G"]) {
      const s = map.get(note);
      if (s?.isChordTone) expect(s.isDiatonicChord).toBeFalsy();
    }
  });

  it("isDiatonicChord is false when a non-diatonic quality override is set in degree mode", () => {
    // After the "preserve degree-mode on chord-quality change" fix, writing a
    // chord type while in degree mode no longer flips to manual — the override
    // is applied on top of the degree binding, and the diatonic-chord check
    // correctly identifies it as non-diatonic.
    const store = setUp({ scaleRoot: "C", scale: "Major", chordDegree: "I", overlayMode: "degree", chordType: "Minor Triad" });

    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    expect(store.get(chordTypeAtom)).toBe("Minor Triad");

    const map = store.get(noteSemanticMapAtom);
    expect(map.size).toBeGreaterThan(0);
    const gSem = map.get("G");
    expect(gSem?.isChordTone).toBe(true);
    expect(gSem?.isDiatonicChord).toBeFalsy();
  });
});
