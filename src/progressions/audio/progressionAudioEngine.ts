import { getDraw, getTransport } from "tone";
import type { ProgressionPartHandle } from "./progressionPart";

export { ensureProgressionAudio, resumeProgressionAudio, restoreProgressionBus, silenceProgressionBus, configureProgressionGraph } from "./bus";
export { planSignalGraph } from "./sound/buildSignalGraph";
export type { SignalGraphPlan, MaterializedGraph } from "./sound/buildSignalGraph";
export { TIER_PROFILES, resolveTier, detectDefaultTier } from "./sound/qualityTiers";
export type { QualitySetting, QualityTier } from "./sound/qualityTiers";
export { getGenreMix, DEFAULT_GENRE_MIX } from "./sound/genreMixPresets";
export { getChordVoiceForInstrument } from "./instruments/index";
export { getBassPatch, getDrumKitPatch } from "./sound/instrumentPatches";
export { buildAllLayersAsync } from "./buildAllLayers";
export type { BassEvent, ChordOnsetEvent, ChordStrumEvent, DrumEvent, MetronomeEvent } from "./buildAllLayers";
export { createProgressionPart } from "./progressionPart";
export { setLayerGain } from "./layerBuses";
export { scheduleBassNote } from "./bass";
export { scheduleCrossStick, scheduleHiHat, scheduleKick, scheduleRide, scheduleSnare } from "./drumKit";
export { scheduleClick } from "./metronome";
export { clearTimeline, pauseTimeline, setActiveStep } from "./timeline";
export { getDraw, getTransport };
export type { ProgressionPartHandle };

export interface PlaybackPrimitives {
  parts: ProgressionPartHandle[];
  endEventId: number | null;
  totalDurationSec: number;
}

export function disposeAll(prims: PlaybackPrimitives | null): void {
  if (!prims) return;
  prims.parts.forEach((p) => p.dispose());
  if (prims.endEventId !== null) {
    getTransport().clear(prims.endEventId);
  }
}

export function setPlaybackTempo(tempo: number): void {
  const transport = getTransport() as unknown as { bpm?: { value: number } } | null;
  if (transport?.bpm) transport.bpm.value = tempo;
}

export function setPlaybackSwing(swing: number): void {
  const transport = getTransport() as unknown as { swing?: number } | null;
  if (transport && transport.swing !== undefined) transport.swing = swing;
}

export function setPlaybackTimeSignature(beatsPerBar: number): void {
  const transport = getTransport() as unknown as { timeSignature?: number } | null;
  if (transport && transport.timeSignature !== undefined) transport.timeSignature = beatsPerBar;
}

export function __resetProgressionAudioEngineForTests(): void {
  /* no-op — module-level caches are reset via test helpers */
}
