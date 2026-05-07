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
// 2-Strings interval pairing
//
// Inspired by the Fret Science framework for decomposing pentatonic CAGED shapes
// into repeating geometric units:
//   Article: https://fretscience.com/2022/10/30/the-rectangle-and-the-stack/
//   YouTube: https://www.youtube.com/@FretScience
//
// The interval-pair filter below shows scale-tone double-stops on a single
// adjacent string pair, with chord-connector lines between pair members.
// The full Rectangle + Stack overlay (grouping notes already visible under any
// fingering pattern) is deferred to Phase 5 (Note Grouping).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

/** Semitone targets for the four 2-Strings interval types: 3rds (4 st), 4ths (5 st), 5ths (7 st), 6ths (9 st). */
const TWO_STRINGS_INTERVAL_SEMITONES = [4, 5, 7, 9] as const;

export { TWO_STRINGS_INTERVAL_SEMITONES };

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
 * Returns interval pairs on a single adjacent string pair where the two notes
 * are separated by targetSemitones (bidirectional chromatic distance).
 *
 * @param pairIndex       0 = strings 0+1, …, 4 = strings 4+5. Out-of-range → [].
 * @param board           Full fretboard note matrix from getFretboardNotes().
 * @param scaleNoteSet    Set of note names in the active scale.
 * @param targetSemitones Chromatic interval to match (e.g. 4 for 3rds, 7 for 5ths).
 * @returns               Array of { a, b } pairs where a is on pairIndex and b is on pairIndex+1.
 *                        Each pair member is a "string-fret" coordinate string.
 */
export function getTwoStringsIntervalPairs(
  pairIndex: number,
  board: string[][],
  scaleNoteSet: Set<string>,
  targetSemitones: number,
): Array<{ a: string; b: string }> {
  if (pairIndex < 0 || pairIndex >= board.length - 1) return [];
  const rowA = board[pairIndex];
  const rowB = board[pairIndex + 1];
  if (!rowA || !rowB) return [];
  const pairs: Array<{ a: string; b: string }> = [];
  for (let fretA = 0; fretA < rowA.length; fretA++) {
    const noteA = rowA[fretA];
    if (!noteA || !scaleNoteSet.has(noteA)) continue;
    for (let fretB = 0; fretB < rowB.length; fretB++) {
      const noteB = rowB[fretB];
      if (!noteB || !scaleNoteSet.has(noteB)) continue;
      if (matchesSemitones(noteA, noteB, targetSemitones)) {
        pairs.push({ a: `${pairIndex}-${fretA}`, b: `${pairIndex + 1}-${fretB}` });
      }
    }
  }
  return pairs;
}

