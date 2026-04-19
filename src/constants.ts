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
