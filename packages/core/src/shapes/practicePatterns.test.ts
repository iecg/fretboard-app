import { describe, it, expect } from "vitest";
import {
  getOneStringCoordinates,
  getTwoStringsCoordinates,
  getTwoStringsIntervalPairs,
  getOneStringIntervalPairs,
} from "./practicePatterns";
import { getFretboardNotes } from "../guitar";
import { getScaleNotes, SCALES, normalizeScaleName } from "../theory";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const ROOT = "C";
const SCALE = "major"; // C D E F G A B
// STANDARD_TUNING from guitar.ts: high-E (index 0) to low-E (index 5), with octaves.
const STANDARD_TUNING = ["E4", "B3", "G3", "D3", "A2", "E2"];
const FRETS = 24;

// Pre-computed helpers used in assertions
const C_MAJOR_NOTES = new Set(getScaleNotes(ROOT, SCALE));
const C_MAJOR_SEMITONES: ReadonlyArray<number> = SCALES[normalizeScaleName(SCALE)]!;
const BOARD = getFretboardNotes(STANDARD_TUNING, FRETS);

/** Extracts the string index from a "string-fret" coordinate. */
function coordString(coord: string): number {
  return parseInt(coord.split("-")[0], 10);
}

/** Extracts the fret number from a "string-fret" coordinate. */
function coordFret(coord: string): number {
  return parseInt(coord.split("-")[1], 10);
}

/** Returns the note name for a coordinate on the standard tuning board. */
function noteAt(coord: string): string {
  const s = coordString(coord);
  const f = coordFret(coord);
  return BOARD[s][f];
}

// ---------------------------------------------------------------------------
// getOneStringCoordinates
// ---------------------------------------------------------------------------

describe("getOneStringCoordinates", () => {
  it("returns coordinates only on the requested string (string 0, high-E)", () => {
    const result = getOneStringCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((coord) => {
      expect(coordString(coord)).toBe(0);
    });
  });

  it("returns only scale notes on string 0", () => {
    const result = getOneStringCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });

  it("returns coordinates only on the requested string (string 5, low-E)", () => {
    const result = getOneStringCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 5);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((coord) => {
      expect(coordString(coord)).toBe(5);
    });
  });

  it("returns [] for out-of-range stringIndex (6)", () => {
    expect(getOneStringCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 6)).toEqual([]);
  });

  it("returns [] for negative stringIndex (-1)", () => {
    expect(getOneStringCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, -1)).toEqual([]);
  });

  it("returns correct count for string 2 (G string, open G is in C major)", () => {
    const result = getOneStringCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 2);
    // G is in C major, so fret 0 on G string should be included
    expect(result).toContain("2-0");
  });
});

// ---------------------------------------------------------------------------
// getTwoStringsCoordinates
// ---------------------------------------------------------------------------

