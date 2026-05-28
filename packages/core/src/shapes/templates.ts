import { SCALES, NOTES, getScaleNotes } from "../theory";
import { getFretboardNotes, STANDARD_TUNING } from "../guitar";
import { MAX_FRET } from "../constants";
import { deduplicateAdjacentStrings } from "./helpers";

/** Mode names for degrees of the major scale (Ionian through Locrian). */
export const MAJOR_MODE_NAMES = [
  'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian',
];

/** Mode offset from parent major scale. */
export const MODE_OFFSETS: Record<string, number> = {
  'major': 0, 'dorian': 1, 'phrygian': 2, 'lydian': 3,
  'mixolydian': 4, 'minor': 5, 'locrian': 6,
};

export type CagedShape = "C" | "A" | "G" | "E" | "D";
export const CAGED_SHAPES: CagedShape[] = ["C", "A", "G", "E", "D"];

export type FullChordQuality =
  | "M" | "m" | "7"
  | "maj7" | "m7"
  | "sus2" | "sus4"
  | "dim" | "dim7" | "m7b5";

export interface FullChordTemplate {
  shape: CagedShape;
  quality: FullChordQuality;
  anchorString: number;
  anchorFretOffset: number;
  fretsHighToLow: Array<number | null>;
}

export const FULL_CHORD_TEMPLATES: FullChordTemplate[] = [
  { shape: "C", quality: "M", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [0, 1, 0, 2, 3, null] },
  { shape: "A", quality: "M", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 2, 2, 2, 0, null] },
  { shape: "G", quality: "M", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 0, 0, 0, 2, 3] },
  { shape: "E", quality: "M", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 1, 2, 2, 0] },
  { shape: "D", quality: "M", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [2, 3, 2, 0, null, null] },
  { shape: "C", quality: "m", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [null, 1, 0, 1, 3, null] },
  { shape: "A", quality: "m", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 1, 2, 2, 0, null] },
  { shape: "G", quality: "m", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 3, 0, 0, 1, 3] },
  { shape: "E", quality: "m", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 0, 2, 2, 0] },
  { shape: "D", quality: "m", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [1, 3, 2, 0, null, null] },
  { shape: "C", quality: "7", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [0, 1, 3, 2, 3, null] },
  { shape: "A", quality: "7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 2, 0, 2, 0, null] },
  { shape: "G", quality: "7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [1, 0, 0, 0, 2, 3] },
  { shape: "E", quality: "7", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 1, 0, 2, 0] },
  // D-shape 7 omitted — pitch-and-position identical to a generated close voicing.
  // The fallbackVoicingMatchesAtom fills this position at runtime.
  { shape: "C", quality: "maj7", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [0, 0, 0, 2, 3, null] },
  { shape: "A", quality: "maj7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 2, 1, 2, 0, null] },
  { shape: "G", quality: "maj7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [2, 0, 0, 0, 2, 3] },
  { shape: "E", quality: "maj7", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 1, 1, 2, 0] },
  // D-shape maj7 omitted — pitch-and-position identical to a generated close voicing.
  // m7 voicings — each hand-tuned to be geometrically distinct from the others
  // under root-transposition (the resolver dedupes by sorted position keys, so
  // two templates that collapse to the same physical voicing for a target root
  // would lose one to dedup).
  { shape: "C", quality: "m7", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [3, 1, 3, 1, 3, null] },
  { shape: "A", quality: "m7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 1, 0, 2, 0, null] },
  { shape: "G", quality: "m7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [1, 3, 0, 0, 1, 3] },
  { shape: "E", quality: "m7", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 0, 0, 2, 0] },
  // D-shape m7 omitted — pitch-and-position identical to a generated close voicing.
  // sus2 voicings — each anchored at its canonical root with at least 4 string
  // positions (resolver's minimum), all duplicating one chord tone since
  // sus2 only has 3 distinct pitch classes (root, 2nd, 5th).
  { shape: "C", quality: "sus2", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [3, 3, 0, 0, 3, null] },
  { shape: "A", quality: "sus2", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 0, 2, 2, 0, null] },
  { shape: "G", quality: "sus2", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 3, 0, 0, 0, 3] },
  { shape: "E", quality: "sus2", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 4, 4, 2, 0] },
  { shape: "D", quality: "sus2", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [0, 3, 2, 0, null, null] },
  // sus4 voicings — canonical open-position fingerings, root + perfect 4th + 5th.
  { shape: "C", quality: "sus4", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [1, 1, 0, 3, 3, null] },
  { shape: "A", quality: "sus4", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 3, 2, 2, 0, null] },
  { shape: "G", quality: "sus4", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 1, 0, 0, 3, 3] },
  { shape: "E", quality: "sus4", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 2, 2, 2, 0] },
  { shape: "D", quality: "sus4", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [3, 3, 2, 0, null, null] },
  // dim (triad: root, m3, dim5) — only 3 chord tones so every voicing duplicates
  // one. Each shape hand-tuned to avoid collisions under transposition. C-shape
  // and G-shape templates intentionally omitted. Both were round-1 dedup-breaker
  // hacks (high-E note added solely to differentiate from A-shape / E-shape
  // respectively). Without the cosmetic notes they collapse below the 4-note
  // threshold and never register; A-shape and E-shape cover the lower-neck and
  // upper-neck dim voicings respectively.
  { shape: "A", quality: "dim", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [null, 1, 2, 1, 0, null] },
  { shape: "E", quality: "dim", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [null, null, 0, 2, 1, 0] },
  { shape: "D", quality: "dim", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [1, 3, 1, 0, null, null] },
  // dim7 — symmetric every 3 frets (the same voicing repeats); CAGED labels
  // are conventional rather than geometrically forced. Only E-shape remains;
  // C, A, G, D shapes are pitch-and-position identical to generated close voicings.
  // The fallbackVoicingMatchesAtom fills those positions at runtime.
  { shape: "E", quality: "dim7", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 2, 0, 2, 1, 0] },
  // m7b5 (half-diminished: root, m3, dim5, m7).
  // m7b5: G-shape omitted — the only viable fingering spans non-adjacent
  // strings (high-E + G-string + A-string + low-E with B-string and D-string
  // muted in between), which is impractical to fret cleanly. C-shape,
  // A-shape, E-shape, and D-shape cover the remaining fret-range needs.
  { shape: "C", quality: "m7b5", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [2, 4, 3, 4, 3, null] },
  // A-shape m7b5 omitted — pitch-and-position identical to a generated close voicing.
  { shape: "E", quality: "m7b5", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 3, 0, 2, 1, 0] },
  // D-shape m7b5 omitted — pitch-and-position identical to a generated close voicing.
];

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
 *
 * Each template's `perString` array contains `[leftOffset, rightOffset]` tuples,
 * one per string (0–5, high to low). Offsets are relative to the shape's root fret
 * on the anchor string. Negative offsets = frets below the root, positive = above.
 * These values are hand-tuned per CAGED shape to enclose exactly the notes that
 * belong to that position without extending beyond the shape's natural boundaries.
 */
