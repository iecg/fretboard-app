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
  // PluckSynth.triggerAttack(note, time) ignores any third velocity arg at
  // runtime — the comb filter is excited unconditionally. Apply per-voice
  // dynamics through the synth's `volume` (dB) instead so strum velocity is
  // honored. `gainToDb` maps linear gain [0,1] to dB; clamp to a small floor
  // to avoid -Infinity for vanishingly quiet plucks.
  synth.volume.value = Tone.gainToDb(Math.max(velocity, 0.01));
  synth.triggerAttack(frequency, startTime);

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
