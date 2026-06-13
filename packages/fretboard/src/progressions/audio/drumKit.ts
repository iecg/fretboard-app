/**
 * Synthesized drum kit voices on Tone.js primitives, parameterized per genre
 * via DrumKitPatch. When no kit is supplied, the defaults reproduce the prior
 * fixed kit exactly. Pools are keyed by (voice, kit id) so switching kits swaps
 * to a fresh pool; the old pool idles and is GC'd.
 *
 *  - Kick  → `Tone.MembraneSynth` (sine + pitch-decay)
 *  - Snare → `Tone.NoiseSynth`    (white noise + envelope)
 *  - HiHat → `Tone.MetalSynth`    (short decay closed / longer decay open)
 *  - Ride  → `Tone.MetalSynth`    (long decay)
 */
import * as Tone from "tone";
import type { ReusableVoiceLease } from "./createReusableVoicePool";
import { createReusableVoicePool } from "./createReusableVoicePool";
import type { DrumKitPatch } from "./sound/patchTypes";

const HIT_VELOCITY_DEFAULT = 1;
function clampVelocity(v: number | undefined): number {
  if (v === undefined) return HIT_VELOCITY_DEFAULT;
  return Math.max(0, Math.min(1.5, v));
}

// Dispose-deferral windows (ms) chosen per voice so the natural release tail
// is not truncated. Slightly longer than the voice's release time gives the
// envelope room to settle before we drop the node.
const KICK_DISPOSE_MS = 600; // kick decay ~350 ms
const SNARE_DISPOSE_MS = 300; // snare decay ~180 ms
const HAT_CLOSED_DISPOSE_MS = 150; // closed hat decay ~50 ms
const HAT_OPEN_DISPOSE_MS = 500; // open hat decay ~350 ms
const RIDE_DISPOSE_MS = 1500; // ride decay ~1 s
const CROSS_STICK_DISPOSE_MS = 120; // cross-stick decay ~60 ms

const kitKey = (kit?: DrumKitPatch) => kit?.id ?? "__default";

export interface DrumHitOptions {
  velocity?: number;
  kit?: DrumKitPatch;
}

export interface DrumVoiceHandle {
  cancel: () => void;
}

function deferredDisposeHandle(
  lease: ReusableVoiceLease<
    Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth
  >,
  time: number,
  busyUntil: number,
  tailMs: number,
): DrumVoiceHandle {
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      if (!lease.isCurrent()) return;

      const cancelTime = Tone.now();
      if (cancelTime < time) {
        lease.dispose();
        return;
      }

      if (cancelTime >= busyUntil) {
        return;
      }

      lease.setBusyUntil(cancelTime + tailMs / 1000);
      setTimeout(() => {
        try {
          lease.dispose();
        } catch {
          /* already disposed */
        }
      }, tailMs);
    },
  };
}

const NOOP_HANDLE: DrumVoiceHandle = { cancel: () => {} };

// ── Kick ───────────────────────────────────────────────────────────────────
const DEFAULT_KICK_ENV = {
  attack: 0.001,
  decay: 0.35,
  sustain: 0,
  release: 0.1,
  attackCurve: "exponential" as const,
};
const kickPools = new Map<
  string,
  ReturnType<typeof createReusableVoicePool<Tone.MembraneSynth>>
>();
function kickPool(kit?: DrumKitPatch) {
  const key = kitKey(kit);
  const existing = kickPools.get(key);
  if (existing) return existing;
  const ov = kit?.voices.kick;
  const pool = createReusableVoicePool<Tone.MembraneSynth>({
    createVoice: () =>
      new Tone.MembraneSynth({
        pitchDecay: ov?.pitchDecay ?? 0.04,
        octaves: ov?.octaves ?? 6,
        oscillator: { type: "sine" },
        envelope: { ...DEFAULT_KICK_ENV, ...(ov?.envelope ?? {}) },
      }),
  });
  kickPools.set(key, pool);
  return pool;
}

/**
 * Schedule a kick drum hit at `time`. `Tone.MembraneSynth` provides the
 * punchy 808-style envelope: sine oscillator with an exponential pitch drop,
 * fast attack, ~350 ms decay.
 */
