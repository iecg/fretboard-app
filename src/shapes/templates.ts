import { SCALES, NOTES, getScaleNotes } from "../core/theory";
import { getFretboardNotes, STANDARD_TUNING } from "../core/guitar";
import { MAX_FRET } from "../core/constants";

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

const HAND_TUNED_TEMPLATES: Record<string, Record<CagedShape, ShapeTemplate>> = {
  'Major':          SHAPE_TEMPLATES_7NOTE,
  'Natural Minor':  SHAPE_TEMPLATES_7NOTE,
  'Dorian':         SHAPE_TEMPLATES_DORIAN,
  'Phrygian':       SHAPE_TEMPLATES_PHRYGIAN,
  'Locrian':        SHAPE_TEMPLATES_LOCRIAN,
  'Harmonic Minor': SHAPE_TEMPLATES_HARMONIC_MINOR,
  'Lydian':         SHAPE_TEMPLATES_DORIAN,
  'Mixolydian':     SHAPE_TEMPLATES_PHRYGIAN,
};

const derivedTemplateCache = new Map<string, Record<CagedShape, ShapeTemplate>>();

/**
 * Derive a CAGED template for a 7-note scale by running the same per-string
 * note collection used by the dynamic polygon path at a canonical mid-fretboard
 * anchor, then extracting per-string [left, right] offsets relative to the
 * anchor's root fret. Pure pattern geometry — invariant to root note.
 */
function deriveTemplate(
  scaleName: string,
  shape: CagedShape,
): ShapeTemplate | null {
  const intervals = SCALES[scaleName];
  if (!intervals || intervals.length !== 7) return null;

  const useMajorRemap = shouldUseRelativeMinorAnchor(scaleName);
  const effectiveShape = useMajorRemap ? MAJOR_TO_MINOR_SHAPE[shape] : shape;
  const config = SHAPE_CONFIGS[effectiveShape];

  // Canonical roots chosen to keep anchor mid-fretboard for both remap paths.
  const rootNote = useMajorRemap ? 'F' : 'C';
  const anchorNote = useMajorRemap ? getRelativeMinorRoot(rootNote) : rootNote;
  const validNotes = getScaleNotes(rootNote, scaleName);
  const layout = getFretboardNotes(STANDARD_TUNING, MAX_FRET);

  // 2-fret buffer keeps the canonical anchor away from either fretboard edge
  // so derived offsets reflect mid-board geometry, not edge-clamped notes.
  const EDGE_BUFFER = 2;
  let canonicalRootFret = -1;
  const anchorString = layout[config.rootStringFocus];
  for (let rf = 0; rf <= MAX_FRET; rf++) {
    if (anchorString[rf] !== anchorNote) continue;
    if (
      rf + config.fretOffsetMin >= EDGE_BUFFER &&
      rf + config.fretOffsetMax <= MAX_FRET - EDGE_BUFFER
    ) {
      canonicalRootFret = rf;
      break;
    }
  }
  if (canonicalRootFret < 0) return null;

  const intendedMin = canonicalRootFret + config.fretOffsetMin;
  const intendedMax = canonicalRootFret + config.fretOffsetMax;
  const numStrings = STANDARD_TUNING.length;

  // 7-note scales bypass maxNotesPerString at runtime (polygons.ts:118), so
  // skip it here too — applying the cap would yield template ranges that
  // don't match the actual collected notes during rendering.
  const perStringNotes: number[][] = [];
  for (let s = 0; s < numStrings; s++) {
    const stringNotes: number[] = [];
    for (let f = intendedMin; f <= intendedMax; f++) {
      if (validNotes.includes(layout[s][f])) stringNotes.push(f);
    }
    perStringNotes.push(stringNotes);
  }

  // Skip dedup: hand-tuned templates describe the full shape boundary on
  // every string (matching all scale notes in the window). Dedup is a
  // runtime concern for dot rendering only — applying it here would shrink
  // template ranges and produce indented polygons.

  const perString: [number, number][] = [];
  for (let s = 0; s < numStrings; s++) {
    const notes = perStringNotes[s];
    if (notes.length === 0) {
      perString.push([config.fretOffsetMin, config.fretOffsetMax]);
    } else {
      perString.push([
        notes[0] - canonicalRootFret,
        notes[notes.length - 1] - canonicalRootFret,
      ]);
    }
  }

  return { anchorString: config.rootStringFocus, perString };
}

function getDerivedTemplates(
  scaleName: string,
): Record<CagedShape, ShapeTemplate> | null {
  const cached = derivedTemplateCache.get(scaleName);
  if (cached) return cached;

  const templates: Partial<Record<CagedShape, ShapeTemplate>> = {};
  for (const shape of CAGED_SHAPES) {
    const template = deriveTemplate(scaleName, shape);
    if (!template) return null;
    templates[shape] = template;
  }
  const result = templates as Record<CagedShape, ShapeTemplate>;
  derivedTemplateCache.set(scaleName, result);
  return result;
}

export function get7NoteTemplate(
  scaleName: string,
): Record<CagedShape, ShapeTemplate> | null {
  return HAND_TUNED_TEMPLATES[scaleName] ?? getDerivedTemplates(scaleName);
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

/**
 * Whether to anchor a scale's CAGED templates on its relative-minor root.
 * Only applies to scales whose templates were authored against the relative
 * minor — i.e. modes of the major scale family with a major 3rd. Scales from
 * other families (harmonic/melodic minor) anchor on their own root, even
 * when their intervals contain a major 3rd.
 */
const RELATIVE_MINOR_REMAP_SCALES = new Set([
  'Major', 'Lydian', 'Mixolydian',
]);

export function shouldUseRelativeMinorAnchor(scaleName: string): boolean {
  return RELATIVE_MINOR_REMAP_SCALES.has(scaleName);
}

export function getRelativeMinorRoot(majorRoot: string): string {
  const idx = NOTES.indexOf(majorRoot);
  return NOTES[(idx + 9) % 12];
}
