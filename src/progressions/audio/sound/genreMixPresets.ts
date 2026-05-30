export type MixInstrument = "chord" | "bass" | "drums" | "metronome";

export interface InstrumentMix {
  volumeDb: number;
  pan: number; // -1 (L) .. 1 (R)
  reverbSend: number; // 0..1
  delaySend?: number; // 0..1, high tier only
}

export interface MasterMix {
  compressor: { threshold: number; ratio: number; attack: number; release: number };
  reverb: { decay: number; wet: number };
  limiterThreshold: number; // dB
}

export interface GenreMix {
  genre: string;
  patches: { bass: string; chord: string; drumKit: string };
  perInstrument: Record<MixInstrument, InstrumentMix>;
  master: MasterMix;
}

// Pan/send conventions: bass & metronome centered; ride/hats live in the drum
// bus so drums sit near-center with a hair of width; chords lightly spread.
export const GENRE_MIX_PRESETS: readonly GenreMix[] = [
  {
    genre: "pop",
    patches: { bass: "bass-finger", chord: "chord-grand-piano", drumKit: "kit-acoustic-rock" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.12, reverbSend: 0.18 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.04 },
      drums: { volumeDb: -1, pan: 0.05, reverbSend: 0.1 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.01, release: 0.18 }, reverb: { decay: 1.4, wet: 0.16 }, limiterThreshold: -1 },
  },
  {
    genre: "rock",
    patches: { bass: "bass-pick", chord: "chord-steel-strum", drumKit: "kit-acoustic-rock" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.18, reverbSend: 0.12 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.02 },
      drums: { volumeDb: 0, pan: 0.05, reverbSend: 0.08 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -16, ratio: 4, attack: 0.006, release: 0.14 }, reverb: { decay: 1.1, wet: 0.1 }, limiterThreshold: -0.8 },
  },
  {
    genre: "blues",
    patches: { bass: "bass-upright", chord: "chord-jazz-organ", drumKit: "kit-blues-shuffle" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.15, reverbSend: 0.2 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.05 },
      drums: { volumeDb: -2, pan: 0.06, reverbSend: 0.14 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.012, release: 0.2 }, reverb: { decay: 1.6, wet: 0.2 }, limiterThreshold: -1 },
  },
  {
    genre: "jazz",
    patches: { bass: "bass-upright", chord: "chord-epiano", drumKit: "kit-jazz-brush" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.16, reverbSend: 0.22 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.06 },
      drums: { volumeDb: -5, pan: 0.1, reverbSend: 0.18 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -20, ratio: 2.5, attack: 0.015, release: 0.22 }, reverb: { decay: 1.8, wet: 0.22 }, limiterThreshold: -1.2 },
  },
  {
    genre: "ballad",
    patches: { bass: "bass-upright", chord: "chord-grand-piano", drumKit: "kit-ballad" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.1, reverbSend: 0.28 },
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.08 },
      drums: { volumeDb: -4, pan: 0.04, reverbSend: 0.2 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -22, ratio: 2, attack: 0.02, release: 0.25 }, reverb: { decay: 2.2, wet: 0.28 }, limiterThreshold: -1.2 },
  },
  {
    genre: "funk",
    patches: { bass: "bass-finger", chord: "chord-steel-strum", drumKit: "kit-funk" },
    perInstrument: {
      chord: { volumeDb: -4, pan: -0.2, reverbSend: 0.06 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.0 },
      drums: { volumeDb: 0, pan: 0.05, reverbSend: 0.05 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -14, ratio: 5, attack: 0.004, release: 0.1 }, reverb: { decay: 0.9, wet: 0.06 }, limiterThreshold: -0.6 },
  },
  {
    genre: "bossa-nova",
    patches: { bass: "bass-synth", chord: "chord-grand-piano", drumKit: "kit-bossa" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.14, reverbSend: 0.18 },
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.05 },
      drums: { volumeDb: -3, pan: 0.08, reverbSend: 0.14 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.012, release: 0.2 }, reverb: { decay: 1.5, wet: 0.18 }, limiterThreshold: -1 },
  },
];

const byGenre = new Map(GENRE_MIX_PRESETS.map((m) => [m.genre, m]));
export const getGenreMix = (genre: string): GenreMix | undefined => byGenre.get(genre);

/** Fallback mix when a genre id has no preset (defensive). */
export const DEFAULT_GENRE_MIX: GenreMix = GENRE_MIX_PRESETS[0];
