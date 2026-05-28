/**
 * Shared audio context + master bus for progression playback.
 *
 * The progression track schedules many short-lived voices per bar (chord
 * strums, bass notes, drum hits, metronome clicks). Routing them all through
 * a single `GainNode` gives us a single fader to silence the entire backing
 * track on pause/mute without iterating every active voice.
 *
 * Lazy initialization is required: `AudioContext` construction is gated on a
 * user gesture in most browsers. Call `ensureProgressionAudio()` from inside
 * a click handler (e.g. the play button) before scheduling.
 */

import { getDraw } from "tone";
import { buildLayerBuses, type LayerBuses } from "./layerBuses";
import { _resetToneBusForTests, bindToneToProgressionContext } from "./toneBus";

const BUS_GAIN = 0.55;
const SILENCE_RAMP_SECONDS = 0.02;
const RESUME_RAMP_SECONDS = 0.04;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let layers: LayerBuses | null = null;
let unsupported = false;

function getAudioContextConstructor(): (new () => AudioContext) | undefined {
  const w = window as Window & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

export interface ProgressionAudio {
  ctx: AudioContext;
  /** Parent gain — all four layer buses connect here, then to ctx.destination. */
  bus: GainNode;
  /** Per-layer gain nodes. Sequencer callbacks connect their voices here. */
  layers: LayerBuses;
}

/**
 * Lazily create the shared `AudioContext` + bus, returning them if available.
 * Returns `null` when Web Audio is unsupported or construction fails (e.g.
 * SSR, locked autoplay policy with no gesture yet).
 */
export function ensureProgressionAudio(): ProgressionAudio | null {
  if (unsupported) return null;
  if (ctx && bus && layers) return { ctx, bus, layers };

  const Ctor = getAudioContextConstructor();
  if (!Ctor) {
    unsupported = true;
    return null;
  }

  try {
    ctx = new Ctor();
    bus = ctx.createGain();
    bus.gain.value = BUS_GAIN;
    bus.connect(ctx.destination);
    layers = buildLayerBuses(ctx, bus);
    bindToneToProgressionContext({ ctx, bus, layers });
  } catch (err) {
    // Dev-mode diagnostic — silent in production. The 2026-05-25 P2-T1
    // regression (Tone.Draw.expiration assignment on undefined) hid in
    // this try/catch for the entire round-1 plan because the catch logged
    // nothing. The console.warn flips a known-recoverable failure into an
    // observable one during development without polluting production logs.
    if (import.meta.env.DEV) {
      console.warn("[progression-audio] ensureProgressionAudio init failed:", err);
    }
    unsupported = true;
    ctx = null;
    bus = null;
    layers = null;
    return null;
  }

  // Best-effort: raise Draw.expiration so heavy main-thread renders don't
  // silently drop chord-overlay advances. Default is 250ms; chord
  // boundaries are >=0.5s at sane tempos so 5s gives a 10x margin without
  // ever firing stale.
  //
  // This is an OPTIMIZATION ON TOP of the working bus — kept outside the
  // setup try/catch so a failure here doesn't poison `ensureProgressionAudio`
  // and return null to every caller. In jsdom test environments, the mock
  // AudioContext doesn't satisfy Tone's Draw class, so `getDraw()` returns
  // undefined and assigning `.expiration` would throw; before this guard
  // moved out of the main try, that silent throw broke the timeline tests
  // (regression introduced in commit 183caeb9, found 2026-05-25).
  try {
    getDraw().expiration = 5;
  } catch {
    // Non-fatal — playback works without it; only the chord-overlay React
    // advance loses its under-load safety margin.
  }

  return { ctx, bus, layers };
}

/** Best-effort resume; safe to call repeatedly. */
export async function resumeProgressionAudio(): Promise<void> {
  const audio = ensureProgressionAudio();
  if (!audio) return;
  if (audio.ctx.state === "suspended" || audio.ctx.state === "interrupted") {
    try {
      await audio.ctx.resume();
    } catch {
      // best-effort
    }
  }
}

/**
 * Snap the bus gain down to zero with a short ramp so currently-ringing
 * voices fade in ~20ms instead of running their full envelopes. Use on
 * pause/stop/mute to keep the track responsive.
 */
export function silenceProgressionBus(): void {
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(0, now + SILENCE_RAMP_SECONDS);
}

/**
 * Restore the bus to full level. Mirrors `silenceProgressionBus`; call when
 * resuming playback so the next scheduled hit isn't swallowed by a zero bus.
 */
export function restoreProgressionBus(): void {
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(BUS_GAIN, now + RESUME_RAMP_SECONDS);
}

/** Test-only reset hook so the module behaves predictably across `vitest` runs. */
export function _resetProgressionAudioForTests(): void {
  ctx = null;
  bus = null;
  layers = null;
  unsupported = false;
  _resetToneBusForTests();
}

