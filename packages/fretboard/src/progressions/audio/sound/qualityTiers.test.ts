import { describe, it, expect } from "vitest";
import {
  TIER_PROFILES, resolveTier, detectDefaultTier,
} from "./qualityTiers";

describe("quality tiers", () => {
  it("eco has no inserts; high has convolution reverb", () => {
    expect(TIER_PROFILES.eco.perInstrumentInserts).toBe(false);
    expect(TIER_PROFILES.eco.reverbEngine).not.toBe("convolution");
    expect(TIER_PROFILES.high.reverbEngine).toBe("convolution");
    expect(TIER_PROFILES.high.perInstrumentInserts).toBe(true);
    expect(TIER_PROFILES.high.delaySends).toBe(true);
  });

  it("resolveTier passes through explicit tiers and resolves auto via detector", () => {
    expect(resolveTier("eco", () => "high")).toBe("eco");
    expect(resolveTier("auto", () => "standard")).toBe("standard");
  });

  it("detectDefaultTier picks the conservative (lower) of hardware vs layout", () => {
    const tier = detectDefaultTier({ cores: 16, memoryGb: 16, layoutTier: "mobile" });
    expect(tier).toBe("eco");
    expect(detectDefaultTier({ cores: 8, memoryGb: 8, layoutTier: "desktop" })).toBe("high");
    expect(detectDefaultTier({ cores: 2, memoryGb: 2, layoutTier: "desktop" })).toBe("eco");
    expect(detectDefaultTier({ cores: 6, memoryGb: 4, layoutTier: "tablet" })).toBe("standard");
  });
});
