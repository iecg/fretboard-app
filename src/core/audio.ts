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
import { markAudioActivity, registerAudioContext } from "./audioIdleSuspend";
import { probeOutputHealth } from "./audioOutputHealth";

const AUDIO_CONFIG = {
  /** Master volume in linear gain (matches prior MASTER_GAIN = 0.5). */
  MASTER_GAIN: 0.5,

  /** Quick attack, fast decay for percussive picked-note feel. */
  ATTACK_TIME: 0.006,
  DECAY_TIME: 0.55,
  SUSTAIN: 0.02,
  RELEASE_TIME: 0.3,

  /** Single-note duration handed to triggerAttackRelease (seconds). */
  NOTE_DURATION: 0.5,

  /** Filter set high enough to be transparent — strum voice has none. */
  FILTER_FREQ: 10000,
  FILTER_Q: 0.1,

  /** Glide time when ramping master volume to/from mute (seconds). */
  MUTE_TRANSITION_TIME: 0.02,

  /**
   * Hard cap on concurrent voices. The prior hand-rolled impl ran a
   * pool of 8 with up to 4 temp voices only when the pool was exhausted;
   * PolySynth treats this as a flat ceiling above which it throws.
   */
  MAX_POLYPHONY: 12,
} as const;

/** Single source of truth for the "audio blocked" toast copy. */
const AUDIO_BLOCKED_MESSAGE =
  "Audio could not be started. Try tapping the screen or interacting with the page.";

/** Linear gain -> decibels; -Infinity for fully muted. */
function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/**
 * True once the underlying AudioContext has advanced past "suspended" —
 * i.e. a real user gesture has unlocked audio. Calling Tone.start() before
 * that point rejects on Safari/iOS (which surfaces an "audio blocked"
 * toast on plain page load), so callers like setMute(false) that fire on
 * mount must defer their resume until this returns true.
 *
 * The dedicated gesture handler in App.tsx still calls resume() directly
 * from a real `click` / `touchstart` and bypasses this gate, so first
 * audio still arrives the moment the user interacts.
 */
function audioContextUnlocked(): boolean {
  try {
    return Tone.getContext().state !== "suspended";
  } catch {
    // jsdom / no-AudioContext environments — treat as not unlocked so
    // we never accidentally fire Tone.start() in tests.
    return false;
  }
}

class GuitarSynth {
  private polySynth: Tone.PolySynth<Tone.Synth> | null = null;
  private filter: Tone.Filter | null = null;
  private volume: Tone.Volume | null = null;
  private isMuted = false;
  private unsupported = false;
  private wedgeProbeInFlight = false;
  onError?: (message: string) => void;
  /** Called when a played note reveals the Safari dead-output wedge. */
  onOutputWedged?: () => void;

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

      // Custom partials match the strum voice for a warmer guitar-like
      // timbre. Tone's "custom" partials omit the DC (index 0).
      this.polySynth = new Tone.PolySynth({
        voice: Tone.Synth,
        maxPolyphony: AUDIO_CONFIG.MAX_POLYPHONY,
        options: {
          oscillator: {
            type: "custom",
            partials: [1, 0.8, 0.45, 0.22, 0.12, 0.05],
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
      this.onError?.(AUDIO_BLOCKED_MESSAGE);
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
    // Unmute is *usually* a user gesture, but this effect also fires on
    // initial mount (isMutedAtom defaults to false). Skip the opportunistic
    // resume when the AudioContext hasn't been unlocked yet — otherwise
    // Tone.start() rejects on Safari/iOS without a gesture and fires the
    // "audio blocked" toast on every fresh page load. App.tsx's dedicated
    // pointerdown handler still performs the real first-gesture resume.
    if (!mute && audioContextUnlocked()) {
      void this.resume();
    }
  }

  async playNote(frequency: number): Promise<void> {
    if (this.isMuted) return;
    this.init();
    if (this.unsupported || !this.polySynth) return;

    try {
      // ensureToneStarted() resumes/starts the LIVE Tone context (which may
      // have been swapped via Tone.setContext when the progression engine
      // bound its own context). Never cache a context reference for resume —
      // a stale/orphaned context sits "suspended" forever and awaiting its
      // resume on every note added a fixed per-note latency.
      await ensureToneStarted();
    } catch (e) {
      console.warn("Tone.start failed in playNote:", e);
      this.onError?.(AUDIO_BLOCKED_MESSAGE);
      return;
    }

    // Track whichever context is live right now for energy idle-suspend.
    // Tagged "guitar"; if the progression engine already owns this (shared)
    // context the "progression" role sticks — see registerAudioContext.
    registerAudioContext(Tone.getContext().rawContext as AudioContext, "guitar");
    markAudioActivity();
    try {
      // Schedule at the context's immediate() time (== currentTime), NOT the
      // default Tone.now() which adds the context lookAhead (0.1s). For a
      // tap-to-play instrument that 100ms is an audible per-note delay; the
      // progression sequencer keeps the lookAhead for glitch-free scheduling.
      // Schedule at THIS synth's own context time, not Tone.now() (which adds
      // the 0.1s lookAhead → audible per-tap delay) and not
      // Tone.getContext().immediate() (the GLOBAL context — after a progression
      // calls Tone.setContext() the synth is orphaned on its original context,
      // so the global clock is the wrong timeline and notes schedule in the
      // synth's past → silence). `polySynth.immediate()` is its own currentTime.
      this.polySynth.triggerAttackRelease(
        frequency,
        AUDIO_CONFIG.NOTE_DURATION,
        this.polySynth.immediate(),
      );
      this.checkOutputAfterPlay();
    } catch (e) {
      // PolySynth throws if maxPolyphony is exceeded; swallow and log
      // rather than surfacing — same UX as the old "skipping note" warn.
      console.warn("GuitarSynth.playNote failed:", e);
    }
  }

  /**
   * After a note is triggered, verify it actually reached the hardware. On
   * Safari the context can report "running" while output is dead (see
   * audioOutputHealth). Fire-and-forget, de-duped so rapid taps run one probe.
   */
  private checkOutputAfterPlay(): void {
    if (this.wedgeProbeInFlight || !this.onOutputWedged) return;
    this.wedgeProbeInFlight = true;
    void probeOutputHealth()
      .then((health) => {
        if (health === "wedged") this.onOutputWedged?.();
      })
      .catch(() => {})
      .finally(() => {
        this.wedgeProbeInFlight = false;
      });
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
    wedgeProbeInFlight: boolean;
    onError: undefined;
    onOutputWedged: undefined;
  };
  s.polySynth = null;
  s.filter = null;
  s.volume = null;
  s.isMuted = false;
  s.unsupported = false;
  s.wedgeProbeInFlight = false;
  s.onError = undefined;
  s.onOutputWedged = undefined;
}
