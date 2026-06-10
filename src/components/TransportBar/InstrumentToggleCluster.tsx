import clsx from "clsx";
import { AudioWaveform, Drum, Guitar, Timer } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import styles from "./TransportBar.module.css";

/**
 * The four backing-instrument on/off toggles — chord-strum, bass, drums,
 * metronome. Extracted verbatim from `TransportBar` so both the desktop header
 * transport and the mobile Song tab share a single source of truth. Reuses
 * `TransportBar.module.css` so the buttons render byte-identically wherever the
 * cluster is hosted.
 */
export function InstrumentToggleCluster() {
  const {
    progressionStrumEnabled,
    setProgressionStrumEnabled,
    progressionBassEnabled,
    setProgressionBassEnabled,
    progressionDrumsEnabled,
    setProgressionDrumsEnabled,
    progressionMetronomeEnabled,
    setProgressionMetronomeEnabled,
  } = usePlaybackTransportModel();

  return (
    <div className={styles.instrumentCluster} role="group" aria-label="Backing instruments">
      <button
        type="button"
        className={clsx(styles.transportButton, progressionStrumEnabled && styles["transportButton--accent"])}
        onClick={() => setProgressionStrumEnabled(!progressionStrumEnabled)}
        aria-pressed={progressionStrumEnabled}
        aria-label="Chord strum"
        title="Chord strum"
      >
        <Guitar size={13} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={clsx(styles.transportButton, progressionBassEnabled && styles["transportButton--accent"])}
        onClick={() => setProgressionBassEnabled(!progressionBassEnabled)}
        aria-pressed={progressionBassEnabled}
        aria-label="Bassline"
        title="Bassline"
      >
        <AudioWaveform size={13} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={clsx(styles.transportButton, progressionDrumsEnabled && styles["transportButton--accent"])}
        onClick={() => setProgressionDrumsEnabled(!progressionDrumsEnabled)}
        aria-pressed={progressionDrumsEnabled}
        aria-label="Drums"
        title="Drums"
      >
        <Drum size={13} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={clsx(styles.transportButton, progressionMetronomeEnabled && styles["transportButton--accent"])}
        onClick={() => setProgressionMetronomeEnabled(!progressionMetronomeEnabled)}
        aria-pressed={progressionMetronomeEnabled}
        aria-label="Metronome"
        title="Metronome"
      >
        <Timer size={13} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}
