import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

interface ReusableChordVoiceConfig {
  volume: number;
  maxPolyphonyFloor: number;
  oscillator: { type: "custom"; partials: number[] };
  envelope: { attack: number; decay: number; sustain: number; release: number };
  durationFor: (options: ChordVoiceOptions) => number;
}

const DEFAULT_SHARED_MAX_POLYPHONY = 32;

export function createReusableChordVoice(
  config: ReusableChordVoiceConfig,
): ChordVoice {
  let synth: Tone.PolySynth<Tone.Synth> | null = null;
  let currentDest: AudioNode | null = null;

  const getSynth = (dest: AudioNode, notes: readonly string[]) => {
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: config.oscillator,
        envelope: config.envelope,
        volume: config.volume,
      });
    }
    if (currentDest !== dest) {
      synth.connect(dest);
      currentDest = dest;
    }
    synth.maxPolyphony = Math.max(
      notes.length,
      config.maxPolyphonyFloor,
      DEFAULT_SHARED_MAX_POLYPHONY,
    );
    return synth;
  };

  return {
    scheduleChord(dest, notes, time, options): VoiceHandle {
      const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
      if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };

      const activeSynth = getSynth(dest, notes);
      activeSynth.triggerAttackRelease(
        notes as string[],
        config.durationFor(options),
        time,
        velocity,
      );

      let cancelled = false;
      return {
        cancel: () => {
          if (cancelled) return;
          cancelled = true;
          activeSynth.releaseAll(Tone.now());
        },
      };
    },
  };
}
