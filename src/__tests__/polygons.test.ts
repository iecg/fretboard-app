import { describe, it, expect } from "vitest";
import {
  buildPolygonFromNotes,
  isShapeTruncated,
  wrapOvershootNotes,
  deduplicateAdjacentStrings,
  MAX_WRAP_OVERSHOOT,
} from "../shapes/polygons";
import { getFretboardNotes } from "../guitar";
import { STANDARD_TUNING } from "../guitar";

describe("buildPolygonFromNotes", () => {
  it("returns empty array when all strings have no notes (empty shape)", () => {
    const perStringNotes: number[][] = [[], [], [], [], [], []];
    const result = buildPolygonFromNotes(perStringNotes, 6, new Set());
    expect(result).toEqual([]);
  });

  it("returns 12 vertices when all 6 strings share a single fret (single-fret span)", () => {
    const perStringNotes: number[][] = [[5], [5], [5], [5], [5], [5]];
    const result = buildPolygonFromNotes(perStringNotes, 6, new Set());
    // 6 left-edge + 6 right-edge = 12 vertices
    expect(result).toHaveLength(12);
    for (const v of result) {
      expect(v.fret).toBe(5);
    }
  });

  it("returns empty array when all notes on every string are wrapped (wrapped-only string skipped)", () => {
    const perStringNotes: number[][] = [[5, 6]];
    const wrappedNotes = new Set(["0-5", "0-6"]);
    const result = buildPolygonFromNotes(perStringNotes, 1, wrappedNotes);
    expect(result).toEqual([]);
  });
});

describe("isShapeTruncated", () => {
  it("returns true when visible span equals exactly 50% of intended span (boundary)", () => {
    const result = isShapeTruncated(-2, 2, 0, 2);
    expect(result).toBe(true);
  });

  it("returns false when visible span is just above 50% of intended span", () => {
    const result = isShapeTruncated(-1, 3, 0, 3);
    expect(result).toBe(false);
  });

  it("returns false when intended span is zero (zero-span guard)", () => {
    const result = isShapeTruncated(5, 5, 5, 5);
    expect(result).toBe(false);
  });
});

describe("wrapOvershootNotes", () => {
  const layout = getFretboardNotes(STANDARD_TUNING, 24);
  const numStrings = STANDARD_TUNING.length;

  it("returns empty wrappedNotes when there is no overshoot", () => {
    const perStringNotes: number[][] = Array.from({ length: numStrings }, () => [5]);
    const { wrappedNotes } = wrapOvershootNotes(
      perStringNotes,
      layout,
      ["C", "D", "E", "F", "G", "A", "B"],
      5,
      9,
      5,
      9,
      24,
    );
    expect(wrappedNotes.size).toBe(0);
  });

  it("populates wrappedNotes when positive overshoot equals MAX_WRAP_OVERSHOOT (gate open)", () => {
    const frets = 24;
    const intendedMax = frets + MAX_WRAP_OVERSHOOT;
    const perStringNotes: number[][] = Array.from(
      { length: numStrings },
      () => [22],
    );
    const validNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const { wrappedNotes } = wrapOvershootNotes(
      perStringNotes,
      layout,
      validNotes,
      22,
      intendedMax,
      22,
      24,
      frets,
    );
    expect(wrappedNotes.size).toBeGreaterThan(0);
  });

  it("returns empty wrappedNotes when positive overshoot exceeds MAX_WRAP_OVERSHOOT (gate closed)", () => {
    const frets = 24;
    const intendedMax = frets + MAX_WRAP_OVERSHOOT + 1;
    const perStringNotes: number[][] = Array.from(
      { length: numStrings },
      () => [22],
    );
    const validNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const { wrappedNotes } = wrapOvershootNotes(
      perStringNotes,
      layout,
      validNotes,
      22,
      intendedMax,
      22,
      24,
      frets,
    );
    expect(wrappedNotes.size).toBe(0);
  });
});

describe("deduplicateAdjacentStrings", () => {
  it("removes the note with the greater neighbor-distance when the same note appears on adjacent strings", () => {
    const layout: string[][] = [
      ["C", "C#", "D", "D#", "A", "F", "A", "G", "G#", "B", "A#", "B", "C"],
      ["G", "G#", "D", "D#", "E", "A", "F#", "G", "G#", "B", "A#", "B", "C"],
    ];
    const perStringNotes: number[][] = [
      [4, 6], // string 0: "A" at fret 4, "A" at fret 6
      [5],    // string 1: "A" at fret 5
    ];
    deduplicateAdjacentStrings(perStringNotes, layout, null);
    expect(perStringNotes[1]).not.toContain(5);
    expect(perStringNotes[0]).toContain(4);
  });

  it("does NOT remove blue notes from adjacent strings (blue-note exemption)", () => {
    const layout: string[][] = [
      ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
      ["G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E", "A#", "B"],
    ];
    const perStringNotes: number[][] = [
      [10],
      [3],
    ];
    deduplicateAdjacentStrings(perStringNotes, layout, "A#");
    expect(perStringNotes[0]).toContain(10);
    expect(perStringNotes[1]).toContain(3);
  });
});
