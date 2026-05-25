import { getDraw, getTransport } from "tone";
import type { MetronomeLoopHandle } from "./progressionMetronomeLoop";
import type { ProgressionPartHandle } from "./progressionPart";

export { ensureProgressionAudio, resumeProgressionAudio, restoreProgressionBus, silenceProgressionBus } from "./bus";
export { buildAllLayers } from "./buildAllLayers";
export type { BassEvent, ChordOnsetEvent, ChordStrumEvent, DrumEvent } from "./buildAllLayers";
export { createMetronomeLoop } from "./progressionMetronomeLoop";
export { createProgressionPart } from "./progressionPart";
export { setLayerGain } from "./layerBuses";
export { getChordVoice } from "./instruments/index";
export { scheduleBassNote } from "./bass";
export { scheduleHiHat, scheduleKick, scheduleRide, scheduleSnare } from "./drumKit";
export { scheduleClick } from "./metronome";
export { clearTimeline, pauseTimeline, setActiveStep } from "./timeline";
export { getDraw, getTransport };
export type { MetronomeLoopHandle, ProgressionPartHandle };

export interface PlaybackPrimitives {
  parts: ProgressionPartHandle[];
  loop: MetronomeLoopHandle | null;
  endEventId: number | null;
  totalDurationSec: number;
}

export function disposeAll(prims: PlaybackPrimitives | null): void {
  if (!prims) return;
  prims.parts.forEach((p) => p.dispose());
  prims.loop?.dispose();
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
