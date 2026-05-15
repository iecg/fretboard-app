import { describe, expect, it } from "vitest";
import {
  buildMetronomePattern,
  clipPatternToBeats,
  POP_STRUM_PATTERN,
  repeatPatternToBeats,
  ROOT_FIFTH_BASS_PATTERN,
  ROCK_DRUM_PATTERN,
} from "./patterns";
import {
  CHORD_PATTERNS,
  BASS_PATTERNS,
  DRUM_PATTERNS,
  DRUM_VARIATIONS,
  getChordPattern,
  getBassPattern,
  getDrumPattern,
} from "./patterns";

describe("clipPatternToBeats", () => {
  it("returns an empty array when no beats are available", () => {
    expect(clipPatternToBeats(POP_STRUM_PATTERN, 0)).toEqual([]);
    expect(clipPatternToBeats(POP_STRUM_PATTERN, -1)).toEqual([]);
  });

  it("keeps every hit that falls inside the beat window", () => {
    const clipped = clipPatternToBeats(POP_STRUM_PATTERN, 4);
    expect(clipped).toEqual(POP_STRUM_PATTERN);
  });

  it("drops hits past the available beats", () => {
    const clipped = clipPatternToBeats(POP_STRUM_PATTERN, 2);
    expect(clipped.every((h) => h.beat < 2)).toBe(true);
  });

  it("keeps a hit exactly on the boundary out — strict less-than", () => {
    // POP_STRUM_PATTERN has hits at 0, 1, 1.5, 2.5, 3, 3.5.
    const clipped = clipPatternToBeats(POP_STRUM_PATTERN, 3);
    expect(clipped.map((h) => h.beat)).toEqual([0, 1, 1.5, 2.5]);
  });
});

describe("repeatPatternToBeats", () => {
  it("repeats a one-bar strum pattern across a multi-bar step", () => {
    const repeated = repeatPatternToBeats(POP_STRUM_PATTERN, 8, 4);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5, 3, 3.5,
      4, 5, 5.5, 6.5, 7, 7.5,
    ]);
  });

  it("clips repeated pattern hits to partial final bars", () => {
    const repeated = repeatPatternToBeats(POP_STRUM_PATTERN, 5, 4);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5, 3, 3.5,
      4,
    ]);
  });

  it("uses the active meter as the repeat length", () => {
    const repeated = repeatPatternToBeats(POP_STRUM_PATTERN, 6, 3);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5,
      3, 4, 4.5, 5.5,
    ]);
  });
});

describe("buildMetronomePattern", () => {
  it("yields one click per beat", () => {
    expect(buildMetronomePattern(4)).toHaveLength(4);
    expect(buildMetronomePattern(3)).toHaveLength(3);
  });

  it("accents beat 1 only", () => {
    const ticks = buildMetronomePattern(4);
    expect(ticks[0].velocity).toBeGreaterThan(ticks[1].velocity);
    expect(ticks.slice(1).every((t) => t.velocity === ticks[1].velocity)).toBe(true);
  });

  it("returns an empty pattern for 0 beats", () => {
    expect(buildMetronomePattern(0)).toEqual([]);
  });
});

describe("ROCK_DRUM_PATTERN", () => {
  it("has kicks on beats 1 and 3", () => {
    expect(ROCK_DRUM_PATTERN.kicks.map((h) => h.beat)).toEqual([0, 2]);
  });

  it("has snares on beats 2 and 4 (the backbeat)", () => {
    expect(ROCK_DRUM_PATTERN.snares.map((h) => h.beat)).toEqual([1, 3]);
  });

  it("has eighth-note hats across the bar", () => {
    expect(ROCK_DRUM_PATTERN.hats).toHaveLength(8);
    expect(ROCK_DRUM_PATTERN.hats.map((h) => h.beat)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,
    ]);
  });
});

describe("ROOT_FIFTH_BASS_PATTERN", () => {
  it("uses the same beat grid as the kick pattern with root then fifth roles", () => {
    expect(ROOT_FIFTH_BASS_PATTERN).toEqual([
      { beat: 0, velocity: 1, note: "root" },
      { beat: 2, velocity: 0.85, note: "fifth" },
    ]);
  });
});

describe("pattern catalog", () => {
  it("has 6 chord patterns with unique IDs", () => {
    expect(CHORD_PATTERNS).toHaveLength(6);
    const ids = CHORD_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 6 bass patterns with unique IDs", () => {
    expect(BASS_PATTERNS).toHaveLength(6);
    const ids = BASS_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 7 drum patterns with unique IDs", () => {
    expect(DRUM_PATTERNS).toHaveLength(7);
    const ids = DRUM_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 3 drum variations with unique IDs", () => {
    expect(DRUM_VARIATIONS).toHaveLength(3);
    const ids = DRUM_VARIATIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all pattern beats are in range [0, 4)", () => {
    for (const p of CHORD_PATTERNS) {
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(4);
      }
    }
    for (const p of BASS_PATTERNS) {
      for (const h of p.hits) {
        expect(h.beat).toBeGreaterThanOrEqual(0);
        expect(h.beat).toBeLessThan(4);
      }
    }
    const drumPatterns = [
      ...DRUM_PATTERNS,
      ...DRUM_VARIATIONS.map((v) => v.pattern),
    ];
    for (const p of drumPatterns) {
      const lanes = [p.kicks, p.snares, p.hats, p.openHats, p.ride];
      for (const lane of lanes) {
        for (const h of lane ?? []) {
          expect(h.beat).toBeGreaterThanOrEqual(0);
          expect(h.beat).toBeLessThan(4);
        }
      }
    }
  });

  it("lookups return correct patterns", () => {
    expect(getChordPattern("pop-8ths")).toBeDefined();
    expect(getBassPattern("root-fifth")).toBeDefined();
    expect(getDrumPattern("rock")).toBeDefined();
  });
});
