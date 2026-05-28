import { startTransition } from "react";
import type { Store } from "../../store/storeTypes";
import { displayedStepIndexPrimitiveAtom } from "../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../store/progressionVisualAtoms";
import { getTimelinePosition } from "./timeline";

let rafId: number | null = null;
let storeRef: Store | null = null;
let lastWritten = Number.NaN;

function frame(): void {
  const store = storeRef;
  if (!store) return;
  const tl = getTimelinePosition();
  if (tl) {
    startTransition(() => {
      store.set(progressionVisualFrameAtom, tl);
      if (!tl.paused && tl.stepIndex !== lastWritten) {
        lastWritten = tl.stepIndex;
        store.set(displayedStepIndexPrimitiveAtom, tl.stepIndex);
      }
    });
  } else {
    startTransition(() => {
      store.set(progressionVisualFrameAtom, null);
    });
  }
  rafId = window.requestAnimationFrame(frame);
}

export function startVisualClock(store: Store): void {
  storeRef = store;
  if (rafId !== null) return;          // idempotent
  lastWritten = Number.NaN;            // force first write to land
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
