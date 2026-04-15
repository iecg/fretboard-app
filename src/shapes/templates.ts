import { SCALES, NOTES } from "../theory";

/** Mode names for degrees of the major scale (Ionian through Locrian). */
export const MAJOR_MODE_NAMES = [
  'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian',
];

/**
 * Mode offset: which degree of the major scale this scale starts on.
 * E.g. Dorian starts on degree 1 (the 2nd note of the parent major scale).
 */
export const MODE_OFFSETS: Record<string, number> = {
  'Major': 0, 'Dorian': 1, 'Phrygian': 2, 'Lydian': 3,
  'Mixolydian': 4, 'Natural Minor': 5, 'Locrian': 6,
};

export type CagedShape = "C" | "A" | "G" | "E" | "D";
export const CAGED_SHAPES: CagedShape[] = ["C", "A", "G", "E", "D"];

export const CAGED_SHAPE_COLORS: Record<
  CagedShape,
  { solid: string; bg: string }
> = {
  E: { solid: "var(--caged-e)", bg: "var(--caged-e-bg)" },
  D: { solid: "var(--caged-d)", bg: "var(--caged-d-bg)" },
  C: { solid: "var(--caged-c)", bg: "var(--caged-c-bg)" },
  A: { solid: "var(--caged-a)", bg: "var(--caged-a-bg)" },
  G: { solid: "var(--caged-g)", bg: "var(--caged-g-bg)" },
};

/**
 * Fixed polygon outline templates for pentatonic/blues CAGED shapes.
 * Each template defines per-string [leftOffset, rightOffset] from anchor fret.
 */
export interface ShapeTemplate {
  anchorString: number;
  perString: [number, number][];
}

/**
 * Template coordinate system
 * ──────────────────────────
 * Each template describes a CAGED shape as per-string fret spans relative to
 * the root note's fret on the anchorString.
 *
 *   perString[s] = [leftOffset, rightOffset]
 *
 * The polygon for string s covers frets:
 *   [ rootFret + leftOffset,  rootFret + rightOffset ]
 *
 * String indices run s0 (highest-pitch string, e.g. high e on standard tuning)
 * to s5 (lowest-pitch string, e.g. low E). anchorString is the string whose
 * root-note fret is used as the origin (rootFret = 0 offset).
 *
 * Example — C shape (anchorString = 4, i.e. the A string):
 *
 *   String │ leftOffset  rightOffset │ Fret span
 *   ───────┼────────────────────────┼──────────────────────────────
 *   s0 (e) │    -2          +1      │ rootFret-2 … rootFret+1
 *   s1 (B) │    -2          +1      │ rootFret-2 … rootFret+1
 *   s2 (G) │    -3           0      │ rootFret-3 … rootFret
 *   s3 (D) │    -3           0      │ rootFret-3 … rootFret
 *   s4 (A) │    -2           0      │ rootFret-2 … rootFret  ← anchor (root here)
 *   s5 (E) │    -2          +1      │ rootFret-2 … rootFret+1
 */

/**
 * Fixed polygon outline templates for 7-note (diatonic minor) CAGED shapes.
 * All offsets verified computationally for all 12 roots in non-truncated positions.
 * B-string (s1) and G-string (s2) shifts are baked into the per-string offsets.
 * Used by Natural Minor and major-quality scales (Mixolydian, Lydian, Major) after
 * their remap to relative minor anchor.
 */
const SHAPE_TEMPLATES_7NOTE: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-3,0],[-3,0],[-2,0],[-2,1]] },
  A: { anchorString: 4, perString: [[0,3],[0,3],[0,2],[0,3],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-2,0],[-2,1],[-3,0],[-3,0],[-3,0],[-2,0]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[-1,2],[0,2],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[0,3],[1,3],[0,3],[0,3],[0,3],[0,3]] },
};

/** Dorian mode templates (natural 6, b3/b7 minor quality). */
const SHAPE_TEMPLATES_DORIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,0],[-2,1],[-3,0],[-3,0],[-3,0],[-2,0]] },
  A: { anchorString: 4, perString: [[0,3],[0,3],[-1,2],[0,2],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-3,0],[-2,0],[-3,0],[-3,0],[-3,0],[-3,0]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[-1,2],[-1,2],[0,2],[0,3]] },
  D: { anchorString: 3, perString: [[0,3],[0,3],[0,4],[0,3],[0,3],[0,3]] },
};

/** Phrygian mode templates (b2, b3, b6, b7 — minor quality). */
const SHAPE_TEMPLATES_PHRYGIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-3,0],[-2,0],[-2,1],[-2,1]] },
  A: { anchorString: 4, perString: [[0,3],[-1,3],[0,3],[0,3],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-2,1],[-2,1],[-3,0],[-3,0],[-2,0],[-2,1]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[0,2],[0,3],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[1,3],[1,4],[0,3],[0,3],[0,3],[1,3]] },
};

/** Locrian mode templates (b2, b3, b5, b6, b7 — minor quality). */
const SHAPE_TEMPLATES_LOCRIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-2,0],[-2,1],[-2,1],[-2,1]] },
  A: { anchorString: 4, perString: [[-1,3],[-1,3],[0,3],[0,3],[0,3],[-1,3]] },
  G: { anchorString: 5, perString: [[-2,1],[-2,1],[-3,0],[-2,0],[-2,1],[-2,1]] },
  E: { anchorString: 5, perString: [[0,3],[-1,3],[0,3],[0,3],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[1,4],[1,4],[0,3],[0,3],[1,3],[1,4]] },
};

