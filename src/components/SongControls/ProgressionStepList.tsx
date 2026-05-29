import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  formatProgressionDurationLabel,
  type ResolvedProgressionStep,
} from "../../progressions/progressionDomain";
import styles from "./ProgressionStepList.module.css";

interface ProgressionStepListProps {
  steps: ResolvedProgressionStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Accessible label for the list container. */
  label: string;
  /** Visible mono caption above the list (e.g. "Steps"). */
  caption: string;
  /** Right-aligned summary in the caption row (e.g. "9 chords · 10 bars"). */
  meta?: string;
}

/**
 * The master pane of the progression editor: a vertical, scrollable list of
 * chords rendered as a "quiet index" — each row a flat button with an index, a
 * Roman-numeral chip, the compact chord name, and its duration. The active row
 * carries a cyan left-tick + tint (no halo) so the editor stays the focal point.
 * Plain buttons in a list (not a roving-focus composite) so each row is a
 * standard tab stop — accessible without custom keyboard wiring. Top/bottom fade
 * hints appear only when the list overflows in that direction.
 */
export function ProgressionStepList({ steps, activeIndex, onSelect, label, caption, meta }: ProgressionStepListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [fade, setFade] = useState({ top: false, bot: false });

  const updateFades = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setFade({ top: el.scrollTop > 2, bot: max > 2 && el.scrollTop < max - 2 });
  }, []);

  useEffect(() => {
    updateFades();
  }, [steps, updateFades]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
    updateFades();
  }, [activeIndex, updateFades]);

  return (
    <div className={styles.col}>
      <div className={styles.caption}>
        <span className={styles.captionTitle}>{caption}</span>
        {meta ? <span className={styles.captionMeta}>{meta}</span> : null}
      </div>
      <div className={clsx(styles.scroll, { [styles.showTop]: fade.top, [styles.showBot]: fade.bot })}>
        <ul className={styles.list} aria-label={label} ref={listRef} onScroll={updateFades}>
          {steps.map((step, index) => {
            const active = index === activeIndex;
            const name = step.resolvedChordLabel ?? "Unavailable";
            const duration = formatProgressionDurationLabel(step.duration);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  ref={active ? activeRef : undefined}
                  className={clsx(styles.row, { [styles.active]: active })}
                  aria-current={active ? "true" : undefined}
                  data-unavailable={step.unavailable || undefined}
                  aria-label={`Chord ${index + 1}, ${step.degree}, ${name}, ${duration}${active ? ", selected" : ""}`}
                  onClick={() => onSelect(index)}
                >
                  <span className={styles.index} aria-hidden="true">{index + 1}</span>
                  <span className={styles.chip} aria-hidden="true">{step.degree}</span>
                  <span className={styles.name} aria-hidden="true">{name}</span>
                  <span className={styles.duration} aria-hidden="true">{duration}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
