import { describe, it, expect } from "vitest";
import { applyConnectorRadiusFloor, CHORD_CONNECTOR_RADIUS_FACTORS } from "./useChordConnectorPolylines";
import { buildIntervalConnectorPolylines } from "./useIntervalConnectorPolylines";
import { offsetOutlinePath } from "../utils/pathGeometry";

// Standard tuning (high-string-first, with octave markers).
const STANDARD_TUNING = ["E4", "B3", "G3", "D3", "A2", "E2"];

// Geometry stubs matching useChordConnectorPolylines.test.ts conventions.
const fretCenterX = (fi: number) => fi * 10;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stringYAt = (si: number, _x: number) => si * 20;
const STRING_ROW_PX = 36;

// C Major semitones (0-indexed from NOTES order: C=0, D=2, E=4, F=5, G=7, A=9, B=11)
const C_MAJOR_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

// Two pairs on string 5 (low E): two adjacent scale notes.
// "5-5" and "5-7" represent frets 5 (A) and 7 (B) on string 5.
const SAMPLE_PAIRS = [
  { a: "5-5", b: "5-7" },
  { a: "5-7", b: "5-9" },
  { a: "5-9", b: "5-10" },
  { a: "5-10", b: "5-12" },
];

function absolutePathPoints(path: string): Array<{ x: number; y: number }> {
  const tokens = path.split(/\s+/);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "M" || t === "L") {
      const x = Number(tokens[i + 1]);
      const y = Number(tokens[i + 2]);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    } else if (t === "A") {
      const x = Number(tokens[i + 6]);
      const y = Number(tokens[i + 7]);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    }
  }
  return points;
}

