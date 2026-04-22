import { getScaleNotes } from "../core/theory";
import { getFretboardNotes } from "../core/guitar";
import type { ShapeResult } from "./polygons";

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

  const degreeIdx = (position - 1) % scaleNotes.length;
  const cycleIdx = Math.floor((position - 1) / scaleNotes.length);
  const startNote = scaleNotes[degreeIdx];
  const startString = tuning.length - 1;

  // Find the cycleIdx-th occurrence of startNote on the lowest string so that
  // higher positions land in the correct octave rather than wrapping back to
  // the lowest available fret.
  let currentFretFocus = -1;
  let searchFrom = 0;
  for (let i = 0; i <= cycleIdx; i++) {
    const idx = layout[startString].indexOf(startNote, searchFrom);
    if (idx === -1) break;
    currentFretFocus = idx;
    searchFrom = idx + 1;
  }

  if (currentFretFocus === -1) return { coordinates: [], bounds: [], polygons: [], wrappedNotes: new Set() };

  const coords: string[] = [];
  let scaleIndex = degreeIdx;
  let aggregateMinFret = 99;
  let aggregateMaxFret = -1;
  let localFocus = currentFretFocus;

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

  const bounds =
    coords.length > 0
      ? [{ minFret: aggregateMinFret, maxFret: aggregateMaxFret }]
      : [];

  return {
    coordinates: coords,
    bounds,
    polygons: [],
    wrappedNotes: new Set(),
  };
}
