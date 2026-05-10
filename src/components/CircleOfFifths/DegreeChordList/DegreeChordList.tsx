import { memo, useMemo } from "react";
import clsx from "clsx";
import {
  getDegreeSequence,
  formatAccidental,
  getDiatonicChord,
  getNoteDisplay,
  type DegreeId,
} from "@fretflow/core";
import styles from "./DegreeChordList.module.css";

export interface DegreeChordListProps {
  /** Tonic note in sharps-form (e.g., "C", "F", "C#"). */
  rootNote: string;
  /** Scale name (e.g., "Major", "Phrygian", "Natural Minor"). */
  scaleName: string;
  /** Force flat-display when true; sharp-display when false. Auto-detected from FLAT_KEYS when omitted. */
  useFlats?: boolean;
  /** Roman-numeral DegreeId of the active row (renders the active highlight). */
  activeDegreeId?: DegreeId | null;
  /** Click handler for row selection. Disabled rows do not invoke this. */
  onSelect?: (degreeId: DegreeId) => void;
  /** Optional outer class. */
  className?: string;
  /** Optional id forwarded to the root <ul> (enables aria-labelledby relationships). */
  id?: string;
  /** Optional outer aria-label override for the list landmark. */
  "aria-label"?: string;
  /** Optional test hook forwarded to the root <ul>. */
  "data-testid"?: string;
}

/**
 * Compact chord-quality labels for the third column.
 * Maps internal CHORD_DEFINITIONS keys (returned by getDiatonicChord)
 * to short human-readable labels suitable for a tabular row.
 */
const QUALITY_SHORT_LABELS: Record<string, string> = {
  "Major Triad": "Maj",
  "Minor Triad": "min",
  "Diminished Triad": "dim",
  "Augmented Triad": "aug",
  "Dominant 7th": "Dom7",
  "Major 7th": "Maj7",
  "Minor 7th": "min7",
  "Half-Diminished 7th": "m7♭5",
  "Diminished 7th": "dim7",
};

function shortQuality(quality: string): string {
  return QUALITY_SHORT_LABELS[quality] ?? quality;
}

interface DegreeRowData {
  degreeId: DegreeId;
  rootDisplay: string;
  qualityLabel: string;
  enabled: boolean;
}

function DegreeChordListImpl({
  rootNote,
  scaleName,
  useFlats,
  activeDegreeId,
  onSelect,
  className,
  id,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: DegreeChordListProps) {
  const rows = useMemo<DegreeRowData[]>(() => {
    const sequence = getDegreeSequence(scaleName);
    return sequence.map((degreeId) => {
      const chord = getDiatonicChord(degreeId, scaleName, rootNote);
      if (!chord) {
        return {
          degreeId,
          rootDisplay: "—",
          qualityLabel: "—",
          enabled: false,
        };
      }
      const rootDisplay = formatAccidental(
        getNoteDisplay(chord.root, rootNote, useFlats),
      );
      return {
        degreeId,
        rootDisplay,
        qualityLabel: shortQuality(chord.quality),
        enabled: true,
      };
    });
  }, [rootNote, scaleName, useFlats]);

  const label =
    ariaLabel ?? `Diatonic chords for ${rootNote} ${scaleName}`;

  return (
    <ul
      className={clsx(styles.list, className)}
      aria-label={label}
      id={id}
      data-testid={dataTestId}
    >
      {rows.map((row) => {
        const isActive = row.enabled && activeDegreeId === row.degreeId;
        const buttonAriaLabel = row.enabled
          ? `Select ${row.degreeId} chord — ${row.rootDisplay} ${row.qualityLabel}`
          : `${row.degreeId} chord unavailable for this scale`;
        return (
          <li key={row.degreeId} className={styles.item}>
            <button
              type="button"
              className={clsx(
                styles.row,
                isActive && styles["row-active"],
              )}
              aria-label={buttonAriaLabel}
              aria-pressed={row.enabled ? isActive : undefined}
              disabled={!row.enabled || !onSelect}
              onClick={
                row.enabled && onSelect
                  ? () => onSelect(row.degreeId)
                  : undefined
              }
            >
              <span className={styles.numeral}>{row.degreeId}</span>
              <span className={styles.root}>{row.rootDisplay}</span>
              <span className={styles.quality}>{row.qualityLabel}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const DegreeChordList = memo(DegreeChordListImpl);
DegreeChordList.displayName = "DegreeChordList";
