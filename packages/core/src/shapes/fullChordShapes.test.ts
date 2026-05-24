import { describe, expect, it } from 'vitest';

import { STANDARD_TUNING } from '../guitar';
import { getFullChordShapeMatches } from './fullChordShapes';

function getMatchPositions(
  chordRoot: string,
  chordType: string,
  shape: string,
  rootFret: number,
): string | undefined {
  return getFullChordShapeMatches({
    chordRoot,
    chordType,
    tuning: STANDARD_TUNING,
    maxFret: 12,
  })
    .find((match) => match.shape === shape && match.rootFret === rootFret)
    ?.positionKeys.join('|');
}

describe('getFullChordShapeMatches', () => {
  it('matches the open E-shape E major chord', () => {
    expect(getMatchPositions('E', 'Major Triad', 'E', 0)).toBe('0-0|1-0|2-1|3-2|4-2|5-0');
  });

  it('matches the open A-shape A minor chord', () => {
    expect(getMatchPositions('A', 'Minor Triad', 'A', 0)).toBe('0-0|1-1|2-2|3-2|4-0');
  });

  it('matches the open C7 chord', () => {
    expect(getMatchPositions('C', 'Dominant 7th', 'C', 3)).toBe('0-0|1-1|2-3|3-2|4-3');
  });

  it('supports the 4-note open D major chord', () => {
    expect(getMatchPositions('D', 'Major Triad', 'D', 0)).toBe('0-2|1-3|2-2|3-0');
  });

  it('returns no matches for unsupported chord qualities', () => {
    expect(
      getFullChordShapeMatches({
        chordRoot: 'C',
        chordType: 'Major 7th',
        tuning: STANDARD_TUNING,
        maxFret: 12,
      }),
    ).toEqual([]);
  });

  it('returns no matches for non-6-string tunings', () => {
    expect(
      getFullChordShapeMatches({
        chordRoot: 'E',
        chordType: 'Major Triad',
        tuning: STANDARD_TUNING.slice(0, 5),
        maxFret: 12,
      }),
    ).toEqual([]);
  });

  it('skips out-of-range frets but keeps match when 4+ valid notes remain', () => {
    // E-shape Major Triad template: [0, 0, 1, 2, 2, 0] with anchor offset 0 on string 5.
    // At rootFret=11 (D# on string 5), resolved frets are:
    //  string 0: 0 + 11 = 11 ✓
    //  string 1: 0 + 11 = 11 ✓
    //  string 2: 1 + 11 = 12 ✓
    //  string 3: 2 + 11 = 13 (exceeds maxFret=12, skipped)
    //  string 4: 2 + 11 = 13 (exceeds maxFret=12, skipped)
    //  string 5: 0 + 11 = 11 ✓
    // Result: 4 valid notes remain ([11, 11, 12, 11] on strings [0, 1, 2, 5]).
    // All 4 are D# Major Triad notes → match accepted.
    expect(getMatchPositions('D#', 'Major Triad', 'E', 11)).toBe('0-11|1-11|2-12|5-11');
  });

  describe('canonical open-shape templates', () => {
    it('verifies all 15 canonical templates - 9 produce open matches, 6 do not', () => {
      // Table-driven test covering all 15 FULL_CHORD_TEMPLATES entries.
      // Each row specifies: [chordRoot, chordType, shape, expectedPositionKeys].
      // 
      // Of the 15 canonical templates, only 9 produce valid open (rootFret=0) matches.
      // The C and G shapes for all 3 qualities match at rootFret=3, not 0, because
      // their anchor strings (A string for C, low E for G) don't have the root note
      // at the nut position for C and G chords respectively.
      //
      // This test protects the dataset by asserting on the 9 that do produce open
      // matches, and documenting the 6 that do not.
      const cases: Array<[string, string, string, string | null]> = [
        // Major Triad (3 open, 2 non-open)
        ['C', 'Major Triad', 'C', null], // C shape matches C Major at rootFret=3, not 0
        ['A', 'Major Triad', 'A', '0-0|1-2|2-2|3-2|4-0'],
        ['G', 'Major Triad', 'G', null], // G shape matches G Major at rootFret=3, not 0
        ['E', 'Major Triad', 'E', '0-0|1-0|2-1|3-2|4-2|5-0'],
        ['D', 'Major Triad', 'D', '0-2|1-3|2-2|3-0'],

        // Minor Triad (3 open, 2 non-open)
        ['C', 'Minor Triad', 'C', null], // C shape matches C Minor at rootFret=3, not 0
        ['A', 'Minor Triad', 'A', '0-0|1-1|2-2|3-2|4-0'],
        ['G', 'Minor Triad', 'G', null], // G shape matches G Minor at rootFret=3, not 0
        ['E', 'Minor Triad', 'E', '0-0|1-0|2-0|3-2|4-2|5-0'],
        ['D', 'Minor Triad', 'D', '0-1|1-3|2-2|3-0'],

        // Dominant 7th (3 open, 2 non-open)
        ['C', 'Dominant 7th', 'C', null], // C shape matches C7 at rootFret=3, not 0
        ['A', 'Dominant 7th', 'A', '0-0|1-2|2-0|3-2|4-0'],
        ['G', 'Dominant 7th', 'G', null], // G shape matches G7 at rootFret=3, not 0
        ['E', 'Dominant 7th', 'E', '0-0|1-0|2-1|3-0|4-2|5-0'],
        ['D', 'Dominant 7th', 'D', '0-2|1-1|2-2|3-0'],
      ];

      for (const [root, quality, shape, expectedKeys] of cases) {
        const actual = getMatchPositions(root, quality, shape, 0);
        if (expectedKeys === null) {
          // Document that this canonical template does not produce a valid open match
          expect(actual).toBeUndefined();
        } else {
          expect(actual).toBe(expectedKeys);
        }
      }
    });

    it('validates the 9 canonical templates that produce open matches', () => {
      // Expanded individual assertions for the 9 templates that match at rootFret=0.
      // Major Triads (A, E, D)
      expect(getMatchPositions('A', 'Major Triad', 'A', 0)).toBe('0-0|1-2|2-2|3-2|4-0');
      expect(getMatchPositions('E', 'Major Triad', 'E', 0)).toBe('0-0|1-0|2-1|3-2|4-2|5-0');
      expect(getMatchPositions('D', 'Major Triad', 'D', 0)).toBe('0-2|1-3|2-2|3-0');

      // Minor Triads (A, E, D)
      expect(getMatchPositions('A', 'Minor Triad', 'A', 0)).toBe('0-0|1-1|2-2|3-2|4-0');
      expect(getMatchPositions('E', 'Minor Triad', 'E', 0)).toBe('0-0|1-0|2-0|3-2|4-2|5-0');
      expect(getMatchPositions('D', 'Minor Triad', 'D', 0)).toBe('0-1|1-3|2-2|3-0');

      // Dominant 7ths (A, E, D)
      expect(getMatchPositions('A', 'Dominant 7th', 'A', 0)).toBe('0-0|1-2|2-0|3-2|4-0');
      expect(getMatchPositions('E', 'Dominant 7th', 'E', 0)).toBe('0-0|1-0|2-1|3-0|4-2|5-0');
      expect(getMatchPositions('D', 'Dominant 7th', 'D', 0)).toBe('0-2|1-1|2-2|3-0');
    });

    it('documents the 6 canonical templates that do not produce open matches', () => {
      // C and G shapes for all 3 qualities match at rootFret=3, not 0
      expect(getMatchPositions('C', 'Major Triad', 'C', 0)).toBeUndefined();
      expect(getMatchPositions('G', 'Major Triad', 'G', 0)).toBeUndefined();
      expect(getMatchPositions('C', 'Minor Triad', 'C', 0)).toBeUndefined();
      expect(getMatchPositions('G', 'Minor Triad', 'G', 0)).toBeUndefined();
      expect(getMatchPositions('C', 'Dominant 7th', 'C', 0)).toBeUndefined();
      expect(getMatchPositions('G', 'Dominant 7th', 'G', 0)).toBeUndefined();
    });
  });

  it('deduplicates overlapping G and E minor triad shapes to prevent duplicate overlays', () => {
    // An A minor triad at rootFret 5 has E Minor shape rooted on low E string.
    // The G minor triad template at rootFret 8 would produce the same fret indices.
    // Verify that we return exactly one match for these coordinates, and that we prefer the standard E shape.
    const matches = getFullChordShapeMatches({
      chordRoot: 'A',
      chordType: 'Minor Triad',
      tuning: STANDARD_TUNING,
      maxFret: 12,
    });

    const shape5Matches = matches.filter((m) => m.rootFret === 5);
    expect(shape5Matches.length).toBe(1);
    expect(shape5Matches[0]!.shape).toBe('E');
  });
});
