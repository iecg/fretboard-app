import { NOTES } from './theory';
import { DEFAULT_OCTAVE, A4_FREQUENCY, A4_ABS_DISTANCE, STANDARD_FRET_MARKERS } from './constants';

export interface NoteWithOctave {
  noteName: string;
  octave: number;
}

/**
 * Parses a note string like "E4" or "A#3".
 * Returns a NoteWithOctave object or null if the string is invalid.
 */
export function parseNote(noteString: string): NoteWithOctave | null {
  if (!noteString) return null;
  const match = noteString.match(/^([A-G]#?)(\d)$/);
  if (!match) return null;
  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  if (!NOTES.includes(noteName)) return null;
  if (!Number.isFinite(octave)) return null;
  return { noteName, octave };
}

// Standard Tuning from highest string (1st, thinnest) to lowest string (6th, thickest)
export const STANDARD_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

export const TUNINGS: Record<string, string[]> = {
  'Standard': STANDARD_TUNING,
  'Drop D': ['E4', 'B3', 'G3', 'D3', 'A2', 'D2'],
  'DADGAD': ['D4', 'A3', 'G3', 'D3', 'A2', 'D2'],
  'Bass Standard (4 String)': ['G2', 'D2', 'A1', 'E1']
};

/**
 * Returns the note name for a given fret on a string.
 */
export function getFretNote(openStringNote: string, fretNumber: number): string {
  const parsed = parseNote(openStringNote);
  if (!parsed) {
    console.warn(`Invalid open string note: "${openStringNote}", falling back to E4`);
  }
  const noteName = parsed?.noteName ?? "E";
  const openIndex = NOTES.indexOf(noteName);
  const noteIndex = (openIndex + fretNumber) % 12;
  return NOTES[noteIndex];
}

/**
 * Returns the note name with octave for a given fret on a string.
 */
export function getFretNoteWithOctave(openStringNote: string, fretNumber: number): string {
  const parsed = parseNote(openStringNote) ?? { noteName: "E", octave: DEFAULT_OCTAVE };
  const openIndex = NOTES.indexOf(parsed.noteName);
  const totalSemi = parsed.octave * 12 + openIndex + fretNumber;
  const newOctave = Math.floor(totalSemi / 12);
  const newNoteIndex = totalSemi % 12;
  return `${NOTES[newNoteIndex]}${newOctave}`;
}

/**
 * Returns the frequency in Hz for a given note string (e.g. "A4").
 */
export function getNoteFrequency(noteStringWithOctave: string): number {
  const parsed = parseNote(noteStringWithOctave) ?? { noteName: "A", octave: DEFAULT_OCTAVE };
  const noteIndex = NOTES.indexOf(parsed.noteName);
  // C0 is 0. A4 is 57 (since A is index 9).
  const absoluteDistance = (parsed.octave * 12) + noteIndex;
  const halfStepsFromA4 = absoluteDistance - A4_ABS_DISTANCE;
  return A4_FREQUENCY * Math.pow(2, halfStepsFromA4 / 12);
}

/**
 * Returns a 2D array representing the fretboard.
 * Array of strings (top/thinnest to bottom/thickest), each containing an array of notes from fret 0 to maxFret.
 */
export function getFretboardNotes(tuning: string[], frets: number = 24): string[][] {
  return tuning.map(stringNote => {
    const stringNotes = [];
    for (let currentFret = 0; currentFret <= frets; currentFret++) {
      stringNotes.push(getFretNote(stringNote, currentFret));
    }
    return stringNotes;
  });
}

// Common fret marker positions for rendering dots
export { STANDARD_FRET_MARKERS };
