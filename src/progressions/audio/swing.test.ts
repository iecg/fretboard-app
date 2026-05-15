import { describe, it, expect } from "vitest";
import { applySwing } from "./swing";

describe("applySwing", () => {
  it("returns beat unchanged when swing is 0", () => {
    expect(applySwing(0.5, 0, 1)).toBe(0.5);
    expect(applySwing(1.5, 0, 1)).toBe(1.5);
  });

  it("shifts off-beats forward with swing 0.33", () => {
    const result = applySwing(0.5, 0.33, 1);
    expect(result).toBeCloseTo(0.5 + 0.33 * (1 / 3) * 1, 6);
  });

  it("does not shift on-beats", () => {
    expect(applySwing(0, 0.33, 1)).toBe(0);
    expect(applySwing(1, 0.33, 1)).toBe(1);
    expect(applySwing(2, 0.33, 1)).toBe(2);
    expect(applySwing(3, 0.33, 1)).toBe(3);
  });

  it("shifts all off-beats (0.5, 1.5, 2.5, 3.5)", () => {
    const swing = 0.5;
    const spb = 0.5;
    for (const beat of [0.5, 1.5, 2.5, 3.5]) {
      const result = applySwing(beat, swing, spb);
      expect(result).toBeGreaterThan(beat);
    }
  });

  it("scales shift by secondsPerBeat", () => {
    const fast = applySwing(0.5, 0.33, 0.5);
    const slow = applySwing(0.5, 0.33, 1.0);
    expect(slow - 0.5).toBeCloseTo((fast - 0.5) * 2, 6);
  });
});
