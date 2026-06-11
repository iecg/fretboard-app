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

describe("stringRowPx (sheet shell: height-derived between header/track and dock)", () => {
  it("caps at 64 on common phone heights (board fills with breathing room)", () => {
    // 844 - 64 - 56 - 104 - 46 = 574 → 95/row raw → capped to 64
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

describe("stringRowPxPanelOpen", () => {
  it("fits the band above the open Overlay panel on the sheet shell", () => {
    // 844 * 0.45 - 64 - 56 - 46 = 213.8 → 35/row
    expect(getResponsiveLayout(390, 844).stringRowPxPanelOpen).toBe(35);
    // 667 * 0.45 - 166 = 134.15 → 22 raw → clamped to 34
    expect(getResponsiveLayout(375, 667).stringRowPxPanelOpen).toBe(34);
    // 1100 * 0.45 - 166 = 329 → 54/row
    expect(getResponsiveLayout(800, 1100).stringRowPxPanelOpen).toBe(54);
  });

  it("equals stringRowPx outside the sheet shell", () => {
    expect(getResponsiveLayout(1280, 1000).stringRowPxPanelOpen).toBe(42);
    expect(getResponsiveLayout(800, 700).stringRowPxPanelOpen).toBe(36);
  });
});
