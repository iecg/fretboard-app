import clsx from "clsx";
import { LoaderCircle, Play, Repeat, Square } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useScaleState } from "../../hooks/useScaleState";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./SheetPeekTransport.module.css";

/**
 * The headline of a scale label, stripping the parenthetical mode suffix.
 * e.g. "C Major (Ionian)" → "C Major"
 */
function scaleHeadline(label: string): string {
  return label.split(" (")[0].trim();
}

/**
 * Mini-player transport row for the mobile bottom sheet peek state.
 * Always visible at every snap point (peek / half / full).
 *
 * Mirrors TransportBar's play/pause/stop handler logic exactly — including
 * the blocked/loading/playing disabled conditions — while presenting a
 * compact single-row layout with scale and tempo readout chips.
 */
export function SheetPeekTransport() {
  const { t } = useTranslation();
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionPlaybackLoading,
    setProgressionPlaying,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionTempoBpm,
    stopProgressionPlayback,
  } = usePlaybackTransportModel();
  const { scaleLabel } = useScaleState();

  const canPlay = !progressionPlaybackBlockedReason;
  // Mirrors TransportBar: disabled when stopped + (blocked OR loading); never
  // disabled when playing (so the user can always stop).
  const playStopDisabled = !progressionPlaying && (!canPlay || progressionPlaybackLoading);
  const progressionLabel = t("inspector.groupProgression").toLocaleLowerCase();
  const playStopLabel = progressionPlaying
    ? `${t("controls.stopProgression")} ${progressionLabel}`
    : `${t("controls.playProgressionTooltip")} ${progressionLabel}`;

  const handlePlayStopClick = () => {
    if (progressionPlaying) {
      stopProgressionPlayback();
      return;
    }
    // Direct synchronous write — matches TransportBar's comment about
    // NOT wrapping in startTransition to avoid the ">10 fibers" warning.
    setProgressionPlaying(true);
  };

  const scale = scaleHeadline(scaleLabel);

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
