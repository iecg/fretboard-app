export interface VoiceHandle {
  cancel(): void;
}

export interface ChordVoiceOptions {
  velocity: number;
  style?: "staccato" | "sustained";
  /** Per-stroke note length override (seconds). When omitted the poly patch's
   *  sustained/short duration applies. */
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
