import clsx from "clsx";
import {
  AudioWaveform,
  Drum,
  Guitar,
  Play,
  Repeat,
  Square,
  Timer,
} from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  progressionPlaybackLoadingAtom,
  stopProgressionPlaybackAtom,
} from "../../store/progressionAtoms";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./TransportBar.module.css";

/**
 * Playback + backing-instrument controls for the DAW progression track.
 * Self-contained: subscribes to the playback atoms via `useProgressionState`.
 */
export function TransportBar() {
  const { t } = useTranslation();
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
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
  } = useProgressionState();

  const progressionPlaybackLoading = useAtomValue(progressionPlaybackLoadingAtom);
  const stopProgressionPlayback = useSetAtom(stopProgressionPlaybackAtom);
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

    setProgressionPlaying(true);
  };

  return (
    <div className={styles.transportBar} data-testid="transport-bar">
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
          {playStopIsPlaying ? (
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
    </div>
  );
}
