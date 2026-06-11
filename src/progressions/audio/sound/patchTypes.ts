// src/progressions/audio/sound/patchTypes.ts
// Pure TS interfaces describing instrument patches. No Tone imports, no data.

export type OscillatorType =
  | "sine" | "triangle" | "square" | "sawtooth"
  | "fatsawtooth" | "fmsine" | "amtriangle" | "fatsine" | "fatsquare";

export interface EnvelopeSpec {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface BiquadSpec {
  type: "lowpass" | "highpass" | "bandpass";
  frequency: number;
  Q: number;
}

export interface FilterEnvelopeSpec extends EnvelopeSpec {
  baseFrequency: number;
  octaves: number;
}

/** EQ3 + optional saturation applied as a per-instrument insert (standard+). */
export interface InsertSpec {
  eq3?: { low: number; mid: number; high: number }; // dB
  saturation?: { kind: "chebyshev" | "distortion"; amount: number };
}

export interface BassPatch {
  id: string;
  label: string;
  oscillator: { type: OscillatorType };
  envelope: EnvelopeSpec;
  filter: { type: "lowpass"; Q: number };
  filterEnvelope: FilterEnvelopeSpec;
  volumeDb: number;
  insert?: InsertSpec;
}

/** Params for the PolySynth-based chord voice (piano / e-piano). The chord
 *  layer is piano-only — synthesized guitar strums were dropped after multiple
 *  attempts (additive and Karplus-Strong) never read as a guitar. */
export interface PolyChordSpec {
  volume: number; // dB
  maxPolyphonyFloor: number;
  oscillator: { type: "custom"; partials: number[] };
  envelope: EnvelopeSpec;
  releaseTailSec: number;
  sustainedDurationSec: number;
  shortDurationSec: number;
}

export interface ChordPatch {
  id: string;
  label: string;
  poly: PolyChordSpec;
  insert?: InsertSpec;
}

export interface DrumVoiceParams {
  // Partial overrides per drum voice; merged over the engine defaults.
  kick?: { pitchDecay?: number; octaves?: number; envelope?: Partial<EnvelopeSpec> };
  snare?: { noiseType?: "white" | "pink"; envelope?: Partial<EnvelopeSpec>; volume?: number };
  hihat?: { decay?: number; resonance?: number; octaves?: number };
  openHat?: { decay?: number };
  ride?: { decay?: number; harmonicity?: number; resonance?: number; volume?: number };
  crossStick?: { pitchDecay?: number; octaves?: number; envelope?: Partial<EnvelopeSpec> };
}

export interface DrumKitPatch {
  id: string;
  label: string;
  voices: DrumVoiceParams;
  insert?: InsertSpec;
}
