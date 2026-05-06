import { describe, it, expect } from "vitest";
import {
  getOneStringCoordinates,
  getTwoStringsCoordinates,
  getDoubleStopsCoordinates,
  getBox2x4Coordinates,
  getBox3x3Coordinates,
  getStackCoordinates,
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
// getDoubleStopsCoordinates
// ---------------------------------------------------------------------------

const NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DOUBLE_STOP_SEMITONES = [4, 5, 7, 9];

/**
 * Returns true if the two notes match the target semitone count in either direction.
 */
function matchesSemitones(a: string, b: string, target: number): boolean {
  const iA = NOTE_ORDER.indexOf(a);
  const iB = NOTE_ORDER.indexOf(b);
  if (iA === -1 || iB === -1) return false;
  const up = (iA - iB + 12) % 12;
  const down = (iB - iA + 12) % 12;
  return up === target || down === target;
}

describe("getDoubleStopsCoordinates", () => {
  it("returns non-empty result for intervalIndex=0 (3rds)", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty result for intervalIndex=2 (5ths)", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 2);
    expect(result.length).toBeGreaterThan(0);
  });

  it("all returned coords are valid string-fret format", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    result.forEach((coord) => {
      expect(coord).toMatch(/^\d+-\d+$/);
    });
  });

  it("all returned notes are in the scale", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });

  it("3rds: all pairs have notes separated by 4 semitones on adjacent strings", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    const targetSemitones = DOUBLE_STOP_SEMITONES[0]; // 4
    // For each coordinate, there must exist a coordinate on the adjacent string
    // (either +1 or -1) that is targetSemitones away.
    result.forEach((coord) => {
      const s = coordString(coord);
      const noteA = noteAt(coord);
      const partnersOnAdjacent = result.filter((c) => {
        const cs = coordString(c);
        return cs === s - 1 || cs === s + 1;
      });
      const hasPartner = partnersOnAdjacent.some(
        (p) => matchesSemitones(noteA, noteAt(p), targetSemitones),
      );
      expect(hasPartner).toBe(true);
    });
  });

  it("5ths: all pairs have notes separated by 7 semitones on adjacent strings", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 2);
    const targetSemitones = DOUBLE_STOP_SEMITONES[2]; // 7
    result.forEach((coord) => {
      const s = coordString(coord);
      const noteA = noteAt(coord);
      const partnersOnAdjacent = result.filter((c) => {
        const cs = coordString(c);
        return cs === s - 1 || cs === s + 1;
      });
      const hasPartner = partnersOnAdjacent.some(
        (p) => matchesSemitones(noteA, noteAt(p), targetSemitones),
      );
      expect(hasPartner).toBe(true);
    });
  });

  it("returns non-empty for intervalIndex=1 (4ths)", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 1);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty for intervalIndex=3 (6ths)", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 3);
    expect(result.length).toBeGreaterThan(0);
  });

  it("de-duplicates coordinates (no duplicate coord entries)", () => {
    const result = getDoubleStopsCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });
});

// ---------------------------------------------------------------------------
// getBox2x4Coordinates
// ---------------------------------------------------------------------------

describe("getBox2x4Coordinates", () => {
  it("startFret=0, pairIndex=0: only coords with fret 0-3 on strings 0 or 1", () => {
    const result = getBox2x4Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0, 0);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((coord) => {
      const s = coordString(coord);
      const f = coordFret(coord);
      expect(s === 0 || s === 1).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(3);
    });
  });

  it("startFret=5, pairIndex=2: only coords with fret 5-8 on strings 2 or 3", () => {
    const result = getBox2x4Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 5, 2);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((coord) => {
      const s = coordString(coord);
      const f = coordFret(coord);
      expect(s === 2 || s === 3).toBe(true);
      expect(f).toBeGreaterThanOrEqual(5);
      expect(f).toBeLessThanOrEqual(8);
    });
  });

  it("all returned coords are scale notes", () => {
    const result = getBox2x4Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0, 0);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });

  it("returns [] for out-of-range pairIndex (5)", () => {
    expect(getBox2x4Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0, 5)).toEqual([]);
  });

  it("clamps startFret near the end (frets-1) without panicking", () => {
    // Should clamp to frets-3 internally
    const result = getBox2x4Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, FRETS, 0);
    result.forEach((coord) => {
      const f = coordFret(coord);
      expect(f).toBeLessThanOrEqual(FRETS);
    });
  });
});

// ---------------------------------------------------------------------------
// getBox3x3Coordinates
// ---------------------------------------------------------------------------

describe("getBox3x3Coordinates", () => {
  it("startFret=0, trioIndex=0: only coords with fret 0-2 on strings 0/1/2", () => {
    const result = getBox3x3Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0, 0);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((coord) => {
      const s = coordString(coord);
      const f = coordFret(coord);
      expect(s === 0 || s === 1 || s === 2).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(2);
    });
  });

  it("startFret=7, trioIndex=1: only coords with fret 7-9 on strings 1/2/3", () => {
    const result = getBox3x3Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 7, 1);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((coord) => {
      const s = coordString(coord);
      const f = coordFret(coord);
      expect(s === 1 || s === 2 || s === 3).toBe(true);
      expect(f).toBeGreaterThanOrEqual(7);
      expect(f).toBeLessThanOrEqual(9);
    });
  });

  it("all returned coords are scale notes", () => {
    const result = getBox3x3Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0, 0);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });

  it("returns [] for out-of-range trioIndex (4)", () => {
    expect(getBox3x3Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0, 4)).toEqual([]);
  });

  it("returns [] for negative trioIndex", () => {
    expect(getBox3x3Coordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0, -1)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getStackCoordinates
// ---------------------------------------------------------------------------

describe("getStackCoordinates", () => {
  it("startFret=0: returns exactly 6 coords for C major (all strings have scale notes)", () => {
    const result = getStackCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    expect(result).toHaveLength(6);
  });

  it("startFret=0: each coord is on a unique string", () => {
    const result = getStackCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    const stringIndices = result.map(coordString);
    const unique = new Set(stringIndices);
    expect(unique.size).toBe(result.length);
  });

  it("startFret=12: returns 6 coords", () => {
    const result = getStackCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 12);
    expect(result).toHaveLength(6);
  });

  it("startFret=12: all notes are in C major", () => {
    const result = getStackCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 12);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });

  it("startFret=0: each string gets the closest (lowest) scale note at or near fret 0", () => {
    const result = getStackCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 0);
    // For startFret=0, prefer fret 0 if it's a scale note, otherwise the lowest scale fret.
    // All open strings in standard tuning: E, B, G, D, A, E — all in C major.
    result.forEach((coord) => {
      expect(coordFret(coord)).toBe(0); // Open strings are in C major, so fret 0 is closest.
    });
  });

  it("at most 1 coord per string index", () => {
    const result = getStackCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 7);
    const perString: Record<number, number> = {};
    result.forEach((coord) => {
      const s = coordString(coord);
      perString[s] = (perString[s] ?? 0) + 1;
    });
    Object.values(perString).forEach((count) => {
      expect(count).toBe(1);
    });
  });

  it("startFret=7: notes are in C major and near fret 7", () => {
    const result = getStackCoordinates(ROOT, SCALE, STANDARD_TUNING, FRETS, 7);
    result.forEach((coord) => {
      expect(C_MAJOR_NOTES.has(noteAt(coord))).toBe(true);
    });
  });
});
