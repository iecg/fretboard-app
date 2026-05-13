import { useEffect } from "react";
import { useProgressionState } from "./useProgressionState";

export function useProgressionPlaybackLoop() {
  const {
    progressionEnabled,
    progressionPlaying,
    progressionStepDurationMs,
    progressionPlaybackBlockedReason,
    activeProgressionStepIndex,
    advanceProgressionPlayback,
  } = useProgressionState();

  useEffect(() => {
    if (!progressionEnabled || !progressionPlaying || progressionPlaybackBlockedReason) return;
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
