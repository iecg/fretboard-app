import { useEffect, useRef } from "react";
import clsx from "clsx";
import {
  formatProgressionDurationLabel,
  type ResolvedProgressionStep,
} from "../../progressions/progressionDomain";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ProgressionStepList.module.css";

/**
 * Collapse a full reordered id array (as handed back by motion's Reorder.Group)
 * into the single `{ from, to }` move it represents. Returns null when the arrays
 * are identical or differ by more than one contiguous move.
 */
export function singleMoveDiff(prev: string[], next: string[]): { from: number; to: number } | null {
  if (prev.length !== next.length) return null;
  let lo = 0;
  while (lo < prev.length && prev[lo] === next[lo]) lo++;
  let hi = prev.length - 1;
  while (hi >= 0 && prev[hi] === next[hi]) hi--;
  if (lo > hi) return null;
  if (next[hi] === prev[lo]) return { from: lo, to: hi };
  if (next[lo] === prev[hi]) return { from: hi, to: lo };
  return null;
}

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
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active row visible *within the list's own scrollport* only. We
  // adjust `listRef.scrollTop` by hand instead of `scrollIntoView`, which would
  // also scroll every ancestor scroll container (incl. the page) and yank the
  // card header out of view on any activeIndex change — including changes that
  // originate from the remote ProgressionTrack navigator pip.
  useEffect(() => {
    const listEl = listRef.current;
    const rowEl = activeRef.current;
    if (!listEl || !rowEl) return;
    const lr = listEl.getBoundingClientRect();
    const rr = rowEl.getBoundingClientRect();
    if (rr.top < lr.top) listEl.scrollTop -= lr.top - rr.top;
    else if (rr.bottom > lr.bottom) listEl.scrollTop += rr.bottom - lr.bottom;
  }, [activeIndex]);

  return (
    <div className={styles.col}>
      <div className={styles.caption}>
        <span className={styles.captionTitle}>{caption}</span>
        {meta ? <span className={styles.captionMeta}>{meta}</span> : null}
      </div>
      <div className={styles.scroll}>
        <ul className={styles.list} aria-label={label} ref={listRef}>
          {steps.map((step, index) => {
            const active = index === activeIndex;
            const name = step.resolvedChordLabel ?? t("controls.chordUnavailable");
            const duration = formatProgressionDurationLabel(step.duration);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  ref={active ? activeRef : undefined}
                  className={clsx(styles.row, { [styles.active]: active })}
                  aria-current={active ? "true" : undefined}
                  data-unavailable={step.unavailable || undefined}
                  aria-label={`${t("controls.chordPositionLabel")} ${index + 1}, ${step.degree}, ${name}, ${duration}${active ? `, ${t("controls.chordSelected")}` : ""}`}
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
