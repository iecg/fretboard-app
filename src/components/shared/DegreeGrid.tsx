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

// Parent-major-relative Roman-numeral label for every chromatic offset from the
// tonic. Used for cells that are *not* in the active scale's diatonic set (any
// scale: Major, Natural Minor, Dorian, etc.) — the in-key cells go through
// `getDegreesForScale` instead, which honours mode-specific spelling. Lowercase
// is used universally as a quality-neutral label (the cell's quality is set
// independently by the user).
const BORROWED_NUMERAL_BY_OFFSET: Record<number, string> = {
  0: "i",
  1: "♭ii",
  2: "ii",
  3: "♭iii",
  4: "iii",
  5: "iv",
  6: "♯iv",
  7: "v",
  8: "♭vi",
  9: "vi",
  10: "♭vii",
  11: "vii",
};

export function DegreeGrid({
  scaleName,
  tonicNote,
  selectedNote,
  onSelectInKey,
  onSelectBorrowed,
  useFlats,
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
        : BORROWED_NUMERAL_BY_OFFSET[offset] ?? "";
      return {
        note,
        display: formatAccidental(getNoteDisplay(note, tonicNote, useFlats)),
        inKey,
        numeral,
      };
    });
  }, [scaleName, tonicNote, useFlats]);

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
