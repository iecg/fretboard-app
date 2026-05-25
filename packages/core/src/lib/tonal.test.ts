import { describe, expect, it } from "vitest";
import {
  normalizeToSharps,
  getScaleSemitonesFromTonal,
  getChordSemitonesFromTonal,
  getModeTriads,
  getChordDisplayLabel,
  getScaleDisplayLabel,
} from "./tonal";

describe("normalizeToSharps", () => {
  it("converts Bb to A#", () => {
    expect(normalizeToSharps("Bb")).toBe("A#");
  });
  it("converts Eb to D#", () => {
    expect(normalizeToSharps("Eb")).toBe("D#");
  });
  it("converts Db to C#", () => {
    expect(normalizeToSharps("Db")).toBe("C#");
  });
  it("converts Ab to G#", () => {
    expect(normalizeToSharps("Ab")).toBe("G#");
  });
  it("converts Gb to F#", () => {
    expect(normalizeToSharps("Gb")).toBe("F#");
  });
  it("leaves natural notes unchanged", () => {
    expect(normalizeToSharps("C")).toBe("C");
    expect(normalizeToSharps("F")).toBe("F");
  });
  it("leaves sharps unchanged", () => {
    expect(normalizeToSharps("C#")).toBe("C#");
    expect(normalizeToSharps("F#")).toBe("F#");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeToSharps("")).toBe("");
  });
  it("returns garbage input unchanged", () => {
    expect(normalizeToSharps("garbage")).toBe("garbage");
  });
});

describe("getScaleSemitonesFromTonal", () => {
  it("returns Major scale semitones", () => {
    expect(getScaleSemitonesFromTonal("major")).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it("returns Natural Minor semitones", () => {
    expect(getScaleSemitonesFromTonal("minor")).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });
  it("returns Minor Pentatonic semitones", () => {
    expect(getScaleSemitonesFromTonal("minor pentatonic")).toEqual([0, 3, 5, 7, 10]);
  });
  it("returns Lydian Dominant semitones", () => {
    expect(getScaleSemitonesFromTonal("lydian dominant")).toEqual([0, 2, 4, 6, 7, 9, 10]);
  });
  it("returns empty array for unknown scale", () => {
    expect(getScaleSemitonesFromTonal("Bogus Scale")).toEqual([]);
  });
});

describe("getChordSemitonesFromTonal", () => {
  it("returns Major Triad semitones (root, 3, 5)", () => {
    expect(getChordSemitonesFromTonal("M")).toEqual([0, 4, 7]);
  });
  it("returns Minor 7th semitones (root, b3, 5, b7)", () => {
    expect(getChordSemitonesFromTonal("m7")).toEqual([0, 3, 7, 10]);
  });
  it("returns Diminished 7th semitones (root, b3, b5, bb7)", () => {
    expect(getChordSemitonesFromTonal("dim7")).toEqual([0, 3, 6, 9]);
  });
  it("returns Power Chord semitones (root, 5)", () => {
    expect(getChordSemitonesFromTonal("5")).toEqual([0, 7]);
  });
  it("returns Sus2 semitones (root, 2, 5)", () => {
    expect(getChordSemitonesFromTonal("sus2")).toEqual([0, 2, 7]);
  });
  it("returns empty array for unknown symbol", () => {
    expect(getChordSemitonesFromTonal("ZZZ")).toEqual([]);
  });
});

describe("getModeTriads", () => {
  it("returns Major mode triads", () => {
    expect(getModeTriads("major")).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
  });
  it("returns Natural Minor triads", () => {
    expect(getModeTriads("minor")).toEqual(["i", "ii°", "III", "iv", "v", "VI", "VII"]);
  });
  it("returns Dorian triads", () => {
    expect(getModeTriads("dorian")).toEqual(["i", "ii", "III", "IV", "v", "vi°", "VII"]);
  });
  it("returns null for Pentatonic", () => {
    expect(getModeTriads("major pentatonic")).toBeNull();
  });
  it("returns null for Harmonic Minor", () => {
    expect(getModeTriads("harmonic minor")).toBeNull();
  });
  it("returns null for unknown scale", () => {
    expect(getModeTriads("Bogus")).toBeNull();
  });
});

describe("getChordDisplayLabel", () => {
  it("major triad", () => {
    expect(getChordDisplayLabel("M")).toBe("major");
  });
  it("minor seventh", () => {
    expect(getChordDisplayLabel("m7")).toBe("minor seventh");
  });
  it("dominant seventh", () => {
    expect(getChordDisplayLabel("7")).toBe("dominant seventh");
  });
  it("diminished seventh", () => {
    expect(getChordDisplayLabel("dim7")).toBe("diminished seventh");
  });
  it("half-diminished", () => {
    expect(getChordDisplayLabel("m7b5")).toBe("half-diminished");
  });
  it("power chord", () => {
    // Tonal returns "fifth" for the "5" suffix (not "power").
    expect(getChordDisplayLabel("5")).toBe("fifth");
  });
  it("falls back to input on unknown symbol", () => {
    expect(getChordDisplayLabel("ZZZ")).toBe("ZZZ");
  });
  it("falls back to input when Tonal name reduces to empty after stripping tonic", () => {
    // Chord.get("Cadd9").name returns "C " (tonic with trailing space).
    // After ^C\s* strip + trim, the result is "" — guarded by `|| chordSymbol`.
    expect(getChordDisplayLabel("add9")).toBe("add9");
  });
  it("empty string passes through (does not resolve to major triad)", () => {
    expect(getChordDisplayLabel("")).toBe("");
  });
});

describe("getScaleDisplayLabel", () => {
  it("major", () => {
    expect(getScaleDisplayLabel("major")).toBe("major");
  });
  it("phrygian dominant", () => {
    expect(getScaleDisplayLabel("phrygian dominant")).toBe("phrygian dominant");
  });
  it("ultralocrian", () => {
    expect(getScaleDisplayLabel("ultralocrian")).toBe("ultralocrian");
  });
  it("falls back to input on unknown scale", () => {
    expect(getScaleDisplayLabel("bogus scale")).toBe("bogus scale");
  });
  it("empty string passes through", () => {
    expect(getScaleDisplayLabel("")).toBe("");
  });
});
