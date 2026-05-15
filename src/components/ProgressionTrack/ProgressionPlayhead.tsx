import { useEffect, useRef } from "react";
import { getTimelinePosition } from "../../progressions/audio/timeline";
import styles from "./ProgressionTrack.module.css";

interface ProgressionPlayheadProps {
  /** True if playback is currently running (and not blocked). */
  playing: boolean;
  /** Bar number (1-indexed) where the current step starts. */
  stepStartBar: number;
  /** Total length of the progression in bars. Used to scale globalFraction. */
  totalDurationBars: number;
  /** Total bars visible in the ruler. Used as the 0–100% denominator
   *  for horizontal pixel positioning. */
  totalBarsForDisplay: number;
}

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
  totalDurationBars,
  totalBarsForDisplay,
}: ProgressionPlayheadProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  // Store chord-boundary props in refs so the animation loop can access
  // the latest values without needing to be cleared and restarted
  // at every transition.
  const propsRef = useRef({ stepStartBar, totalDurationBars, totalBarsForDisplay });
  useEffect(() => {
    propsRef.current = { stepStartBar, totalDurationBars, totalBarsForDisplay };
  }, [stepStartBar, totalDurationBars, totalBarsForDisplay]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "none";

    let rafId: number | null = null;

    const write = () => {
      const tl = getTimelinePosition();
      const {
        stepStartBar: currentStepStartBar,
        totalDurationBars: currentTotalDurationBars,
        totalBarsForDisplay: currentTotalBarsForDisplay,
      } = propsRef.current;

      const safeDisplayTotal = Math.max(1, currentTotalBarsForDisplay);

      if (playing && tl && !tl.paused) {
        // Linear motion across the whole track, scaled to display bars.
        // Uses globalFraction which is perfectly continuous across audio steps.
        const pct = (tl.globalFraction * currentTotalDurationBars / safeDisplayTotal) * 100;
        el.style.left = `${Math.max(0, Math.min(100, pct))}%`;
        rafId = requestAnimationFrame(write);
      } else {
        // Paused or stopped: snap to current chord's start bar.
        const bar = currentStepStartBar;
        const pct = ((bar - 1) / safeDisplayTotal) * 100;
        el.style.left = `${Math.max(0, Math.min(100, pct))}%`;
        rafId = null;
      }
    };

    write();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [playing]);

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
