/**
 * Singleton RAF driver that mirrors the audio-clock step index into a Jotai
 * atom every animation frame. Decouples chord-visual highlighting from
 * `Tone.Draw.schedule`, which trails the audio clock by 50-100ms under main-
 * thread load and caused a visible 1-2 frame stutter at every chord
 * transition.
 *
 * Lifecycle is owned by `useProgressionAudioPlayback.ts`:
 *  - On playback start: `startVisualClock(store)` (after the Jotai store
 *    handle is in scope).
 *  - On playback stop / hook cleanup: `stopVisualClock()`.
 *
 * The driver is a no-op outside playback (idempotent start, safe stop). It
 * does NOT write while `getTimelinePosition()` returns null (pre-first-event)
 * or `paused` (the displayed atom falls back to logical when not playing
 * anyway, so writes during pause would be redundant).
 */
import type { Store } from "../../store/storeTypes";
import { displayedStepIndexPrimitiveAtom } from "../../store/progressionAtoms";
import { getTimelinePosition } from "./timeline";

let rafId: number | null = null;
let storeRef: Store | null = null;
let lastWritten = Number.NaN;

function frame(): void {
  const store = storeRef;
  if (!store) return;
  const tl = getTimelinePosition();
  if (tl && !tl.paused) {
    if (tl.stepIndex !== lastWritten) {
      lastWritten = tl.stepIndex;
      store.set(displayedStepIndexPrimitiveAtom, tl.stepIndex);
    }
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
  storeRef = null;
  lastWritten = Number.NaN;
}
