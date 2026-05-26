import clsx from "clsx";
import {
  AudioWaveform,
  Drum,
  Guitar,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Square,
  Timer,
} from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activeProgressionStepIndexAtom,
  progressionPlaybackLoadingAtom,
  stopProgressionPlaybackAtom,
} from "../../store/progressionAtoms";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useTranslation } from "../../hooks/useTranslation";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./TransportBar.module.css";

/**
 * Playback + backing-instrument controls for the DAW progression track.
 * Self-contained: subscribes to the playback atoms via `useProgressionState`.
 */
export function TransportBar() {
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    setProgressionPlaying,
    advanceProgressionPlayback,
    previousProgressionStep,
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
  // Intentionally reads the LOGICAL atom (not displayedProgressionStepIndexAtom):
  // Stop-button disabled state is editor state ("has the user advanced past step 0?"),
  // not visual playhead state — the RAF-driven displayed index would flicker the
  // disabled state at chord boundaries during playback.
  const activeIndex = useAtomValue(activeProgressionStepIndexAtom);
  const stopProgressionPlayback = useSetAtom(stopProgressionPlaybackAtom);
  const { t } = useTranslation();
  const canPlay = !progressionPlaybackBlockedReason;
  const stopDisabled = !canPlay || (!progressionPlaying && activeIndex === 0);

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
          className={styles.transportButton}
          onClick={() => previousProgressionStep()}
          disabled={!canPlay || progressionPlaying}
          aria-label="Previous chord"
        >
          <SkipBack size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <Tooltip content={t("controls.stopProgressionTooltip")}>
          <button
            type="button"
            className={styles.transportButton}
            onClick={() => stopProgressionPlayback()}
            disabled={stopDisabled}
            aria-label={t("controls.stopProgression")}
          >
            <Square size={13} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          </button>
        </Tooltip>
        <Tooltip
          content={
            progressionPlaying
              ? t("controls.pauseProgressionTooltip")
              : t("controls.playProgressionTooltip")
          }
        >
          <button
            type="button"
            className={clsx(styles.transportButton, styles.playButton, progressionPlaying && styles["transportButton--accent"])}
            onClick={() => setProgressionPlaying(!progressionPlaying)}
            disabled={!canPlay}
            aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
            aria-busy={progressionPlaybackLoading || undefined}
          >
            {progressionPlaybackLoading ? (
              <Loader2
                size={14}
                strokeWidth={2.4}
                aria-hidden="true"
                className={styles.spinner}
                data-testid="transport-play-spinner"
              />
            ) : progressionPlaying ? (
              <Pause size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
            ) : (
              <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
            )}
          </button>
        </Tooltip>
        <button
          type="button"
          className={styles.transportButton}
          onClick={() => advanceProgressionPlayback()}
          disabled={!canPlay || progressionPlaying}
          aria-label="Next chord"
        >
          <SkipForward size={13} strokeWidth={2.4} aria-hidden="true" />
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
