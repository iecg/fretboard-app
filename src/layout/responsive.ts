import { BREAKPOINTS } from "./breakpoints";

export type ResponsiveTier = "mobile" | "tablet" | "desktop";

export type ResponsiveVariant =
  | "mobile"
  | "landscape-mobile"
  | "tablet-split"
  | "tablet-stacked"
  | "desktop-split"
  | "desktop-stacked"
  | "desktop-3col";

export type DashboardPanelMode = "3col" | "split" | "stacked";

export interface ResponsiveLayout {
  tier: ResponsiveTier;
  variant: ResponsiveVariant;
  compactHeight: boolean;
  stringRowPx: number;
  showControlsPanel: boolean;
  showMobileTabs: boolean;
  showSummary: boolean;
  isSplitPanel: boolean;
  panelMode: DashboardPanelMode;
}

export const STRING_ROW_PX_MOBILE = 28;
export const STRING_ROW_PX_TABLET = 36;
export const STRING_ROW_PX_DESKTOP = 42;

const STRING_ROW_PX_BY_TIER: Record<ResponsiveTier, number> = {
  mobile: STRING_ROW_PX_MOBILE,
  tablet: STRING_ROW_PX_TABLET,
  desktop: STRING_ROW_PX_DESKTOP,
};

export function getResponsiveTier(viewportWidth: number): ResponsiveTier {
  if (viewportWidth <= BREAKPOINTS.mobileMax) {
    return "mobile";
  }

  if (viewportWidth < BREAKPOINTS.desktopMin) {
    return "tablet";
  }

  return "desktop";
}

export function isCompactHeight(viewportHeight: number): boolean {
  return viewportHeight <= BREAKPOINTS.compactHeightMax;
}

export function getResponsiveVariant(
  viewportWidth: number,
  viewportHeight: number,
): ResponsiveVariant {
  const tier = getResponsiveTier(viewportWidth);

  if (tier === "mobile") {
    return viewportHeight < viewportWidth ? "landscape-mobile" : "mobile";
  }

  if (tier === "tablet") {
    return isCompactHeight(viewportHeight) ? "tablet-stacked" : "tablet-split";
  }

  // Desktop: height priority determines stacked vs grid/3col.
  if (isCompactHeight(viewportHeight)) {
    return "desktop-stacked";
  }
  if (viewportWidth < BREAKPOINTS.desktop3colMin) {
    return "desktop-split";
  }
  return "desktop-3col";
}

export function getStringRowPx(tier: ResponsiveTier): number {
  return STRING_ROW_PX_BY_TIER[tier];
}

export function getResponsiveLayout(
  viewportWidth: number,
  viewportHeight: number,
): ResponsiveLayout {
  const tier = getResponsiveTier(viewportWidth);
  const variant = getResponsiveVariant(viewportWidth, viewportHeight);
  const compactHeight = isCompactHeight(viewportHeight);
  const isSplitPanel =
    variant === "tablet-split" || variant === "desktop-split";
  const panelMode: DashboardPanelMode =
    variant === "desktop-3col"
      ? "3col"
      : isSplitPanel
        ? "split"
        : "stacked";
  const showMobileTabs =
    tier === "mobile" && variant !== "landscape-mobile";

  return {
    tier,
    variant,
    compactHeight,
    stringRowPx: getStringRowPx(tier),
    showControlsPanel: tier !== "mobile",
    showMobileTabs,
    showSummary: variant !== "landscape-mobile",
    isSplitPanel,
    panelMode,
  };
}
