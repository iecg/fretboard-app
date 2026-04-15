import { getScaleNotes, SCALES, NOTES, getNoteDisplay } from "./theory";
import { getFretboardNotes } from "./guitar";

/** Mode names for degrees of the major scale (Ionian through Locrian). */
const MAJOR_MODE_NAMES = [
  'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian',
];

/**
 * Mode offset: which degree of the major scale this scale starts on.
 * E.g. Dorian starts on degree 1 (the 2nd note of the parent major scale).
 */
const MODE_OFFSETS: Record<string, number> = {
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

/** A vertex in fret/string coordinates. */
export interface ShapeVertex {
  fret: number;
  string: number;
}

/** A shape polygon ready for rendering — an ordered list of vertices. */
export interface ShapePolygon {
  vertices: ShapeVertex[];
  shape: CagedShape;
  color: string;
  cagedLabel: string;
  modalLabel: string | null;
  /** Whether the shape was truncated by fret boundaries (fret 0 or max fret). */
  truncated: boolean;
  /** Full intended fret range before clamping to fretboard boundaries. Used for label centering. */
  intendedMin: number;
  intendedMax: number;
}

export interface ShapeResult {
  coordinates: string[];
  bounds: { minFret: number; maxFret: number }[];
  polygons: ShapePolygon[];
  wrappedNotes: Set<string>;
}

/**
 * Fixed polygon outline templates for pentatonic/blues CAGED shapes.
 * Each template defines per-string [leftOffset, rightOffset] from anchor fret.
 */
interface ShapeTemplate {
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

/** Select the appropriate fixed template set for a 7-note scale. */
function get7NoteTemplate(scaleName: string): Record<CagedShape, ShapeTemplate> {
  switch (scaleName) {
    case 'Dorian':        return SHAPE_TEMPLATES_DORIAN;
    case 'Phrygian':      return SHAPE_TEMPLATES_PHRYGIAN;
    case 'Locrian':       return SHAPE_TEMPLATES_LOCRIAN;
    case 'Harmonic Minor':return SHAPE_TEMPLATES_HARMONIC_MINOR;
    // Major-quality scales remapped to their relative minor mode:
    case 'Lydian':        return SHAPE_TEMPLATES_DORIAN;     // Lydian → relative Dorian
    case 'Mixolydian':    return SHAPE_TEMPLATES_PHRYGIAN;   // Mixolydian → relative Phrygian
    default:              return SHAPE_TEMPLATES_7NOTE; // Natural Minor + Major (→ Aeolian)
  }
}

const SHAPE_TEMPLATES_PENT: Record<CagedShape, ShapeTemplate> = {
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

interface ShapeConfig {
  rootStringFocus: number;
  fretOffsetMin: number;
  fretOffsetMax: number;
  maxNotesPerString?: Partial<Record<number, number>>;
}

const SHAPE_CONFIGS: Record<CagedShape, ShapeConfig> = {
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
const MAJOR_TO_MINOR_SHAPE: Record<CagedShape, CagedShape> = {
  C: 'A', A: 'G', G: 'E', E: 'D', D: 'C',
};

function isMajorScale(scaleName: string): boolean {
  const intervals = SCALES[scaleName];
  return intervals ? intervals.includes(4) : false;
}

function getRelativeMinorRoot(majorRoot: string): string {
  const idx = NOTES.indexOf(majorRoot);
  return NOTES[(idx + 9) % 12];
}

/**
 * Deduplicate notes across adjacent strings within a shape.
 * When the same note name appears on two adjacent strings, keep the one
 * closest to its neighbors on that string. Blue notes are exempt.
 */
function deduplicateAdjacentStrings(
  perStringNotes: number[][],
  layout: string[][],
  blueNoteName: string | null,
) {
  for (let s = 0; s < perStringNotes.length - 1; s++) {
    const upper = perStringNotes[s];
    const lower = perStringNotes[s + 1];
    if (!upper.length || !lower.length) continue;

    // Build a set of note names on each string for fast lookup
    const upperNotes = new Map<string, number[]>(); // noteName -> [fret indices into upper array]
    for (let i = 0; i < upper.length; i++) {
      const name = layout[s][upper[i]];
      if (!upperNotes.has(name)) upperNotes.set(name, []);
      upperNotes.get(name)!.push(i);
    }

    const toRemoveUpper = new Set<number>();
    const toRemoveLower = new Set<number>();

    for (let j = 0; j < lower.length; j++) {
      const name = layout[s + 1][lower[j]];
      if (name === blueNoteName) continue;
      const upperIndices = upperNotes.get(name);
      if (!upperIndices) continue;

      // This note name exists on both strings — resolve each pair
      for (const i of upperIndices) {
        if (toRemoveUpper.has(i)) continue;

        // Distance to nearest neighbor on upper string
        const upperDist = Math.min(
          i > 0 ? upper[i] - upper[i - 1] : Infinity,
          i < upper.length - 1 ? upper[i + 1] - upper[i] : Infinity,
        );
        // Distance to nearest neighbor on lower string
        const lowerDist = Math.min(
          j > 0 ? lower[j] - lower[j - 1] : Infinity,
          j < lower.length - 1 ? lower[j + 1] - lower[j] : Infinity,
        );

        if (upperDist >= lowerDist) {
          toRemoveUpper.add(i);
        } else {
          toRemoveLower.add(j);
        }
      }
    }

    // Remove marked indices (reverse order to preserve indices)
    if (toRemoveUpper.size > 0) {
      const filtered = upper.filter((_, i) => !toRemoveUpper.has(i));
      perStringNotes[s] = filtered;
    }
    if (toRemoveLower.size > 0) {
      const filtered = lower.filter((_, i) => !toRemoveLower.has(i));
      perStringNotes[s + 1] = filtered;
    }
  }
}

/**
 * Maximum overshoot (in frets) that wrapping will attempt to recover.
 * Shapes near the nut (fret 0) or body end (max fret) may have 1–2 notes that
 * fall just outside the fretboard boundary. Wrapping relocates those notes to
 * an adjacent string so the shape remains playable at the edge.
 * Beyond 2 frets of overshoot the relocated notes are too far from their
 * original position and the result no longer resembles the intended shape.
 */
const MAX_WRAP_OVERSHOOT = 2;

/**
 * Wrap notes that overshoot fretboard edges to adjacent strings.
 * Returns the number of notes that couldn't be wrapped (truly lost) and a Set
 * of coordinate keys ("stringIndex-fretIndex") for every note placed by wrapping.
 * Called after note collection, before deduplication.
 */
function wrapOvershootNotes(
  perStringNotes: number[][],
  layout: string[][],
  validNotes: string[],
  intendedMin: number,
  intendedMax: number,
  shapeMin: number,
  shapeMax: number,
  frets: number,
): { unwrapped: number; wrappedNotes: Set<string> } {
  const numStrings = layout.length;
  const shapeCenter = (shapeMin + shapeMax) / 2;
  let unwrapped = 0;
  const wrappedNotes = new Set<string>();

  // Search margin: allow wrapped notes slightly outside the strict shape range
  const wrapSearchMin = Math.max(0, shapeMin - 2);
  const wrapSearchMax = Math.min(frets, shapeMax + 2);

  // Positive overshoot: wrap to thinner string (s-1)
  // Only check strings that have notes in the shape
  // Skip if overshoot exceeds MAX_WRAP_OVERSHOOT — large overshoots produce unrecognizable shapes
  if (intendedMax > frets && intendedMax - frets <= MAX_WRAP_OVERSHOOT) {
    for (let s = numStrings - 1; s >= 0; s--) {
      if (perStringNotes[s].length === 0) continue; // string not used in shape
      const target = s - 1;
      for (let f = frets + 1; f <= intendedMax; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        if (target < 0) continue; // topmost string — can't wrap further up
        let bestFret = -1;
        let bestDist = Infinity;
        for (let tf = wrapSearchMin; tf <= wrapSearchMax; tf++) {
          if (layout[target][tf] === noteName) {
            const dist = Math.abs(tf - shapeCenter);
            if (dist < bestDist) {
              bestDist = dist;
              bestFret = tf;
            }
          }
        }
        if (bestFret >= 0) {
          perStringNotes[target].push(bestFret);
          wrappedNotes.add(`${target}-${bestFret}`);
        } else {
          unwrapped++;
        }
      }
    }
  }

  // Negative overshoot: wrap to thicker string (s+1)
  // Skip if overshoot exceeds MAX_WRAP_OVERSHOOT — large overshoots produce unrecognizable shapes
  if (intendedMin < 0 && -intendedMin <= MAX_WRAP_OVERSHOOT) {
    for (let s = 0; s < numStrings; s++) {
      if (perStringNotes[s].length === 0) continue; // string not used in shape
      const target = s + 1;
      for (let f = intendedMin; f < 0; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        if (target >= numStrings) continue; // bottommost string — can't wrap further down
        let bestFret = -1;
        let bestDist = Infinity;
        for (let tf = wrapSearchMin; tf <= wrapSearchMax; tf++) {
          if (layout[target][tf] === noteName) {
            const dist = Math.abs(tf - shapeCenter);
            if (dist < bestDist) {
              bestDist = dist;
              bestFret = tf;
            }
          }
        }
        if (bestFret >= 0) {
          perStringNotes[target].push(bestFret);
          wrappedNotes.add(`${target}-${bestFret}`);
        } else {
          unwrapped++;
        }
      }
    }
  }

  // Sort and deduplicate each string
  for (let s = 0; s < numStrings; s++) {
    perStringNotes[s] = [...new Set(perStringNotes[s])].sort((a, b) => a - b);
  }

  return { unwrapped, wrappedNotes };
}

/**
 * Build polygon vertices from per-string note boundaries.
 * Left edge top→bottom, right edge bottom→top.
 * Wrapped notes are excluded from edge vertex selection so the polygon
 * reflects the core shape position without extension at fret boundaries.
 */
function buildPolygonFromNotes(
  perStringNotes: number[][],
  numStrings: number,
  wrappedNotes: Set<string> = new Set(),
): ShapeVertex[] {
  const leftEdge: ShapeVertex[] = [];
  const rightEdge: ShapeVertex[] = [];

  for (let s = 0; s < numStrings; s++) {
    const notes = perStringNotes[s];
    if (notes.length === 0) continue;
    const nonWrapped = notes.filter(f => !wrappedNotes.has(`${s}-${f}`));
    if (nonWrapped.length === 0) continue;
    leftEdge.push({ fret: nonWrapped[0], string: s });
    rightEdge.push({ fret: nonWrapped[nonWrapped.length - 1], string: s });
  }

  return [...leftEdge, ...rightEdge.reverse()];
}

/**
 * Returns true if the fretboard boundary clips more than half the intended fret
 * span, meaning the shape is too incomplete to be useful at this position.
 */
function isShapeTruncated(
  intendedMin: number,
  intendedMax: number,
  shapeMin: number,
  shapeMax: number,
): boolean {
  const intendedSpan = intendedMax - intendedMin;
  const visibleSpan = shapeMax - shapeMin;
  return intendedSpan > 0 && visibleSpan <= intendedSpan / 2;
}

export function getCagedCoordinates(
  rootNote: string,
  shape: CagedShape,
  scaleName: string,
  tuning: string[],
  frets: number,
): ShapeResult {
  const validNotes = getScaleNotes(rootNote, scaleName);
  const layout = getFretboardNotes(tuning, frets);

  const useMajorRemap = isMajorScale(scaleName);
  const effectiveShape = useMajorRemap ? MAJOR_TO_MINOR_SHAPE[shape] : shape;
  const anchorNote = useMajorRemap ? getRelativeMinorRoot(rootNote) : rootNote;

  const { rootStringFocus, fretOffsetMin, fretOffsetMax, maxNotesPerString = {} } =
    SHAPE_CONFIGS[effectiveShape];

  // Find all instances of anchor note on the target string
  const rootFrets: number[] = [];
  let searchFret = 0;
  while (searchFret <= frets) {
    const rf = layout[rootStringFocus].indexOf(anchorNote, searchFret);
    if (rf === -1) break;
    rootFrets.push(rf);
    searchFret = rf + 1;
  }

  const coordinates: Set<string> = new Set();
  const bounds: { minFret: number; maxFret: number }[] = [];
  const allWrappedNotes = new Set<string>();

  // Determine blue note (exempt from dedup) for blues scales
  const blueNoteIntervals: Record<string, number> = { 'Minor Blues': 6, 'Major Blues': 3 };
  const blueInterval = blueNoteIntervals[scaleName];
  const blueNoteName = blueInterval != null
    ? NOTES[(NOTES.indexOf(rootNote) + blueInterval) % 12]
    : null;

  // Determine template strategy
  const scaleIntervals = SCALES[scaleName];
  const isBlues = scaleName.includes('Blues');
  const usePentTemplate = isBlues || (scaleIntervals && scaleIntervals.length <= 5);
  const use7NoteTemplate = !usePentTemplate && (scaleIntervals?.length === 7);

  const color = CAGED_SHAPE_COLORS[shape].bg;
  const polygons: ShapePolygon[] = [];

  for (const rootFret of rootFrets) {
    const intendedMin = rootFret + fretOffsetMin;
    const intendedMax = rootFret + fretOffsetMax;
    const shapeMin = Math.max(0, intendedMin);
    const shapeMax = Math.min(frets, intendedMax);

    bounds.push({ minFret: shapeMin, maxFret: shapeMax });

    // Collect notes per string
    const perStringNotes: number[][] = [];
    for (let s = 0; s < tuning.length; s++) {
      const stringNotes: number[] = [];
      for (let f = shapeMin; f <= shapeMax; f++) {
        if (validNotes.includes(layout[s][f])) {
          stringNotes.push(f);
        }
      }
      const cap = validNotes.length <= 5 ? maxNotesPerString[s] : undefined;
      perStringNotes.push(cap != null ? stringNotes.slice(0, cap) : stringNotes);
    }

    // Wrap overshoot notes to adjacent strings; returns count of unwrapped notes and Set of wrapped keys.
    // Snapshot state before wrapping so we can revert if too many notes wrap.
    const preWrapNotes = perStringNotes.map(arr => [...arr]);
    const { wrappedNotes: shapeWrapped } = wrapOvershootNotes(
      perStringNotes, layout, validNotes, intendedMin, intendedMax, shapeMin, shapeMax, frets,
    );
    // If more than 2 notes were relocated by wrapping, the overall shape becomes
    // unrecognizable — revert to the pre-wrap note set entirely.
    // (MAX_WRAP_OVERSHOOT caps the fret overshoot per direction; this caps the total note count.)
    if (shapeWrapped.size > 2) {
      for (let s = 0; s < perStringNotes.length; s++) {
        perStringNotes[s] = preWrapNotes[s];
      }
      // shapeWrapped is discarded — do not add to allWrappedNotes
    } else {
      for (const key of shapeWrapped) allWrappedNotes.add(key);
    }

    const truncated = isShapeTruncated(intendedMin, intendedMax, shapeMin, shapeMax);

    // Deduplicate for 7-note scales
    if (validNotes.length > 5) {
      deduplicateAdjacentStrings(perStringNotes, layout, blueNoteName);
    }

    // Add to coordinates
    for (let s = 0; s < tuning.length; s++) {
      for (const f of perStringNotes[s]) {
        coordinates.add(`${s}-${f}`);
      }
    }
    coordinates.add(`${rootStringFocus}-${rootFret}`);

    // Compute labels
    const isMinorQuality = !isMajorScale(scaleName);
    const cagedLabel = `${shape}${isMinorQuality ? 'm' : ''} Shape`;

    let modalLabel: string | null = null;
    const bottomString = tuning.length - 1;
    const bottomNotes = perStringNotes[bottomString];
    if (bottomNotes.length > 0) {
      const startNote = layout[bottomString][bottomNotes[0]];
      const startNoteDisplay = getNoteDisplay(startNote, rootNote);
      const degreeIdx = validNotes.indexOf(startNote);
      const modeOffset = MODE_OFFSETS[scaleName];
      if (degreeIdx >= 0 && modeOffset != null) {
        const absoluteDegree = (degreeIdx + modeOffset) % 7;
        modalLabel = `${startNoteDisplay} ${MAJOR_MODE_NAMES[absoluteDegree]}`;
      }
    }

    // Build polygon
    if (usePentTemplate) {
      // Use fixed pentatonic template
      const template = SHAPE_TEMPLATES_PENT[effectiveShape];
      const leftEdge: ShapeVertex[] = template.perString.map(([l], s) => ({
        fret: rootFret + l,
        string: s,
      }));
      const rightEdge: ShapeVertex[] = template.perString.map(([, r], s) => ({
        fret: rootFret + r,
        string: s,
      })).reverse();

      polygons.push({ vertices: [...leftEdge, ...rightEdge], shape, color, cagedLabel, modalLabel, truncated, intendedMin, intendedMax });
    } else if (use7NoteTemplate) {
      // Use scale-specific fixed 7-note template
      const template = get7NoteTemplate(scaleName)[effectiveShape];
      const leftEdge: ShapeVertex[] = template.perString.map(([l], s) => ({
        fret: rootFret + l,
        string: s,
      }));
      const rightEdge: ShapeVertex[] = template.perString.map(([, r], s) => ({
        fret: rootFret + r,
        string: s,
      })).reverse();

      polygons.push({ vertices: [...leftEdge, ...rightEdge], shape, color, cagedLabel, modalLabel, truncated, intendedMin, intendedMax });
    } else {
      // Dynamic polygon from actual note positions (modes other than Natural Minor)
      const vertices = buildPolygonFromNotes(perStringNotes, tuning.length, allWrappedNotes);
      if (vertices.length > 0) {
        polygons.push({ vertices, shape, color, cagedLabel, modalLabel, truncated, intendedMin, intendedMax });
      }
    }
  }

  return {
    coordinates: Array.from(coordinates),
    bounds,
    polygons,
    wrappedNotes: allWrappedNotes,
  };
}

/**
 * Procedurally computes 3 Notes Per String (3NPS) scale patterns dynamically.
 */
/**
 * Find the main CAGED shape to auto-center.
 * The main shape is the one with the lowest root fret that is "complete"
 * (no wrapped notes, not truncated, and entirely within visible fret range).
 */
export function findMainShape(
  polygons: ShapePolygon[],
  wrappedNotes: Set<string>,
  startFret: number,
  endFret: number,
): ShapePolygon | null {
  // Filter to complete shapes (no wrapped notes, not truncated, fully visible)
  const completeShapes = polygons.filter((poly) => {
    if (poly.truncated) return false;
    // Check if any vertex is a wrapped note
    for (const vert of poly.vertices) {
      if (wrappedNotes.has(`${vert.string}-${vert.fret}`)) {
        return false;
      }
    }
    // Entire shape must be within visible fret range
    if (poly.intendedMin < startFret || poly.intendedMax > endFret) {
      return false;
    }
    return true;
  });

  if (completeShapes.length === 0) return null;

  // Find the shape with the lowest intendedMin (lowest root position)
  return completeShapes.reduce((lowest, current) =>
    current.intendedMin < lowest.intendedMin ? current : lowest
  );
}

/**
 * Calculate the center fret of a shape polygon.
 */
export function getShapeCenterFret(poly: ShapePolygon): number {
  return (poly.intendedMin + poly.intendedMax) / 2;
}

/**
 * Check if any part of a shape is outside the visible fret range.
 */
export function isShapeOutOfView(
  poly: ShapePolygon,
  startFret: number,
  endFret: number,
): boolean {
  // Shape is out of view if any part extends beyond visible range
  const shapeMin = Math.max(0, poly.intendedMin);
  const shapeMax = poly.intendedMax;
  return shapeMin < startFret || shapeMax > endFret;
}

export function get3NPSCoordinates(
  rootNote: string,
  scalePattern: string,
  tuning: string[],
  frets: number,
  position: number,
): ShapeResult {
  const scaleNotes = getScaleNotes(rootNote, scalePattern);
  if (scaleNotes.length === 0) return { coordinates: [], bounds: [], polygons: [], wrappedNotes: new Set() };

  const layout = getFretboardNotes(tuning, frets);

  const startNote = scaleNotes[(position - 1) % scaleNotes.length];
  const startString = tuning.length - 1;
  let currentFretFocus = layout[startString].indexOf(startNote);
  if (currentFretFocus === -1) {
    currentFretFocus = layout[startString].indexOf(startNote, 1);
  }

  if (currentFretFocus === -1) return { coordinates: [], bounds: [], polygons: [], wrappedNotes: new Set() };

  const boundingBoxes: { minFret: number; maxFret: number }[] = [];
  const allCoords = [];

  const focusFrets = [];
  let sFret = currentFretFocus;
  while (sFret <= frets) {
    focusFrets.push(sFret);
    sFret += 12;
  }

  for (const focus of focusFrets) {
    const coords: string[] = [];
    let scaleIndex = scaleNotes.indexOf(startNote);
    let aggregateMinFret = 99;
    let aggregateMaxFret = -1;
    let localFocus = focus;

    for (let s = startString; s >= 0; s--) {
      let notesFound = 0;
      const searchMin = Math.max(0, localFocus - 4);
      const searchMax = Math.min(frets, localFocus + 6);

      let lastFretAdded = -1;

      for (let f = searchMin; f <= searchMax && notesFound < 3; f++) {
        const expectedNote = scaleNotes[scaleIndex % scaleNotes.length];
        if (layout[s][f] === expectedNote) {
          coords.push(`${s}-${f}`);
          notesFound++;
          scaleIndex++;
          aggregateMinFret = Math.min(aggregateMinFret, f);
          aggregateMaxFret = Math.max(aggregateMaxFret, f);
          lastFretAdded = f;
        }
      }
      if (lastFretAdded !== -1) {
        localFocus = lastFretAdded - 1;
      }
    }

    if (coords.length > 0) {
      allCoords.push(...coords);
      boundingBoxes.push({
        minFret: aggregateMinFret,
        maxFret: aggregateMaxFret,
      });
    }
  }

  return {
    coordinates: allCoords,
    bounds: boundingBoxes,
    polygons: [],
    wrappedNotes: new Set(),
  };
}
