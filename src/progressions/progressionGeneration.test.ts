import { describe, it, expect } from "vitest";
import { generateCommonProgressions } from "./progressionGeneration";

describe("generateCommonProgressions", () => {
  it("returns suggested-category presets for Major scale", () => {
    const presets = generateCommonProgressions("major", "C");
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) {
      expect(p.steps.length).toBeGreaterThan(0);
      expect(p.category).toBe("suggested");
    }
  });

  it("tags every suggestion with a known feel", () => {
    const presets = generateCommonProgressions("major", "C");
    for (const p of presets) {
      expect(["cadential", "vamp", "modal"]).toContain(p.feel);
    }
  });

  it("derives labels from the scale's own degrees", () => {
    const presets = generateCommonProgressions("major", "C");
    // IV-V-I cadence (ordinals 3,4,0) renders with major-scale degrees.
    expect(presets.some((p) => p.label === "IV-V-I")).toBe(true);
  });

  it("uses deterministic ids that encode feel + ordinals", () => {
    const a = generateCommonProgressions("major", "C").map((p) => p.id);
    const b = generateCommonProgressions("major", "C").map((p) => p.id);
    expect(a).toEqual(b);
    expect(a.every((id) => /^suggested-(cadential|vamp|modal)-\d+$/.test(id))).toBe(true);
  });

  it("includes a modal vamp for 7-degree scales", () => {
    const presets = generateCommonProgressions("dorian", "D");
    expect(presets.some((p) => p.feel === "modal")).toBe(true);
  });

  it("returns a defined array for pentatonic scales", () => {
    const presets = generateCommonProgressions("major pentatonic", "C");
    expect(Array.isArray(presets)).toBe(true);
  });

  it("generated presets have unique IDs", () => {
    const ids = generateCommonProgressions("major", "C").map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
