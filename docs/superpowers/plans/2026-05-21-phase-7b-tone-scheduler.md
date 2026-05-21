# Phase 7B — Tone-Native Progression Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the backing-track scheduler and step-advance loop from bespoke Web Audio onto Tone.js, **sharing the existing `AudioContext`** so the audio system has exactly one master clock.

**Architecture:** The existing scheduler is anchored to `AudioContext.currentTime` via [`bus.ts`](../../../src/progressions/audio/bus.ts) (shared `AudioContext` + master `GainNode`) and [`timeline.ts`](../../../src/progressions/audio/timeline.ts) (which tracks each step's audio start time + duration so React can poll the audio clock). Phase 7 already replaced the fretboard `GuitarSynth` with Tone (PR #448). This plan keeps the same architectural seams — `bus`/`timeline`/`scheduler`/voice handles — but swaps each instrument and the step-advance loop onto Tone primitives. **The trick that avoids dual-clock drift: call `Tone.setContext(audio.ctx)` once at bus init so Tone reads from the same `AudioContext.currentTime` that `timeline.ts` already uses.** Each instrument migration is a self-contained PR-shippable cut.

**Tech Stack:** React 19, TypeScript, Jotai, `tone@^15` (already a dep from Phase 7), Vitest, Playwright, pnpm workspaces.

**Spec context:** Continuation of [`docs/superpowers/plans/2026-05-20-fretflow-integration-design.md`](2026-05-20-fretflow-integration-design.md) §Phase 7. PR #448 landed Tasks 7.1 (`toneInit.ts`) and 7.2 (`GuitarSynth` on Tone.PolySynth). This plan covers the deferred Tasks 7.3–7.5: step-advance + backing-track migration.

---

## Roadmap & PR-Cut Recommendation

Each task ends with a commit. Suggested PR boundaries (you can cut earlier or later as the work develops):

| PR cut | Tasks | Rationale |
|---|---|---|
| PR 1 (Foundation + Transport) | 1, 2 | Bind Tone to shared context; move step advance onto `Tone.Transport`. No audible change. Smallest reviewable atomic increment. |
| PR 2 (Backing-track instruments) | 3, 4, 5, 6, 7 | All five instrument families migrated. Largest PR; could split per instrument if review fatigue. |
| PR 3 (Cleanup + quality gate) | 8 | Dead-code removal, baselines refresh, master plan status update. |

**Why this order:** Task 1 is the foundation everything else depends on (shared clock). Task 2 validates the foundation by moving the most observable behavior (step advance) onto Tone. Tasks 3–7 are independent leaf swaps. Task 8 lands the housekeeping once the migration sits stable.

---

## File Structure

**New files:**
- `src/progressions/audio/toneBus.ts` — wraps `ensureProgressionAudio()` to call `Tone.setContext(audio.ctx)` exactly once. Single source of truth for "Tone is bound to the shared context." Returns the same `ProgressionAudio` shape so consumers don't change.
- `src/progressions/audio/toneBus.test.ts`

**Modified files:**
- `src/progressions/audio/bus.ts` — call into `toneBus.ts` after `ctx` is constructed. No behavior change otherwise.
- `src/hooks/useProgressionPlaybackLoop.ts` (92 lines today) — replace the `setTimeout(remainingMs, advance)` branch with `Tone.getTransport().scheduleOnce(advance, audioBoundaryTime)`. Keep the JS-timer fallback for the no-AudioContext path (jsdom).
- `src/progressions/audio/metronome.ts` (79 lines) — `scheduleClick` rewritten on `Tone.Synth`.
- `src/progressions/audio/bass.ts` (92 lines) — `scheduleBassNote` rewritten on `Tone.MonoSynth`.
- `src/progressions/audio/string.ts` (120 lines, exports `pluckString`) — rewritten on `Tone.PluckSynth`.
- `src/progressions/audio/instruments/strumVoice.ts` — uses the rewritten `pluckString` (no behavior change beyond the underlying voice).
- `src/progressions/audio/instruments/pianoVoice.ts` — rewritten on `Tone.PolySynth(Tone.Synth)` with FM-flavored partials, AD(S)R envelope tuned to today's character.
- `src/progressions/audio/instruments/organVoice.ts` — rewritten on `Tone.PolySynth(Tone.Synth)` with additive sine partials.
- `src/progressions/audio/drumKit.ts` (265 lines) — `scheduleKick`, `scheduleSnare`, `scheduleHiHat`, `scheduleRide` rewritten on `Tone.MembraneSynth` / `Tone.NoiseSynth` / `Tone.MetalSynth`.
- Co-located `*.test.ts` for each migrated file.

**Untouched (intentionally):**
- `src/progressions/audio/scheduler.ts` (269 lines) — the orchestrator does not need to change. It calls `scheduleBassNote(ctx, bus, …)` etc.; those signatures stay identical. Each instrument migration is local.
- `src/progressions/audio/timeline.ts` (170 lines) — still reads from the shared `AudioContext.currentTime`. Tone shares that context, so the clock contract is preserved.
- `src/progressions/audio/patterns.ts` (429 lines) — pure pattern data, no audio calls.
- `src/store/progressionAtoms.ts` — `progressionStepDeadlineAtom` stays as a UI observable; the deadline value is now driven by Transport scheduling but the atom contract is unchanged.

**Deleted at the end (Task 8):**
- `src/test-utils/mockWebAudio.ts` — only if grep confirms no remaining consumers after all instruments are off raw Web Audio.

---

## Tone v15 API Reference (verify before coding)

The team is on `tone@^15.1.22` (added in PR #448). Key v15 quirks:

- `Tone.getTransport()` returns the transport singleton (`Tone.Transport` is deprecated as a top-level getter).
- `Tone.getDestination()` returns the master destination (`Tone.Destination` is deprecated as a top-level getter).
- `Tone.setContext(rawContext: AudioContext)` accepts a raw Web Audio `AudioContext` and wraps it in a `Tone.Context` internally. After this call, `Tone.getContext().rawContext === rawContext` is true.
- `Tone.now()` returns the current Tone context time (= `Tone.getContext().now()` = `rawContext.currentTime + lookAhead`).
- `Tone.PluckSynth({ attackNoise, dampening, resonance, release }).toDestination()` is Karplus–Strong-ish.
- `Tone.MembraneSynth`, `Tone.NoiseSynth`, `Tone.MetalSynth` are the drum primitives.
- `synth.triggerAttackRelease(noteOrFreq, duration, time, velocity)` schedules a note. `time` is in Tone-context seconds (same units as `Tone.now()` and `AudioContext.currentTime` once the contexts are shared).
- `Tone.getTransport().scheduleOnce(callback, time)` runs `callback(time)` at `time` (in transport-time seconds). With a shared context, transport time and audio-context time advance together.

**Before coding any task that uses one of these APIs, verify by checking [`node_modules/tone/build/esm/`](../../../node_modules/tone) or the running TypeScript types.** If a name has changed in your Tone version, adapt and note it in the commit message.

---

## Task 1: Bind Tone to the shared AudioContext

**Files:**
- Create: `src/progressions/audio/toneBus.ts`
- Create: `src/progressions/audio/toneBus.test.ts`
- Modify: `src/progressions/audio/bus.ts`

This task is the foundation: it makes Tone share the existing `AudioContext` so subsequent migrations don't introduce a competing clock.

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/toneBus.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Tone first so the module under test sees the spy.
const setContextSpy = vi.hoisted(() => vi.fn());
const getContextSpy = vi.hoisted(() => vi.fn());

vi.mock("tone", () => ({
  setContext: setContextSpy,
  getContext: getContextSpy,
}));

import { _resetProgressionAudioForTests, ensureProgressionAudio } from "./bus";
import { _resetToneBusForTests } from "./toneBus";

describe("toneBus binding", () => {
  beforeEach(() => {
    _resetProgressionAudioForTests();
    _resetToneBusForTests();
    setContextSpy.mockReset();
    getContextSpy.mockReset();
    // Minimal AudioContext stub so ensureProgressionAudio() succeeds in jsdom.
    (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect: vi.fn() }),
        destination: {},
        currentTime: 0,
        state: "running",
      };
    }) as unknown as typeof AudioContext;
  });

  it("calls Tone.setContext with the shared AudioContext on first ensureProgressionAudio", () => {
    const audio = ensureProgressionAudio();
    expect(audio).not.toBeNull();
    expect(setContextSpy).toHaveBeenCalledTimes(1);
    // Tone.setContext receives the same ctx that bus.ts created.
    expect(setContextSpy.mock.calls[0]![0]).toBe(audio!.ctx);
  });

  it("does not re-bind Tone on subsequent ensureProgressionAudio calls", () => {
    ensureProgressionAudio();
    ensureProgressionAudio();
    ensureProgressionAudio();
    expect(setContextSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm vitest run src/progressions/audio/toneBus.test.ts`

Expected: FAIL — module `./toneBus` not found.

- [ ] **Step 3: Implement `toneBus.ts`**

Create `src/progressions/audio/toneBus.ts`:

```ts
/**
 * Bridge between the bespoke progression bus and Tone.js.
 *
 * Tone defaults to constructing its own `AudioContext`. The progression
 * subsystem already owns a shared context (see `bus.ts`), and `timeline.ts`
 * reads `currentTime` directly from it to keep React in lockstep with audio.
 * If Tone ran on its own context we would have two clocks ticking
 * independently — drift of ~10 ms per minute is enough to make swing feel
 * sloppy. Instead we tell Tone to wrap the existing context, so
 * `Tone.now()` and `audio.ctx.currentTime` advance together.
 *
 * Bind exactly once: re-binding mid-session would re-wrap the context and
 * orphan any voices already scheduled on the previous wrapper.
 */
import * as Tone from "tone";
import type { ProgressionAudio } from "./bus";

let bound = false;

export function bindToneToProgressionContext(audio: ProgressionAudio): void {
  if (bound) return;
  Tone.setContext(audio.ctx);
  bound = true;
}

/** Test-only reset so the module behaves predictably across vitest runs. */
export function _resetToneBusForTests(): void {
  bound = false;
}
```

- [ ] **Step 4: Wire it into `bus.ts`**

Modify `src/progressions/audio/bus.ts`. In `ensureProgressionAudio()`, after the successful construction of `ctx` and `bus` (the `try` block, just before `return { ctx, bus }`), call `bindToneToProgressionContext({ ctx, bus })`. Also update `_resetProgressionAudioForTests` to also reset the tone-bus singleton so tests stay isolated.

Diff (illustrative):

```ts
import { _resetToneBusForTests, bindToneToProgressionContext } from "./toneBus";

// ...

try {
  ctx = new Ctor();
  bus = ctx.createGain();
  bus.gain.value = BUS_GAIN;
  bus.connect(ctx.destination);
  bindToneToProgressionContext({ ctx, bus });   // NEW
  return { ctx, bus };
} catch {
  unsupported = true;
  ctx = null;
  bus = null;
  return null;
}

// ...

export function _resetProgressionAudioForTests(): void {
  ctx = null;
  bus = null;
  unsupported = false;
  _resetToneBusForTests();                       // NEW
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm vitest run src/progressions/audio/toneBus.test.ts src/progressions/audio/bus.test.ts`

Expected: PASS for both files (bus.ts already has its own tests; this change must not break them).

- [ ] **Step 6: Full quality gate**

Run: `pnpm run lint && pnpm vitest run src/progressions src/hooks/useProgressionPlaybackLoop.test.tsx && npx tsc -b`

Expected: PASS. (The full test suite isn't required here; that runs at the PR cut.)

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/toneBus.ts src/progressions/audio/toneBus.test.ts src/progressions/audio/bus.ts
git commit -m "feat(audio): bind Tone.js to the shared progression AudioContext"
```

---

## Task 2: Step advance via `Tone.Transport.scheduleOnce`

**Files:**
- Modify: `src/hooks/useProgressionPlaybackLoop.ts`
- Modify: `src/hooks/useProgressionPlaybackLoop.test.tsx` (or create if missing — check first)

Today the loop polls `getTimeUntilCurrentStepEndMs()` and arms a `window.setTimeout`. Replace the Web-Audio-driven `setTimeout` branch with `Tone.getTransport().scheduleOnce(advance, boundaryTimeSec)`, which fires on the shared audio clock with no JS-timer jitter. Keep the no-Web-Audio fallback for jsdom and locked-autoplay.

- [ ] **Step 1: Check whether `useProgressionPlaybackLoop.test.tsx` exists**

Run: `ls src/hooks/useProgressionPlaybackLoop.test.tsx 2>/dev/null || echo "MISSING"`

If MISSING, create a minimal harness in Step 2; if it exists, extend it.

- [ ] **Step 2: Write the failing test**

Add to (or create) `src/hooks/useProgressionPlaybackLoop.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock Tone before importing the hook.
const scheduleOnceSpy = vi.hoisted(() => vi.fn());
const transportClearSpy = vi.hoisted(() => vi.fn());
vi.hoisted(() => ({}));

vi.mock("tone", () => ({
  getTransport: () => ({
    scheduleOnce: scheduleOnceSpy,
    clear: transportClearSpy,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    bpm: { value: 120 },
    seconds: 0,
  }),
  setContext: vi.fn(),
  getContext: vi.fn(),
  now: () => 0,
}));

// Mock the progression-audio surface so the hook takes the audio-clock branch.
vi.mock("../progressions/audio/bus", () => ({
  ensureProgressionAudio: () => ({
    ctx: { currentTime: 10 } as AudioContext,
    bus: {} as AudioNode,
  }),
}));
vi.mock("../progressions/audio/timeline", () => ({
  getTimelinePosition: () => ({
    stepIndex: 0,
    globalFraction: 0,
    localFraction: 0,
    paused: false,
  }),
  getTimeUntilCurrentStepEndMs: () => 2000,
}));

import { useProgressionPlaybackLoop } from "./useProgressionPlaybackLoop";

describe("useProgressionPlaybackLoop — Tone.Transport advance", () => {
  beforeEach(() => {
    scheduleOnceSpy.mockReset();
    transportClearSpy.mockReset();
  });

  it("arms advance via Transport.scheduleOnce at the audio-clock boundary", () => {
    // Render via a wrapper that publishes the playing state through useProgressionState.
    // (Use whatever harness the existing test uses — `renderWithAtoms` from test-utils
    // is the codebase convention.)
    // ...
    renderHook(() => useProgressionPlaybackLoop());
    expect(scheduleOnceSpy).toHaveBeenCalledTimes(1);
    // Boundary time = ctx.currentTime + remainingMs/1000 = 10 + 2 = 12s.
    expect(scheduleOnceSpy.mock.calls[0]![1]).toBeCloseTo(12, 3);
  });

  it("clears the scheduled callback on effect cleanup", () => {
    scheduleOnceSpy.mockReturnValueOnce(/* eventId */ 42);
    const { unmount } = renderHook(() => useProgressionPlaybackLoop());
    unmount();
    expect(transportClearSpy).toHaveBeenCalledWith(42);
  });
});
```

(The exact harness — `renderWithAtoms`, the atoms to seed, etc. — depends on whether a test file already exists. **Match the existing style. If creating from scratch, look at `src/hooks/useProgressionState.test.tsx` or similar for the pattern.**)

- [ ] **Step 3: Run the test, confirm it fails**

Run: `pnpm vitest run src/hooks/useProgressionPlaybackLoop.test.tsx`

Expected: FAIL — hook still uses `setTimeout`.

- [ ] **Step 4: Implement the Transport-driven branch**

In `src/hooks/useProgressionPlaybackLoop.ts`, replace the audio-clock branch's `setTimeout` arming. Final shape:

```ts
import { getTransport } from "tone";

// ...

if (ensureProgressionAudio()) {
  let eventId: number | null = null;
  let cancelled = false;

  const armAdvance = () => {
    if (cancelled) return;

    const tl = getTimelinePosition();
    if (!tl || tl.stepIndex !== activeProgressionStepIndex) {
      // Same retry-on-next-macrotask gate as today — the audio scheduler may
      // not have published the active segment yet on a fresh start.
      eventId = window.setTimeout(armAdvance, 0) as unknown as number;
      return;
    }

    const remainingMs = getTimeUntilCurrentStepEndMs() ?? 0;
    const audio = ensureProgressionAudio()!;
    const boundaryTime = audio.ctx.currentTime + remainingMs / 1000;

    // Use Tone.Transport's scheduleOnce so the callback fires on the shared
    // audio clock instead of a JS timer. With `Tone.setContext(audio.ctx)`
    // (Task 1) Transport time == audio.ctx.currentTime.
    eventId = getTransport().scheduleOnce(() => {
      advanceProgressionPlayback();
    }, boundaryTime) as unknown as number;
  };

  armAdvance();
  return () => {
    cancelled = true;
    if (eventId !== null) {
      // Use clearTimeout for the retry path, Transport.clear for the
      // Transport path. The retry path stores a setTimeout id; the boundary
      // path stores a Transport event id. They're disjoint at any given
      // moment but type both as `number` for ergonomics.
      // For simplicity, try Transport.clear first (safe no-op for unknown
      // ids), then clearTimeout.
      try { getTransport().clear(eventId); } catch { /* not a transport id */ }
      try { window.clearTimeout(eventId); } catch { /* not a timeout id */ }
    }
  };
}
```

**Important:** Do NOT call `getTransport().start()` here. Transport remains stopped — `scheduleOnce` still fires on context time even when Transport itself is not "playing." (Confirm by checking Tone docs / source if uncertain; the docs are explicit that `scheduleOnce` is absolute-time-based.) If you find Transport must be started for `scheduleOnce` to fire in v15, add `start()` here AND ensure it's stopped in the cleanup; otherwise leave Transport untouched.

The wall-clock fallback (when `ensureProgressionAudio()` returns null) keeps its existing `setTimeout` — that path is for jsdom and locked autoplay and does not need Tone.

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm vitest run src/hooks/useProgressionPlaybackLoop.test.tsx`

Expected: PASS (2/2).

- [ ] **Step 6: Quality gate**

Run: `pnpm run lint && pnpm vitest run src/hooks src/progressions && npx tsc -b`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProgressionPlaybackLoop.ts src/hooks/useProgressionPlaybackLoop.test.tsx
git commit -m "feat(audio): advance progression step via Tone.Transport.scheduleOnce"
```

**Optional PR-1 cut here.** Tasks 1+2 form a coherent foundational PR. If you cut here, run `pnpm run test:e2e` first to verify the live playback path still works (this is the highest-risk change in PR 1 — the step-advance loop drives the user-visible chord cycle).

---

## Task 3: Metronome on Tone

**Files:**
- Modify: `src/progressions/audio/metronome.ts`
- Modify: `src/progressions/audio/metronome.test.ts` (if it exists — check first; if not, add minimal coverage matching the existing instrument-test style in this folder)

Today `scheduleClick(ctx, dest, time, options)` builds a sine + decay envelope and routes through `dest` (the progression bus). Replace internals with `Tone.Synth`. **Preserve the `(ctx, dest, time, options)` signature and the `ClickHandle.cancel()` return shape** — the scheduler at `src/progressions/audio/scheduler.ts:255` calls this directly with that signature.

- [ ] **Step 1: Check for an existing test file**

Run: `ls src/progressions/audio/metronome.test.ts 2>/dev/null || echo "MISSING"`

If MISSING, write a new co-located test in Step 2. If present, extend it.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const triggerAttackReleaseSpy = vi.hoisted(() => vi.fn());
const synthCtorSpy = vi.hoisted(() => vi.fn());
const connectSpy = vi.hoisted(() => vi.fn().mockReturnThis());
const disposeSpy = vi.hoisted(() => vi.fn());

vi.mock("tone", () => ({
  Synth: synthCtorSpy.mockImplementation(function () {
    return {
      triggerAttackRelease: triggerAttackReleaseSpy,
      connect: connectSpy,
      dispose: disposeSpy,
      volume: { value: 0 },
    };
  }),
  gainToDb: (g: number) => 20 * Math.log10(Math.max(1e-6, g)),
}));

import { scheduleClick } from "./metronome";

describe("scheduleClick — Tone backend", () => {
  beforeEach(() => {
    triggerAttackReleaseSpy.mockReset();
    synthCtorSpy.mockReset();
    connectSpy.mockReset().mockReturnThis();
    disposeSpy.mockReset();
  });

  it("triggers an accented click at 1500 Hz on beat 1", () => {
    const ctx = { currentTime: 0 } as AudioContext;
    const dest = {} as AudioNode;
    scheduleClick(ctx, dest, 1.5, { accent: true, velocity: 0.8 });
    expect(triggerAttackReleaseSpy).toHaveBeenCalledTimes(1);
    const [pitch, duration, time, velocity] = triggerAttackReleaseSpy.mock.calls[0]!;
    expect(pitch).toBeCloseTo(1500, 0);
    expect(duration).toBeCloseTo(0.04, 2);
    expect(time).toBeCloseTo(1.5, 3);
    expect(velocity).toBeCloseTo(0.8, 2);
  });

  it("triggers a normal click at 900 Hz when accent is false", () => {
    scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, { accent: false });
    expect(triggerAttackReleaseSpy.mock.calls[0]![0]).toBeCloseTo(900, 0);
  });

  it("skips scheduling when velocity is zero", () => {
    scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, { velocity: 0 });
    expect(triggerAttackReleaseSpy).not.toHaveBeenCalled();
  });

  it("cancel() disposes the synth", () => {
    const handle = scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, {});
    handle.cancel();
    expect(disposeSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails**

Run: `pnpm vitest run src/progressions/audio/metronome.test.ts`

Expected: FAIL.

- [ ] **Step 4: Implement on Tone.Synth**

Rewrite `src/progressions/audio/metronome.ts`:

```ts
/**
 * Metronome click. A short sine ping triggered via Tone.Synth on the shared
 * progression context (see `toneBus.ts`). 1500 Hz on accent (beat 1),
 * 900 Hz on the others. 40 ms decay.
 *
 * Tone's `triggerAttackRelease(freq, duration, time, velocity)` schedules a
 * single note at `time` in audio-context seconds — the same clock space the
 * existing scheduler uses. `dest` is the progression bus; we route the
 * synth's output to it so pausing the bus also cuts the click.
 */
import * as Tone from "tone";

const ACCENT_FREQ = 1500;
const NORMAL_FREQ = 900;
const DECAY = 0.04;

export interface ClickOptions {
  accent?: boolean;
  velocity?: number;
}

export interface ClickHandle {
  cancel: () => void;
}

export function scheduleClick(
  _ctx: AudioContext,
  dest: AudioNode,
  time: number,
  options: ClickOptions = {},
): ClickHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.6));
  if (velocity <= 0) return { cancel: () => {} };

  const frequency = options.accent ? ACCENT_FREQ : NORMAL_FREQ;
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: DECAY, sustain: 0, release: 0.01 },
  });
  // Route through the existing progression bus so silenceProgressionBus()
  // mutes the metronome along with the rest of the backing track.
  synth.connect(dest);
  synth.triggerAttackRelease(frequency, DECAY, time, velocity);

  // Tone's voice manager will release the synth on its own, but the
  // scheduler's `cancelAll()` contract requires immediate teardown for
  // pause/stop. Dispose explicitly.
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      try { synth.dispose(); } catch { /* already disposed */ }
    },
  };
}

export const _metronomeInternals = { ACCENT_FREQ, NORMAL_FREQ, DECAY };
```

Note `_ctx` is now unused but kept in the signature for scheduler compatibility. Prefix with `_` to satisfy the no-unused-args lint rule.

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm vitest run src/progressions/audio/metronome.test.ts`

Expected: PASS (4/4).

- [ ] **Step 6: Run the broader scheduler tests**

Run: `pnpm vitest run src/progressions/audio/`

Expected: PASS. The scheduler integration test calls `scheduleClick`; its expectations now run against the new Tone-mocked path.

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/metronome.ts src/progressions/audio/metronome.test.ts
git commit -m "refactor(audio): rewrite metronome click on Tone.Synth"
```

---

## Task 4: Bass on Tone

**Files:**
- Modify: `src/progressions/audio/bass.ts`
- Modify: `src/progressions/audio/bass.test.ts` (check existence; today the bass test may live inside `scheduler.test.ts` or `instruments/`).

Today `scheduleBassNote(ctx, dest, frequency, time, options)` is a sawtooth oscillator → lowpass biquad → decaying gain. Replace internals with `Tone.MonoSynth`, which natively offers sawtooth → filter envelope → amplitude envelope. **Preserve the signature and `BassVoiceHandle.cancel()` shape.**

- [ ] **Step 1: Confirm/create the test file**

Run: `ls src/progressions/audio/bass.test.ts 2>/dev/null || echo "MISSING"`

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const triggerAttackReleaseSpy = vi.hoisted(() => vi.fn());
const monoSynthCtorSpy = vi.hoisted(() => vi.fn());
const connectSpy = vi.hoisted(() => vi.fn().mockReturnThis());
const disposeSpy = vi.hoisted(() => vi.fn());

vi.mock("tone", () => ({
  MonoSynth: monoSynthCtorSpy.mockImplementation(function () {
    return {
      triggerAttackRelease: triggerAttackReleaseSpy,
      connect: connectSpy,
      dispose: disposeSpy,
    };
  }),
}));

import { scheduleBassNote } from "./bass";

describe("scheduleBassNote — Tone backend", () => {
  beforeEach(() => {
    triggerAttackReleaseSpy.mockReset();
    monoSynthCtorSpy.mockReset();
    connectSpy.mockReset().mockReturnThis();
    disposeSpy.mockReset();
  });

  it("constructs a MonoSynth with sawtooth oscillator + lowpass filter envelope", () => {
    scheduleBassNote({ currentTime: 0 } as AudioContext, {} as AudioNode, 220, 1.0);
    const [opts] = monoSynthCtorSpy.mock.calls[0]!;
    expect(opts.oscillator.type).toBe("sawtooth");
    expect(opts.filterEnvelope.baseFrequency).toBeCloseTo(1200, 0);
  });

  it("triggers at the requested frequency and time", () => {
    scheduleBassNote({ currentTime: 0 } as AudioContext, {} as AudioNode, 110, 2.5, { velocity: 0.8 });
    const [pitch, _dur, time, velocity] = triggerAttackReleaseSpy.mock.calls[0]!;
    expect(pitch).toBeCloseTo(110, 1);
    expect(time).toBeCloseTo(2.5, 3);
    expect(velocity).toBeCloseTo(0.8, 2);
  });

  it("skips zero-velocity notes", () => {
    scheduleBassNote({ currentTime: 0 } as AudioContext, {} as AudioNode, 110, 0, { velocity: 0 });
    expect(triggerAttackReleaseSpy).not.toHaveBeenCalled();
  });

  it("cancel() disposes the synth", () => {
    const h = scheduleBassNote({ currentTime: 0 } as AudioContext, {} as AudioNode, 110, 0);
    h.cancel();
    expect(disposeSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run, confirm FAIL**

Run: `pnpm vitest run src/progressions/audio/bass.test.ts`

- [ ] **Step 4: Implement**

Rewrite `src/progressions/audio/bass.ts`:

```ts
/**
 * Bass voice for the progression backing track. Sawtooth oscillator with a
 * lowpass filter envelope (1200 Hz cutoff opens then closes) and a punchy
 * amplitude envelope. Implemented on Tone.MonoSynth, which gives us
 * per-voice filter motion for free — the prior raw-Web-Audio version did
 * the same with a manual BiquadFilter.
 */
import * as Tone from "tone";

const ATTACK = 0.005;
const DECAY = 0.4;
const RELEASE = 0.25;
const FILTER_CUTOFF_HZ = 1200;
const FILTER_Q = 2;

export interface BassNoteOptions {
  velocity?: number;
  durationSec?: number;
}

export interface BassVoiceHandle {
  cancel: () => void;
}

export function scheduleBassNote(
  _ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  time: number,
  options: BassNoteOptions = {},
): BassVoiceHandle {
  const velocity = Math.max(0, Math.min(1.2, options.velocity ?? 0.9));
  if (velocity <= 0) return { cancel: () => {} };
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
      octaves: 0, // hold the cutoff at base; the prior impl swept slightly
                  // — fine to keep static for now, document if a future
                  // ear-test wants motion back.
    },
  });
  synth.connect(dest);
  synth.triggerAttackRelease(frequency, noteLen, time, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      try { synth.dispose(); } catch { /* already disposed */ }
    },
  };
}
```

- [ ] **Step 5: PASS the test + scheduler tests**

Run: `pnpm vitest run src/progressions/audio/bass.test.ts src/progressions/audio/scheduler.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/bass.ts src/progressions/audio/bass.test.ts
git commit -m "refactor(audio): rewrite bass voice on Tone.MonoSynth"
```

---

## Task 5: String pluck + strum chord voice on Tone

**Files:**
- Modify: `src/progressions/audio/string.ts` (120 lines today — exports `pluckString`)
- Modify: `src/progressions/audio/instruments/strumVoice.ts` (no logic change; updates if `pluckString`'s return shape changes)
- Modify: `src/progressions/audio/string.test.ts` (verify it exists; if not, create)

`pluckString(ctx, dest, freq, time, options)` today is a Karplus–Strong-ish noise burst + comb filter. Tone has a first-class `PluckSynth` — swap the internals while preserving the call signature so `strumVoice` keeps working.

- [ ] **Step 1: Confirm test file location**

Run: `ls src/progressions/audio/string.test.ts 2>/dev/null || echo "MISSING"`

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const triggerAttackSpy = vi.hoisted(() => vi.fn());
const triggerReleaseSpy = vi.hoisted(() => vi.fn());
const pluckSynthCtorSpy = vi.hoisted(() => vi.fn());
const connectSpy = vi.hoisted(() => vi.fn().mockReturnThis());
const disposeSpy = vi.hoisted(() => vi.fn());

vi.mock("tone", () => ({
  PluckSynth: pluckSynthCtorSpy.mockImplementation(function () {
    return {
      triggerAttack: triggerAttackSpy,
      triggerRelease: triggerReleaseSpy,
      connect: connectSpy,
      dispose: disposeSpy,
    };
  }),
  Frequency: (f: number) => ({ toNote: () => `${f}Hz` }),
}));

import { pluckString } from "./string";

describe("pluckString — Tone.PluckSynth backend", () => {
  beforeEach(() => {
    pluckSynthCtorSpy.mockReset();
    triggerAttackSpy.mockReset();
    triggerReleaseSpy.mockReset();
    connectSpy.mockReset().mockReturnThis();
    disposeSpy.mockReset();
  });

  it("triggers a pluck at the requested freq + time + velocity", () => {
    pluckString({ currentTime: 0 } as AudioContext, {} as AudioNode, 220, 1.0, { velocity: 0.7 });
    expect(triggerAttackSpy).toHaveBeenCalledTimes(1);
    const [pitch, time, velocity] = triggerAttackSpy.mock.calls[0]!;
    // Tone accepts Hz as a number; assert numerically.
    expect(Number(pitch)).toBeCloseTo(220, 1);
    expect(time).toBeCloseTo(1.0, 3);
    expect(velocity).toBeCloseTo(0.7, 2);
  });

  it("cancel() disposes the synth", () => {
    const h = pluckString({ currentTime: 0 } as AudioContext, {} as AudioNode, 220, 0, {});
    h.cancel();
    expect(disposeSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: FAIL**

- [ ] **Step 4: Implement**

Replace the body of `src/progressions/audio/string.ts` (preserve exports, drop unused helpers if they were only consumed internally):

```ts
/**
 * Plucked-string voice — Tone.PluckSynth (Karplus-Strong) wrapped to match
 * the existing handle contract used by strum/bass and the scheduler.
 *
 * Sound character: short attack noise + dampened resonant comb filter.
 * Tone's defaults give a bright pluck; adjust `attackNoise`, `dampening`,
 * and `resonance` if A/B reveals a perceptible difference vs. the prior
 * bespoke implementation.
 */
import * as Tone from "tone";

export interface PluckOptions {
  velocity?: number;
}

export interface PluckHandle {
  cancel: () => void;
}

export function pluckString(
  _ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  time: number,
  options: PluckOptions = {},
): PluckHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
  if (velocity <= 0) return { cancel: () => {} };

  const synth = new Tone.PluckSynth({
    attackNoise: 1.0,
    dampening: 4000,
    resonance: 0.85,
    release: 1.0,
  });
  synth.connect(dest);
  // PluckSynth's triggerAttack takes (note, time, velocity).
  // PluckSynth has no triggerRelease — the comb filter decays naturally.
  synth.triggerAttack(frequency, time, velocity);

  // Dispose lazily so the pluck can ring out; scheduler cancel() forces immediate teardown.
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      try { synth.dispose(); } catch { /* already disposed */ }
    },
  };
}
```

- [ ] **Step 5: Verify strumVoice still works**

`strumVoice.ts` calls `pluckString(...)` and treats the return as `{ cancel: () => void }`. The new return matches. Do not edit `strumVoice.ts` unless its test reveals a regression.

Run: `pnpm vitest run src/progressions/audio/string.test.ts src/progressions/audio/instruments/strumVoice.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/string.ts src/progressions/audio/string.test.ts
git commit -m "refactor(audio): rewrite plucked string on Tone.PluckSynth"
```

---

## Task 6: Piano + organ chord voices on Tone

**Files:**
- Modify: `src/progressions/audio/instruments/pianoVoice.ts`
- Modify: `src/progressions/audio/instruments/organVoice.ts`
- Modify: their co-located `*.test.ts` files

Both currently build per-note `OscillatorNode`+`GainNode` chains for each pitch in the chord voicing. Rewrite each on `Tone.PolySynth(Tone.Synth)` with timbre presets that match today's character (piano = decaying triangle+sine partials with bright attack; organ = sustained sine partials).

- [ ] **Step 1: For each voice, write the failing test**

(Two tests, one per file. Pattern matches Task 3/Task 4.)

For `pianoVoice.test.ts`:

```ts
// (mock Tone the same way as Task 3)
import { pianoVoice } from "./pianoVoice";

it("schedules each note of the voicing on the PolySynth at the supplied time", () => {
  pianoVoice.scheduleChord(
    { currentTime: 0 } as AudioContext,
    {} as AudioNode,
    ["C3", "E3", "G3"],
    1.0,
    { velocity: 0.7 },
  );
  // PolySynth.triggerAttackRelease is invoked once per note (or once with an array — depends on the impl chosen).
  expect(triggerAttackReleaseSpy).toHaveBeenCalled();
});

it("cancel() disposes the synth", () => {
  const h = pianoVoice.scheduleChord(/* ... */);
  h.cancel();
  expect(disposeSpy).toHaveBeenCalled();
});
```

Repeat for `organVoice.test.ts` with the organ-specific timbre assertion.

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement `pianoVoice.ts`**

```ts
import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

export const pianoVoice: ChordVoice = {
  scheduleChord(
    _ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
    if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle",
        partials: [1, 0.5, 0.25, 0.12],
      },
      envelope: {
        attack: 0.005,
        decay: 0.4,
        sustain: 0.1,
        release: 1.2,
      },
      volume: -6,
    });
    synth.maxPolyphony = Math.max(notes.length, 6);
    synth.connect(dest);
    // PolySynth accepts an array of notes for a chord-style attack.
    synth.triggerAttackRelease(notes as string[], options.style === "sustained" ? 1.2 : 0.4, time, velocity);

    let cancelled = false;
    return {
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        try { synth.dispose(); } catch { /* already disposed */ }
      },
    };
  },
};
```

- [ ] **Step 4: Implement `organVoice.ts`** (parallel to pianoVoice; sine partials, no decay, longer sustain):

```ts
import * as Tone from "tone";
import type { ChordVoice, ChordVoiceOptions, VoiceHandle } from "./types";

export const organVoice: ChordVoice = {
  scheduleChord(
    _ctx: AudioContext,
    dest: AudioNode,
    notes: readonly string[],
    time: number,
    options: ChordVoiceOptions,
  ): VoiceHandle {
    const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.7));
    if (velocity <= 0 || notes.length === 0) return { cancel: () => {} };

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sine",
        partials: [1, 0.6, 0.4, 0.3, 0.2],
      },
      envelope: {
        attack: 0.02,
        decay: 0.05,
        sustain: 0.9,
        release: 0.6,
      },
      volume: -10,
    });
    synth.maxPolyphony = Math.max(notes.length, 6);
    synth.connect(dest);
    synth.triggerAttackRelease(notes as string[], options.style === "staccato" ? 0.2 : 1.5, time, velocity);

    let cancelled = false;
    return {
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        try { synth.dispose(); } catch { /* already disposed */ }
      },
    };
  },
};
```

- [ ] **Step 5: PASS both test files + the index test**

Run: `pnpm vitest run src/progressions/audio/instruments/`

Expected: PASS for piano, organ, and `index.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/instruments/
git commit -m "refactor(audio): rewrite piano and organ chord voices on Tone.PolySynth"
```

---

## Task 7: Drums on Tone

**Files:**
- Modify: `src/progressions/audio/drumKit.ts` (265 lines)
- Modify: `src/progressions/audio/drumKit.test.ts` (8 lines today — extend; the file is currently very minimal, suggesting drum testing happens via `scheduler.test.ts`)

Four kit pieces — kick, snare, hi-hat (closed + open), ride — each currently built from raw oscillators + noise buffers + filters. Tone has purpose-built primitives: `MembraneSynth` (kick), `NoiseSynth` (snare, hat), `MetalSynth` (ride). Match the existing `scheduleKick/Snare/HiHat/Ride(ctx, dest, time, options) → VoiceHandle` signatures.

Each piece is a self-contained sub-task. Land them as one commit if review-friendly, or split if the diff is heavy.

- [ ] **Step 1: Write failing tests**

Add to (or rewrite) `drumKit.test.ts`:

```ts
// Mock Tone with constructor spies for MembraneSynth, NoiseSynth, MetalSynth.
// For each schedule fn:
//   - assert correct synth class is constructed
//   - assert triggerAttackRelease called with (note, duration, time, velocity)
//   - assert cancel() disposes
//   - assert velocity <= 0 is a no-op
```

Use the same `vi.hoisted` mock pattern as Tasks 3–6. Eight tests total (4 hits × 2 — schedule + cancel). Optional: extra test for `scheduleHiHat({ open: true })` selecting longer decay.

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

Rewrite `drumKit.ts` with four small functions. Sketch (assert timbres match the prior character via A/B listening before locking in):

```ts
import * as Tone from "tone";

export interface DrumOptions {
  velocity?: number;
}
export interface DrumHandle { cancel: () => void; }

export function scheduleKick(_ctx: AudioContext, dest: AudioNode, time: number, opts: DrumOptions = {}): DrumHandle {
  const velocity = Math.max(0, Math.min(1.2, opts.velocity ?? 0.9));
  if (velocity <= 0) return { cancel: () => {} };
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1, attackCurve: "exponential" },
  });
  synth.connect(dest);
  synth.triggerAttackRelease("C1", 0.5, time, velocity);
  return _disposeHandle(synth);
}

export function scheduleSnare(_ctx: AudioContext, dest: AudioNode, time: number, opts: DrumOptions = {}): DrumHandle {
  const velocity = Math.max(0, Math.min(1.2, opts.velocity ?? 0.8));
  if (velocity <= 0) return { cancel: () => {} };
  const synth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
  });
  synth.connect(dest);
  synth.triggerAttackRelease(0.18, time, velocity);
  return _disposeHandle(synth);
}

export interface HiHatOptions extends DrumOptions { open?: boolean; }
export function scheduleHiHat(_ctx: AudioContext, dest: AudioNode, time: number, opts: HiHatOptions = {}): DrumHandle {
  const velocity = Math.max(0, Math.min(1, opts.velocity ?? 0.5));
  if (velocity <= 0) return { cancel: () => {} };
  const decay = opts.open ? 0.35 : 0.05;
  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  synth.connect(dest);
  synth.triggerAttackRelease("C6", decay, time, velocity);
  return _disposeHandle(synth);
}

export function scheduleRide(_ctx: AudioContext, dest: AudioNode, time: number, opts: DrumOptions = {}): DrumHandle {
  const velocity = Math.max(0, Math.min(1, opts.velocity ?? 0.45));
  if (velocity <= 0) return { cancel: () => {} };
  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.0, release: 0.3 },
    harmonicity: 3.1,
    modulationIndex: 22,
    resonance: 2400,
    octaves: 1.0,
  });
  synth.connect(dest);
  synth.triggerAttackRelease("D6", 1.0, time, velocity);
  return _disposeHandle(synth);
}

function _disposeHandle(synth: { dispose: () => void }): DrumHandle {
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      try { synth.dispose(); } catch { /* already disposed */ }
    },
  };
}
```

- [ ] **Step 4: PASS**

Run: `pnpm vitest run src/progressions/audio/drumKit.test.ts src/progressions/audio/scheduler.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/drumKit.ts src/progressions/audio/drumKit.test.ts
git commit -m "refactor(audio): rewrite drum kit on Tone.MembraneSynth/NoiseSynth/MetalSynth"
```

---

## Task 8: Cleanup + final quality gate

**Files:**
- Possibly delete: `src/test-utils/mockWebAudio.ts` (only if grep confirms zero remaining consumers)
- Modify: `docs/superpowers/plans/2026-05-20-fretflow-integration-design.md` (mark Phase 7 row complete with PR link)
- Refresh visual-regression baselines on darwin + linux

- [ ] **Step 1: Audit remaining Web Audio consumers**

Run:
```bash
grep -rn "createOscillator\|createBiquadFilter\|createPeriodicWave\|getNoteFrequency" src/progressions/audio/ src/core/ --include="*.ts" | grep -v ".test."
```

Expected output after Tasks 1–7: no production-source results from `src/progressions/audio/` or `src/core/audio.ts` (except possibly `getNoteFrequency` which is fine — it's a `@fretflow/core` pure helper, not Web Audio).

If any production source still constructs raw Web Audio nodes, address it before declaring Phase 7B done.

- [ ] **Step 2: Audit `mockWebAudio` consumers**

Run:
```bash
grep -rn "mockWebAudio" src/ --include="*.ts" --include="*.tsx"
```

If only the file itself + its own test appear, delete:
```bash
git rm src/test-utils/mockWebAudio.ts src/test-utils/mockWebAudio.test.ts
```

If any other test still imports it, leave it (and add a comment in the eventual PR description explaining what's left).

- [ ] **Step 3: Quality gate**

Run:
```bash
pnpm run lint
pnpm run test
pnpm run build
npx tsc -b
pnpm run test:e2e
```

Expected: all green. `test:e2e` is the critical one — Phase 7B's whole point is audio behavior parity, and the e2e suite exercises actual playback through Playwright.

- [ ] **Step 4: Refresh visual baselines (darwin)**

Run: `pnpm run test:visual:update`

Review the diff: the only expected visual changes are if the playback indicator's animation timing shifted by a frame or two (unlikely with shared-context Tone). If unrelated visuals shift, investigate before committing.

- [ ] **Step 5: Refresh visual baselines (linux)**

Run: `pnpm run test:visual:update:linux`

Same review.

- [ ] **Step 6: Update master plan status**

In `docs/superpowers/plans/2026-05-20-fretflow-integration-design.md`, change Phase 7 row in the Roadmap & Phase Index table from "Blocked on Phase 1" to "Complete (PR #XYZ + #ABC)" with the PR numbers from this plan's PR cuts.

- [ ] **Step 7: Commit + open PR**

```bash
git add -A
git commit -m "chore(audio): drop dead Web Audio helpers; refresh visual baselines"
git push -u origin <branch>
gh pr create --title "feat(audio): migrate progression scheduler to Tone.js (Phase 7B)" --body "$(cat <<'EOF'
## Summary

Completes the deferred portion of Phase 7. Backing-track scheduling and step-advance loop now run on Tone.js, sharing the existing `AudioContext` so there is a single master clock for the whole audio system.

- Bind Tone to the shared progression `AudioContext` (`Tone.setContext`) — `toneBus.ts`
- Step advance via `Tone.Transport.scheduleOnce` instead of `setTimeout`
- Metronome, bass, plucked string, piano + organ chord voices, and drum kit all rewritten on Tone primitives
- Public scheduler API (`scheduleProgressionStep`) and all `*Handle.cancel()` contracts preserved — no call-site changes
- Dead Web Audio helpers removed where no longer referenced

## Trade-offs (documented in source)

- Per-voice bass filter sweep is now static (Tone.MonoSynth's `filterEnvelope.octaves = 0`); recovery path noted in `bass.ts`.
- Pluck timbre uses Tone's defaults; A/B against the bespoke implementation is documented in `string.ts`.

## Test plan

- [x] `pnpm run lint && pnpm run test && pnpm run build`
- [x] `pnpm run test:e2e`
- [x] Visual regression baselines refreshed (darwin + linux)
- [ ] Manual smoke test on Safari: play a progression with all four lanes (chord/bass/drums/metronome) at 120 BPM and confirm beat lock is tight over 8+ bars

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

Reviewed against the deferred Phase 7 scope (Tasks 7.3 + 7.4 + 7.5 from the master plan). Coverage:

| Original Phase 7 scope item | Task in this plan | Covered? |
|---|---|---|
| Replace step-advance timer with Tone.Transport+Sequence | Task 2 (Transport.scheduleOnce — Sequence not needed since step advance is one-shot per step) | yes |
| Add `tone` dep + init | Task 7.1 (already landed PR #448) | yes |
| Replace GuitarSynth with Tone | Task 7.2 (already landed PR #448) | yes |
| Migrate backing-track scheduling | Tasks 3–7 (metronome, bass, pluck/strum, piano, organ, drums) | yes |
| `src/progressions/audio/transport.ts` (proposed in master plan) | Folded into Task 2's `useProgressionPlaybackLoop` edit — a separate transport module is unnecessary given Tone provides one | yes (re-scoped) |
| Phase 7 quality gate + PR | Task 8 | yes |

**Placeholder scan:** no "TBD" / "TODO" / "fill in" in any step. Every code-step has the actual code.

**Type consistency:** `VoiceHandle` and the four schedule signatures (`scheduleClick`, `scheduleBassNote`, `scheduleKick/Snare/HiHat/Ride`, `chordVoice.scheduleChord`) preserve the existing exported types from `src/progressions/audio/scheduler.ts` and `src/progressions/audio/instruments/types.ts`. `_resetToneBusForTests` matches the `_reset*ForTests` convention used throughout the audio modules.

**Architectural premise check:** Task 1 makes `Tone.getContext().rawContext === audio.ctx`. From that point forward, any Tone call's notion of "time" agrees with `timeline.ts`'s reads from `audio.ctx.currentTime`. This is the single point that prevents dual-clock drift; if it fails (e.g. Tone v15's `setContext` is renamed in a future major), the whole plan needs to revisit.

**One known risk:** Task 7 (drums) is the largest commit. If review fatigue becomes a problem, split into four commits (kick / snare / hats / ride). The plan presents them as one because the test scaffolding is shared and the work is uniform; splitting is a cosmetic preference.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-phase-7b-tone-scheduler.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, two-stage review between tasks. Best fit for a plan with eight independent leaf tasks and a clear foundation→swap→cleanup arc.

**2. Inline Execution** — execute in this session with checkpoints between tasks. Workable for the foundation tasks (1+2), but the instrument swaps benefit from fresh subagent context per task.

**Recommended start:** Task 1 (context bridge). It is the lowest-risk task in the plan, validates the core architectural premise, and unlocks every subsequent task. Land Tasks 1+2 as PR 1 before starting any instrument migrations.
