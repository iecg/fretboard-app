import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { getTransport } from "tone";
import { ensureProgressionAudio } from "../progressions/audio/bus";
import { getTimeUntilCurrentStepEndMs, getTimelinePosition } from "../progressions/audio/timeline";
import { isMutedAtom } from "../store/audioAtoms";
import { useProgressionState } from "./useProgressionState";

/**
 * Advance the active progression step when the audio clock crosses the
 * end of the currently-scheduled segment. Replaces the prior
 * `setTimeout(stepDurationMs)` driver — anchoring step advancement to the
 * exact audio-clock boundary keeps React's notion of "current chord" in
 * lockstep with the audio instead of landing on the next poll tick.
 *
 * Falls back to a JS-timer-based advance when Web Audio is unavailable
 * (jsdom, SSR, locked autoplay policy). The fallback path preserves the
 * pre-refactor behaviour so unit tests that mount the progression without
 * a real `AudioContext` still observe step transitions.
 */
export function useProgressionPlaybackLoop() {
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionStepDurationMs,
    activeProgressionStepIndex,
    advanceProgressionPlayback,
  } = useProgressionState();
  // While muted, `useProgressionAudioPlayback` clears the timeline; without
  // this guard the loop would spin re-arming against a null timeline.
  const isMuted = useAtomValue(isMutedAtom);

  useEffect(() => {
    if (
      !progressionPlaying
      || progressionPlaybackBlockedReason
      || isMuted
    ) {
      return;
    }

    // Prefer the audio-clock-driven advance whenever the AudioContext is
    // ready, since it tracks what the user actually hears. We schedule
    // against `Tone.Transport` (bound to the shared progression context in
    // `toneBus.ts`), which fires callbacks on the audio clock with no
    // JS-timer jitter.
    if (ensureProgressionAudio()) {
      // Split event-id refs to keep the two id spaces (Transport vs.
      // window.setTimeout) cleanly disjoint. Each call to `armAdvance` writes
      // to exactly one of these depending on which path it takes.
      let transportEventId: number | null = null;
      let retryTimeoutId: number | null = null;
      let cancelled = false;

      // Transport must be running for `scheduleOnce` callbacks to fire — its
      // tick source only advances in the "started" state. `start()` is
      // idempotent in Tone v15: calling it on an already-running Transport
      // is a no-op.
      //
      // We intentionally do NOT call `Transport.stop()` on cleanup: the
      // Transport is a shared singleton, and future consumers (e.g. Phase 7B
      // Task 7 drum loops) depend on its state and position. Stop ownership
      // belongs to a future top-level "all playback ended" path, not to this
      // hook — which unmounts on every pause/mute toggle.
      getTransport().start();

      const armAdvance = () => {
        if (cancelled) return;

        const tl = getTimelinePosition();
        if (!tl || tl.stepIndex !== activeProgressionStepIndex) {
          // PlaybackLoop runs before the audio scheduler effect in
          // ProgressionSummarySlot, so on a fresh start or a step transition
          // the timeline may not be armed until the next macrotask. Retry once
          // the scheduler has had a chance to publish the active audio segment.
          retryTimeoutId = window.setTimeout(armAdvance, 0) as unknown as number;
          return;
        }

        const remainingSec = (getTimeUntilCurrentStepEndMs() ?? 0) / 1000;

        // Relative-time string syntax: Tone interprets `"+x"` as "x seconds
        // from transport now", which is unambiguous regardless of whether
        // the numeric form would have been parsed as ticks or seconds.
        //
        // Do NOT wrap this in `Tone.Draw.schedule(...)` or `startTransition`.
        // `Draw` silently drops events whose scheduled time is more than
        // 250ms in the past (Draw's `expiration`), and `startTransition`
        // gives React explicit permission to deprioritize the Jotai write
        // that arms the next step — together they can stall the advance
        // chain mid-progression (one heavy Fretboard re-render past the
        // 250ms window and Draw drops the next callback, freezing
        // playback). See PR/commit history for the regression that
        // motivated removing that wrapper.
        transportEventId = getTransport().scheduleOnce(() => {
          advanceProgressionPlayback();
        }, `+${remainingSec}`) as unknown as number;
      };

      armAdvance();
      return () => {
        cancelled = true;
        if (transportEventId !== null) {
          getTransport().clear(transportEventId);
        }
        if (retryTimeoutId !== null) {
          window.clearTimeout(retryTimeoutId);
        }
      };
    }

    // No Web Audio support — fall back to the wall-clock timer so the
    // progression still advances (used in tests and locked-autoplay
    // environments). With no AudioContext there is no shared audio clock for
    // Transport to bind to, so `setTimeout` is the only option here.
    if (progressionStepDurationMs <= 0) return;
    const timeoutId = window.setTimeout(() => {
      advanceProgressionPlayback();
    }, progressionStepDurationMs);
    return () => window.clearTimeout(timeoutId);
  }, [
    advanceProgressionPlayback,
    progressionPlaybackBlockedReason,
    progressionPlaying,
    isMuted,
    progressionStepDurationMs,
    activeProgressionStepIndex,
  ]);
}
