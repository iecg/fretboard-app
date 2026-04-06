import { getScaleNotes } from "./theory";
import { getFretboardNotes } from "./guitar";

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

/** A single cell's background color info for gradient-aware rendering. */
export interface CellColor {
  color: string;
  isLeftEdge: boolean;
  isRightEdge: boolean;
  /** When two shapes share a cell: left-half uses this color, right-half uses `color`. */
  splitColor?: string;
}

export interface ShapeResult {
  coordinates: string[];
  bounds: { minFret: number; maxFret: number }[];
  cellColorMap?: Record<string, CellColor>;
}

/**
 * Procedurally computes CAGED shape coordinates (for chords/arpeggios or scales).
 * It locates the shape boxes on the neck, replicating at octave intervals (+12 frets).
 */
export function getCagedCoordinates(
  rootNote: string,
  shape: CagedShape,
  scaleName: string,
  tuning: string[],
  frets: number,
): ShapeResult {
  const validNotes = getScaleNotes(rootNote, scaleName);
  const layout = getFretboardNotes(tuning, frets);

  let rootStringFocus = 5;
  let fretOffsetMin = 0;
  let fretOffsetMax = 0;

  switch (shape) {
    case "C":
      rootStringFocus = 4;
      fretOffsetMin = -3;
      fretOffsetMax = 1;
      break;
    case "A":
      rootStringFocus = 4;
      fretOffsetMin = -1;
      fretOffsetMax = 3;
      break;
    case "G":
      rootStringFocus = 5;
      fretOffsetMin = -3;
      fretOffsetMax = 1;
      break;
    case "E":
      rootStringFocus = 5;
      fretOffsetMin = -1;
      fretOffsetMax = 3;
      break;
    case "D":
      rootStringFocus = 3;
      fretOffsetMin = 0;
      fretOffsetMax = 4;
      break;
  }

  // Find all instances of root on the target string up to the max frets
  const rootFrets: number[] = [];
  let searchFret = 0;
  while (searchFret <= frets) {
    const rf = layout[rootStringFocus].indexOf(rootNote, searchFret);
    if (rf === -1) break;
    if (rf + fretOffsetMin >= 0) {
      rootFrets.push(rf);
    }
    searchFret = rf + 1;
  }

  const coordinates: Set<string> = new Set();
  const bounds: { minFret: number; maxFret: number }[] = [];

  for (const rootFret of rootFrets) {
    const minFret = Math.max(0, rootFret + fretOffsetMin);
    const maxFret = Math.min(frets, rootFret + fretOffsetMax);

    bounds.push({ minFret, maxFret });

    for (let s = 0; s < tuning.length; s++) {
      for (let f = minFret; f <= maxFret; f++) {
        const noteAtPos = layout[s][f];
        if (validNotes.includes(noteAtPos)) {
          coordinates.add(`${s}-${f}`);
        }
      }
    }
    // Anchor the root note even if it's not technically in the scale (safety)
    coordinates.add(`${rootStringFocus}-${rootFret}`);
  }

  const cellColorMap: Record<string, CellColor> = {};
  const color = CAGED_SHAPE_COLORS[shape].bg;

  for (const rootFret of rootFrets) {
    const minFret = Math.max(0, rootFret + fretOffsetMin);
    const maxFret = Math.min(frets, rootFret + fretOffsetMax);

    for (let s = 0; s < tuning.length; s++) {
      let stringMin = maxFret + 1;
      let stringMax = minFret - 1;
      for (let f = minFret; f <= maxFret; f++) {
        if (validNotes.includes(layout[s][f])) {
          stringMin = Math.min(stringMin, f);
          stringMax = Math.max(stringMax, f);
        }
      }
      if (stringMin <= stringMax) {
        for (let f = stringMin; f <= stringMax; f++) {
          cellColorMap[`${s}-${f}`] = {
            color,
            isLeftEdge: f === stringMin,
            isRightEdge: f === stringMax,
          };
        }
      }
    }
  }

  return {
    coordinates: Array.from(coordinates),
    bounds,
    cellColorMap,
  };
}

/**
 * Procedurally computes 3 Notes Per String (3NPS) scale patterns dynamically.
 * Starts from the requested position (scale degree 1-7), mapping exactly 3 adjacent
 * scale notes per string moving strictly vertically.
 */
export function get3NPSCoordinates(
  rootNote: string,
  scalePattern: string,
  tuning: string[],
  frets: number,
  position: number,
): ShapeResult {
  const scaleNotes = getScaleNotes(rootNote, scalePattern);
  if (scaleNotes.length === 0) return { coordinates: [], bounds: [] };

  const layout = getFretboardNotes(tuning, frets);

  // Starting note for the chosen position
  const startNote = scaleNotes[(position - 1) % scaleNotes.length];

  // Start on lowest string
  const startString = tuning.length - 1;
  let currentFretFocus = layout[startString].indexOf(startNote);
  if (currentFretFocus === -1) {
    currentFretFocus = layout[startString].indexOf(startNote, 1);
  }

  if (currentFretFocus === -1) return { coordinates: [], bounds: [] };

  const boundingBoxes: { minFret: number; maxFret: number }[] = [];
  const allCoords = [];

  // Replicate across 12-fret boundaries just like CAGED
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
      // Update logic to track diagonal movement slightly, pulling towards the top strings
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
  };
}
