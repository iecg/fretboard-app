/**
 * Bass-line voice for the progression backing track. Sawtooth oscillator
 * through a lowpass filter with a percussive envelope — punchy on the
 * downbeat, decays before the next hit.
 */

const ATTACK = 0.005;
const DECAY = 0.4;
const RELEASE = 0.25;
const FILTER_CUTOFF_HZ = 1200;
const FILTER_Q = 2;

export interface BassNoteOptions {
  velocity?: number;
  /** Custom note length in seconds (clamps to 0.05–2.0). */
  durationSec?: number;
}

export interface BassVoiceHandle {
  cancel: () => void;
}

/**
 * Schedule a single bass note. Returns a handle that can be cancelled on
 * chord change so the next bass note does not bleed into the previous one.
 */
export function scheduleBassNote(
  ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  time: number,
  options: BassNoteOptions = {},
): BassVoiceHandle {
  const velocity = Math.max(0, Math.min(1.2, options.velocity ?? 0.9));
  const noteLen = Math.max(0.05, Math.min(2, options.durationSec ?? DECAY + RELEASE));

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(frequency, time);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = FILTER_Q;
  filter.frequency.setValueAtTime(FILTER_CUTOFF_HZ, time);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(frequency * 1.5, 200),
    time + ATTACK + DECAY,
  );

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(velocity, time + ATTACK);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + noteLen);

  osc.connect(filter).connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + noteLen + 0.05);

  let stopped = false;
  const dispose = () => {
    try {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {
      // already disconnected
    }
  };
  osc.onended = dispose;

  return {
    cancel: () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.stop(now + 0.06);
      } catch {
        dispose();
      }
    },
  };
}

export const _bassInternals = { ATTACK, DECAY, RELEASE };
