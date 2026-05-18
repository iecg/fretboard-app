import { useAtomValue } from "jotai";
import { useProgressionAudioPlayback } from "../../hooks/useProgressionAudioPlayback";
import { useProgressionPlaybackLoop } from "../../hooks/useProgressionPlaybackLoop";
import { progressionEnabledAtom } from "../../store/atoms";
import { ProgressionTrack } from "../ProgressionTrack/ProgressionTrack";

/**
 * The stacked top-band slot. In progression mode it renders the DAW
 * `ProgressionTrack`; in scale mode it renders nothing — the scale-mode lens
 * (`TopBandSummary`) is rendered separately as a floating overlay over the
 * fretboard by `FretboardLensOverlay` (DAW Shell Phase 13a). The two playback
 * hooks run unconditionally so progression audio/playback state stays live
 * regardless of which mode is active.
 */
export function ProgressionSummarySlot() {
  useProgressionPlaybackLoop();
  useProgressionAudioPlayback();
  const progressionEnabled = useAtomValue(progressionEnabledAtom);
  return progressionEnabled ? <ProgressionTrack /> : null;
}
