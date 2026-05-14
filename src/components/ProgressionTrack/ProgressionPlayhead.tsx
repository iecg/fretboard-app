import { useLayoutEffect, useRef } from "react";
import styles from "./ProgressionTrack.module.css";

interface ProgressionPlayheadProps {
  /** True if playback is currently running (and not blocked). */
  playing: boolean;
  /** Bar number (1-indexed) where the current step starts. */
  stepStartBar: number;
  /** Length of the current step expressed in bars (may be fractional). */
  stepBars: number;
  /** Length of the current step in milliseconds. */
  stepDurationMs: number;
  /** Active step index — used to re-arm the animation when the step
   *  boundary advances. */
  stepIndex: number;
  /** Total length of the progression in bars. Used as the 0–100% denominator
   *  for the playhead's horizontal position. */
  totalDurationBars: number;
}

/**
 * Renders the progression playhead and drives its horizontal motion through
 * a CSS `transition: left` rather than per-frame React state. The cost of
 * animating the playhead is thus a single style write per step boundary —
 * the browser handles every in-between frame on the compositor with no
 * additional JS work or React reconciliation.
 *
 * The arrow + line markup stays the same as the original implementation so
 * the component is a drop-in replacement.
 */
export function ProgressionPlayhead({
  playing,
  stepStartBar,
  stepBars,
  stepDurationMs,
  stepIndex,
  totalDurationBars,
}: ProgressionPlayheadProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  // useLayoutEffect runs synchronously before paint, so the transition can be
  // re-armed without ever flashing the old end position.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const safeTotal = Math.max(1, totalDurationBars);
    const startPct = ((stepStartBar - 1) / safeTotal) * 100;
    const endPct = ((stepStartBar - 1 + stepBars) / safeTotal) * 100;
    const clampedStart = Math.max(0, Math.min(100, startPct));
    const clampedEnd = Math.max(0, Math.min(100, endPct));

    if (!playing || stepDurationMs <= 0 || stepBars <= 0) {
      // Paused / blocked: snap to step start, no animation.
      el.style.transition = "none";
      el.style.left = `${clampedStart}%`;
      return;
    }

    // Playing: jump instantly to step start, then sweep to step end over
    // the step's wall-clock duration. The two-phase write is necessary so
    // the transition starts from the correct origin even when the previous
    // animation ended elsewhere (e.g. after a loop wrap).
    el.style.transition = "none";
    el.style.left = `${clampedStart}%`;
    // Force a reflow so the browser commits the jump before we arm the
    // transition; without it the two style writes would coalesce.
    void el.offsetWidth;
    el.style.transition = `left ${stepDurationMs}ms linear`;
    el.style.left = `${clampedEnd}%`;
  }, [playing, stepStartBar, stepBars, stepDurationMs, stepIndex, totalDurationBars]);

  return (
    <span
      ref={ref}
      className={styles.playhead}
      data-testid="progression-playhead"
      data-animated={playing ? "true" : undefined}
      aria-hidden="true"
    >
      <span className={styles.playheadArrow} aria-hidden="true" />
      <span className={styles.playheadLine} aria-hidden="true" />
    </span>
  );
}
