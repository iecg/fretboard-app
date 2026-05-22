import { useMemo } from "react";
import {
  NOTES,
  getDiatonicNotes,
  getDegreesForScale,
  getNoteDisplay,
  formatAccidental,
} from "@fretflow/core";
import clsx from "clsx";
import styles from "./DegreeGrid.module.css";

export interface DegreeGridProps {
  scaleName: string;
  tonicNote: string;
  selectedNote: string;
  onSelectInKey: (note: string, degree: string) => void;
  onSelectBorrowed: (note: string, degreeLabel: string) => void;
   
  useFlats: boolean;
}

interface CellInfo {
  note: string;
  display: string;
  inKey: boolean;
  numeral: string;
}

const BORROWED_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "♭ii",
  3: "♭iii",
  6: "♯iv",
  8: "♭vi",
  10: "♭vii",
};

export function DegreeGrid({
  scaleName,
  tonicNote,
  selectedNote,
  onSelectInKey,
  onSelectBorrowed,
}: DegreeGridProps) {
  const cells: CellInfo[] = useMemo(() => {
    const diatonic = getDiatonicNotes(scaleName, tonicNote);
    const degreesMap = getDegreesForScale(scaleName);
    const tonicIdx = NOTES.indexOf(tonicNote);

    return NOTES.map((note) => {
      const offset = (NOTES.indexOf(note) - tonicIdx + 12) % 12;
      const inKey = diatonic.has(note);
      const numeral = inKey
        ? degreesMap[offset] ?? ""
        : BORROWED_NUMERAL_BY_OFFSET[offset] ?? `${offset}`;
      return {
        note,
        display: formatAccidental(getNoteDisplay(note, tonicNote)),
        inKey,
        numeral,
      };
    });
  }, [scaleName, tonicNote]);

  return (
    <div className={styles.grid} role="group" aria-label="Chord root">
      {cells.map((cell) => (
        <button
          key={cell.note}
          type="button"
          className={clsx(
            styles.cell,
            cell.inKey ? styles.inKey : styles.borrowed,
            cell.note === selectedNote && styles.selected,
          )}
          data-in-key={cell.inKey ? "true" : "false"}
          aria-pressed={cell.note === selectedNote}
          aria-label={cell.inKey ? `${cell.display} ${cell.numeral}` : `${cell.numeral} ${cell.display}`}
          onClick={() =>
            cell.inKey
              ? onSelectInKey(cell.note, cell.numeral)
              : onSelectBorrowed(cell.note, cell.numeral)
          }
        >
          <span className={styles.note}>{cell.display}</span>
          <span className={styles.numeral} aria-hidden="true">
            {cell.numeral}
          </span>
        </button>
      ))}
    </div>
  );
}
