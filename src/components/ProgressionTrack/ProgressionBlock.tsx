import { memo, useMemo, type CSSProperties } from "react";
import { useAtomValue, type Atom } from "jotai";
import type { ProgressionStep } from "@fretflow/fretboard/progressions/progressionDomain";
import { formatProgressionDurationLabel, resolveProgressionStep } from "@fretflow/fretboard/progressions/progressionDomain";
import { scaleNameAtom, rootNoteAtom, preferFlatsAtom } from "@fretflow/fretboard/store/scaleAtoms";
import styles from "./ProgressionTrack.module.css";

interface ProgressionBlockProps {
  stepAtom: Atom<ProgressionStep>;
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
  stepAtom,
  index,
  active,
  durationBars,
  startPercent,
  widthPercent,
  onSelect,
}: ProgressionBlockProps) {
  const step = useAtomValue(stepAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const preferFlats = useAtomValue(preferFlatsAtom);

  const resolvedStep = useMemo(() => {
    return resolveProgressionStep(step, scaleName, rootNote, index, preferFlats);
  }, [step, scaleName, rootNote, index, preferFlats]);

  const duration = formatProgressionDurationLabel(resolvedStep.duration);
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
      data-unavailable={resolvedStep.unavailable ? "true" : undefined}
      onClick={() => onSelect(index)}
      aria-label={`Step ${index + 1}, ${resolvedStep.degree}, ${resolvedStep.resolvedChordLabel ?? "Unavailable"}, ${duration}${active ? ", active" : ""}`}
    >
      <span className={styles.degreeBadge}>{resolvedStep.degree}</span>
      <span className={styles.blockText}>
        <span
          className={styles.chordName}
          title={resolvedStep.resolvedChordLabel ?? resolvedStep.unavailableReason ?? undefined}
        >
          {resolvedStep.shortChordLabel ?? resolvedStep.unavailableReason}
        </span>
        <span className={styles.duration}>{duration}</span>
      </span>
    </button>
  );
}

export const ProgressionBlock = memo(ProgressionBlockComponent);
