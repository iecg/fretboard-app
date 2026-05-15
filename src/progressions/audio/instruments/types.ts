export interface VoiceHandle {
  cancel(): void;
}

export type ChordInstrumentId = "strum" | "piano" | "organ";

export interface ChordVoiceOptions {
  velocity: number;
  style?: "staccato" | "sustained";
}

export interface ChordVoice {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle;
}
