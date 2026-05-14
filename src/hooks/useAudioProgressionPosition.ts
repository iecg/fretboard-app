import { useEffect, useState } from "react";
import {
  getTimelinePosition,
  type TimelinePosition,
} from "../progressions/audio/timeline";

/** ~60 Hz polling interval. `setInterval` (not rAF) keeps the headless
 *  preview/visual-test renderers ticking; rAF is paused there. */
const TICK_MS = 16;

const EMPTY: TimelinePosition = { stepIndex: -1, fraction: 0, paused: false };

/**
 * Subscribe to the audio-clock-driven progression timeline. Returns the
 * current step + fractional progress through it; updates at ~60 Hz while
 * the component is mounted.
 *
 * Reading from `getTimelinePosition()` (which calls `AudioContext.currentTime`)
 * means this hook is anchored to the same clock as the scheduled drum,
 * bass, and chord events. They cannot drift apart over a bar, however long.
 */
export function useAudioProgressionPosition(): TimelinePosition {
  const [pos, setPos] = useState<TimelinePosition>(EMPTY);

  useEffect(() => {
    const tick = () => {
      const next = getTimelinePosition() ?? EMPTY;
      setPos((prev) => {
        if (
          prev.stepIndex === next.stepIndex
          && prev.paused === next.paused
          && Math.abs(prev.fraction - next.fraction) < 0.001
        ) {
          return prev;
        }
        return next;
      });
    };

    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return pos;
}
