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
import { PROGRESSION_STEP_LIST_ID } from "./progressionFocusIds";
import { singleMoveDiff } from "./progressionStepListUtils";
import styles from "./ProgressionStepList.module.css";

// Id of the inner list, used to give the focusable scroll container its
// accessible name via `aria-labelledby` without duplicating the literal
// `aria-label` (two elements with the same `aria-label` break strict-mode
// e2e selectors that target the list by name).
const STEP_LIST_LABEL_ID = "progression-step-list-label";

interface ProgressionStepListProps {
  steps: ResolvedProgressionStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Reorder a step from one index to another (pointer drag). */
  onReorder: (from: number, to: number) => void;
  /** Move the active step by one in the list (keyboard ←/→). Wired to the same
   * actions as the global chord-nav shortcut so behavior is identical. */
  onNavigate: (direction: -1 | 1) => void;
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
      tabIndex={active ? 0 : -1}
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
export function ProgressionStepList({ steps, activeIndex, onSelect, onReorder, onNavigate, label, caption, meta, enableDrag = true }: ProgressionStepListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    onNavigate(event.key === "ArrowLeft" ? -1 : 1);
    // Focus the active row after the navigation re-render commits. rAF runs after
    // React has flushed the atom-driven update, so activeRef points at the new
    // active row (or the same row if the index clamped at an end). Scheduling only
    // here means playback/click/drag never steal focus.
    requestAnimationFrame(() => activeRef.current?.focus({ preventScroll: true }));
  };

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

  // Mark the list when its content overflows so the CSS mask fade only shows
  // when there is actually something to scroll to.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => {
      if (el.scrollHeight > el.clientHeight) {
        el.setAttribute("data-overflows", "");
      } else {
        el.removeAttribute("data-overflows");
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [steps]);

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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div className={styles.scroll} id={PROGRESSION_STEP_LIST_ID} role="group" aria-labelledby={STEP_LIST_LABEL_ID} tabIndex={-1} onKeyDown={handleListKeyDown}>
        {enableDrag ? (
          <Reorder.Group
            as="ul"
            axis="y"
            values={ids}
            onReorder={handleReorder}
            className={styles.list}
            id={STEP_LIST_LABEL_ID}
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
          <ul className={styles.list} id={STEP_LIST_LABEL_ID} aria-label={label} ref={listRef}>
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
