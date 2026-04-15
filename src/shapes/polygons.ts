import { getScaleNotes, SCALES, NOTES, getNoteDisplay } from "../theory";
import { getFretboardNotes } from "../guitar";
import {
  CAGED_SHAPE_COLORS,
  SHAPE_CONFIGS,
  SHAPE_TEMPLATES_PENT,
  MAJOR_TO_MINOR_SHAPE,
  MAJOR_MODE_NAMES,
  MODE_OFFSETS,
  isMajorScale,
  getRelativeMinorRoot,
  get7NoteTemplate,
} from "./templates";
import type { CagedShape } from "./templates";
import {
  deduplicateAdjacentStrings,
  wrapOvershootNotes,
  buildPolygonFromNotes,
  isShapeTruncated,
} from "./helpers";
import type { ShapeVertex } from "./helpers";

// Re-export helpers so consumers can import from "../shapes/polygons"
export type { ShapeVertex } from "./helpers";
export { MAX_WRAP_OVERSHOOT } from "./helpers";
export {
  deduplicateAdjacentStrings,
  wrapOvershootNotes,
  buildPolygonFromNotes,
  isShapeTruncated,
} from "./helpers";

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
  const sevenNoteTemplate =
    !usePentTemplate && scaleIntervals?.length === 7
      ? get7NoteTemplate(scaleName)
      : null;
  const use7NoteTemplate = sevenNoteTemplate !== null;

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
    let polygonWrappedNotes = shapeWrapped;
    // If more than 2 notes were relocated by wrapping, the overall shape becomes
    // unrecognizable — revert to the pre-wrap note set entirely.
    // (MAX_WRAP_OVERSHOOT caps the fret overshoot per direction; this caps the total note count.)
    if (shapeWrapped.size > 2) {
      for (let s = 0; s < perStringNotes.length; s++) {
        perStringNotes[s] = preWrapNotes[s];
      }
      polygonWrappedNotes = new Set();
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
      const template = sevenNoteTemplate[effectiveShape];
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
      const vertices = buildPolygonFromNotes(
        perStringNotes,
        tuning.length,
        polygonWrappedNotes,
      );
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
