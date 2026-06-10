import { describe, expect, it } from "vitest";
import { getResponsiveLayout } from "./responsive";

describe("useSheetShell flag", () => {
  it("is true for the mobile tier", () => {
    expect(getResponsiveLayout(375, 812).useSheetShell).toBe(true);
  });

  it("is true for tablet-split (tablet width, tall viewport)", () => {
    expect(getResponsiveLayout(800, 1100).useSheetShell).toBe(true);
  });

  it("is false for tablet-stacked (tablet width, compact height)", () => {
    expect(getResponsiveLayout(800, 700).useSheetShell).toBe(false);
  });

  it("is false for all desktop variants", () => {
    expect(getResponsiveLayout(1280, 1000).useSheetShell).toBe(false);
    expect(getResponsiveLayout(1100, 700).useSheetShell).toBe(false);
  });
});

describe("stringRowPx", () => {
  it("mobile rows size from viewport height to fill the band above the half sheet", () => {
    // 0.55 * 812 - 170 chrome = 276.6 → floor(276.6 / 6) = 46
    expect(getResponsiveLayout(375, 812).stringRowPx).toBe(46);
    // 0.55 * 844 - 170 = 294.2 → floor / 6 = 49
    expect(getResponsiveLayout(390, 844).stringRowPx).toBe(49);
  });

  it("clamps mobile rows to the floor on compact heights", () => {
    // 0.55 * 500 - 170 = 105 → 17/row raw → clamped to 34
    expect(getResponsiveLayout(390, 500).stringRowPx).toBe(34);
  });

  it("clamps mobile rows to the ceiling on tall viewports", () => {
    // 0.55 * 1200 - 170 = 490 → 81/row raw → clamped to 56
    expect(getResponsiveLayout(390, 1200).stringRowPx).toBe(56);
  });

  it("keeps tablet and desktop rows tier-fixed", () => {
    expect(getResponsiveLayout(800, 1100).stringRowPx).toBe(36);
    expect(getResponsiveLayout(1280, 1000).stringRowPx).toBe(42);
  });
});
