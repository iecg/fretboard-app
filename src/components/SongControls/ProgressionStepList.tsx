import { useEffect, useRef } from "react";
import type { Ref } from "react";
import clsx from "clsx";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical } from "lucide-react";
import {
  formatProgressionDurationLabel,
  type ResolvedProgressionStep,
} from "../../progressions/progressionDomain";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ProgressionStepList.module.css";

interface ProgressionStepListProps {
  steps: ResolvedProgressionStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Reorder a step from one index to another (pointer drag). */
  onReorder: (from: number, to: number) => void;
  /** Accessible label for the list container. */
  label: string;
  /** Visible mono caption above the list (e.g. "Steps"). */
  caption: string;
  /** Right-aligned summary in the caption row (e.g. "9 chords · 10 bars"). */
  meta?: string;
}

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

interface StepRowProps {
  step: ResolvedProgressionStep;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  onDragActive: (dragging: boolean) => void;
}

/**
 * One chord row inside the Reorder.Group. Drag is handle-only
 * (`dragListener={false}` + `useDragControls`) so a tap/click on the row button
 * still selects the step — critical on touch. The grip handle is a sibling span
 * (not nested in the button) and `aria-hidden`: the keyboard reorder path lives
 * in the global Alt+Arrow shortcut and the toolbar Move buttons.
 */
function StepRow({ step, index, active, onSelect, buttonRef, onDragActive }: StepRowProps) {
  const { t } = useTranslation();
  const controls = useDragControls();
  const name = step.resolvedChordLabel ?? t("controls.chordUnavailable");
  const duration = formatProgressionDurationLabel(step.duration);
  return (
    <Reorder.Item
      value={step.id}
      as="li"
      className={styles.item}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => onDragActive(true)}
      onDragEnd={() => onDragActive(false)}
      whileDrag={{ scale: 1.015 }}
    >
      <button
        type="button"
        ref={buttonRef}
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
      <span
        className={styles.handle}
        aria-hidden="true"
        onPointerDown={(event) => controls.start(event)}
      >
        <GripVertical size={14} />
      </span>
    </Reorder.Item>
  );
}

/**
 * The master pane of the progression editor: a vertical, scrollable list of
 * chords rendered as a "quiet index". Each row is a flat select button with an
 * index, a Roman-numeral chip, the compact chord name, and its duration, plus a
 * grab handle for drag-to-reorder. The active row carries a cyan left-tick +
 * tint. Top/bottom fade hints appear only when the list overflows.
 */
export function ProgressionStepList({ steps, activeIndex, onSelect, onReorder, label, caption, meta }: ProgressionStepListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);

  // Keep the active row visible *within the list's own scrollport* only. Skip
  // while a drag is in flight — the reorder action retargets the active index on
  // every tick, and auto-scrolling mid-drag would fight the pointer.
  useEffect(() => {
    if (draggingRef.current) return;
    const listEl = listRef.current;
    const rowEl = activeRef.current;
    if (!listEl || !rowEl) return;
    const lr = listEl.getBoundingClientRect();
    const rr = rowEl.getBoundingClientRect();
    if (rr.top < lr.top) listEl.scrollTop -= lr.top - rr.top;
    else if (rr.bottom > lr.bottom) listEl.scrollTop += rr.bottom - lr.bottom;
  }, [activeIndex]);

  const ids = steps.map((step) => step.id);
  const handleReorder = (nextIds: string[]) => {
    const move = singleMoveDiff(ids, nextIds);
    if (move) onReorder(move.from, move.to);
  };

  return (
    <div className={styles.col}>
      <div className={styles.caption}>
        <span className={styles.captionTitle}>{caption}</span>
        {meta ? <span className={styles.captionMeta}>{meta}</span> : null}
      </div>
      <div className={styles.scroll}>
        <Reorder.Group
          as="ul"
          axis="y"
          values={ids}
          onReorder={handleReorder}
          className={styles.list}
          aria-label={label}
          ref={listRef}
        >
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              active={index === activeIndex}
              onSelect={onSelect}
              buttonRef={index === activeIndex ? activeRef : undefined}
              onDragActive={(dragging) => {
                draggingRef.current = dragging;
              }}
            />
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}
