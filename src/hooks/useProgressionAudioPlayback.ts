import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { getNoteFrequency } from "@fretflow/core";
import { synth } from "../core/audio";
import { isMutedAtom } from "../store/atoms";
import {
  PROGRESSION_STRUM_DELAY_MS,
  resolveChordVoicing,
} from "../progressions/progressionAudio";
import { useProgressionState } from "./useProgressionState";

/**
 * Trigger an audible strum of the active chord whenever the active
 * progression step advances during playback.
 *
 * Reads chord identity from `activeResolvedProgressionStep` (root + quality),
 * resolves the voicing to absolute pitches, and schedules each note onto
 * the existing `GuitarSynth` with a small strum lag so the chord sounds
 * like a downstroke rather than a piano hit. Gated on `isMuted` so the
 * mute toggle in the header silences progression playback alongside
 * fretboard taps.
 *
 * The hook is a pure side-effect — it returns nothing. Mount it once
 * inside the progression surface that already owns the playback loop
 * (currently `ProgressionSummarySlot`).
 */
export function useProgressionAudioPlayback() {
  const {
    progressionEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
  } = useProgressionState();
  const isMuted = useAtomValue(isMutedAtom);

  // Track which step we last strummed so re-renders of this hook (e.g. from
  // other atoms changing in `useProgressionState`) don't fire a fresh strum
  // for an unchanged active step.
  const lastStrummedStepRef = useRef<number | null>(null);
  // Track the pending strum timeouts so we can cancel mid-strum if playback
  // stops or the step advances faster than the strum completes.
  const pendingTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const cancelPending = () => {
      pendingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      pendingTimeoutsRef.current = [];
    };

    if (
      !progressionEnabled
      || !progressionPlaying
      || progressionPlaybackBlockedReason
      || isMuted
    ) {
      cancelPending();
      lastStrummedStepRef.current = null;
      return;
    }

    // The active step hasn't changed since our last strum; do nothing.
    // Without this guard, unrelated atom updates that flow through
    // `useProgressionState` (tempo edits, loop toggles, etc.) would each
    // retrigger a fresh strum for the same chord.
    if (lastStrummedStepRef.current === activeProgressionStepIndex) return;
    lastStrummedStepRef.current = activeProgressionStepIndex;

    const step = activeResolvedProgressionStep;
    if (!step || step.unavailable || !step.root || !step.quality) return;

    const voicing = resolveChordVoicing(step.root, step.quality);
    if (voicing.length === 0) return;

    cancelPending();
    voicing.forEach((note, i) => {
      const freq = getNoteFrequency(note);
      const id = window.setTimeout(() => {
        void synth.playNote(freq);
      }, i * PROGRESSION_STRUM_DELAY_MS);
      pendingTimeoutsRef.current.push(id);
    });

    return cancelPending;
  }, [
    progressionEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    isMuted,
  ]);
}
