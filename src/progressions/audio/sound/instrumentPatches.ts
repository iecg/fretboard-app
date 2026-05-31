import type { BassPatch, ChordPatch, ChordFamily, DrumKitPatch } from "./patchTypes";

// ── Bass ──────────────────────────────────────────────────────────────────
// MonoSynth is single-oscillator; "blends" are approximated via oscillator
// choice + filter-envelope motion. The critical fix vs. the old bass: a LIVE
// filter envelope (octaves > 0). The old voice used octaves: 0 (inert).
export const BASS_PATCHES: readonly BassPatch[] = [
  {
    // Shared by blues, jazz, and ballad. Must read on small speakers, so it
    // CANNOT be a pure sine: bass frequencies (~40-165Hz) are physically weak
    // on laptop/phone speakers and a sine has no overtones for the ear to
    // track the pitch. Use a triangle (odd harmonics) + a small sustain so the
    // body survives a legato note, an open top (no high-cut) to keep those
    // harmonics, and a gentle chebyshev saturation for extra audible overtones.
    id: "bass-upright", label: "Upright",
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.5, sustain: 0.12, release: 0.3 },
    filter: { type: "lowpass", Q: 1 },
    filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.4, release: 0.3, baseFrequency: 180, octaves: 2.5 },
    volumeDb: -2,
    insert: { eq3: { low: 2, mid: 1, high: 0 }, saturation: { kind: "chebyshev", amount: 3 } },
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
  {
    id: "chord-funk-scratch", label: "Funk Scratch", family: "strum",
    strum: {
      // Karplus-Strong single-coil funk guitar: a real plucked string with a
      // bright pick attack. The synth is a noise burst recirculating through a
      // damped comb filter, so three params must balance:
      //  - resonance HIGH (~0.9): a pluck's decay is the comb feedback, NOT the
      //    note-hold duration. At low resonance every note decays in ~70ms and
      //    nothing rings (stabs/root collapse into uniform ghost clicks). At ~0.9
      //    the ring outlasts the choke window, so durationSec (via the release
      //    ramp) governs choke-vs-ring: ghosts (0.06s) choke, stabs/color (0.4s)
      //    ring, root (0.12s) sustains briefly.
      //  - dampening MODERATE (~2800): the comb's lowpass. High feedback rings
      //    whatever is in the string, so a bright dampening keeps the NOISE
      //    ringing and the string sounds buzzy/rattly ("loose"). A lower
      //    dampening sheds highs faster each pass, settling the rattle into a
      //    warm pitched tone within a few cycles while the fundamental still rings.
      //  - attackNoise MODEST (~0.9): less grit in the excitation at the source.
      // eq3 high is a gentle +1 (not +3) so it doesn't re-amplify residual buzz.
      // Tight strumLagSec so the chord lands as a single stab. Velocity is scaled
      // by string.ts's gain stage (PluckSynth itself ignores velocity).
      pluck: { attackNoise: 0.9, dampening: 2800, resonance: 0.9, release: 0.12 },
      noteDurationSec: 0.18,
      releaseTailSec: 0.4,
      strumLagSec: 0.007,
    },
    insert: { eq3: { low: -2, mid: 1, high: 1 } },
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
      // Brush: white noise (energy in the highs that survive small speakers —
      // dark pink at low velocity was inaudible twice), a slightly longer decay
      // for the brush "swish", and a +4dB lift via the per-voice lever so it
      // reads as a soft-but-present brush rather than a hard backbeat whack.
      snare: { noiseType: "white", envelope: { attack: 0.004, decay: 0.22 }, volume: 4 },
      hihat: { decay: 0.05, resonance: 3000 },
      // Tamed ride: −10dB output so it sits under the brushes (it was
      // dominating), shorter decay + lower resonance so it reads as a soft
      // jazz ride rather than a piercing metallic wash.
      ride: { decay: 1.0, harmonicity: 2.8, resonance: 1800, volume: -10 },
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
      snare: { noiseType: "white", envelope: { decay: 0.12 } },
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
