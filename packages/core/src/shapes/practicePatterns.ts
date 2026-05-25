/**
 * practicePatterns.ts
 *
 * Pure-function coordinate selectors for practice fingering patterns.
 * Each function takes scale/tuning inputs and pattern-specific parameters and
 * returns string[] of "string-fret" coordinate pairs (e.g. "0-3").
 *
 * No Jotai, no atoms, no side effects — these are plain computation functions.
 */

import { getFretboardNotes, parseNote } from "../guitar";
import { NOTES } from "../theory";
import { getScaleNotes } from "../theory";

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

/**
 * Same SD-distance targets as 2-Strings, reused for 1-String interval connectors.
 * Index 0 = Off (unused), index 1..3 = 3rds/4ths/6ths.
 */
const ONE_STRING_INTERVAL_SD_DISTANCES = [2, 3, 5] as const;

export { ONE_STRING_INTERVAL_SD_DISTANCES };

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
 * Non-wrapping ladder-step count between two absolute pitches.
 * Counts scale-degree pitch classes encountered while walking up from
 * loPitch+1 to hiPitch (inclusive). Does NOT wrap around the octave, so a
 * C-E pair spanning a 10th (9 ladder steps) is never mistaken for a 3rd (2
 * ladder steps). Returns -1 when hiPitch <= loPitch.
 *
 * @param loPitch   Lower absolute pitch (semitones).
 * @param hiPitch   Higher absolute pitch (semitones).
 * @param sds       Scale-degree pitch classes (0-11) as a Set for O(1) lookup.
 */
function sdStepsBetween(loPitch: number, hiPitch: number, sds: Set<number>): number {
  if (hiPitch <= loPitch) return -1;
  let count = 0;
  for (let p = loPitch + 1; p <= hiPitch; p++) {
    const cls = ((p % 12) + 12) % 12;
    if (sds.has(cls)) count++;
  }
  return count;
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

  // Pitch-class membership set for O(1) sdStepsBetween lookups.
  const scaleDegreeSet = new Set<number>(scaleSemitones);

  const pairs: Array<{ a: string; b: string }> = [];

  const offset = absolutePitch(openA, 0) - absolutePitch(openB, 0);

  for (let fretA = 0; fretA < rowA.length; fretA++) {
    const noteA = rowA[fretA];
    if (!noteA || !scaleNoteSet.has(noteA)) continue;
    const pitchA = absolutePitch(openA, fretA);

    // Instead of checking all frets on string B, we only check up to 12 semitones below pitchA.
    // pitchA - pitchB = diff
    // fretA + offset - fretB = diff  =>  fretB = fretA + offset - diff
    for (let diff = 1; diff <= 12; diff++) {
      const fretB = fretA + offset - diff;
      if (fretB < 0 || fretB >= rowB.length) continue;
      
      const noteB = rowB[fretB];
      if (!noteB || !scaleNoteSet.has(noteB)) continue;
      
      const pitchB = pitchA - diff;
      const dist = sdStepsBetween(pitchB, pitchA, scaleDegreeSet);
      if (dist === targetSdDistance) {
        pairs.push({ a: `${sA}-${fretA}`, b: `${sB}-${fretB}` });
      }
    }
  }
  return pairs;
}

/**
 * Returns interval pairs on a single string where the scale-degree distance between
 * the pair members equals `targetSdDistance`.
 *
 * Both pair members are on the same string (`stringIndex`). For each in-scale fret
 * pair `(fLow, fHigh)` with `fLow < fHigh`, the non-wrapping ladder-step predicate
 * (same as `getTwoStringsIntervalPairs`) is applied to their absolute pitches.
 *
 * The pair is directional: `a` = higher-fret (higher-pitched) member,
 * `b` = lower-fret (lower-pitched) member.
 *
 * @param stringIndex       String index in [0, tuning.length - 1]. Out-of-range → [].
 * @param board             Full fretboard note matrix from getFretboardNotes().
 * @param scaleNoteSet      Set of note names in the active scale.
 * @param scaleSemitones    Semitone offsets (0-11) of all scale tones relative to root.
 * @param targetSdDistance  SD distance to match (e.g. 2 for 3rds, 3 for 4ths, 5 for 6ths).
 * @param tuning            Open-string notes with octave (e.g. ["E4","B3","G3","D3","A2","E2"]).
 * @returns                 Array of { a, b } pairs; both members are on `stringIndex`.
 */
export function getOneStringIntervalPairs(
  stringIndex: number,
  board: string[][],
  scaleNoteSet: Set<string>,
  scaleSemitones: ReadonlyArray<number>,
  targetSdDistance: number,
  tuning: string[],
): Array<{ a: string; b: string }> {
  if (stringIndex < 0 || stringIndex >= board.length) return [];
  const row = board[stringIndex];
  const openNote = tuning[stringIndex];
  if (!row || !openNote) return [];

  const scaleDegreeSet = new Set<number>(scaleSemitones);

  const pairs: Array<{ a: string; b: string }> = [];

  for (let fLow = 0; fLow < row.length; fLow++) {
    const noteLow = row[fLow];
    if (!noteLow || !scaleNoteSet.has(noteLow)) continue;
    const pitchLow = absolutePitch(openNote, fLow);

    // Instead of scanning the rest of the string, only check up to 12 frets (semitones) higher
    for (let diff = 1; diff <= 12; diff++) {
      const fHigh = fLow + diff;
      if (fHigh >= row.length) break;

      const noteHigh = row[fHigh];
      if (!noteHigh || !scaleNoteSet.has(noteHigh)) continue;
      
      const pitchHigh = pitchLow + diff;
      const dist = sdStepsBetween(pitchLow, pitchHigh, scaleDegreeSet);
      if (dist === targetSdDistance) {
        // a = higher-fret (higher-pitched), b = lower-fret (lower-pitched)
        pairs.push({ a: `${stringIndex}-${fHigh}`, b: `${stringIndex}-${fLow}` });
      }
    }
  }
  return pairs;
}
