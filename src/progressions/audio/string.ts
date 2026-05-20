/**
 * Plucked-string voice scheduled onto a caller-supplied destination. Mirrors
 * the timbre of `GuitarSynth` (periodic wave + lowpass damping envelope) but
 * is stateless and routes through the progression bus so paused playback can
 * be silenced with a single gain ramp upstream.
 *
 * The voice owns its own envelope so the strum decays cleanly. The caller
 * tracks pending voices via the returned handle and may call `cancel()` to
 * release the voice early on chord change or pause.
 */

const ATTACK = 0.005;
const DECAY = 0.85;
const RELEASE = 0.9;
const FADE_OUT = 0.04;
const ENVELOPE_MIN = 0.001;
const FILTER_Q = 1;
const FILTER_OPEN_MULT = 6;
const FILTER_BODY_MULT = 1.5;
const FILTER_DAMP_TIME = 0.15;

let guitarWave: PeriodicWave | null = null;
let waveCtx: AudioContext | null = null;

function getGuitarWave(ctx: AudioContext): PeriodicWave {
  if (guitarWave && waveCtx === ctx) return guitarWave;
  const real = new Float32Array([0, 1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06]);
  const imag = new Float32Array(real.length).fill(0);
  guitarWave = ctx.createPeriodicWave(real, imag);
  waveCtx = ctx;
  return guitarWave;
}

export interface PluckedVoiceHandle {
  /** Fade the voice out and stop the oscillator immediately. */
  cancel: () => void;
}

export interface PluckStringOptions {
  /** Per-note loudness multiplier (0..1). Defaults to 1. */
  velocity?: number;
}

/**
 * Schedule a single plucked-string note on `dest` starting at `startTime`.
 * Returns a handle for cancelling the voice before its natural release.
 */
export function pluckString(
  ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  startTime: number,
  options: PluckStringOptions = {},
): PluckedVoiceHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 1));
  const wave = getGuitarWave(ctx);

  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const osc = ctx.createOscillator();

  osc.setPeriodicWave(wave);
  osc.frequency.setValueAtTime(frequency, startTime);

  filter.type = "lowpass";
  filter.Q.value = FILTER_Q;
  filter.frequency.setValueAtTime(frequency * FILTER_OPEN_MULT, startTime);
  filter.frequency.exponentialRampToValueAtTime(
    frequency * FILTER_BODY_MULT,
    startTime + ATTACK + FILTER_DAMP_TIME,
  );
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(frequency, ENVELOPE_MIN),
    startTime + ATTACK + DECAY,
  );

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(velocity, startTime + ATTACK);
  gain.gain.exponentialRampToValueAtTime(
    ENVELOPE_MIN,
    startTime + ATTACK + DECAY + RELEASE,
  );

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  const stopAt = startTime + ATTACK + DECAY + RELEASE + 0.05;
  osc.start(startTime);
  osc.stop(stopAt);

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
      const fadeEnd = now + FADE_OUT;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, ENVELOPE_MIN), now);
        gain.gain.exponentialRampToValueAtTime(ENVELOPE_MIN, fadeEnd);
        osc.stop(fadeEnd + 0.01);
      } catch {
        dispose();
      }
    },
  };
}
