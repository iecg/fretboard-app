import { describe, expect, it } from "vitest";
import {
  taperAwareRadiusScale,
  NOTE_TAPER_MIN_SCALE,
} from "./noteSizing";

// Reference geometry used across cases: a wide neck so xFrac resolves cleanly.
// maxSpacing = neckHeight * STRING_OCCUPY_FRAC / (numStrings - 1)
//            = 300 * 0.86 / 5 = 51.6
// referenceSpacing = noteBubblePx * (1 + 0.18) = 40 * 1.18 = 47.2
const GEOM = {
  neckWidthPx: 1000,
  neckHeight: 300,
  numStrings: 6,
  noteBubblePx: 40,
};

describe("taperAwareRadiusScale", () => {
  it("returns exactly 1 at the wide (bridge) end where bubbles already fit", () => {
    expect(taperAwareRadiusScale({ x: 1000, ...GEOM })).toBe(1);
  });

  it("shrinks below 1 near the nut where strings have converged", () => {
    const nut = taperAwareRadiusScale({ x: 0, ...GEOM });
    expect(nut).toBeLessThan(1);
    expect(nut).toBeGreaterThan(NOTE_TAPER_MIN_SCALE);
    // spacingRatio(0)=0.76 → localSpacing=39.216 → 39.216/47.2 ≈ 0.8309
    expect(nut).toBeCloseTo(0.8309, 3);
  });

  it("is monotonic: nut scale <= bridge scale", () => {
    const nut = taperAwareRadiusScale({ x: 0, ...GEOM });
    const bridge = taperAwareRadiusScale({ x: 1000, ...GEOM });
    expect(nut).toBeLessThanOrEqual(bridge);
  });

  it("never exceeds 1, even past the right edge", () => {
    expect(taperAwareRadiusScale({ x: 99999, ...GEOM })).toBe(1);
  });

  it("floors at NOTE_TAPER_MIN_SCALE for extreme crowding", () => {
    // Huge bubble vs the same spacing → would compute well below the floor.
    const scale = taperAwareRadiusScale({ x: 0, ...GEOM, noteBubblePx: 200 });
    expect(scale).toBe(NOTE_TAPER_MIN_SCALE);
  });

  it("returns 1 for degenerate geometry (no-op for callers without layout)", () => {
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, neckWidthPx: 0 })).toBe(1);
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, numStrings: 1 })).toBe(1);
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, noteBubblePx: 0 })).toBe(1);
  });
});
