import { useEffect, useRef } from "react";
import { subscribeVisualClock } from "../../progressions/audio/visualClock";
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
 * shared audio-clock `timeline` at roughly 60 Hz via its own lightweight
 * requestAnimationFrame loop. Reads `AudioContext.currentTime` indirectly
 * through `getTimelinePosition()`, so the visual position is locked to
 * whatever the user is hearing.
 *
 * Style writes happen directly on the DOM ref to avoid React reconciliation
 * cost on every animation frame; the component renders only when its props
 * change.
 *
 * The fretboard SVG has its own lightweight rAF loop in
 * useFretboardPlaybackSnapshot that polls getTimelinePosition() and writes
 * to progressionVisualFrameAtom. This playhead loop reads the timeline
 * directly — no dependency on the atom — and therefore always updates the
 * playhead position before the browser paints.
 */
export function ProgressionPlayhead({
  playing,
  stepStartBar,
  totalDurationBars,
  totalBarsForDisplay,
}: ProgressionPlayheadProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    let parentWidth = parent.clientWidth;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        parentWidth = entry.contentRect.width;
      }
    });
    observer.observe(parent);

    const safeDisplayTotal = Math.max(1, totalBarsForDisplay);

    let anim: Animation | null = null;

    const setFallbackPosition = () => {
      if (anim) {
        anim.cancel();
        anim = null;
      }
      const pct = (stepStartBar - 1) / safeDisplayTotal;
      el.style.transform = `translateX(${pct * parentWidth}px)`;
    };

    if (!playing) {
      setFallbackPosition();
      return () => observer.disconnect();
    }

    setFallbackPosition();

    const unsubscribe = subscribeVisualClock((tl) => {
      if (tl.paused) {
        setFallbackPosition();
        return;
      }

      const totalDurationMs = tl.totalDurationSec * 1000;
      const expectedTimeMs = tl.globalFraction * totalDurationMs;
      const endPct = totalDurationBars / safeDisplayTotal;

      if (!anim) {
        anim = el.animate([
          { transform: 'translateX(0px)' },
          { transform: `translateX(${endPct * parentWidth}px)` }
        ], {
          duration: totalDurationMs,
          fill: 'forwards'
        });
      }

      const timing = anim.effect?.getTiming();
      if (timing && timing.duration !== totalDurationMs) {
        anim.effect?.updateTiming({ duration: totalDurationMs });
      }

      if (anim.playState !== 'running') {
        anim.play();
      }

      if (anim.currentTime !== null) {
        const drift = Math.abs((anim.currentTime as number) - expectedTimeMs);
        if (drift > 32) {
          anim.currentTime = expectedTimeMs;
        }
      }
    });

    return () => {
      observer.disconnect();
      unsubscribe();
      if (anim) {
        anim.cancel();
      }
    };
  }, [playing, stepStartBar, totalBarsForDisplay, totalDurationBars]);

  return (
    <span
      ref={ref}
      className={styles.playhead}
      data-testid="progression-playhead"
      data-animated={playing ? "true" : undefined}
      aria-hidden="true"
      style={{
        left: 0,
        willChange: "transform"
      }}
    >
      <span className={styles.playheadArrow} aria-hidden="true" />
      <span className={styles.playheadLine} aria-hidden="true" />
    </span>
  );
}