const SHAPE_TEMPLATES_7NOTE: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-3,0],[-3,0],[-2,0],[-2,1]] },
  A: { anchorString: 4, perString: [[0,3],[0,3],[0,2],[0,3],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-2,0],[-2,1],[-3,0],[-3,0],[-3,0],[-2,0]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[-1,2],[0,2],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[0,3],[1,3],[0,3],[0,3],[0,3],[0,3]] },
};

/**
 * Dorian mode templates. Per-string offsets follow the same convention as
 * SHAPE_TEMPLATES_7NOTE: [leftOffset, rightOffset] relative to the anchor root,
 * hand-tuned to fit the unique note distribution of Dorian.
 */
const SHAPE_TEMPLATES_DORIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,0],[-2,1],[-3,0],[-3,0],[-3,0],[-2,0]] },
  A: { anchorString: 4, perString: [[0,3],[0,3],[-1,2],[0,2],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-3,0],[-2,0],[-3,0],[-3,0],[-3,0],[-3,0]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[-1,2],[-1,2],[0,2],[0,3]] },
  D: { anchorString: 3, perString: [[0,3],[0,3],[0,4],[0,3],[0,3],[0,3]] },
};

/**
 * Phrygian mode templates. Per-string offsets tuned to accommodate Phrygian's
 * characteristic flat-2 and flat-3 intervals relative to the root.
 */
const SHAPE_TEMPLATES_PHRYGIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-3,0],[-2,0],[-2,1],[-2,1]] },
  A: { anchorString: 4, perString: [[0,3],[-1,3],[0,3],[0,3],[0,3],[0,3]] },
  G: { anchorString: 5, perString: [[-2,1],[-2,1],[-3,0],[-3,0],[-2,0],[-2,1]] },
  E: { anchorString: 5, perString: [[0,3],[0,3],[0,2],[0,3],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[1,3],[1,4],[0,3],[0,3],[0,3],[1,3]] },
};

