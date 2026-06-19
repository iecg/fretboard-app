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
import type { DrumKitPatch } from "./sound/patchTypes";

const HIT_VELOCITY_DEFAULT = 1;
function clampVelocity(v: number | undefined): number {
  if (v === undefined) return HIT_VELOCITY_DEFAULT;
  return Math.max(0, Math.min(1.5, v));
}

const kitKey = (kit?: DrumKitPatch) => kit?.id ?? "__default";

export interface DrumHitOptions {
  velocity?: number;
  kit?: DrumKitPatch;
}

export interface DrumVoiceHandle {
  cancel: () => void;
}

const NOOP_HANDLE: DrumVoiceHandle = { cancel: () => {} };

// Caching Maps
const kickSynths = new Map<string, Tone.MembraneSynth>();
const snareSynths = new Map<string, Tone.NoiseSynth>();
const closedHatSynths = new Map<string, Tone.MetalSynth>();
const openHatSynths = new Map<string, Tone.MetalSynth>();
const rideSynths = new Map<string, Tone.MetalSynth>();
const crossStickSynths = new Map<string, Tone.MembraneSynth>();

// ── Kick ───────────────────────────────────────────────────────────────────
const DEFAULT_KICK_ENV = {
  attack: 0.001,
  decay: 0.35,
  sustain: 0,
  release: 0.1,
  attackCurve: "exponential" as const,
};

function getKickSynth(kit: DrumKitPatch | undefined, dest: AudioNode): Tone.MembraneSynth {
  const key = kitKey(kit);
  let synth = kickSynths.get(key);
  if (!synth) {
    const ov = kit?.voices.kick;
    synth = new Tone.MembraneSynth({
      pitchDecay: ov?.pitchDecay ?? 0.04,
      octaves: ov?.octaves ?? 6,
      oscillator: { type: "sine" },
      envelope: { ...DEFAULT_KICK_ENV, ...(ov?.envelope ?? {}) },
    });
    synth.connect(dest);
    kickSynths.set(key, synth);
  }
  return synth;
}

export function scheduleKick(
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;

  const synth = getKickSynth(options.kit, dest);
  synth.disconnect();
  synth.connect(dest);
  synth.triggerAttackRelease("C1", 0.5, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      const cancelTime = Tone.now();
      if (cancelTime < time) {
        synth.envelope.cancel(cancelTime);
      }
    },
  };
}

// ── Snare ────────────────────────────────────────────────────────────────────
function getSnareSynth(kit: DrumKitPatch | undefined, dest: AudioNode): Tone.NoiseSynth {
  const key = kitKey(kit);
  let synth = snareSynths.get(key);
  if (!synth) {
    const ov = kit?.voices.snare;
    synth = new Tone.NoiseSynth({
      volume: ov?.volume ?? 0,
      noise: { type: ov?.noiseType ?? "white" },
      envelope: {
        attack: 0.001,
        decay: 0.18,
        sustain: 0,
        release: 0.05,
        ...(ov?.envelope ?? {}),
      },
    });
    synth.connect(dest);
    snareSynths.set(key, synth);
  }
  return synth;
}

export function scheduleSnare(
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const duration = options.kit?.voices.snare?.envelope?.decay ?? 0.18;

  const synth = getSnareSynth(options.kit, dest);
  synth.disconnect();
  synth.connect(dest);
  synth.triggerAttackRelease(duration, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      const cancelTime = Tone.now();
      if (cancelTime < time) {
        synth.envelope.cancel(cancelTime);
      }
    },
  };
}

// ── Hi-Hat (closed + open) ──────────────────────────────────────────────────
export interface HiHatOptions extends DrumHitOptions {
  open?: boolean;
}

function hatDecay(open: boolean, kit?: DrumKitPatch): number {
  return open
    ? (kit?.voices.openHat?.decay ?? 0.35)
    : (kit?.voices.hihat?.decay ?? 0.05);
}

