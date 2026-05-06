/**
 * practicePatterns.ts
 *
 * Pure-function coordinate selectors for the six new practice fingering patterns.
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

/** Semitone counts for the four double-stop interval types: 3rds, 4ths, 5ths, 6ths. */
const DOUBLE_STOP_SEMITONES = [4, 5, 7, 9];

/** Chromatic note order used for semitone distance calculation. */
const NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Maps a note name (e.g. "C#") to its 0-11 chromatic index. */
function noteIndex(note: string): number {
  return NOTE_ORDER.indexOf(note);
}

/**
 * Returns true if the two notes are separated by exactly targetSemitones in
 * either direction around the chromatic circle.
 * e.g. targetSemitones=7 (5th) matches both up-a-5th and down-a-5th.
 */
function matchesSemitones(noteA: string, noteB: string, targetSemitones: number): boolean {
  const iA = noteIndex(noteA);
  const iB = noteIndex(noteB);
  if (iA === -1 || iB === -1) return false;
  const up = (iA - iB + 12) % 12;
  const down = (iB - iA + 12) % 12;
  return up === targetSemitones || down === targetSemitones;
}

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

/**
 * Returns coordinate pairs where adjacent-string notes are separated by the
 * chosen interval. Both notes of each pair are included in the result.
 *
 * @param intervalIndex  0=3rds (4 st), 1=4ths (5 st), 2=5ths (7 st), 3=6ths (9 st).
 */
export function getDoubleStopsCoordinates(
  rootNote: string,
  scaleName: string,
  tuning: string[],
  frets: number,
  intervalIndex: number,
): string[] {
  const board = getFretboardNotes(tuning, frets);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const targetSemitones = DOUBLE_STOP_SEMITONES[intervalIndex] ?? 4;
  const resultSet = new Set<string>();

  for (let stringA = 0; stringA < tuning.length - 1; stringA++) {
    const stringB = stringA + 1;
    const rowA = board[stringA];
    const rowB = board[stringB];
    if (!rowA || !rowB) continue;

    for (let fretA = 0; fretA < rowA.length; fretA++) {
      const noteA = rowA[fretA];
      if (!scaleNoteSet.has(noteA)) continue;

      for (let fretB = 0; fretB < rowB.length; fretB++) {
        const noteB = rowB[fretB];
        if (!scaleNoteSet.has(noteB)) continue;
        if (matchesSemitones(noteA, noteB, targetSemitones)) {
          resultSet.add(`${stringA}-${fretA}`);
          resultSet.add(`${stringB}-${fretB}`);
        }
      }
    }
  }

  return Array.from(resultSet);
}

/**
 * Returns all scale-note coordinates within a 2-string × 4-fret window.
 *
 * @param startFret  First fret of the window (clamped to avoid over-indexing).
 * @param pairIndex  Which adjacent string pair (0-based). Out-of-range → [].
 */
export function getBox2x4Coordinates(
  rootNote: string,
  scaleName: string,
  tuning: string[],
  frets: number,
  startFret: number,
  pairIndex: number,
): string[] {
  if (pairIndex < 0 || pairIndex > tuning.length - 2) return [];
  const clampedStart = Math.max(0, Math.min(startFret, frets - 3));
  const endFret = clampedStart + 3; // 4 frets inclusive
  const board = getFretboardNotes(tuning, frets);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  return [
    ...getScaleCoordinatesOnString(pairIndex, board, scaleNoteSet, clampedStart, endFret),
    ...getScaleCoordinatesOnString(pairIndex + 1, board, scaleNoteSet, clampedStart, endFret),
  ];
}

/**
 * Returns all scale-note coordinates within a 3-string × 3-fret window.
 *
 * @param startFret  First fret of the window (clamped to avoid over-indexing).
 * @param trioIndex  0=strings 0+1+2, 1=strings 1+2+3, 2=strings 2+3+4, 3=strings 3+4+5. Out-of-range → [].
 */
export function getBox3x3Coordinates(
  rootNote: string,
  scaleName: string,
  tuning: string[],
  frets: number,
  startFret: number,
  trioIndex: number,
): string[] {
  if (trioIndex < 0 || trioIndex > tuning.length - 3) return [];
  const clampedStart = Math.max(0, Math.min(startFret, frets - 2));
  const endFret = clampedStart + 2; // 3 frets inclusive
  const board = getFretboardNotes(tuning, frets);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  return [
    ...getScaleCoordinatesOnString(trioIndex, board, scaleNoteSet, clampedStart, endFret),
    ...getScaleCoordinatesOnString(trioIndex + 1, board, scaleNoteSet, clampedStart, endFret),
    ...getScaleCoordinatesOnString(trioIndex + 2, board, scaleNoteSet, clampedStart, endFret),
  ];
}

/**
 * Returns one scale-note coordinate per string — the note closest to startFret.
 * On ties (equidistant above and below), the lower fret wins.
 * Strings with no scale notes are omitted; result has at most 6 entries.
 */
export function getStackCoordinates(
  rootNote: string,
  scaleName: string,
  tuning: string[],
  frets: number,
  startFret: number,
): string[] {
  const board = getFretboardNotes(tuning, frets);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const result: string[] = [];

  for (let stringIdx = 0; stringIdx < tuning.length; stringIdx++) {
    const row = board[stringIdx];
    if (!row) continue;

    let bestFret = -1;
    let bestDist = Infinity;

    for (let fret = 0; fret < row.length; fret++) {
      if (!scaleNoteSet.has(row[fret])) continue;
      const dist = Math.abs(fret - startFret);
      // Strict less-than: on ties prefer the lower fret (first encountered).
      if (dist < bestDist) {
        bestDist = dist;
        bestFret = fret;
      }
    }

    if (bestFret !== -1) {
      result.push(`${stringIdx}-${bestFret}`);
    }
  }

  return result;
}
