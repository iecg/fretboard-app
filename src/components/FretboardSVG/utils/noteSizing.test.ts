import { describe, expect, it } from "vitest";
import {
  taperAwareRadiusScale,
  NOTE_TAPER_MIN_SCALE,
  connectorDashArray,
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
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, neckHeight: 0 })).toBe(1);
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, numStrings: 1 })).toBe(1);
    expect(taperAwareRadiusScale({ x: 0, ...GEOM, noteBubblePx: 0 })).toBe(1);
  });
});

describe("connectorDashArray", () => {
  it("reproduces the legacy 7px 5px at the default tablet row height (36)", () => {
    expect(connectorDashArray(36)).toBe("7px 5px");
  });

  it("scales up on a taller (desktop) row height", () => {
    expect(connectorDashArray(42)).toBe("8px 6px");
  });

  it("never shrinks below the dash/gap floor on tiny boards", () => {
    expect(connectorDashArray(10)).toBe("6px 4px");
    expect(connectorDashArray(0)).toBe("6px 4px");
  });

  it("clamps to the maximum on very large row heights", () => {
    expect(connectorDashArray(1000)).toBe("10px 7px");
  });

  it("is monotonically non-decreasing in stringRowPx", () => {
    const dash = (s: number) => Number(connectorDashArray(s).split("px")[0]);
    for (let s = 8; s < 80; s++) {
      expect(dash(s + 1)).toBeGreaterThanOrEqual(dash(s));
    }
  });
});
