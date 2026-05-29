import { describe, expect, it } from "vitest";
import {
  DEFAULT_BEATS_PER_BAR,
  PROGRESSION_PRESETS,
  createProgressionStep,
  findFirstResolvableStepIndex,
  findNextResolvableStepIndex,
  formatChordShortLabel,
  formatProgressionDurationLabel,
  formatProgressionPlaybackPosition,
  getProgressionDurationBeats,
  getProgressionDurationMs,
  getAvailableProgressionPresets,
  isProgressionDuration,
  isProgressionPresetAvailableForScale,
  isValidProgressionStep,
  migrateLegacyDuration,
  normalizeProgressionStep,
  remapDegreeByOrdinal,
  remapProgressionStepsForScale,
  resolveProgressionStep,
  totalProgressionBars,
  transposeManualRootForRootChange,
  qualityShortForm,
  type ProgressionStep,
  type ProgressionStepDuration,
} from "./progressionDomain";

describe("progressionDomain", () => {
  it("resolves a diatonic step from active key and scale", () => {
    const step = createProgressionStep({ degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "step-v");
    expect(resolveProgressionStep(step, "major", "C")).toMatchObject({
      id: "step-v",
      degree: "V",
      root: "G",
      quality: "M",
      unavailable: false,
      qualityOverrideApplied: false,
    });
  });

  it("applies a valid quality override without changing the degree-derived root", () => {
    const step = createProgressionStep(
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
      "step-v7",
    );
    expect(resolveProgressionStep(step, "major", "C")).toMatchObject({
      root: "G",
      quality: "7",
      diatonicQuality: "M",
      qualityOverrideApplied: true,
    });
  });

  it("falls back to the diatonic quality when an override is no longer in the chord catalog", () => {
    const step = createProgressionStep(
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Missing Chord" },
      "step-invalid",
    );
    expect(resolveProgressionStep(step, "major", "C")).toMatchObject({
      root: "G",
      quality: "M",
      diatonicQuality: "M",
      qualityOverrideApplied: false,
      invalidQualityOverride: true,
    });
  });

  it("resolves major pentatonic and blues progression chords through major harmony", () => {
    const step = createProgressionStep(
      { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      "step-iv",
    );

    expect(resolveProgressionStep(step, "major pentatonic", "C")).toMatchObject({
      root: "F",
      quality: "M",
      unavailable: false,
    });
    expect(resolveProgressionStep(step, "major blues", "C")).toMatchObject({
      root: "F",
      quality: "M",
      unavailable: false,
    });
  });

  it("resolves minor pentatonic and blues progression chords through natural-minor harmony", () => {
    const step = createProgressionStep(
      { degree: "VI", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      "step-vi",
    );

    expect(resolveProgressionStep(step, "minor pentatonic", "C")).toMatchObject({
      root: "G#",
      quality: "M",
      unavailable: false,
    });
    expect(resolveProgressionStep(step, "minor blues", "C")).toMatchObject({
      root: "G#",
      quality: "M",
      unavailable: false,
    });
  });

  it("remaps degree labels by scale-step ordinal when the scale changes", () => {
    expect(remapDegreeByOrdinal("I", "minor")).toBe("i");
    expect(remapDegreeByOrdinal("V", "minor")).toBe("v");
    expect(remapDegreeByOrdinal("vi", "minor")).toBe("VI");
  });

  it("remaps progression degrees for pentatonic and blues scales against their major/minor harmony parent", () => {
    expect(remapDegreeByOrdinal("IV", "major pentatonic")).toBe("IV");
    expect(remapDegreeByOrdinal("vi", "major blues")).toBe("vi");
    expect(remapDegreeByOrdinal("I", "minor pentatonic")).toBe("i");
    expect(remapDegreeByOrdinal("V", "minor blues")).toBe("v");
    expect(remapDegreeByOrdinal("vi", "minor blues")).toBe("VI");
    expect(remapDegreeByOrdinal("IV", "minor blues")).toBe("iv");
  });

  it("remaps all progression steps while preserving ids, durations, and overrides", () => {
    const steps = [
      createProgressionStep({ degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "one"),
      createProgressionStep({ degree: "V", duration: { value: 2, unit: "bar" }, qualityOverride: "7" }, "two"),
      createProgressionStep({ degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null }, "three"),
    ];

    expect(remapProgressionStepsForScale(steps, "minor")).toEqual([
      { id: "one", degree: "i", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "two", degree: "v", duration: { value: 2, unit: "bar" }, qualityOverride: "7", manualRoot: null },
      { id: "three", degree: "VI", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
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
    const resolved = steps.map((step) => resolveProgressionStep(step, "major", "C"));

    expect(findFirstResolvableStepIndex(resolved)).toBe(1);
    expect(findNextResolvableStepIndex(resolved, 1, 1, true)).toBe(2);
    expect(findNextResolvableStepIndex(resolved, 2, 1, true)).toBe(1);
    expect(findNextResolvableStepIndex(resolved, 2, 1, false)).toBeNull();
  });

  it("defines the initial presets as editable step templates", () => {
    const ids = PROGRESSION_PRESETS.map((preset) => preset.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "one-five-six-four",
        "two-five-one",
        "one-six-four-five",
        "one-four-five",
        "twelve-bar-blues",
      ]),
    );
    const blues = PROGRESSION_PRESETS.find((preset) => preset.id === "twelve-bar-blues");
    expect(blues?.steps).toHaveLength(7);
    expect(blues?.steps.every((step) => step.qualityOverride === "7")).toBe(true);
  });

  it("filters presets to scales where every preset degree can resolve", () => {
    const oneFiveSixFour = PROGRESSION_PRESETS.find((preset) => preset.id === "one-five-six-four");
    expect(oneFiveSixFour).toBeDefined();
    expect(isProgressionPresetAvailableForScale(oneFiveSixFour!, "major")).toBe(true);
    expect(isProgressionPresetAvailableForScale(oneFiveSixFour!, "minor blues")).toBe(true);
    expect(getAvailableProgressionPresets("minor blues")).toEqual(PROGRESSION_PRESETS);
  });
});

describe("expanded preset catalog", () => {
  it("has at least 25 presets", () => {
    expect(PROGRESSION_PRESETS.length).toBeGreaterThanOrEqual(25);
  });
  it("all presets have unique IDs", () => {
    const ids = PROGRESSION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("all presets have a category", () => {
    for (const preset of PROGRESSION_PRESETS) {
      expect(preset.category).toBeDefined();
      expect(["pop-rock", "blues", "jazz", "folk", "modal", "minor"]).toContain(preset.category);
    }
  });
  it("has presets in each category", () => {
    const categories = new Set(PROGRESSION_PRESETS.map((p) => p.category));
    expect(categories).toContain("pop-rock");
    expect(categories).toContain("blues");
    expect(categories).toContain("jazz");
    expect(categories).toContain("folk");
    expect(categories).toContain("modal");
    expect(categories).toContain("minor");
  });
});

describe("twelve-bar-blues preset", () => {
  const blues = PROGRESSION_PRESETS.find((p) => p.id === "twelve-bar-blues")!;

  it("has 7 steps totaling 12 bars", () => {
    expect(blues.steps).toHaveLength(7);
    const totalBars = blues.steps.reduce(
      (sum, s) => sum + (s.duration.unit === "bar" ? s.duration.value : 0),
      0,
    );
    expect(totalBars).toBe(12);
  });

  it("uses multi-bar durations for repeated chords", () => {
    expect(blues.steps[0]).toEqual(
      expect.objectContaining({ degree: "I", duration: { value: 4, unit: "bar" } }),
    );
    expect(blues.steps[1]).toEqual(
      expect.objectContaining({ degree: "IV", duration: { value: 2, unit: "bar" } }),
    );
    expect(blues.steps[2]).toEqual(
      expect.objectContaining({ degree: "I", duration: { value: 2, unit: "bar" } }),
    );
  });

  it("applies Dominant 7th to all steps", () => {
    for (const step of blues.steps) {
      expect(step.qualityOverride).toBe("7");
    }
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
    expect(migrateLegacyDuration("1-beat")).toMatchObject({ value: 1, unit: "beat" });
    expect(migrateLegacyDuration("2-beats")).toMatchObject({ value: 2, unit: "beat" });
    expect(migrateLegacyDuration("1-bar")).toMatchObject({ value: 1, unit: "bar" });
    expect(migrateLegacyDuration("2-bars")).toMatchObject({ value: 2, unit: "bar" });
  });

  it("migrateLegacyDuration passes through valid objects", () => {
    const value: ProgressionStepDuration = { value: 3, unit: "bar" };
    expect(migrateLegacyDuration(value)).toBe(value);
  });

  it("migrateLegacyDuration falls back to 1 bar for unknown input", () => {
    expect(migrateLegacyDuration("garbage")).toMatchObject({ value: 1, unit: "bar" });
    expect(migrateLegacyDuration(null)).toMatchObject({ value: 1, unit: "bar" });
    expect(migrateLegacyDuration({ value: 0, unit: "bar" })).toMatchObject({ value: 1, unit: "bar" });
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

describe("formatChordShortLabel", () => {
  it("renders bare root for major triads", () => {
    expect(formatChordShortLabel("C", "M")).toBe("C");
    expect(formatChordShortLabel("F♯", "M")).toBe("F♯");
  });

  it("appends idiomatic suffixes for common qualities", () => {
    expect(formatChordShortLabel("A", "m")).toBe("Am");
    expect(formatChordShortLabel("G", "7")).toBe("G7");
    expect(formatChordShortLabel("C", "maj7")).toBe("Cmaj7");
    expect(formatChordShortLabel("D", "m7")).toBe("Dm7");
    expect(formatChordShortLabel("B", "dim")).toBe("B°");
    expect(formatChordShortLabel("F", "m7b5")).toBe("Fø7");
  });

  it("falls back to 'root quality' for unknown qualities", () => {
    expect(formatChordShortLabel("C", "Made-Up Chord")).toBe("C Made-Up Chord");
  });
});

describe("formatProgressionPlaybackPosition", () => {
  it("formats the bar/beat/sixteenth readout at the start of the progression", () => {
    expect(formatProgressionPlaybackPosition(1, 5, 4)).toMatchObject({
      current: "1.1.1",
      total: "5.0.0",
    });
  });

  it("derives beat and 1-indexed sixteenth from the fractional bar offset", () => {
    expect(formatProgressionPlaybackPosition(1.25, 4, 4).current).toBe("1.2.1");
    expect(formatProgressionPlaybackPosition(1.3, 4, 4).current).toBe("1.2.1");
    expect(formatProgressionPlaybackPosition(1.3125, 4, 4).current).toBe("1.2.2");
    expect(formatProgressionPlaybackPosition(1.5, 4, 4).current).toBe("1.3.1");
  });

  it("honors the active meter when deriving beat counts", () => {
    expect(formatProgressionPlaybackPosition(2.5, 4, 8)).toMatchObject({
      current: "2.5.1",
      total: "4.0.0",
    });
  });

  it("clamps fractional totals up and pins current at the final sixteenth", () => {
    expect(formatProgressionPlaybackPosition(99, 3.25, 4)).toMatchObject({
      current: "4.4.4",
      total: "4.0.0",
    });
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

  describe("ProgressionStep manualRoot", () => {
    it("createProgressionStep defaults manualRoot to null", () => {
      const step = createProgressionStep({
        degree: "i",
        duration: { value: 1, unit: "bar" },
        qualityOverride: null,
      });
      expect(step.manualRoot).toBeNull();
    });

    it("createProgressionStep preserves manualRoot when provided", () => {
      const step = createProgressionStep({
        degree: "i",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "M",
        manualRoot: "F#",
      });
      expect(step.manualRoot).toBe("F#");
    });

    it("isValidProgressionStep accepts steps with null manualRoot", () => {
      const step = {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: null,
        manualRoot: null,
      };
      expect(isValidProgressionStep(step)).toBe(true);
    });

    it("isValidProgressionStep accepts steps with string manualRoot", () => {
      const step = {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: null,
        manualRoot: "F#",
      };
      expect(isValidProgressionStep(step)).toBe(true);
    });

    it("normalizeProgressionStep fills manualRoot=null for legacy persisted shape", () => {
      const legacy = {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: null,
      };
      const normalized = normalizeProgressionStep(legacy);
      expect(normalized?.manualRoot).toBeNull();
    });

    it("normalizeProgressionStep round-trips a string manualRoot", () => {
      const persisted = {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: null,
        manualRoot: "F#",
      };
      const normalized = normalizeProgressionStep(persisted);
      expect(normalized?.manualRoot).toBe("F#");
    });
  });
});

describe("transposeManualRootForRootChange", () => {
  it("transposes manualRoot by the interval from oldRoot to newRoot", () => {
    const steps: ProgressionStep[] = [
      {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "M",
        manualRoot: "F#",
      },
    ];
    const next = transposeManualRootForRootChange(steps, "A", "C"); // up a minor third
    expect(next[0].manualRoot).toBe("A");
  });

  it("leaves steps with null manualRoot untouched", () => {
    const steps: ProgressionStep[] = [
      {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: null,
        manualRoot: null,
      },
    ];
    const next = transposeManualRootForRootChange(steps, "A", "C");
    expect(next[0].manualRoot).toBeNull();
  });

  it("returns identity-mapped steps when oldRoot === newRoot", () => {
    const steps: ProgressionStep[] = [
      {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: null,
        manualRoot: "F#",
      },
    ];
    const next = transposeManualRootForRootChange(steps, "A", "A");
    expect(next[0].manualRoot).toBe("F#");
  });

  it("normalizes flat results to sharps-form to match the rootNoteAtom contract", () => {
    const steps: ProgressionStep[] = [
      {
        id: "x",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "M",
        manualRoot: "C",
      },
    ];
    // C → Bb on a whole-step-down transposition. Should normalize to A#.
    const next = transposeManualRootForRootChange(steps, "D", "C");
    expect(next[0].manualRoot).toBe("A#");
  });

  it("preserves untouched step fields (id, degree, duration, qualityOverride)", () => {
    const steps: ProgressionStep[] = [
      {
        id: "alpha",
        degree: "V",
        duration: { value: 2, unit: "beat" },
        qualityOverride: "7",
        manualRoot: "F#",
      },
    ];
    const next = transposeManualRootForRootChange(steps, "A", "C");
    expect(next[0]).toMatchObject({
      id: "alpha",
      degree: "V",
      duration: { value: 2, unit: "beat" },
      qualityOverride: "7",
    });
  });
});

describe("resolveProgressionStep + manualRoot (Plan G11a)", () => {
  it("when manualRoot is set, uses it as the chord root", () => {
    const step = createProgressionStep(
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: "D#" },
      "step-manual-root",
    );
    const resolved = resolveProgressionStep(step, "major", "C", 0, false);
    expect(resolved.root).toBe("D#");
    // resolvedChordLabel uses formatAccidental which renders # as ♯
    expect(resolved.resolvedChordLabel).toMatch(/^D[#♯]/);
  });

  it("when manualRoot + qualityOverride both set, qualityOverride wins", () => {
    const step = createProgressionStep(
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "m", manualRoot: "D#" },
      "step-manual-override",
    );
    const resolved = resolveProgressionStep(step, "major", "C", 0, false);
    expect(resolved.root).toBe("D#");
    expect(resolved.quality).toBe("m");
  });

  it("when manualRoot is set without qualityOverride, picks a sensible default quality", () => {
    const step = createProgressionStep(
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: "D#" },
      "step-manual-no-override",
    );
    const resolved = resolveProgressionStep(step, "major", "C", 0, false);
    // The simplest defensible default is "M". A smarter helper may
    // yield a different but coherent quality — both are acceptable.
    expect(["M", "m", "dim"]).toContain(resolved.quality);
  });

  it("when manualRoot is NULL, falls back to existing degree-derived behavior (regression guard)", () => {
    const step = createProgressionStep(
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      "step-diatonic",
    );
    const resolved = resolveProgressionStep(step, "major", "C", 0, false);
    expect(resolved.root).toBe("C");
  });
});

describe("qualityShortForm (Plan H-T9b)", () => {
  it.each([
    ["M", "M"],
    ["m", "m"],
    ["dim", "°"],
    ["7", "7"],
    ["maj7", "M7"],
    ["m7", "m7"],
    ["m7b5", "ø7"],
  ] as const)("maps %s → %s", (input, expected) => {
    expect(qualityShortForm(input)).toBe(expected);
  });

  it("returns empty string for unknown qualities", () => {
    expect(qualityShortForm("UnknownQuality" as never)).toBe("");
  });
});

describe("resolveProgressionStep — quality pin", () => {
  const step = (degree: string, qualityOverride: string | null) => ({
    id: "t", degree, duration: { value: 1, unit: "bar" as const }, qualityOverride, manualRoot: null,
  });

  it("pins a dominant V in natural minor on the perfect-5th root", () => {
    const c = resolveProgressionStep(step("V", "7"), "minor", "C");
    expect(c.unavailable).toBe(false);
    expect(c.root).toBe("G");
    expect(c.quality).toBe("7");

    const a = resolveProgressionStep(step("V", "7"), "minor", "A");
    expect(a.unavailable).toBe(false);
    expect(a.root).toBe("E");
  });

  it("leaves a non-diatonic degree unavailable when there is no override", () => {
    const r = resolveProgressionStep(step("V", null), "minor", "C");
    expect(r.unavailable).toBe(true);
  });

  it("stays unavailable when the degree's ordinal exceeds the scale length", () => {
    const r = resolveProgressionStep(step("VII", "7"), "major pentatonic", "C");
    expect(r.unavailable).toBe(true);
  });
});
