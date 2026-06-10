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
 * Renders the playhead and drives its horizontal motion using the Web
 * Animations API (WAAPI). It subscribes to the audio clock via
 * subscribeVisualClock to ensure synchronization with playback.
 *
 * Style writes happen directly on the DOM ref to avoid React reconciliation
 * cost on every animation frame; the component renders only when its props
 * change.
 *
 * The fretboard SVG is driven by progressionVisualFrameAtom (via
 * useFretboardPlaybackSnapshot) to update chord highlighting. This playhead
 * is driven by WAAPI for perfectly smooth visual updates on the compositor
 * thread, while staying loosely coupled to the visual clock to correct drift.
 */
export function ProgressionPlayhead({
  playing,
  stepStartBar,
  totalDurationBars,
  totalBarsForDisplay,
}: ProgressionPlayheadProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  // 1. Fallback positioning when not playing
  useEffect(() => {
    if (playing) return;
    
    const el = ref.current;
    if (!el || !el.parentElement) return;
    
    const safeDisplayTotal = Math.max(1, totalBarsForDisplay);
    const parentWidth = el.parentElement.clientWidth;
    const pct = (stepStartBar - 1) / safeDisplayTotal;
    el.style.transform = `translateX(${pct * parentWidth}px)`;
  }, [playing, stepStartBar, totalBarsForDisplay]);

  // 2. WAAPI loop when playing
  useEffect(() => {
    if (!playing || totalDurationBars <= 0) return;

    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const safeDisplayTotal = Math.max(1, totalBarsForDisplay);
    let parentWidth = parent.clientWidth;
    let anim: Animation | null = null;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        parentWidth = entry.contentRect.width;
        if (anim) {
          const capturedTime = anim.currentTime;
          const duration = anim.effect?.getTiming()?.duration || 0;
          anim.cancel();
          const endPct = totalDurationBars / safeDisplayTotal;
          anim = el.animate([
            { transform: 'translateX(0px)' },
            { transform: `translateX(${endPct * parentWidth}px)` }
          ], {
            duration: duration as number,
            fill: 'forwards'
          });
          if (capturedTime !== null) {
            anim.currentTime = capturedTime;
          }
        }
      }
    });
    observer.observe(parent);

    const unsubscribe = subscribeVisualClock((tl) => {
      if (tl.paused) return;

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
        const current = anim.currentTime as number;
        const drift = Math.abs(current - expectedTimeMs);
        if (drift > 150) {
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
      if (el && typeof el.getAnimations === "function") {
        el.getAnimations().forEach((a) => a.cancel());
      }
    };
  }, [playing, totalBarsForDisplay, totalDurationBars]);

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
