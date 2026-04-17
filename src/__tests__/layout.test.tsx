// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BREAKPOINTS } from "../layout/breakpoints";
import {
  getResponsiveLayout,
  getResponsiveTier,
  getResponsiveVariant,
  getStringRowPx,
  isCompactHeight,
} from "../layout/responsive";

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
    [375, 667, "mobile", "mobile", 32],
    [390, 844, "mobile", "mobile", 32],
    // phone landscape
    [667, 375, "mobile", "landscape-mobile", 32],
    // tablet portrait
    [768, 1024, "tablet", "tablet-split", 40],
    // compact tablet (short height)
    [768, 400, "tablet", "tablet-stacked", 40],
    // desktop — compact height → stacked
    [1024, 768, "desktop", "desktop-stacked", 48],
    [1200, 720, "desktop", "desktop-stacked", 48],
    // desktop — narrow but tall → split
    [1024, 1366, "desktop", "desktop-split", 48],
    // desktop — wide and tall → 3col
    [1280, 900, "desktop", "desktop-3col", 48],
    [1440, 900, "desktop", "desktop-3col", 48],
    [1920, 1080, "desktop", "desktop-3col", 48],
    [2560, 1440, "desktop", "desktop-3col", 48],
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

  it("exposes header and overlay flags from the shared responsive contract", () => {
    const mobileLayout = getResponsiveLayout(390, 844);
    expect(mobileLayout.showHeaderSubtitle).toBe(false);
    expect(mobileLayout.compactHeaderActions).toBe(true);
    expect(mobileLayout.fullWidthOverlay).toBe(true);

    const tabletLayout = getResponsiveLayout(768, 1024);
    expect(tabletLayout.showHeaderSubtitle).toBe(false);
    expect(tabletLayout.compactHeaderActions).toBe(true);
    expect(tabletLayout.fullWidthOverlay).toBe(false);

    const desktopLayout = getResponsiveLayout(1200, 900);
    expect(desktopLayout.showHeaderSubtitle).toBe(true);
    expect(desktopLayout.compactHeaderActions).toBe(false);
    expect(desktopLayout.fullWidthOverlay).toBe(false);
  });
});
