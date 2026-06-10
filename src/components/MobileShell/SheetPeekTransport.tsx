import clsx from "clsx";
import { useAtomValue } from "jotai";
import { LoaderCircle, Play, Repeat, Square } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useTranslation } from "../../hooks/useTranslation";
import { scaleHeadlineAtom } from "../../store/scaleAtoms";
import styles from "./SheetPeekTransport.module.css";

/**
 * Mini-player transport row for the mobile bottom sheet peek state.
 * Always visible at every snap point (peek / half / full).
 *
 * Play/stop behavior is sourced from `usePlaybackTransportModel` (the single
 * source of truth shared with TransportBar + HeaderTransportCluster), so the
 * disabled/loading/playing semantics can never drift between surfaces.
 */
export function SheetPeekTransport() {
  const { t } = useTranslation();
  const {
    progressionPlaying,
    progressionPlaybackLoading,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionTempoBpm,
    // Shared play/stop button model.
    playStopDisabled,
    playStopLabelKey,
    handlePlayStopClick,
  } = usePlaybackTransportModel();
  // Subscribe to exactly the headline selector — avoids re-renders from the
  // ~11 atoms useScaleState() would pull in.
  const scale = useAtomValue(scaleHeadlineAtom);

  const progressionLabel = t("inspector.groupProgression").toLocaleLowerCase();
  const playStopLabel = `${t(playStopLabelKey)} ${progressionLabel}`;

  return (
    <div className={styles.row} data-testid="peek-transport">
      {/* Play / Stop button — round, 44px, accent fill */}
      <button
        type="button"
        className={clsx(styles.play, progressionPlaying && styles["play--playing"])}
        onClick={handlePlayStopClick}
        disabled={playStopDisabled}
        aria-label={playStopLabel}
        aria-busy={progressionPlaybackLoading || undefined}
        data-testid="peek-play"
      >
        {progressionPlaybackLoading && progressionPlaying ? (
          <LoaderCircle size={18} strokeWidth={2.4} aria-hidden="true" className={styles.spinIcon} />
        ) : progressionPlaying ? (
          <Square size={18} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
        ) : (
          <Play size={18} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
        )}
      </button>

      {/* Scale chip */}
      <div className={styles.chip} data-testid="peek-scale" aria-label={`Scale: ${scale}`}>
        <span className={styles.chipLabel}>{scale}</span>
      </div>

      {/* Tempo chip */}
      <div className={styles.chip} data-testid="peek-tempo" aria-label={`Tempo: ${progressionTempoBpm} BPM`}>
        <span className={styles.chipLabel}>{progressionTempoBpm}</span>
        <span className={styles.unit}>BPM</span>
      </div>

      {/* Loop toggle chip — pushed to the right */}
      <button
        type="button"
        className={clsx(styles.chip, styles.toggle)}
        onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
        aria-pressed={progressionLoopEnabled}
        aria-label="Loop progression"
        data-testid="peek-loop"
      >
        <Repeat size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}