/**
 * Locrian mode templates. Per-string offsets tuned for Locrian's flat-2,
 * flat-3, flat-5, and flat-7 intervals.
 */
const SHAPE_TEMPLATES_LOCRIAN: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-2,1],[-2,0],[-2,1],[-2,1],[-2,1]] },
  A: { anchorString: 4, perString: [[-1,3],[-1,3],[0,3],[0,3],[0,3],[-1,3]] },
  G: { anchorString: 5, perString: [[-2,1],[-2,1],[-3,0],[-2,0],[-2,1],[-2,1]] },
  E: { anchorString: 5, perString: [[0,3],[1,3],[0,3],[0,3],[0,3],[0,3]] },
  D: { anchorString: 3, perString: [[1,4],[1,4],[0,3],[0,3],[1,3],[1,4]] },
};

/**
 * Harmonic Minor templates. Per-string offsets tuned for Harmonic Minor's
 * raised-7th (natural 7) compared to Natural Minor, which affects the note layout.
 */
const SHAPE_TEMPLATES_HARMONIC_MINOR: Record<CagedShape, ShapeTemplate> = {
  C: { anchorString: 4, perString: [[-2,1],[-3,1],[-3,1],[-3,0],[-1,0],[-2,1]] },
  A: { anchorString: 4, perString: [[0,1],[0,3],[1,2],[0,3],[-1,3],[0,1]] },
  G: { anchorString: 5, perString: [[-1,0],[-2,1],[-3,0],[-3,1],[-3,0],[-1,0]] },
  E: { anchorString: 5, perString: [[-1,3],[0,1],[-1,2],[1,2],[0,3],[-1,3]] },
  D: { anchorString: 3, perString: [[0,3],[2,3],[0,3],[0,3],[0,4],[0,3]] },
};

const HAND_TUNED_TEMPLATES: Record<string, Record<CagedShape, ShapeTemplate>> = {
  'major':          SHAPE_TEMPLATES_7NOTE,
  'minor':  SHAPE_TEMPLATES_7NOTE,
  'dorian':         SHAPE_TEMPLATES_DORIAN,
  'phrygian':       SHAPE_TEMPLATES_PHRYGIAN,
  'locrian':        SHAPE_TEMPLATES_LOCRIAN,
  'harmonic minor': SHAPE_TEMPLATES_HARMONIC_MINOR,
  'mixolydian':     SHAPE_TEMPLATES_PHRYGIAN,
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

  // Apply adjacent-string deduplication to match runtime dot rendering, so
  // derived polygons hug the actually-visible notes per string. Without this
  // the polygon overshoots strings where dedup removed an outer note.
  deduplicateAdjacentStrings(perStringNotes, layout, null);

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

/**
 * Pentatonic shape templates. Per-string offsets tuned for 5-note pentatonic scales.
 * Same [leftOffset, rightOffset] convention as 7-note templates, hand-tuned to fit
 * the sparser note distribution of pentatonic positions.
 */
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

/**
 * Configuration for each CAGED shape's fret range and per-string limits.
 * - `rootStringFocus`: The string index where the root note is typically played (0–5, high to low).
 * - `fretOffsetMin/Max`: The fret range scanned relative to the root fret (e.g., -3 to 1 means
 *   from 3 frets below the root to 1 fret above). These define the span of notes visible
 *   in the shape for dynamic polygon generation.
 * - `maxNotesPerString`: Optional per-string caps (e.g., G shape limits string 2 to 2 notes
 *   to avoid overshooting the adjacent-string deduplication). Most strings have no cap.
 */
export interface ShapeConfig {
  rootStringFocus: number;
  fretOffsetMin: number;
  fretOffsetMax: number;
  maxNotesPerString?: Partial<Record<number, number>>;
}

/**
 * Configuration for each CAGED shape's fret range and root string focus.
 * Used by deriveTemplate() to scan and extract per-string note ranges,
 * and by the renderer to select which string a chord's root visually anchors to.
 *
 * Examples:
 * - C: root on string 4 (A string), scans from -3 to +1 relative to root
 * - E: root on string 5 (low E), scans from -1 to +3 relative to root
 */
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
  'major', 'lydian', 'mixolydian', 'major pentatonic', 'major blues',
]);

export function shouldUseRelativeMinorAnchor(scaleName: string): boolean {
  return RELATIVE_MINOR_REMAP_SCALES.has(scaleName);
}

export function getRelativeMinorRoot(majorRoot: string): string {
  const idx = NOTES.indexOf(majorRoot);
  return NOTES[(idx + 9) % 12];
}