/** Harmonic Minor templates (natural 5, raised 7th creates augmented 2nd). */
const SHAPE_TEMPLATES_HARMONIC_MINOR: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-3,1],[-3,1],[-3,0],[-1,0],[-2,1]] },
  A: { anchorString: 4, perString: [[0,1],[0,3],[1,2],[0,3],[-1,3],[0,1]] },
  G: { anchorString: 5, perString: [[-1,0],[-2,1],[-3,0],[-3,1],[-3,0],[-1,0]] },
  E: { anchorString: 5, perString: [[-1,3],[0,1],[-1,2],[1,2],[0,3],[-1,3]] },
  D: { anchorString: 3, perString: [[0,3],[2,3],[0,3],[0,3],[0,4],[0,3]] },
};

/** Select the appropriate fixed template set for supported 7-note scales. */
export function get7NoteTemplate(
  scaleName: string,
): Record<CagedShape, ShapeTemplate> | null {
  switch (scaleName) {
    case 'Major':
    case 'Natural Minor':
      return SHAPE_TEMPLATES_7NOTE;
    case 'Dorian':        return SHAPE_TEMPLATES_DORIAN;
    case 'Phrygian':      return SHAPE_TEMPLATES_PHRYGIAN;
    case 'Locrian':       return SHAPE_TEMPLATES_LOCRIAN;
    case 'Harmonic Minor':return SHAPE_TEMPLATES_HARMONIC_MINOR;
    // Major-quality scales remapped to their relative minor mode:
    case 'Lydian':        return SHAPE_TEMPLATES_DORIAN;     // Lydian → relative Dorian
    case 'Mixolydian':    return SHAPE_TEMPLATES_PHRYGIAN;   // Mixolydian → relative Phrygian
    default:              return null;
  }
}

export const SHAPE_TEMPLATES_PENT: Record<CagedShape, ShapeTemplate> = {
  C: {
    anchorString: 4,
    perString: [
      [-2, 0],  // s0
      [-2, 1],  // s1
      [-3, 0],  // s2
      [-2, 0],  // s3
      [-2, 0],  // s4
      [-2, 0],  // s5
    ],
  },
  A: {
    anchorString: 4,
    perString: [
      [0, 3],  // s0
      [1, 3],  // s1
      [0, 2],  // s2
      [0, 2],  // s3
      [0, 3],  // s4
      [0, 3],  // s5
    ],
  },
  G: {
    anchorString: 5,
    perString: [
      [-2, 0],  // s0
      [-2, 0],  // s1
      [-3, 0],  // s2
      [-3, 0],  // s3
      [-2, 0],  // s4
      [-2, 0],  // s5
    ],
  },
  E: {
    anchorString: 5,
    perString: [
      [0, 3],  // s0
      [0, 3],  // s1
      [0, 2],  // s2
      [0, 2],  // s3
      [0, 2],  // s4
      [0, 3],  // s5
    ],
  },
  D: {
    anchorString: 3,
    perString: [
      [1, 3],  // s0
      [1, 3],  // s1
      [0, 2],  // s2
      [0, 3],  // s3
      [0, 3],  // s4
      [1, 3],  // s5
    ],
  },
};

export interface ShapeConfig {
  rootStringFocus: number;
  fretOffsetMin: number;
  fretOffsetMax: number;
  maxNotesPerString?: Partial<Record<number, number>>;
}

export const SHAPE_CONFIGS: Record<CagedShape, ShapeConfig> = {
  C: { rootStringFocus: 4, fretOffsetMin: -3, fretOffsetMax: 1 },
  A: { rootStringFocus: 4, fretOffsetMin: -1, fretOffsetMax: 3 },
  G: {
    rootStringFocus: 5,
    fretOffsetMin: -3,
    fretOffsetMax: 1,
    maxNotesPerString: { 2: 2 },
  },
  E: { rootStringFocus: 5, fretOffsetMin: -1, fretOffsetMax: 3 },
  D: {
    rootStringFocus: 3,
    fretOffsetMin: 0,
    fretOffsetMax: 4,
    maxNotesPerString: { 3: 2 },
  },
};

/**
 * Maps each major-shape label to its equivalent minor-shape label.
 * Major and minor CAGED shapes cover the same fret patterns — only the root
 * note that anchors them differs. Minor-shape names are traditional, so when
 * rendering a major-quality scale the major shape label (e.g. "C shape") is
 * remapped to the equivalent minor label anchored on the relative minor root
 * (a minor third lower, e.g. "A shape").
 */
export const MAJOR_TO_MINOR_SHAPE: Record<CagedShape, CagedShape> = {
  C: 'A', A: 'G', G: 'E', E: 'D', D: 'C',
};

export function isMajorScale(scaleName: string): boolean {
  const intervals = SCALES[scaleName];
  return intervals ? intervals.includes(4) : false;
}

export function getRelativeMinorRoot(majorRoot: string): string {
  const idx = NOTES.indexOf(majorRoot);
  return NOTES[(idx + 9) % 12];
}
