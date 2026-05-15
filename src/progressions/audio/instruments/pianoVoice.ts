import { getNoteFrequency } from "@fretflow/core";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

const ATTACK = 0.005;
const DECAY_SHORT = 0.4;
const DECAY_LONG = 1.2;
const RELEASE = 0.8;
const MOD_INDEX = 2.5;
const MOD_RATIO = 1;
const FADE_OUT = 0.04;
const ENVELOPE_MIN = 0.001;

function schedulePianoNote(
  ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  time: number,
  velocity: number,
  decayTime: number,
): { cancel: () => void } | null {
  if (!Number.isFinite(frequency) || frequency <= 0 || velocity <= 0) return null;

  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const carrier = ctx.createOscillator();
  const envelope = ctx.createGain();

  modulator.type = "sine";
  modulator.frequency.setValueAtTime(frequency * MOD_RATIO, time);
  modGain.gain.setValueAtTime(frequency * MOD_INDEX, time);
  modGain.gain.exponentialRampToValueAtTime(
    frequency * MOD_INDEX * 0.1,
    time + ATTACK + decayTime,
  );

  carrier.type = "sine";
  carrier.frequency.setValueAtTime(frequency, time);

  envelope.gain.setValueAtTime(ENVELOPE_MIN, time);
  envelope.gain.linearRampToValueAtTime(velocity * 0.7, time + ATTACK);
  envelope.gain.exponentialRampToValueAtTime(
    velocity * 0.3,
    time + ATTACK + decayTime,
  );
  envelope.gain.exponentialRampToValueAtTime(
    ENVELOPE_MIN,
    time + ATTACK + decayTime + RELEASE,
  );

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(envelope);
  envelope.connect(dest);

  const stopAt = time + ATTACK + decayTime + RELEASE + 0.05;
  modulator.start(time);
  modulator.stop(stopAt);
  carrier.start(time);
  carrier.stop(stopAt);

  let stopped = false;
  const dispose = () => {
    try {
      modulator.disconnect();
      modGain.disconnect();
      carrier.disconnect();
      envelope.disconnect();
    } catch { /* already disconnected */ }
  };
  carrier.onended = dispose;

  return {
    cancel: () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      try {
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setValueAtTime(Math.max(envelope.gain.value, ENVELOPE_MIN), now);
        envelope.gain.exponentialRampToValueAtTime(ENVELOPE_MIN, now + FADE_OUT);
        carrier.stop(now + FADE_OUT + 0.01);
        modulator.stop(now + FADE_OUT + 0.01);
      } catch { dispose(); }
    },
  };
}

export const pianoVoice: ChordVoice = {
  scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const decayTime = options.style === "staccato" ? DECAY_SHORT
      : options.style === "sustained" ? DECAY_LONG * 1.5
      : DECAY_LONG;

    const voices = notes.map((note) => {
      const freq = getNoteFrequency(note);
      return schedulePianoNote(ctx, dest, freq, time, options.velocity, decayTime);
    }).filter(Boolean) as Array<{ cancel: () => void }>;

    return {
      cancel: () => { for (const v of voices) v.cancel(); },
    };
  },
};
