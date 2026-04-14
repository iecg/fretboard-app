import { NOTES } from './theory';

export interface NoteWithOctave {
  noteName: string;
  octave: number;
}

export function parseNote(noteString: string): NoteWithOctave | null {
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

export function getFretNote(openStringNote: string, fretNumber: number): string {
  const parsed = parseNote(openStringNote) ?? { noteName: "E", octave: 4 };
  const openIndex = NOTES.indexOf(parsed.noteName);
  const noteIndex = (openIndex + fretNumber) % 12;
  return NOTES[noteIndex];
}

export function getFretNoteWithOctave(openStringNote: string, fretNumber: number): string {
  const parsed = parseNote(openStringNote) ?? { noteName: "E", octave: 4 };
  const openIndex = NOTES.indexOf(parsed.noteName);
  const totalSemi = parsed.octave * 12 + openIndex + fretNumber;
  const newOctave = Math.floor(totalSemi / 12);
  const newNoteIndex = totalSemi % 12;
  return `${NOTES[newNoteIndex]}${newOctave}`;
}

export function getNoteFrequency(noteStringWithOctave: string): number {
  const parsed = parseNote(noteStringWithOctave) ?? { noteName: "A", octave: 4 };
  const noteIndex = NOTES.indexOf(parsed.noteName);
  // C0 is 0. C4 is 48. A4 is 57 (since A is index 9).
  const absoluteDistance = (parsed.octave * 12) + noteIndex;
  const a4Distance = 57;
  const halfStepsFromA4 = absoluteDistance - a4Distance;
  return 440 * Math.pow(2, halfStepsFromA4 / 12);
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
export const STANDARD_FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
