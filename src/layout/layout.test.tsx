// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BREAKPOINTS } from "../layout/breakpoints";

const expandedPanelCSS = readFileSync(
  resolve(__dirname, "../components/ExpandedControlsPanel/ExpandedControlsPanel.module.css"),
  "utf-8",
);
import {
  getResponsiveLayout,
  getResponsiveTier,
  getResponsiveVariant,
  getStringRowPx,
  isCompactHeight,
} from "../layout/responsive";

// Regression guard: if ExpandedControlsPanel.css is unimported or its grid rule
// is removed, the dashboard silently falls back to flex — this test catches it.
describe("dashboard panel CSS contract", () => {
  it("declares display: grid on .controls-panel", () => {
    expect(expandedPanelCSS).toContain(".controls-panel");
    expect(expandedPanelCSS).toContain("display: grid");
  });

  it("3col mode declares grid-template-columns", () => {
    expect(expandedPanelCSS).toContain('[data-mode="3col"]');
    expect(expandedPanelCSS).toContain("grid-template-columns");
  });

  it("split mode declares grid-template-columns", () => {
    expect(expandedPanelCSS).toContain('[data-mode="split"]');
    // Verify split has its own column definition (not just inherited from 3col)
    const splitBlock = expandedPanelCSS.slice(
      expandedPanelCSS.indexOf('[data-mode="split"]'),
    );
    expect(splitBlock).toContain("grid-template-columns");
  });
});

describe("responsive layout helper", () => {
  it("exports the shared breakpoint contract", () => {
    expect(BREAKPOINTS).toEqual({
      mobileMax: 767,
      desktopMin: 1024,
      desktop3colMin: 1280,
      compactHeightMax: 899,
    });
  });

  it("classifies width tiers from the shared breakpoints", () => {
    expect(getResponsiveTier(375)).toBe("mobile");
    expect(getResponsiveTier(767)).toBe("mobile");
    expect(getResponsiveTier(768)).toBe("tablet");
    expect(getResponsiveTier(1023)).toBe("tablet");
    expect(getResponsiveTier(1024)).toBe("desktop");
    expect(getResponsiveTier(1440)).toBe("desktop");
  });

  it("flags compact heights below 900px", () => {
    expect(isCompactHeight(899)).toBe(true);
    expect(isCompactHeight(900)).toBe(false);
  });

  it("resolves desktop sub-variants at the desktop3colMin boundary", () => {
    // narrow desktop (tall) → split
    expect(getResponsiveVariant(1024, 1000)).toBe("desktop-split");
    expect(getResponsiveVariant(1279, 1000)).toBe("desktop-split");
    // at exactly the 3col threshold → 3col
    expect(getResponsiveVariant(1280, 1000)).toBe("desktop-3col");
    // compact height wins regardless of width
    expect(getResponsiveVariant(1279, 800)).toBe("desktop-stacked");
    expect(getResponsiveVariant(1440, 800)).toBe("desktop-stacked");
  });

  // Canonical viewport matrix — one row per target device / variant.
  it.each([
    // phones (portrait)
    [375, 667, "mobile", "mobile", 28],
    [390, 844, "mobile", "mobile", 28],
    // phone landscape
    [667, 375, "mobile", "landscape-mobile", 28],
    // tablet portrait
    [768, 1024, "tablet", "tablet-split", 36],
    // compact tablet (short height)
    [768, 400, "tablet", "tablet-stacked", 36],
    // desktop — compact height → stacked
    [1024, 768, "desktop", "desktop-stacked", 42],
    [1200, 720, "desktop", "desktop-stacked", 42],
    // desktop — narrow but tall → split
    [1024, 1366, "desktop", "desktop-split", 42],
    // desktop — wide and tall → 3col
    [1280, 900, "desktop", "desktop-3col", 42],
    [1440, 900, "desktop", "desktop-3col", 42],
    [1920, 1080, "desktop", "desktop-3col", 42],
    [2560, 1440, "desktop", "desktop-3col", 42],
  ] as const)(
    "maps %ix%i to %s / %s",
    (width, height, tier, variant, stringRowPx) => {
      const layout = getResponsiveLayout(width, height);

      expect(layout.tier).toBe(tier);
      expect(layout.variant).toBe(variant);
      expect(layout.stringRowPx).toBe(stringRowPx);
      expect(getResponsiveVariant(width, height)).toBe(variant);
      expect(getStringRowPx(tier)).toBe(stringRowPx);
    },
  );

  it("shows mobile tabs only in portrait mobile", () => {
    expect(getResponsiveLayout(390, 844).showMobileTabs).toBe(true);
    expect(getResponsiveLayout(667, 375).showMobileTabs).toBe(false);
  });

  it("shows the shared controls panel only outside mobile", () => {
    expect(getResponsiveLayout(390, 844).showControlsPanel).toBe(false);
    expect(getResponsiveLayout(768, 1024).showControlsPanel).toBe(true);
    expect(getResponsiveLayout(1440, 900).showControlsPanel).toBe(true);
  });

  it("marks split panel for tablet-split and desktop-split only", () => {
    expect(getResponsiveLayout(768, 1024).isSplitPanel).toBe(true);   // tablet-split
    expect(getResponsiveLayout(1024, 1366).isSplitPanel).toBe(true);  // desktop-split
    expect(getResponsiveLayout(768, 400).isSplitPanel).toBe(false);   // tablet-stacked
    expect(getResponsiveLayout(1024, 768).isSplitPanel).toBe(false);  // desktop-stacked
    expect(getResponsiveLayout(1440, 900).isSplitPanel).toBe(false);  // desktop-3col
  });

  it("routes panel mode correctly for all seven variants", () => {
    expect(getResponsiveLayout(1440, 900).panelMode).toBe("3col");    // desktop-3col
    expect(getResponsiveLayout(1024, 1366).panelMode).toBe("split");  // desktop-split
    expect(getResponsiveLayout(768, 1024).panelMode).toBe("split");   // tablet-split
    expect(getResponsiveLayout(1024, 768).panelMode).toBe("stacked"); // desktop-stacked
    expect(getResponsiveLayout(768, 400).panelMode).toBe("stacked");  // tablet-stacked
    expect(getResponsiveLayout(390, 844).panelMode).toBe("stacked");  // mobile (no panel)
  });

  it("hides the summary only in landscape mobile", () => {
    expect(getResponsiveLayout(390, 844).showSummary).toBe(true);
    expect(getResponsiveLayout(1440, 900).showSummary).toBe(true);
    expect(getResponsiveLayout(667, 375).showSummary).toBe(false);
  });
});
