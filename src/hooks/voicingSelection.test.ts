import { describe, it, expect } from "vitest";
import type { Voicing, ShapePolygon } from "@fretflow/core";
import {
  selectCloseFallbacksForCagedPosition,
  selectCloseFallbacksForThreeNpsPosition,
  hasCloseFallbackForCagedPosition,
  hasCloseFallbackForThreeNpsPosition,
} from "./voicingSelection";

describe("selectCloseFallbacksForCagedPosition", () => {
  // Build a synthetic polygon whose per-string fret range is [3, 5] on strings 0..3.
  // distanceOutsidePolygon reads vertices[stringIndex].fret and
  // vertices[length-1-stringIndex].fret to derive [minFret, maxFret] per string.
  // With 6 vertices in a mirrored pattern (0..5 inner offset), strings 0..2 bracket
  // strings 5..3 — so for string 0, range = [vertices[0].fret, vertices[5].fret].
  const polygon: ShapePolygon = {
    shape: "C",
    truncated: false,
    vertices: [
      { stringIndex: 0, fret: 3 },
      { stringIndex: 1, fret: 3 },
      { stringIndex: 2, fret: 3 },
      { stringIndex: 3, fret: 5 },
      { stringIndex: 4, fret: 5 },
      { stringIndex: 5, fret: 5 },
    ],
  } as unknown as ShapePolygon;

  const inside: Voicing = {
    positionKeys: ["0-4", "1-3", "2-5"],
    notes: [
      { stringIndex: 0, fretIndex: 4, noteName: "G#", midi: 68 },
      { stringIndex: 1, fretIndex: 3, noteName: "D", midi: 62 },
      { stringIndex: 2, fretIndex: 5, noteName: "G", midi: 67 },
    ],
  };

  const outside: Voicing = {
    positionKeys: ["0-7", "1-3", "2-5"],
    notes: [
      { stringIndex: 0, fretIndex: 7, noteName: "B", midi: 71 },
      { stringIndex: 1, fretIndex: 3, noteName: "D", midi: 62 },
      { stringIndex: 2, fretIndex: 5, noteName: "G", midi: 67 },
    ],
  };

  it("returns voicings whose every fretted note lies inside the polygon", () => {
    const result = selectCloseFallbacksForCagedPosition([inside, outside], polygon);
    expect(result).toEqual([inside]);
  });

  it("returns empty when no candidate fits", () => {
    const result = selectCloseFallbacksForCagedPosition([outside], polygon);
    expect(result).toEqual([]);
  });

  it("accepts truncated polygons (their visible portion can host a close voicing)", () => {
    // The open D-shape at the nut is truncated but its visible portion at
    // fret 0-1 can still host an open-C close voicing. Without this, the
    // user sees the polygon outline with no notes inside it.
    const truncated = { ...polygon, truncated: true } as ShapePolygon;
    const result = selectCloseFallbacksForCagedPosition([inside], truncated);
    expect(result).toEqual([inside]);
  });
});

function vc(frets: Array<[number, number]>): Voicing {
  return {
    positionKeys: frets.map(([s, f]) => `${s}-${f}`),
    notes: frets.map(([s, f]) => ({ stringIndex: s, fretIndex: f, noteName: "X", midi: 0 })),
  };
}

// distanceOutsidePolygon only reads vertices[i].fret, so a minimal vertex list
// (6 left bounds then 6 mirrored right bounds) is enough. Box covering [lo, hi]
// on every string.
function boxPolygon(lo: number, hi: number): ShapePolygon {
  const vertices = [
    ...Array.from({ length: 6 }, () => ({ fret: lo })),
    ...Array.from({ length: 6 }, () => ({ fret: hi })),
  ];
  return { vertices } as unknown as ShapePolygon;
}

describe("selectCloseFallbacksForCagedPosition ranking", () => {
  it("returns fitting grips ordered best-first", () => {
    const box = boxPolygon(0, 5);
    const wide = vc([[0, 1], [1, 4], [2, 4]]); // span 3
    const compact = vc([[0, 1], [1, 2], [2, 2]]); // span 1 — better
    const out = selectCloseFallbacksForCagedPosition([wide, compact], box);
    expect(out.length).toBe(2);
    expect(out[0]).toBe(compact);
  });

  it("still excludes grips with any note outside the polygon", () => {
    const box = boxPolygon(0, 3);
    const outside = vc([[0, 1], [1, 5], [2, 2]]); // fret 5 > 3
    expect(selectCloseFallbacksForCagedPosition([outside], box)).toEqual([]);
  });
});

describe("selectCloseFallbacksForThreeNpsPosition", () => {
  // Represents strings 0–5 all sharing frets 5–7 (the diagonal pattern's position keys).
  const patternPositions = new Set<string>([
    "0-5", "0-6", "0-7",
    "1-5", "1-6", "1-7",
    "2-5", "2-6", "2-7",
    "3-5", "3-6", "3-7",
    "4-5", "4-6", "4-7",
    "5-5", "5-6", "5-7",
  ]);

  const inside: Voicing = {
    positionKeys: ["1-6", "2-7"],
    notes: [
      { stringIndex: 1, fretIndex: 6, noteName: "F", midi: 65 },
      { stringIndex: 2, fretIndex: 7, noteName: "B", midi: 71 },
    ],
  };

  const outside: Voicing = {
    positionKeys: ["1-9", "2-7"],
    notes: [
      { stringIndex: 1, fretIndex: 9, noteName: "G#", midi: 68 },
      { stringIndex: 2, fretIndex: 7, noteName: "B", midi: 71 },
    ],
  };

  it("returns voicings whose every note is a member of the diagonal pattern position set", () => {
    const result = selectCloseFallbacksForThreeNpsPosition([inside, outside], patternPositions);
    expect(result).toEqual([inside]);
  });

  it("returns empty when no candidate fits the pattern", () => {
    const result = selectCloseFallbacksForThreeNpsPosition([outside], patternPositions);
    expect(result).toEqual([]);
  });
});

describe("hasCloseFallback existence helpers", () => {
  it("hasCloseFallbackForCagedPosition is true iff a candidate fits the polygon", () => {
    const box = boxPolygon(0, 3);
    const fits = vc([[0, 1], [1, 2], [2, 2]]);
    const outside = vc([[0, 1], [1, 5], [2, 2]]); // fret 5 > 3
    expect(hasCloseFallbackForCagedPosition([fits, outside], box)).toBe(true);
    expect(hasCloseFallbackForCagedPosition([outside], box)).toBe(false);
    expect(hasCloseFallbackForCagedPosition([], box)).toBe(false);
  });

  it("hasCloseFallbackForThreeNpsPosition is true iff a candidate fits the pattern", () => {
    const patternPositions = new Set<string>(["0-5", "1-6", "2-7"]);
    const fits = vc([[1, 6], [2, 7]]);
    const outside = vc([[1, 9], [2, 7]]);
    expect(hasCloseFallbackForThreeNpsPosition([fits, outside], patternPositions)).toBe(true);
    expect(hasCloseFallbackForThreeNpsPosition([outside], patternPositions)).toBe(false);
  });

  it("hasCloseFallbackForThreeNpsPosition mirrors the size-0 passthrough (any candidate counts)", () => {
    const empty = new Set<string>();
    expect(hasCloseFallbackForThreeNpsPosition([vc([[0, 3]])], empty)).toBe(true);
    expect(hasCloseFallbackForThreeNpsPosition([], empty)).toBe(false);
  });
});
