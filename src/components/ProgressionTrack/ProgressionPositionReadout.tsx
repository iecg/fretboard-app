import clsx from "clsx";
import { useAudioProgressionPosition } from "../../hooks/useAudioProgressionPosition";
import {
  formatProgressionPlaybackPosition,
  type FormattedPlaybackPositionParts,
} from "../../progressions/progressionDomain";
import styles from "./ProgressionTrack.module.css";

interface ProgressionPositionReadoutProps {
  playing: boolean;
  stepStartBar: number;
  stepBars: number;
  stepIndex: number;
  totalProgressionBars: number;
  beatsPerBar: number;
}

function PositionDigits({
  parts,
  muted = false,
}: {
  parts: FormattedPlaybackPositionParts;
  muted?: boolean;
}) {
  return (
    <span className={clsx(styles.digits, muted && styles["digits--muted"])}>
      <span className={styles.digitBar}>{parts.bar}</span>
      <span className={styles.digitDot} aria-hidden="true">.</span>
      <span className={styles.digitBeat}>{parts.beat}</span>
      <span className={styles.digitDot} aria-hidden="true">.</span>
      <span className={styles.digitSub}>{parts.subdivision}</span>
    </span>
  );
}

/**
 * Renders the bar / beat / subdivision readout. The fractional bar position
 * is sampled from the shared audio-clock `timeline`, so the displayed
 * digits stay locked to the audio. On pause, the timeline reports
 * `fraction = 0`, which snaps the readout to the start of the current bar
 * — matching the playhead's "snap to bar start" pause behaviour.
 */
export function ProgressionPositionReadout({
  playing,
  stepStartBar,
  stepBars,
  stepIndex,
  totalProgressionBars,
  beatsPerBar,
}: ProgressionPositionReadoutProps) {
  const tl = useAudioProgressionPosition();
  const smoothBar =
    playing && tl.stepIndex === stepIndex && !tl.paused && stepBars > 0
      ? stepStartBar + tl.fraction * stepBars
      : stepStartBar;

  const position = formatProgressionPlaybackPosition(
    smoothBar,
    totalProgressionBars,
    beatsPerBar,
  );

  return (
    <div className={styles.positionReadout}>
      <span className={styles.readoutLabel}>Position</span>
      <span
        className={styles.positionValue}
        aria-label={`Position ${position.current} of ${position.total}`}
      >
        <span className={styles.positionCurrent}>
          <PositionDigits parts={position.parts.current} />
        </span>
        <span className={styles.positionSeparator} aria-hidden="true">/</span>
        <span className={styles.positionTotal}>
          <PositionDigits parts={position.parts.total} muted />
        </span>
      </span>
    </div>
  );
}
