import { useEffect, useRef } from "react";
import type { ReactNode, Ref } from "react";
import clsx from "clsx";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical } from "lucide-react";
import {
  formatProgressionDurationLabel,
  type ResolvedProgressionStep,
} from "../../progressions/progressionDomain";
import { useTranslation } from "../../hooks/useTranslation";
import { singleMoveDiff } from "./progressionStepListUtils";
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
  /**
   * Enable pointer drag-to-reorder (motion `Reorder`). Defaults to true.
   *
   * Must be false inside the mobile/tablet bottom sheet: motion's `Reorder`
   * layout animations deadlock the sheet's `AnimatePresence` exit, leaving the
   * sheet stuck open after close. In that context the list renders as a plain
   * selectable list and reordering is done via the toolbar Move buttons (and the
   * global Alt+Arrow shortcut).
   */
  enableDrag?: boolean;
}

interface StepSelectButtonProps {
  step: ResolvedProgressionStep;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  /** Optional trailing content rendered inside the row (e.g. the drag handle). */
  trailing?: ReactNode;
}

/** The selectable row body, shared by the draggable and static list variants. */
function StepSelectButton({ step, index, active, onSelect, buttonRef, trailing }: StepSelectButtonProps) {
  const { t } = useTranslation();
  const name = step.resolvedChordLabel ?? t("controls.chordUnavailable");
  const duration = formatProgressionDurationLabel(step.duration);
  return (
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
      {trailing}
    </button>
  );
}

interface DraggableStepRowProps extends StepSelectButtonProps {
  onDragActive: (dragging: boolean) => void;
}

/**
 * One chord row inside the Reorder.Group. Drag is handle-only
 * (`dragListener={false}` + `useDragControls`) so a tap/click on the rest of the
 * row still selects the step — critical on touch. The grip handle sits *inside*
 * the row (a trailing `aria-hidden` span): `onPointerDown` starts the drag and a
 * click on the handle is stopped from bubbling so it never selects the step. The
 * keyboard reorder path lives in the global Alt+Arrow shortcut + toolbar buttons.
 */
function DraggableStepRow({ step, index, active, onSelect, buttonRef, onDragActive }: DraggableStepRowProps) {
  const controls = useDragControls();
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
      <StepSelectButton
        step={step}
        index={index}
        active={active}
        onSelect={onSelect}
        buttonRef={buttonRef}
        trailing={
          <span
            className={styles.handle}
            aria-hidden="true"
            onPointerDown={(event) => controls.start(event)}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical size={14} />
          </span>
        }
      />
    </Reorder.Item>
  );
}

/**
 * The master pane of the progression editor: a vertical, scrollable list of
 * chords rendered as a "quiet index". Each row is a flat select button with an
 * index, a Roman-numeral chip, the compact chord name, and its duration. When
 * `enableDrag` is set (desktop/tablet-inline) each row also gets a grab handle
 * for drag-to-reorder. The active row carries a cyan left-tick + tint. Top/bottom
 * fade hints appear only when the list overflows.
 */
export function ProgressionStepList({ steps, activeIndex, onSelect, onReorder, label, caption, meta, enableDrag = true }: ProgressionStepListProps) {
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
        {enableDrag ? (
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
              <DraggableStepRow
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
        ) : (
          <ul className={styles.list} aria-label={label} ref={listRef}>
            {steps.map((step, index) => (
              <li key={step.id} className={styles.item}>
                <StepSelectButton
                  step={step}
                  index={index}
                  active={index === activeIndex}
                  onSelect={onSelect}
                  buttonRef={index === activeIndex ? activeRef : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
