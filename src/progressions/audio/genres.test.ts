import { describe, it, expect } from "vitest";
import { GENRE_STYLES, getGenreStyle } from "./genres";
import { getChordPattern, getBassPattern, getDrumPattern } from "./patterns";

describe("genre styles", () => {
  it("has 7 genre presets", () => {
    expect(GENRE_STYLES).toHaveLength(7);
  });

  it("has unique IDs", () => {
    const ids = GENRE_STYLES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references valid pattern IDs", () => {
    for (const genre of GENRE_STYLES) {
      expect(getChordPattern(genre.chordPattern)).toBeDefined();
      expect(getBassPattern(genre.bassPattern)).toBeDefined();
      expect(getDrumPattern(genre.drumPattern)).toBeDefined();
    }
  });

  it("has valid tempo ranges", () => {
    for (const genre of GENRE_STYLES) {
      expect(genre.tempoRange[0]).toBeLessThan(genre.tempoRange[1]);
      expect(genre.suggestedTempo).toBeGreaterThanOrEqual(genre.tempoRange[0]);
      expect(genre.suggestedTempo).toBeLessThanOrEqual(genre.tempoRange[1]);
    }
  });

  it("has swing in valid range", () => {
    for (const genre of GENRE_STYLES) {
      expect(genre.swing).toBeGreaterThanOrEqual(0);
      expect(genre.swing).toBeLessThanOrEqual(0.5);
    }
  });

  it("getGenreStyle returns correct genre", () => {
    expect(getGenreStyle("blues")?.label).toBe("Blues");
    expect(getGenreStyle("nonexistent")).toBeUndefined();
  });

  it("wires the rock genre to the driving pedal bass", () => {
    expect(getGenreStyle("rock")!.bassPattern).toBe("pedal");
  });
});
