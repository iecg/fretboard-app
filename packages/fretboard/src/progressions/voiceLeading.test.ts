import { describe, it, expect } from "vitest";
import { getNearestInversion } from "./voiceLeading";
import { calculateDistance } from "./voiceLeading";

describe("getNearestInversion", () => {
  it("returns root position when prevNotes is empty", () => {
    const result = getNearestInversion([], ["C", "E", "G", "B"]);
    expect(result).toEqual(["C3", "E3", "G3", "B3"]); // Our implementation stacks from rootOctave 3 by default
  });

  it("finds the nearest inversion to minimize motion", () => {
    const prevNotes = ["C4", "E4", "G4"];
    const result = getNearestInversion(prevNotes, ["F", "A", "C"]);

    // Nearest inversion of F to C E G should be C F A
    expect(result).toEqual(["C4", "F4", "A4"]);
  });
});

describe("calculateDistance", () => {
  it("sums absolute semitone distances element-wise", () => {
    // C3 E3 G3 -> C3 E3 A3 : only the third voice moves, G3(43)->A3(45) = 2
    expect(calculateDistance(["C3", "E3", "G3"], ["C3", "E3", "A3"])).toBe(2);
  });

  it("returns 0 for identical voicings", () => {
    expect(calculateDistance(["C3", "E3", "G3"], ["C3", "E3", "G3"])).toBe(0);
  });
});
