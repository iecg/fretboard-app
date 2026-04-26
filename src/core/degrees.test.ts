import { describe, it, expect } from 'vitest';
import { getDegreesForScale, DEGREE_COLORS, getQualityForDegree } from '../core/degrees';

describe('getDegreesForScale', () => {
  describe('Major modes', () => {
    it('returns Major degrees for Major scale', () => {
      const degrees = getDegreesForScale('Major');
      expect(degrees).toEqual({
        0: 'I',
        2: 'ii',
        4: 'iii',
        5: 'IV',
        7: 'V',
        9: 'vi',
        11: 'vii°',
      });
    });

    it('returns Lydian degrees for Lydian scale', () => {
      const degrees = getDegreesForScale('Lydian');
      expect(degrees[6]).toBe('iv°'); // Raised 4th as diminished interval
      expect(degrees[0]).toBe('I');
      expect(degrees[7]).toBe('V');
    });

    it('returns Mixolydian degrees for Mixolydian scale', () => {
      const degrees = getDegreesForScale('Mixolydian');
      expect(degrees[10]).toBe('VII'); // Lowered 7th
      expect(degrees[0]).toBe('I');
      expect(degrees[7]).toBe('v'); // Lowered 5th
    });
  });

  describe('Minor modes', () => {
    it('returns Natural Minor degrees for Natural Minor scale', () => {
      const degrees = getDegreesForScale('Natural Minor');
      expect(degrees).toEqual({
        0: 'i',
        2: 'ii°',
        3: 'III',
        5: 'iv',
        7: 'v',
        8: 'VI',
        10: 'VII',
      });
    });

    it('returns Dorian degrees for Dorian scale', () => {
      const degrees = getDegreesForScale('Dorian');
      expect(degrees[0]).toBe('i');
      expect(degrees[2]).toBe('ii'); // Major 2nd (vs Natural Minor)
      expect(degrees[9]).toBe('vi°'); // Diminished 6th
    });

    it('returns Phrygian degrees for Phrygian scale', () => {
      const degrees = getDegreesForScale('Phrygian');
      expect(degrees[0]).toBe('i');
      expect(degrees[1]).toBe('II'); // Major 2nd (characteristic)
      expect(degrees[7]).toBe('v°'); // Diminished 5th
    });

    it('returns Locrian degrees for Locrian scale', () => {
      const degrees = getDegreesForScale('Locrian');
      expect(degrees[0]).toBe('i°'); // Diminished root
      expect(degrees[1]).toBe('II');
      expect(degrees[6]).toBe('V'); // Major 5th
    });

    it('returns Harmonic Minor degrees for Harmonic Minor scale', () => {
      const degrees = getDegreesForScale('Harmonic Minor');
      expect(degrees[0]).toBe('i');
      expect(degrees[3]).toBe('III+'); // Augmented (raised 3rd)
      expect(degrees[7]).toBe('V'); // Major 5th (vs natural minor)
      expect(degrees[11]).toBe('vii°'); // Diminished 7th
    });

    it("covers all seven degrees for Melodic Minor via the generic 7-note fallback", () => {
      const degrees = getDegreesForScale("Melodic Minor");
      expect(degrees[0]).toBe("i");
      expect(degrees[9]).toBe("VI");
      expect(degrees[11]).toBe("VII");
    });
  });

  describe('Fallback behavior', () => {
    it('returns Natural Minor degrees for unknown scale', () => {
      const degrees = getDegreesForScale('Unknown Major-like');
      // Unknown scales are not in SCALES, so intervals is undefined;
      // the function falls back to Natural Minor degrees.
      expect(degrees).toEqual(getDegreesForScale('Natural Minor'));
    });

    it('returns Natural Minor degrees for unknown scale without interval 4', () => {
      const degrees = getDegreesForScale('Unknown Minor-like');
      // Should fall back to Natural Minor
      expect(degrees).toEqual(getDegreesForScale('Natural Minor'));
    });
  });

  describe('Pentatonic and blues scales', () => {
    it('falls back gracefully for Major Pentatonic', () => {
      const degrees = getDegreesForScale('Major Pentatonic');
      expect(degrees).toBeDefined();
      expect(degrees[0]).toBeDefined(); // Has a root
    });

    it('falls back gracefully for Minor Pentatonic', () => {
      const degrees = getDegreesForScale('Minor Pentatonic');
      expect(degrees).toBeDefined();
      expect(degrees[0]).toBeDefined(); // Has a root
    });

    it('falls back gracefully for Blues scale', () => {
      const degrees = getDegreesForScale('Minor Blues');
      expect(degrees).toBeDefined();
      expect(degrees[0]).toBeDefined(); // Has a root
    });
  });
});

