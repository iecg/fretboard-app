/**
 * GuitarSynth: a small raw-Web-Audio plucked-string voice on its OWN
 * AudioContext.
 *
 * The guitar is a fire-and-forget, tap-to-play instrument. It deliberately does
 * NOT use Tone.js: Tone is a sequencing/transport framework whose single global
 * context the progression engine rebinds via Tone.setContext(), which would
 * orphan a Tone-based guitar on a stale context. Owning a private AudioContext
 * keeps the guitar completely decoupled from the progression — there is no
 * shared global to fight over.
 *
 * Signal graph:
 *   [per-note] OscillatorNode(periodicWave) -> GainNode(ADSR envelope)
 *                                                 |
 *   [shared]   ------------------------------------+--> BiquadFilter(lowpass)
 *                                                        -> GainNode(master) -> destination
 *
 * Public API (preserved verbatim so callers — lazyGuitarAudio.ts, App.tsx —
 * keep working):
 *   - init(): void
 *   - resume(): Promise<void>
 *   - setMute(mute: boolean): void
 *   - playNote(frequency: number): Promise<void>
 *   - onError?: (message: string) => void
 *   - onOutputWedged?: () => void
 */
import { markAudioActivity, registerAudioContext } from "./audioIdleSuspend";
import { probeOutputHealth } from "./audioOutputHealth";

const AUDIO_CONFIG = {
  /** Master volume in linear gain. */
  MASTER_GAIN: 0.5,

  /** Quick attack, fast decay for percussive picked-note feel. */
  ATTACK_TIME: 0.006,
  DECAY_TIME: 0.55,
  SUSTAIN: 0.02,
  RELEASE_TIME: 0.3,

  /** Single-note duration before the release stage begins (seconds). */
  NOTE_DURATION: 0.5,

  /** Lowpass filter — high enough to stay transparent. */
  FILTER_FREQ: 10000,
  FILTER_Q: 0.1,

  /** Glide time when ramping master volume to/from mute (seconds). */
  MUTE_TRANSITION_TIME: 0.02,

  /** Hard cap on concurrent voices. */
  MAX_POLYPHONY: 12,
} as const;

/**
 * Sine-harmonic amplitudes of the plucked-string timbre. Index i is the
 * (i+1)th harmonic; element 0 of the periodic-wave imag array is the DC term
 * and stays 0. Matches the prior Tone "custom" oscillator partials exactly.
 */
const PARTIALS = [1, 0.8, 0.45, 0.22, 0.12, 0.05] as const;

/** Smallest gain value usable as an exponential-ramp target (0 is illegal). */
const NEAR_ZERO = 0.0001;

/** Single source of truth for the "audio blocked" toast copy. */
const AUDIO_BLOCKED_MESSAGE =
  "Audio could not be started. Try tapping the screen or interacting with the page.";

function getAudioContextConstructor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

class GuitarSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private wave: PeriodicWave | null = null;
  private activeVoices = 0;
  private isMuted = false;
  private unsupported = false;
  private wedgeProbeInFlight = false;
  onError?: (message: string) => void;
  /** Called when a played note reveals the Safari dead-output wedge. */
  onOutputWedged?: () => void;

  init(): void {
    if (this.unsupported || this.ctx) return;

    const Ctor = getAudioContextConstructor();
    if (!Ctor) {
      this.unsupported = true;
      return;
    }

    try {
      this.ctx = new Ctor();

      // Master volume — ramped to mute/unmute — straight to destination.
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : AUDIO_CONFIG.MASTER_GAIN;
      this.masterGain.connect(this.ctx.destination);

      // Fixed lowpass; a deliberate simplification of the old per-note sweep.
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = AUDIO_CONFIG.FILTER_FREQ;
      this.filter.Q.value = AUDIO_CONFIG.FILTER_Q;
      this.filter.connect(this.masterGain);

      // Additive partials baked into one PeriodicWave reused by every voice.
      // Using number[] (not Float32Array) preserves float64 precision so that
      // the values round-trip exactly through the fake in tests and match the
      // PARTIALS constants without float32 rounding noise.
      const imag: number[] = [0, ...PARTIALS];
      const real: number[] = new Array(imag.length).fill(0);
      this.wave = this.ctx.createPeriodicWave(real, imag);

      // Track this context for energy idle-suspend (own key; role "guitar").
      registerAudioContext(this.ctx, "guitar");
    } catch (e) {
      this.unsupported = true;
      this.ctx = null;
      this.masterGain = null;
      this.filter = null;
      this.wave = null;
      console.warn("GuitarSynth init failed:", e);
    }
  }

  async resume(): Promise<void> {
    this.init();
    if (this.unsupported || !this.ctx) return;
    try {
      if (this.ctx.state !== "running") await this.ctx.resume();
    } catch (e) {
      console.warn("Guitar context resume failed:", e);
      this.onError?.(AUDIO_BLOCKED_MESSAGE);
    }
  }

  setMute(mute: boolean): void {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      const target = mute ? 0 : AUDIO_CONFIG.MASTER_GAIN;
      const now = this.ctx.currentTime;
      // Click-free transition equivalent to the old rampTo smoothing.
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(target, now + AUDIO_CONFIG.MUTE_TRANSITION_TIME);
    }
    // Unmute is *usually* a user gesture, but this effect also fires on initial
    // mount (isMutedAtom defaults to false). Skip the opportunistic resume when
    // the context hasn't been unlocked yet — otherwise resume() runs without a
    // gesture and Safari/iOS rejects it. App.tsx's pointerdown handler performs
    // the real first-gesture resume.
    if (!mute && this.contextUnlocked()) {
      void this.resume();
    }
  }

  private contextUnlocked(): boolean {
    return this.ctx != null && this.ctx.state !== "suspended";
  }

  async playNote(frequency: number): Promise<void> {
    if (this.isMuted) return;
    this.init();
    if (this.unsupported || !this.ctx || !this.masterGain || !this.filter || !this.wave) return;

    // Returning from idle-suspend: resume our OWN context. Active tapping keeps
    // it running (markAudioActivity reschedules the idle timer), so this only
    // pays latency on the first tap after a long idle.
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn("Guitar context resume failed in playNote:", e);
        this.onError?.(AUDIO_BLOCKED_MESSAGE);
        return;
      }
    }

    markAudioActivity();

    if (this.activeVoices >= AUDIO_CONFIG.MAX_POLYPHONY) {
      // Matches the old PolySynth-throws-and-we-swallow behavior.
      console.warn("GuitarSynth.playNote skipped: max polyphony reached");
      return;
    }

    try {
      const { ATTACK_TIME, DECAY_TIME, SUSTAIN, RELEASE_TIME, NOTE_DURATION } = AUDIO_CONFIG;
      // Schedule from currentTime — zero lookahead, so a tap sounds instantly.
      const t0 = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      osc.setPeriodicWave(this.wave);
      osc.frequency.setValueAtTime(frequency, t0);

      const env = this.ctx.createGain();
      // ADSR: attack → decay-to-sustain → release tail. Exponential ramps need
      // a strictly-positive target, hence NEAR_ZERO.
      env.gain.setValueAtTime(NEAR_ZERO, t0);
      env.gain.linearRampToValueAtTime(1, t0 + ATTACK_TIME);
      env.gain.exponentialRampToValueAtTime(
        Math.max(SUSTAIN, NEAR_ZERO),
        t0 + ATTACK_TIME + DECAY_TIME,
      );
      const releaseEnd = t0 + NOTE_DURATION + RELEASE_TIME;
      env.gain.exponentialRampToValueAtTime(NEAR_ZERO, releaseEnd);
      env.gain.setValueAtTime(0, releaseEnd + 0.001);

      osc.connect(env);
      env.connect(this.filter);

      const stopAt = releaseEnd + 0.02;
      osc.start(t0);
      osc.stop(stopAt);

      this.activeVoices += 1;
      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        try {
          osc.disconnect();
        } catch {
          /* already disconnected */
        }
        try {
          env.disconnect();
        } catch {
          /* already disconnected */
        }
      };

      this.checkOutputAfterPlay();
    } catch (e) {
      console.warn("GuitarSynth.playNote failed:", e);
    }
  }

  /**
   * After a note is triggered, verify it actually reached the hardware. On
   * Safari the context can report "running" while output is dead (see
   * audioOutputHealth). Fire-and-forget, de-duped so rapid taps run one probe.
   * Probes THIS synth's own context.
   */
  private checkOutputAfterPlay(): void {
    if (this.wedgeProbeInFlight || !this.onOutputWedged || !this.ctx) return;
    this.wedgeProbeInFlight = true;
    void probeOutputHealth(this.ctx)
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
 * re-exercise init/playNote/setMute paths. Not part of the public runtime API.
 */
export function __resetSynthForTests(): void {
  const s = synth as unknown as {
    ctx: unknown;
    masterGain: unknown;
    filter: unknown;
    wave: unknown;
    activeVoices: number;
    isMuted: boolean;
    unsupported: boolean;
    wedgeProbeInFlight: boolean;
    onError: undefined;
    onOutputWedged: undefined;
  };
  s.ctx = null;
  s.masterGain = null;
  s.filter = null;
  s.wave = null;
  s.activeVoices = 0;
  s.isMuted = false;
  s.unsupported = false;
  s.wedgeProbeInFlight = false;
  s.onError = undefined;
  s.onOutputWedged = undefined;
}
