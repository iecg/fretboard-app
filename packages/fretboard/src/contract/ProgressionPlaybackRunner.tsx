import { useProgressionAudioPlayback } from "../hooks/useProgressionAudioPlayback";

/**
 * Mounts the Tone.js progression playback engine against the embed's isolated
 * Jotai store. The web app mounts `useProgressionAudioPlayback` in its own
 * Inspector shell; the embed renders a bare `<Fretboard/>` that does NOT, so
 * without this runner an embedded host gets a silent progression. Rendered only
 * when the host opts in via `config.progressionEnabled`. Renders nothing.
 */
export function ProgressionPlaybackRunner() {
  useProgressionAudioPlayback();
  return null;
}
