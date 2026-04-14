import { describe, it, expect } from 'vitest';
import {
  parseNote,
  getFretNote,
  getFretNoteWithOctave,
  getNoteFrequency,
  getFretboardNotes,
  STANDARD_TUNING,
  STANDARD_FRET_MARKERS,
} from '../guitar';

describe('parseNote', () => {
  it('parses note with octave', () => {
    expect(parseNote('E4')).toEqual({ noteName: 'E', octave: 4 });
    expect(parseNote('C#3')).toEqual({ noteName: 'C#', octave: 3 });
  });

  it('returns null for non-standard input', () => {
    expect(parseNote('X')).toBeNull();
    expect(parseNote('E')).toBeNull();
    expect(parseNote('H4')).toBeNull();
  });
});

describe('getFretNote', () => {
  it('returns open string note at fret 0', () => {
    expect(getFretNote('E2', 0)).toBe('E');
  });

  it('returns correct note at fret 5 on low E', () => {
    expect(getFretNote('E2', 5)).toBe('A');
  });

  it('returns correct note at fret 12 (octave)', () => {
    expect(getFretNote('E2', 12)).toBe('E');
  });

  it('wraps correctly past 12 frets', () => {
    expect(getFretNote('E2', 13)).toBe('F');
  });
});

describe('getFretNoteWithOctave', () => {
  it('returns correct octave at fret 0', () => {
    expect(getFretNoteWithOctave('E2', 0)).toBe('E2');
  });

  it('increments octave correctly', () => {
    expect(getFretNoteWithOctave('E2', 12)).toBe('E3');
  });

  it('handles mid-octave transitions', () => {
    // B3 + 1 fret = C4
    expect(getFretNoteWithOctave('B3', 1)).toBe('C4');
  });
});

describe('getNoteFrequency', () => {
  it('returns 440 for A4', () => {
    expect(getNoteFrequency('A4')).toBeCloseTo(440, 1);
  });

  it('returns ~261.63 for C4 (middle C)', () => {
    expect(getNoteFrequency('C4')).toBeCloseTo(261.63, 0);
  });

  it('doubles frequency per octave', () => {
    const a4 = getNoteFrequency('A4');
    const a5 = getNoteFrequency('A5');
    expect(a5 / a4).toBeCloseTo(2, 5);
  });
});

describe('getFretboardNotes', () => {
  it('returns correct dimensions', () => {
    const layout = getFretboardNotes(STANDARD_TUNING, 24);
    expect(layout).toHaveLength(6); // 6 strings
    expect(layout[0]).toHaveLength(25); // frets 0-24
  });

  it('first string open = E (high E)', () => {
    const layout = getFretboardNotes(STANDARD_TUNING, 24);
    expect(layout[0][0]).toBe('E');
  });

  it('last string open = E (low E)', () => {
    const layout = getFretboardNotes(STANDARD_TUNING, 24);
    expect(layout[5][0]).toBe('E');
  });

  it('A string fret 3 = C', () => {
    const layout = getFretboardNotes(STANDARD_TUNING, 24);
    // A string is index 4 (tuning: E4, B3, G3, D3, A2, E2)
    expect(layout[4][3]).toBe('C');
  });
});

describe('STANDARD_FRET_MARKERS', () => {
  it('includes standard dot positions', () => {
    expect(STANDARD_FRET_MARKERS).toContain(3);
    expect(STANDARD_FRET_MARKERS).toContain(5);
    expect(STANDARD_FRET_MARKERS).toContain(7);
    expect(STANDARD_FRET_MARKERS).toContain(12);
  });
});
