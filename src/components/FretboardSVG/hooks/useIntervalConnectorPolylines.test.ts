import { describe, it, expect } from "vitest";
import { buildIntervalConnectorPolylines } from "./useIntervalConnectorPolylines";

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
});
