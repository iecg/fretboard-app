import { describe, expect, it } from "vitest";
import { getResponsiveLayout, scaleRowForZoomOut } from "./responsive";

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

describe("stringRowPx (sheet shell: height-derived between header/transport/track and dock)", () => {
  it("caps at 64 on common phone heights (board fills with breathing room)", () => {
    // 844 - 64 - 56 - 56 - 48 - 46 = 574 → 95/row raw → capped to 64
    expect(getResponsiveLayout(390, 844).stringRowPx).toBe(64);
    expect(getResponsiveLayout(375, 667).stringRowPx).toBe(64);
  });

  it("clamps to the floor on very short viewports", () => {
    // 460 - 270 = 190 → 31/row raw → clamped to 34
    expect(getResponsiveLayout(390, 460).stringRowPx).toBe(34);
  });

  it("derives tablet-split rows too (sheet shell, not tier-fixed)", () => {
    expect(getResponsiveLayout(800, 1100).stringRowPx).toBe(64);
  });

  it("keeps tablet-stacked and desktop rows tier-fixed", () => {
    expect(getResponsiveLayout(800, 700).stringRowPx).toBe(36);
    expect(getResponsiveLayout(1280, 1000).stringRowPx).toBe(42);
  });
});

describe("scaleRowForZoomOut", () => {
  it("leaves rows alone at 100 and above (zoom-in widens frets, not rows)", () => {
    expect(scaleRowForZoomOut(64, 100)).toBe(64);
    expect(scaleRowForZoomOut(64, 150)).toBe(64);
  });

  it("shrinks rows proportionally below 100", () => {
    expect(scaleRowForZoomOut(64, 90)).toBe(58); // 57.6 rounded
    expect(scaleRowForZoomOut(64, 50)).toBe(32);
  });

  it("clamps to the 24px legibility floor", () => {
    expect(scaleRowForZoomOut(34, 50)).toBe(24); // 17 raw → floor
    expect(scaleRowForZoomOut(26, 60)).toBe(24); // 15.6 raw → floor
  });
});
