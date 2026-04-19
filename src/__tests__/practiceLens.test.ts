// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import type { PracticeLens } from "../theory";
import { k } from "../utils/storage";
import {
  practiceLensAtom,
  practiceCuesAtom,
  shapeLocalPracticeCuesAtom,
  hideNonChordNotesAtom,
  showChordPracticeBarAtom,
  noteSemanticMapAtom,
  rootNoteAtom,
  scaleNameAtom,
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

  it("defaults to targets-color", () => {
    const store = makeStore();
    expect(store.get(practiceLensAtom)).toBe("targets-color");
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

  it("migrates old viewMode=compare to targets-color lens", () => {
    localStorage.setItem(k("viewMode"), "compare");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets-color");
    unsub();
  });

  it("ignores invalid stored value and falls back to default", () => {
    localStorage.setItem(k("practiceLens"), "invalid-lens");
    const store = makeStore();
    const unsub = store.sub(practiceLensAtom, () => {});
    expect(store.get(practiceLensAtom)).toBe("targets-color");
    unsub();
  });
});

describe("hideNonChordNotesAtom", () => {
  it("is true when lens is targets", () => {
    const store = makeStore();
    store.set(practiceLensAtom, "targets");
    expect(store.get(hideNonChordNotesAtom)).toBe(true);
  });

  it("is false for all other lenses", () => {
    const store = makeStore();
    for (const lens of ["guide-tones", "color", "targets-color", "tension"] as const) {
      store.set(practiceLensAtom, lens);
      expect(store.get(hideNonChordNotesAtom)).toBe(false);
    }
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
    it("returns guide tones cue for a seventh chord (3rd + 7th)", () => {
      const store = makeChordStore("Major", "G", "Dominant 7th", "guide-tones");
      const cues = store.get(practiceCuesAtom);
      expect(cues.length).toBe(1);
      expect(cues[0]!.kind).toBe("guide-tones");
      expect(cues[0]!.label).toBe("Guide tones");
      // G7 = G B D F; guide tones = B (3) and F (b7)
      const noteNames = cues[0]!.notes.map((n) => n.internalNote);
      expect(noteNames).toContain("B");
      expect(noteNames).toContain("F");
    });

    it("guide tones for a triad returns the 3rd", () => {
      const store = makeChordStore("Major", "C", "Major Triad", "guide-tones");
      const cues = store.get(practiceCuesAtom);
      expect(cues[0]!.kind).toBe("guide-tones");
      const noteNames = cues[0]!.notes.map((n) => n.internalNote);
      expect(noteNames).toContain("E"); // major 3rd
    });

    it("falls back to land-on for power chord (no 3rd/7th)", () => {
      const store = makeChordStore("Major", "G", "Power Chord (5)", "guide-tones");
      const cues = store.get(practiceCuesAtom);
      expect(cues[0]!.kind).toBe("land-on");
    });

    it("guide tone notes have role=guide-tone", () => {
      const store = makeChordStore("Major", "G", "Dominant 7th", "guide-tones");
      const cues = store.get(practiceCuesAtom);
      expect(cues[0]!.notes.every((n) => n.role === "guide-tone")).toBe(true);
    });
  });

  describe("color lens", () => {
    it("returns a color-note cue for a modal scale with divergent notes", () => {
      // D Dorian has B♮ as its color note (diverges from D Natural Minor)
      const store = makeChordStore("Dorian", "D", "Minor 7th", "color");
      const cues = store.get(practiceCuesAtom);
      expect(cues.some((c) => c.kind === "color-note")).toBe(true);
    });

    it("returns empty cues when scale has no color tones", () => {
      // C Major has no divergent notes (reference scale)
      const store = makeChordStore("Major", "C", "Major Triad", "color");
      const cues = store.get(practiceCuesAtom);
      expect(cues.length).toBe(0);
    });

    it("color notes already in chord tones are filtered out", () => {
      // G Mixolydian: color note is F (the b7). G7 chord includes F.
      // F should be filtered from color cue (covered by land-on in targets-color).
      const store = makeChordStore("Mixolydian", "G", "Dominant 7th", "color");
      const cues = store.get(practiceCuesAtom);
      // Color lens: if F is in chord tones, it's filtered → no color cue at all
      const colorCues = cues.filter((c) => c.kind === "color-note");
      if (colorCues.length > 0) {
        const colorNotes = colorCues[0]!.notes.map((n) => n.internalNote);
        expect(colorNotes).not.toContain("F");
      }
    });
  });

  describe("targets-color lens (default)", () => {
    it("returns land-on + color-note cues for Dorian + Dm7", () => {
      const store = makeChordStore("Dorian", "D", "Minor 7th", "targets-color");
      const cues = store.get(practiceCuesAtom);
      const kinds = cues.map((c) => c.kind);
      expect(kinds).toContain("land-on");
      expect(kinds).toContain("color-note");
    });

    it("returns only land-on when scale has no color tones (C Major + C Major Triad)", () => {
      const store = makeChordStore("Major", "C", "Major Triad", "targets-color");
      const cues = store.get(practiceCuesAtom);
      const kinds = cues.map((c) => c.kind);
      expect(kinds).toContain("land-on");
      expect(kinds).not.toContain("color-note");
    });

    it("does not duplicate notes already in land-on as color notes", () => {
      // G Mixolydian + G7: F is in both chord and scale divergence
      const store = makeChordStore("Mixolydian", "G", "Dominant 7th", "targets-color");
      const cues = store.get(practiceCuesAtom);
      const colorCues = cues.filter((c) => c.kind === "color-note");
      if (colorCues.length > 0) {
        const landOnNotes = cues
          .filter((c) => c.kind === "land-on")
          .flatMap((c) => c.notes.map((n) => n.internalNote));
        const colorNotes = colorCues[0]!.notes.map((n) => n.internalNote);
        for (const note of colorNotes) {
          expect(landOnNotes).not.toContain(note);
        }
      }
    });
  });

  describe("tension lens", () => {
    it("returns land-on + tension cues when chord has outside-scale tones", () => {
      // C Major + C# Minor Triad: C#, E, G# — C# and G# are outside C Major
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
      // The chord root (C#) is outside C Major — must appear in tension cue
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
      expect(tensionNotes).toContain("C#"); // chord root, outside scale
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
      // At least one tension note should have a resolution target
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
    // B = major 3rd of G7
    const bSemantics = semanticMap.get("B");
    expect(bSemantics?.isGuideTone).toBe(true);
    // F = b7 of G7
    const fSemantics = semanticMap.get("F");
    expect(fSemantics?.isGuideTone).toBe(true);
    // D = 5th, not a guide tone
    const dSemantics = semanticMap.get("D");
    expect(dSemantics?.isGuideTone).toBe(false);
  });

  it("a note can be both color tone and chord tone", () => {
    // G Mixolydian: F is the b7 color note AND a chord tone of G7
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

  it("returns true for non-default lenses even in diatonic simple case", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    // Diatonic simple case but lens is not targets-color
    store.set(practiceLensAtom, "targets");
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
  });

  it("returns false for targets-color lens in diatonic simple case", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(practiceLensAtom, "targets-color");
    // C Major + C Major Triad with all preset — diatonic simple case
    expect(store.get(showChordPracticeBarAtom)).toBe(false);
  });

  it("returns true for targets-color when there are outside chord members", () => {
    const store = makeStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Dominant 7th"); // Bb is outside C Major
    store.set(practiceLensAtom, "targets-color");
    expect(store.get(showChordPracticeBarAtom)).toBe(true);
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
