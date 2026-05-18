import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import {
  degreeChipsAtom,
  rootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
} from "../../store/atoms";
import { DegreeChordList } from "../CircleOfFifths/DegreeChordList";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ScaleTheoryFacts.module.css";

/**
 * Read-only theory readout for the Scale tab's Theory column: the active
 * scale's notes, intervals, scale degrees, and its diatonic chords. The
 * note/interval/degree rows derive from `degreeChipsAtom`; the chord list is
 * the shared `DegreeChordList` rendered without a select handler.
 */
export function ScaleTheoryFacts() {
  const { t } = useTranslation();
  const chips = useAtomValue(degreeChipsAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);

  return (
    <dl className={styles.facts}>
      <FactRow label={t("inspector.factNotes")}>
        {chips.map((chip, index) => (
          <span
            key={chip.internalNote}
            className={chip.isTonic ? styles.tonic : undefined}
          >
            {chip.note}
            {index < chips.length - 1 ? " · " : ""}
          </span>
        ))}
      </FactRow>
      <FactRow label={t("inspector.factIntervals")}>
        {chips.map((chip) => chip.interval).join(" · ")}
      </FactRow>
      <FactRow label={t("inspector.factDegrees")}>
        {chips.map((chip) => chip.scaleDegree).join(" · ")}
      </FactRow>
      <FactRow label={t("inspector.factChords")} stacked>
        <DegreeChordList
          rootNote={rootNote}
          scaleName={scaleName}
          useFlats={useFlats}
          className={styles.chordList}
        />
      </FactRow>
    </dl>
  );
}

interface FactRowProps {
  label: string;
  children: ReactNode;
  /** When true, the value stacks below the label instead of sharing a baseline row. */
  stacked?: boolean;
}

function FactRow({ label, children, stacked }: FactRowProps) {
  return (
    <div className={stacked ? styles.rowStacked : styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}
