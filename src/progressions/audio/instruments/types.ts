export interface VoiceHandle {
  cancel(): void;
}

export type ChordInstrumentId = "strum" | "piano" | "organ";

export interface ChordVoiceOptions {
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: "up" | "down";
  /** Per-stroke note length override (seconds). Used by the strum voice for
   *  muted chicken-scratch strokes; ignored by piano/organ voices. */
  durationSec?: number;
}

export interface ChordVoice {
  scheduleChord(
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle;
}
