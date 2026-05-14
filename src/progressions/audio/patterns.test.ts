import { describe, expect, it } from "vitest";
import {
  buildMetronomePattern,
  clipPatternToBeats,
  POP_STRUM_PATTERN,
  repeatPatternToBeats,
  ROOT_FIFTH_BASS_PATTERN,
  ROCK_DRUM_PATTERN,
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
