import type { CSSProperties } from "react";
import { clsx } from "clsx";
import styles from "./ProgressionTrack.module.css";

interface ProgressionRulerProps {
  totalBarsForDisplay: number;
  subdivisionsPerBar: number;
}

/**
 * Renders the bar-and-beat tick layer of the progression timeline.
 * Pure on its props; React Compiler memoizes the subtree so playback
 * frame updates in the parent skip ruler reconciliation.
 */
export function ProgressionRuler({
  totalBarsForDisplay,
  subdivisionsPerBar,
}: ProgressionRulerProps) {
  return (
    <div className={styles.ruler} aria-hidden="true">
      {Array.from({ length: totalBarsForDisplay }, (_, i) => (
        <span key={i} className={styles.rulerBar}>
          {i > 0 ? <span className={styles.rulerBarTick} /> : null}
          <span className={styles.rulerBarNumber}>{i + 1}</span>
          {Array.from({ length: 2 * subdivisionsPerBar - 1 }, (__, j) => {
            const offset = (j + 1) / (2 * subdivisionsPerBar);
            const isBeat = (j + 1) % 2 === 0;
            return (
              <span
                key={j}
                className={clsx(styles.rulerTick, isBeat && styles["rulerTick--beat"])}
                style={{ left: `${offset * 100}%` } as CSSProperties}
              />
            );
          })}
        </span>
      ))}
    </div>
  );
}
