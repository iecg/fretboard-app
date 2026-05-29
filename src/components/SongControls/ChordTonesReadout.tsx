import { getChordNotes, getNoteDisplay, NOTES } from "@fretflow/core";
import styles from "./ChordTonesReadout.module.css";

interface ChordTonesReadoutProps {
  /** Chord root, sharps-form (e.g. "C", "F#"). */
  root: string;
  /** Tonal chord-type suffix (e.g. "M", "m", "maj7", "7"). */
  quality: string;
  /** Song root, used to choose sharp/flat spelling for display. */
  displayRoot: string;
  preferFlats: boolean;
  /** Caption + accessible label for the readout (e.g. "Notes"). */
  label: string;
}

/** Semitone-from-root → interval degree label. Covers the common chord tones;
 *  anything unmapped (rare altered extensions) renders no degree. */
const INTERVAL_DEGREE: Record<number, string> = {
  0: "R",
  1: "♭2",
  2: "2",
  3: "♭3",
  4: "3",
  5: "4",
  6: "♭5",
  7: "5",
  8: "♯5",
  9: "6",
  10: "♭7",
  11: "7",
};

/**
 * The chord-tones readout in the progression editor: the active chord's notes,
 * each tagged with its interval degree (R, 3, 5, ♭7…), root highlighted. A quiet
 * theory aid that fills the editor and confirms what the fretboard is showing.
 */
export function ChordTonesReadout({ root, quality, displayRoot, preferFlats, label }: ChordTonesReadoutProps) {
  const rootIndex = NOTES.indexOf(root);
  const tones = getChordNotes(root, quality).map((note) => {
    const offset = ((NOTES.indexOf(note) - rootIndex) % 12 + 12) % 12;
    return {
      note,
      display: getNoteDisplay(note, displayRoot, preferFlats),
      degree: INTERVAL_DEGREE[offset] ?? "",
      isRoot: offset === 0,
    };
  });

  if (tones.length === 0) return null;

  return (
    <div className={styles.readout} role="group" aria-label={label}>
      <span className={styles.caption} aria-hidden="true">{label}</span>
      <ul className={styles.tones}>
        {tones.map((tone, i) => (
          <li
            key={`${tone.note}-${i}`}
            className={tone.isRoot ? `${styles.tone} ${styles.root}` : styles.tone}
          >
            <span className={styles.note}>{tone.display}</span>
            <span className={styles.degree} aria-hidden="true">{tone.degree}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
