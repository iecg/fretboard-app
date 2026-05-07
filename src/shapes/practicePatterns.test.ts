import { describe, it, expect } from "vitest";
import {
  getOneStringCoordinates,
  getTwoStringsCoordinates,
  getTwoStringsIntervalPairs,
} from "./practicePatterns";
import { getFretboardNotes } from "../core/guitar";
import { getScaleNotes } from "../core/theory";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const ROOT = "C";
const SCALE = "Major"; // C D E F G A B
// STANDARD_TUNING from guitar.ts: high-E (index 0) to low-E (index 5), with octaves.
const STANDARD_TUNING = ["E4", "B3", "G3", "D3", "A2", "E2"];
const FRETS = 24;

// Pre-computed helpers used in assertions
const C_MAJOR_NOTES = new Set(getScaleNotes(ROOT, SCALE));
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
  it("returns coordinates only from strings 0 and 1 for pairIndex=0", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    expect(result.length).toBeGreaterThan(0);
    const stringIndices = new Set(result.map(coordString));
    expect(stringIndices.has(0)).toBe(true);
    expect(stringIndices.has(1)).toBe(true);
    result.forEach((coord) => {
      expect(coordString(coord)).toBeLessThanOrEqual(1);
    });
  });

  it("covers both strings for pairIndex=0", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    const strings = new Set(result.map(coordString));
    expect(strings.has(0)).toBe(true);
    expect(strings.has(1)).toBe(true);
  });

  it("returns coordinates only from strings 3 and 4 for pairIndex=3", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 3);
    result.forEach((coord) => {
      const s = coordString(coord);
      expect(s === 3 || s === 4).toBe(true);
    });
  });

  it("returns only scale notes", () => {
    const result = getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 1);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });

  it("returns [] for out-of-range pairIndex (5)", () => {
    expect(getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 5)).toEqual([]);
  });

  it("returns [] for negative pairIndex (-1)", () => {
    expect(getTwoStringsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, -1)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTwoStringsIntervalPairs
// ---------------------------------------------------------------------------

describe("getTwoStringsIntervalPairs", () => {
  it("returns [] for out-of-range pairIndex (negative)", () => {
    const result = getTwoStringsIntervalPairs(-1, BOARD, C_MAJOR_NOTES, 4, STANDARD_TUNING);
    expect(result).toEqual([]);
  });

  it("returns [] for out-of-range pairIndex (>= board.length - 1)", () => {
    const result = getTwoStringsIntervalPairs(BOARD.length, BOARD, C_MAJOR_NOTES, 4, STANDARD_TUNING);
    expect(result).toEqual([]);
  });

  it("returns pairs with { a, b } shape in string-fret format (3rds, pairIndex=0)", () => {
    const result = getTwoStringsIntervalPairs(0, BOARD, C_MAJOR_NOTES, 4, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((pair) => {
      expect(pair.a).toMatch(/^\d+-\d+$/);
      expect(pair.b).toMatch(/^\d+-\d+$/);
    });
  });

  it("pair.a is always on pairIndex string and pair.b is on pairIndex+1 string", () => {
    const pairIndex = 1;
    const result = getTwoStringsIntervalPairs(pairIndex, BOARD, C_MAJOR_NOTES, 4, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((pair) => {
      expect(coordString(pair.a)).toBe(pairIndex);
      expect(coordString(pair.b)).toBe(pairIndex + 1);
    });
  });

  it("returns non-empty result for 5ths (7 semitones) on pairIndex=0", () => {
    const result = getTwoStringsIntervalPairs(0, BOARD, C_MAJOR_NOTES, 7, STANDARD_TUNING);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns [] when scale has no matching interval pairs (empty scale set)", () => {
    const emptyScale = new Set<string>();
    const result = getTwoStringsIntervalPairs(0, BOARD, emptyScale, 4, STANDARD_TUNING);
    expect(result).toEqual([]);
  });

  it("all pair members are in the scale", () => {
    const result = getTwoStringsIntervalPairs(0, BOARD, C_MAJOR_NOTES, 4, STANDARD_TUNING);
    result.forEach((pair) => {
      expect(C_MAJOR_NOTES.has(noteAt(pair.a))).toBe(true);
      expect(C_MAJOR_NOTES.has(noteAt(pair.b))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: directional predicate — 4ths and 5ths must be disjoint
  // ---------------------------------------------------------------------------

  it("4ths (5 st) and 5ths (7 st) produce disjoint pair sets on pairIndex=2 (G+D strings)", () => {
    // pairIndex=2 → G3 (string 2) + D3 (string 3); wide range of scale-tone pairs.
    const fourths = getTwoStringsIntervalPairs(2, BOARD, C_MAJOR_NOTES, 5, STANDARD_TUNING);
    const fifths  = getTwoStringsIntervalPairs(2, BOARD, C_MAJOR_NOTES, 7, STANDARD_TUNING);

    expect(fourths.length).toBeGreaterThan(0);
    expect(fifths.length).toBeGreaterThan(0);

    // The two sets must differ in count or content — they cannot be equal.
    const fourthKeys = fourths.map((p) => `${p.a}|${p.b}`).sort();
    const fifthKeys  = fifths.map((p)  => `${p.a}|${p.b}`).sort();
    expect(fourthKeys).not.toEqual(fifthKeys);
  });

  it("4ths and 5ths have no pair in common on pairIndex=2", () => {
    const fourths = getTwoStringsIntervalPairs(2, BOARD, C_MAJOR_NOTES, 5, STANDARD_TUNING);
    const fifths  = getTwoStringsIntervalPairs(2, BOARD, C_MAJOR_NOTES, 7, STANDARD_TUNING);
    const fourthKeys = new Set(fourths.map((p) => `${p.a}|${p.b}`));
    const fifthKeys  = new Set(fifths.map((p)  => `${p.a}|${p.b}`));
    for (const key of fifthKeys) {
      expect(fourthKeys.has(key)).toBe(false);
    }
  });

  it("directional: each accepted pair satisfies pitch(a) - pitch(b) === target exactly", () => {
    // Verify using 5ths: higher string (pairIndex=2, G3) minus lower string (pairIndex+1=3, D3)
    // Each accepted pair should have pitch difference exactly 7.
    const fifths = getTwoStringsIntervalPairs(2, BOARD, C_MAJOR_NOTES, 7, STANDARD_TUNING);
    expect(fifths.length).toBeGreaterThan(0);
    fifths.forEach((pair) => {
      const fA = coordFret(pair.a);
      const fB = coordFret(pair.b);
      // G3 open = G at octave 3: index 7, pitch = 3*12+7 = 43.
      // D3 open = D at octave 3: index 2, pitch = 3*12+2 = 38.
      const pitchA = 43 + fA; // G3-string
      const pitchB = 38 + fB; // D3-string
      expect(pitchA - pitchB).toBe(7);
    });
  });
});

