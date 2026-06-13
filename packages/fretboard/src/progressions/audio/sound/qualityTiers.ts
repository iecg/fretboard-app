export type QualityTier = "eco" | "standard" | "high";
export type QualitySetting = "auto" | QualityTier;
export type LayoutTier = "mobile" | "tablet" | "desktop";

export interface TierProfile {
  reverbEngine: "freeverb" | "jcreverb" | "convolution";
  perInstrumentInserts: boolean;
  delaySends: boolean;
  maxPolyphony: number;
  oversample: "none" | "2x";
}

export const TIER_PROFILES: Record<QualityTier, TierProfile> = {
  eco: { reverbEngine: "freeverb", perInstrumentInserts: false, delaySends: false, maxPolyphony: 12, oversample: "none" },
  standard: { reverbEngine: "jcreverb", perInstrumentInserts: true, delaySends: false, maxPolyphony: 24, oversample: "none" },
  high: { reverbEngine: "convolution", perInstrumentInserts: true, delaySends: true, maxPolyphony: 48, oversample: "2x" },
};

const ORDER: QualityTier[] = ["eco", "standard", "high"];
const lower = (a: QualityTier, b: QualityTier): QualityTier =>
  ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;

export interface DetectInputs {
  cores?: number; // navigator.hardwareConcurrency
  memoryGb?: number; // navigator.deviceMemory
  layoutTier: LayoutTier;
}

function hardwareTier(cores: number | undefined, memoryGb: number | undefined): QualityTier {
  const c = cores ?? 4;
  const m = memoryGb ?? 4;
  if (c >= 8 && m >= 8) return "high";
  if (c >= 4 && m >= 4) return "standard";
  return "eco";
}

function layoutCap(layoutTier: LayoutTier): QualityTier {
  if (layoutTier === "mobile") return "eco";
  if (layoutTier === "tablet") return "standard";
  return "high";
}

/** Conservative: the lower of hardware-derived and layout-derived tier. */
export function detectDefaultTier(inputs: DetectInputs): QualityTier {
  return lower(hardwareTier(inputs.cores, inputs.memoryGb), layoutCap(inputs.layoutTier));
}

export function resolveTier(setting: QualitySetting, detect: () => QualityTier): QualityTier {
  return setting === "auto" ? detect() : setting;
}
