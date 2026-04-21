import { SCALES, NOTES } from "../core/theory";

/** Mode names for degrees of the major scale (Ionian through Locrian). */
export const MAJOR_MODE_NAMES = [
  'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian',
];

/** Mode offset from parent major scale. */
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

/** Fixed polygon templates for pentatonic/blues. */
export interface ShapeTemplate {
  anchorString: number;
  perString: [number, number][];
}

/** 
 * Template system: per-string [left, right] offsets relative to anchorString root fret. 
 */

/**
 * Fixed polygon templates for 7-note shapes. Verified for all roots.
 * Used by Natural Minor and remapped major-quality scales.
 */
const SHAPE_TEMPLATES_7NOTE: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-3,0],[-3,0],[-2,0],[-2,1]] },
  A: { anchorString: 4, perString: [[0,3],[0,3],[0,2],[0,3],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-2,0],[-2,1],[-3,0],[-3,0],[-3,0],[-2,0]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[-1,2],[0,2],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[0,3],[1,3],[0,3],[0,3],[0,3],[0,3]] },
};

/** Dorian mode templates. */
const SHAPE_TEMPLATES_DORIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,0],[-2,1],[-3,0],[-3,0],[-3,0],[-2,0]] },
  A: { anchorString: 4, perString: [[0,3],[0,3],[-1,2],[0,2],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-3,0],[-2,0],[-3,0],[-3,0],[-3,0],[-3,0]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[-1,2],[-1,2],[0,2],[0,3]] },
  D: { anchorString: 3, perString: [[0,3],[0,3],[0,4],[0,3],[0,3],[0,3]] },
};

/** Phrygian mode templates. */
const SHAPE_TEMPLATES_PHRYGIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-3,0],[-2,0],[-2,1],[-2,1]] },
  A: { anchorString: 4, perString: [[0,3],[-1,3],[0,3],[0,3],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-2,1],[-2,1],[-3,0],[-3,0],[-2,0],[-2,1]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[0,2],[0,3],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[1,3],[1,4],[0,3],[0,3],[0,3],[1,3]] },
};

/** Locrian mode templates. */
const SHAPE_TEMPLATES_LOCRIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-2,0],[-2,1],[-2,1],[-2,1]] },
  A: { anchorString: 4, perString: [[-1,3],[-1,3],[0,3],[0,3],[0,3],[-1,3]] },
  G: { anchorString: 5, perString: [[-2,1],[-2,1],[-3,0],[-2,0],[-2,1],[-2,1]] },
  E: { anchorString: 5, perString: [[0,3],[-1,3],[0,3],[0,3],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[1,4],[1,4],[0,3],[0,3],[1,3],[1,4]] },
};

/** Harmonic Minor templates. */
const SHAPE_TEMPLATES_HARMONIC_MINOR: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-3,1],[-3,1],[-3,0],[-1,0],[-2,1]] },
  A: { anchorString: 4, perString: [[0,1],[0,3],[1,2],[0,3],[-1,3],[0,1]] },
  G: { anchorString: 5, perString: [[-1,0],[-2,1],[-3,0],[-3,1],[-3,0],[-1,0]] },
  E: { anchorString: 5, perString: [[-1,3],[0,1],[-1,2],[1,2],[0,3],[-1,3]] },
  D: { anchorString: 3, perString: [[0,3],[2,3],[0,3],[0,3],[0,4],[0,3]] },
};

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
    case 'Lydian':        return SHAPE_TEMPLATES_DORIAN;
    case 'Mixolydian':    return SHAPE_TEMPLATES_PHRYGIAN;
    default:              return null;
  }
}

export const SHAPE_TEMPLATES_PENT: Record<CagedShape, ShapeTemplate> = {
  C: {
    anchorString: 4,
    perString: [[-2, 0], [-2, 1], [-3, 0], [-2, 0], [-2, 0], [-2, 0]],
  },
  A: {
    anchorString: 4,
    perString: [[0, 3], [1, 3], [0, 2], [0, 2], [0, 3], [0, 3]],
  },
  G: {
    anchorString: 5,
    perString: [[-2, 0], [-2, 0], [-3, 0], [-3, 0], [-2, 0], [-2, 0]],
  },
  E: {
    anchorString: 5,
    perString: [[0, 3], [0, 3], [0, 2], [0, 2], [0, 2], [0, 3]],
  },
  D: {
    anchorString: 3,
    perString: [[1, 3], [1, 3], [0, 2], [0, 3], [0, 3], [1, 3]],
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

/** Maps major-shape labels to minor equivalents for traditional CAGED naming. */
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
