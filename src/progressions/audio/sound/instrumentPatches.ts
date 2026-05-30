import type { BassPatch, ChordPatch, ChordFamily, DrumKitPatch } from "./patchTypes";

// ── Bass ──────────────────────────────────────────────────────────────────
// MonoSynth is single-oscillator; "blends" are approximated via oscillator
// choice + filter-envelope motion. The critical fix vs. the old bass: a LIVE
// filter envelope (octaves > 0). The old voice used octaves: 0 (inert).
export const BASS_PATCHES: readonly BassPatch[] = [
  {
    id: "bass-upright", label: "Upright",
    oscillator: { type: "fatsine" },
    envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.3 },
    filter: { type: "lowpass", Q: 1 },
    filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.3, baseFrequency: 150, octaves: 2.5 },
    volumeDb: -2,
    insert: { eq3: { low: 2, mid: 0, high: -3 } },
  },
  {
    id: "bass-finger", label: "Finger Electric",
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.2 },
    filter: { type: "lowpass", Q: 3 },
    filterEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.2, baseFrequency: 250, octaves: 2.5 },
    volumeDb: -3,
    insert: { eq3: { low: 1, mid: 1, high: -2 }, saturation: { kind: "chebyshev", amount: 5 } },
  },
  {
    id: "bass-pick", label: "Pick Electric",
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.002, decay: 0.2, sustain: 0.3, release: 0.2 },
    filter: { type: "lowpass", Q: 2 },
    filterEnvelope: { attack: 0.002, decay: 0.2, sustain: 0.3, release: 0.2, baseFrequency: 200, octaves: 3 },
    volumeDb: -3,
    insert: { eq3: { low: 0, mid: 2, high: 0 } },
  },
  {
    id: "bass-synth", label: "Synth Bass",
    oscillator: { type: "fatsquare" },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.3 },
    filter: { type: "lowpass", Q: 2 },
    filterEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.3, baseFrequency: 200, octaves: 2 },
    volumeDb: -2,
    insert: { saturation: { kind: "distortion", amount: 0.1 } },
  },
];

// ── Chords ───────────────────────────────────────────────────────────────
export const CHORD_PATCHES: readonly ChordPatch[] = [
  {
    id: "chord-grand-piano", label: "Grand Piano", family: "poly",
    poly: {
      volume: -6, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.55, 0.3, 0.16, 0.08] },
      envelope: { attack: 0.004, decay: 0.5, sustain: 0.08, release: 1.4 },
      releaseTailSec: 1.4, sustainedDurationSec: 1.4, shortDurationSec: 0.4,
    },
    insert: { eq3: { low: 0, mid: 0, high: 1 } },
  },
  {
    id: "chord-epiano", label: "Electric Piano", family: "poly",
    poly: {
      volume: -7, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.2, 0.6, 0.1, 0.25] },
      envelope: { attack: 0.005, decay: 0.7, sustain: 0.12, release: 1.0 },
      releaseTailSec: 1.0, sustainedDurationSec: 1.2, shortDurationSec: 0.4,
    },
    insert: { eq3: { low: -1, mid: 1, high: 2 } },
  },
  {
    id: "chord-jazz-organ", label: "Jazz Organ", family: "poly",
    poly: {
      volume: -10, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.6, 0.4, 0.3, 0.2] },
      envelope: { attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.5 },
      releaseTailSec: 0.5, sustainedDurationSec: 1.5, shortDurationSec: 0.2,
    },
  },
  {
    id: "chord-rock-organ", label: "Rock Organ", family: "poly",
    poly: {
      volume: -11, maxPolyphonyFloor: 6,
      oscillator: { type: "custom", partials: [1, 0.7, 0.5, 0.4, 0.3, 0.2] },
      envelope: { attack: 0.015, decay: 0.05, sustain: 0.9, release: 0.4 },
      releaseTailSec: 0.4, sustainedDurationSec: 1.5, shortDurationSec: 0.2,
    },
    insert: { saturation: { kind: "distortion", amount: 0.12 } },
  },
  {
    id: "chord-nylon-strum", label: "Nylon Strum", family: "strum",
    strum: {
      oscillator: { type: "custom", partials: [1, 0.6, 0.3, 0.14, 0.06] },
      envelope: { attack: 0.012, decay: 1.2, sustain: 0.05, release: 0.4 },
      noteDurationSec: 1.6, releaseTailSec: 2.0,
    },
  },
  {
    id: "chord-steel-strum", label: "Steel Strum", family: "strum",
    strum: {
      oscillator: { type: "custom", partials: [1, 0.8, 0.45, 0.22, 0.12, 0.05] },
      envelope: { attack: 0.01, decay: 1.1, sustain: 0.05, release: 0.4 },
      noteDurationSec: 1.8, releaseTailSec: 2.35,
    },
    insert: { eq3: { low: 0, mid: 0, high: 2 } },
  },
];

export const DEFAULT_CHORD_PATCH_BY_FAMILY: Record<ChordFamily, string> = {
  poly: "chord-grand-piano",
  strum: "chord-steel-strum",
};

// ── Drums ──────────────────────────────────────────────────────────────────
export const DRUM_KIT_PATCHES: readonly DrumKitPatch[] = [
  {
    id: "kit-acoustic-rock", label: "Acoustic Rock",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 6, envelope: { decay: 0.4 } },
      snare: { envelope: { decay: 0.2 } },
      hihat: { decay: 0.05 },
    },
  },
  {
    id: "kit-funk", label: "Funk",
    voices: {
      kick: { pitchDecay: 0.03, octaves: 5, envelope: { decay: 0.28 } },
      snare: { envelope: { decay: 0.14 } },
      hihat: { decay: 0.03, resonance: 5000 },
    },
  },
  {
    id: "kit-jazz-brush", label: "Jazz Brush",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.3 } },
      snare: { noiseType: "pink", envelope: { attack: 0.004, decay: 0.16 } },
      hihat: { decay: 0.05, resonance: 3000 },
      ride: { decay: 1.2, harmonicity: 3.1, resonance: 2400 },
    },
  },
  {
    id: "kit-blues-shuffle", label: "Blues Shuffle",
    voices: {
      kick: { pitchDecay: 0.045, octaves: 6, envelope: { decay: 0.35 } },
      ride: { decay: 1.1 },
    },
  },
  {
    id: "kit-ballad", label: "Ballad",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.32 } },
      snare: { envelope: { attack: 0.003, decay: 0.18 } },
    },
  },
  {
    id: "kit-bossa", label: "Bossa",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.28 } },
      snare: { noiseType: "pink", envelope: { decay: 0.12 } },
      hihat: { decay: 0.04 },
    },
  },
];

const bassById = new Map(BASS_PATCHES.map((p) => [p.id, p]));
const chordById = new Map(CHORD_PATCHES.map((p) => [p.id, p]));
const kitById = new Map(DRUM_KIT_PATCHES.map((p) => [p.id, p]));

export const getBassPatch = (id: string): BassPatch | undefined => bassById.get(id);
export const getChordPatch = (id: string): ChordPatch | undefined => chordById.get(id);
export const getDrumKitPatch = (id: string): DrumKitPatch | undefined => kitById.get(id);
