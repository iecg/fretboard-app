import { describe, it, expect } from "vitest";
import {
  buildDegreeToggleOptions,
  buildQualityToggleOptions,
  CHORD_QUALITY_DIATONIC_VALUE,
} from "./chordControlOptions";

describe("buildDegreeToggleOptions", () => {
  it("returns degrees for a scale, plain labels by default", () => {
    const opts = buildDegreeToggleOptions({ scaleName: "major" });
    expect(opts.map((o) => o.value)).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
    expect(opts.every((o) => o.label === o.value)).toBe(true);
  });

  it("marks the active degree with * when a quality override is in effect", () => {
    const opts = buildDegreeToggleOptions({
      scaleName: "major",
      qualityOverridden: true,
      activeDegree: "V",
    });
    expect(opts.find((o) => o.value === "V")?.label).toBe("V*");
    expect(opts.find((o) => o.value === "I")?.label).toBe("I");
  });
});

describe("buildQualityToggleOptions", () => {
  it("starts with a diatonic sentinel and follows with canonical qualities", () => {
    const opts = buildQualityToggleOptions();
    expect(opts[0].value).toBe(CHORD_QUALITY_DIATONIC_VALUE);
    expect(opts[0].label).toBe("Diatonic");
    expect(opts.length).toBeGreaterThan(5);
  });

  it("accepts a customDiatonicLabel override", () => {
    const opts = buildQualityToggleOptions({ diatonicLabel: "Off" });
    expect(opts[0].label).toBe("Off");
  });

  it("omits the sentinel when includeSentinel is false", () => {
    const opts = buildQualityToggleOptions({ includeSentinel: false });
    expect(opts[0].value).not.toBe(CHORD_QUALITY_DIATONIC_VALUE);
    // First entry should be a real chord quality, not the sentinel
    expect(opts.every((o) => o.value !== CHORD_QUALITY_DIATONIC_VALUE)).toBe(true);
    // Length should equal full list minus sentinel
    const withSentinel = buildQualityToggleOptions();
    expect(opts.length).toBe(withSentinel.length - 1);
  });
});
