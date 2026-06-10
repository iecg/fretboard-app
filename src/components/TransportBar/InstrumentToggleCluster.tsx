import { AudioWaveform, Drum, Guitar, Timer } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { TransportButton } from "./TransportButton";
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
      <TransportButton
        active={progressionStrumEnabled}
        onClick={() => setProgressionStrumEnabled(!progressionStrumEnabled)}
        aria-pressed={progressionStrumEnabled}
        aria-label="Chord strum"
        title="Chord strum"
      >
        <Guitar size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        active={progressionBassEnabled}
        onClick={() => setProgressionBassEnabled(!progressionBassEnabled)}
        aria-pressed={progressionBassEnabled}
        aria-label="Bassline"
        title="Bassline"
      >
        <AudioWaveform size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        active={progressionDrumsEnabled}
        onClick={() => setProgressionDrumsEnabled(!progressionDrumsEnabled)}
        aria-pressed={progressionDrumsEnabled}
        aria-label="Drums"
        title="Drums"
      >
        <Drum size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        active={progressionMetronomeEnabled}
        onClick={() => setProgressionMetronomeEnabled(!progressionMetronomeEnabled)}
        aria-pressed={progressionMetronomeEnabled}
        aria-label="Metronome"
        title="Metronome"
      >
        <Timer size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
    </div>
  );
}
