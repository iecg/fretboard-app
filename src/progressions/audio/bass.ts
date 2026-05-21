/**
 * Bass voice for the progression backing track. Sawtooth oscillator with a
 * lowpass filter envelope (1200 Hz cutoff) and a percussive amplitude
 * envelope. Implemented on Tone.MonoSynth, which gives us per-voice filter
 * motion for free — the prior raw-Web-Audio version did the same with a
 * manual BiquadFilter.
 */
import * as Tone from "tone";

const ATTACK = 0.005;
const DECAY = 0.4;
const RELEASE = 0.25;
const FILTER_CUTOFF_HZ = 1200;
const FILTER_Q = 2;
// Match the metronome's cancel-tail dispose-deferral window. Slightly longer
// than the metronome because the bass envelope's release is ~250 ms.
const DISPOSE_TAIL_MS = 50;

export interface BassNoteOptions {
  velocity?: number;
  /** Custom note length in seconds (clamps to 0.05–2.0). */
  durationSec?: number;
}

export interface BassVoiceHandle {
  cancel: () => void;
}

/**
 * Schedule a single bass note. Returns a handle that can be cancelled on
 * chord change so the next bass note does not bleed into the previous one.
 */
export function scheduleBassNote(
  dest: AudioNode,
  frequency: number,
  time: number,
  options: BassNoteOptions = {},
): BassVoiceHandle {
  const velocity = Math.max(0, Math.min(1.2, options.velocity ?? 0.9));
  // Tone.js voices treat velocity=0 as a still-allocated voice; skip
  // scheduling entirely — silent bass notes have no audible effect and
  // consume no resources.
  if (velocity <= 0) {
    return { cancel: () => {} };
  }
  const noteLen = Math.max(0.05, Math.min(2, options.durationSec ?? DECAY + RELEASE));

  const synth = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: ATTACK, decay: DECAY, sustain: 0, release: RELEASE },
    filter: { Q: FILTER_Q, type: "lowpass" },
    filterEnvelope: {
      attack: ATTACK,
      decay: DECAY,
      sustain: 0,
      release: RELEASE,
      baseFrequency: FILTER_CUTOFF_HZ,
      octaves: 0,
    },
  });
  // Route through the progression bus so silenceProgressionBus() mutes the
  // bass along with the rest of the backing track.
  synth.connect(dest);
  synth.triggerAttackRelease(frequency, noteLen, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      // Same release-tail pattern as metronome.ts: close the envelope
      // explicitly, then defer dispose so the tail doesn't get truncated.
      // Calling synth.dispose() while the voice is mid-decay would cut the
      // tail abruptly and produce an audible click.
      try {
        synth.triggerRelease(Tone.now());
        setTimeout(() => {
          try {
            synth.dispose();
          } catch {
            /* already disposed */
          }
        }, DISPOSE_TAIL_MS);
      } catch {
        try {
          synth.dispose();
        } catch {
          /* already disposed */
        }
      }
    },
  };
}
