import clsx from "clsx";
import {
  Drum,
  Guitar,
  LoaderCircle,
  Piano,
  Play,
  Repeat,
  Square,
  Timer,
} from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useTranslation } from "../../hooks/useTranslation";
import shared from "../shared/shared.module.css";
import styles from "./TransportBar.module.css";

/**
 * Playback + backing-instrument controls for the DAW progression track.
 * Self-contained: subscribes to the playback atoms via `usePlaybackTransportModel`.
 */
export function TransportBar() {
  const { t } = useTranslation();
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionPlaybackLoading,
    setProgressionPlaying,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionStrumEnabled,
    setProgressionStrumEnabled,
    progressionBassEnabled,
    setProgressionBassEnabled,
    progressionDrumsEnabled,
    setProgressionDrumsEnabled,
    progressionMetronomeEnabled,
    setProgressionMetronomeEnabled,
    stopProgressionPlayback,
  } = usePlaybackTransportModel();
  const canPlay = !progressionPlaybackBlockedReason;
  const playStopDisabled = !progressionPlaying && (!canPlay || progressionPlaybackLoading);
  const playStopIsPlaying = progressionPlaying;
  const progressionLabel = t("inspector.groupProgression").toLocaleLowerCase();
  const playStopLabel = playStopIsPlaying
    ? `${t("controls.stopProgression")} ${progressionLabel}`
    : `${t("controls.playProgressionTooltip")} ${progressionLabel}`;

  const handlePlayStopClick = () => {
    if (progressionPlaying) {
      stopProgressionPlayback();
      return;
    }

    // Direct synchronous write. Wrapping this Jotai setter in startTransition
    // tagged every progression-atom subscriber's rerender to the transition and
    // tripped React's ">10 fibers inside startTransition" subscription warning.
    setProgressionPlaying(true);
  };

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
        <button
          type="button"
          className={clsx(
            styles.transportButton,
            styles.playButton,
            playStopIsPlaying && styles["transportButton--accent"],
          )}
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
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionLoopEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
          aria-pressed={progressionLoopEnabled}
          aria-label="Loop progression"
        >
          <Repeat size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <span className={styles.clusterDivider} aria-hidden="true" />

      <div className={styles.instrumentCluster} role="group" aria-label="Backing instruments">
        <button
          type="button"
          className={clsx(styles.transportButton, progressionStrumEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionStrumEnabled(!progressionStrumEnabled)}
          aria-pressed={progressionStrumEnabled}
          aria-label={t("controls.chords")}
          title={t("controls.chords")}
        >
          <Piano size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionBassEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionBassEnabled(!progressionBassEnabled)}
          aria-pressed={progressionBassEnabled}
          aria-label={t("controls.bassline")}
          title={t("controls.bassline")}
        >
          {/* The guitar reads as the bass instrument now that chords are piano. */}
          <Guitar size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionDrumsEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionDrumsEnabled(!progressionDrumsEnabled)}
          aria-pressed={progressionDrumsEnabled}
          aria-label={t("controls.drums")}
          title={t("controls.drums")}
        >
          <Drum size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={clsx(styles.transportButton, progressionMetronomeEnabled && styles["transportButton--accent"])}
          onClick={() => setProgressionMetronomeEnabled(!progressionMetronomeEnabled)}
          aria-pressed={progressionMetronomeEnabled}
          aria-label={t("controls.metronome")}
          title={t("controls.metronome")}
        >
          <Timer size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
