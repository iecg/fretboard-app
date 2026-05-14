import { useEffect } from "react";
import { ensureProgressionAudio } from "../progressions/audio/bus";
import { isCurrentStepFinished } from "../progressions/audio/timeline";
import { useProgressionState } from "./useProgressionState";

/** Poll interval for the audio-clock step boundary check. 20 ms is the
 *  trade-off between sub-frame accuracy of the active-step badge and CPU
 *  spent on no-op polls. The playhead and position readout poll the same
 *  timeline at 60 Hz independently. */
const AUDIO_TICK_MS = 20;

/**
 * Advance the active progression step when the audio clock crosses the
 * end of the currently-scheduled segment. Replaces the prior
 * `setTimeout(stepDurationMs)` driver — anchoring step advancement to
 * `AudioContext.currentTime` keeps React's notion of "current chord" in
 * lockstep with the audio.
 *
 * Falls back to a JS-timer-based advance when Web Audio is unavailable
 * (jsdom, SSR, locked autoplay policy). The fallback path preserves the
 * pre-refactor behaviour so unit tests that mount the progression without
 * a real `AudioContext` still observe step transitions.
 */
export function useProgressionPlaybackLoop() {
  const {
    progressionEnabled,
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionStepDurationMs,
    activeProgressionStepIndex,
    advanceProgressionPlayback,
  } = useProgressionState();

  useEffect(() => {
    if (
      !progressionEnabled
      || !progressionPlaying
      || progressionPlaybackBlockedReason
    ) {
      return;
    }

    // Prefer the audio-clock-driven advance whenever the AudioContext is
    // ready, since it tracks what the user actually hears.
    if (ensureProgressionAudio()) {
      const id = window.setInterval(() => {
        if (isCurrentStepFinished()) {
          advanceProgressionPlayback();
        }
      }, AUDIO_TICK_MS);
      return () => window.clearInterval(id);
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
    progressionEnabled,
    progressionPlaybackBlockedReason,
    progressionPlaying,
    progressionStepDurationMs,
    activeProgressionStepIndex,
  ]);
}
