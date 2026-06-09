import { describe, it, expect } from "vitest";
import { encodeShareState, decodeShareState, type ShareState } from "./shareCodec";

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

describe("decodeShareState", () => {
  it("decodes a basic major progression", () => {
    const result = decodeShareState("C.major.120.4x4.I-V-vi-IV");
    expect(result).toEqual({
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
    });
  });

  it("decodes quality overrides", () => {
    const result = decodeShareState("G.major.90.4x4.ii-V:7-I");
    expect(result?.steps[1]).toEqual({
      degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" },
    });
  });

  it("decodes non-default bar durations", () => {
    const result = decodeShareState("A.minor+blues.80.4x4.I:7*4b-IV:7*2b");
    expect(result?.steps[0].duration).toEqual({ value: 4, unit: "bar" });
    expect(result?.steps[1].duration).toEqual({ value: 2, unit: "bar" });
  });

  it("decodes beat durations", () => {
    const result = decodeShareState("D.dorian.100.3x4.i*2bt-IV*1bt");
    expect(result?.steps[0].duration).toEqual({ value: 2, unit: "beat" });
    expect(result?.steps[1].duration).toEqual({ value: 1, unit: "beat" });
  });

  it("decodes sharp root notes", () => {
    const result = decodeShareState("Fs.major.120.4x4.I");
    expect(result?.root).toBe("F#");
  });

  it("decodes scale names with spaces", () => {
    const result = decodeShareState("A.minor+blues.80.4x4.I");
    expect(result?.scale).toBe("minor blues");
  });

  it("returns null for malformed input", () => {
    expect(decodeShareState("")).toBeNull();
    expect(decodeShareState("C")).toBeNull();
    expect(decodeShareState("C.major")).toBeNull();
    expect(decodeShareState("not.a.valid.url.at-all-$$")).toBeNull();
  });

  it("returns null for invalid tempo", () => {
    expect(decodeShareState("C.major.abc.4x4.I")).toBeNull();
    expect(decodeShareState("C.major.0.4x4.I")).toBeNull();
    expect(decodeShareState("C.major.999.4x4.I")).toBeNull();
  });
});

describe("roundtrip", () => {
  it("encode then decode produces the original state", () => {
    const state: ShareState = {
      root: "F#",
      scale: "minor blues",
      tempo: 80,
      timeSignature: { numerator: 3, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: "7", duration: { value: 4, unit: "bar" } },
        { degree: "IV", qualityOverride: null, duration: { value: 2, unit: "beat" } },
        { degree: "vi", qualityOverride: "m7", duration: { value: 1, unit: "bar" } },
      ],
    };
    const encoded = encodeShareState(state);
    const decoded = decodeShareState(encoded);
    expect(decoded).toEqual(state);
  });
});
