import { useMemo, useRef, useState, type KeyboardEvent } from "react";
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
//
// Diatonic-position labels (no accidental) are the same in either spelling.
const NATURAL_NUMERAL_BY_OFFSET: Record<number, string> = {
  0: "i",
  2: "ii",
  4: "iii",
  5: "iv",
  7: "v",
  9: "vi",
  11: "vii",
};
// Chromatic-offset labels — accidental follows the active enharmonic preference,
// matching the chord-root spelling (Roman-numeral convention: numeral accidental
// ≡ root accidental). This keeps the numeral coherent with the note name shown
// above it, instead of mixing flats (♭ii, ♭iii, ♭vi, ♭vii) with a stray ♯iv.
const FLAT_BORROWED_BY_OFFSET: Record<number, string> = {
  1: "♭ii",
  3: "♭iii",
  6: "♭v",
  8: "♭vi",
  10: "♭vii",
};
const SHARP_BORROWED_BY_OFFSET: Record<number, string> = {
  1: "♯i",
  3: "♯ii",
  6: "♯iv",
  8: "♯v",
  10: "♯vi",
};

function getBorrowedNumeral(offset: number, useFlats: boolean): string {
  if (offset in NATURAL_NUMERAL_BY_OFFSET) return NATURAL_NUMERAL_BY_OFFSET[offset];
  const chromatic = useFlats ? FLAT_BORROWED_BY_OFFSET : SHARP_BORROWED_BY_OFFSET;
  return chromatic[offset] ?? "";
}

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
        : getBorrowedNumeral(offset, useFlats);
      return {
        note,
        display: formatAccidental(getNoteDisplay(note, tonicNote, useFlats)),
        inKey,
        numeral,
      };
    });
  }, [scaleName, tonicNote, useFlats]);

  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = cells.findIndex((c) => c.note === selectedNote);
  const [focusIndex, setFocusIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : 0,
  );

  const moveFocus = (next: number) => {
    const wrapped = ((next % cells.length) + cells.length) % cells.length;
    setFocusIndex(wrapped);
    buttonRefs.current[wrapped]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        moveFocus(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(index - 1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(cells.length - 1);
        break;
    }
  };

  return (
    <div className={styles.grid} role="group" aria-label="Chord root">
      {cells.map((cell, index) => (
        <button
          key={cell.note}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          className={clsx(
            styles.cell,
            cell.inKey ? styles.inKey : styles.borrowed,
            cell.note === selectedNote && styles.selected,
          )}
          data-in-key={cell.inKey ? "true" : "false"}
          aria-pressed={cell.note === selectedNote}
          aria-label={cell.inKey ? `${cell.display} ${cell.numeral}` : `${cell.numeral} ${cell.display}`}
          tabIndex={index === focusIndex ? 0 : -1}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onFocus={() => setFocusIndex(index)}
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
