/**
 * Metronome click. A short, bright sine ping with a small filtered-noise
 * transient — high-pitched on beat 1 (accent), lower on the other beats.
 *
 * Routed through a caller-supplied destination so the click can be tied to
 * the progression bus (silenced on pause) or sent to its own bus if we ever
 * want independent metronome volume.
 */

const ACCENT_FREQ = 1500;
const NORMAL_FREQ = 900;
const DECAY = 0.04;

export interface ClickOptions {
  accent?: boolean;
  velocity?: number;
}

export interface ClickHandle {
  cancel: () => void;
}

/** Schedule a single metronome click at the supplied AudioContext time. */
export function scheduleClick(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: ClickOptions = {},
): ClickHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.6));
  // Silent clicks would feed 0 into exponentialRampToValueAtTime, which
  // throws. Skip scheduling entirely — there's nothing to hear anyway.
  if (velocity <= 0) return { cancel: () => {} };
  const frequency = options.accent ? ACCENT_FREQ : NORMAL_FREQ;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(velocity, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + DECAY);

  osc.connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + DECAY + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      // already disconnected
    }
  };

  let canceled = false;
  return {
    cancel: () => {
      if (canceled) return;
      canceled = true;
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.01);
        osc.stop(ctx.currentTime + 0.012);
      } catch {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // already disconnected
        }
      }
    },
  };
}

export const _metronomeInternals = { ACCENT_FREQ, NORMAL_FREQ, DECAY };
