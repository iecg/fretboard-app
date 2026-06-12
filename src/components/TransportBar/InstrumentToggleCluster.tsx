import { Drum, Guitar, Piano, Timer } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useTranslation } from "../../hooks/useTranslation";
import { TransportButton } from "./TransportButton";
import styles from "./TransportBar.module.css";

/**
 * The four backing-instrument on/off toggles — chords, bass, drums, metronome.
 * Extracted from `TransportBar` so both the desktop header transport and the
 * mobile dock share a single source of truth. Reuses `TransportBar.module.css`
 * so the buttons render byte-identically wherever the cluster is hosted.
 *
 * Icons follow the actual backing-track sounds (PR #603): the chord layer is
 * piano, so the guitar glyph reads as the bass instrument.
 */
export function InstrumentToggleCluster() {
  const { t } = useTranslation();
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
        aria-label={t("controls.chords")}
        title={t("controls.chords")}
      >
        <Piano size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        active={progressionBassEnabled}
        onClick={() => setProgressionBassEnabled(!progressionBassEnabled)}
        aria-pressed={progressionBassEnabled}
        aria-label={t("controls.bassline")}
        title={t("controls.bassline")}
      >
        {/* The guitar reads as the bass instrument now that chords are piano. */}
        <Guitar size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        active={progressionDrumsEnabled}
        onClick={() => setProgressionDrumsEnabled(!progressionDrumsEnabled)}
        aria-pressed={progressionDrumsEnabled}
        aria-label={t("controls.drums")}
        title={t("controls.drums")}
      >
        <Drum size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        active={progressionMetronomeEnabled}
        onClick={() => setProgressionMetronomeEnabled(!progressionMetronomeEnabled)}
        aria-pressed={progressionMetronomeEnabled}
        aria-label={t("controls.metronome")}
        title={t("controls.metronome")}
      >
        <Timer size={13} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
    </div>
  );
}
