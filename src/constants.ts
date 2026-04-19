/**
 * Global application constants and layout tunables.
 */

export const MAX_FRET = 25;

// Fretboard layout
export const STRING_ROW_PX_DEFAULT = 36;
export const STRING_ROW_PX_MIN = 32;
export const STRING_ROW_PX_MAX = 72;

// Fretboard geometry
export const NUT_WIDTH = 8;
export const NECK_BORDER = 0;
export const NOTE_BUBBLE_RATIO = 0.8;
export const MIN_FRET_WIDTH_BASE = 49;
export const MIN_FRET_WIDTH_OVERFLOW_BUFFER = 17;

// Note display
export const NOTE_FONT_RATIO = 0.44;

// Neck geometry
export const NECK_TAPER_SCALE = 0.2;

// String positioning
export const STRING_OCCUPY_FRAC = 0.86;
export const STRING_SPREAD_LEFT_FRAC = 0.76;

// Inlay geometry
export const INLAY_RADIUS_RATIO = 0.15;
export const INLAY_RADIUS_MIN = 5;

// Note radius scales per note class
export const RADIUS_SCALE_KEY_TONIC = 0.82;
export const RADIUS_SCALE_CHORD_ROOT = 0.86;
export const RADIUS_SCALE_CHORD_TONE = 0.82;
export const RADIUS_SCALE_NOTE_ACTIVE = 0.82;
export const RADIUS_SCALE_COLOR_TONE = 0.80;
export const RADIUS_SCALE_DEFAULT = 0.8;

// Fret markers
export const STANDARD_FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
export const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
export const INLAY_DOUBLE_FRETS = [12, 24];

// Audio
export const DEFAULT_OCTAVE = 4;
export const A4_FREQUENCY = 440;
export const A4_ABS_DISTANCE = 57; // C0 is 0, A4 is 57

// Components
export const DRAWER_DROPUP_THRESHOLD = 260;

// Animation transitions (motion/react)
export const ANIMATION_DURATION_FAST = 0.2;
export const ANIMATION_DURATION_STANDARD = 0.24;
export const ANIMATION_EASE = "easeOut";

// Settings / Atoms
export const FRET_ZOOM_MIN = 50;
export const FRET_ZOOM_MAX = 200;
export const FRET_ZOOM_DEFAULT = 100;
