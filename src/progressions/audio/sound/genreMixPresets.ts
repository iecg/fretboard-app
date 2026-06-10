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
  /** The chord layer is piano-only; `chord` is the genre's piano patch. */
  patches: { bass: string; chord: string; drumKit: string };
  perInstrument: Record<MixInstrument, InstrumentMix>;
  master: MasterMix;
}

/**
 * Shared output ceiling (dB) for the master limiter, identical across every
 * genre. Genre loudness character must come from compression + per-instrument
 * balance, NEVER from a hotter peak ceiling — otherwise one genre is simply
 * mastered louder than the rest (rock previously sat at -0.8, funk at -0.6,
 * making them audibly hotter than pop/jazz/ballad). Keeping the ceiling
 * constant is the single normalization point that keeps perceived loudness in
 * the same ballpark between genres.
 */
export const MASTER_LIMITER_CEILING_DB = -1;

// Pan/send conventions: bass & metronome centered; ride/hats live in the drum
// bus so drums sit near-center with a hair of width; chords lightly spread.
export const GENRE_MIX_PRESETS: readonly GenreMix[] = [
  {
    genre: "pop",
    patches: { bass: "bass-finger", chord: "chord-grand-piano", drumKit: "kit-acoustic-rock" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.12, reverbSend: 0.18 },
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.04 },
      drums: { volumeDb: -1, pan: 0.05, reverbSend: 0 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.01, release: 0.18 }, reverb: { decay: 1.1, wet: 0.16 }, limiterThreshold: MASTER_LIMITER_CEILING_DB },
  },
  {
    genre: "rock",
    patches: { bass: "bass-pick", chord: "chord-grand-piano", drumKit: "kit-acoustic-rock" },
    perInstrument: {
      // -2 (was -3): the -3 was staged for the dropped strum-guitar sitting on
      // top of the mix; the piano sits at the pop reference.
      chord: { volumeDb: -2, pan: -0.18, reverbSend: 0.12 },
      // -5: the sawtooth bass-pick (buzzy, mid-forward) over a dense staccato
      // pedal-bass pattern read too prominent even at -2; pulled to -5 in the
      // mix-balance pass (paired with easing its mid EQ to +1).
      bass: { volumeDb: -5, pan: 0, reverbSend: 0.02 },
      // -1 (was 0): rock's long-ringing steel strum + constant staccato pedal
      // bass already give it the highest sustained energy of any genre. Staging
      // the kit at 0 too made rock the loudest overall — pull it to the pop
      // reference so the ceiling normalization isn't fighting a hot arrangement.
      drums: { volumeDb: -1, pan: 0.05, reverbSend: 0 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -16, ratio: 4, attack: 0.006, release: 0.14 }, reverb: { decay: 1.1, wet: 0.1 }, limiterThreshold: MASTER_LIMITER_CEILING_DB },
  },
  {
    genre: "blues",
    patches: { bass: "bass-upright", chord: "chord-grand-piano", drumKit: "kit-blues-shuffle" },
    perInstrument: {
      // -2 / 0.2: piano comping at the pop reference; the lower send was a
      // workaround for the dropped strum voice's noise artifacts.
      chord: { volumeDb: -2, pan: -0.15, reverbSend: 0.2 },
      bass: { volumeDb: -2, pan: 0, reverbSend: 0.05 },
      drums: { volumeDb: -2, pan: 0.06, reverbSend: 0 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.012, release: 0.2 }, reverb: { decay: 1.1, wet: 0.2 }, limiterThreshold: MASTER_LIMITER_CEILING_DB },
  },
  {
    genre: "jazz",
    patches: { bass: "bass-upright", chord: "chord-epiano", drumKit: "kit-jazz-brush" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.16, reverbSend: 0.22 },
      bass: { volumeDb: -2, pan: 0, reverbSend: 0.06 },
      // -3 (was -5): the brush/ride voices are already individually soft, so
      // the extra bus cut buried the whole kit. Sits just under the front line.
      drums: { volumeDb: -3, pan: 0.1, reverbSend: 0 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -20, ratio: 2.5, attack: 0.015, release: 0.22 }, reverb: { decay: 1.3, wet: 0.22 }, limiterThreshold: MASTER_LIMITER_CEILING_DB },
  },
  {
    genre: "ballad",
    patches: { bass: "bass-upright", chord: "chord-grand-piano", drumKit: "kit-ballad" },
    perInstrument: {
      chord: { volumeDb: -2, pan: -0.1, reverbSend: 0.28 },
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.08 },
      drums: { volumeDb: -4, pan: 0.04, reverbSend: 0 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -22, ratio: 2, attack: 0.02, release: 0.25 }, reverb: { decay: 1.3, wet: 0.28 }, limiterThreshold: MASTER_LIMITER_CEILING_DB },
  },
  {
    genre: "funk",
    patches: { bass: "bass-finger", chord: "chord-grand-piano", drumKit: "kit-funk" },
    perInstrument: {
      // -3 (was -4): the -4 was staged for the dropped percussive scratch patch;
      // piano stabs need a bit more presence against the funk rhythm section.
      chord: { volumeDb: -3, pan: -0.2, reverbSend: 0.06 },
      bass: { volumeDb: 0, pan: 0, reverbSend: 0.0 },
      drums: { volumeDb: 0, pan: 0.05, reverbSend: 0.05 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -14, ratio: 5, attack: 0.004, release: 0.1 }, reverb: { decay: 0.9, wet: 0.06 }, limiterThreshold: MASTER_LIMITER_CEILING_DB },
  },
  {
    genre: "bossa-nova",
    patches: { bass: "bass-synth", chord: "chord-grand-piano", drumKit: "kit-bossa" },
    perInstrument: {
      chord: { volumeDb: -3, pan: -0.14, reverbSend: 0.18 },
      bass: { volumeDb: -1, pan: 0, reverbSend: 0.05 },
      drums: { volumeDb: -3, pan: 0.08, reverbSend: 0 },
      metronome: { volumeDb: -6, pan: 0, reverbSend: 0 },
    },
    master: { compressor: { threshold: -18, ratio: 3, attack: 0.012, release: 0.2 }, reverb: { decay: 1.1, wet: 0.18 }, limiterThreshold: MASTER_LIMITER_CEILING_DB },
  },
];

const byGenre = new Map(GENRE_MIX_PRESETS.map((m) => [m.genre, m]));
export const getGenreMix = (genre: string): GenreMix | undefined => byGenre.get(genre);

/** Fallback mix when a genre id has no preset (defensive). */
export const DEFAULT_GENRE_MIX: GenreMix = GENRE_MIX_PRESETS[0];
