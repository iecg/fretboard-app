import clsx from "clsx";
import { useSmoothProgressionPosition } from "../../hooks/useSmoothProgressionPosition";
import {
  formatProgressionPlaybackPosition,
  type FormattedPlaybackPositionParts,
} from "../../progressions/progressionDomain";
import styles from "./ProgressionTrack.module.css";

interface ProgressionPositionReadoutProps {
  playing: boolean;
  stepStartBar: number;
  stepBars: number;
  stepDurationMs: number;
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
 * Renders the bar / beat / subdivision readout with smoothly interpolated
 * digits. Owns the 60Hz position state so that re-renders triggered by
 * sub-step motion stay localized to this small subtree — the parent
 * `ProgressionTrack` and its sibling components (transport, ruler, blocks)
 * are not re-rendered every tick.
 */
export function ProgressionPositionReadout({
  playing,
  stepStartBar,
  stepBars,
  stepDurationMs,
  stepIndex,
  totalProgressionBars,
  beatsPerBar,
}: ProgressionPositionReadoutProps) {
  const smoothBar = useSmoothProgressionPosition({
    playing,
    stepStartBar,
    stepBars,
    stepDurationMs,
    stepIndex,
  });

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
