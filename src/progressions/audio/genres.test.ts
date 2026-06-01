import { describe, it, expect } from "vitest";
import { GENRE_STYLES, getGenreStyle } from "./genres";
import { getChordPattern, getBassPattern, getDrumPattern, getDrumVariation } from "./patterns";

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

  it("wires the funk genre to the chicken-scratch comp (not the 16th-note funk comp)", () => {
    expect(getGenreStyle("funk")!.chordPattern).not.toBe("funk-16th");
  });

  it("wires the funk genre to the chicken-scratch comp", () => {
    expect(getGenreStyle("funk")!.chordPattern).toBe("funk-scratch");
  });

  it("gives funk a James Brown pocket tempo", () => {
    const funk = getGenreStyle("funk")!;
    expect(funk.suggestedTempo).toBeGreaterThanOrEqual(104);
    expect(funk.suggestedTempo).toBeLessThanOrEqual(116);
    expect(funk.tempoRange[0]).toBeLessThanOrEqual(funk.suggestedTempo);
    expect(funk.tempoRange[1]).toBeGreaterThanOrEqual(funk.suggestedTempo);
  });

  it("wires bossa-nova to the clave drum, surdo bass, and partido-alto comp", () => {
    const bossa = getGenreStyle("bossa-nova")!;
    expect(bossa.chordPattern).toBe("bossa-comp");
    expect(bossa.bassPattern).toBe("bossa");
    expect(bossa.drumPattern).toBe("bossa");
  });
});

describe("genre drum variations", () => {
  it("wires per-bar-safe variations to funk, pop, and rock", () => {
    expect(getGenreStyle("funk")!.drumVariations).toContain("open-hat-and-of-4");
    expect(getGenreStyle("pop")!.drumVariations).toContain("open-hat-and-of-4");
    expect(getGenreStyle("rock")!.drumVariations).toContain("open-hat-and-of-4");
  });

  it("gives pop and rock a turnaround fill, and rock a phrase-start crash", () => {
    expect(getGenreStyle("pop")!.drumVariations).toContain("fill-every-4");
    expect(getGenreStyle("rock")!.drumVariations).toContain("fill-every-4");
    expect(getGenreStyle("rock")!.drumVariations).toContain("crash-bar-1");
  });

  it("gives funk, jazz, and blues their genre-tailored turnaround", () => {
    expect(getGenreStyle("funk")!.drumVariations).toContain("funk-fill-4");
    expect(getGenreStyle("jazz")!.drumVariations).toContain("jazz-turnaround-4");
    expect(getGenreStyle("blues")!.drumVariations).toContain("blues-fill-4");
  });

  it("leaves ballad and bossa-nova without drum variations", () => {
    expect(getGenreStyle("ballad")!.drumVariations).toEqual([]);
    expect(getGenreStyle("bossa-nova")!.drumVariations).toEqual([]);
  });

  it("keeps every referenced variation id resolvable", () => {
    for (const g of GENRE_STYLES) {
      for (const id of g.drumVariations) {
        expect(getDrumVariation(id), `genre ${g.id} variation ${id}`).toBeDefined();
      }
    }
  });
});
