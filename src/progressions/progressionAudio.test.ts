import { describe, expect, it } from "vitest";
import { resolveBassLineNotes, resolveChordVoicing, resolveBassNoteForRole, extendFunkVoicing } from "./progressionAudio";

describe("resolveChordVoicing", () => {
  it("stacks the C Major Triad as C-E-G at octave 3", () => {
    expect(resolveChordVoicing("C", "M")).toEqual(["C3", "E3", "G3"]);
  });

  it("stacks the A Minor Triad as A-C-E with octave carry", () => {
    // Root A is at chromatic index 9 in octave 3 → absolute 45. The minor
    // third (+3 semitones) wraps to C and bumps the octave to 4.
    expect(resolveChordVoicing("A", "m")).toEqual(["A3", "C4", "E4"]);
  });

  it("stacks the G Dominant 7th as G-B-D-F", () => {
    expect(resolveChordVoicing("G", "7")).toEqual([
      "G3",
      "B3",
      "D4",
      "F4",
    ]);
  });

  it("honours a custom root octave", () => {
    expect(resolveChordVoicing("C", "M", 4)).toEqual([
      "C4",
      "E4",
      "G4",
    ]);
  });

  it("returns an empty voicing for unknown qualities", () => {
    expect(resolveChordVoicing("C", "Made Up Quality")).toEqual([]);
  });

  it("returns an empty voicing for unknown roots", () => {
    expect(resolveChordVoicing("H", "M")).toEqual([]);
  });

  it("handles sharp roots and wraps the chromatic scale correctly", () => {
    // F# Major: F# A# C# — the perfect fifth from F# is C# (octave above).
    expect(resolveChordVoicing("F#", "M")).toEqual([
      "F#3",
      "A#3",
      "C#4",
    ]);
  });

  it("returns 4 notes for seventh chords", () => {
    expect(resolveChordVoicing("D", "m7")).toHaveLength(4);
  });
});

describe("resolveBassLineNotes", () => {
  it("uses the chord root and perfect fifth in the bass octave", () => {
    expect(resolveBassLineNotes("C", "M")).toEqual(["C2", "G2"]);
  });

  it("uses the altered fifth for diminished chords", () => {
    expect(resolveBassLineNotes("B", "dim")).toEqual(["B2", "F3"]);
  });
});

describe("resolveBassNoteForRole", () => {
  it("resolves root", () => {
    expect(resolveBassNoteForRole("C", "M", "root")).toBe("C2");
  });
  it("resolves third", () => {
    expect(resolveBassNoteForRole("C", "M", "third")).toBe("E2");
  });
  it("resolves fifth", () => {
    expect(resolveBassNoteForRole("C", "M", "fifth")).toBe("G1");
  });
  it("resolves octave", () => {
    expect(resolveBassNoteForRole("C", "M", "octave")).toBe("C3");
  });
  it("resolves chromatic-approach to semitone below next root", () => {
    expect(resolveBassNoteForRole("C", "M", "chromatic-approach", "F")).toBe("E2");
  });
  it("falls back to semitone below current root when no next root", () => {
    expect(resolveBassNoteForRole("C", "M", "chromatic-approach")).toBe("B1");
  });
  it("falls back to root when third/fifth unavailable", () => {
    expect(resolveBassNoteForRole("C", "5", "third")).toBe("C2");
  });
  it("resolves a flat-seventh on a major triad via the root+10 fallback", () => {
    // C major has no 7th chord member, so b7 = root + 10 semitones = A# (Bb).
    const note = resolveBassNoteForRole("C", "M", "flat-seventh");
    expect(note.replace(/[0-9]/g, "")).toBe("A#");
  });
  it("prefers the chord's own 7th member when present", () => {
    // Cmaj7's "7" member is +11 semitones = B (distinct from the +10 fallback).
    const note = resolveBassNoteForRole("C", "maj7", "flat-seventh");
    expect(note.replace(/[0-9]/g, "")).toBe("B");
  });
  it("resolves a flat-seventh on a dominant 7 chord from its b7 member", () => {
    // C7's "b7" member is +10 semitones = A#.
    const note = resolveBassNoteForRole("C", "7", "flat-seventh");
    expect(note.replace(/[0-9]/g, "")).toBe("A#");
  });
});

describe("extendFunkVoicing", () => {
  it("turns a major triad into a dominant-9 (adds b7 + 9)", () => {
    // C major C3 E3 G3  ->  + A#3 (b7) + D4 (9)
    expect(extendFunkVoicing(["C3", "E3", "G3"], "C", "M")).toEqual([
      "C3", "E3", "G3", "A#3", "D4",
    ]);
  });

  it("turns a minor triad into m9 (adds b7 + 9)", () => {
    // A minor A3 C4 E4  ->  + G4 (b7) + B4 (9)
    expect(extendFunkVoicing(["A3", "C4", "E4"], "A", "m")).toEqual([
      "A3", "C4", "E4", "G4", "B4",
    ]);
  });

  it("adds only the 9 to a m7 (b7 already present) -> m9", () => {
    const out = extendFunkVoicing(["D3", "F3", "A3", "C4"], "D", "m7");
    expect(out).toEqual(["D3", "F3", "A3", "C4", "E4"]);
  });

  it("adds 9 and 13 to a dominant 7", () => {
    // G7 G3 B3 D4 F4  ->  + A4 (9) + E5 (13)
    expect(extendFunkVoicing(["G3", "B3", "D4", "F4"], "G", "7")).toEqual([
      "G3", "B3", "D4", "F4", "A4", "E5",
    ]);
  });

  it("adds 9 to a maj7 but never a b7 (stays major) -> maj9", () => {
    const out = extendFunkVoicing(["C3", "E3", "G3", "B3"], "C", "maj7");
    expect(out).toEqual(["C3", "E3", "G3", "B3", "D4"]);
    expect(out).not.toContain("A#3"); // no dominant b7
  });

  it("leaves dim / aug / sus / 6 untouched (avoid clashes)", () => {
    for (const q of ["dim", "aug", "m7b5", "sus2", "sus4", "6", "m6", "5"]) {
      const base = ["C3", "E3", "G3"];
      expect(extendFunkVoicing(base, "C", q), q).toEqual(base);
    }
  });

  it("does not re-add a tone already in the voicing", () => {
    // Voicing already contains D4 (the 9); must not duplicate it.
    const out = extendFunkVoicing(["C3", "E3", "G3", "D4"], "C", "maj7");
    expect(out.filter((n) => n === "D4")).toHaveLength(1);
  });

  it("does not mutate its input array", () => {
    const input = ["C3", "E3", "G3"];
    extendFunkVoicing(input, "C", "M");
    expect(input).toEqual(["C3", "E3", "G3"]);
  });

  it("returns the voicing unchanged for an unknown root or empty voicing", () => {
    expect(extendFunkVoicing([], "C", "M")).toEqual([]);
    expect(extendFunkVoicing(["C3"], "H", "M")).toEqual(["C3"]);
  });
});
