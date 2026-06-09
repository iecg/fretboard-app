# Separate Audio Contexts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the guitar synth off Tone's shared global `AudioContext` onto its own dedicated raw-Web-Audio context, fully decoupled from the progression engine.

**Architecture:** The progression keeps Tone.js and the global context (it needs `Transport`/`Draw`/sequencer clock-sync). The guitar is reimplemented as a small raw-Web-Audio voice engine on a private `AudioContext` it owns — `Tone.setContext()` can never touch it, so the orphaning, per-tap lookahead delay, and post-progression silence cannot recur. `audio.ts`'s public API (`init`/`resume`/`setMute`/`playNote`/`onError`/`onOutputWedged`) stays byte-identical, so every caller is untouched.

**Tech Stack:** TypeScript, Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, `PeriodicWave`), Vitest, Jotai. Source spec: `docs/superpowers/specs/2026-06-09-separate-audio-contexts-design.md`.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/core/audio.ts` | The guitar synth — now raw Web Audio on its own context | Rewrite internals; public API unchanged |
| `src/core/audio.test.ts` | Guitar synth unit tests | Rewrite (drop Tone mocks; add fake `AudioContext`) |
| `src/core/audioOutputHealth.ts` | Safari dead-output wedge probe | Add optional `ctx` param |
| `src/core/audioOutputHealth.test.ts` | Wedge probe tests | Add explicit-ctx case |
| `src/core/audioIdleSuspend.ts` | Energy idle-suspend registry | Delete the "sticky progression role" branch |
| `src/core/audioIdleSuspend.test.ts` | Idle-suspend tests | Remove the now-obsolete sticky test |

Unchanged: `src/progressions/audio/bus.ts`, `toneBus.ts`, `src/core/toneInit.ts`, `src/store/audioAtoms.ts`, `src/App.tsx`, `src/core/lazyGuitarAudio.ts`.

---

## Task 1: `probeOutputHealth` accepts an explicit context

So the guitar can probe its **own** output rather than only the Tone global. Backward-compatible: no arg → current behavior (Tone global).

**Files:**
- Modify: `src/core/audioOutputHealth.ts:66-93`
- Test: `src/core/audioOutputHealth.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe("probeOutputHealth", ...)` block in `src/core/audioOutputHealth.test.ts`, after the existing tests (before the closing `});`):

```ts
  it("probes an explicitly-passed context instead of the Tone global", async () => {
    // A standalone context whose hardware clock is frozen while currentTime
    // advances → wedged. The Tone-global mock (h.*) stays healthy, proving the
    // explicit arg is what's used.
    let ct = 0;
    const explicitCtx = {
      state: "running" as AudioContextState,
      get currentTime() {
        return ct;
      },
      getOutputTimestamp: () => ({ contextTime: 0 }),
    } as unknown as AudioContext;

    const p = probeOutputHealth(explicitCtx);
    ct = 0.25; // currentTime advanced; contextTime stayed 0
    await vi.advanceTimersByTimeAsync(300);
    expect(await p).toBe("wedged");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/core/audioOutputHealth.test.ts -t "probes an explicitly-passed context"`
Expected: FAIL — `probeOutputHealth` currently ignores any argument and reads the Tone-global mock (returns `"healthy"`), so the `toBe("wedged")` assertion fails.

- [ ] **Step 3: Add the optional parameter**

Replace the function signature and its first line in `src/core/audioOutputHealth.ts`. Change:

```ts
export async function probeOutputHealth(): Promise<OutputHealth> {
  const ctx = getLiveRawContext();
```

to:

```ts
export async function probeOutputHealth(explicitCtx?: AudioContext): Promise<OutputHealth> {
  const ctx = explicitCtx ?? getLiveRawContext();
```

Leave the rest of the function body unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/core/audioOutputHealth.test.ts`
Expected: PASS — all 7 tests (6 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add src/core/audioOutputHealth.ts src/core/audioOutputHealth.test.ts
git commit -m "refactor(audio): let probeOutputHealth target an explicit context"
```

---

## Task 2: Drop the "sticky progression role" hack from idle-suspend

With the guitar on its own context, the guitar and progression are **distinct map keys** — role collision on one shared key is impossible, so the sticky workaround is dead code. Removing it makes `registerAudioContext` a plain `set`.

**Files:**
- Modify: `src/core/audioIdleSuspend.ts:27-34`
- Test: `src/core/audioIdleSuspend.test.ts:147-155` (remove)

- [ ] **Step 1: Remove the obsolete sticky test**

Delete this entire test from `src/core/audioIdleSuspend.test.ts` (lines 147–155):

```ts
    it("keeps the progression role sticky — guitar re-registration cannot downgrade it", () => {
      // The shared AudioContext: progression tags it first, then a fret tap
      // re-registers the same object as "guitar". The progression-scoped check
      // must still recognize it.
      const shared = makeMockContext("suspended");
      registerAudioContext(shared, "progression");
      registerAudioContext(shared, "guitar");
      expect(isContextSuspended("progression")).toBe(true);
    });
```

Keep the `"upgrades a guitar context to progression when re-registered"` test directly above it — that behavior (a plain re-`set` upgrades the role) still holds.

- [ ] **Step 2: Run the suite to confirm the sticky test is the only failure source after the code change**

(Sequencing note: we remove the test first so the suite reflects the new contract; the code change in Step 3 makes it green.)

Run: `pnpm exec vitest run src/core/audioIdleSuspend.test.ts`
Expected: PASS currently (sticky behavior still present in code, but its test is gone). This confirms removing the test didn't break the others.

- [ ] **Step 3: Simplify `registerAudioContext`**

In `src/core/audioIdleSuspend.ts`, replace the whole function (lines 27–34):

```ts
export function registerAudioContext(ctx: AudioContext, role?: AudioContextRole): void {
  // The guitar synth and the progression engine share one AudioContext once
  // Tone is rebound (Tone.setContext). "progression" is sticky so a later
  // guitar registration of that shared context can't downgrade the role and
  // break the progression-scoped suspended check. Both still get suspended.
  if (contexts.get(ctx) === "progression") return;
  contexts.set(ctx, role);
}
```

with:

```ts
export function registerAudioContext(ctx: AudioContext, role?: AudioContextRole): void {
  // The guitar and the progression each own a SEPARATE AudioContext, so they are
  // distinct map keys — no role collision to guard against. A later call with the
  // same key simply updates (e.g. upgrades) the role.
  contexts.set(ctx, role);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/core/audioIdleSuspend.test.ts`
Expected: PASS — including `"upgrades a guitar context to progression when re-registered"`.

- [ ] **Step 5: Commit**

```bash
git add src/core/audioIdleSuspend.ts src/core/audioIdleSuspend.test.ts
git commit -m "refactor(audio): drop sticky-role hack now contexts are separate"
```

---

## Task 3: Rewrite the guitar synth as a raw-Web-Audio engine

The core change. Replace the Tone-backed internals of `GuitarSynth` with a private `AudioContext` + shared `masterGain`/`filter`/`wave` + per-tap oscillator voices. Public API preserved.

**Files:**
- Rewrite: `src/core/audio.ts`
- Rewrite: `src/core/audio.test.ts`

- [ ] **Step 1: Replace the test file with the raw-Web-Audio test suite**

Overwrite `src/core/audio.test.ts` entirely with:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

// audio.ts no longer uses Tone — it owns a raw AudioContext. Mock the two side
// modules so unit tests stay synchronous and timer-free, and install a fake
// Web Audio API on window (jsdom has none).
vi.mock("./audioIdleSuspend", () => ({
  registerAudioContext: vi.fn(),
  markAudioActivity: vi.fn(),
}));
vi.mock("./audioOutputHealth", () => ({
  probeOutputHealth: vi.fn().mockResolvedValue("healthy"),
}));

class FakeAudioParam {
  value = 0;
  setValueAtTime = vi.fn((v: number) => {
    this.value = v;
    return this;
  });
  linearRampToValueAtTime = vi.fn((v: number) => {
    this.value = v;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((v: number) => {
    this.value = v;
    return this;
  });
  cancelScheduledValues = vi.fn(() => this);
}

const created: { gains: any[]; filters: any[]; oscillators: any[] } = {
  gains: [],
  filters: [],
  oscillators: [],
};
let lastPeriodicWave: { real: Float32Array; imag: Float32Array } | null = null;

class FakeGain {
  gain = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeFilter {
  type = "";
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeOscillator {
  frequency = new FakeAudioParam();
  setPeriodicWave = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}
class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createGain = vi.fn(() => {
    const g = new FakeGain();
    created.gains.push(g);
    return g;
  });
  createBiquadFilter = vi.fn(() => {
    const f = new FakeFilter();
    created.filters.push(f);
    return f;
  });
  createOscillator = vi.fn(() => {
    const o = new FakeOscillator();
    created.oscillators.push(o);
    return o;
  });
  createPeriodicWave = vi.fn((real: Float32Array, imag: Float32Array) => {
    lastPeriodicWave = { real, imag };
    return { real, imag } as unknown as PeriodicWave;
  });
}

let ctorState: AudioContextState = "running";
let resumeRejects = false;

import { __resetSynthForTests, synth } from "./audio";

beforeEach(() => {
  created.gains.length = 0;
  created.filters.length = 0;
  created.oscillators.length = 0;
  lastPeriodicWave = null;
  ctorState = "running";
  resumeRejects = false;

  (window as any).AudioContext = vi.fn(function FakeCtor() {
    const ctx = new FakeAudioContext();
    ctx.state = ctorState;
    if (resumeRejects) {
      ctx.resume = vi.fn(async () => {
        throw new Error("blocked");
      });
    }
    return ctx;
  });
  (window as any).webkitAudioContext = undefined;

  __resetSynthForTests();
});

describe("GuitarSynth (raw Web Audio)", () => {
  describe("init", () => {
    it("builds master gain, lowpass filter, and the partials periodic wave", () => {
      synth.init();
      // master gain → destination; filter → master gain.
      expect(created.gains.length).toBe(1);
      expect(created.filters.length).toBe(1);
      const filter = created.filters[0];
      expect(filter.type).toBe("lowpass");
      expect(filter.frequency.value).toBe(10000);
      expect(filter.Q.value).toBeCloseTo(0.1);
      // Periodic wave: DC term 0, then the six partials as sine (imag) coeffs.
      expect(lastPeriodicWave).not.toBeNull();
      expect(Array.from(lastPeriodicWave!.imag)).toEqual([0, 1, 0.8, 0.45, 0.22, 0.12, 0.05]);
      expect(Array.from(lastPeriodicWave!.real)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it("is idempotent on subsequent calls", () => {
      synth.init();
      synth.init();
      synth.init();
      expect(created.filters.length).toBe(1);
    });

    it("initializes master gain at 0.5 when unmuted", () => {
      synth.init();
      expect(created.gains[0].gain.value).toBeCloseTo(0.5);
    });
  });

  describe("playNote", () => {
    it("creates an oscillator with the periodic wave at the requested frequency", async () => {
      await synth.playNote(440);
      expect(created.oscillators.length).toBe(1);
      const osc = created.oscillators[0];
      expect(osc.setPeriodicWave).toHaveBeenCalledTimes(1);
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    });

    it("schedules the attack ramp to full amplitude (no lookahead — uses currentTime)", async () => {
      await synth.playNote(440);
      // The newest gain is the per-note envelope (gains[0] is master).
      const env = created.gains[created.gains.length - 1];
      // attack ramps to 1.0.
      expect(env.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it("auto-initializes if init() was not called first", async () => {
      await synth.playNote(110);
      expect(created.filters.length).toBe(1);
      expect(created.oscillators.length).toBe(1);
    });

    it("caps concurrent voices at 12 (skips beyond the cap)", async () => {
      // onended is never fired by the fake, so every voice stays "active".
      for (let i = 0; i < 12; i++) await synth.playNote(220);
      expect(created.oscillators.length).toBe(12);
      await synth.playNote(220); // 13th — skipped
      expect(created.oscillators.length).toBe(12);
    });

    it("frees a voice when its oscillator ends, allowing new notes", async () => {
      for (let i = 0; i < 12; i++) await synth.playNote(220);
      created.oscillators[0].onended?.(); // first voice finishes
      await synth.playNote(220);
      expect(created.oscillators.length).toBe(13);
    });

    it("resumes its own context before playing when not running", async () => {
      ctorState = "suspended";
      synth.init();
      const ctx = (synth as any).ctx as FakeAudioContext;
      await synth.playNote(440);
      expect(ctx.resume).toHaveBeenCalled();
      expect(created.oscillators.length).toBe(1);
    });

    it("invokes onError and plays nothing when resume rejects", async () => {
      ctorState = "suspended";
      resumeRejects = true;
      const onError = vi.fn();
      synth.onError = onError;

      await synth.playNote(330);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toMatch(/audio could not be started/i);
      expect(created.oscillators.length).toBe(0);
      synth.onError = undefined;
    });
  });

  describe("setMute", () => {
    it("ramps master gain to 0 on mute", () => {
      synth.init();
      const master = created.gains[0];
      master.gain.linearRampToValueAtTime.mockClear();
      synth.setMute(true);
      expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    });

    it("ramps master gain back to 0.5 on unmute", () => {
      synth.init();
      const master = created.gains[0];
      synth.setMute(true);
      master.gain.linearRampToValueAtTime.mockClear();
      synth.setMute(false);
      expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
    });

    it("suppresses playNote while muted", async () => {
      synth.init();
      synth.setMute(true);
      await synth.playNote(440);
      expect(created.oscillators.length).toBe(0);
    });

    it("does NOT resume when unmuting before a user gesture (context suspended)", () => {
      ctorState = "suspended";
      synth.init();
      const ctx = (synth as any).ctx as FakeAudioContext;
      synth.setMute(false);
      // The gesture-dependent resume is suppressed; the gain ramp still happens.
      expect(ctx.resume).not.toHaveBeenCalled();
      expect(created.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalled();
    });
  });

  describe("resume", () => {
    it("initializes lazily and resumes its own context", async () => {
      ctorState = "suspended";
      await synth.resume();
      const ctx = (synth as any).ctx as FakeAudioContext;
      expect(created.filters.length).toBe(1);
      expect(ctx.resume).toHaveBeenCalled();
    });

    it("forwards a resume failure via onError", async () => {
      ctorState = "suspended";
      resumeRejects = true;
      const onError = vi.fn();
      synth.onError = onError;
      await synth.resume();
      expect(onError).toHaveBeenCalledTimes(1);
      synth.onError = undefined;
    });
  });

  describe("graceful degradation", () => {
    it("marks itself unsupported when no AudioContext constructor exists", async () => {
      (window as any).AudioContext = undefined;
      (window as any).webkitAudioContext = undefined;
      __resetSynthForTests();

      synth.init();
      await synth.playNote(440);
      expect(created.oscillators.length).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm exec vitest run src/core/audio.test.ts`
Expected: FAIL — the current `audio.ts` still imports/mocks Tone and has no raw-Web-Audio engine; assertions like `lastPeriodicWave` and `created.oscillators` won't be satisfied.

- [ ] **Step 3: Rewrite `src/core/audio.ts`**

Overwrite `src/core/audio.ts` entirely with:

```ts
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
      const imag = new Float32Array([0, ...PARTIALS]);
      const real = new Float32Array(imag.length);
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
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `pnpm exec vitest run src/core/audio.test.ts`
Expected: PASS — all tests in the rewritten suite.

- [ ] **Step 5: Run the full audio-related suite to catch cross-module breakage**

Run: `pnpm exec vitest run src/core/audio.test.ts src/core/audioIdleSuspend.test.ts src/core/audioOutputHealth.test.ts src/App.test.tsx src/integration.test.tsx`
Expected: PASS. `App.test.tsx` and `integration.test.tsx` mock `./core/lazyGuitarAudio`, so they never load `audio.ts` and should be unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/core/audio.ts src/core/audio.test.ts
git commit -m "feat(audio): run the guitar synth on its own raw-Web-Audio context

The guitar no longer rides Tone's global context. Reimplemented as a small
raw-Web-Audio voice engine (oscillator + ADSR gain + lowpass) on a private
AudioContext, so Tone.setContext() from the progression engine can never orphan
it. Public API unchanged."
```

---

## Task 4: Full verification gate + manual timbre/recovery check

**Files:** none (verification only).

- [ ] **Step 1: Confirm no other module imports the removed Tone surface from `audio.ts`**

Run: `grep -rn "from \"\.\./core/audio\"\|from \"\./audio\"\|core/audio'" src --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v lazyGuitarAudio`
Expected: no matches (only `lazyGuitarAudio.ts` consumes `audio.ts`). If anything else appears, inspect it — the public API is unchanged so it should still compile, but verify.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: clean (one pre-existing unrelated warning in `useFretboardTopologyModel.ts` is acceptable; no new warnings in `src/core/audio*`).

- [ ] **Step 3: Full test suite**

Run: `pnpm run test`
Expected: all green (the suite was at 2557 passing before this work).

- [ ] **Step 4: Production build**

Run: `pnpm run build`
Expected: `tsc -b` + `vite build` succeed with no type errors.

- [ ] **Step 5: Manual verification in production preview (by ear — the decisive test)**

Run: `pnpm run preview:prod`, open the served URL, then verify:
  1. **Timbre A/B:** tap fretboard notes; compare against deployed v2.6.4. If the decay/release sounds off (Tone used exponential envelope curves), the ramp targets in `playNote` are the tuning point — confirm the exponential ramps match the deployed feel.
  2. **Core regression (the bug this fixes):** play a progression to the end (or stop it), then tap the fretboard → **guitar sound plays**. This is the post-progression silence that the context split eliminates.
  3. **Idle resume:** leave the tab idle > 30s (idle-suspend fires), then tap → first tap resumes the guitar context and plays.
  4. **Mute/unmute:** toggle mute; taps are silenced and restored without clicks.

- [ ] **Step 6: Remove any temporary instrumentation**

If any `console.log`/debug probes were added during tuning, remove them. Re-run `pnpm run lint && pnpm run test` to confirm still green.

- [ ] **Step 7: Final commit (only if Step 5 required envelope tuning or Step 6 removed instrumentation)**

```bash
git add src/core/audio.ts
git commit -m "fix(audio): tune guitar envelope curves to match v2.6.4 timbre"
```

(If no tuning or cleanup was needed, skip this commit.)

---

## Notes for the implementer

- **Why no `toneInit`/`Tone.start()` in the guitar path anymore:** the guitar owns its context and resumes it directly (`ctx.resume()`). `Tone.start()` resumes the *global* (progression) context — irrelevant to the guitar now. The progression keeps using `ensureToneStarted()` unchanged.
- **Voice cleanup depends on `onended`:** real browsers fire `OscillatorNode.onended` after `stop()`. The fake in the test never fires it automatically, which is why the polyphony-cap test can hold 12 live voices and the "frees a voice" test fires it manually.
- **Exponential ramps cannot target 0** — that is why `NEAR_ZERO` (0.0001) is used and a final `setValueAtTime(0, ...)` snaps to true silence.
- **`createPeriodicWave` normalization** is left at the browser default (enabled). `masterGain` (0.5) sets the operating level; adjust by ear in Task 4 Step 5 if needed.
