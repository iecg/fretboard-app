import { useEffect, useRef, useState } from "react";

interface SmoothPositionInput {
  /** True if playback is running (and not blocked). */
  playing: boolean;
  /** Bar number (1-indexed) where the current step starts. */
  stepStartBar: number;
  /** Length of the current step expressed in bars (may be fractional). */
  stepBars: number;
  /** Length of the current step in milliseconds. */
  stepDurationMs: number;
  /** Active step index — restart the interpolation when this changes. */
  stepIndex: number;
}

/** ~60Hz update interval. setInterval is used rather than rAF because rAF is
 * aggressively throttled (often paused) in the headless renderer used by the
 * preview pane and visual tests; a 16ms interval keeps motion alive there. */
const TICK_MS = 16;

/**
 * Interpolates `currentProgressionBar` between step boundaries so the playhead
 * and position readout slide smoothly during playback.
 *
 * `currentProgressionBarAtom` only updates when the active step index
 * advances, which makes the playhead jump from bar to bar. This hook reports
 * a fractional bar position interpolated between `stepStartBar` and
 * `stepStartBar + stepBars` based on elapsed wall-clock time, advancing at
 * ~60Hz while `playing` is true.
 *
 * Returns `stepStartBar` when paused, blocked, or between steps.
 */
export function useSmoothProgressionPosition({
  playing,
  stepStartBar,
  stepBars,
  stepDurationMs,
  stepIndex,
}: SmoothPositionInput): number {
  const startTimeRef = useRef<number>(0);
  const [snapshot, setSnapshot] = useState<{ stepIndex: number; position: number }>(
    () => ({ stepIndex, position: stepStartBar }),
  );

  // State-during-render reset: when the step boundary advances we re-anchor
  // the snapshot synchronously. This is the canonical React pattern for
  // "reset state when a prop changes" and avoids the `setState-in-effect`
  // lint rule.
  if (snapshot.stepIndex !== stepIndex) {
    setSnapshot({ stepIndex, position: stepStartBar });
  }

  useEffect(() => {
    if (!playing || stepDurationMs <= 0 || stepBars <= 0) return;

    // Anchor the wall-clock start for this step. Writing to refs inside an
    // effect is fine — only setState calls in the synchronous effect body
    // are restricted.
    startTimeRef.current = performance.now();

    const timerId = window.setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / stepDurationMs);
      const next = stepStartBar + progress * stepBars;
      setSnapshot((prev) =>
        prev.stepIndex === stepIndex && prev.position !== next
          ? { stepIndex, position: next }
          : prev,
      );
      if (progress >= 1) window.clearInterval(timerId);
    }, TICK_MS);

    return () => window.clearInterval(timerId);
  }, [playing, stepStartBar, stepBars, stepDurationMs, stepIndex]);

  return snapshot.position;
}