function getHiHatSynth(open: boolean, kit: DrumKitPatch | undefined, dest: AudioNode): Tone.MetalSynth {
  const map = open ? openHatSynths : closedHatSynths;
  const key = kitKey(kit);
  let synth = map.get(key);
  if (!synth) {
    const ov = kit?.voices.hihat;
    const decay = hatDecay(open, kit);
    synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: ov?.resonance ?? 4000,
      octaves: ov?.octaves ?? 1.5,
    });
    synth.connect(dest);
    map.set(key, synth);
  }
  return synth;
}

export function scheduleHiHat(
  dest: AudioNode,
  time: number,
  options: HiHatOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const open = options.open ?? false;
  const decay = hatDecay(open, options.kit);

  const synth = getHiHatSynth(open, options.kit, dest);
  synth.disconnect();
  synth.connect(dest);
  synth.triggerAttackRelease("C6", decay, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      const cancelTime = Tone.now();
      if (cancelTime < time) {
        synth.envelope.cancel(cancelTime);
      }
    },
  };
}

// ── Ride ─────────────────────────────────────────────────────────────────────
export interface RideOptions extends DrumHitOptions {
  bell?: boolean;
}

function getRideSynth(kit: DrumKitPatch | undefined, dest: AudioNode): Tone.MetalSynth {
  const key = kitKey(kit);
  let synth = rideSynths.get(key);
  if (!synth) {
    const ov = kit?.voices.ride;
    synth = new Tone.MetalSynth({
      volume: ov?.volume ?? 0,
      envelope: { attack: 0.001, decay: ov?.decay ?? 1.0, release: 0.3 },
      harmonicity: ov?.harmonicity ?? 3.1,
      modulationIndex: 22,
      resonance: ov?.resonance ?? 2400,
      octaves: 1.0,
    });
    synth.connect(dest);
    rideSynths.set(key, synth);
  }
  return synth;
}

export function scheduleRide(
  dest: AudioNode,
  time: number,
  options: RideOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const decay = options.kit?.voices.ride?.decay ?? 1.0;

  const synth = getRideSynth(options.kit, dest);
  synth.disconnect();
  synth.connect(dest);
  synth.triggerAttackRelease("D6", decay, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      const cancelTime = Tone.now();
      if (cancelTime < time) {
        synth.envelope.cancel(cancelTime);
      }
    },
  };
}

// ── Cross-Stick / Rim ────────────────────────────────────────────────────────
const DEFAULT_CROSS_STICK_ENV = {
  attack: 0.001,
  decay: 0.06,
  sustain: 0,
  release: 0.02,
  attackCurve: "exponential" as const,
};

function getCrossStickSynth(kit: DrumKitPatch | undefined, dest: AudioNode): Tone.MembraneSynth {
  const key = kitKey(kit);
  let synth = crossStickSynths.get(key);
  if (!synth) {
    const ov = kit?.voices.crossStick;
    synth = new Tone.MembraneSynth({
      pitchDecay: ov?.pitchDecay ?? 0.008,
      octaves: ov?.octaves ?? 2,
      oscillator: { type: "triangle" },
      envelope: { ...DEFAULT_CROSS_STICK_ENV, ...(ov?.envelope ?? {}) },
    });
    synth.connect(dest);
    crossStickSynths.set(key, synth);
  }
  return synth;
}

export function scheduleCrossStick(
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;

  const synth = getCrossStickSynth(options.kit, dest);
  synth.disconnect();
  synth.connect(dest);
  synth.triggerAttackRelease("G4", 0.05, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      const cancelTime = Tone.now();
      if (cancelTime < time) {
        synth.envelope.cancel(cancelTime);
      }
    },
  };
}

/** Test-only reset so the module behaves predictably across vitest runs. */
export function _resetDrumKitSynths(): void {
  const disposeAll = (map: Map<string, Tone.Instrument>) => {
    map.forEach((synth) => {
      try {
        synth.dispose();
      } catch {}
    });
    map.clear();
  };
  disposeAll(kickSynths);
  disposeAll(snareSynths);
  disposeAll(closedHatSynths);
  disposeAll(openHatSynths);
  disposeAll(rideSynths);
  disposeAll(crossStickSynths);
}
