import { describe, expect, it } from "vitest";
import { chordQualityToTonal, tonalToChordQuality, scaleNameToTonal, tonalToScaleName } from "./tonal";

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
