import { describe, it, expect } from "vitest";
import {
  buildStringSetOptions,
  ALL_STRINGS_OPTION,
} from "./voicingStringSets";

describe("buildStringSetOptions", () => {
  it("emits ALL_STRINGS_OPTION first regardless of voiceCount", () => {
    expect(buildStringSetOptions(3)[0]).toEqual(ALL_STRINGS_OPTION);
    expect(buildStringSetOptions(4)[0]).toEqual(ALL_STRINGS_OPTION);
    expect(buildStringSetOptions(5)[0]).toEqual(ALL_STRINGS_OPTION);
  });

  it("emits 3 windows for a 4-note chord (Top 4 / Middle 4 / Bottom 4)", () => {
    const opts = buildStringSetOptions(4);
    expect(opts).toHaveLength(4); // all + 3 sets
    expect(opts.slice(1).map((o) => o.strings)).toEqual([
      [0, 1, 2, 3],
      [1, 2, 3, 4],
      [2, 3, 4, 5],
    ]);
  });

  it("emits 4 windows for a triad", () => {
    const opts = buildStringSetOptions(3);
    expect(opts).toHaveLength(5); // all + 4 sets
    expect(opts.slice(1).map((o) => o.strings)).toEqual([
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
  });

  it("emits 2 windows for a pentad", () => {
    const opts = buildStringSetOptions(5);
    expect(opts).toHaveLength(3); // all + 2 sets
    expect(opts.slice(1).map((o) => o.strings)).toEqual([
      [0, 1, 2, 3, 4],
      [1, 2, 3, 4, 5],
    ]);
  });

  it("each option has a stable id derived from strings", () => {
    const opts = buildStringSetOptions(4);
    expect(opts[0].id).toBe("all");
    expect(opts[1].id).toBe("0-1-2-3");
    expect(opts[2].id).toBe("1-2-3-4");
    expect(opts[3].id).toBe("2-3-4-5");
  });
});
