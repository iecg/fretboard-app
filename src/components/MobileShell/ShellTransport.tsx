import { LoaderCircle, Play, Repeat, Square } from "lucide-react";
import { usePlaybackTransportModel } from "@fretflow/fretboard/hooks/usePlaybackTransportModel";
import { useTranslation } from "../../hooks/useTranslation";
import { InstrumentToggleCluster } from "../TransportBar/InstrumentToggleCluster";
import { TransportButton } from "../TransportBar/TransportButton";
import transportStyles from "../TransportBar/TransportBar.module.css";
import styles from "./ShellTransport.module.css";

/**
 * Always-visible transport strip of the mobile shell — rendered between the
 * header and the progression track, DAW-style, so playback stays reachable
 * even while a panel is open.
 *
 * Play/stop behavior is sourced from `usePlaybackTransportModel` (the single
 * source of truth shared with TransportBar + HeaderTransportCluster), and the
 * buttons are the shared faceplate `TransportButton` — same treatment as the
 * desktop transport, so the style can never drift between surfaces.
 *
 * `data-placement="sheet"` is stale-but-load-bearing: it opts the strip into
 * every existing `[data-placement="sheet"]` touch-target/compaction hook
 * (TransportBar, Switch, steppers, …) without churning a dozen CSS modules
 * for a rename.
 */
export function ShellTransport() {
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
    <div className={styles.row} data-testid="shell-transport" data-placement="sheet">
      <TransportButton
        size="touch"
        active={progressionPlaying}
        className={transportStyles.playButton}
        onClick={handlePlayStopClick}
        disabled={playStopDisabled}
        aria-label={playStopLabel}
        aria-busy={progressionPlaybackLoading || undefined}
        data-testid="shell-play"
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
        data-testid="shell-loop"
      >
        <Repeat size={16} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
    </div>
  );
}
