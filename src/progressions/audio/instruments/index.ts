import type { ChordInstrumentId, ChordVoice } from "./types";
import { strumVoice } from "./strumVoice";
import { pianoVoice } from "./pianoVoice";
import { organVoice } from "./organVoice";

export type { ChordInstrumentId, ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

const CHORD_VOICES: Record<ChordInstrumentId, ChordVoice> = {
  strum: strumVoice,
  piano: pianoVoice,
  organ: organVoice,
};

export function getChordVoice(id: ChordInstrumentId): ChordVoice {
  return CHORD_VOICES[id];
}
