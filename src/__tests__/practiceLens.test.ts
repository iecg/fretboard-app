// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import type { PracticeLens } from "../theory";
import { k } from "../utils/storage";
import {
  practiceLensAtom,
  practiceCuesAtom,
  shapeLocalPracticeCuesAtom,
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
  fingeringPatternAtom,
} from "../store/atoms";

function makeStore() {
  return createStore();
}

describe("practiceLensAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to targets", () => {
    const store = makeStore();
    expect(store.get(practiceLensAtom)).toBe("targets");
  });

  it("reads stored value", () => {
    localStorage.setItem(k("practiceLens"), "targets");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets");
    unsub();
  });

  it("migrates old viewMode=chord to targets lens", () => {
    localStorage.setItem(k("viewMode"), "chord");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets");
    unsub();
  });

  it("migrates old viewMode=outside to tension lens", () => {
    localStorage.setItem(k("viewMode"), "outside");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("tension");
    unsub();
  });

  it("migrates old viewMode=compare to targets lens (default)", () => {
    localStorage.setItem(k("viewMode"), "compare");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets");
    unsub();
  });

  it("migrates stored targets-color to targets (removed lens)", () => {
    localStorage.setItem(k("practiceLens"), "targets-color");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets");
    unsub();
  });

  it("migrates stored color to targets (removed lens)", () => {
    localStorage.setItem(k("practiceLens"), "color");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets");
    unsub();
  });

  it("ignores invalid stored value and falls back to default", () => {
    localStorage.setItem(k("practiceLens"), "invalid-lens");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets");
    unsub();
  });
});

describe("practiceCuesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeChordStore(
    scaleName: string,
    chordRoot: string,
    chordType: string,
    lens: PracticeLens,
  ) {
    const store = makeStore();
    store.set(rootNoteAtom, chordRoot);
    store.set(scaleNameAtom, scaleName);
    store.set(chordRootAtom, chordRoot);
    store.set(chordTypeAtom, chordType);
    store.set(practiceLensAtom, lens);
    return store;
  }

  describe("targets lens", () => {
    it("returns a land-on cue with all chord tones", () => {
      const store = makeChordStore("Major", "C", "Major Triad", "targets");
      const cues = store.get(practiceCuesAtom);
      expect(cues.length).toBe(1);
      expect(cues[0]!.kind).toBe("land-on");
      expect(cues[0]!.label).toBe("Land on");
      const noteNames = cues[0]!.notes.map((n) => n.internalNote);
      expect(noteNames).toContain("C");
      expect(noteNames).toContain("E");
      expect(noteNames).toContain("G");
    });

    it("returns empty cues when no chord is set", () => {
      const store = makeStore();
      store.set(chordTypeAtom, null);
      store.set(practiceLensAtom, "targets");
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
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(chordRootAtom, "C#");
      store.set(chordTypeAtom, "Minor Triad");
      store.set(practiceLensAtom, "tension");
      const cues = store.get(practiceCuesAtom);
      const kinds = cues.map((c) => c.kind);
      expect(kinds).toContain("land-on");
      expect(kinds).toContain("tension");
    });

    it("tension notes include outside chord root (semantic fix)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(chordRootAtom, "C#");
      store.set(chordTypeAtom, "Minor Triad");
      store.set(practiceLensAtom, "tension");
      const cues = store.get(practiceCuesAtom);
      const tensionCue = cues.find((c) => c.kind === "tension");
      expect(tensionCue).toBeDefined();
      const tensionNotes = tensionCue!.notes.map((n) => n.internalNote);
      expect(tensionNotes).toContain("C#");
    });

    it("tension notes have resolution targets (resolvesTo)", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(chordRootAtom, "C#");
      store.set(chordTypeAtom, "Minor Triad");
      store.set(practiceLensAtom, "tension");
      const cues = store.get(practiceCuesAtom);
      const tensionCue = cues.find((c) => c.kind === "tension");
      const hasResolution = tensionCue!.notes.some((n) => n.resolvesTo !== undefined);
      expect(hasResolution).toBe(true);
    });

    it("returns only land-on when chord is fully in-scale (no outside tones)", () => {
      const store = makeChordStore("Major", "C", "Major Triad", "tension");
      const cues = store.get(practiceCuesAtom);
      const kinds = cues.map((c) => c.kind);
      expect(kinds).toContain("land-on");
      expect(kinds).not.toContain("tension");
    });

    it("finds resolution target within 2 semitones for pentatonic scale", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Minor Pentatonic");
      store.set(chordRootAtom, "D");
      store.set(chordTypeAtom, "Minor Triad");
      store.set(practiceLensAtom, "tension");
      const cues = store.get(practiceCuesAtom);
      const tensionCue = cues.find((c) => c.kind === "tension");
      expect(tensionCue).toBeDefined();
      const dTension = tensionCue!.notes.find((n) => n.internalNote === "D");
      expect(dTension?.resolvesTo).toBeDefined();
    });

    it("tension and land-on cues appear together in correct order", () => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(chordRootAtom, "C#");
      store.set(chordTypeAtom, "Minor Triad");
      store.set(practiceLensAtom, "tension");
      const cues = store.get(practiceCuesAtom);
      const kinds = cues.map((c) => c.kind);
      expect(kinds).toEqual(["land-on", "tension"]);
    });
  });

  describe("LENS_REGISTRY — chord-overlay lens model", () => {
    it("does not include targets-color or color lenses", () => {
      const store = makeStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      const availability = store.get(lensAvailabilityAtom);
      const ids = availability.map((l) => l.id);
      expect(ids).not.toContain("targets-color");
      expect(ids).not.toContain("color");
    });

    it("contains exactly Chord Tones, Guide Tones, and Tension", () => {
      const store = makeStore();
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major 7th");
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      const availability = store.get(lensAvailabilityAtom);
      const ids = availability.map((l) => l.id);
      expect(ids).toContain("targets");
      expect(ids).toContain("guide-tones");
      expect(ids).toContain("tension");
      expect(ids).toHaveLength(3);
    });
  });
});

