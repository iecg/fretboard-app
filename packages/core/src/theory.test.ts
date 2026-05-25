import { describe, it, expect } from "vitest";
import {
  SCALES,
  CHORDS,
  CHORD_DEFINITIONS,
  getScaleNotes,
  getScaleSemitones,
  getChordNotes,
  getNoteIndex,
  getNoteDisplay,
  getIntervalNotes,
  getDivergentNotes,
  getKeySignature,
  getKeySignatureForDisplay,
  resolveAccidentalMode,
  getDiatonicChord,
} from "./theory";

describe("getNoteIndex", () => {
  it("returns correct index for sharp notes", () => {
    expect(getNoteIndex("C")).toBe(0);
    expect(getNoteIndex("E")).toBe(4);
    expect(getNoteIndex("B")).toBe(11);
  });

  it("handles flat enharmonics", () => {
    expect(getNoteIndex("Db")).toBe(getNoteIndex("C#"));
    expect(getNoteIndex("Bb")).toBe(getNoteIndex("A#"));
  });
});

describe("getNoteDisplay", () => {
  it("shows sharps for sharp keys", () => {
    expect(getNoteDisplay("C#", "G")).toBe("C#");
    expect(getNoteDisplay("F#", "D")).toBe("F#");
  });

  it("shows flats for flat keys", () => {
    expect(getNoteDisplay("C#", "F")).toBe("Db");
    expect(getNoteDisplay("A#", "Bb")).toBe("Bb");
  });
});

describe("getIntervalNotes", () => {
  it("computes notes from intervals", () => {
    expect(getIntervalNotes("C", [0, 4, 7])).toEqual(["C", "E", "G"]);
  });

  it("wraps around octave", () => {
    expect(getIntervalNotes("A", [0, 4, 7])).toEqual(["A", "C#", "E"]);
  });
});

describe("getScaleNotes", () => {
  it("returns C Major notes", () => {
    expect(getScaleNotes("C", "Major")).toEqual([
      "C",
      "D",
      "E",
      "F",
      "G",
      "A",
      "B",
    ]);
  });

  it("returns A Minor Pentatonic notes", () => {
    expect(getScaleNotes("A", "Minor Pentatonic")).toEqual([
      "A",
      "C",
      "D",
      "E",
      "G",
    ]);
  });

  it("returns empty for unknown scale", () => {
    expect(getScaleNotes("C", "NonExistent")).toEqual([]);
  });

  it("returns empty array for invalid root note", () => {
    expect(getScaleNotes("X", "Major")).toEqual([]);
  });

  it("returns empty array for invalid scale name", () => {
    expect(getScaleNotes("C", "NonexistentScale")).toEqual([]);
  });

  it("returns A Melodic Minor notes", () => {
    expect(getScaleNotes("A", "Melodic Minor")).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F#",
      "G#",
    ]);
  });
});

