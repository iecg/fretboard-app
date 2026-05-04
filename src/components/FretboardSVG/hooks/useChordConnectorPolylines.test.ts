import { describe, it, expect } from "vitest";
import { buildChordConnectorPolylines, MAX_FRET_SPAN } from "./useChordConnectorPolylines";

// Geometry stubs: identity-like helpers for predictable test assertions.
// fretCenterX returns fret * 10 so we can spot-check x values.
// stringYAt returns stringIndex * 20 so we can spot-check y values.
const fretCenterX = (fi: number) => fi * 10;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stringYAt = (si: number, _x: number) => si * 20;

// Helper: build a minimal fretboardLayout with specific note placements.
// layout[si][fi] = noteName (or "" for empty).
function makeLayout(
  numStrings: number,
  numFrets: number,
  placements: { si: number; fi: number; note: string }[],
): string[][] {
  const layout: string[][] = Array.from({ length: numStrings }, () =>
    Array(numFrets).fill(""),
  );
  for (const { si, fi, note } of placements) {
    if (layout[si]) layout[si][fi] = note;
  }
  return layout;
}

describe("buildChordConnectorPolylines", () => {
  it("returns [] for empty chordTones", () => {
    const layout = makeLayout(6, 24, [{ si: 0, fi: 0, note: "C" }]);
    const result = buildChordConnectorPolylines([], layout, fretCenterX, stringYAt, 0, 24);
    expect(result).toEqual([]);
  });

  it("returns [] for a single matching position (no line possible)", () => {
    const layout = makeLayout(6, 24, [{ si: 0, fi: 5, note: "C" }]);
    const result = buildChordConnectorPolylines(["C"], layout, fretCenterX, stringYAt, 0, 24);
    expect(result).toEqual([]);
  });

  it("returns [] when chordTones don't match any layout cell", () => {
    const layout = makeLayout(6, 24, [{ si: 0, fi: 3, note: "D" }]);
    const result = buildChordConnectorPolylines(
      ["C", "E", "G"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    expect(result).toEqual([]);
  });

  it("triangle: 3-position chord within 5-fret window produces 1 polyline with 3 vertices", () => {
    // One note per string so sort is by stringIndex asc.
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 5, note: "C" },
      { si: 1, fi: 3, note: "E" },
      { si: 2, fi: 5, note: "G" },
    ]);
    const result = buildChordConnectorPolylines(
      ["C", "E", "G"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
    // Sorted by stringIndex asc: si0, si1, si2
    expect(result[0][0]).toEqual({ x: fretCenterX(5), y: stringYAt(0, fretCenterX(5)) });
    expect(result[0][1]).toEqual({ x: fretCenterX(3), y: stringYAt(1, fretCenterX(3)) });
    expect(result[0][2]).toEqual({ x: fretCenterX(5), y: stringYAt(2, fretCenterX(5)) });
  });

  it("quadrilateral: 4-position 7th chord within 5-fret window produces 1 polyline with 4 vertices", () => {
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 3, note: "G" },
      { si: 1, fi: 5, note: "B" },
      { si: 2, fi: 3, note: "D" },
      { si: 3, fi: 5, note: "F" },
    ]);
    const result = buildChordConnectorPolylines(
      ["G", "B", "D", "F"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(4);
  });

  it("multi-segment: two groups both >= 2 positions, separated by > MAX_FRET_SPAN, produces 2 polylines", () => {
    // Group 1: frets 1–3; Group 2: frets 10–12 (gap = 7 > MAX_FRET_SPAN).
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 1, note: "C" },
      { si: 1, fi: 3, note: "E" },
      { si: 2, fi: 10, note: "G" },
      { si: 3, fi: 12, note: "B" },
    ]);
    const result = buildChordConnectorPolylines(
      ["C", "E", "G", "B"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2);
    expect(result[1]).toHaveLength(2);
  });

  it("single note on far end gets filtered: only one segment with 2 notes survives", () => {
    // C and E close together; G far away (fret 12, gap = 9 > MAX_FRET_SPAN from E at 3).
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 2, note: "C" },
      { si: 1, fi: 3, note: "E" },
      { si: 2, fi: 12, note: "G" },
    ]);
    const result = buildChordConnectorPolylines(
      ["C", "E", "G"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    // Segment 1: [C(fret2), E(fret3)] → 2 vertices (kept).
    // Segment 2: [G(fret12)] → 1 vertex (filtered out).
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it("respects fret range: positions outside [startFret, endFret) are excluded", () => {
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 0, note: "C" }, // fret 0 excluded when startFret=1
      { si: 1, fi: 5, note: "E" },
      { si: 2, fi: 7, note: "G" },
    ]);
    const result = buildChordConnectorPolylines(
      ["C", "E", "G"],
      layout,
      fretCenterX,
      stringYAt,
      1, // startFret
      24,
    );
    // C at fret 0 is excluded; only E and G remain.
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it("positions on the same string are sorted by fret ascending", () => {
    // Two notes on same string — fretIndex 7 should come before fretIndex 9.
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 9, note: "E" },
      { si: 0, fi: 7, note: "C" },
    ]);
    const result = buildChordConnectorPolylines(
      ["C", "E"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0]).toEqual({ x: fretCenterX(7), y: stringYAt(0, fretCenterX(7)) });
    expect(result[0][1]).toEqual({ x: fretCenterX(9), y: stringYAt(0, fretCenterX(9)) });
  });

  it(`MAX_FRET_SPAN (${MAX_FRET_SPAN}) boundary: span of exactly 5 stays in same polyline`, () => {
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 2, note: "C" },
      { si: 1, fi: 7, note: "E" }, // distance = 5 = MAX_FRET_SPAN → same polyline
    ]);
    const result = buildChordConnectorPolylines(
      ["C", "E"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it("span of MAX_FRET_SPAN + 1 breaks into separate segments (both single → filtered out)", () => {
    const layout = makeLayout(6, 24, [
      { si: 0, fi: 2, note: "C" },
      { si: 1, fi: 2 + MAX_FRET_SPAN + 1, note: "E" }, // distance = 6 > MAX_FRET_SPAN → break
    ]);
    const result = buildChordConnectorPolylines(
      ["C", "E"],
      layout,
      fretCenterX,
      stringYAt,
      0,
      24,
    );
    // Each segment has only 1 vertex → both filtered out.
    expect(result).toHaveLength(0);
  });
});
