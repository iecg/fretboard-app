import { describe, expect, it } from "vitest";
import {
  PROGRESSION_PRESETS,
  createProgressionStep,
  findFirstResolvableStepIndex,
  findNextResolvableStepIndex,
  getDegreeOrdinal,
  getProgressionDurationMs,
  remapDegreeByOrdinal,
  remapProgressionStepsForScale,
  resolveProgressionStep,
} from "./progressionDomain";

describe("progressionDomain", () => {
  it("resolves a diatonic step from active key and scale", () => {
    const step = createProgressionStep(
      { degree: "V", duration: "1-bar", qualityOverride: null },
      "step-v",
    );

    const resolved = resolveProgressionStep(step, "Major", "C");

    expect(resolved).toMatchObject({
      id: "step-v",
      degree: "V",
      root: "G",
      quality: "Major Triad",
      unavailable: false,
      qualityOverrideApplied: false,
    });
  });

  it("applies a valid quality override without changing the degree-derived root", () => {
    const step = createProgressionStep(
      { degree: "V", duration: "1-bar", qualityOverride: "Dominant 7th" },
      "step-v",
    );

    const resolved = resolveProgressionStep(step, "Major", "C");

    expect(resolved).toMatchObject({
      root: "G",
      quality: "Dominant 7th",
      diatonicQuality: "Major Triad",
      qualityOverrideApplied: true,
    });
  });

  it("falls back to diatonic quality when override is no longer in the chord catalog", () => {
    const step = createProgressionStep(
      { degree: "V", duration: "1-bar", qualityOverride: "Missing Chord" },
      "step-v",
    );

    const resolved = resolveProgressionStep(step, "Major", "C");

    expect(resolved).toMatchObject({
      root: "G",
      quality: "Major Triad",
      diatonicQuality: "Major Triad",
      qualityOverrideApplied: false,
      invalidQualityOverride: true,
    });
  });

  it("remaps degree labels by scale-step ordinal when the scale changes", () => {
    expect(remapDegreeByOrdinal("I", "Natural Minor")).toBe("i");
    expect(remapDegreeByOrdinal("V", "Dorian")).toBe("v");
    expect(remapDegreeByOrdinal("vi", "Natural Minor")).toBe("VI");
  });

  it("preserves malformed degree labels when remapping by ordinal", () => {
    expect(getDegreeOrdinal("Invalid")).toBeNull();
    expect(getDegreeOrdinal("violin")).toBeNull();
    expect(getDegreeOrdinal("not-a-degree")).toBeNull();
    expect(remapDegreeByOrdinal("Invalid", "Natural Minor")).toBe("Invalid");
    expect(remapDegreeByOrdinal("violin", "Natural Minor")).toBe("violin");
  });

  it("remaps all progression steps while preserving ids, durations, and overrides", () => {
    const steps = [
      createProgressionStep(
        { degree: "I", duration: "1-bar", qualityOverride: null },
        "one",
      ),
      createProgressionStep(
        { degree: "V", duration: "2-bars", qualityOverride: "Dominant 7th" },
        "two",
      ),
      createProgressionStep(
        { degree: "vi", duration: "1-bar", qualityOverride: null },
        "three",
      ),
    ];

    expect(remapProgressionStepsForScale(steps, "Natural Minor")).toEqual([
      { id: "one", degree: "i", duration: "1-bar", qualityOverride: null },
      {
        id: "two",
        degree: "v",
        duration: "2-bars",
        qualityOverride: "Dominant 7th",
      },
      { id: "three", degree: "VI", duration: "1-bar", qualityOverride: null },
    ]);
  });

  it("converts musical durations to milliseconds at tempo 120", () => {
    expect(getProgressionDurationMs("1-beat", 120)).toBe(500);
    expect(getProgressionDurationMs("2-beats", 120)).toBe(1000);
    expect(getProgressionDurationMs("1-bar", 120)).toBe(2000);
    expect(getProgressionDurationMs("2-bars", 120)).toBe(4000);
  });

  it("uses the default tempo for non-finite tempo values", () => {
    expect(getProgressionDurationMs("1-bar", Number.NaN)).toBe(
      Math.round((60_000 / 90) * 4),
    );
  });

  it("skips unavailable steps while finding playback targets", () => {
    const resolved = [
      createProgressionStep(
        { degree: "bad-degree", duration: "1-bar", qualityOverride: null },
        "bad",
      ),
      createProgressionStep(
        { degree: "I", duration: "1-bar", qualityOverride: null },
        "one",
      ),
      createProgressionStep(
        { degree: "V", duration: "1-bar", qualityOverride: null },
        "five",
      ),
    ].map((step, index) => resolveProgressionStep(step, "Major", "C", index));

    expect(findFirstResolvableStepIndex(resolved)).toBe(1);
    expect(findNextResolvableStepIndex(resolved, 1, 1, true)).toBe(2);
    expect(findNextResolvableStepIndex(resolved, 2, 1, true)).toBe(1);
    expect(findNextResolvableStepIndex(resolved, 2, 1, false)).toBeNull();
  });

  it("defines initial presets", () => {
    expect(PROGRESSION_PRESETS.map((preset) => preset.id)).toEqual([
      "one-five-six-four",
      "two-five-one",
      "one-six-four-five",
      "one-four-five",
      "twelve-bar-blues",
    ]);

    const blues = PROGRESSION_PRESETS.find(
      (preset) => preset.id === "twelve-bar-blues",
    );

    expect(blues?.steps).toHaveLength(12);
    expect(blues?.steps.map((step) => step.degree)).toEqual([
      "I",
      "I",
      "I",
      "I",
      "IV",
      "IV",
      "I",
      "I",
      "V",
      "IV",
      "I",
      "V",
    ]);
    expect(blues?.steps.every((step) => step.duration === "1-bar")).toBe(true);
    expect(blues?.steps.every((step) => step.qualityOverride === "Dominant 7th"))
      .toBe(true);
  });
});
