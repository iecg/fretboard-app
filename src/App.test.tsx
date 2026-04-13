// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { STRING_ROW_PX_MIN, STRING_ROW_PX_MAX } from "./layout/constants";

// Regression tests for UAT-01: viewport-height responsiveness.
// These tests exercise the stringRowPx derivation formula in isolation —
// pure arithmetic, no DOM render needed, stable across jsdom limitations.
// Formula: available = max(0, viewportH - chromeH - CONTROLS_MIN_HEIGHT - SUMMARY_MIN_HEIGHT)
//          derived = floor(available / 6), clamped to [STRING_ROW_PX_MIN, STRING_ROW_PX_MAX]

const CHROME_H = 60 + 72 + 32 + 36; // LAYOUT_CHROME_HEIGHT: header + summary + version + outerGap
const CONTROLS_MIN_H = 260; // CONTROLS_MIN_HEIGHT
const SUMMARY_MIN_H = 72; // SUMMARY_MIN_HEIGHT

function deriveStringRowPx(viewportH: number): number {
  const available = Math.max(0, viewportH - CHROME_H - CONTROLS_MIN_H - SUMMARY_MIN_H);
  const derived = Math.floor(available / 6);
  return Math.max(STRING_ROW_PX_MIN, Math.min(STRING_ROW_PX_MAX, derived));
}

describe("stringRowPx viewport derivation", () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("clamps to STRING_ROW_PX_MIN when viewport is very short", () => {
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 480,
    });
    // Derivation: available = 480 - 200 - 260 - 72 = -52 → max(0, -52) = 0
    // floor(0/6) = 0 → clamps to STRING_ROW_PX_MIN
    const result = deriveStringRowPx(window.innerHeight);
    expect(result).toBe(STRING_ROW_PX_MIN);
  });

  it("derives correctly at tall viewport (1400px)", () => {
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1400,
    });
    // available = 1400 - 200 - 260 - 72 = 868
    // floor(868/6) = 144 → clamps to STRING_ROW_PX_MAX (72)
    const result = deriveStringRowPx(window.innerHeight);
    expect(result).toBe(STRING_ROW_PX_MAX);
  });

  it("derives proportionally at mid-range viewport (900px)", () => {
    // available = 900 - 200 - 260 - 72 = 368
    // floor(368/6) = 61 → within [40,72], no clamp
    const result = deriveStringRowPx(900);
    expect(result).toBeGreaterThanOrEqual(STRING_ROW_PX_MIN);
    expect(result).toBeLessThanOrEqual(STRING_ROW_PX_MAX);
    expect(result).toBe(61); // 900px viewport yields 61px string rows
  });
});
