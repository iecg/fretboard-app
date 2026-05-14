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

const BUS_GAIN = 0.55;
const SILENCE_RAMP_SECONDS = 0.02;
const RESUME_RAMP_SECONDS = 0.04;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
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
  bus: GainNode;
}

/**
 * Lazily create the shared `AudioContext` + bus, returning them if available.
 * Returns `null` when Web Audio is unsupported or construction fails (e.g.
 * SSR, locked autoplay policy with no gesture yet).
 */
export function ensureProgressionAudio(): ProgressionAudio | null {
  if (unsupported) return null;
  if (ctx && bus) return { ctx, bus };

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
    return { ctx, bus };
  } catch {
    unsupported = true;
    ctx = null;
    bus = null;
    return null;
  }
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
  unsupported = false;
}

export const _internals = { BUS_GAIN, SILENCE_RAMP_SECONDS, RESUME_RAMP_SECONDS };
