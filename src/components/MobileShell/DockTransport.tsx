import { LoaderCircle, Play, Repeat, Square } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useTranslation } from "../../hooks/useTranslation";
import { InstrumentToggleCluster } from "../TransportBar/InstrumentToggleCluster";
import { TransportButton } from "../TransportBar/TransportButton";
import transportStyles from "../TransportBar/TransportBar.module.css";
import styles from "./DockTransport.module.css";

/**
 * Mini-player transport row for the mobile dock — always visible at the
 * bottom of the mobile shell.
 *
 * Play/stop behavior is sourced from `usePlaybackTransportModel` (the single
 * source of truth shared with TransportBar + HeaderTransportCluster), and the
 * buttons are the shared faceplate `TransportButton` — same treatment as the
 * desktop transport, so the style can never drift between surfaces.
 *
 * `data-placement="sheet"` is stale-but-load-bearing: it opts the row into
 * every existing `[data-placement="sheet"]` touch-target/compaction hook
 * (TransportBar, Switch, steppers, …) without churning a dozen CSS modules
 * for a rename.
 */
export function DockTransport() {
  const { t } = useTranslation();
  const {
    progressionPlaying,
    progressionPlaybackLoading,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    // Shared play/stop button model.
    playStopDisabled,
    playStopLabelKey,
    handlePlayStopClick,
  } = usePlaybackTransportModel();

  const progressionLabel = t("inspector.groupProgression").toLocaleLowerCase();
  const playStopLabel = `${t(playStopLabelKey)} ${progressionLabel}`;

  return (
    <div className={styles.row} data-testid="dock-transport" data-placement="sheet">
      <TransportButton
        size="touch"
        active={progressionPlaying}
        className={transportStyles.playButton}
        onClick={handlePlayStopClick}
        disabled={playStopDisabled}
        aria-label={playStopLabel}
        aria-busy={progressionPlaybackLoading || undefined}
        data-testid="dock-play"
      >
        {progressionPlaybackLoading && progressionPlaying ? (
          <LoaderCircle size={18} strokeWidth={2.4} aria-hidden="true" className={styles.spinIcon} />
        ) : progressionPlaying ? (
          <Square size={18} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
        ) : (
          <Play size={18} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
        )}
      </TransportButton>

      <InstrumentToggleCluster />

      {/* Loop toggle — pushed to the far right */}
      <TransportButton
        size="touch"
        active={progressionLoopEnabled}
        className={styles.loop}
        onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
        aria-pressed={progressionLoopEnabled}
        aria-label={t("controls.loopProgression")}
        data-testid="dock-loop"
      >
        <Repeat size={16} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
    </div>
  );
}
