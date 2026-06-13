import { describe, it, expect } from "vitest";
import {
  buildStringSetOptions,
} from "./voicingStringSets";

describe("buildStringSetOptions", () => {
  it("does not emit an option with id 'all'", () => {
    expect(buildStringSetOptions(3).every((o) => o.id !== "all")).toBe(true);
    expect(buildStringSetOptions(4).every((o) => o.id !== "all")).toBe(true);
    expect(buildStringSetOptions(5).every((o) => o.id !== "all")).toBe(true);
  });

  it("emits 3 windows for a 4-note chord (Top 4 / Middle 4 / Bottom 4)", () => {
    const opts = buildStringSetOptions(4);
    expect(opts).toHaveLength(3); // 3 sets
    expect(opts.map((o) => o.strings)).toEqual([
      [0, 1, 2, 3],
      [1, 2, 3, 4],
      [2, 3, 4, 5],
    ]);
  });

  it("emits 4 windows for a triad", () => {
    const opts = buildStringSetOptions(3);
    expect(opts).toHaveLength(4); // 4 sets
    expect(opts.map((o) => o.strings)).toEqual([
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
  });

  it("emits 2 windows for a pentad", () => {
    const opts = buildStringSetOptions(5);
    expect(opts).toHaveLength(2); // 2 sets
    expect(opts.map((o) => o.strings)).toEqual([
      [0, 1, 2, 3, 4],
      [1, 2, 3, 4, 5],
    ]);
  });

  it("emits 5 windows for a dyad (power chord)", () => {
    const opts = buildStringSetOptions(2);
    expect(opts).toHaveLength(5);
    expect(opts.map((o) => o.strings)).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]);
    expect(opts.every((o) => o.id !== "all")).toBe(true);
  });

  it("each option has a stable id derived from strings", () => {
    const opts = buildStringSetOptions(4);
    expect(opts[0].id).toBe("0-1-2-3");
    expect(opts[1].id).toBe("1-2-3-4");
    expect(opts[2].id).toBe("2-3-4-5");
  });
});
