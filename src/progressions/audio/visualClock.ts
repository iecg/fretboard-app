import { startTransition } from "react";
import type { Store } from "../../store/storeTypes";
import { displayedStepIndexPrimitiveAtom, fastDisplayedStepIndexPrimitiveAtom } from "../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../store/progressionVisualAtoms";
import { getTimelinePosition } from "./timeline";

type TimelinePosition = NonNullable<ReturnType<typeof getTimelinePosition>>;
export type FrameCallback = (tl: TimelinePosition) => void;

let rafId: number | null = null;
let storeRef: Store | null = null;
let lastWritten = Number.NaN;
const callbacks = new Set<FrameCallback>();

export function subscribeVisualClock(cb: FrameCallback): () => void {
  callbacks.add(cb);
  return () => {
    callbacks.delete(cb);
  };
}

// PERF NOTE (2026-06-01): this rAF loop is cheap — profiling measured ~117ms of
// requestAnimationFrame across a ~24.7s capture (~0.08ms/frame), with no per-frame
// React subscribers to progressionVisualFrameAtom (only the derived
// anticipationActiveAtom, which flips at thresholds, and ProgressionPlayhead's
// compositor-thread WAAPI callback — neither re-renders per frame). The playback
// jank/violations were the FretboardNoteLayer re-render, not this loop (see
// docs/superpowers/plans/2026-06-01-playback-render-perf.md). Do not throttle
// without fresh evidence.
function frame(): void {
  rafId = window.requestAnimationFrame(frame);
  const store = storeRef;
  if (!store) return;
  const tl = getTimelinePosition();
  
  if (tl) {
    store.set(progressionVisualFrameAtom, tl);
    if (!tl.paused && tl.stepIndex !== lastWritten) {
      lastWritten = tl.stepIndex;
      store.set(fastDisplayedStepIndexPrimitiveAtom, tl.stepIndex);
      startTransition(() => {
        store.set(displayedStepIndexPrimitiveAtom, tl.stepIndex);
      });
    }
    callbacks.forEach(cb => {
      try {
        cb(tl);
      } catch (err) {
        console.error("Error in visualClock subscriber:", err);
      }
    });
  } else {
    store.set(progressionVisualFrameAtom, null);
    if (lastWritten !== -1) {
      lastWritten = -1;
      store.set(fastDisplayedStepIndexPrimitiveAtom, 0);
      startTransition(() => {
        store.set(displayedStepIndexPrimitiveAtom, 0);
      });
    }
  }
}

export function startVisualClock(store: Store): void {
  storeRef = store;
  if (rafId !== null) return;
  lastWritten = Number.NaN;
  rafId = window.requestAnimationFrame(frame);
}

export function stopVisualClock(): void {
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  storeRef?.set(progressionVisualFrameAtom, null);
  storeRef = null;
  lastWritten = Number.NaN;
}
