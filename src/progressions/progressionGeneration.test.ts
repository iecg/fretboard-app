import { describe, it, expect } from "vitest";
import { generateCommonProgressions } from "./progressionGeneration";

describe("generateCommonProgressions", () => {
  it("returns progressions for Major scale", () => {
    const presets = generateCommonProgressions("Major", "C");
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) {
      expect(p.steps.length).toBeGreaterThan(0);
      expect(p.category).toBe("suggested");
    }
  });
  it("returns progressions for Dorian scale", () => {
    const presets = generateCommonProgressions("Dorian", "D");
    expect(presets.length).toBeGreaterThan(0);
  });
  it("returns a defined array for pentatonic scales", () => {
    const presets = generateCommonProgressions("Major Pentatonic", "C");
    expect(presets).toBeDefined();
    expect(Array.isArray(presets)).toBe(true);
  });
  it("generated presets have unique IDs", () => {
    const presets = generateCommonProgressions("Major", "C");
    const ids = presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
