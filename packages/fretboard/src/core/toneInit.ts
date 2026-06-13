import * as Tone from "tone";

let started = false;

/**
 * Ensures Tone.js is started exactly once. Must be invoked from a user
 * gesture handler (click, keypress, etc.) so the underlying AudioContext
 * is allowed to resume in browsers that block autoplay.
 *
 * Subsequent calls are no-ops while the AudioContext remains running.
 * If the context is re-suspended (e.g. Safari idle suspension), this
 * will re-attempt Tone.start() on a later user gesture.
 */
export async function ensureToneStarted(): Promise<void> {
  if (started) {
    // Safari re-suspends AudioContext after extended idle. Detect and
    // re-call Tone.start() on the next user gesture so audio resumes.
    try {
      if (Tone.getContext().state === "running") return;
    } catch {
      // Context unavailable; fall through to Tone.start().
    }
  }
  await Tone.start();
  started = true;
}

/**
 * Test-only hook: reset the gating singleton so tests can re-exercise
 * the first-call path. Not part of the public runtime API.
 */
export function __resetToneStartedForTests(): void {
  started = false;
}