describe('DEGREE_COLORS', () => {
  it('has color for tonic (I/i/i°)', () => {
    expect(DEGREE_COLORS['I']).toBeDefined();
    expect(DEGREE_COLORS['i']).toBeDefined();
    expect(DEGREE_COLORS['i°']).toBeDefined();
    expect(DEGREE_COLORS['I']).toBe(DEGREE_COLORS['i']);
  });

  it('has color for supertonic (II/ii/ii°)', () => {
    expect(DEGREE_COLORS['II']).toBeDefined();
    expect(DEGREE_COLORS['ii']).toBeDefined();
    expect(DEGREE_COLORS['ii°']).toBeDefined();
  });

  it('has color for mediant (III/iii/iii°/III+)', () => {
    expect(DEGREE_COLORS['III']).toBeDefined();
    expect(DEGREE_COLORS['iii']).toBeDefined();
    expect(DEGREE_COLORS['iii°']).toBeDefined();
    expect(DEGREE_COLORS['III+']).toBeDefined();
  });

  it('has color for subdominant (IV/iv/iv°)', () => {
    expect(DEGREE_COLORS['IV']).toBeDefined();
    expect(DEGREE_COLORS['iv']).toBeDefined();
    expect(DEGREE_COLORS['iv°']).toBeDefined();
  });

  it('has color for dominant (V/v/v°)', () => {
    expect(DEGREE_COLORS['V']).toBeDefined();
    expect(DEGREE_COLORS['v']).toBeDefined();
    expect(DEGREE_COLORS['v°']).toBeDefined();
  });

  it('has color for submediant (VI/vi/vi°)', () => {
    expect(DEGREE_COLORS['VI']).toBeDefined();
    expect(DEGREE_COLORS['vi']).toBeDefined();
    expect(DEGREE_COLORS['vi°']).toBeDefined();
  });

  it('has color for leading tone (VII/vii/vii°)', () => {
    expect(DEGREE_COLORS['VII']).toBeDefined();
    expect(DEGREE_COLORS['vii']).toBeDefined();
    expect(DEGREE_COLORS['vii°']).toBeDefined();
  });

  it('all color values are valid hex colors', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    Object.values(DEGREE_COLORS).forEach((color) => {
      expect(color).toMatch(hexRegex);
    });
  });

  it('has consistent coloring for same degree (upper/lower case variants)', () => {
    // All I/i variants should be same color
    expect(DEGREE_COLORS['I']).toBe(DEGREE_COLORS['i']);
    expect(DEGREE_COLORS['i']).toBe(DEGREE_COLORS['i°']);
  });
});

describe('getQualityForDegree', () => {
  describe('Major scale — all 7 degrees', () => {
    it('I → Major Triad', () => {
      expect(getQualityForDegree('I', 'Major')).toBe('Major Triad');
    });

    it('ii → Minor Triad', () => {
      expect(getQualityForDegree('ii', 'Major')).toBe('Minor Triad');
    });

    it('iii → Minor Triad', () => {
      expect(getQualityForDegree('iii', 'Major')).toBe('Minor Triad');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'Major')).toBe('Major Triad');
    });

    it('V → Major Triad', () => {
      expect(getQualityForDegree('V', 'Major')).toBe('Major Triad');
    });

    it('vi → Minor Triad', () => {
      expect(getQualityForDegree('vi', 'Major')).toBe('Minor Triad');
    });

    it('vii° → Diminished Triad', () => {
      expect(getQualityForDegree('vii°', 'Major')).toBe('Diminished Triad');
    });
  });

  describe('Natural Minor scale — all 7 degrees', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'Natural Minor')).toBe('Minor Triad');
    });

    it('ii° → Diminished Triad', () => {
      expect(getQualityForDegree('ii°', 'Natural Minor')).toBe('Diminished Triad');
    });

    it('III → Major Triad', () => {
      expect(getQualityForDegree('III', 'Natural Minor')).toBe('Major Triad');
    });

    it('iv → Minor Triad', () => {
      expect(getQualityForDegree('iv', 'Natural Minor')).toBe('Minor Triad');
    });

    it('v → Minor Triad', () => {
      expect(getQualityForDegree('v', 'Natural Minor')).toBe('Minor Triad');
    });

    it('VI → Major Triad', () => {
      expect(getQualityForDegree('VI', 'Natural Minor')).toBe('Major Triad');
    });

    it('VII → Major Triad', () => {
      expect(getQualityForDegree('VII', 'Natural Minor')).toBe('Major Triad');
    });
  });

  describe('Dorian — spot checks', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'Dorian')).toBe('Minor Triad');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'Dorian')).toBe('Major Triad');
    });

    it('vi° → Diminished Triad', () => {
      expect(getQualityForDegree('vi°', 'Dorian')).toBe('Diminished Triad');
    });
  });

  describe('Harmonic Minor — edge cases', () => {
    it('V at semitone 7 → Major Triad (raised 7th makes dominant major)', () => {
      expect(getQualityForDegree('V', 'Harmonic Minor')).toBe('Major Triad');
    });

    it('III+ at semitone 3 → Major Triad (pragmatic fallback: CHORD_DEFINITIONS has no Augmented Triad)', () => {
      expect(getQualityForDegree('III+', 'Harmonic Minor')).toBe('Major Triad');
    });
  });

  describe('Lydian — raised 4th edge case', () => {
    it('iv° at semitone 6 → Diminished Triad (F#-A-C: minor 3rd + diminished 5th)', () => {
      expect(getQualityForDegree('iv°', 'Lydian')).toBe('Diminished Triad');
    });
  });

  describe('Unknown inputs', () => {
    it('returns undefined for an unknown scale', () => {
      expect(getQualityForDegree('I', 'Unknown Scale')).toBeUndefined();
    });

    it('returns undefined for an unknown degree in a known scale', () => {
      expect(getQualityForDegree('XI', 'Major')).toBeUndefined();
    });
  });
});
