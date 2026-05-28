/**
 * Bass voice for the progression backing track. Sawtooth oscillator with a
 * lowpass filter envelope (1200 Hz cutoff) and a percussive amplitude
 * envelope. Implemented on Tone.MonoSynth, which gives us per-voice filter
 * motion for free — the prior raw-Web-Audio version did the same with a
 * manual BiquadFilter.
 */
import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";

const ATTACK = 0.005;
const DECAY = 0.4;
const RELEASE = 0.25;
const FILTER_CUTOFF_HZ = 1200;
const FILTER_Q = 2;
const RELEASE_TAIL_SEC = RELEASE;
// Match the metronome's cancel-tail dispose-deferral window. Slightly longer
// than the metronome because the bass envelope's release is ~250 ms.
const DISPOSE_TAIL_MS = 50;
const DISPOSE_TAIL_SEC = DISPOSE_TAIL_MS / 1000;

export interface BassNoteOptions {
  velocity?: number;
  /** Custom note length in seconds (clamps to 0.05–2.0). */
  durationSec?: number;
}

export interface BassVoiceHandle {
  cancel: () => void;
}

const bassVoicePool = createReusableVoicePool({
  createVoice: () =>
    new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: ATTACK, decay: DECAY, sustain: 0, release: RELEASE },
      filter: { Q: FILTER_Q, type: "lowpass" },
      filterEnvelope: {
        attack: ATTACK,
        decay: DECAY,
        sustain: 0,
        release: RELEASE,
        baseFrequency: FILTER_CUTOFF_HZ,
        octaves: 0,
      },
    }),
});

/**
 * Schedule a single bass note. Returns a handle that can be cancelled on
 * chord change so the next bass note does not bleed into the previous one.
 */
export function scheduleBassNote(
  dest: AudioNode,
  frequency: number,
  time: number,
  options: BassNoteOptions = {},
): BassVoiceHandle {
  const velocity = Math.max(0, Math.min(1.2, options.velocity ?? 0.9));
  // Tone.js voices treat velocity=0 as a still-allocated voice; skip
  // scheduling entirely — silent bass notes have no audible effect and
  // consume no resources.
  if (velocity <= 0) {
    return { cancel: () => {} };
  }
  const noteLen = Math.max(0.05, Math.min(2, options.durationSec ?? DECAY + RELEASE));
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = bassVoicePool.lease(dest, now);
  let busyUntil = playbackStartTime + noteLen + RELEASE_TAIL_SEC;
  lease.setBusyUntil(busyUntil);
  // Route through the progression bus so silenceProgressionBus() mutes the
  // bass along with the rest of the backing track.
  lease.voice.triggerAttackRelease(frequency, noteLen, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      if (!lease.isCurrent()) return;

      const cancelTime = Tone.now();
      if (cancelTime < time) {
        lease.dispose();
        return;
      }

      if (cancelTime >= busyUntil) {
        return;
      }

      busyUntil = cancelTime + DISPOSE_TAIL_SEC;
      lease.setBusyUntil(busyUntil);
      // Same release-tail pattern as metronome.ts: close the envelope
      // explicitly, then defer dispose so the tail doesn't get truncated.
      // Calling synth.dispose() while the voice is mid-decay would cut the
      // tail abruptly and produce an audible click.
      try {
        lease.voice.triggerRelease(cancelTime);
        setTimeout(() => {
          try {
            lease.dispose();
          } catch {
            /* already disposed */
          }
        }, DISPOSE_TAIL_MS);
      } catch {
        try {
          lease.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}
