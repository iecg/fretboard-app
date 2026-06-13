/**
 * Idle-suspend for AudioContexts.
 *
 * A running AudioContext keeps the browser's audio rendering thread alive
 * (~44.1 kHz processing loop), which Safari flags as "significant energy"
 * even when no audio is playing. This module suspends all registered
 * contexts after a configurable idle period and lets callers resume them
 * on demand.
 *
 * Integration points:
 *   - GuitarSynth.playNote() → markAudioActivity()
 *   - progression play/stop → holdAudioActive() / releaseAudioActive()
 *   - bus.ts / audio.ts init → registerAudioContext()
 */

const IDLE_SUSPEND_MS = 30_000;

/** Which subsystem owns a registered context. Lets callers query a single
 *  role's suspended state instead of all contexts (e.g. the progression
 *  spinner must not react to an idle guitar context). */
export type AudioContextRole = "progression" | "guitar";

const contexts = new Map<AudioContext, AudioContextRole | undefined>();
let timer: ReturnType<typeof setTimeout> | null = null;
let held = false;

export function registerAudioContext(ctx: AudioContext, role?: AudioContextRole): void {
  // The guitar and the progression each own a SEPARATE AudioContext, so they are
  // distinct map keys — no role collision to guard against. A later call with the
  // same key simply updates (e.g. upgrades) the role.
  contexts.set(ctx, role);
}

export function unregisterAudioContext(ctx: AudioContext): void {
  contexts.delete(ctx);
}

export function holdAudioActive(): void {
  held = true;
  clearIdleTimer();
}

export function releaseAudioActive(): void {
  held = false;
  scheduleIdleSuspend();
}

export function markAudioActivity(): void {
  scheduleIdleSuspend();
}

function clearIdleTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleIdleSuspend(): void {
  clearIdleTimer();
  if (held) return;
  timer = setTimeout(suspendAll, IDLE_SUSPEND_MS);
}

function suspendAll(): void {
  timer = null;
  if (held) return;
  for (const ctx of contexts.keys()) {
    if (ctx.state === "running") {
      ctx.suspend().catch(() => {});
    }
  }
}

/** True if any registered context with the given role is not running.
 *  Omit `role` to check every context. */
export function isContextSuspended(role?: AudioContextRole): boolean {
  for (const [ctx, ctxRole] of contexts) {
    if (role !== undefined && ctxRole !== role) continue;
    if (ctx.state !== "running") return true;
  }
  return false;
}

export function _resetAudioIdleSuspendForTests(): void {
  clearIdleTimer();
  contexts.clear();
  held = false;
}

export { IDLE_SUSPEND_MS };
