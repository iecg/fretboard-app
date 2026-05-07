/**
 * practicePatterns.ts
 *
 * Pure-function coordinate selectors for practice fingering patterns.
 * Each function takes scale/tuning inputs and pattern-specific parameters and
 * returns string[] of "string-fret" coordinate pairs (e.g. "0-3").
 *
 * No Jotai, no atoms, no side effects — these are plain computation functions.
 */

import { getFretboardNotes } from "../core/guitar";
import { getScaleNotes } from "../core/theory";

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns all "string-fret" coordinates where the note at [stringIdx][fret]
 * is in scaleNoteSet, optionally restricted to [fretMin, fretMax].
 */
function getScaleCoordinatesOnString(
  stringIdx: number,
  board: string[][],
  scaleNoteSet: Set<string>,
  fretMin = 0,
  fretMax?: number,
): string[] {
  const row = board[stringIdx];
  if (!row) return [];
  const maxFret = fretMax !== undefined ? fretMax : row.length - 1;
  const result: string[] = [];
  for (let fret = fretMin; fret <= maxFret && fret < row.length; fret++) {
    if (scaleNoteSet.has(row[fret])) {
      result.push(`${stringIdx}-${fret}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Returns all scale-note coordinates on a single string.
 *
 * @param stringIndex  0 = high-E (thinnest), 5 = low-E (thickest). Out-of-range → [].
 */
export function getOneStringCoordinates(
  rootNote: string,
  scaleName: string,
  tuning: string[],
  frets: number,
  stringIndex: number,
): string[] {
  if (stringIndex < 0 || stringIndex >= tuning.length) return [];
  const board = getFretboardNotes(tuning, frets);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  return getScaleCoordinatesOnString(stringIndex, board, scaleNoteSet);
}

/**
 * Returns all scale-note coordinates on two adjacent strings.
 *
 * @param pairIndex  0 = strings 0+1, 1 = strings 1+2, ..., 4 = strings 4+5. Out-of-range → [].
 */
export function getTwoStringsCoordinates(
  rootNote: string,
  scaleName: string,
  tuning: string[],
  frets: number,
  pairIndex: number,
): string[] {
  if (pairIndex < 0 || pairIndex > tuning.length - 2) return [];
  const board = getFretboardNotes(tuning, frets);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  return [
    ...getScaleCoordinatesOnString(pairIndex, board, scaleNoteSet),
    ...getScaleCoordinatesOnString(pairIndex + 1, board, scaleNoteSet),
  ];
}

