import { useProgressionAudioPlayback } from "../hooks/useProgressionAudioPlayback";
import { useChordAudition } from "../hooks/useChordAudition";

/**
 * Mounts the Tone.js progression playback engine against the embed's isolated
 * Jotai store. The web app mounts `useProgressionAudioPlayback` in its own
 * Inspector shell; the embed renders a bare `<Fretboard/>` that does NOT, so
 * without this runner an embedded host gets a silent progression. Rendered only
 * when the host opts in via `config.progressionEnabled`. Also mounts the
 * chord-audition runner so the audition control works in the embed. Renders
 * nothing.
 */
export function ProgressionPlaybackRunner() {
  useProgressionAudioPlayback();
  useChordAudition();
  return null;
}
