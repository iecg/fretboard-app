import { describe, expect, it } from "vitest";
import { getScaleKeyInfo } from "./scaleTheoryDerivations";

describe("getScaleKeyInfo", () => {
  it("reports the relative minor for a major key", () => {
    const info = getScaleKeyInfo("C", "Major", false);
    expect(info.relativeLabel).toBe("Relative");
    expect(info.relativeValue).toBe("Am");
  });

  it("reports the relative major for a natural minor key", () => {
    const info = getScaleKeyInfo("A", "Natural Minor", false);
    expect(info.relativeLabel).toBe("Relative");
    expect(info.relativeValue).toBe("C");
  });

  it("reports the parent scale for a mode (D Dorian → C Major)", () => {
    const info = getScaleKeyInfo("D", "Dorian", false);
    expect(info.relativeLabel).toBe("Parent");
    expect(info.relativeValue).toBe("C");
  });

  it("reports a natural key signature for C Major", () => {
    expect(getScaleKeyInfo("C", "Major", false).keySignature).toBe("♮");
  });

  it("reports a sharp key signature for G Major", () => {
    expect(getScaleKeyInfo("G", "Major", false).keySignature).toBe("1♯");
  });

  it("reports a flat key signature for F Major", () => {
    expect(getScaleKeyInfo("F", "Major", true).keySignature).toBe("1♭");
  });
});
