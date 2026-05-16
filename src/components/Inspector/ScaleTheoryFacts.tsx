import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { degreeChipsAtom } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ScaleTheoryFacts.module.css";

/**
 * Read-only theory readout for the Scale tab's middle column: the active
 * scale's notes, intervals, scale degrees, and tone count. Derives entirely
 * from `degreeChipsAtom` — no new atoms, no new theory logic.
 */
export function ScaleTheoryFacts() {
  const { t } = useTranslation();
  const chips = useAtomValue(degreeChipsAtom);

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
      <FactRow label={t("inspector.factTones")}>{chips.length}</FactRow>
    </dl>
  );
}

interface FactRowProps {
  label: string;
  children: ReactNode;
}

function FactRow({ label, children }: FactRowProps) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}
