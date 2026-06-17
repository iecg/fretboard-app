import { useProgressionAudioPlayback } from "../../hooks/useProgressionAudioPlayback";
import { useChordAudition } from "@fretflow/fretboard/hooks/useChordAudition";
import { ProgressionTrack } from "../ProgressionTrack/ProgressionTrack";

/**
 * The stacked top-band slot. Always renders the DAW `ProgressionTrack` and
 * hosts the progression playback hook, which runs unconditionally so
 * progression audio/playback state stays live. Also mounts the chord-audition
 * runner so the editor's Audition control has a live audio side-effect.
 */
export function ProgressionSummarySlot() {
  useProgressionAudioPlayback();
  useChordAudition();
  return <ProgressionTrack />;
}
