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
    expect(getMatchPositions('E', 'M', 'E', 0)).toBe('0-0|1-0|2-1|3-2|4-2|5-0');
  });

  it('matches the open A-shape A minor chord', () => {
    expect(getMatchPositions('A', 'm', 'A', 0)).toBe('0-0|1-1|2-2|3-2|4-0');
  });

  it('matches the open C7 chord', () => {
    expect(getMatchPositions('C', '7', 'C', 3)).toBe('0-0|1-1|2-3|3-2|4-3');
  });

  it('supports the 4-note open D major chord', () => {
    expect(getMatchPositions('D', 'M', 'D', 0)).toBe('0-2|1-3|2-2|3-0');
  });

  it('returns no matches for unsupported chord qualities', () => {
    expect(
      getFullChordShapeMatches({
        chordRoot: 'C',
        chordType: 'add9',
        tuning: STANDARD_TUNING,
        maxFret: 12,
      }),
    ).toEqual([]);
  });

  it('returns no matches for non-6-string tunings', () => {
    expect(
      getFullChordShapeMatches({
        chordRoot: 'E',
        chordType: 'M',
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
    expect(getMatchPositions('D#', 'M', 'E', 11)).toBe('0-11|1-11|2-12|5-11');
  });

  describe('canonical open-shape templates', () => {
    it('verifies all 14 canonical templates - 8 produce open matches, 6 do not', () => {
      // Table-driven test covering all 14 FULL_CHORD_TEMPLATES entries (D-shape 7 was
      // removed as a close-voicing duplicate per the 2026-05-26 audit).
      // Each row specifies: [chordRoot, chordType, shape, expectedPositionKeys].
      //
      // Of the 14 canonical templates, only 8 produce valid open (rootFret=0) matches.
      // The C and G shapes for all 3 qualities match at rootFret=3, not 0, because
      // their anchor strings (A string for C, low E for G) don't have the root note
      // at the nut position for C and G chords respectively.
      //
      // This test protects the dataset by asserting on the 8 that do produce open
      // matches, and documenting the 6 that do not.
      const cases: Array<[string, string, string, string | null]> = [
        // Major Triad (3 open, 2 non-open)
        ['C', 'M', 'C', null], // C shape matches C Major at rootFret=3, not 0
        ['A', 'M', 'A', '0-0|1-2|2-2|3-2|4-0'],
        ['G', 'M', 'G', null], // G shape matches G Major at rootFret=3, not 0
        ['E', 'M', 'E', '0-0|1-0|2-1|3-2|4-2|5-0'],
        ['D', 'M', 'D', '0-2|1-3|2-2|3-0'],

        // Minor Triad (3 open, 2 non-open)
        ['C', 'm', 'C', null], // C shape matches C Minor at rootFret=3, not 0
        ['A', 'm', 'A', '0-0|1-1|2-2|3-2|4-0'],
        ['G', 'm', 'G', null], // G shape matches G Minor at rootFret=3, not 0
        ['E', 'm', 'E', '0-0|1-0|2-0|3-2|4-2|5-0'],
        ['D', 'm', 'D', '0-1|1-3|2-2|3-0'],

        // Dominant 7th (2 open, 3 non-open; D-shape dropped — audit duplicate)
        ['C', '7', 'C', null], // C shape matches C7 at rootFret=3, not 0
        ['A', '7', 'A', '0-0|1-2|2-0|3-2|4-0'],
        ['G', '7', 'G', null], // G shape matches G7 at rootFret=3, not 0
        ['E', '7', 'E', '0-0|1-0|2-1|3-0|4-2|5-0'],
        ['D', '7', 'D', null], // D-shape 7 removed — identical to close voicing (audit)
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

    it('validates the 8 canonical templates that produce open matches', () => {
      // Expanded individual assertions for the 8 templates that match at rootFret=0.
      // (D-shape 7 removed as close-voicing duplicate per 2026-05-26 audit.)
      // Major Triads (A, E, D)
      expect(getMatchPositions('A', 'M', 'A', 0)).toBe('0-0|1-2|2-2|3-2|4-0');
      expect(getMatchPositions('E', 'M', 'E', 0)).toBe('0-0|1-0|2-1|3-2|4-2|5-0');
      expect(getMatchPositions('D', 'M', 'D', 0)).toBe('0-2|1-3|2-2|3-0');

      // Minor Triads (A, E, D)
      expect(getMatchPositions('A', 'm', 'A', 0)).toBe('0-0|1-1|2-2|3-2|4-0');
      expect(getMatchPositions('E', 'm', 'E', 0)).toBe('0-0|1-0|2-0|3-2|4-2|5-0');
      expect(getMatchPositions('D', 'm', 'D', 0)).toBe('0-1|1-3|2-2|3-0');

      // Dominant 7ths (A, E only — D-shape 7 omitted, close-voicing duplicate)
      expect(getMatchPositions('A', '7', 'A', 0)).toBe('0-0|1-2|2-0|3-2|4-0');
      expect(getMatchPositions('E', '7', 'E', 0)).toBe('0-0|1-0|2-1|3-0|4-2|5-0');
    });

    it('documents the 6 canonical templates that do not produce open matches', () => {
      // C and G shapes for all 3 qualities match at rootFret=3, not 0
      expect(getMatchPositions('C', 'M', 'C', 0)).toBeUndefined();
      expect(getMatchPositions('G', 'M', 'G', 0)).toBeUndefined();
      expect(getMatchPositions('C', 'm', 'C', 0)).toBeUndefined();
      expect(getMatchPositions('G', 'm', 'G', 0)).toBeUndefined();
      expect(getMatchPositions('C', '7', 'C', 0)).toBeUndefined();
      expect(getMatchPositions('G', '7', 'G', 0)).toBeUndefined();
    });

    it('verifies C and G shapes at rootFret=3', () => {
      expect(getMatchPositions('G', 'm', 'G', 3)).toBe('0-3|1-3|2-0|3-0|4-1|5-3');
      expect(getMatchPositions('C', 'm', 'C', 3)).toBe('1-1|2-0|3-1|4-3');
      expect(getMatchPositions('G', 'M', 'G', 3)).toBe('0-3|1-0|2-0|3-0|4-2|5-3');
      expect(getMatchPositions('C', 'M', 'C', 3)).toBe('0-0|1-1|2-0|3-2|4-3');
    });
  });

  it('does not deduplicate G and E minor triad shapes as they are now distinct physical shapes', () => {
    // An A minor triad at rootFret 5 has E Minor shape (5 7 7 5 5 5) and G Minor shape (5 3 2 2 5 5).
    // Verify that we return both matches for these coordinates, and they are distinct physical shapes.
    const matches = getFullChordShapeMatches({
      chordRoot: 'A',
      chordType: 'm',
      tuning: STANDARD_TUNING,
      maxFret: 12,
    });

    const shape5Matches = matches.filter((m) => m.rootFret === 5);
    expect(shape5Matches.length).toBe(2);
    expect(shape5Matches.map((m) => m.shape).sort()).toEqual(['E', 'G']);
  });

  describe("dim CAGED templates", () => {
    for (const { shape, root, expected } of [
      { shape: "A", root: "A", expected: new Set(["A", "C", "D#"]) },
      { shape: "E", root: "E", expected: new Set(["E", "G", "A#"]) },
      { shape: "D", root: "D", expected: new Set(["D", "F", "G#"]) },
    ] as const) {
      it(`resolves a ${root}dim ${shape}-shape voicing`, () => {
        const matches = getFullChordShapeMatches({
          chordRoot: root,
          chordType: "dim",
          tuning: STANDARD_TUNING,
          maxFret: 15,
        });
        const found = matches.find((m) => m.shape === shape);
        expect(found, `expected a ${shape}-shape match for ${root}dim`).toBeDefined();
        const pcs = new Set(found!.notes.map((n) => n.noteName));
        expect(pcs).toEqual(expected);
      });
    }

    it("C-shape dim is omitted — A-shape covers the lower-neck dim voicing", () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "B",
        chordType: "dim",
        tuning: STANDARD_TUNING,
        maxFret: 12,
      });
      // C-shape dim is intentionally absent from FULL_CHORD_TEMPLATES — the
      // high-E b5 note that would have made it distinct from A-shape was a
      // cosmetic dedup-breaker with no real fingering benefit. A-shape covers
      // the lower-neck dim voicing in its own physical fingering.
      expect(matches.find((m) => m.shape === "C")).toBeUndefined();
      expect(matches.find((m) => m.shape === "A")).toBeDefined();
    });

    it("G-shape dim is omitted — E-shape covers the upper-neck dim voicing", () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "B",
        chordType: "dim",
        tuning: STANDARD_TUNING,
        maxFret: 12,
      });
      expect(matches.find((m) => m.shape === "G")).toBeUndefined();
      expect(matches.find((m) => m.shape === "E")).toBeDefined();
    });
  });

  describe("dim7 CAGED templates", () => {
    // Only E-shape remains after audit — C, A, G, D shapes are close-voicing duplicates
    // per docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md.
    for (const { shape, root, expected } of [
      { shape: "E", root: "E", expected: new Set(["E", "G", "A#", "C#"]) },
    ] as const) {
      it(`resolves a ${root}dim7 ${shape}-shape voicing`, () => {
        const matches = getFullChordShapeMatches({
          chordRoot: root,
          chordType: "dim7",
          tuning: STANDARD_TUNING,
          maxFret: 15,
        });
        const found = matches.find((m) => m.shape === shape);
        expect(found, `expected a ${shape}-shape match for ${root}dim7`).toBeDefined();
        const pcs = new Set(found!.notes.map((n) => n.noteName));
        expect(pcs).toEqual(expected);
      });
    }

    it("C-shape dim7 is omitted — identical to a close voicing (audit-driven)", () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "B",
        chordType: "dim7",
        tuning: STANDARD_TUNING,
        maxFret: 24,
      });
      expect(matches.find((m) => m.shape === "C")).toBeUndefined();
    });

    it("A-shape dim7 is omitted — identical to a close voicing (audit-driven)", () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "B",
        chordType: "dim7",
        tuning: STANDARD_TUNING,
        maxFret: 24,
      });
      expect(matches.find((m) => m.shape === "A")).toBeUndefined();
    });

    it("G-shape dim7 is omitted — identical to a close voicing (audit-driven)", () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "B",
        chordType: "dim7",
        tuning: STANDARD_TUNING,
        maxFret: 24,
      });
      expect(matches.find((m) => m.shape === "G")).toBeUndefined();
    });

    it("D-shape dim7 is omitted — identical to a close voicing (audit-driven)", () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "B",
        chordType: "dim7",
        tuning: STANDARD_TUNING,
        maxFret: 24,
      });
      expect(matches.find((m) => m.shape === "D")).toBeUndefined();
    });

    // Note: A-shape dim7 and G-shape dim7 were previously documented here with
    // specific voicing assertions. Both were removed as close-voicing duplicates
    // per the 2026-05-26 audit; their absence is now covered by the "is omitted"
    // tests above.
  });

  describe("m7b5 CAGED templates", () => {
    for (const { shape, root, expected } of [
      { shape: "C", root: "C", expected: new Set(["C", "D#", "F#", "A#"]) },
      { shape: "A", root: "A", expected: new Set(["A", "C", "D#", "G"]) },
      { shape: "E", root: "E", expected: new Set(["E", "G", "A#", "D"]) },
      { shape: "D", root: "D", expected: new Set(["D", "F", "G#", "C"]) },
    ] as const) {
      it(`resolves a ${root}m7b5 ${shape}-shape voicing`, () => {
        const matches = getFullChordShapeMatches({
          chordRoot: root,
          chordType: "m7b5",
          tuning: STANDARD_TUNING,
          maxFret: 15,
        });
        const found = matches.find((m) => m.shape === shape);
        expect(found, `expected a ${shape}-shape match for ${root}m7b5`).toBeDefined();
        const pcs = new Set(found!.notes.map((n) => n.noteName));
        expect(pcs).toEqual(expected);
      });
    }

    it("G-shape m7b5 is omitted — voicing required muting non-adjacent strings", () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "B",
        chordType: "m7b5",
        tuning: STANDARD_TUNING,
        maxFret: 12,
      });
      expect(matches.find((m) => m.shape === "G")).toBeUndefined();
    });
  });

  describe("maj7 CAGED templates", () => {
    for (const shape of ["C", "A", "G", "E", "D"] as const) {
      it(`resolves a Cmaj7 ${shape}-shape voicing whose pitch classes are {C, E, G, B}`, () => {
        const matches = getFullChordShapeMatches({
          chordRoot: "C",
          chordType: "maj7",
          tuning: STANDARD_TUNING,
          maxFret: 15,
        });
        const found = matches.find((m) => m.shape === shape);
        expect(found, `expected a ${shape}-shape match for Cmaj7`).toBeDefined();
        const pcs = new Set(found!.notes.map((n) => n.noteName));
        expect(pcs).toEqual(new Set(["C", "E", "G", "B"]));
      });
    }
  });

  describe("sus4 CAGED templates", () => {
    for (const { shape, root, expected } of [
      { shape: "C", root: "C", expected: new Set(["C", "F", "G"]) },
      { shape: "A", root: "A", expected: new Set(["A", "D", "E"]) },
      { shape: "G", root: "G", expected: new Set(["G", "C", "D"]) },
      { shape: "E", root: "E", expected: new Set(["E", "A", "B"]) },
      { shape: "D", root: "D", expected: new Set(["D", "G", "A"]) },
    ] as const) {
      it(`resolves a ${root}sus4 ${shape}-shape voicing`, () => {
        const matches = getFullChordShapeMatches({
          chordRoot: root,
          chordType: "sus4",
          tuning: STANDARD_TUNING,
          maxFret: 15,
        });
        const found = matches.find((m) => m.shape === shape);
        expect(found, `expected a ${shape}-shape match for ${root}sus4`).toBeDefined();
        const pcs = new Set(found!.notes.map((n) => n.noteName));
        expect(pcs).toEqual(expected);
      });
    }
  });

  describe("sus2 CAGED templates", () => {
    for (const { shape, root, expected } of [
      { shape: "C", root: "C", expected: new Set(["C", "D", "G"]) },
      { shape: "A", root: "A", expected: new Set(["A", "B", "E"]) },
      { shape: "G", root: "G", expected: new Set(["G", "A", "D"]) },
      { shape: "E", root: "E", expected: new Set(["E", "F#", "B"]) },
      { shape: "D", root: "D", expected: new Set(["D", "E", "A"]) },
    ] as const) {
      it(`resolves a ${root}sus2 ${shape}-shape voicing`, () => {
        const matches = getFullChordShapeMatches({
          chordRoot: root,
          chordType: "sus2",
          tuning: STANDARD_TUNING,
          maxFret: 15,
        });
        const found = matches.find((m) => m.shape === shape);
        expect(found, `expected a ${shape}-shape match for ${root}sus2`).toBeDefined();
        const pcs = new Set(found!.notes.map((n) => n.noteName));
        expect(pcs).toEqual(expected);
      });
    }
  });

  it("D-shape 7 is omitted — identical to a close voicing (audit-driven)", () => {
    const matches = getFullChordShapeMatches({
      chordRoot: "D",
      chordType: "7",
      tuning: STANDARD_TUNING,
      maxFret: 24,
    });
    expect(matches.find((m) => m.shape === "D")).toBeUndefined();
  });

  describe("m7 CAGED templates", () => {
    // Expected pitch classes per canonical root (sharps convention):
    //   Cm7 = {C, D#, G, A#}   Am7 = {A, C, E, G}
    //   Gm7 = {G, A#, D, F}    Em7 = {E, G, B, D}    Dm7 = {D, F, A, C}
    for (const { shape, root, expected } of [
      { shape: "C", root: "C", expected: new Set(["C", "D#", "G", "A#"]) },
      { shape: "A", root: "A", expected: new Set(["A", "C", "E", "G"]) },
      { shape: "G", root: "G", expected: new Set(["G", "A#", "D", "F"]) },
      { shape: "E", root: "E", expected: new Set(["E", "G", "B", "D"]) },
      { shape: "D", root: "D", expected: new Set(["D", "F", "A", "C"]) },
    ] as const) {
      it(`resolves a ${root}m7 ${shape}-shape voicing`, () => {
        const matches = getFullChordShapeMatches({
          chordRoot: root,
          chordType: "m7",
          tuning: STANDARD_TUNING,
          maxFret: 15,
        });
        const found = matches.find((m) => m.shape === shape);
        expect(found, `expected a ${shape}-shape match for ${root}m7`).toBeDefined();
        const pcs = new Set(found!.notes.map((n) => n.noteName));
        expect(pcs).toEqual(expected);
      });
    }
  });
});
