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
});
