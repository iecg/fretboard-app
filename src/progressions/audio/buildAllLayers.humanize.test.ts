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

  it("actually drops some ghost drum hits (real ghost-drop)", async () => {
    // The `funk` pattern has many sub-0.4 ghost hits (ghost snares <=0.2,
    // hats at 0.3/0.4) that are eligible to drop. Over 16 bars some must drop.
    const bars = 16;
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "funk",
      steps: Array.from({ length: bars }, (_, i) => step({ id: `s${i}`, index: i })),
    });
    // funk: 3 kicks + 5 snares + 16 hats = 24 hits/bar.
    const hitsPerBar = 24;
    const max = hitsPerBar * bars;
    expect(out.drums.length).toBeGreaterThan(0);
    expect(out.drums.length).toBeLessThan(max);
  });

  it("groove-locks on-beat strums tighter than off-beat strums", async () => {
    // pop-8ths at 60bpm → secondsPerBeat = 1, so a strum's grid time equals
    // its beat. On-beat hits use 40% of the 0.015 jitter (<=0.006); off-beat
    // hits use the full 0.015.
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "pop-8ths",
      steps: [step()],
    });
    const onBeat = out.chordStrums.find((s) => s.time < 0.5);
    expect(onBeat).toBeDefined();
    // Beat 0 → grid time 0; deviation bounded by the reduced on-beat amount.
    expect(Math.abs(onBeat!.time - 0)).toBeLessThanOrEqual(0.006);
    // Off-beat hit on beat 1.5 → grid time 1.5; deviation bounded by full amount.
    const offBeat = out.chordStrums.find((s) => Math.abs(s.time - 1.5) <= 0.015);
    expect(offBeat).toBeDefined();
    expect(Math.abs(offBeat!.time - 1.5)).toBeLessThanOrEqual(0.015);
  });
});
