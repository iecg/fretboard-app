import { getNoteFrequency } from "@fretflow/core";
import { pluckString } from "../string";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";
import type { StrumSpec } from "../sound/patchTypes";

export const STRUM_LAG_SECONDS = 0.018;

export function createStrumVoice(spec?: StrumSpec): ChordVoice {
  return {
    scheduleChord(dest: AudioNode, notes: readonly string[], time: number, options: ChordVoiceOptions): VoiceHandle {
      const ordered = options.direction === "up" ? [...notes].reverse() : notes;
      const voices = ordered.map((note, i) => {
        const freq = getNoteFrequency(note);
        if (!Number.isFinite(freq) || freq <= 0) return null;
        return pluckString(dest, freq, time + i * STRUM_LAG_SECONDS, { velocity: options.velocity, spec });
      }).filter(Boolean) as Array<{ cancel: () => void }>;
      return { cancel: () => { for (const v of voices) v.cancel(); } };
    },
  };
}