export function scheduleKick(
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = kickPool(options.kit).lease(dest, now);
  const busyUntil = playbackStartTime + 0.6;
  lease.setBusyUntil(busyUntil);
  lease.voice.triggerAttackRelease("C1", 0.5, time, velocity);
  return deferredDisposeHandle(lease, time, busyUntil, KICK_DISPOSE_MS);
}

// ── Snare ────────────────────────────────────────────────────────────────────
const snarePools = new Map<
  string,
  ReturnType<typeof createReusableVoicePool<Tone.NoiseSynth>>
>();
function snarePool(kit?: DrumKitPatch) {
  const key = kitKey(kit);
  const existing = snarePools.get(key);
  if (existing) return existing;
  const ov = kit?.voices.snare;
  const pool = createReusableVoicePool<Tone.NoiseSynth>({
    createVoice: () =>
      new Tone.NoiseSynth({
        // Per-voice output level (dB). Lets a soft brush snare be lifted without
        // raising its velocity (which would turn it into a hard backbeat hit).
        // Defaults to 0 (unchanged) for kits that omit it. Mirrors the ride.
        volume: ov?.volume ?? 0,
        noise: { type: ov?.noiseType ?? "white" },
        envelope: {
          attack: 0.001,
          decay: 0.18,
          sustain: 0,
          release: 0.05,
          ...(ov?.envelope ?? {}),
        },
      }),
  });
  snarePools.set(key, pool);
  return pool;
}

/**
 * Schedule a snare hit at `time`. Pure `Tone.NoiseSynth` (white noise + AD
 * envelope) — note: `NoiseSynth.triggerAttackRelease` takes `(duration, time,
 * velocity)` with no note argument, since noise has no pitch.
 */
export function scheduleSnare(
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const duration = options.kit?.voices.snare?.envelope?.decay ?? 0.18;
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = snarePool(options.kit).lease(dest, now);
  const busyUntil = playbackStartTime + 0.23;
  lease.setBusyUntil(busyUntil);
  // NoiseSynth has no pitch — signature is (duration, time, velocity).
  lease.voice.triggerAttackRelease(duration, time, velocity);
  return deferredDisposeHandle(lease, time, busyUntil, SNARE_DISPOSE_MS);
}

// ── Hi-Hat (closed + open) ──────────────────────────────────────────────────
export interface HiHatOptions extends DrumHitOptions {
  /** Open hat has a longer decay tail. Default false (closed). */
  open?: boolean;
}

const closedHatPools = new Map<
  string,
  ReturnType<typeof createReusableVoicePool<Tone.MetalSynth>>
>();
const openHatPools = new Map<
  string,
  ReturnType<typeof createReusableVoicePool<Tone.MetalSynth>>
>();

function hatDecay(open: boolean, kit?: DrumKitPatch): number {
  return open
    ? (kit?.voices.openHat?.decay ?? 0.35)
    : (kit?.voices.hihat?.decay ?? 0.05);
}

