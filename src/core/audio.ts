/**
 * GuitarSynth: Tone.js-backed polyphonic synth for guitar-like plucks.
 *
 * Replaces the previous hand-rolled Web Audio implementation. Tone.PolySynth
 * handles voice allocation, while custom partials + envelope + a lowpass
 * Filter approximate the old plucked-string flavor.
 *
 * Public API (preserved verbatim from the prior implementation so callers
 * — App.tsx, Fretboard.tsx, useResetConfirmation.ts — keep working):
 *   - init(): void
 *   - resume(): Promise<void>
 *   - setMute(mute: boolean): void
 *   - playNote(frequency: number): Promise<void>
 *   - onError?: (message: string) => void
 */
import * as Tone from "tone";

import { ensureToneStarted } from "./toneInit";

const AUDIO_CONFIG = {
  /** Master volume in linear gain (matches prior MASTER_GAIN = 0.5). */
  MASTER_GAIN: 0.5,

  /** Envelope shaped to approximate the prior decay characteristic. */
  ATTACK_TIME: 0.005,
  DECAY_TIME: 0.4,
  SUSTAIN: 0.0,
  RELEASE_TIME: 1.0,

  /** Single-note duration handed to triggerAttackRelease (seconds). */
  NOTE_DURATION: 1.5,

  /** Lowpass filter that adds the "muted" plucked-string color. */
  FILTER_FREQ: 2400,
  FILTER_Q: 0.8,

  /** Glide time when ramping master volume to/from mute (seconds). */
  MUTE_TRANSITION_TIME: 0.02,

  /** Polyphony cap roughly matching prior pool(8) + temp(4). */
  MAX_POLYPHONY: 12,
} as const;

/** Linear gain -> decibels; -Infinity for fully muted. */
function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

class GuitarSynth {
  private polySynth: Tone.PolySynth<Tone.Synth> | null = null;
  private filter: Tone.Filter | null = null;
  private volume: Tone.Volume | null = null;
  private isMuted = false;
  private unsupported = false;
  onError?: (message: string) => void;

  init(): void {
    if (this.unsupported || this.polySynth) return;

    try {
      // Master volume node — ramped to mute/unmute.
      this.volume = new Tone.Volume(gainToDb(AUDIO_CONFIG.MASTER_GAIN)).toDestination();

      // Lowpass filter approximates the prior dynamic filter-sweep color.
      // A fixed cutoff is a deliberate simplification: the old impl swept
      // the filter per-note for damping, but PolySynth voices are shared,
      // so we trade that motion for predictability.
      this.filter = new Tone.Filter({
        type: "lowpass",
        frequency: AUDIO_CONFIG.FILTER_FREQ,
        Q: AUDIO_CONFIG.FILTER_Q,
      }).connect(this.volume);

      // Custom partials roughly match the prior PeriodicWave harmonics
      // [0, 1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06]. Tone's "custom" partials
      // omit the DC (index 0) — pass the remainder.
      this.polySynth = new Tone.PolySynth({
        voice: Tone.Synth,
        maxPolyphony: AUDIO_CONFIG.MAX_POLYPHONY,
        options: {
          oscillator: {
            type: "custom",
            partials: [1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06],
          },
          envelope: {
            attack: AUDIO_CONFIG.ATTACK_TIME,
            decay: AUDIO_CONFIG.DECAY_TIME,
            sustain: AUDIO_CONFIG.SUSTAIN,
            release: AUDIO_CONFIG.RELEASE_TIME,
          },
        },
      }).connect(this.filter);
    } catch (e) {
      this.unsupported = true;
      this.polySynth = null;
      this.filter = null;
      this.volume = null;
      console.warn("GuitarSynth init failed:", e);
    }
  }

  async resume(): Promise<void> {
    this.init();
    if (this.unsupported) return;
    try {
      await ensureToneStarted();
    } catch (e) {
      console.warn("Tone.start failed:", e);
      this.onError?.(
        "Audio could not be started. Try tapping the screen or interacting with the page.",
      );
    }
  }

  setMute(mute: boolean): void {
    this.isMuted = mute;
    if (this.volume) {
      const targetDb = mute ? -Infinity : gainToDb(AUDIO_CONFIG.MASTER_GAIN);
      // rampTo gives a click-free transition equivalent to the old
      // setTargetAtTime smoothing.
      this.volume.volume.rampTo(targetDb, AUDIO_CONFIG.MUTE_TRANSITION_TIME);
    }
    // Toggling mute is a user gesture; opportunistically start the context.
    if (!mute) {
      void this.resume();
    }
  }

  async playNote(frequency: number): Promise<void> {
    if (this.isMuted) return;
    this.init();
    if (this.unsupported || !this.polySynth) return;

    try {
      await ensureToneStarted();
    } catch (e) {
      console.warn("Tone.start failed in playNote:", e);
      this.onError?.(
        "Audio could not be started. Try tapping the screen or interacting with the page.",
      );
      return;
    }

    try {
      this.polySynth.triggerAttackRelease(frequency, AUDIO_CONFIG.NOTE_DURATION);
    } catch (e) {
      // PolySynth throws if maxPolyphony is exceeded; swallow and log
      // rather than surfacing — same UX as the old "skipping note" warn.
      console.warn("GuitarSynth.playNote failed:", e);
    }
  }
}

export const synth = new GuitarSynth();

/**
 * Test-only hook: reset internal state on the singleton so tests can
 * re-exercise init/playNote/setMute paths. Not part of the public runtime
 * API.
 */
export function __resetSynthForTests(): void {
  const s = synth as unknown as {
    polySynth: unknown;
    filter: unknown;
    volume: unknown;
    isMuted: boolean;
    unsupported: boolean;
    onError: undefined;
  };
  s.polySynth = null;
  s.filter = null;
  s.volume = null;
  s.isMuted = false;
  s.unsupported = false;
  s.onError = undefined;
}
