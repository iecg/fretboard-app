/**
 * Synthesized drum kit voices on Tone.js primitives:
 *
 *  - Kick  → `Tone.MembraneSynth` (sine + pitch-decay)
 *  - Snare → `Tone.NoiseSynth`    (white noise + envelope)
 *  - HiHat → `Tone.MetalSynth`    (short decay closed / longer decay open)
 *  - Ride  → `Tone.MetalSynth`    (long decay)
 *
 * Each schedule function constructs a fresh, one-shot voice, triggers it at
 * `time` (an absolute Tone Transport-compatible seconds value), and returns a
 * handle whose `cancel()` defers `dispose()` past the voice's release tail to
 * avoid truncation clicks. This matches the pattern used by `metronome.ts`,
 * `bass.ts`, and `string.ts` after the Phase 7B migration.
 *
 * The `ctx` argument is preserved on every signature for call-site
 * compatibility with the scheduler (which still threads an `AudioContext`
 * through) but is unused — Tone manages its own audio context.
 */
import * as Tone from "tone";

const HIT_VELOCITY_DEFAULT = 1;

function clampVelocity(v: number | undefined): number {
  if (v === undefined) return HIT_VELOCITY_DEFAULT;
  return Math.max(0, Math.min(1.5, v));
}

// Dispose-deferral windows (ms) chosen per voice so the natural release tail
// is not truncated. Slightly longer than the voice's release time gives the
// envelope room to settle before we drop the node.
const KICK_DISPOSE_MS = 600; // kick decay ~350 ms
const SNARE_DISPOSE_MS = 300; // snare decay ~180 ms
const HAT_CLOSED_DISPOSE_MS = 150; // closed hat decay ~50 ms
const HAT_OPEN_DISPOSE_MS = 500; // open hat decay ~350 ms
const RIDE_DISPOSE_MS = 1500; // ride decay ~1 s

export interface DrumHitOptions {
  velocity?: number;
}

export interface DrumVoiceHandle {
  cancel: () => void;
}

interface DisposableSynth {
  dispose: () => void;
}

/**
 * Build a one-shot voice handle whose `cancel()` defers `synth.dispose()` by
 * `tailMs` so the voice's release tail isn't cut off. Repeated `cancel()`
 * calls are idempotent — only the first schedules the timer.
 */
function deferredDisposeHandle(
  synth: DisposableSynth,
  tailMs: number,
): DrumVoiceHandle {
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      setTimeout(() => {
        try {
          synth.dispose();
        } catch {
          /* already disposed */
        }
      }, tailMs);
    },
  };
}

const NOOP_HANDLE: DrumVoiceHandle = { cancel: () => {} };

/**
 * Schedule a kick drum hit at `time`. `Tone.MembraneSynth` provides the
 * punchy 808-style envelope: sine oscillator with an exponential pitch drop,
 * fast attack, ~350 ms decay.
 */
export function scheduleKick(
  _ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;

  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.001,
      decay: 0.35,
      sustain: 0,
      release: 0.1,
      attackCurve: "exponential",
    },
  });
  synth.connect(dest);
  synth.triggerAttackRelease("C1", 0.5, time, velocity);
  return deferredDisposeHandle(synth, KICK_DISPOSE_MS);
}

/**
 * Schedule a snare hit at `time`. Pure `Tone.NoiseSynth` (white noise + AD
 * envelope) — note: `NoiseSynth.triggerAttackRelease` takes `(duration, time,
 * velocity)` with no note argument, since noise has no pitch.
 */
export function scheduleSnare(
  _ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;

  const synth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.001,
      decay: 0.18,
      sustain: 0,
      release: 0.05,
    },
  });
  synth.connect(dest);
  // NoiseSynth has no pitch — signature is (duration, time, velocity).
  synth.triggerAttackRelease(0.18, time, velocity);
  return deferredDisposeHandle(synth, SNARE_DISPOSE_MS);
}

export interface HiHatOptions extends DrumHitOptions {
  /** Open hat has a longer decay tail. Default false (closed). */
  open?: boolean;
}

/**
 * Schedule a hi-hat hit at `time` on `Tone.MetalSynth`. Open variant uses a
 * ~350 ms decay; closed variant chokes at ~50 ms. The longer dispose-deferral
 * for the open variant prevents the tail from being truncated on `cancel()`.
 */
export function scheduleHiHat(
  _ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: HiHatOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const decay = options.open ? 0.35 : 0.05;

  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  synth.connect(dest);
  synth.triggerAttackRelease("C6", decay, time, velocity);
  return deferredDisposeHandle(
    synth,
    options.open ? HAT_OPEN_DISPOSE_MS : HAT_CLOSED_DISPOSE_MS,
  );
}

export interface RideOptions extends DrumHitOptions {
  bell?: boolean;
}

/**
 * Schedule a ride cymbal hit at `time` on `Tone.MetalSynth`. Longer decay
 * than the hi-hat (~1 s). The `bell` option is preserved on the public
 * options shape for call-site compatibility but isn't yet wired into the
 * Tone voice — bell-mode shading is a future refinement.
 */
export function scheduleRide(
  _ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: RideOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;

  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.0, release: 0.3 },
    harmonicity: 3.1,
    modulationIndex: 22,
    resonance: 2400,
    octaves: 1.0,
  });
  synth.connect(dest);
  synth.triggerAttackRelease("D6", 1.0, time, velocity);
  return deferredDisposeHandle(synth, RIDE_DISPOSE_MS);
}
