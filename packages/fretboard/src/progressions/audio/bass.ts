/**
 * Bass voice for the progression backing track. Patch-driven: each BassPatch
 * supplies oscillator type, amplitude envelope, and a LIVE filter envelope
 * (octaves > 0). One voice pool per patch id ensures voices are reused across
 * notes that share the same patch.
 */
import * as Tone from "tone";
import type { BassPatch } from "./sound/patchTypes";
import { getBassPatch } from "./sound/instrumentPatches";

const DEFAULT_BASS_PATCH_ID = "bass-finger";

export interface BassNoteOptions {
  velocity?: number;
  /** Custom note length in seconds (clamps to 0.05–2.0). */
  durationSec?: number;
  patch?: BassPatch;
}

export interface BassVoiceHandle {
  cancel: () => void;
}

const synthsByPatchId = new Map<string, Tone.MonoSynth>();

function synthForPatch(patch: BassPatch, dest: AudioNode): Tone.MonoSynth {
  const existing = synthsByPatchId.get(patch.id);
  if (existing) return existing;
  const synth = new Tone.MonoSynth({
    volume: patch.volumeDb,
    oscillator: { type: patch.oscillator.type } as Tone.MonoSynthOptions["oscillator"],
    envelope: patch.envelope,
    filter: { type: patch.filter.type, Q: patch.filter.Q },
    filterEnvelope: patch.filterEnvelope,
  });
  synth.connect(dest);
  synthsByPatchId.set(patch.id, synth);
  return synth;
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
  const noteLen = Math.max(
    0.05,
    Math.min(2, options.durationSec ?? patch.envelope.decay + patch.envelope.release),
  );

  const synth = synthForPatch(patch, dest);
  synth.disconnect();
  synth.connect(dest);

  // Route through the progression bus so silenceProgressionBus() mutes the
  // bass along with the rest of the backing track.
  synth.triggerAttackRelease(frequency, noteLen, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;

      const cancelTime = Tone.now();
      if (cancelTime < time) {
        // Note was scheduled for a future `time` but cancelled before it
        // starts — cancel the pending triggers on envelopes.
        synth.envelope.cancel(cancelTime);
        synth.filterEnvelope.cancel(cancelTime);
        return;
      }

      try {
        synth.triggerRelease(cancelTime);
      } catch {
        // Ignore
      }
    },
  };
}

/** Test-only reset so the module behaves predictably across vitest runs. */
export function _resetBassSynths(): void {
  synthsByPatchId.forEach((synth) => {
    try {
      synth.dispose();
    } catch {
      // Ignore
    }
  });
  synthsByPatchId.clear();
}
