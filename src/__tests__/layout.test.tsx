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
      compactHeightMax: 899,
    });
  });

  it("classifies width tiers from the shared breakpoints", () => {
    expect(getResponsiveTier(375)).toBe("mobile");
    expect(getResponsiveTier(768)).toBe("tablet");
    expect(getResponsiveTier(1023)).toBe("tablet");
    expect(getResponsiveTier(1024)).toBe("desktop");
  });

  it("flags compact heights below 900px", () => {
    expect(isCompactHeight(899)).toBe(true);
    expect(isCompactHeight(900)).toBe(false);
  });

  it.each([
    [375, 667, "mobile", "mobile", 32],
    [390, 844, "mobile", "mobile", 32],
    [667, 375, "mobile", "landscape-mobile", 32],
    [768, 1024, "tablet", "tablet-split", 40],
    [1024, 768, "desktop", "desktop-3col", 48],
    [1024, 1366, "desktop", "desktop-3col", 48],
    [1200, 720, "desktop", "desktop-3col", 48],
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
    expect(getResponsiveLayout(1024, 768).showControlsPanel).toBe(true);
  });

  it("uses split panel only for roomy tablet layouts", () => {
    expect(getResponsiveLayout(768, 1024).isSplitPanel).toBe(true);
    expect(getResponsiveLayout(1024, 1366).isSplitPanel).toBe(false);
    expect(getResponsiveLayout(1024, 768).isSplitPanel).toBe(false);
  });

  it("routes desktop to the 3-column panel mode", () => {
    expect(getResponsiveLayout(1024, 768).panelMode).toBe("3col");
    expect(getResponsiveLayout(1024, 1366).panelMode).toBe("3col");
    expect(getResponsiveLayout(768, 1024).panelMode).toBe("split");
    expect(getResponsiveLayout(768, 400).panelMode).toBe("stacked");
  });

  it("hides the summary only in landscape mobile", () => {
    expect(getResponsiveLayout(390, 844).showSummary).toBe(true);
    expect(getResponsiveLayout(1024, 768).showSummary).toBe(true);
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
