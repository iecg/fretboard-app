import { memo, type CSSProperties } from "react";
import type { ResolvedProgressionStep } from "../../progressions/progressionDomain";
import { formatProgressionDurationLabel } from "../../progressions/progressionDomain";
import styles from "./ProgressionTrack.module.css";

interface ProgressionBlockProps {
  step: ResolvedProgressionStep;
  index: number;
  active: boolean;
  durationBars: number;
  startPercent: number;
  widthPercent: number;
  onSelect: (index: number) => void;
}

/**
 * A single chord block in the progression timeline. Memoized so it only
 * re-renders when its own props change — this keeps the per-tick render
 * cost of the surrounding track from cascading through the block list.
 *
 * In practice each block re-renders at most when:
 *  - The active step index moves into or out of this block (`active` flip).
 *  - The user edits the progression (new step data).
 * Sub-step playhead motion no longer touches this subtree.
 */
function ProgressionBlockComponent({
  step,
  index,
  active,
  durationBars,
  startPercent,
  widthPercent,
  onSelect,
}: ProgressionBlockProps) {
  const duration = formatProgressionDurationLabel(step.duration);
  return (
    <button
      type="button"
      className={styles.block}
      style={{
        "--duration-bars": String(durationBars),
        left: `${startPercent}%`,
        width: `calc(${widthPercent}% - 3px)`,
      } as CSSProperties}
      data-active={active ? "true" : undefined}
      data-unavailable={step.unavailable ? "true" : undefined}
      onClick={() => onSelect(index)}
      aria-label={`Step ${index + 1}, ${step.degree}, ${step.resolvedChordLabel ?? "Unavailable"}, ${duration}${active ? ", active" : ""}`}
    >
      <span className={styles.degreeBadge}>{step.degree}</span>
      <span className={styles.blockText}>
        <span
          className={styles.chordName}
          title={step.resolvedChordLabel ?? step.unavailableReason ?? undefined}
        >
          {step.shortChordLabel ?? step.unavailableReason}
        </span>
        <span className={styles.duration}>{duration}</span>
      </span>
    </button>
  );
}

export const ProgressionBlock = memo(ProgressionBlockComponent);