describe("getTwoStringsCoordinates", () => {
  it("returns coordinates only from strings 0 and 1 for tuple [0,1]", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, [0, 1]);
    expect(result.length).toBeGreaterThan(0);
    const stringIndices = new Set(result.map(coordString));
    expect(stringIndices.has(0)).toBe(true);
    expect(stringIndices.has(1)).toBe(true);
    result.forEach((coord) => {
      expect(coordString(coord)).toBeLessThanOrEqual(1);
    });
  });

  it("covers both strings for tuple [0,1]", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, [0, 1]);
    const strings = new Set(result.map(coordString));
    expect(strings.has(0)).toBe(true);
    expect(strings.has(1)).toBe(true);
  });

  it("returns coordinates only from strings 3 and 4 for tuple [3,4]", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, [3, 4]);
    result.forEach((coord) => {
      const s = coordString(coord);
      expect(s === 3 || s === 4).toBe(true);
    });
  });

  it("returns only scale notes", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, [1, 2]);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });

  it("returns [] for out-of-range tuple [5,6]", () => {
    expect(getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, [5, 6])).toEqual([]);
  });

  it("supports skip-one tuple [0,2] for 6ths topology", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, [0, 2]);
    const strings = new Set(result.map(coordString));
    expect(strings.has(0)).toBe(true);
    expect(strings.has(2)).toBe(true);
    expect(strings.has(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTwoStringsIntervalPairs — SD-based predicate (UAT-14)
// ---------------------------------------------------------------------------

describe("getTwoStringsIntervalPairs", () => {
  it("returns [] for out-of-range stringTuple (negative)", () => {
    const result = getTwoStringsIntervalPairs([-1, 0], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result).toEqual([]);
  });

  it("returns [] for out-of-range stringTuple (>= board.length)", () => {
    const result = getTwoStringsIntervalPairs([BOARD.length, 0], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result).toEqual([]);
  });

  it("returns pairs with { a, b } shape in string-fret format (3rds, tuple [0,1])", () => {
    const result = getTwoStringsIntervalPairs([0, 1], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((pair) => {
      expect(pair.a).toMatch(/^\d+-\d+$/);
      expect(pair.b).toMatch(/^\d+-\d+$/);
    });
  });

  it("pair.a is always on stringTuple[0] and pair.b is on stringTuple[1]", () => {
    const tuple = [1, 2] as const;
    const result = getTwoStringsIntervalPairs(tuple, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((pair) => {
      expect(coordString(pair.a)).toBe(tuple[0]);
      expect(coordString(pair.b)).toBe(tuple[1]);
    });
  });

  it("returns [] when scale has no matching interval pairs (empty scale set)", () => {
    const emptyScale = new Set<string>();
    const result = getTwoStringsIntervalPairs([0, 1], BOARD, emptyScale, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result).toEqual([]);
  });

  it("all pair members are in the scale", () => {
    const result = getTwoStringsIntervalPairs([0, 1], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    result.forEach((pair) => {
      expect(C_MAJOR_NOTES.has(noteAt(pair.a))).toBe(true);
      expect(C_MAJOR_NOTES.has(noteAt(pair.b))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // UAT-14 regression: SD predicate captures both minor and major variants
  // ---------------------------------------------------------------------------

  it("3rds (SD=2) in C major on [2,3] (G+D strings) produces 7 distinct lower-note scale-degrees (one per scale step)", () => {
    // C major has 7 notes. Every scale note should appear as a lower member of some 3rd pair,
    // wrapping around the octave. So we expect pairs covering all 7 scale degrees.
    const pairs = getTwoStringsIntervalPairs([2, 3], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(pairs.length).toBeGreaterThan(0);
    // Collect lower note names (pair.b = lower-pitched string 3 = D-string).
    const lowerNotes = new Set(pairs.map((p) => noteAt(p.b)));
    // All 7 C-major notes should appear as lower pair members over 24 frets.
    const allSevenPresent = ["C","D","E","F","G","A","B"].every((n) => lowerNotes.has(n));
    expect(allSevenPresent).toBe(true);
  });

  it("3rds (SD=2) in C major captures minor 3rd pairs (e.g. D-F, m3=3st) and major 3rd pairs (e.g. C-E, M3=4st)", () => {
    const pairs = getTwoStringsIntervalPairs([2, 3], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    const upperNotes = pairs.map((p) => noteAt(p.a));
    const lowerNotes = pairs.map((p) => noteAt(p.b));
    // C-E is a major 3rd (4 st): upper=C upper on string 2, lower=E lower on string 3
    // D-F is a minor 3rd (3 st): should also be captured by SD predicate
    // Just verify both C (chord root) and D (second scale step) appear as lower notes
    expect(lowerNotes).toContain("C");
    expect(lowerNotes).toContain("D");
    // And both E and F appear as upper notes
    expect(upperNotes).toContain("E");
    expect(upperNotes).toContain("F");
  });

  it("3rds (SD=2) in C major: 3rds pairs count is >= 7 (one per scale degree across the neck)", () => {
    // With SD predicate, all 7 scale degrees generate at least one pair match.
    const pairs = getTwoStringsIntervalPairs([2, 3], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(pairs.length).toBeGreaterThanOrEqual(7);
  });

  it("6ths (SD=5) in C major captures both minor 6th (m6=8st) and major 6th (M6=9st) pairs", () => {
    // 6ths uses skip-one string pair (0, 2) = E4+G3 strings
    const pairs = getTwoStringsIntervalPairs([0, 2], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 5, STANDARD_TUNING);
    expect(pairs.length).toBeGreaterThan(0);
    // Collect all lower notes — all 7 scale degrees should appear (both m6 and M6 captured)
    const lowerNotes = new Set(pairs.map((p) => noteAt(p.b)));
    const allSevenPresent = ["C","D","E","F","G","A","B"].every((n) => lowerNotes.has(n));
    expect(allSevenPresent).toBe(true);
  });

  it("4ths (SD=3) in C major yields non-empty results including P4 pairs", () => {
    const pairs = getTwoStringsIntervalPairs([2, 3], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 3, STANDARD_TUNING);
    expect(pairs.length).toBeGreaterThan(0);
    // P4 = 5st. Verify directional: pitchA > pitchB for all pairs.
    pairs.forEach((pair) => {
      const fA = coordFret(pair.a);
      const fB = coordFret(pair.b);
      // G3-string pitch = 43 + fA; D3-string pitch = 38 + fB
      const pitchA = 43 + fA;
      const pitchB = 38 + fB;
      expect(pitchA).toBeGreaterThan(pitchB);
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: 3rds and 4ths must be disjoint (different SD distances)
  // ---------------------------------------------------------------------------

  it("3rds (SD=2) and 4ths (SD=3) produce disjoint pair sets on [2,3]", () => {
    const thirds = getTwoStringsIntervalPairs([2, 3], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    const fourths = getTwoStringsIntervalPairs([2, 3], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 3, STANDARD_TUNING);
    expect(thirds.length).toBeGreaterThan(0);
    expect(fourths.length).toBeGreaterThan(0);
    const thirdKeys = new Set(thirds.map((p) => `${p.a}|${p.b}`));
    const fourthKeys = new Set(fourths.map((p) => `${p.a}|${p.b}`));
    for (const key of fourthKeys) {
      expect(thirdKeys.has(key)).toBe(false);
    }
  });

  // ---------------------------------------------------------------------------
  // Pentatonic regression: SD predicate works for non-diatonic scales
  // ---------------------------------------------------------------------------

  it("3rds (SD=2) in C major pentatonic (5-note) produces all 5 lower notes", () => {
    // C major pentatonic: C D E G A (5 notes). SD=2 covers both minor and major 3rds.
    const pentNotes = new Set(getScaleNotes("C", "major pentatonic"));
    const pentSemitones = SCALES[normalizeScaleName("major pentatonic")]!;
    const pairs = getTwoStringsIntervalPairs([0, 1], BOARD, pentNotes, pentSemitones, 2, STANDARD_TUNING);
    expect(pairs.length).toBeGreaterThan(0);
    const lowerNotes = new Set(pairs.map((p) => noteAt(p.b)));
    // All 5 pentatonic notes appear as lower members
    const allFivePresent = ["C","D","E","G","A"].every((n) => lowerNotes.has(n));
    expect(allFivePresent).toBe(true);
  });

  it("3rds (SD=2) in C minor pentatonic (5-note) yields pairs", () => {
    // C minor pentatonic: C Eb F G Bb (using sharps: C D# F G A#)
    const pentNotes = new Set(getScaleNotes("C", "minor pentatonic"));
    const pentSemitones = SCALES[normalizeScaleName("minor pentatonic")]!;
    const pairs = getTwoStringsIntervalPairs([0, 1], BOARD, pentNotes, pentSemitones, 2, STANDARD_TUNING);
    expect(pairs.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // UAT-R05-wrap regression: non-wrapping ladder distance
  // ---------------------------------------------------------------------------

  it("getTwoStringsIntervalPairs uses non-wrapping ladder distance (regression UAT-R05-wrap)", () => {
    // Tuple [3, 4] = D3 string (higher-pitched, index 3) + A2 string (lower-pitched, index 4).
    // STANDARD_TUNING: ["E4","B3","G3","D3","A2","E2"]
    //   D3 string: absolutePitch = 38 + fret
    //   A2 string: absolutePitch = 33 + fret
    //
    // Case 1: C-E simple 3rd (2 ladder steps apart).
    //   E on D3 at fret 2 → pitch 40 (E3)
    //   C on A2 at fret 3 → pitch 36 (C3)
    //   sdStepsBetween(36, 40) = D(38) + E(40) = 2 → SD=2. Must match target=2.
    const pairs2 = getTwoStringsIntervalPairs([3, 4], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    const pair3rdKeys = new Set(pairs2.map((p) => `${p.a}|${p.b}`));
    // "3-2|4-3" = E3 on D-string | C3 on A-string — simple 3rd, must be included.
    expect(pair3rdKeys.has("3-2|4-3")).toBe(true);

    // Case 2: C-E spanning a 10th (9 ladder steps, one octave + 3rd).
    //   E on D3 at fret 14 → pitch 52 (E4)
    //   C on A2 at fret 3  → pitch 36 (C3)
    //   sdStepsBetween(36, 52) = D,E,F,G,A,B,C,D,E = 9 → SD=9. Must NOT match target=2.
    const keyTenth = "3-14|4-3";
    expect(pair3rdKeys.has(keyTenth)).toBe(false);

    // Case 3: 6ths (target=5) — only pairs with exactly 5 ladder steps are matched.
    //   Any pair with 9 ladder steps (an octave + 6th) must not appear in target=5 results.
    const pairs5 = getTwoStringsIntervalPairs([3, 4], BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 5, STANDARD_TUNING);
    const pair6thKeys = new Set(pairs5.map((p) => `${p.a}|${p.b}`));
    // Verify none of the 3rd pairs bleed into the 6ths result (disjoint sets).
    for (const key of pair3rdKeys) {
      expect(pair6thKeys.has(key)).toBe(false);
    }
    // And target=5 results must be non-empty (6ths exist on this string pair).
    expect(pairs5.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getOneStringIntervalPairs (UAT-18)
// ---------------------------------------------------------------------------

describe("getOneStringIntervalPairs", () => {
  // String 5 = low-E (E2 in standard tuning, absolutePitch base = 2*12+4 = 28)
  const STRING_IDX = 5;

  it("returns [] for out-of-range stringIndex", () => {
    expect(getOneStringIntervalPairs(6, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING)).toEqual([]);
    expect(getOneStringIntervalPairs(-1, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING)).toEqual([]);
  });

  it("returns pairs with { a, b } shape in string-fret format for 3rds on string 5", () => {
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((pair) => {
      expect(pair.a).toMatch(/^\d+-\d+$/);
      expect(pair.b).toMatch(/^\d+-\d+$/);
    });
  });

  it("both pair members are on the correct string index", () => {
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((pair) => {
      expect(coordString(pair.a)).toBe(STRING_IDX);
      expect(coordString(pair.b)).toBe(STRING_IDX);
    });
  });

  it("pair.a fret is always > pair.b fret (a = higher-fret / higher-pitched member)", () => {
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((pair) => {
      expect(coordFret(pair.a)).toBeGreaterThan(coordFret(pair.b));
    });
  });

  it("all pair members are scale notes", () => {
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    result.forEach((pair) => {
      expect(C_MAJOR_NOTES.has(noteAt(pair.a))).toBe(true);
      expect(C_MAJOR_NOTES.has(noteAt(pair.b))).toBe(true);
    });
  });

  it("3rds (SD=2) on string 5 returns non-empty results for C major", () => {
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
  });

  it("4ths (SD=3) on string 5 returns non-empty results for C major", () => {
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 3, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
  });

  it("6ths (SD=5) on string 5 returns non-empty results for C major", () => {
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 5, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
  });

  it("3rds, 4ths, 6ths produce disjoint pair sets (different SD distances)", () => {
    const thirds = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    const fourths = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 3, STANDARD_TUNING);
    const sixths = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 5, STANDARD_TUNING);
    const thirdKeys = new Set(thirds.map((p) => `${p.a}|${p.b}`));
    const fourthKeys = new Set(fourths.map((p) => `${p.a}|${p.b}`));
    const sixthKeys = new Set(sixths.map((p) => `${p.a}|${p.b}`));
    for (const k of fourthKeys) expect(thirdKeys.has(k)).toBe(false);
    for (const k of sixthKeys) expect(thirdKeys.has(k)).toBe(false);
    for (const k of sixthKeys) expect(fourthKeys.has(k)).toBe(false);
  });

  it("non-wrapping: C-E spanning a 10th on string 5 is NOT matched as a 3rd (SD=2)", () => {
    // String 5 = E2 (absolutePitch base = 28).
    // E2 fret 0 → pitch 28; C fret 8 → pitch 36 (C3); E fret 12 → pitch 40 (E3); E fret 24 → pitch 52 (E4)
    // C at fret 8, E at fret 20 → pitches 36 and 48 → 12 semitones apart = octave, sdSteps = 7 (all scale degrees) → NOT a 3rd.
    // We verify by checking that no pair spans more than a single octave (12 semitones) for SD=2.
    const result = getOneStringIntervalPairs(STRING_IDX, BOARD, C_MAJOR_NOTES, C_MAJOR_SEMITONES, 2, STANDARD_TUNING);
    // E2 open = pitch 28. Fret 12 = pitch 40 (E3). Fret 0+12 = 12 semitones = 1 octave.
    // Any pair whose members are more than 6 semitones apart cannot be a diatonic 3rd (max M3 = 4 st).
    // Use absolute pitch difference as a proxy: a genuine diatonic 3rd is at most 4 semitones apart.
    result.forEach((pair) => {
      const fA = coordFret(pair.a);
      const fB = coordFret(pair.b);
      const pitchDiff = fA - fB; // on same string, fret diff = semitone diff
      // A diatonic 3rd spans at most 4 semitones (M3); pitchDiff must be <= 4
      expect(pitchDiff).toBeLessThanOrEqual(4);
    });
  });
});
