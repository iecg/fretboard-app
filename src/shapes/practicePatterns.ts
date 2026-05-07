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

/**
 * Scale-degree distance targets for the four 2-Strings interval types:
 *   Off (0) → 3rds (2) → 4ths (3) → 6ths (5)
 *
 * Index 0 = Off (unused, interval=0 early-exits), index 1..3 = 3rds/4ths/6ths.
 *
 * Scale-degree distance = number of scale steps between two notes (modular).
 *   3rds → SD distance 2 (catches both m3 and M3 in diatonic/pentatonic/blues)
 *   4ths → SD distance 3 (catches P4 and Aug4 as a bonus in Lydian)
 *   6ths → SD distance 5 (catches both m6 and M6)
 */
const TWO_STRINGS_INTERVAL_SD_DISTANCES = [2, 3, 5] as const;

export { TWO_STRINGS_INTERVAL_SD_DISTANCES };

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
 * Returns all scale-note coordinates on two strings specified by tuple.
 *
 * @param stringTuple  [stringA, stringB] — the two string indices to use.
 *                     Both must be in [0, tuning.length - 1]. Out-of-range → [].
 */
export function getTwoStringsCoordinates(
  rootNote: string,
  scaleName: string,
  tuning: string[],
  frets: number,
  stringTuple: readonly [number, number],
): string[] {
  const [sA, sB] = stringTuple;
  if (sA < 0 || sA >= tuning.length || sB < 0 || sB >= tuning.length) return [];
  const board = getFretboardNotes(tuning, frets);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  return [
    ...getScaleCoordinatesOnString(sA, board, scaleNoteSet),
    ...getScaleCoordinatesOnString(sB, board, scaleNoteSet),
  ];
}

/**
 * Returns interval pairs on two strings where the scale-degree distance between
 * the pair members equals `targetSdDistance`.
 *
 * Uses **scale-degree distance** (not raw semitones) so both minor and major
 * variants of an interval are captured:
 *   - 3rds (SD distance 2) catches m3 and M3
 *   - 4ths (SD distance 3) catches P4 (and Aug4 in Lydian)
 *   - 6ths (SD distance 5) catches m6 and M6
 *
 * The pair is directional: the higher-pitched string member (lower string index)
 * must be above the lower-pitched string member in absolute pitch.
 *
 * Tuning is ordered high-string-first (index 0 = highest pitch). Therefore:
 *   - stringTuple[0] → higher-pitched string (rowA)
 *   - stringTuple[1] → lower-pitched string  (rowB)
 *   - accepted when: absolutePitch(rowA, fretA) > absolutePitch(rowB, fretB)
 *                    AND sdDistance(noteA, noteB, scaleLen) === targetSdDistance
 *
 * @param stringTuple       [stringA, stringB] — must match string indices in board and tuning.
 * @param board             Full fretboard note matrix from getFretboardNotes().
 * @param scaleNoteSet      Set of note names in the active scale.
 * @param scaleSemitones    Semitone offsets (0-11) of all scale tones relative to root.
 *                          Used to compute scale-degree positions.
 * @param targetSdDistance  SD distance to match (e.g. 2 for 3rds, 3 for 4ths, 5 for 6ths).
 * @param tuning            Open-string notes with octave (e.g. ["E4","B3","G3","D3","A2","E2"]).
 * @returns                 Array of { a, b } pairs where a is on stringTuple[0], b on stringTuple[1].
 *                          Each pair member is a "string-fret" coordinate string.
 */
export function getTwoStringsIntervalPairs(
  stringTuple: readonly [number, number],
  board: string[][],
  scaleNoteSet: Set<string>,
  scaleSemitones: ReadonlyArray<number>,
  targetSdDistance: number,
  tuning: string[],
): Array<{ a: string; b: string }> {
  const [sA, sB] = stringTuple;
  if (sA < 0 || sA >= board.length || sB < 0 || sB >= board.length) return [];
  const rowA = board[sA];
  const rowB = board[sB];
  if (!rowA || !rowB) return [];
  const openA = tuning[sA];
  const openB = tuning[sB];
  if (!openA || !openB) return [];

  // Build sorted scale-degree lookup: index in the sorted array = scale-degree position (0-based).
  const scaleDegreesSorted = [...scaleSemitones].sort((a, b) => a - b);
  const scaleLen = scaleDegreesSorted.length;

  function noteToSD(noteSemitone: number): number {
    const norm = ((noteSemitone % 12) + 12) % 12;
    return scaleDegreesSorted.indexOf(norm);
  }

  /**
   * Ascending SD distance from lower (sdB) to upper (sdA).
   * This is the "interval number minus one": 3rd = 2, 4th = 3, 6th = 5.
   * Since pitchA > pitchB we know noteA is above noteB; count scale steps going up
   * from sdB to sdA (wrapping around the octave if needed).
   */
  function ascendingSdDist(sdLow: number, sdHigh: number): number {
    if (sdLow === -1 || sdHigh === -1) return -1;
    // Steps going up from sdLow to sdHigh (wrapping at scaleLen)
    return (sdHigh - sdLow + scaleLen) % scaleLen;
  }

  const pairs: Array<{ a: string; b: string }> = [];

  for (let fretA = 0; fretA < rowA.length; fretA++) {
    const noteA = rowA[fretA];
    if (!noteA || !scaleNoteSet.has(noteA)) continue;
    const pitchA = absolutePitch(openA, fretA);
    const noteAIdx = NOTES.indexOf(noteA);
    if (noteAIdx === -1) continue;
    const sdA = noteToSD(noteAIdx);
    if (sdA === -1) continue;

    for (let fretB = 0; fretB < rowB.length; fretB++) {
      const noteB = rowB[fretB];
      if (!noteB || !scaleNoteSet.has(noteB)) continue;
      const pitchB = absolutePitch(openB, fretB);
      // Directional: higher string (sA, lower index) must have higher absolute pitch.
      if (pitchA <= pitchB) continue;
      const noteBIdx = NOTES.indexOf(noteB);
      if (noteBIdx === -1) continue;
      const sdB = noteToSD(noteBIdx);
      if (sdB === -1) continue;
      // Count ascending scale steps from sdB (lower pitch) to sdA (higher pitch).
      if (ascendingSdDist(sdB, sdA) === targetSdDistance) {
        pairs.push({ a: `${sA}-${fretA}`, b: `${sB}-${fretB}` });
      }
    }
  }
  return pairs;
}

