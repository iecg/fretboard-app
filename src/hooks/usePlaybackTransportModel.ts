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

  // --- Play/stop button model (single source of truth) -------------------
  // Every transport surface (TransportBar, HeaderTransportCluster,
  // DockTransport) shares the exact same play/stop semantics. Compute
  // them once here so behavior can never drift between surfaces.
  const canPlay = !progressionPlaybackBlockedReason;
  // Disabled when stopped + (blocked OR loading); never disabled while playing
  // so the user can always stop.
  const playStopDisabled = !progressionPlaying && (!canPlay || progressionPlaybackLoading);

  // i18n is resolved by each consumer via its own useTranslation() — the hook
  // stays free of translation coupling and returns the key + the `playing`
  // flag (already exposed as progressionPlaying) instead of a resolved string.
  // The label is "<verb> <progression>", so consumers combine playStopLabelKey
  // with t("inspector.groupProgression").
  const playStopLabelKey: "controls.stopProgression" | "controls.playProgressionTooltip" =
    progressionPlaying ? "controls.stopProgression" : "controls.playProgressionTooltip";

  const handlePlayStopClick = () => {
    if (progressionPlaying) {
      stopProgressionPlayback();
      return;
    }
    // Direct synchronous write. Wrapping this Jotai setter in startTransition
    // tagged every progression-atom subscriber's rerender to the transition and
    // tripped React's ">10 fibers inside startTransition" subscription warning.
    setProgressionPlaying(true);
  };

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
    // Shared play/stop button model.
    playStopDisabled,
    playStopLabelKey,
    handlePlayStopClick,
  };
}
