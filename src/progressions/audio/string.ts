/**
 * Plucked-string voice for the progression backing track. Tone.PluckSynth
 * (Karplus-Strong) replaces the prior bespoke `PeriodicWave` + lowpass
 * voice. The comb-filter decay handles the natural ring-out — there's no
 * separate release envelope to fire on cancel.
 *
 * Voices are pooled via `createReusableVoicePool` (mirrors bass.ts /
 * drumKit.ts). Without pooling, the strum pattern was constructing ~64
 * PluckSynth instances per bar and disposing them via setTimeout, churning
 * the audio graph and progressively degrading the audio thread over many
 * loop iterations. Root cause documented in
 * docs/superpowers/research/2026-05-25-playback-degradation.md.
 *
 * Routed through the progression bus (caller-supplied `dest`) so
 * `silenceProgressionBus()` mutes pluck voices along with the rest of the
 * backing track.
 */
import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";

const ATTACK_NOISE = 1.0;
const DAMPENING = 4000;
const RESONANCE = 0.85;
const RELEASE = 1.0;
// PluckSynth has no triggerRelease — the comb filter decays naturally over
// ~RELEASE seconds. Mark the voice busy for this long so the pool doesn't
// hand it to another pluck mid-ring-out.
const RELEASE_TAIL_SEC = RELEASE + 0.1;

export interface PluckedVoiceHandle {
  /** Mark the voice eligible for reuse after its release tail. Idempotent. */
  cancel: () => void;
}

export interface PluckStringOptions {
  /** Per-note loudness multiplier (0..1). Defaults to 1. */
  velocity?: number;
}

const pluckPool = createReusableVoicePool({
  createVoice: () =>
    new Tone.PluckSynth({
      attackNoise: ATTACK_NOISE,
      dampening: DAMPENING,
      resonance: RESONANCE,
      release: RELEASE,
    }),
});

/**
 * Schedule a single plucked-string note on `dest` starting at `startTime`.
 * Returns a handle for cancelling the voice after its natural decay.
 */
export function pluckString(
  dest: AudioNode,
  frequency: number,
  startTime: number,
  options: PluckStringOptions = {},
): PluckedVoiceHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 1));
  if (velocity <= 0) return { cancel: () => {} };

  const now = Tone.now();
  const playbackStartTime = Math.max(now, startTime);
  const lease = pluckPool.lease(dest, now);
  lease.setBusyUntil(playbackStartTime + RELEASE_TAIL_SEC);

  // PluckSynth.triggerAttack(note, time) ignores any third velocity arg at
  // runtime — the comb filter is excited unconditionally. Apply per-voice
  // dynamics through the synth's `volume` (dB) instead so strum velocity is
  // honored. `gainToDb` maps linear gain [0,1] to dB; clamp to a small floor
  // to avoid -Infinity for vanishingly quiet plucks.
  lease.voice.volume.value = Tone.gainToDb(Math.max(velocity, 0.01));
  lease.voice.triggerAttack(frequency, startTime);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      // No-op for the audio: PluckSynth's comb filter decays on its own,
      // and the voice is already marked busy until the release tail
      // completes — at which point the pool will hand it to the next pluck.
      // We don't call lease.dispose() because pooled voices stay alive
      // for reuse; explicit dispose would defeat the entire point.
    },
  };
}
