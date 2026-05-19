import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { ensureProgressionAudio } from "../progressions/audio/bus";
import { getTimeUntilCurrentStepEndMs, getTimelinePosition } from "../progressions/audio/timeline";
import { isMutedAtom } from "../store/atoms";
import { useProgressionState } from "./useProgressionState";

/**
 * Advance the active progression step when the audio clock crosses the
 * end of the currently-scheduled segment. Replaces the prior
 * `setTimeout(stepDurationMs)` driver — anchoring step advancement to the
 * exact audio-clock boundary keeps React's notion of "current chord" in
 * lockstep with the audio instead of landing on the next poll tick.
 *
 * Falls back to a JS-timer-based advance when Web Audio is unavailable
 * (jsdom, SSR, locked autoplay policy). The fallback path preserves the
 * pre-refactor behaviour so unit tests that mount the progression without
 * a real `AudioContext` still observe step transitions.
 */
export function useProgressionPlaybackLoop() {
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionStepDurationMs,
    activeProgressionStepIndex,
    advanceProgressionPlayback,
  } = useProgressionState();
  // While muted, `useProgressionAudioPlayback` clears the timeline; without
  // this guard the loop would spin re-arming against a null timeline.
  const isMuted = useAtomValue(isMutedAtom);

  useEffect(() => {
    if (
      !progressionPlaying
      || progressionPlaybackBlockedReason
      || isMuted
    ) {
      return;
    }

    // Prefer the audio-clock-driven advance whenever the AudioContext is
    // ready, since it tracks what the user actually hears.
    if (ensureProgressionAudio()) {
      let timeoutId: number | null = null;
      let cancelled = false;

      const armAdvance = () => {
        if (cancelled) return;

        const tl = getTimelinePosition();
        if (!tl || tl.stepIndex !== activeProgressionStepIndex) {
          // PlaybackLoop runs before the audio scheduler effect in
          // ProgressionSummarySlot, so on a fresh start or a step transition
          // the timeline may not be armed until the next macrotask. Retry once
          // the scheduler has had a chance to publish the active audio segment.
          timeoutId = window.setTimeout(armAdvance, 0);
          return;
        }

        const remainingMs = getTimeUntilCurrentStepEndMs() ?? 0;
        timeoutId = window.setTimeout(() => {
          advanceProgressionPlayback();
        }, remainingMs);
      };

      armAdvance();
      return () => {
        cancelled = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    // No Web Audio support — fall back to the wall-clock timer so the
    // progression still advances (used in tests and locked-autoplay
    // environments).
    if (progressionStepDurationMs <= 0) return;
    const timeoutId = window.setTimeout(() => {
      advanceProgressionPlayback();
    }, progressionStepDurationMs);
    return () => window.clearTimeout(timeoutId);
  }, [
    advanceProgressionPlayback,
    progressionPlaybackBlockedReason,
    progressionPlaying,
    isMuted,
    progressionStepDurationMs,
    activeProgressionStepIndex,
  ]);
}