describe("noteSemanticMapAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("correctly identifies outside chord root as both isChordRoot and isTension", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C#");
    store.set(chordTypeAtom, "Minor Triad");

    const semanticMap = store.get(noteSemanticMapAtom);
    const cSharpSemantics = semanticMap.get("C#");
    expect(cSharpSemantics).toBeDefined();
    expect(cSharpSemantics!.isChordRoot).toBe(true);
    expect(cSharpSemantics!.isTension).toBe(true);
    expect(cSharpSemantics!.isInScale).toBe(false);
  });

  it("identifies guide tones (3rd and 7th) correctly", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "G");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");

    const semanticMap = store.get(noteSemanticMapAtom);
    const bSemantics = semanticMap.get("B");
    expect(bSemantics?.isGuideTone).toBe(true);
    const fSemantics = semanticMap.get("F");
    expect(fSemantics?.isGuideTone).toBe(true);
    const dSemantics = semanticMap.get("D");
    expect(dSemantics?.isGuideTone).toBe(false);
  });

  it("a note can be both color tone and chord tone", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "G");
    store.set(scaleNameAtom, "Mixolydian");
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");

    const semanticMap = store.get(noteSemanticMapAtom);
    const fSemantics = semanticMap.get("F");
    expect(fSemantics?.isColorTone).toBe(true);
    expect(fSemantics?.isChordTone).toBe(true);
  });

  it("returns empty map when no chord is active", () => {
    const store = makeStore();
    store.set(chordTypeAtom, null);
    expect(store.get(noteSemanticMapAtom).size).toBe(0);
  });
});

describe("showChordPracticeBarAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when no chord is set", () => {
    const store = makeStore();
    store.set(chordTypeAtom, null);
    expect(store.get(showChordPracticeBarAtom)).toBe(false);
  });

  it.each(["targets", "guide-tones", "tension"] as const)(
    "returns true when chord is active regardless of lens (%s)",
    (lens) => {
      const store = makeStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "Major");
      store.set(chordRootAtom, "C");
      store.set(chordTypeAtom, "Major Triad");
      store.set(practiceLensAtom, lens);
      expect(store.get(showChordPracticeBarAtom)).toBe(true);
    },
  );

  it("returns true for Am chord on Am scale (previously suppressed)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "A");
    store.set(scaleNameAtom, "Natural Minor");
    store.set(chordRootAtom, "A");
    store.set(chordTypeAtom, "Minor Triad");
    store.set(practiceLensAtom, "targets");
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
  });
});

