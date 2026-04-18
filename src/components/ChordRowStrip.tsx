import clsx from "clsx";
import type { ChordRowEntry, LegendItem } from "../theory";
import "./ChordRowStrip.css";

interface ChordRowStripProps {
  chordLabel: string;
  chordRow: ChordRowEntry[];
  legendItems: LegendItem[];
  className?: string;
}

export function ChordRowStrip({
  chordLabel,
  chordRow,
  legendItems,
  className,
}: ChordRowStripProps) {
  if (chordRow.length === 0 && legendItems.length === 0) return null;

  return (
    <section
      role="group"
      aria-label={`Chord overlay: ${chordLabel}`}
      className={clsx("chord-row-strip", className)}
    >
      <header className="chord-row-strip-header">{chordLabel}</header>

      {chordRow.length > 0 && (
        <ul className="chord-row-list" aria-label="Chord members">
          {chordRow.map((entry, i) => (
            <li
              key={`${entry.internalNote}-${i}`}
              className="chord-row-item"
              data-role={entry.role}
            >
              <span className="chord-row-chip" aria-label={`${entry.displayNote}, ${entry.memberName}`}>
                <span className="chord-row-note">{entry.displayNote}</span>
              </span>
              <span className="chord-row-interval">{entry.memberName}</span>
            </li>
          ))}
        </ul>
      )}

      {legendItems.length > 0 && (
        <ul className="chord-row-legend" aria-label="Legend">
          {legendItems.map((item) => {
            // key-tonic shares amber/orange visual treatment with chord-root in this strip context.
            const role = item.role === "key-tonic" ? "chord-root" : item.role;
            return (
              <li key={item.role} className="chord-row-legend-item" data-role={role}>
                <span className="chord-row-legend-swatch" aria-hidden="true" />
                <span className="chord-row-legend-label">{item.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
