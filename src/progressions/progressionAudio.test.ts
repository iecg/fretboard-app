import { describe, expect, it } from "vitest";
import { resolveBassLineNotes, resolveChordVoicing, resolveBassNoteForRole } from "./progressionAudio";

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
    expect(resolveBassNoteForRole("C", "M", "fifth")).toBe("G2");
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
});