describe("practiceBarChordGroupAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is lens-independent — same chord regardless of active lens", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Dominant 7th");

    const notesByLens: Record<string, string[]> = {};
    for (const lens of ["targets", "guide-tones", "tension"] as const) {
      store.set(practiceLensAtom, lens);
      notesByLens[lens] = store
        .get(practiceBarChordGroupAtom)
        .notes.map((n) => n.internalNote);
    }
    expect(notesByLens.targets).toEqual(notesByLens["guide-tones"]);
    expect(notesByLens.targets).toEqual(notesByLens.tension);
  });

  it("always contains all chord members", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");
    const notes = store
      .get(practiceBarChordGroupAtom)
      .notes.map((n) => n.internalNote);
    expect(notes).toEqual(expect.arrayContaining(["G", "B", "D", "F"]));
  });

  it("outside chord root carries both isChordRoot and isTension", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C#");
    store.set(chordTypeAtom, "Minor Triad");

    const group = store.get(practiceBarChordGroupAtom);
    const cSharp = group.notes.find((n) => n.internalNote === "C#");
    expect(cSharp).toBeDefined();
    expect(cSharp!.isChordRoot).toBe(true);
    expect(cSharp!.isTension).toBe(true);
    expect(cSharp!.isInScale).toBe(false);
  });

  it("guide tones carry isGuideTone, ordinary chord tones do not", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "G");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");

    const group = store.get(practiceBarChordGroupAtom);
    const b = group.notes.find((n) => n.internalNote === "B");
    const f = group.notes.find((n) => n.internalNote === "F");
    const d = group.notes.find((n) => n.internalNote === "D");
    expect(b?.isGuideTone).toBe(true);
    expect(f?.isGuideTone).toBe(true);
    expect(d?.isGuideTone).toBe(false);
  });
});

describe("practiceBarLandOnGroupAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function mkStore(lens: "targets" | "guide-tones" | "tension") {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    return { store, lens };
  }

  it("targets lens — contains all chord members", () => {
    const { store, lens } = mkStore("targets");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, lens);
    const notes = store
      .get(practiceBarLandOnGroupAtom)
      .notes.map((n) => n.internalNote);
    expect(notes).toEqual(expect.arrayContaining(["C", "E", "G"]));
  });

  it("guide-tones lens — contains only 3rd/7th members", () => {
    const { store, lens } = mkStore("guide-tones");
    store.set(chordRootAtom, "G");
    store.set(chordTypeAtom, "Dominant 7th");
    store.set(practiceLensAtom, lens);
    const notes = store
      .get(practiceBarLandOnGroupAtom)
      .notes.map((n) => n.internalNote);
    expect(notes).toEqual(expect.arrayContaining(["B", "F"]));
    expect(notes).not.toContain("D");
    expect(notes).not.toContain("G");
  });

  it("tension lens — contains only outside-scale chord members with resolutions", () => {
    const { store, lens } = mkStore("tension");
    store.set(chordRootAtom, "C#");
    store.set(chordTypeAtom, "Minor Triad");
    store.set(practiceLensAtom, lens);
    const notes = store.get(practiceBarLandOnGroupAtom).notes;
    const internals = notes.map((n) => n.internalNote);
    expect(internals).toEqual(expect.arrayContaining(["C#", "G#"]));
    expect(internals).not.toContain("E");
    const cSharp = notes.find((n) => n.internalNote === "C#");
    expect(cSharp?.isChordRoot).toBe(true);
    expect(cSharp?.isTension).toBe(true);
    expect(cSharp?.resolvesTo).toBeDefined();
  });

  it("group label is always 'Land on' regardless of lens", () => {
    const { store, lens } = mkStore("targets");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, lens);
    expect(store.get(practiceBarLandOnGroupAtom).label).toBe("Land on");

    store.set(practiceLensAtom, "guide-tones");
    expect(store.get(practiceBarLandOnGroupAtom).label).toBe("Land on");

    store.set(practiceLensAtom, "tension");
    expect(store.get(practiceBarLandOnGroupAtom).label).toBe("Land on");
  });
});

