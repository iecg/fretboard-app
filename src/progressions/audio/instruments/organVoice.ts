import { getNoteFrequency } from "@fretflow/core";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

const ATTACK = 0.008;
const FADE_OUT = 0.04;
const ENVELOPE_MIN = 0.001;

const DRAWBAR_HARMONICS = [1, 2, 3, 4, 6, 8];
const DRAWBAR_LEVELS = [0.8, 0.6, 0.3, 0.2, 0.15, 0.1];

function scheduleOrganNote(
  ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  time: number,
  velocity: number,
): { cancel: () => void } | null {
  if (!Number.isFinite(frequency) || frequency <= 0 || velocity <= 0) return null;

  const merger = ctx.createGain();
  merger.gain.setValueAtTime(velocity * 0.4, time);
  merger.connect(dest);

  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  for (let i = 0; i < DRAWBAR_HARMONICS.length; i++) {
    const harmonicFreq = frequency * DRAWBAR_HARMONICS[i];
    if (harmonicFreq > 16000) continue;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(harmonicFreq, time);
    gain.gain.setValueAtTime(ENVELOPE_MIN, time);
    gain.gain.linearRampToValueAtTime(DRAWBAR_LEVELS[i], time + ATTACK);

    osc.connect(gain);
    gain.connect(merger);
    osc.start(time);
    oscs.push(osc);
    gains.push(gain);
  }

  let stopped = false;
  const dispose = () => {
    try {
      for (const o of oscs) o.disconnect();
      for (const g of gains) g.disconnect();
      merger.disconnect();
    } catch { /* already disconnected */ }
  };

  if (oscs.length > 0) {
    oscs[oscs.length - 1].onended = dispose;
  }

  return {
    cancel: () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      try {
        for (const g of gains) {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(Math.max(g.gain.value, ENVELOPE_MIN), now);
          g.gain.exponentialRampToValueAtTime(ENVELOPE_MIN, now + FADE_OUT);
        }
        for (const o of oscs) o.stop(now + FADE_OUT + 0.01);
      } catch { dispose(); }
    },
  };
}

export const organVoice: ChordVoice = {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const voices = notes.map((note) => {
      const freq = getNoteFrequency(note);
      return scheduleOrganNote(ctx, dest, freq, time, options.velocity);
    }).filter(Boolean) as Array<{ cancel: () => void }>;

    return {
      cancel: () => { for (const v of voices) v.cancel(); },
    };
  },
};
