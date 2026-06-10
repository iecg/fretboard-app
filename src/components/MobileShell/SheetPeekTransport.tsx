import { LoaderCircle, Play, Repeat, Square } from "lucide-react";
import { usePlaybackTransportModel } from "../../hooks/usePlaybackTransportModel";
import { useTranslation } from "../../hooks/useTranslation";
import { InstrumentToggleCluster } from "../TransportBar/InstrumentToggleCluster";
import { TransportButton } from "../TransportBar/TransportButton";
import transportStyles from "../TransportBar/TransportBar.module.css";
import styles from "./SheetPeekTransport.module.css";

/**
 * Mini-player transport row for the mobile bottom sheet peek state.
 * Always visible at every snap point (peek / half / full).
 *
 * Play/stop behavior is sourced from `usePlaybackTransportModel` (the single
 * source of truth shared with TransportBar + HeaderTransportCluster), and the
 * buttons are the shared faceplate `TransportButton` — same treatment as the
 * desktop transport, so the style can never drift between surfaces.
 *
 * `data-placement="sheet"` on the row opts the InstrumentToggleCluster into
 * the existing sheet touch-target guard in TransportBar.module.css (the vaul
 * portal escapes the shell's tier attribute, and tablet-split has no
 * mobile-tier guard).
 */
export function SheetPeekTransport() {
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
    <div className={styles.row} data-testid="peek-transport" data-placement="sheet">
      <TransportButton
        size="touch"
        active={progressionPlaying}
        className={transportStyles.playButton}
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
      </TransportButton>

      <InstrumentToggleCluster />

      {/* Loop toggle — pushed to the far right */}
      <TransportButton
        size="touch"
        active={progressionLoopEnabled}
        className={styles.loop}
        onClick={() => setProgressionLoopEnabled(!progressionLoopEnabled)}
        aria-pressed={progressionLoopEnabled}
        aria-label="Loop progression"
        data-testid="peek-loop"
      >
        <Repeat size={16} strokeWidth={2.4} aria-hidden="true" />
      </TransportButton>
    </div>
  );
}
