import { getNoteFrequency } from "@fretflow/core";
import { pluckString } from "../string";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

export const STRUM_LAG_SECONDS = 0.018;

export const strumVoice: ChordVoice = {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const voices = notes.map((note, i) => {
      const freq = getNoteFrequency(note);
      if (!Number.isFinite(freq) || freq <= 0) return null;
      return pluckString(ctx, dest, freq, time + i * STRUM_LAG_SECONDS, {
        velocity: options.velocity,
      });
    }).filter(Boolean) as Array<{ cancel: () => void }>;

    return {
      cancel: () => {
        for (const v of voices) v.cancel();
      },
    };
  },
};
