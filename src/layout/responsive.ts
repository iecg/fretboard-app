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
  /** Sheet-shell row height while the Overlay panel is open (board must fit
   *  the band above the panel). Equals stringRowPx on desktop/tablet-stacked. */
  stringRowPxPanelOpen: number;
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

/* The sheet shell (mobile + tablet-split) sizes the board from the viewport
   height so it fills the stage between header/track and the fixed dock with
   intentional centered breathing room instead of a dead band. All SHELL_*
   constants are estimates of CSS chrome — the min/max clamp keeps errors
   degrading into a few px of breathing room rather than overflow. */
const STRING_ROW_PX_SHELL_MIN = 34;
const STRING_ROW_PX_SHELL_MAX = 64;
/** AppHeader band in the sheet shell (padding + 44px content row). */
const SHELL_HEADER_PX = 64;
/** Progression chip strip. */
const SHELL_TRACK_PX = 56;
/** MobileDock: 44px toggle row + 56px transport row + border. Keep in sync
 *  with --token-mobile-dock-height in src/styles/tokens.css. */
const SHELL_DOCK_PX = 104;
/** Fret-number band + stage breathing paddings. */
const STAGE_CHROME_PX = 46;
/** Fraction of the viewport the open Overlay panel + dock cover together.
 *  Keep in sync with --token-mobile-panel-cover (55dvh) in tokens.css. */
const PANEL_COVER_FRACTION = 0.55;
const SHELL_STRING_COUNT = 6;

function clampShellRow(raw: number): number {
  return Math.min(
    STRING_ROW_PX_SHELL_MAX,
    Math.max(STRING_ROW_PX_SHELL_MIN, Math.floor(raw)),
  );
}

/** Rows that fill the stage between header/track and the dock. */
function getDockStringRowPx(viewportHeight: number): number {
  const band =
    viewportHeight -
    SHELL_HEADER_PX -
    SHELL_TRACK_PX -
    SHELL_DOCK_PX -
    STAGE_CHROME_PX;
  return clampShellRow(band / SHELL_STRING_COUNT);
}

/** Rows that fit the band left visible above the open Overlay panel. */
function getPanelOpenStringRowPx(viewportHeight: number): number {
  const band =
    viewportHeight * (1 - PANEL_COVER_FRACTION) -
    SHELL_HEADER_PX -
    SHELL_TRACK_PX -
    STAGE_CHROME_PX;
  return clampShellRow(band / SHELL_STRING_COUNT);
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

  // Height-derived rows apply to the whole sheet shell (mobile AND
  // tablet-split) — tier-fixed rows would leave a dead band above the dock.
  const stringRowPx = useSheetShell
    ? getDockStringRowPx(viewportHeight)
    : getStringRowPx(tier);

  return {
    tier,
    variant,
    compactHeight,
    stringRowPx,
    stringRowPxPanelOpen: useSheetShell
      ? getPanelOpenStringRowPx(viewportHeight)
      : stringRowPx,
    showControlsPanel: tier !== "mobile" && variant !== "tablet-split",
    useSheetShell,
    showSummary: true,
    showStatusBar: tier !== "mobile" && variant !== "tablet-split",
    isSplitPanel,
    panelMode,
  };
}
