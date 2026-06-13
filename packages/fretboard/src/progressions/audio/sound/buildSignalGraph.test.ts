import { describe, it, expect } from "vitest";
import { planSignalGraph } from "./buildSignalGraph";
import { TIER_PROFILES } from "./qualityTiers";
import { getGenreMix } from "./genreMixPresets";

const popMix = getGenreMix("pop")!;

describe("planSignalGraph", () => {
  it("eco tier: no per-instrument inserts, no delay send", () => {
    const plan = planSignalGraph(TIER_PROFILES.eco, popMix);
    for (const ch of Object.values(plan.channels)) {
      expect(ch.insert).toBeUndefined();
      expect(ch.delaySend).toBeUndefined();
    }
    expect(plan.reverbEngine).toBe("freeverb");
    expect(plan.delayBus).toBe(false);
  });

  it("high tier: inserts present where the patch defines them; delay bus on", () => {
    const plan = planSignalGraph(TIER_PROFILES.high, popMix);
    expect(plan.channels.chord.insert?.eq3).toBeDefined();
    expect(plan.channels.metronome.insert).toBeUndefined();
    expect(plan.reverbEngine).toBe("convolution");
    expect(plan.delayBus).toBe(true);
  });

  it("copies per-instrument volume/pan/sends from the mix", () => {
    const plan = planSignalGraph(TIER_PROFILES.standard, popMix);
    expect(plan.channels.bass.volumeDb).toBe(popMix.perInstrument.bass.volumeDb);
    expect(plan.channels.chord.pan).toBe(popMix.perInstrument.chord.pan);
    expect(plan.channels.drums.reverbSend).toBe(popMix.perInstrument.drums.reverbSend);
  });

  it("carries master compressor/reverb/limiter settings", () => {
    const plan = planSignalGraph(TIER_PROFILES.high, popMix);
    expect(plan.master.compressor.ratio).toBe(popMix.master.compressor.ratio);
    expect(plan.master.reverb.wet).toBe(popMix.master.reverb.wet);
    expect(plan.master.limiterThreshold).toBe(popMix.master.limiterThreshold);
  });
});
