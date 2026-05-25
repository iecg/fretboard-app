import { NOTES } from './theory';
import { DEFAULT_OCTAVE, A4_FREQUENCY, MAX_FRET, STANDARD_FRET_MARKERS } from './constants';
import * as Note from "@tonaljs/note";

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
  const tonalNote = Note.get(noteString);
  if (tonalNote.empty || tonalNote.oct === undefined) return null;
  return {
    noteName: tonalNote.letter + (tonalNote.acc || ""),
    octave: tonalNote.oct,
  };
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
  const sanitized = Number.isFinite(fretNumber) ? Math.round(fretNumber) : 0;
  const clampedFret = Math.max(0, Math.min(MAX_FRET, sanitized));
  const parsed = parseNote(openStringNote) ?? { noteName: "E", octave: DEFAULT_OCTAVE };
  const openIndex = NOTES.indexOf(parsed.noteName);
  const totalSemi = parsed.octave * 12 + openIndex + clampedFret;
  const newOctave = Math.floor(totalSemi / 12);
  const newNoteIndex = totalSemi % 12;
  return `${NOTES[newNoteIndex]}${newOctave}`;
}

/**
 * Returns the frequency in Hz for a given note string (e.g. "A4").
 * Backed by Tonal's `Note.freq` (A4 = 440 Hz equal temperament). Falls
 * back to A4 when the input cannot be parsed, matching the legacy
 * behavior that used `{ noteName: "A", octave: DEFAULT_OCTAVE }`.
 */
export function getNoteFrequency(noteStringWithOctave: string): number {
  return Note.freq(noteStringWithOctave) ?? A4_FREQUENCY;
}

const fretboardCache = new Map<string, string[][]>();

/**
 * Returns a 2D array representing the fretboard.
 * Array of strings (top/thinnest to bottom/thickest), each containing an array of notes from fret 0 to maxFret.
 */
export function getFretboardNotes(tuning: string[], frets: number = 24): string[][] {
  const key = `${tuning.join(',')}|${frets}`;
  let cached = fretboardCache.get(key);
  if (!cached) {
    cached = tuning.map(stringNote => {
      const stringNotes = [];
      for (let currentFret = 0; currentFret <= frets; currentFret++) {
        stringNotes.push(getFretNote(stringNote, currentFret));
      }
      return stringNotes;
    });
    fretboardCache.set(key, cached);
  }
  return cached;
}

// Common fret marker positions for rendering dots
export { STANDARD_FRET_MARKERS };
