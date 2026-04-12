import { describe, it, expect } from 'vitest';
import {
  SCALES,
  getScaleNotes,
  getChordNotes,
  getNoteIndex,
  getNoteDisplay,
  getIntervalNotes,
  getDivergentNotes,
  getKeySignature,
  getKeySignatureForDisplay,
  resolveAccidentalMode,
} from '../theory';

describe('getNoteIndex', () => {
  it('returns correct index for sharp notes', () => {
    expect(getNoteIndex('C')).toBe(0);
    expect(getNoteIndex('E')).toBe(4);
    expect(getNoteIndex('B')).toBe(11);
  });

  it('handles flat enharmonics', () => {
    expect(getNoteIndex('Db')).toBe(getNoteIndex('C#'));
    expect(getNoteIndex('Bb')).toBe(getNoteIndex('A#'));
  });
});

describe('getNoteDisplay', () => {
  it('shows sharps for sharp keys', () => {
    expect(getNoteDisplay('C#', 'G')).toBe('C#');
    expect(getNoteDisplay('F#', 'D')).toBe('F#');
  });

  it('shows flats for flat keys', () => {
    expect(getNoteDisplay('C#', 'F')).toBe('Db');
    expect(getNoteDisplay('A#', 'Bb')).toBe('Bb');
  });
});

describe('getIntervalNotes', () => {
  it('computes notes from intervals', () => {
    expect(getIntervalNotes('C', [0, 4, 7])).toEqual(['C', 'E', 'G']);
  });

  it('wraps around octave', () => {
    expect(getIntervalNotes('A', [0, 4, 7])).toEqual(['A', 'C#', 'E']);
  });
});

