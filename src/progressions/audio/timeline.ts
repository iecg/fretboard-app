/**
 * Shared progression timeline anchored to `AudioContext.currentTime`.
 *
 * Every progression UI surface (playhead, position readout, active-step
 * badge) reads its position from this module. The audio scheduler is the
 * sole writer: it calls `setActiveStep` whenever it schedules a chord, so
 * the visual layer never derives its motion from a JS timer that can drift
 * from the audio clock.
 *
 * Two consequences flow from "AudioContext is the master clock":
 *  1. The metronome's audible click and the playhead's pixel position
 *     reference the same currentTime, so they stay locked over arbitrary
 *     durations.
 *  2. Chord transitions advance React state when the audio clock crosses
 *     the boundary rather than when a `setTimeout` fires, eliminating the
 *     50–100ms perceived lag at every chord change.
 *
 * The module keeps a tiny piece of state — no listeners array is needed
 * because consumers poll on a short interval; pull-based fits the React
 * mental model better than push-based for animation.
 */

import { ensureProgressionAudio } from "./bus";

interface ActiveStep {
  /** The step index in `progressionStepsAtom` order. */
  stepIndex: number;
  /** AudioContext time at which this step started playing. */
  audioStartTime: number;
  /** Step length in seconds. */
  durationSec: number;
}

interface TimelineState {
  active: ActiveStep | null;
  /** True if playback is paused. While paused, `getTimelinePosition()` reports
   *  fraction 0 so the playhead and position readout snap to the start of the
   *  current bar, matching DAW pause-then-reset semantics. */
  paused: boolean;
}

let state: TimelineState = { active: null, paused: false };

export interface TimelinePosition {
  stepIndex: number;
  /** Position within the current step, 0..1. */
  fraction: number;
  paused: boolean;
}

/**
 * Set the currently-playing step. Called by the audio scheduler whenever it
 * schedules audio for a new chord. The `audioStartTime` must be the same
 * `AudioContext` time that the audio events were scheduled at, so the
 * visual fraction matches what the user hears.
 */
export function setActiveStep(
  stepIndex: number,
  audioStartTime: number,
  durationSec: number,
): void {
  state = {
    active: { stepIndex, audioStartTime, durationSec },
    paused: false,
  };
}

/**
 * Mark the timeline paused. The current step is preserved so callers can
 * resume from the same chord; the reported fraction snaps to 0 so the
 * playhead and position readout reset to the start of the current bar.
 */
export function pauseTimeline(): void {
  if (!state.active || state.paused) return;
  state = { ...state, paused: true };
}

/**
 * Resume playback by anchoring the current step's start to "now" on the
 * AudioContext clock. The caller should also rebuild any scheduled audio
 * starting at the same `now + lead` time so visual and audio start
 * together at beat 0.
 */
export function resumeTimelineAtCurrentTime(): void {
  if (!state.active) return;
  const audio = ensureProgressionAudio();
  if (!audio) {
    state = { ...state, paused: false };
    return;
  }
  state = {
    active: { ...state.active, audioStartTime: audio.ctx.currentTime },
    paused: false,
  };
}

/** Forget the active step. Use on stop / blocked / progression-disabled. */
export function clearTimeline(): void {
  state = { active: null, paused: false };
}

/**
 * Current position relative to the active step, or `null` if no step is
 * playing yet. The fraction is clamped to [0, 1]; consumers can compute
 * `stepStartBar + fraction * stepBars` for the smooth bar position.
 */
export function getTimelinePosition(): TimelinePosition | null {
  if (!state.active) return null;
  if (state.paused) {
    return { stepIndex: state.active.stepIndex, fraction: 0, paused: true };
  }
  const audio = ensureProgressionAudio();
  if (!audio) {
    return { stepIndex: state.active.stepIndex, fraction: 0, paused: false };
  }
  const elapsed = audio.ctx.currentTime - state.active.audioStartTime;
  const fraction = Math.max(
    0,
    Math.min(1, elapsed / Math.max(0.001, state.active.durationSec)),
  );
  return { stepIndex: state.active.stepIndex, fraction, paused: false };
}

/**
 * True once the audio clock has crossed past the current step's end. Polled
 * by the React playback loop to advance `activeProgressionStepIndexAtom` at
 * the audio-accurate boundary.
 */
export function isCurrentStepFinished(): boolean {
  if (!state.active || state.paused) return false;
  const audio = ensureProgressionAudio();
  if (!audio) return false;
  return (
    audio.ctx.currentTime
      >= state.active.audioStartTime + state.active.durationSec
  );
}

/** Test-only reset; vitest modules persist across tests in the same file. */
export function _resetTimelineForTests(): void {
  state = { active: null, paused: false };
}

export const _internals = { get state() { return state; } };
