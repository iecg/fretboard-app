export interface VoiceHandle {
  cancel(): void;
}

export type ChordInstrumentId = "strum" | "piano" | "organ";

export interface ChordVoiceOptions {
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: "up" | "down";
  /** Per-stroke note length override (seconds). Honored by all chord voices
   *  (strum, piano, organ); when omitted each voice uses its own default
   *  (the strum's `noteDurationSec`, or the poly patch's
   *  sustained/short duration). */
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
