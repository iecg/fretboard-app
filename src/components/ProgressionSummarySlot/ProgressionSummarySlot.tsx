import { useProgressionAudioPlayback } from "../../hooks/useProgressionAudioPlayback";
import { useProgressionPlaybackLoop } from "../../hooks/useProgressionPlaybackLoop";
import { ProgressionTrack } from "../ProgressionTrack/ProgressionTrack";

/**
 * The stacked top-band slot. Always renders the DAW `ProgressionTrack` and
 * hosts the two progression playback hooks, which run unconditionally so
 * progression audio/playback state stays live.
 */
export function ProgressionSummarySlot() {
  useProgressionPlaybackLoop();
  useProgressionAudioPlayback();
  return <ProgressionTrack />;
}
