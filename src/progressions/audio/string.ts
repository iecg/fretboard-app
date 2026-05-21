/**
 * Plucked-string voice for the progression backing track. Tone.PluckSynth
 * (Karplus-Strong) replaces the prior bespoke `PeriodicWave` + lowpass
 * voice. The comb-filter decay handles the natural ring-out — there's no
 * separate release envelope to fire on cancel.
 *
 * Routed through the progression bus (caller-supplied `dest`) so
 * `silenceProgressionBus()` mutes pluck voices along with the rest of the
 * backing track.
 */
import * as Tone from "tone";

const ATTACK_NOISE = 1.0;
const DAMPENING = 4000;
const RESONANCE = 0.85;
const RELEASE = 1.0;
// Defer dispose so the comb filter can ring out past the release tail.
const DISPOSE_TAIL_MS = (RELEASE + 0.1) * 1000;

export interface PluckedVoiceHandle {
  /** Schedule the voice for cleanup (deferred so the ring-out completes). */
  cancel: () => void;
}

export interface PluckStringOptions {
  /** Per-note loudness multiplier (0..1). Defaults to 1. */
  velocity?: number;
}

/**
 * Schedule a single plucked-string note on `dest` starting at `startTime`.
 * Returns a handle for cancelling the voice after its natural decay.
 */
export function pluckString(
  _ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  startTime: number,
  options: PluckStringOptions = {},
): PluckedVoiceHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 1));
  if (velocity <= 0) return { cancel: () => {} };

  const synth = new Tone.PluckSynth({
    attackNoise: ATTACK_NOISE,
    dampening: DAMPENING,
    resonance: RESONANCE,
    release: RELEASE,
  });
  synth.connect(dest);
  // PluckSynth.triggerAttack's public signature is (note, time), but the
  // underlying envelope accepts a velocity multiplier as a third arg (same as
  // the base Instrument.triggerAttack). We pass it through so strum dynamics
  // are honored — cast keeps TS happy without losing the ability to schedule
  // per-pluck velocity.
  (
    synth.triggerAttack as unknown as (
      n: number,
      t: number,
      v: number,
    ) => unknown
  )(frequency, startTime, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      // PluckSynth has no `triggerRelease` — its comb filter decays on its
      // own. Defer dispose so we don't truncate the natural ring-out.
      setTimeout(() => {
        try {
          synth.dispose();
        } catch {
          // already disposed
        }
      }, DISPOSE_TAIL_MS);
    },
  };
}
