import { describe, expect, it } from "vitest";
import {
  buildMetronomePattern,
  clipPatternToBeats,
  repeatPatternToBeats,
  CHORD_PATTERNS,
  BASS_PATTERNS,
  DRUM_PATTERNS,
  DRUM_VARIATIONS,
  getChordPattern,
  getBassPattern,
  getDrumPattern,
} from "./patterns";

// The "pop-8ths" chord pattern is the canonical 4/4 strum fixture used to
// exercise the clip/repeat utilities below.
const POP_8THS = CHORD_PATTERNS.find((p) => p.id === "pop-8ths")!.hits;

describe("clipPatternToBeats", () => {
  it("returns an empty array when no beats are available", () => {
    expect(clipPatternToBeats(POP_8THS, 0)).toEqual([]);
    expect(clipPatternToBeats(POP_8THS, -1)).toEqual([]);
  });

  it("keeps every hit that falls inside the beat window", () => {
    const clipped = clipPatternToBeats(POP_8THS, 4);
    expect(clipped).toEqual(POP_8THS);
  });

  it("drops hits past the available beats", () => {
    const clipped = clipPatternToBeats(POP_8THS, 2);
    expect(clipped.every((h) => h.beat < 2)).toBe(true);
  });

  it("keeps a hit exactly on the boundary out — strict less-than", () => {
    // POP_8THS has hits at 0, 1, 1.5, 2.5, 3, 3.5.
    const clipped = clipPatternToBeats(POP_8THS, 3);
    expect(clipped.map((h) => h.beat)).toEqual([0, 1, 1.5, 2.5]);
  });
});

describe("repeatPatternToBeats", () => {
  it("repeats a one-bar strum pattern across a multi-bar step", () => {
    const repeated = repeatPatternToBeats(POP_8THS, 8, 4);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5, 3, 3.5,
      4, 5, 5.5, 6.5, 7, 7.5,
    ]);
  });

  it("clips repeated pattern hits to partial final bars", () => {
    const repeated = repeatPatternToBeats(POP_8THS, 5, 4);

    expect(repeated.map((h) => h.beat)).toEqual([
      0, 1, 1.5, 2.5, 3, 3.5,
      4,
    ]);
  });

  it("uses the active meter as the repeat length", () => {
    const repeated = repeatPatternToBeats(POP_8THS, 6, 3);

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

describe("pattern catalog", () => {
  it("has 7 chord patterns with unique IDs", () => {
    expect(CHORD_PATTERNS).toHaveLength(7);
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
