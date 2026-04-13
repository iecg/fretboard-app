// Layout tunables for the adaptive desktop-expanded / tablet-portrait
// mode decision. Numbers measured via puppeteer against the live app
// with the fullest practical control state: CAGED fingering + chord
// overlay + chord root grid visible (linkChordRoot=false) + interval
// filter active. See .vbw-planning/phases/06-desktop-layout-refactor/
// 06-CONTEXT.md for the measurement table and fit algorithm.

// Maximum intrinsic heights (px) of each control group when all visible
// sub-sections are rendered. Drawers do NOT affect these — drawer
// options are position:absolute overlays.
// If a control group gains a new section, bump the relevant constant.
export const CONTROL_HEIGHTS = {
  settings: 280, // measured max 274 — CAGED adds Shape + Shape Labels rows
  scaleChord: 280, // measured max 269 — chord overlay + chord root grid
  cofMax: 500, // hard cap — without this, CoF tracks column width linearly
  rowGap: 16, // gap between stacked left-column groups in Target A
} as const;

// Fixed chrome heights (px) reserved in the fit calculation.
// Measured baseline values: header=57, summary=71, version=32.
// outerGap is the sum of gaps between app-container flex children.
export const LAYOUT_CHROME_HEIGHT = {
  header: 60,
  summary: 72,
  version: 32,
  outerGap: 36,
} as const;

// Minimum rendered fretboard height (px) used as the floor in the fit
// calculation. Real measured height at STRING_ROW_PX=40 is ~314; 280
// gives the fit check enough headroom to activate desktop-expanded at
// 1080p (24px of slack).
export const FRETBOARD_MIN_HEIGHT = 280;

// Fretboard string row heights (px). Small phones use the reduced row size
// to fit the fretboard vertically without additional scaling.
export const STRING_ROW_PX = 40;
export const STRING_ROW_PX_SMALL = 32;
export const SMALL_PHONE_HEIGHT_THRESHOLD = 800;

// Container max-widths (rem). desktop-expanded uses the wider cap so
// the fretboard has room to breathe on larger displays.
export const APP_MAX_WIDTH_DESKTOP_REM = 120; // 1920px
export const APP_MAX_WIDTH_TABLET_REM = 80; // 1280px (unchanged)