describe('getScaleNotes', () => {
  it('returns C Major notes', () => {
    expect(getScaleNotes('C', 'Major')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('returns A Minor Pentatonic notes', () => {
    expect(getScaleNotes('A', 'Minor Pentatonic')).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('returns empty for unknown scale', () => {
    expect(getScaleNotes('C', 'NonExistent')).toEqual([]);
  });
});

describe('getChordNotes', () => {
  it('returns C Major Triad', () => {
    expect(getChordNotes('C', 'Major Triad')).toEqual(['C', 'E', 'G']);
  });

  it('returns A Minor 7th', () => {
    expect(getChordNotes('A', 'Minor 7th')).toEqual(['A', 'C', 'E', 'G']);
  });
});

describe('getDivergentNotes', () => {
  it('returns empty for Major scale (reference itself)', () => {
    expect(getDivergentNotes('C', 'Major')).toEqual([]);
  });

  it('returns empty for Natural Minor (reference itself)', () => {
    expect(getDivergentNotes('A', 'Natural Minor')).toEqual([]);
  });

  it('returns raised 6th for Dorian (vs Natural Minor)', () => {
    // Dorian has interval 9 (major 6th), Natural Minor has 8 (minor 6th)
    const divergent = getDivergentNotes('D', 'Dorian');
    expect(divergent).toEqual(['B']); // B is the raised 6th in D Dorian
  });

  it('returns raised 4th for Lydian (vs Major)', () => {
    const divergent = getDivergentNotes('F', 'Lydian');
    expect(divergent).toEqual(['B']); // B is the raised 4th in F Lydian
  });

  it('returns lowered 7th for Mixolydian (vs Major)', () => {
    const divergent = getDivergentNotes('G', 'Mixolydian');
    expect(divergent).toEqual(['F']); // F is the lowered 7th in G Mixolydian
  });

  it('returns empty for pentatonic scales', () => {
    expect(getDivergentNotes('C', 'Minor Pentatonic')).toEqual([]);
    expect(getDivergentNotes('C', 'Major Pentatonic')).toEqual([]);
  });

  it('returns empty for blues scales', () => {
    expect(getDivergentNotes('A', 'Minor Blues')).toEqual([]);
  });
});

describe('getKeySignature', () => {
  it('returns 0 for C', () => {
    expect(getKeySignature('C')).toBe(0);
  });

  it('returns positive for sharp keys', () => {
    expect(getKeySignature('G')).toBe(1);
    expect(getKeySignature('D')).toBe(2);
  });

  it('returns negative for flat keys', () => {
    expect(getKeySignature('F')).toBe(-1);
    expect(getKeySignature('Bb')).toBe(-2);
  });
});

describe('resolveAccidentalMode', () => {
  describe('explicit mode pass-through', () => {
    it('sharps → false regardless of root', () => {
      expect(resolveAccidentalMode('C#', 'Major', 'sharps')).toBe(false);
      expect(resolveAccidentalMode('Bb', 'Major', 'sharps')).toBe(false);
    });
    it('flats → true regardless of root', () => {
      expect(resolveAccidentalMode('C#', 'Major', 'flats')).toBe(true);
      expect(resolveAccidentalMode('C', 'Major', 'flats')).toBe(true);
    });
  });

  describe('natural root no-op (auto falls back to FLAT_KEYS)', () => {
    it('C Major → false', () => {
      expect(resolveAccidentalMode('C', 'Major', 'auto')).toBe(false);
    });
    it('F Major → true (F in FLAT_KEYS)', () => {
      expect(resolveAccidentalMode('F', 'Major', 'auto')).toBe(true);
    });
    it('A Natural Minor → false', () => {
      expect(resolveAccidentalMode('A', 'Natural Minor', 'auto')).toBe(false);
    });
  });

  describe('enharmonic roots — auto picks fewer accidentals', () => {
    it('A#/Bb Major → true (Bb wins)', () => {
      expect(resolveAccidentalMode('A#', 'Major', 'auto')).toBe(true);
      expect(resolveAccidentalMode('Bb', 'Major', 'auto')).toBe(true);
    });
    it('C#/Db Major → true (Db wins)', () => {
      expect(resolveAccidentalMode('C#', 'Major', 'auto')).toBe(true);
      expect(resolveAccidentalMode('Db', 'Major', 'auto')).toBe(true);
    });
    it('D#/Eb Major → true (Eb wins)', () => {
      expect(resolveAccidentalMode('D#', 'Major', 'auto')).toBe(true);
      expect(resolveAccidentalMode('Eb', 'Major', 'auto')).toBe(true);
    });
    it('G#/Ab Major → true (Ab wins)', () => {
      expect(resolveAccidentalMode('G#', 'Major', 'auto')).toBe(true);
      expect(resolveAccidentalMode('Ab', 'Major', 'auto')).toBe(true);
    });
    it('F#/Gb Major → false (tie breaks to sharps)', () => {
      expect(resolveAccidentalMode('F#', 'Major', 'auto')).toBe(false);
      expect(resolveAccidentalMode('Gb', 'Major', 'auto')).toBe(false);
    });
    it('A# Natural Minor in auto mode', () => {
      // A# Natural Minor vs Bb Natural Minor — Bb should win (fewer accidentals)
      expect(resolveAccidentalMode('A#', 'Natural Minor', 'auto')).toBe(true);
    });
  });
});

describe('getKeySignatureForDisplay (scale-aware)', () => {
  it('A Natural Minor → 0 (parent = C Major)', () => {
    expect(getKeySignatureForDisplay('A', 'Natural Minor', false)).toBe(0);
  });
  it('E Dorian → 2 (parent = D Major)', () => {
    expect(getKeySignatureForDisplay('E', 'Dorian', false)).toBe(2);
  });
  it('D Phrygian → -2 (parent = Bb/A# Major, useFlats=false → A# = -2)', () => {
    expect(getKeySignatureForDisplay('D', 'Phrygian', false)).toBe(-2);
  });
  it('Bb Lydian → -1 (parent = F Major, useFlats=true)', () => {
    expect(getKeySignatureForDisplay('Bb', 'Lydian', true)).toBe(-1);
  });
  it('G Mixolydian → 0 (parent = C Major)', () => {
    expect(getKeySignatureForDisplay('G', 'Mixolydian', false)).toBe(0);
  });
  it('B Locrian → 0 (parent = C Major)', () => {
    expect(getKeySignatureForDisplay('B', 'Locrian', false)).toBe(0);
  });
  it('C Major → 0 (sanity regression)', () => {
    expect(getKeySignatureForDisplay('C', 'Major', false)).toBe(0);
  });
  it('A Minor Pentatonic → 0 (parent = C Major)', () => {
    expect(getKeySignatureForDisplay('A', 'Minor Pentatonic', false)).toBe(0);
  });
  it('A Harmonic Minor → 0 (Natural Minor parent)', () => {
    expect(getKeySignatureForDisplay('A', 'Harmonic Minor', false)).toBe(0);
  });
});

describe('getKeySignatureForDisplay — sharp root preservation', () => {
  it('G# Major with useFlats=true returns enharmonic sharp count (8)', () => {
    expect(getKeySignatureForDisplay('G#', 'Major', true)).toBe(8);
  });
  it('Ab Major with useFlats=true returns flat-side sig', () => {
    expect(getKeySignatureForDisplay('Ab', 'Major', true)).toBe(-4);
  });
  it('D# Major with useFlats=true returns enharmonic sharp count (9)', () => {
    expect(getKeySignatureForDisplay('D#', 'Major', true)).toBe(9);
  });
  it('Eb Major with useFlats=true returns flat-side sig', () => {
    expect(getKeySignatureForDisplay('Eb', 'Major', true)).toBe(-3);
  });
  it('C# Major with useFlats=false returns sharp sig (7)', () => {
    expect(getKeySignatureForDisplay('C#', 'Major', false)).toBe(7);
  });
  it('G# Major with useFlats=false returns 8 (8 sharps)', () => {
    expect(getKeySignatureForDisplay('G#', 'Major', false)).toBe(8);
  });
  it('Ab Major with useFlats=false returns -4 (4 flats)', () => {
    expect(getKeySignatureForDisplay('Ab', 'Major', false)).toBe(-4);
  });
  it('A# Major with useFlats=false returns 10 (10 sharps)', () => {
    expect(getKeySignatureForDisplay('A#', 'Major', false)).toBe(10);
  });
  it('Bb Major with useFlats=true returns -2 (2 flats)', () => {
    expect(getKeySignatureForDisplay('Bb', 'Major', true)).toBe(-2);
  });
});

describe('resolver + key signature integration', () => {
  it('A# Major auto → sharp-spelled root stays sharp → key sig = 10', () => {
    const useFlats = resolveAccidentalMode('A#', 'Major', 'auto');
    // A# is sharp-spelled so getKeySignatureForDisplay returns enharmonic sharp count
    expect(getKeySignatureForDisplay('A#', 'Major', useFlats)).toBe(10);
  });
  it('A Natural Minor auto → sharps → key sig = 0', () => {
    const useFlats = resolveAccidentalMode('A', 'Natural Minor', 'auto');
    expect(useFlats).toBe(false);
    expect(getKeySignatureForDisplay('A', 'Natural Minor', useFlats)).toBe(0);
  });
  it('E Dorian auto → sharps → key sig = 2', () => {
    const useFlats = resolveAccidentalMode('E', 'Dorian', 'auto');
    expect(useFlats).toBe(false);
    expect(getKeySignatureForDisplay('E', 'Dorian', useFlats)).toBe(2);
  });
});

describe('SCALES constant', () => {
  it('has expected number of scales', () => {
    expect(Object.keys(SCALES).length).toBeGreaterThanOrEqual(12);
  });

  it('Major scale has 7 intervals starting from 0', () => {
    expect(SCALES['Major']).toHaveLength(7);
    expect(SCALES['Major'][0]).toBe(0);
  });
});