describe("shapeLocalPracticeCuesAtom", () => {
  it("returns empty when fingeringPattern is all (no shape context)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, "targets");
    store.set(fingeringPatternAtom, "all");
    expect(store.get(shapeLocalPracticeCuesAtom)).toHaveLength(0);
  });
});

describe("practiceBarLensLabelAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no chord is active", () => {
    const store = makeStore();
    store.set(chordTypeAtom, null);
    expect(store.get(practiceBarLensLabelAtom)).toBeNull();
  });

  it("returns the LENS_REGISTRY label for the active lens", () => {
    const store = makeStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, "targets");
    expect(store.get(practiceBarLensLabelAtom)).toBe("Chord Tones");
  });

  it("returns correct labels for every active lens", () => {
    const store = makeStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");

    const expected: Record<string, string> = {
      targets: "Chord Tones",
      "guide-tones": "Guide Tones",
      tension: "Tension",
    };
    for (const [lens, label] of Object.entries(expected)) {
      store.set(practiceLensAtom, lens as PracticeLens);
      expect(store.get(practiceBarLensLabelAtom)).toBe(label);
    }
  });
});

describe("showChordPracticeBarAtom — scale visibility independence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the dock when scale visibility is off (targets lens)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, "targets");
    store.set(scaleVisibleAtom, false);
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
  });

  it("shows the dock when scale visibility is off (targets with outside tones)", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C#");
    store.set(chordTypeAtom, "Minor Triad");
    store.set(practiceLensAtom, "targets");
    store.set(scaleVisibleAtom, false);
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
  });

  it("dock visibility does not change when toggling scaleVisibleAtom", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Dominant 7th");
    store.set(practiceLensAtom, "targets");

    store.set(scaleVisibleAtom, true);
    const visibleOn = store.get(showChordPracticeBarAtom);

    store.set(scaleVisibleAtom, false);
    const visibleOff = store.get(showChordPracticeBarAtom);

    expect(visibleOn).toBe(visibleOff);
  });
});

import {
  colorNotesAtom,
  effectiveColorNotesAtom,
  effectiveShapeDataAtom,
  toggleScaleVisibleAtom,
} from "../store/atoms";

describe("chord overlay does not control scale visibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enabling chord overlay does not change effectiveShapeDataAtom highlightNotes count", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(scaleVisibleAtom, true);

    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;

    store.set(chordTypeAtom, "Major Triad");

    const after = store.get(effectiveShapeDataAtom).highlightNotes.length;

    expect(after).toBe(before);
  });

  it("disabling chord overlay does not change scale highlight notes", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(scaleVisibleAtom, true);
    store.set(chordTypeAtom, "Major Triad");

    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;

    store.set(chordTypeAtom, null);

    const after = store.get(effectiveShapeDataAtom).highlightNotes.length;

    expect(after).toBe(before);
  });
});

describe("Chord Tones lens does not hide scale notes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("effectiveShapeDataAtom highlightNotes unchanged when switching between lenses", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(scaleVisibleAtom, true);
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, "targets");

    const before = store.get(effectiveShapeDataAtom).highlightNotes.length;

    store.set(practiceLensAtom, "guide-tones");

    const after = store.get(effectiveShapeDataAtom).highlightNotes.length;

    expect(after).toBe(before);
  });
});

describe("color notes are scale-owned — independent of chord overlay", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("colorNotesAtom returns color notes for Minor Blues scale without chord overlay", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Minor Blues");
    expect(store.get(colorNotesAtom).length).toBeGreaterThan(0);
  });

  it("colorNotesAtom is unaffected by chord type changes", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Minor Blues");

    const before = store.get(colorNotesAtom);

    store.set(chordTypeAtom, "Dominant 7th");
    const after = store.get(colorNotesAtom);

    expect(after).toEqual(before);
  });

  it("effectiveColorNotesAtom is cleared by scaleVisible=false, not by chord overlay", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Minor Blues");
    store.set(chordTypeAtom, "Dominant 7th");
    store.set(scaleVisibleAtom, true);

    expect(store.get(effectiveColorNotesAtom).length).toBeGreaterThan(0);

    store.set(toggleScaleVisibleAtom);

    expect(store.get(effectiveColorNotesAtom)).toHaveLength(0);
  });
});
