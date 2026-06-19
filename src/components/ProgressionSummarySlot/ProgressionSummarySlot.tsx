import { useProgressionAudioPlayback } from "@fretflow/fretboard/hooks/useProgressionAudioPlayback";
import { ProgressionTrack } from "../ProgressionTrack/ProgressionTrack";

/**
 * The stacked top-band slot. Always renders the DAW `ProgressionTrack` and
 * hosts the progression playback hook, which runs unconditionally so
 * progression audio/playback state stays live.
 */
export function ProgressionSummarySlot() {
  useProgressionAudioPlayback();
  return <ProgressionTrack />;
}