function hatPool(open: boolean, kit?: DrumKitPatch) {
  const map = open ? openHatPools : closedHatPools;
  const key = kitKey(kit);
  const existing = map.get(key);
  if (existing) return existing;
  const ov = kit?.voices.hihat;
  const decay = hatDecay(open, kit);
  const pool = createReusableVoicePool<Tone.MetalSynth>({
    createVoice: () =>
      new Tone.MetalSynth({
        envelope: { attack: 0.001, decay, release: 0.02 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: ov?.resonance ?? 4000,
        octaves: ov?.octaves ?? 1.5,
      }),
  });
  map.set(key, pool);
  return pool;
}

/**
 * Schedule a hi-hat hit at `time` on `Tone.MetalSynth`. Open variant uses a
 * ~350 ms decay; closed variant chokes at ~50 ms. The longer dispose-deferral
 * for the open variant prevents the tail from being truncated on `cancel()`.
 */
export function scheduleHiHat(
  dest: AudioNode,
  time: number,
  options: HiHatOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const open = options.open ?? false;
  const decay = hatDecay(open, options.kit);
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = hatPool(open, options.kit).lease(dest, now);
  const busyUntil = playbackStartTime + decay + 0.02;
  lease.setBusyUntil(busyUntil);
  lease.voice.triggerAttackRelease("C6", decay, time, velocity);
  return deferredDisposeHandle(
    lease,
    time,
    busyUntil,
    open ? HAT_OPEN_DISPOSE_MS : HAT_CLOSED_DISPOSE_MS,
  );
}

// ── Ride ─────────────────────────────────────────────────────────────────────
export interface RideOptions extends DrumHitOptions {
  /** Bell-mode shading is a future refinement; preserved for call-site compat. */
  bell?: boolean;
}

const ridePools = new Map<
  string,
  ReturnType<typeof createReusableVoicePool<Tone.MetalSynth>>
>();
function ridePool(kit?: DrumKitPatch) {
  const key = kitKey(kit);
  const existing = ridePools.get(key);
  if (existing) return existing;
  const ov = kit?.voices.ride;
  const pool = createReusableVoicePool<Tone.MetalSynth>({
    createVoice: () =>
      new Tone.MetalSynth({
        // Per-voice output level (dB). MetalSynth is intrinsically hot; without
        // this knob the ride could only be balanced via velocity, which warps
        // the musical dynamics. Defaults to 0 (unchanged) for kits that omit it.
        volume: ov?.volume ?? 0,
        envelope: { attack: 0.001, decay: ov?.decay ?? 1.0, release: 0.3 },
        harmonicity: ov?.harmonicity ?? 3.1,
        modulationIndex: 22,
        resonance: ov?.resonance ?? 2400,
        octaves: 1.0,
      }),
  });
  ridePools.set(key, pool);
  return pool;
}

/**
 * Schedule a ride cymbal hit at `time` on `Tone.MetalSynth`. Longer decay
 * than the hi-hat (~1 s). The `bell` option is preserved on the public
 * options shape for call-site compatibility but isn't yet wired into the
 * Tone voice — bell-mode shading is a future refinement.
 */
export function scheduleRide(
  dest: AudioNode,
  time: number,
  options: RideOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const decay = options.kit?.voices.ride?.decay ?? 1.0;
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = ridePool(options.kit).lease(dest, now);
  const busyUntil = playbackStartTime + 1.3;
  lease.setBusyUntil(busyUntil);
  lease.voice.triggerAttackRelease("D6", decay, time, velocity);
  return deferredDisposeHandle(lease, time, busyUntil, RIDE_DISPOSE_MS);
}

// ── Cross-Stick / Rim ────────────────────────────────────────────────────────
// A dry woody "tok" for the bossa clave: a short, high-pitched MembraneSynth
// click. Fully deterministic, no noise generation.
const DEFAULT_CROSS_STICK_ENV = {
  attack: 0.001,
  decay: 0.06,
  sustain: 0,
  release: 0.02,
  attackCurve: "exponential" as const,
};
const crossStickPools = new Map<
  string,
  ReturnType<typeof createReusableVoicePool<Tone.MembraneSynth>>
>();
function crossStickPool(kit?: DrumKitPatch) {
  const key = kitKey(kit);
  const existing = crossStickPools.get(key);
  if (existing) return existing;
  const ov = kit?.voices.crossStick;
  const pool = createReusableVoicePool<Tone.MembraneSynth>({
    createVoice: () =>
      new Tone.MembraneSynth({
        pitchDecay: ov?.pitchDecay ?? 0.008,
        octaves: ov?.octaves ?? 2,
        oscillator: { type: "triangle" },
        envelope: { ...DEFAULT_CROSS_STICK_ENV, ...(ov?.envelope ?? {}) },
      }),
  });
  crossStickPools.set(key, pool);
  return pool;
}

/**
 * Schedule a cross-stick / rim-click hit at `time`. Short MembraneSynth click
 * (triangle, tiny pitch-decay, ~60 ms decay) — the bossa clave timbre.
 */
export function scheduleCrossStick(
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = crossStickPool(options.kit).lease(dest, now);
  const busyUntil = playbackStartTime + 0.12;
  lease.setBusyUntil(busyUntil);
  lease.voice.triggerAttackRelease("G4", 0.05, time, velocity);
  return deferredDisposeHandle(lease, time, busyUntil, CROSS_STICK_DISPOSE_MS);
}
