import { describe, expect, it } from "vitest";
import { buildAllLayersAsync } from "./buildAllLayers";
import type { ResolvedProgressionStep } from "../progressionDomain";

const step = (over: Partial<ResolvedProgressionStep> = {}): ResolvedProgressionStep => ({
  id: "x", index: 0, degree: "I", duration: { value: 1, unit: "bar" },
  qualityOverride: null, qualityOverrideApplied: false, invalidQualityOverride: false,
  manualRoot: null, root: "C", quality: "M", diatonicQuality: "M",
  label: "I", resolvedChordLabel: "C major", shortChordLabel: "C",
  unavailable: false, unavailableReason: null, ...over,
});

const baseInput = {
  tempoBpm: 60, beatsPerBar: 4, swing: 0,
  chordPatternId: "ballad-whole", bassPatternId: "root-fifth",
  drumPatternId: "rock", drumVariations: [] as string[], loop: true,
};

describe("buildAllLayers humanizer integration (real humanize)", () => {
  it("never drops the metronome or shifts it off the grid", async () => {
    const out = await buildAllLayersAsync({ ...baseInput, steps: [step(), step({ id: "b", index: 1, root: "G" })] });
    expect(out.metronome.every((m) => Number.isInteger(m.time))).toBe(true);
    expect(out.metronome).toHaveLength(8);
  });

  it("keeps every chordOnset on its exact bar boundary (never humanized)", async () => {
    const out = await buildAllLayersAsync({ ...baseInput, steps: [step(), step({ id: "b", index: 1, root: "G" })] });
    expect(out.chordOnsets.map((o) => o.time)).toEqual([0, 4]);
  });

  it("never drops a high-velocity structural drum hit", async () => {
    const out = await buildAllLayersAsync({ ...baseInput, steps: Array.from({ length: 8 }, (_, i) => step({ id: `s${i}`, index: i })) });
    const beatZeroKicks = out.drums.filter((d) => d.value.type === "kick" && d.value.velocity > 0.7);
    expect(beatZeroKicks.length).toBeGreaterThanOrEqual(8);
  });
});
