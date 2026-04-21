import clsx from "clsx";
import type { ChordRowEntry, LegendItem } from "../theory";
import styles from "./ChordRowStrip.module.css";

interface ChordRowStripProps {
  chordLabel: string;
  chordRow: ChordRowEntry[];
  legendItems: LegendItem[];
  className?: string;
  compact?: boolean;
}

export function ChordRowStrip({
  chordLabel,
  chordRow,
  legendItems,
  className,
  compact,
}: ChordRowStripProps) {
  if (chordRow.length === 0 && legendItems.length === 0) return null;

  return (
    <section
      role="group"
      aria-label={`Chord overlay: ${chordLabel}`}
      className={clsx(styles["chord-row-strip"], compact && styles["chord-row-strip--compact"], className)}
    >
      <header className={styles["chord-row-strip-header"]}>{chordLabel}</header>

      {chordRow.length > 0 && (
        <ul className={styles["chord-row-list"]} aria-label="Chord members">
          {chordRow.map((entry, i) => (
            <li
              key={`${entry.internalNote}-${i}`}
              className={styles["chord-row-item"]}
              data-role={entry.role}
            >
              <span className={styles["chord-row-chip"]} aria-label={`${entry.displayNote}, ${entry.memberName}`}>
                <span className={styles["chord-row-note"]}>{entry.displayNote}</span>
              </span>
              <span className={styles["chord-row-interval"]}>{entry.memberName}</span>
            </li>
          ))}
        </ul>
      )}

      {!compact && legendItems.length > 0 && (
        <ul className={styles["chord-row-legend"]} aria-label="Legend">
          {legendItems.map((item) => {
            // key-tonic shares amber/orange visual treatment with chord-root in this strip context.
            const role = item.role === "key-tonic" ? "chord-root" : item.role;
            return (
              <li key={item.role} className={styles["chord-row-legend-item"]} data-role={role}>
                <span className={styles["chord-row-legend-swatch"]} aria-hidden="true" />
                <span className={styles["chord-row-legend-label"]}>{item.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
