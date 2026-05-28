import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  beatsPerBarAtom,
  progressionBassEnabledAtom,
  progressionChordEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionLoopEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlaybackLoadingAtom,
  progressionPlayingAtom,
  progressionTempoBpmAtom,
  setProgressionPlayingAtom,
  stopProgressionPlaybackAtom,
  totalProgressionBarsAtom,
} from "../store/progressionAtoms";

/**
 * Narrow transport model: exposes only the state fields consumed by
 * `TransportBar` and `HeaderTransportCluster`.  By subscribing to exactly
 * these atoms the components avoid re-renders from unrelated progression
 * state (e.g. displayedStepIndex, step list changes).
 */
export function usePlaybackTransportModel() {
  const progressionPlaying = useAtomValue(progressionPlayingAtom);
  const progressionPlaybackBlockedReason = useAtomValue(progressionPlaybackBlockedReasonAtom);
  const progressionPlaybackLoading = useAtomValue(progressionPlaybackLoadingAtom);
  const progressionTempoBpm = useAtomValue(progressionTempoBpmAtom);
  const totalProgressionBars = useAtomValue(totalProgressionBarsAtom);
  const beatsPerBar = useAtomValue(beatsPerBarAtom);

  const [progressionLoopEnabled, setProgressionLoopEnabled] = useAtom(progressionLoopEnabledAtom);
  const [progressionChordEnabled, setProgressionChordEnabled] = useAtom(progressionChordEnabledAtom);
  const [progressionBassEnabled, setProgressionBassEnabled] = useAtom(progressionBassEnabledAtom);
  const [progressionDrumsEnabled, setProgressionDrumsEnabled] = useAtom(progressionDrumsEnabledAtom);
  const [progressionMetronomeEnabled, setProgressionMetronomeEnabled] = useAtom(progressionMetronomeEnabledAtom);

  const setProgressionPlaying = useSetAtom(setProgressionPlayingAtom);
  const stopProgressionPlayback = useSetAtom(stopProgressionPlaybackAtom);

  return {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionPlaybackLoading,
    progressionTempoBpm,
    totalProgressionBars,
    beatsPerBar,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionChordEnabled,
    setProgressionChordEnabled,
    progressionStrumEnabled: progressionChordEnabled,
    setProgressionStrumEnabled: setProgressionChordEnabled,
    progressionBassEnabled,
    setProgressionBassEnabled,
    progressionDrumsEnabled,
    setProgressionDrumsEnabled,
    progressionMetronomeEnabled,
    setProgressionMetronomeEnabled,
    setProgressionPlaying,
    stopProgressionPlayback,
  };
}
