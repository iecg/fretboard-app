/**
 * Bass voice for the progression backing track. Patch-driven: each BassPatch
 * supplies oscillator type, amplitude envelope, and a LIVE filter envelope
 * (octaves > 0). One voice pool per patch id ensures voices are reused across
 * notes that share the same patch.
 */
import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";
import type { BassPatch } from "./sound/patchTypes";
import { getBassPatch } from "./sound/instrumentPatches";

const DEFAULT_BASS_PATCH_ID = "bass-finger";
const DISPOSE_TAIL_MS = 50;
const DISPOSE_TAIL_SEC = DISPOSE_TAIL_MS / 1000;

export interface BassNoteOptions {
  velocity?: number;
  /** Custom note length in seconds (clamps to 0.05–2.0). */
  durationSec?: number;
  patch?: BassPatch;
}

export interface BassVoiceHandle {
  cancel: () => void;
}

type BassPool = ReturnType<typeof createReusableVoicePool<Tone.MonoSynth>>;
const poolsByPatchId = new Map<string, BassPool>();

function poolForPatch(patch: BassPatch): BassPool {
  const existing = poolsByPatchId.get(patch.id);
  if (existing) return existing;
  const pool = createReusableVoicePool<Tone.MonoSynth>({
    createVoice: () =>
      new Tone.MonoSynth({
        volume: patch.volumeDb,
        oscillator: { type: patch.oscillator.type } as Tone.MonoSynthOptions["oscillator"],
        envelope: patch.envelope,
        filter: { type: patch.filter.type, Q: patch.filter.Q },
        filterEnvelope: patch.filterEnvelope,
      }),
  });
  poolsByPatchId.set(patch.id, pool);
  return pool;
}

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

  const patch = options.patch ?? getBassPatch(DEFAULT_BASS_PATCH_ID)!;
  const releaseTailSec = patch.envelope.release;
  const noteLen = Math.max(
    0.05,
    Math.min(2, options.durationSec ?? patch.envelope.decay + patch.envelope.release),
  );
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = poolForPatch(patch).lease(dest, now);
  let busyUntil = playbackStartTime + noteLen + releaseTailSec;
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
        // Note was scheduled for a future `time` but cancelled before it
        // starts — dispose to KILL the pending triggerAttackRelease on this
        // monophonic voice. Merely marking it idle would let the note fire.
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