describe("getScaleSemitones", () => {
  it("returns chromatic semitone offsets for C Major", () => {
    // C=0, D=2, E=4, F=5, G=7, A=9, B=11
    expect(getScaleSemitones("C", "Major")).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("returns chromatic semitone offsets for A Minor Pentatonic", () => {
    // A=9, C=0, D=2, E=4, G=7
    expect(getScaleSemitones("A", "Minor Pentatonic")).toEqual([9, 0, 2, 4, 7]);
  });

  it("returns empty array for unknown scale", () => {
    expect(getScaleSemitones("C", "NonExistent")).toEqual([]);
  });

  it("matches getScaleNotes ordering (root first)", () => {
    const notes = getScaleNotes("D", "Major");
    const semis = getScaleSemitones("D", "Major");
    expect(semis).toHaveLength(notes.length);
    // First entry is the root
    expect(semis[0]).toBe(2); // D = index 2 in NOTES
  });
});

describe("getChordNotes", () => {
  it("returns C Major Triad", () => {
    expect(getChordNotes("C", "Major Triad")).toEqual(["C", "E", "G"]);
  });

  it("returns A Minor 7th", () => {
    expect(getChordNotes("A", "Minor 7th")).toEqual(["A", "C", "E", "G"]);
  });

  it("returns C Major 6th", () => {
    expect(getChordNotes("C", "Major 6th")).toEqual(["C", "E", "G", "A"]);
  });

  it("returns D Sus4", () => {
    expect(getChordNotes("D", "Sus4")).toEqual(["D", "G", "A"]);
  });

  it("returns empty array for invalid root note", () => {
    expect(getChordNotes("X", "Major Triad")).toEqual([]);
  });

  it("returns empty array for invalid chord name", () => {
    expect(getChordNotes("C", "NonexistentChord")).toEqual([]);
  });
});

describe("getDivergentNotes", () => {
  it("returns empty for Major scale (reference itself)", () => {
    expect(getDivergentNotes("C", "Major")).toEqual([]);
  });

  it("returns empty for Natural Minor (reference itself)", () => {
    expect(getDivergentNotes("A", "Natural Minor")).toEqual([]);
  });

  it("returns raised 6th for Dorian (vs Natural Minor)", () => {
    // Dorian has interval 9 (major 6th), Natural Minor has 8 (minor 6th)
    const divergent = getDivergentNotes("D", "Dorian");
    expect(divergent).toEqual(["B"]); // B is the raised 6th in D Dorian
  });

  it("returns raised 4th for Lydian (vs Major)", () => {
    const divergent = getDivergentNotes("F", "Lydian");
    expect(divergent).toEqual(["B"]); // B is the raised 4th in F Lydian
  });

  it("returns lowered 7th for Mixolydian (vs Major)", () => {
    const divergent = getDivergentNotes("G", "Mixolydian");
    expect(divergent).toEqual(["F"]); // F is the lowered 7th in G Mixolydian
  });

  it("returns empty for pentatonic scales", () => {
    expect(getDivergentNotes("C", "Minor Pentatonic")).toEqual([]);
    expect(getDivergentNotes("C", "Major Pentatonic")).toEqual([]);
  });

  it("returns empty for blues scales", () => {
    expect(getDivergentNotes("A", "Minor Blues")).toEqual([]);
  });

  it("returns raised 6th for Bb Dorian (vs Natural Minor) — flat root", () => {
    // Bb Dorian: Bb C Db Eb F G Ab; Bb Natural Minor: Bb C Db Eb F Gb Ab
    // Divergent semitone = G (chroma 7) → sharps-form "G"
    expect(getDivergentNotes("Bb", "Dorian")).toEqual(["G"]);
  });

  it("returns empty for invalid root", () => {
    expect(getDivergentNotes("Zz", "Dorian")).toEqual([]);
  });

  it("matches snapshot across all scales × {C, F#, Bb}", () => {
    const SCALES_TO_PROBE = [
      "Major",
      "Natural Minor",
      "Harmonic Minor",
      "Melodic Minor",
      "Major Pentatonic",
      "Minor Pentatonic",
      "Blues",
      "Ionian",
      "Dorian",
      "Phrygian",
      "Lydian",
      "Mixolydian",
      "Aeolian",
      "Locrian",
      "Locrian Natural 6",
      "Ionian Augmented",
      "Dorian Sharp 4",
      "Phrygian Dominant",
      "Lydian Sharp 2",
      "Altered Diminished",
      "Dorian Flat 2",
      "Lydian Augmented",
      "Lydian Dominant",
      "Mixolydian Flat 6",
      "Locrian Natural 2",
      "Altered",
      "Minor Blues",
      "Major Blues",
    ];
    const ROOTS = ["C", "F#", "Bb"];

    const snapshot: Record<string, string[]> = {};
    for (const root of ROOTS) {
      for (const scale of SCALES_TO_PROBE) {
        snapshot[`${root} ${scale}`] = getDivergentNotes(root, scale);
      }
    }
    expect(snapshot).toMatchSnapshot();
  });
});

describe("getKeySignature", () => {
  it("returns 0 for C", () => {
    expect(getKeySignature("C")).toBe(0);
  });

  it("returns positive for sharp keys", () => {
    expect(getKeySignature("G")).toBe(1);
    expect(getKeySignature("D")).toBe(2);
  });

  it("returns negative for flat keys", () => {
    expect(getKeySignature("F")).toBe(-1);
    expect(getKeySignature("Bb")).toBe(-2);
  });
});

describe("resolveAccidentalMode", () => {
  describe("explicit mode pass-through", () => {
    it("sharps → false regardless of root", () => {
      expect(resolveAccidentalMode("C#", "Major", "sharps")).toBe(false);
      expect(resolveAccidentalMode("Bb", "Major", "sharps")).toBe(false);
    });
    it("flats → true regardless of root", () => {
      expect(resolveAccidentalMode("C#", "Major", "flats")).toBe(true);
      expect(resolveAccidentalMode("C", "Major", "flats")).toBe(true);
    });
  });

  describe("natural root no-op (auto falls back to FLAT_KEYS)", () => {
    it("C Major → false", () => {
      expect(resolveAccidentalMode("C", "Major", "auto")).toBe(false);
    });
    it("F Major → true (F in FLAT_KEYS)", () => {
      expect(resolveAccidentalMode("F", "Major", "auto")).toBe(true);
    });
    it("A Natural Minor → false", () => {
      expect(resolveAccidentalMode("A", "Natural Minor", "auto")).toBe(false);
    });
  });

  describe("enharmonic roots — auto picks fewer accidentals", () => {
    it("A#/Bb Major → true (Bb wins)", () => {
      expect(resolveAccidentalMode("A#", "Major", "auto")).toBe(true);
      expect(resolveAccidentalMode("Bb", "Major", "auto")).toBe(true);
    });
    it("C#/Db Major → true (Db wins)", () => {
      expect(resolveAccidentalMode("C#", "Major", "auto")).toBe(true);
      expect(resolveAccidentalMode("Db", "Major", "auto")).toBe(true);
    });
    it("D#/Eb Major → true (Eb wins)", () => {
      expect(resolveAccidentalMode("D#", "Major", "auto")).toBe(true);
      expect(resolveAccidentalMode("Eb", "Major", "auto")).toBe(true);
    });
    it("G#/Ab Major → true (Ab wins)", () => {
      expect(resolveAccidentalMode("G#", "Major", "auto")).toBe(true);
      expect(resolveAccidentalMode("Ab", "Major", "auto")).toBe(true);
    });
    it("F#/Gb Major → false (tie breaks to sharps)", () => {
      expect(resolveAccidentalMode("F#", "Major", "auto")).toBe(false);
      expect(resolveAccidentalMode("Gb", "Major", "auto")).toBe(false);
    });
    it("A# Natural Minor in auto mode", () => {
      // A# Natural Minor vs Bb Natural Minor — Bb should win (fewer accidentals)
      expect(resolveAccidentalMode("A#", "Natural Minor", "auto")).toBe(true);
    });
  });
});

describe("getKeySignatureForDisplay (scale-aware)", () => {
  it("A Natural Minor → 0 (parent = C Major)", () => {
    expect(getKeySignatureForDisplay("A", "Natural Minor", false)).toBe(0);
  });
  it("E Dorian → 2 (parent = D Major)", () => {
    expect(getKeySignatureForDisplay("E", "Dorian", false)).toBe(2);
  });
  it("D Phrygian → -2 (parent = Bb Major; useFlats=false still resolves to the Bb enharmonic key sig)", () => {
    expect(getKeySignatureForDisplay("D", "Phrygian", false)).toBe(-2);
  });
  it("Bb Lydian → -1 (parent = F Major, useFlats=true)", () => {
    expect(getKeySignatureForDisplay("Bb", "Lydian", true)).toBe(-1);
  });
  it("G Mixolydian → 0 (parent = C Major)", () => {
    expect(getKeySignatureForDisplay("G", "Mixolydian", false)).toBe(0);
  });
  it("B Locrian → 0 (parent = C Major)", () => {
    expect(getKeySignatureForDisplay("B", "Locrian", false)).toBe(0);
  });
  it("C Major → 0 (sanity regression)", () => {
    expect(getKeySignatureForDisplay("C", "Major", false)).toBe(0);
  });
  it("A Minor Pentatonic → 0 (parent = C Major)", () => {
    expect(getKeySignatureForDisplay("A", "Minor Pentatonic", false)).toBe(0);
  });
  it("A Harmonic Minor → 0 (Natural Minor parent)", () => {
    expect(getKeySignatureForDisplay("A", "Harmonic Minor", false)).toBe(0);
  });
  it("A Melodic Minor → 0 (Natural Minor parent)", () => {
    expect(getKeySignatureForDisplay("A", "Melodic Minor", false)).toBe(0);
  });
  it("E Phrygian Dominant → 0 (parent = C Major)", () => {
    expect(getKeySignatureForDisplay("E", "Phrygian Dominant", false)).toBe(0);
  });
  it("F# Locrian Natural 2 → 0 (parent = C Major)", () => {
    expect(getKeySignatureForDisplay("F#", "Locrian Natural 2", false)).toBe(0);
  });
});

describe("getKeySignatureForDisplay — sharp root preservation", () => {
  it("G# Major with useFlats=true returns enharmonic sharp count (8)", () => {
    expect(getKeySignatureForDisplay("G#", "Major", true)).toBe(8);
  });
  it("Ab Major with useFlats=true returns flat-side sig", () => {
    expect(getKeySignatureForDisplay("Ab", "Major", true)).toBe(-4);
  });
  it("D# Major with useFlats=true returns enharmonic sharp count (9)", () => {
    expect(getKeySignatureForDisplay("D#", "Major", true)).toBe(9);
  });
  it("Eb Major with useFlats=true returns flat-side sig", () => {
    expect(getKeySignatureForDisplay("Eb", "Major", true)).toBe(-3);
  });
  it("C# Major with useFlats=false returns sharp sig (7)", () => {
    expect(getKeySignatureForDisplay("C#", "Major", false)).toBe(7);
  });
  it("G# Major with useFlats=false returns 8 (8 sharps)", () => {
    expect(getKeySignatureForDisplay("G#", "Major", false)).toBe(8);
  });
  it("Ab Major with useFlats=false returns -4 (4 flats)", () => {
    expect(getKeySignatureForDisplay("Ab", "Major", false)).toBe(-4);
  });
  it("A# Major with useFlats=false returns 10 (10 sharps)", () => {
    expect(getKeySignatureForDisplay("A#", "Major", false)).toBe(10);
  });
  it("Bb Major with useFlats=true returns -2 (2 flats)", () => {
    expect(getKeySignatureForDisplay("Bb", "Major", true)).toBe(-2);
  });
});

describe("resolver + key signature integration", () => {
  it("A# Major auto → sharp-spelled root stays sharp → key sig = 10", () => {
    const useFlats = resolveAccidentalMode("A#", "Major", "auto");
    // A# is sharp-spelled so getKeySignatureForDisplay returns enharmonic sharp count
    expect(getKeySignatureForDisplay("A#", "Major", useFlats)).toBe(10);
  });
  it("A Natural Minor auto → sharps → key sig = 0", () => {
    const useFlats = resolveAccidentalMode("A", "Natural Minor", "auto");
    expect(useFlats).toBe(false);
    expect(getKeySignatureForDisplay("A", "Natural Minor", useFlats)).toBe(0);
  });
  it("E Dorian auto → sharps → key sig = 2", () => {
    const useFlats = resolveAccidentalMode("E", "Dorian", "auto");
    expect(useFlats).toBe(false);
    expect(getKeySignatureForDisplay("E", "Dorian", useFlats)).toBe(2);
  });
});

describe("CHORD_DEFINITIONS — new chord types", () => {
  it("CHORD_DEFINITIONS contains 15 entries (9 original + 6 new)", () => {
    expect(Object.keys(CHORD_DEFINITIONS).length).toBe(15);
  });

  it("original keys are still present", () => {
    expect("Major Triad" in CHORD_DEFINITIONS).toBe(true);
    expect("Power Chord (5)" in CHORD_DEFINITIONS).toBe(true);
  });

  it("Augmented Triad has intervals [0, 4, 8]", () => {
    expect(CHORD_DEFINITIONS["Augmented Triad"].members.map((m) => m.semitone)).toEqual([0, 4, 8]);
  });

  it("Sus2 has intervals [0, 2, 7]", () => {
    expect(CHORD_DEFINITIONS["Sus2"].members.map((m) => m.semitone)).toEqual([0, 2, 7]);
  });

  it("Minor 6th has intervals [0, 3, 7, 9]", () => {
    expect(CHORD_DEFINITIONS["Minor 6th"].members.map((m) => m.semitone)).toEqual([0, 3, 7, 9]);
  });

  it("Diminished 7th has intervals [0, 3, 6, 9]", () => {
    expect(CHORD_DEFINITIONS["Diminished 7th"].members.map((m) => m.semitone)).toEqual([0, 3, 6, 9]);
  });

  it("Half-Diminished 7th has intervals [0, 3, 6, 10]", () => {
    expect(CHORD_DEFINITIONS["Half-Diminished 7th"].members.map((m) => m.semitone)).toEqual([0, 3, 6, 10]);
  });

  it("Minor-Major 7th has intervals [0, 3, 7, 11]", () => {
    expect(CHORD_DEFINITIONS["Minor-Major 7th"].members.map((m) => m.semitone)).toEqual([0, 3, 7, 11]);
  });
});

describe("CHORD_DEFINITIONS", () => {
  it("every chord in CHORD_DEFINITIONS has a quality and members", () => {
    for (const [name, def] of Object.entries(CHORD_DEFINITIONS)) {
      expect(def.quality).toMatch(/^(triad|seventh|power|sixth|suspended)$/);
      expect(def.members.length).toBeGreaterThan(0);
      expect(def.members[0].name).toBe("root");
      void name;
    }
  });

  it("CHORDS derived from CHORD_DEFINITIONS preserves intervals", () => {
    expect(CHORDS["Major Triad"]).toEqual([0, 4, 7]);
    expect(CHORDS["Minor 7th"]).toEqual([0, 3, 7, 10]);
    expect(CHORDS["Power Chord (5)"]).toEqual([0, 7]);
    expect(CHORDS["Major 6th"]).toEqual([0, 4, 7, 9]);
    expect(CHORDS["Sus4"]).toEqual([0, 5, 7]);
  });

  it("Major Triad has triad quality with root, 3, 5 members", () => {
    const def = CHORD_DEFINITIONS["Major Triad"];
    expect(def.quality).toBe("triad");
    expect(def.members.map((m) => m.name)).toEqual(["root", "3", "5"]);
  });

  it("Minor 7th has seventh quality with root, b3, 5, b7 members", () => {
    const def = CHORD_DEFINITIONS["Minor 7th"];
    expect(def.quality).toBe("seventh");
    expect(def.members.map((m) => m.name)).toEqual(["root", "b3", "5", "b7"]);
  });

  it("Power Chord has power quality with root and 5 only", () => {
    const def = CHORD_DEFINITIONS["Power Chord (5)"];
    expect(def.quality).toBe("power");
    expect(def.members.map((m) => m.name)).toEqual(["root", "5"]);
  });

  it("Major 6th has sixth quality with root, 3, 5, 6 members", () => {
    const def = CHORD_DEFINITIONS["Major 6th"];
    expect(def.quality).toBe("sixth");
    expect(def.members.map((m) => m.name)).toEqual(["root", "3", "5", "6"]);
    expect(def.members.map((m) => m.semitone)).toEqual([0, 4, 7, 9]);
  });

  it("Sus4 has suspended quality with root, 4, 5 members", () => {
    const def = CHORD_DEFINITIONS["Sus4"];
    expect(def.quality).toBe("suspended");
    expect(def.members.map((m) => m.name)).toEqual(["root", "4", "5"]);
    expect(def.members.map((m) => m.semitone)).toEqual([0, 5, 7]);
  });
});


describe("SCALES constant", () => {
  it("has expected number of scales", () => {
    expect(Object.keys(SCALES).length).toBeGreaterThanOrEqual(12);
  });

  it("Major scale has 7 intervals starting from 0", () => {
    expect(SCALES["Major"]).toHaveLength(7);
    expect(SCALES["Major"][0]).toBe(0);
  });
});

describe("getDiatonicChord", () => {
  describe("Major scale", () => {
    it("I in C Major → { root: C, quality: Major Triad }", () => {
      expect(getDiatonicChord("I", "Major", "C")).toEqual({ root: "C", quality: "Major Triad" });
    });

    it("ii in C Major → { root: D, quality: Minor Triad }", () => {
      expect(getDiatonicChord("ii", "Major", "C")).toEqual({ root: "D", quality: "Minor Triad" });
    });

    it("vii° in C Major → { root: B, quality: Diminished Triad }", () => {
      expect(getDiatonicChord("vii°", "Major", "C")).toEqual({ root: "B", quality: "Diminished Triad" });
    });

    it("V in G Major → { root: D, quality: Major Triad } (non-C tonic)", () => {
      expect(getDiatonicChord("V", "Major", "G")).toEqual({ root: "D", quality: "Major Triad" });
    });
  });

  describe("Natural Minor scale", () => {
    it("i in A Natural Minor → { root: A, quality: Minor Triad }", () => {
      expect(getDiatonicChord("i", "Natural Minor", "A")).toEqual({ root: "A", quality: "Minor Triad" });
    });

    it("ii° in A Natural Minor → { root: B, quality: Diminished Triad }", () => {
      expect(getDiatonicChord("ii°", "Natural Minor", "A")).toEqual({ root: "B", quality: "Diminished Triad" });
    });
  });

  describe("Harmonic Minor — critical edge case", () => {
    it("V in A Harmonic Minor → { root: E, quality: Major Triad } (raised 7th makes dominant major)", () => {
      expect(getDiatonicChord("V", "Harmonic Minor", "A")).toEqual({ root: "E", quality: "Major Triad" });
    });
  });

  describe("Blues scales", () => {
    it("v in C Minor Blues resolves to G Minor Triad", () => {
      expect(getDiatonicChord("v", "Minor Blues", "C")).toEqual({ root: "G", quality: "Minor Triad" });
    });

    it("b5 in C Minor Blues is a color tone, not a chord degree", () => {
      expect(getDiatonicChord("b5", "Minor Blues", "C")).toBeUndefined();
    });

    it("V in C Major Blues resolves to G Major Triad", () => {
      expect(getDiatonicChord("V", "Major Blues", "C")).toEqual({ root: "G", quality: "Major Triad" });
    });

    it("b3 in C Major Blues is a color tone, not a chord degree", () => {
      expect(getDiatonicChord("b3", "Major Blues", "C")).toBeUndefined();
    });
  });

  describe("Unknown degree guard", () => {
    it("i is not a degree in Major scale — returns undefined", () => {
      expect(getDiatonicChord("i", "Major", "C#")).toBeUndefined();
    });
  });

  describe("Invalid inputs → undefined", () => {
    it("returns undefined for an unknown scale", () => {
      expect(getDiatonicChord("I", "Unknown Scale", "C")).toBeUndefined();
    });

    it("returns undefined for an invalid tonic note", () => {
      expect(getDiatonicChord("I", "Major", "X")).toBeUndefined();
    });
  });
});

describe("catalog snapshots (pre-Tonal-migration lock)", () => {
  it("SCALES snapshot — all 28 entries", () => {
    expect(SCALES).toMatchSnapshot();
  });

  it("CHORDS snapshot — all 15 entries", () => {
    expect(CHORDS).toMatchSnapshot();
  });

  it("CHORD_DEFINITIONS snapshot — full structure including member names", () => {
    expect(CHORD_DEFINITIONS).toMatchSnapshot();
  });
});
