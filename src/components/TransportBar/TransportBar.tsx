import { LoaderCircle, Play, Repeat, Square } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useTranslation } from "../../hooks/useTranslation";
import shared from "../shared/shared.module.css";
import { InstrumentToggleCluster } from "./InstrumentToggleCluster";
import { TransportButton } from "./TransportButton";
import styles from "./TransportBar.module.css";

/**
 * Playback + backing-instrument controls for the DAW progression track.
 * Self-contained: subscribes to the playback atoms via `usePlaybackTransportModel`.
 */
export function TransportBar() {
  const { t } = useTranslation();
  const {
    progressionPlaying,
    progressionPlaybackLoading,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    // Shared play/stop button model — single source of truth.
    playStopDisabled,
    playStopLabelKey,
    handlePlayStopClick,
  } = usePlaybackTransportModel();
  const playStopIsPlaying = progressionPlaying;
  const progressionLabel = t("inspector.groupProgression").toLocaleLowerCase();
  const playStopLabel = `${t(playStopLabelKey)} ${progressionLabel}`;

  return (
    <div className={styles.transportBar} data-testid="transport-bar">
      <span className={shared["sr-only"]} role="status" aria-live="polite">
        {progressionPlaying ? t("controls.lockedAnnouncement") : ""}
      </span>
      <div className={styles.statusLights} aria-label="Playback status">
        <span className={styles.statusLight} data-active={progressionPlaying ? "true" : undefined}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusLabel}>Play</span>
        </span>
        <span className={styles.statusLight} data-active={progressionLoopEnabled ? "true" : undefined}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusLabel}>Loop</span>
        </span>
      </div>

      <div className={styles.transportCluster}>
        <TransportButton
          className={styles.playButton}
          active={playStopIsPlaying}
          onClick={handlePlayStopClick}
          disabled={playStopDisabled}
          aria-label={playStopLabel}
          aria-busy={progressionPlaybackLoading || undefined}
        >
          {progressionPlaybackLoading && playStopIsPlaying ? (
            <LoaderCircle size={14} strokeWidth={2.4} aria-hidden="true" className={styles.spinIcon} />
          ) : playStopIsPlaying ? (
            <Square size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          ) : (
            <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          )}
        </TransportButton>
        <TransportButton
          active={progressionLoopEnabled}
          onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
          aria-pressed={progressionLoopEnabled}
          aria-label="Loop progression"
        >
          <Repeat size={13} strokeWidth={2.4} aria-hidden="true" />
        </TransportButton>
      </div>

      <span className={styles.clusterDivider} aria-hidden="true" />

      <InstrumentToggleCluster />
    </div>
  );
}
