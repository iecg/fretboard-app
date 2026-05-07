import { describe, it, expect } from "vitest";
import {
  getOneStringCoordinates,
  getTwoStringsCoordinates,
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

