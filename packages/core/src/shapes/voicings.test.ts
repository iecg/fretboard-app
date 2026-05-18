import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "../guitar";
import { stringSetMask, inversionBassPitchClass, openStringMidi } from "./voicings";

describe("voicing helpers", () => {
  it("maps string-set ids to high→low string indices", () => {
    expect(stringSetMask("all")).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stringSetMask("low")).toEqual([3, 4, 5]);
    expect(stringSetMask("mid")).toEqual([2, 3, 4]);
    expect(stringSetMask("mid-hi")).toEqual([1, 2, 3]);
    expect(stringSetMask("top")).toEqual([0, 1, 2]);
  });

  it("computes the inversion bass pitch class", () => {
    expect(inversionBassPitchClass("C", "Major Triad", "root")).toBe(0);
    expect(inversionBassPitchClass("C", "Major Triad", "1st")).toBe(4);
    expect(inversionBassPitchClass("C", "Major Triad", "2nd")).toBe(7);
    expect(inversionBassPitchClass("C", "Major Triad", "3rd")).toBeNull();
  });

  it("computes open-string MIDI from a tuning entry", () => {
    expect(openStringMidi("E2")).toBe(28);
    expect(openStringMidi(STANDARD_TUNING[5])).toBe(28);
    expect(openStringMidi("not-a-note")).toBeNull();
  });
});
