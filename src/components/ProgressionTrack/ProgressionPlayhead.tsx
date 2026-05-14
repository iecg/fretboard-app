import { useEffect, useRef } from "react";
import { getTimelinePosition } from "../../progressions/audio/timeline";
import styles from "./ProgressionTrack.module.css";

interface ProgressionPlayheadProps {
  /** True if playback is currently running (and not blocked). */
  playing: boolean;
  /** Bar number (1-indexed) where the current step starts. */
  stepStartBar: number;
  /** Length of the current step expressed in bars (may be fractional). */
  stepBars: number;
  /** Active step index — used so that "snap to start" on a paused/blocked
   *  step references the correct bar. */
  stepIndex: number;
  /** Total length of the progression in bars. Used as the 0–100% denominator
   *  for the playhead's horizontal position. */
  totalDurationBars: number;
}

/** ~60 Hz position write interval. `setInterval` (not rAF) keeps the
 *  headless preview ticking; rAF is paused there. */
const TICK_MS = 16;

/**
 * Renders the playhead and drives its horizontal motion by sampling the
 * shared audio-clock `timeline` once per frame. Reads `AudioContext.currentTime`
 * indirectly via `getTimelinePosition()`, so the visual position is locked
 * to whatever the user is hearing — the metronome's audible click and the
 * arrow's pixel position cannot drift.
 *
 * Style writes happen directly on the DOM ref to avoid React reconciliation
 * cost on every animation frame; the component renders only when its props
 * change (e.g. a new step boundary or total duration).
 */
export function ProgressionPlayhead({
  playing,
  stepStartBar,
  stepBars,
  stepIndex,
  totalDurationBars,
}: ProgressionPlayheadProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "none";

    const safeTotal = Math.max(1, totalDurationBars);

    const write = () => {
      const tl = getTimelinePosition();
      let bar: number;
      if (
        playing
        && tl
        && tl.stepIndex === stepIndex
        && !tl.paused
        && stepBars > 0
      ) {
        bar = stepStartBar + tl.fraction * stepBars;
      } else {
        // Paused, blocked, or between scheduled segments — snap to the
        // start of the current step. This matches the user-expected
        // "pause resets to bar start" behaviour.
        bar = stepStartBar;
      }
      const pct = ((bar - 1) / safeTotal) * 100;
      const clamped = Math.max(0, Math.min(100, pct));
      el.style.left = `${clamped}%`;
    };

    write();
    // When paused / blocked the timeline reports a fixed position; one
    // write is enough. Skip the per-frame interval to save the CPU spent
    // re-computing the same percent each tick.
    if (!playing) return;
    const id = window.setInterval(write, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, stepStartBar, stepBars, stepIndex, totalDurationBars]);

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
