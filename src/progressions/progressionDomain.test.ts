import { describe, expect, it } from "vitest";
import {
  DEFAULT_BEATS_PER_BAR,
  PROGRESSION_PRESETS,
  createProgressionStep,
  findFirstResolvableStepIndex,
  findNextResolvableStepIndex,
  formatProgressionDurationLabel,
  getProgressionDurationBeats,
  getProgressionDurationMs,
  isProgressionDuration,
  migrateLegacyDuration,
  remapDegreeByOrdinal,
  remapProgressionStepsForScale,
  resolveProgressionStep,
  totalProgressionBars,
  type ProgressionStepDuration,
} from "./progressionDomain";

describe("progressionDomain", () => {
  it("resolves a diatonic step from active key and scale", () => {
    const step = createProgressionStep({ degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "step-v");
    expect(resolveProgressionStep(step, "Major", "C")).toMatchObject({
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
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      "step-v7",
    );
    expect(resolveProgressionStep(step, "Major", "C")).toMatchObject({
      root: "G",
      quality: "Dominant 7th",
      diatonicQuality: "Major Triad",
      qualityOverrideApplied: true,
    });
  });

  it("falls back to the diatonic quality when an override is no longer in the chord catalog", () => {
    const step = createProgressionStep(
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Missing Chord" },
      "step-invalid",
    );
    expect(resolveProgressionStep(step, "Major", "C")).toMatchObject({
      root: "G",
      quality: "Major Triad",
      diatonicQuality: "Major Triad",
      qualityOverrideApplied: false,
      invalidQualityOverride: true,
    });
  });

  it("remaps degree labels by scale-step ordinal when the scale changes", () => {
    expect(remapDegreeByOrdinal("I", "Natural Minor")).toBe("i");
    expect(remapDegreeByOrdinal("V", "Natural Minor")).toBe("v");
    expect(remapDegreeByOrdinal("vi", "Natural Minor")).toBe("VI");
  });

  it("remaps all progression steps while preserving ids, durations, and overrides", () => {
    const steps = [
      createProgressionStep({ degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "one"),
      createProgressionStep({ degree: "V", duration: { value: 2, unit: "bar" }, qualityOverride: "Dominant 7th" }, "two"),
      createProgressionStep({ degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "three"),
    ];

    expect(remapProgressionStepsForScale(steps, "Natural Minor")).toEqual([
      { id: "one", degree: "i", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "two", degree: "v", duration: { value: 2, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { id: "three", degree: "VI", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ]);
  });

  it("converts musical durations to milliseconds at a tempo", () => {
    expect(getProgressionDurationMs({ value: 1, unit: "beat" }, 120, DEFAULT_BEATS_PER_BAR)).toBe(500);
    expect(getProgressionDurationMs({ value: 2, unit: "beat" }, 120, DEFAULT_BEATS_PER_BAR)).toBe(1000);
    expect(getProgressionDurationMs({ value: 1, unit: "bar" }, 120, DEFAULT_BEATS_PER_BAR)).toBe(2000);
    expect(getProgressionDurationMs({ value: 2, unit: "bar" }, 120, DEFAULT_BEATS_PER_BAR)).toBe(4000);
  });

  it("skips unavailable steps while finding playback targets", () => {
    const steps = [
      createProgressionStep({ degree: "not-a-degree", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "bad"),
      createProgressionStep({ degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "one"),
      createProgressionStep({ degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "two"),
    ];
    const resolved = steps.map((step) => resolveProgressionStep(step, "Major", "C"));

    expect(findFirstResolvableStepIndex(resolved)).toBe(1);
    expect(findNextResolvableStepIndex(resolved, 1, 1, true)).toBe(2);
    expect(findNextResolvableStepIndex(resolved, 2, 1, true)).toBe(1);
    expect(findNextResolvableStepIndex(resolved, 2, 1, false)).toBeNull();
  });

  it("defines the initial presets as editable step templates", () => {
    expect(PROGRESSION_PRESETS.map((preset) => preset.id)).toEqual([
      "one-five-six-four",
      "two-five-one",
      "one-six-four-five",
      "one-four-five",
      "twelve-bar-blues",
    ]);
    const blues = PROGRESSION_PRESETS.find((preset) => preset.id === "twelve-bar-blues");
    expect(blues?.steps).toHaveLength(12);
    expect(blues?.steps.every((step) => step.qualityOverride === "Dominant 7th")).toBe(true);
  });
});

describe("ProgressionStepDuration (object shape)", () => {
  it("isProgressionDuration accepts well-formed object durations", () => {
    expect(isProgressionDuration({ value: 1, unit: "bar" })).toBe(true);
    expect(isProgressionDuration({ value: 4, unit: "beat" })).toBe(true);
    expect(isProgressionDuration({ value: 16, unit: "bar" })).toBe(true);
  });

  it("isProgressionDuration rejects bad shapes", () => {
    expect(isProgressionDuration(null)).toBe(false);
    expect(isProgressionDuration("1-bar")).toBe(false);
    expect(isProgressionDuration({ value: 0, unit: "bar" })).toBe(false);
    expect(isProgressionDuration({ value: 1, unit: "wat" })).toBe(false);
    expect(isProgressionDuration({ value: -1, unit: "beat" })).toBe(false);
    expect(isProgressionDuration({ value: 1.5, unit: "beat" })).toBe(false);
  });

  it("migrateLegacyDuration normalises legacy strings to objects", () => {
    expect(migrateLegacyDuration("1-beat")).toEqual({ value: 1, unit: "beat" });
    expect(migrateLegacyDuration("2-beats")).toEqual({ value: 2, unit: "beat" });
    expect(migrateLegacyDuration("1-bar")).toEqual({ value: 1, unit: "bar" });
    expect(migrateLegacyDuration("2-bars")).toEqual({ value: 2, unit: "bar" });
  });

  it("migrateLegacyDuration passes through valid objects", () => {
    const value: ProgressionStepDuration = { value: 3, unit: "bar" };
    expect(migrateLegacyDuration(value)).toBe(value);
  });

  it("migrateLegacyDuration falls back to 1 bar for unknown input", () => {
    expect(migrateLegacyDuration("garbage")).toEqual({ value: 1, unit: "bar" });
    expect(migrateLegacyDuration(null)).toEqual({ value: 1, unit: "bar" });
    expect(migrateLegacyDuration({ value: 0, unit: "bar" })).toEqual({ value: 1, unit: "bar" });
  });
});

describe("formatProgressionDurationLabel", () => {
  it("singularises for value=1", () => {
    expect(formatProgressionDurationLabel({ value: 1, unit: "bar" })).toBe("1 bar");
    expect(formatProgressionDurationLabel({ value: 1, unit: "beat" })).toBe("1 beat");
  });

  it("pluralises for value>1", () => {
    expect(formatProgressionDurationLabel({ value: 2, unit: "bar" })).toBe("2 bars");
    expect(formatProgressionDurationLabel({ value: 3, unit: "beat" })).toBe("3 beats");
    expect(formatProgressionDurationLabel({ value: 12, unit: "bar" })).toBe("12 bars");
  });
});

describe("progression duration math", () => {
  it("getProgressionDurationBeats honors beatsPerBar for bar units", () => {
    expect(getProgressionDurationBeats({ value: 1, unit: "beat" }, 4)).toBe(1);
    expect(getProgressionDurationBeats({ value: 3, unit: "beat" }, 4)).toBe(3);
    expect(getProgressionDurationBeats({ value: 1, unit: "bar" }, 4)).toBe(4);
    expect(getProgressionDurationBeats({ value: 2, unit: "bar" }, 3)).toBe(6);
    expect(getProgressionDurationBeats({ value: 1, unit: "bar" }, 6)).toBe(6);
  });

  it("getProgressionDurationMs scales by tempo", () => {
    // 60 bpm = 1 beat / sec ⇒ 1 bar at 4 bpb = 4000 ms
    expect(getProgressionDurationMs({ value: 1, unit: "bar" }, 60, 4)).toBe(4000);
    expect(getProgressionDurationMs({ value: 2, unit: "beat" }, 60, 4)).toBe(2000);
    // 120 bpm = 0.5 sec / beat ⇒ 1 bar at 4 bpb = 2000 ms
    expect(getProgressionDurationMs({ value: 1, unit: "bar" }, 120, 4)).toBe(2000);
  });

  it("DEFAULT_BEATS_PER_BAR is 4", () => {
    expect(DEFAULT_BEATS_PER_BAR).toBe(4);
  });

  it("totalProgressionBars sums durations expressed in bars", () => {
    expect(
      totalProgressionBars(
        [
          { value: 1, unit: "bar" },
          { value: 1, unit: "bar" },
        ],
        4,
      ),
    ).toBe(2);
    expect(
      totalProgressionBars(
        [
          { value: 4, unit: "beat" }, // = 1 bar at 4 bpb
          { value: 2, unit: "bar" },
        ],
        4,
      ),
    ).toBe(3);
    expect(
      totalProgressionBars([{ value: 6, unit: "beat" }], 3),
    ).toBe(2);
  });
});
