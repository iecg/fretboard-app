import { BREAKPOINTS } from "./breakpoints";

export type ResponsiveTier = "mobile" | "tablet" | "desktop";

export type ResponsiveVariant =
  | "mobile"
  | "tablet-split"
  | "tablet-stacked"
  | "desktop-split"
  | "desktop-stacked"
  | "desktop-3col";

type DashboardPanelMode = "3col" | "split" | "stacked";

export interface ResponsiveLayout {
  tier: ResponsiveTier;
  variant: ResponsiveVariant;
  compactHeight: boolean;
  stringRowPx: number;
  showControlsPanel: boolean;
  /** True when the surface uses the MobileShell + bottom sheet (touch contexts). */
  useSheetShell: boolean;
  showSummary: boolean;
  showStatusBar: boolean;
  isSplitPanel: boolean;
  panelMode: DashboardPanelMode;
}

const STRING_ROW_PX_MOBILE = 38;
export const STRING_ROW_PX_TABLET = 36;
const STRING_ROW_PX_DESKTOP = 42;

const STRING_ROW_PX_BY_TIER: Record<ResponsiveTier, number> = {
  mobile: STRING_ROW_PX_MOBILE,
  tablet: STRING_ROW_PX_TABLET,
  desktop: STRING_ROW_PX_DESKTOP,
};

/* Mobile portrait sizes the board from the viewport height so it fills the
   stage above the half-open resting sheet instead of leaving a dead band. */
const STRING_ROW_PX_MOBILE_MIN = 34;
const STRING_ROW_PX_MOBILE_MAX = 56;
/** Fraction of the viewport the bottom sheet covers at its half (resting)
 *  snap. Keep in sync with SNAP_POINTS[1] in
 *  src/components/MobileShell/mobileSheetSnap.ts and the 45dvh stage padding
 *  in MobileShell.module.css. */
const MOBILE_SHEET_HALF_SNAP = 0.45;
/** Vertical chrome sharing the space above the half sheet with the strings:
 *  app header (~72px) + progression track (~56px) + the board's fret-number
 *  band and stage gaps (~42px). An estimate — the min/max clamp keeps errors
 *  degrading into a few px of centered breathing room rather than overflow. */
const MOBILE_STAGE_CHROME_PX = 170;
const MOBILE_STRING_COUNT = 6;

function getMobileStringRowPx(viewportHeight: number): number {
  const aboveHalfSheet =
    viewportHeight * (1 - MOBILE_SHEET_HALF_SNAP) - MOBILE_STAGE_CHROME_PX;
  const raw = Math.floor(aboveHalfSheet / MOBILE_STRING_COUNT);
  return Math.min(
    STRING_ROW_PX_MOBILE_MAX,
    Math.max(STRING_ROW_PX_MOBILE_MIN, raw),
  );
}

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
    return "mobile";
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
  const useSheetShell = tier === "mobile" || variant === "tablet-split";

  return {
    tier,
    variant,
    compactHeight,
    stringRowPx:
      tier === "mobile"
        ? getMobileStringRowPx(viewportHeight)
        : getStringRowPx(tier),
    showControlsPanel: tier !== "mobile" && variant !== "tablet-split",
    useSheetShell,
    showSummary: true,
    showStatusBar: tier !== "mobile" && variant !== "tablet-split",
    isSplitPanel,
    panelMode,
  };
}