function yExtent(path: string): { minY: number; maxY: number } {
  const points = absolutePathPoints(path);
  return {
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

function yCenter(path: string): number {
  const { minY, maxY } = yExtent(path);
  return (minY + maxY) / 2;
}

describe("buildIntervalConnectorPolylines (UAT-24)", () => {
  it("returns empty array for empty intervalPairs", () => {
    const result = buildIntervalConnectorPolylines(
      [],
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    expect(result).toHaveLength(0);
  });

  it("each result entry has fill and outline path strings", () => {
    const result = buildIntervalConnectorPolylines(
      SAMPLE_PAIRS,
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(typeof entry.paths.fill).toBe("string");
      expect(entry.paths.fill.length).toBeGreaterThan(0);
      expect(typeof entry.paths.outline).toBe("string");
      expect(entry.paths.outline.length).toBeGreaterThan(0);
    }
  });

  it("fill and outline paths are byte-identical (same capsule path, two render passes)", () => {
    const result = buildIntervalConnectorPolylines(
      SAMPLE_PAIRS,
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    for (const entry of result) {
      expect(entry.paths.fill).toBe(entry.paths.outline);
    }
  });

  it("capsule path contains arc commands (A) — confirms rounded-cap shape primitive", () => {
    const result = buildIntervalConnectorPolylines(
      [{ a: "5-5", b: "5-9" }],
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    expect(result).toHaveLength(1);
    // offsetOutlinePath for 2 vertices produces a capsule with arc segments.
    expect(result[0]!.paths.fill).toMatch(/A/);
  });

  it("each result entry has a paletteIndex between 1 and 8", () => {
    const result = buildIntervalConnectorPolylines(
      SAMPLE_PAIRS,
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    for (const entry of result) {
      expect(entry.paletteIndex).toBeGreaterThanOrEqual(1);
      expect(entry.paletteIndex).toBeLessThanOrEqual(8);
    }
  });

  it("result entries do not have a strokeWidth field (UAT-24: stroke-width cycle reverted)", () => {
    const result = buildIntervalConnectorPolylines(
      SAMPLE_PAIRS,
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      // strokeWidth field must not exist on the output object
      expect("strokeWidth" in entry).toBe(false);
    }
  });

  it("each result entry has a stable string key derived from pair coords", () => {
    const result = buildIntervalConnectorPolylines(
      SAMPLE_PAIRS,
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    const keys = result.map((r) => r.key);
    // All keys are unique
    expect(new Set(keys).size).toBe(keys.length);
    // Key contains the coord strings joined by |
    expect(result[0]!.key).toContain("|");
  });

  it("keeps bridge-side top-string capsules inside the SVG y bounds", () => {
    const neckHeight = STRING_ROW_PX * 6;
    const bridgeStringYAt = () => 15.12;
    const bridgeFretCenterX = (fi: number) => 500 + fi * 24;

    const result = buildIntervalConnectorPolylines(
      [{ a: "0-12", b: "0-14" }],
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      bridgeFretCenterX,
      bridgeStringYAt,
      STRING_ROW_PX,
      { minY: 0, maxY: neckHeight },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.paths.fill).not.toMatch(/(?:^|[ ,])-[0-9]/);
  });

  it("staggered same-string pairs start large and alternate between two centered radii", () => {
    const result = buildIntervalConnectorPolylines(
      SAMPLE_PAIRS,
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
      { minY: 0, maxY: STRING_ROW_PX * 6 },
    );

    expect(result).toHaveLength(SAMPLE_PAIRS.length);
    const extents = result.map((entry) => yExtent(entry.paths.fill));
    const centers = result.map((entry) => yCenter(entry.paths.fill));
    expect(extents[0]!.maxY).toBeGreaterThan(extents[1]!.maxY);
    expect(extents[2]!.maxY).toBeCloseTo(extents[0]!.maxY);
    expect(extents[3]!.maxY).toBeCloseTo(extents[1]!.maxY);
    expect(extents[0]!.minY).toBeLessThan(extents[1]!.minY);
    expect(extents[2]!.minY).toBeCloseTo(extents[0]!.minY);
    centers.forEach((center) => expect(center).toBeCloseTo(stringYAt(5, fretCenterX(5))));
  });

  it("same-string top and bottom lanes stay centered and do not collapse at y bounds", () => {
    const neckHeight = STRING_ROW_PX * 6;
    const topStringYAt = () => 24;
    const bottomStringYAt = () => neckHeight - 24;
    const sameStringPairs = [
      { a: "0-2", b: "0-0" },
      { a: "0-4", b: "0-2" },
      { a: "0-5", b: "0-4" },
    ];

    const top = buildIntervalConnectorPolylines(
      sameStringPairs,
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      topStringYAt,
      STRING_ROW_PX,
      { minY: 0, maxY: neckHeight },
    );
    const bottom = buildIntervalConnectorPolylines(
      sameStringPairs.map((pair) => ({
        a: pair.a.replace("0-", "5-"),
        b: pair.b.replace("0-", "5-"),
      })),
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      bottomStringYAt,
      STRING_ROW_PX,
      { minY: 0, maxY: neckHeight },
    );

    expect(yExtent(top[0]!.paths.fill).maxY).toBeGreaterThan(yExtent(top[1]!.paths.fill).maxY);
    expect(yExtent(top[2]!.paths.fill).maxY).toBeCloseTo(yExtent(top[0]!.paths.fill).maxY);
    expect(yExtent(bottom[0]!.paths.fill).minY).toBeLessThan(yExtent(bottom[1]!.paths.fill).minY);
    expect(yExtent(bottom[2]!.paths.fill).minY).toBeCloseTo(yExtent(bottom[0]!.paths.fill).minY);
    top.forEach((entry) => expect(yCenter(entry.paths.fill)).toBeCloseTo(topStringYAt()));
    bottom.forEach((entry) => expect(yCenter(entry.paths.fill)).toBeCloseTo(bottomStringYAt()));
  });

  it("same-string smaller radius stays at the chord-root squircle floor away from edges", () => {
    const result = buildIntervalConnectorPolylines(
      [
        { a: "3-5", b: "3-7" },
        { a: "3-7", b: "3-9" },
      ],
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    const baseRadius = applyConnectorRadiusFloor(
      STRING_ROW_PX * CHORD_CONNECTOR_RADIUS_FACTORS.compact,
      STRING_ROW_PX,
    );
    const extent = yExtent(result[1]!.paths.fill);

    expect((extent.maxY - extent.minY) / 2).toBeCloseTo(baseRadius);
  });

  it("top-string fret-24 same-string connectors are edge capped without negative clipping", () => {
    const neckHeight = STRING_ROW_PX * 6;
    const bridgeStringYAt = () => 12;
    const bridgeFretCenterX = (fi: number) => 500 + fi * 24;

    const result = buildIntervalConnectorPolylines(
      [
        { a: "0-19", b: "0-21" },
        { a: "0-21", b: "0-22" },
        { a: "0-22", b: "0-24" },
      ],
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      bridgeFretCenterX,
      bridgeStringYAt,
      STRING_ROW_PX,
      { minY: 0, maxY: neckHeight },
    );

    expect(result).toHaveLength(3);
    const extents = result.map((entry) => yExtent(entry.paths.fill));
    extents.forEach((extent) => {
      expect(extent.minY).toBeGreaterThanOrEqual(0);
      expect(extent.maxY).toBeLessThanOrEqual(neckHeight);
    });
    expect((extents[0]!.maxY - extents[0]!.minY) / 2).toBeCloseTo(11);
  });

  it("two-string pairs keep the existing centered capsule path", () => {
    const result = buildIntervalConnectorPolylines(
      [{ a: "0-5", b: "1-5" }],
      STANDARD_TUNING,
      C_MAJOR_SEMITONES,
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
    );
    const baseRadius = applyConnectorRadiusFloor(
      STRING_ROW_PX * CHORD_CONNECTOR_RADIUS_FACTORS.compact,
      STRING_ROW_PX,
    );
    const expected = offsetOutlinePath(
      [
        { x: fretCenterX(5), y: stringYAt(0, fretCenterX(5)) },
        { x: fretCenterX(5), y: stringYAt(1, fretCenterX(5)) },
      ],
      baseRadius,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.paths.fill).toBe(expected);
  });
});
