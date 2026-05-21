export interface VoiceHandle {
  cancel(): void;
}

export type ChordInstrumentId = "strum" | "piano" | "organ";

export interface ChordVoiceOptions {
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: "up" | "down";
}

export interface ChordVoice {
  scheduleChord(
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle;
}
