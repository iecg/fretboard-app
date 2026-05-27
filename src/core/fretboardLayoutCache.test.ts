import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFretboardLayoutCache,
  getCachedFretboardLayout,
} from "./fretboardLayoutCache";

describe("fretboardLayoutCache", () => {
  beforeEach(() => {
    clearFretboardLayoutCache();
  });

  it("returns the same array reference for the same tuning and max fret", () => {
    const tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];
    const first = getCachedFretboardLayout(tuning, 24);
    const second = getCachedFretboardLayout(tuning, 24);
    expect(second).toBe(first);
  });

  it("returns a different array reference when max fret changes", () => {
    const tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];
    const first = getCachedFretboardLayout(tuning, 24);
    const second = getCachedFretboardLayout(tuning, 12);
    expect(second).not.toBe(first);
  });
});
