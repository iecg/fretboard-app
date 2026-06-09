import { describe, it, expect } from "vitest";
import { encodeShareState, type ShareState } from "./shareCodec";

describe("encodeShareState", () => {
  it("encodes a basic major progression", () => {
    const state: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "vi", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "IV", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("C.major.120.4x4.I-V-vi-IV");
  });

  it("encodes quality overrides", () => {
    const state: ShareState = {
      root: "G",
      scale: "major",
      tempo: 90,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "ii", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("G.major.90.4x4.ii-V:7-I");
  });

  it("encodes non-default durations", () => {
    const state: ShareState = {
      root: "A",
      scale: "minor blues",
      tempo: 80,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: "7", duration: { value: 4, unit: "bar" } },
        { degree: "IV", qualityOverride: "7", duration: { value: 2, unit: "bar" } },
        { degree: "I", qualityOverride: "7", duration: { value: 2, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "IV", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "I", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("A.minor+blues.80.4x4.I:7*4b-IV:7*2b-I:7*2b-V:7-IV:7-I:7-V:7");
  });

  it("encodes beat durations", () => {
    const state: ShareState = {
      root: "D",
      scale: "dorian",
      tempo: 100,
      timeSignature: { numerator: 3, denominator: 4 },
      steps: [
        { degree: "i", qualityOverride: null, duration: { value: 2, unit: "beat" } },
        { degree: "IV", qualityOverride: null, duration: { value: 1, unit: "beat" } },
      ],
    };
    expect(encodeShareState(state)).toBe("D.dorian.100.3x4.i*2bt-IV*1bt");
  });

  it("encodes sharp root notes", () => {
    const state: ShareState = {
      root: "F#",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("Fs.major.120.4x4.I");
  });
});
