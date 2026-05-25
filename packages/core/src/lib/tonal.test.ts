import { describe, expect, it } from "vitest";
import {
  chordQualityToTonal,
  tonalToChordQuality,
  scaleNameToTonal,
  tonalToScaleName,
  normalizeToSharps,
  getScaleSemitonesFromTonal,
} from "./tonal";

describe("chord-name adapter", () => {
  it("maps Major Triad to M", () => {
    expect(chordQualityToTonal("Major Triad")).toBe("M");
  });
  it("maps Minor Triad to m", () => {
    expect(chordQualityToTonal("Minor Triad")).toBe("m");
  });
  it("maps Dominant 7th to 7", () => {
    expect(chordQualityToTonal("Dominant 7th")).toBe("7");
  });
  it("maps Diminished 7th to dim7", () => {
    expect(chordQualityToTonal("Diminished 7th")).toBe("dim7");
  });
  it("maps Half-Diminished 7th to m7b5", () => {
    expect(chordQualityToTonal("Half-Diminished 7th")).toBe("m7b5");
  });
  it("maps Power Chord (5) to 5", () => {
    expect(chordQualityToTonal("Power Chord (5)")).toBe("5");
  });
  it("returns undefined for unknown quality", () => {
    expect(chordQualityToTonal("Bogus Chord")).toBeUndefined();
  });
  it("round-trips Major Triad", () => {
    expect(tonalToChordQuality("M")).toBe("Major Triad");
  });
  it("round-trips Minor 7th", () => {
    expect(tonalToChordQuality("m7")).toBe("Minor 7th");
  });
});

describe("scale-name adapter", () => {
  it("maps Major to major", () => {
    expect(scaleNameToTonal("Major")).toBe("major");
  });
  it("maps Natural Minor to minor", () => {
    expect(scaleNameToTonal("Natural Minor")).toBe("minor");
  });
  it("maps Harmonic Minor to harmonic minor", () => {
    expect(scaleNameToTonal("Harmonic Minor")).toBe("harmonic minor");
  });
  it("maps Major Pentatonic to major pentatonic", () => {
    expect(scaleNameToTonal("Major Pentatonic")).toBe("major pentatonic");
  });
  it("maps Dorian to dorian", () => {
    expect(scaleNameToTonal("Dorian")).toBe("dorian");
  });
  it("round-trips Major", () => {
    expect(tonalToScaleName("major")).toBe("Major");
  });
});

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
    expect(getScaleSemitonesFromTonal("Major")).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it("returns Natural Minor semitones", () => {
    expect(getScaleSemitonesFromTonal("Natural Minor")).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });
  it("returns Minor Pentatonic semitones", () => {
    expect(getScaleSemitonesFromTonal("Minor Pentatonic")).toEqual([0, 3, 5, 7, 10]);
  });
  it("returns Lydian Dominant semitones", () => {
    expect(getScaleSemitonesFromTonal("Lydian Dominant")).toEqual([0, 2, 4, 6, 7, 9, 10]);
  });
  it("returns empty array for unknown scale", () => {
    expect(getScaleSemitonesFromTonal("Bogus Scale")).toEqual([]);
  });
});
