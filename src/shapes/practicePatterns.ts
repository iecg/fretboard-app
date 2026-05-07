/**
 * practicePatterns.ts
 *
 * Pure-function coordinate selectors for practice fingering patterns.
 * Each function takes scale/tuning inputs and pattern-specific parameters and
 * returns string[] of "string-fret" coordinate pairs (e.g. "0-3").
 *
 * No Jotai, no atoms, no side effects — these are plain computation functions.
 */

import { getFretboardNotes, parseNote } from "../core/guitar";
import { NOTES } from "../core/theory";
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

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns the absolute semitone position of a note on a given string and fret.
 * Uses the tuning string (e.g. "E4") to compute octave-aware pitch.
 * Higher value = higher pitch.
 */
function absolutePitch(openStringNote: string, fret: number): number {
  const parsed = parseNote(openStringNote);
  if (!parsed) return -1;
  const noteIdx = NOTES.indexOf(parsed.noteName);
  if (noteIdx === -1) return -1;
  return parsed.octave * 12 + noteIdx + fret;
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
 * Returns interval pairs on a single adjacent string pair where the interval from
 * the lower-pitched string to the higher-pitched string equals targetSemitones exactly.
 *
 * The interval is **directional**: 4ths (5 st) and 5ths (7 st) produce disjoint pair sets.
 * Comparison uses absolute octave-aware pitch, not modular note-class arithmetic.
 *
 * Tuning is ordered high-string-first (index 0 = highest pitch). Therefore:
 *   - string pairIndex     → higher-pitched string (rowA)
 *   - string pairIndex + 1 → lower-pitched string  (rowB)
 *   - accepted when: absolutePitch(rowA, fretA) - absolutePitch(rowB, fretB) === targetSemitones
 *
 * @param pairIndex       0 = strings 0+1, …, 4 = strings 4+5. Out-of-range → [].
 * @param board           Full fretboard note matrix from getFretboardNotes().
 * @param scaleNoteSet    Set of note names in the active scale.
 * @param targetSemitones Chromatic interval to match (e.g. 5 for 4ths, 7 for 5ths).
 * @param tuning          Open-string notes with octave (e.g. ["E4","B3","G3","D3","A2","E2"]).
 *                        Must align with board row indices.
 * @returns               Array of { a, b } pairs where a is on pairIndex and b is on pairIndex+1.
 *                        Each pair member is a "string-fret" coordinate string.
 */
export function getTwoStringsIntervalPairs(
  pairIndex: number,
  board: string[][],
  scaleNoteSet: Set<string>,
  targetSemitones: number,
  tuning: string[],
): Array<{ a: string; b: string }> {
  if (pairIndex < 0 || pairIndex >= board.length - 1) return [];
  const rowA = board[pairIndex];
  const rowB = board[pairIndex + 1];
  if (!rowA || !rowB) return [];
  // pairIndex is the higher-pitched string; pairIndex+1 is lower-pitched.
  const openA = tuning[pairIndex];
  const openB = tuning[pairIndex + 1];
  if (!openA || !openB) return [];
  const pairs: Array<{ a: string; b: string }> = [];
  for (let fretA = 0; fretA < rowA.length; fretA++) {
    const noteA = rowA[fretA];
    if (!noteA || !scaleNoteSet.has(noteA)) continue;
    const pitchA = absolutePitch(openA, fretA);
    for (let fretB = 0; fretB < rowB.length; fretB++) {
      const noteB = rowB[fretB];
      if (!noteB || !scaleNoteSet.has(noteB)) continue;
      const pitchB = absolutePitch(openB, fretB);
      // Accept only when the higher-pitched string is exactly targetSemitones above the lower.
      if (pitchA - pitchB === targetSemitones) {
        pairs.push({ a: `${pairIndex}-${fretA}`, b: `${pairIndex + 1}-${fretB}` });
      }
    }
  }
  return pairs;
}

