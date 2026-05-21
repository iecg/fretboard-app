import * as Tone from "tone";

let started = false;

/**
 * Ensures Tone.js is started exactly once. Must be invoked from a user
 * gesture handler (click, keypress, etc.) so the underlying AudioContext
 * is allowed to resume in browsers that block autoplay.
 *
 * Subsequent calls are no-ops, regardless of how many times this is
 * invoked across the app lifecycle.
 */
export async function ensureToneStarted(): Promise<void> {
  if (started) return;
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
