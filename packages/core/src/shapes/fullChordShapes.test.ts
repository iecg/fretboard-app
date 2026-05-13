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
});
