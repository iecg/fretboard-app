/**
 * Bridge between the bespoke progression bus and Tone.js.
 *
 * Tone defaults to constructing its own `AudioContext`. The progression
 * subsystem already owns a shared context (see `bus.ts`), and `timeline.ts`
 * reads `currentTime` directly from it to keep React in lockstep with audio.
 * If Tone ran on its own context we would have two clocks ticking
 * independently — drift of ~10 ms per minute is enough to make swing feel
 * sloppy. Instead we tell Tone to wrap the existing context, so
 * `Tone.now()` and `audio.ctx.currentTime` advance together.
 *
 * Bind exactly once: re-binding mid-session would re-wrap the context and
 * orphan any voices already scheduled on the previous wrapper.
 */
import * as Tone from "tone";
import type { ProgressionAudio } from "./bus";

let bound = false;

export function bindToneToProgressionContext(audio: ProgressionAudio): void {
  if (bound) return;
  Tone.setContext(audio.ctx);
  bound = true;
}

/** Clear the one-shot guard so `bindToneToProgressionContext` re-binds on the next call. */
export function resetToneBusBinding(): void {
  bound = false;
}

/** Test-only reset so the module behaves predictably across vitest runs. */
export function _resetToneBusForTests(): void {
  bound = false;
}
