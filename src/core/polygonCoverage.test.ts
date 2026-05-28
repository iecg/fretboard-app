import { describe, expect, it } from "vitest";
import { buildPolygonCoverage } from "./polygonCoverage";

describe("polygonCoverage", () => {
  it("collects covered string-fret keys for non-truncated polygons", () => {
    const coverage = buildPolygonCoverage([
      {
        shape: "C",
        color: "red",
        cagedLabel: "C",
        modalLabel: null,
        truncated: false,
        intendedMin: 3,
        intendedMax: 5,
        vertices: [
          { string: 0, fret: 3 },
          { string: 1, fret: 4 },
          { string: 1, fret: 5 },
          { string: 0, fret: 5 },
        ],
      },
    ], 24);

    expect(coverage.coveredPositions.has("0-3")).toBe(true);
    expect(coverage.coveredPositions.has("0-5")).toBe(true);
    expect(coverage.coveredPositions.has("1-4")).toBe(true);
    expect(coverage.coveredPositions.has("1-5")).toBe(true);
    expect(coverage.coveredPositions.has("1-3")).toBe(false);
    expect(coverage.stringRanges.get(0)).toEqual([{ minFret: 3, maxFret: 5 }]);
    expect(coverage.stringRanges.get(1)).toEqual([{ minFret: 4, maxFret: 5 }]);
  });

  it("covers truncated polygons' visible portion and clamps ranges to the fretboard", () => {
    const coverage = buildPolygonCoverage([
      {
        shape: "C",
        color: "red",
        cagedLabel: "C",
        modalLabel: null,
        truncated: true,
        intendedMin: 0,
        intendedMax: 3,
        vertices: [
          { string: 0, fret: 0 },
          { string: 1, fret: 1 },
          { string: 1, fret: 3 },
          { string: 0, fret: 4 },
        ],
      },
      {
        shape: "A",
        color: "blue",
        cagedLabel: "A",
        modalLabel: null,
        truncated: false,
        intendedMin: 21,
        intendedMax: 28,
        vertices: [
          { string: 0, fret: 21 },
          { string: 1, fret: 22 },
          { string: 1, fret: 28 },
          { string: 0, fret: 26 },
        ],
      },
    ], 24);

    // Truncated polygon's visible portion is now covered: a polygon drawn on
    // the fretboard should mark its on-board positions as covered so notes
    // inside it don't get dim-opacity treatment.
    expect(coverage.coveredPositions.has("0-0")).toBe(true);
    expect(coverage.coveredPositions.has("0-4")).toBe(true);
    expect(coverage.coveredPositions.has("1-1")).toBe(true);
    expect(coverage.coveredPositions.has("1-3")).toBe(true);
    // Non-truncated A-shape polygon, clamped to fret 24:
    expect(coverage.coveredPositions.has("0-24")).toBe(true);
    expect(coverage.coveredPositions.has("0-25")).toBe(false);
    expect(coverage.coveredPositions.has("1-24")).toBe(true);
    expect(coverage.stringRanges.get(0)).toEqual([
      { minFret: 0, maxFret: 4 },
      { minFret: 21, maxFret: 24 },
    ]);
    expect(coverage.stringRanges.get(1)).toEqual([
      { minFret: 1, maxFret: 3 },
      { minFret: 22, maxFret: 24 },
    ]);
  });
});
