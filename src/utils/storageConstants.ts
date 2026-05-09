export const STORAGE_PREFIX = "fretflow:";

/**
 * Settings coachmark dismissal flag. Set to "true" to prevent the first-run
 * coach mark from appearing. Preserved across the Coachmark component revert
 * so visual/e2e tests stay deterministic if it's ever reintroduced.
 */
export const COACHMARK_SETTINGS_DISMISSED_KEY = "fretflow:coachmark.settings.dismissed";

export const LEGACY_KEYS = [
  "rootNote",
  "scaleName",
  "chordRoot",
  "chordType",
  "linkChordRoot",
  "chordFretSpread",
  "chordIntervalFilter",
  "fingeringPattern",
  "cagedShapes",
  "npsPosition",
  "displayFormat",
  "tuningName",
  "fretZoom",
  "fretStart",
  "fretEnd",
  "isMuted",
  "mobileTab",
  "tabletTab",
  "landscapeNarrowTab",
] as const;
