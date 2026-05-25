# Tone.Part Progression Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FretFlow's bespoke chord-onset scheduling chain (`useProgressionPlaybackLoop` + the segment queue in `useProgressionAudioPlayback`) with a single Tone.Part that pre-schedules **one event per bar** of the progression (multi-bar steps expand into per-bar events) and auto-loops via `part.loop`.

**Architecture:** A single `Tone.Part` instance owns a per-bar event grid. Its callback fires once per bar with the audio-precise `time`; inside the callback we (1) call our existing `scheduleProgressionStep(...)` with `beatsAvailable = beatsPerBar` (or the sub-bar step's beats) so only the current bar's audio is in flight, (2) publish the active step to `timeline.ts` for the playhead, and (3) on **first-bar-of-step** events only, defer the React `activeProgressionStepIndex` write by the Tone lookahead so the chord-overlay swap aligns with audio onset (same `setTimeout(advance, time − getContext().immediate())` pattern we just shipped). The Part is rebuilt on dep changes (tempo, steps, loop toggle), starting at the current Transport position so audio doesn't restart from bar 0. The state-driver hook `useProgressionPlaybackLoop` is deleted; its responsibilities collapse into the Part callback. Per-bar callbacks mean only one bar of audio is ever pre-scheduled, so mid-playback parameter changes glitch at most one bar instead of mid-chord.

**Tech Stack:** Tone.js 15.x (`Tone.Part`, `Tone.getTransport`, `Tone.getContext`), Jotai, React 19, Vitest.

---

## Design rationale (the missing brainstorm)

### Why Tone.Part, not Tone.Loop or Tone.Sequence

Both linked examples (step sequencer, DAW) use **fixed-grid** primitives. FretFlow's progression steps have **variable** durations — `{ value: 1, unit: "beat" }` or `{ value: 2, unit: "bar" }` per step. Mapping directly:

| Primitive | Fits? | Why |
|---|---|---|
| `Tone.Loop(cb, "4n")` | no | fires at a fixed subdivision; can't express sub-bar steps + multi-bar steps in the same sequence |
| `Tone.Sequence([…], "1m")` | partial | iterates an array at a fixed subdivision; fits the **expanded** per-bar event list but not the sub-bar steps we still support |
| `Tone.Part([[0, e0], [4, e1], …], cb)` | **yes** | schedules events at arbitrary absolute times relative to part start; supports `loop` + `loopEnd` natively; mixed grid (bar + sub-bar) just works |

### Per-bar event expansion

The data model keeps per-step variable duration (the editor UX is unchanged). At the audio layer, `buildProgressionEvents` expands multi-bar steps into one event per bar — e.g., a single `Am × 2 bars` step becomes two events `{stepIndex: 1, isFirstBar: true}` + `{stepIndex: 1, isFirstBar: false}`. Sub-bar steps stay as a single event whose `durationSec` is less than one bar.

Why expand:
- **Mid-playback rebuilds glitch at most one bar.** With a single multi-bar event, the scheduler would pre-queue all 4 bars of audio in one shot; canceling that mid-chord (e.g., drums toggle) cuts the chord. With per-bar callbacks, only the next bar is pre-queued, so dispose+rebuild loses at most one bar's worth of pre-scheduled audio.
- **The React advance only fires when the step actually changes.** The callback checks `event.isFirstBar` before writing the active-step Jotai atom, so continuation bars don't trigger a chord-overlay re-render. Saves N − 1 heavy React passes per N-bar chord.
- **`scheduleProgressionStep` is called per bar with `beatsAvailable = beatsPerBar`**, so the existing drum/bass/strum/metronome pattern repetition naturally loops once per bar without special "rebuild from time T" plumbing.

### What stays (intentional non-scope)

- `scheduleProgressionStep` in `src/progressions/audio/scheduler.ts` — does all the per-step drum/bass/strum/metronome work. Well-tested. Untouched.
- The pattern catalog, drum kit, instrument registry, swing logic. Untouched.
- `timeline.ts` — playhead reads from it. The new Part callback writes to it (same `setActiveStep` call); contract unchanged.
- The `ProgressionPlayhead` component and its RAF loop. Untouched.
- Atoms in `progressionAtoms.ts`. The `advanceProgressionPlaybackAtom` write target stays; only its trigger moves.
- The chord-overlay subscribers (chordOverlayAtoms, songStateAtoms, practiceLensAtoms). Untouched.
- The `setTimeout(advance, time - immediate())` deferral pattern we just shipped — it's reused verbatim inside the Part callback. Plain setTimeout, no Draw, no startTransition. The 250 ms expiration stall cannot recur through this path.

### What goes away

- `src/hooks/useProgressionPlaybackLoop.ts` — fully deleted. The Part callback is now the chord-onset event source; the separate React-driven advance loop is redundant.
- `src/hooks/useProgressionPlaybackLoop.test.tsx` — deleted. Its meaningful coverage (alignment, cleanup, mute-while-active, retry-on-timeline-mismatch) migrates to `useProgressionAudioPlayback.test.tsx`.
- The two-segment queue (`current` + `next` `ScheduledSegment[]`) inside `useProgressionAudioPlayback.ts`. Tone.Part pre-schedules everything in one shot; we don't manually maintain a queue.
- The `armAdvance` retry-via-`setTimeout(0)` for the timeline/state race. The race vanishes because audio scheduling and timeline publication happen in the same callback synchronously.

### What we explicitly do NOT change in this round

- Mid-playback chord-overlay React render cost. The Fretboard repaints heavily when `activeResolvedProgressionStep` changes; the new architecture doesn't make that faster. If RAF starvation during the repaint is audible (playhead micro-stutter at boundaries), it gets its own plan — likely decoupling the overlay's mount from the main fretboard tree.
- BPM ramps via `getTransport().bpm.rampTo(...)`. Mentioned in your example but FretFlow doesn't expose ramped tempo today. Out of scope.
- Replacing the per-step scheduler with `Tone.Pattern` for drums or `Tone.Sequence` for bass. Our pattern catalog + role-resolution logic is too domain-specific; Tone primitives don't reduce code here.

### Failure modes considered

1. **Mid-playback dep change** (user changes tempo, swaps a chord, toggles loop) → we dispose the existing Part and build a new one. Tone.Part's `dispose()` cancels all its pending events. We start the new Part with `startOffset` set to `getTransport().seconds % oldTotalDurationSec` so playback continues from the current position, not bar 0. Same UX as today's "reconcile keepers" logic but trivially simpler.
2. **Non-looped progression reaches end** → Tone.Part doesn't auto-stop when `loop = false`; it just stops firing callbacks past the last event. We schedule a `Transport.scheduleOnce` at `progressionStart + totalDurationSec` to set `progressionPlayingStateAtom = false`. (One-shot scheduleOnce; same primitive we used for the advance, no `Draw`, no `startTransition`.)
3. **Pause mid-playback** → we call `part.stop(now)` and `clearTimeline()` (existing path). On resume we rebuild the Part at the current Transport position.
4. **Test environment without Web Audio** → the existing fallback path (`if (!ensureProgressionAudio())`) gets a simpler version: we just don't build a Part. Tests that exercise the audio path mock `Tone.Part` explicitly.

---

## File map

**Create**

- `src/progressions/audio/progressionPart.ts` — thin wrapper over `Tone.Part` with FretFlow-shaped API:
  ```ts
  export interface ProgressionPartEvent {
    /** Audio time in seconds, relative to part start. */
    time: number;
    /** Index into the resolved step array — the React state target. */
    stepIndex: number;
    /** True when this event is the first bar of its step (drives the
     *  Jotai active-step write; continuation bars skip it). */
    isFirstBar: boolean;
    /** True when this event is the last bar of its step (gates passing
     *  `nextChordRoot` to the scheduler for chromatic-approach bass). */
    isLastBar: boolean;
    /** This bar's length in seconds (for handing to scheduleProgressionStep). */
    durationSec: number;
    /** Cumulative offset from progression start (for setActiveStep). */
    cumulativeStartSec: number;
    /** Beats this bar carries (for the scheduler's `beatsAvailable`). */
    beats: number;
  }

  export interface ProgressionPartOptions {
    events: readonly ProgressionPartEvent[];
    /** Total loop length. Required when loop=true; ignored when false. */
    totalDurationSec: number;
    loop: boolean;
    /** Fired once per chord onset, at the audio-precise scheduled time. */
    onEvent: (audioTime: number, event: ProgressionPartEvent) => void;
  }

  export interface ProgressionPartHandle {
    /** Start the part at the given transport offset (in seconds). */
    start: (startOffset?: number) => void;
    /** Stop and dispose the part. Idempotent. */
    dispose: () => void;
  }

  export function createProgressionPart(opts: ProgressionPartOptions): ProgressionPartHandle;
  ```
  Has its own tests against a mocked Tone.Part.

- `src/hooks/useProgressionAudioPlayback.test.tsx` — new test file. Inherits the meaningful coverage from the deleted loop test plus new tests for Part behavior.

**Modify**

- `src/hooks/useProgressionAudioPlayback.ts` — substantial rewrite. Replaces the segment queue with a single `ProgressionPartHandle`. The effect builds the Part on dep change, starts it, disposes the previous one. The Part callback does what the old `useProgressionPlaybackLoop` did:
  1. `scheduleProgressionStep(...)` for the chord's audio events.
  2. `setActiveStep(...)` so the playhead reflects the new step.
  3. `setTimeout(advance, max(0, audioTime - getContext().immediate()) * 1000)` to swap the React active-step index in alignment with audio onset.
  4. For non-loop mode: when this is the last event, schedule a one-shot `Transport.scheduleOnce` to set `progressionPlayingStateAtom = false` at `audioTime + durationSec`.

- `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` — remove the `useProgressionPlaybackLoop()` import and call. Only `useProgressionAudioPlayback()` remains.

**Delete**

- `src/hooks/useProgressionPlaybackLoop.ts`
- `src/hooks/useProgressionPlaybackLoop.test.tsx`

**Untouched (explicit)**

- `src/progressions/audio/scheduler.ts`
- `src/progressions/audio/timeline.ts`
- `src/progressions/audio/bus.ts`
- `src/progressions/audio/{drumKit,bass,patterns,instruments,…}.ts`
- `src/components/ProgressionTrack/ProgressionPlayhead.tsx`
- All atoms.

---

## Reused utilities

- `getTransport`, `getContext`, `Tone.Part` from `"tone"`.
- `scheduleProgressionStep` (`src/progressions/audio/scheduler.ts`).
- `setActiveStep`, `pauseTimeline`, `clearTimeline` (`src/progressions/audio/timeline.ts`).
- `ensureProgressionAudio`, `resumeProgressionAudio`, `restoreProgressionBus`, `silenceProgressionBus` (`src/progressions/audio/bus.ts`).
- `findNextResolvableStepIndex`, `getProgressionDurationMs`, `resolveBassLineNotes`, `resolveChordVoicing` (`src/progressions/progressionDomain.ts`, `progressionAudio.ts`). Used to build the event array.

---

### Task 1: Create ProgressionPart wrapper

**Files:**
- Create: `src/progressions/audio/progressionPart.ts`
- Create: `src/progressions/audio/progressionPart.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/progressionPart.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toneMocks = vi.hoisted(() => {
  type Cb = (time: number, value: unknown) => void;
  interface PartInstance {
    callback: Cb;
    events: Array<[number, unknown]>;
    loop: boolean;
    loopEnd: number;
    startedTime: number | null;
    startedOffset: number | null;
    disposed: boolean;
    start(time?: number, offset?: number): PartInstance;
    stop(): PartInstance;
    dispose(): PartInstance;
  }
  const parts: PartInstance[] = [];

  function PartCtor(callback: Cb, events: Array<[number, unknown]>): PartInstance {
    const inst: PartInstance = {
      callback,
      events: [...events],
      loop: false,
      loopEnd: 0,
      startedTime: null,
      startedOffset: null,
      disposed: false,
      start(time?: number, offset?: number) {
        this.startedTime = time ?? 0;
        this.startedOffset = offset ?? 0;
        return this;
      },
      stop() { return this; },
      dispose() { this.disposed = true; return this; },
    };
    parts.push(inst);
    return inst;
  }

  return { Part: PartCtor as unknown as new (...args: unknown[]) => unknown, parts };
});

vi.mock("tone", () => ({ Part: toneMocks.Part }));

import { createProgressionPart, type ProgressionPartEvent } from "./progressionPart";

describe("createProgressionPart", () => {
  beforeEach(() => { toneMocks.parts.length = 0; });
  afterEach(() => { vi.restoreAllMocks(); });

  const sampleEvent = (over: Partial<ProgressionPartEvent> = {}): ProgressionPartEvent => ({
    time: 0,
    stepIndex: 0,
    isFirstBar: true,
    isLastBar: true,
    durationSec: 1,
    cumulativeStartSec: 0,
    beats: 4,
    ...over,
  });

  it("builds a Tone.Part with one event per scheduled bar", () => {
    createProgressionPart({
      events: [
        sampleEvent({ time: 0, stepIndex: 0 }),
        sampleEvent({ time: 1, stepIndex: 1, cumulativeStartSec: 1, durationSec: 2 }),
      ],
      totalDurationSec: 3,
      loop: true,
      onEvent: () => {},
    });
    expect(toneMocks.parts).toHaveLength(1);
    const part = toneMocks.parts[0];
    expect(part.events).toHaveLength(2);
    expect(part.events[0][0]).toBe(0);
    expect(part.events[1][0]).toBe(1);
    expect(part.loop).toBe(true);
    expect(part.loopEnd).toBe(3);
  });

  it("invokes onEvent with the audio time and full event payload when Part fires", () => {
    const onEvent = vi.fn();
    createProgressionPart({
      events: [sampleEvent({ stepIndex: 7, isFirstBar: false, beats: 4 })],
      totalDurationSec: 1,
      loop: false,
      onEvent,
    });
    const part = toneMocks.parts[0];
    part.callback(0.42, part.events[0][1]);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      0.42,
      expect.objectContaining({ stepIndex: 7, isFirstBar: false, beats: 4 }),
    );
  });

  it("start(time, offset) forwards both args to Tone.Part.start", () => {
    const handle = createProgressionPart({
      events: [sampleEvent()],
      totalDurationSec: 1,
      loop: false,
      onEvent: () => {},
    });
    handle.start(2.5, 0.4);
    expect(toneMocks.parts[0].startedTime).toBe(2.5);
    expect(toneMocks.parts[0].startedOffset).toBe(0.4);
  });

  it("dispose() releases the Part and is idempotent", () => {
    const handle = createProgressionPart({
      events: [sampleEvent()],
      totalDurationSec: 1,
      loop: false,
      onEvent: () => {},
    });
    handle.dispose();
    handle.dispose();
    expect(toneMocks.parts[0].disposed).toBe(true);
  });

  it("does not set loopEnd when loop is false", () => {
    createProgressionPart({
      events: [sampleEvent()],
      totalDurationSec: 1,
      loop: false,
      onEvent: () => {},
    });
    expect(toneMocks.parts[0].loop).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/progressionPart.test.ts`
Expected: FAIL — `Cannot find module './progressionPart'`.

- [ ] **Step 3: Implement the wrapper**

```ts
// src/progressions/audio/progressionPart.ts
import { Part } from "tone";

export interface ProgressionPartEvent {
  /** Audio time in seconds, relative to part start. */
  time: number;
  /** Index into the resolved step array — the React state target. */
  stepIndex: number;
  /** True when this event is the first bar of its step (drives the Jotai
   *  active-step write; continuation bars skip it). */
  isFirstBar: boolean;
  /** True when this event is the last bar of its step (gates passing
   *  `nextChordRoot` to the scheduler for chromatic-approach bass). */
  isLastBar: boolean;
  /** This bar's length in seconds. */
  durationSec: number;
  /** Cumulative offset from progression start (for setActiveStep). */
  cumulativeStartSec: number;
  /** Beats this bar carries (passes to scheduler.beatsAvailable). */
  beats: number;
}

export interface ProgressionPartOptions {
  events: readonly ProgressionPartEvent[];
  /** Total loop length. Required when loop=true; ignored when false. */
  totalDurationSec: number;
  loop: boolean;
  /** Fired once per bar, at the audio-precise scheduled time. */
  onEvent: (audioTime: number, event: ProgressionPartEvent) => void;
}

export interface ProgressionPartHandle {
  /**
   * Start the part. `time` is the transport time (audio seconds) to start
   * at; defaults to "now". `offset` is how many seconds into the part's
   * internal timeline to begin from; defaults to 0. Both forward verbatim
   * to `Tone.Part.start(time, offset)` — used for mid-playback position
   * preservation when the Part is rebuilt.
   */
  start: (time?: number, offset?: number) => void;
  /** Stop and dispose the part. Idempotent. */
  dispose: () => void;
}

/**
 * Thin wrapper over `Tone.Part` that pre-schedules one event per bar of a
 * FretFlow progression on Tone's transport clock. Multi-bar steps expand
 * upstream into per-bar events; loop-mode wraps via Tone's built-in
 * `loop`/`loopEnd` rather than via a JS-side advance loop.
 */
export function createProgressionPart(
  opts: ProgressionPartOptions,
): ProgressionPartHandle {
  const eventTuples: Array<[number, ProgressionPartEvent]> = opts.events.map(
    (e) => [e.time, e],
  );

  // The callback signature `(time, value)` matches Tone.Part's contract: time
  // is the audio-precise scheduled moment (Tone fires ~lookAhead seconds
  // before this in wall time so the consumer can pre-schedule sample-accurate
  // events into the future).
  const part = new Part((time: number, value: ProgressionPartEvent) => {
    opts.onEvent(time, value);
  }, eventTuples) as unknown as {
    start: (time?: number, offset?: number) => void;
    stop: () => void;
    dispose: () => void;
    loop: boolean;
    loopEnd: number;
  };

  part.loop = opts.loop;
  if (opts.loop) {
    part.loopEnd = opts.totalDurationSec;
  }

  let disposed = false;
  return {
    start(time?: number, offset?: number) {
      part.start(time, offset);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      part.stop();
      part.dispose();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/progressionPart.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/progressionPart.ts src/progressions/audio/progressionPart.test.ts
git commit -m "feat(audio): add Tone.Part wrapper for chord-onset scheduling"
```

---

### Task 2: Build the per-bar event grid from resolved steps

**Files:**
- Create: `src/progressions/audio/buildProgressionEvents.ts`
- Create: `src/progressions/audio/buildProgressionEvents.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/progressions/audio/buildProgressionEvents.test.ts
import { describe, expect, it } from "vitest";
import { buildProgressionEvents } from "./buildProgressionEvents";
import type { ResolvedProgressionStep } from "../progressionDomain";

const step = (
  overrides: Partial<ResolvedProgressionStep> = {},
): ResolvedProgressionStep => ({
  id: "x",
  degree: "I",
  duration: { value: 1, unit: "bar" },
  qualityOverride: null,
  root: "C",
  quality: "M",
  unavailable: false,
  ...overrides,
});

describe("buildProgressionEvents", () => {
  it("emits one event per bar with isFirstBar marked on each step boundary", () => {
    const out = buildProgressionEvents({
      steps: [
        step({ id: "a", duration: { value: 1, unit: "bar" } }),  // 1 bar  -> 1 event
        step({ id: "b", duration: { value: 2, unit: "bar" } }),  // 2 bars -> 2 events
        step({ id: "c", duration: { value: 1, unit: "bar" } }),  // 1 bar  -> 1 event
      ],
      tempoBpm: 60, // 1 beat = 1s; 1 bar (4 beats) = 4s
      beatsPerBar: 4,
    });
    expect(out.totalDurationSec).toBe(16);
    expect(out.events).toHaveLength(4);
    expect(out.events[0]).toMatchObject({ time: 0,  stepIndex: 0, isFirstBar: true,  isLastBar: true,  durationSec: 4, beats: 4, cumulativeStartSec: 0 });
    expect(out.events[1]).toMatchObject({ time: 4,  stepIndex: 1, isFirstBar: true,  isLastBar: false, durationSec: 4, beats: 4, cumulativeStartSec: 4 });
    expect(out.events[2]).toMatchObject({ time: 8,  stepIndex: 1, isFirstBar: false, isLastBar: true,  durationSec: 4, beats: 4, cumulativeStartSec: 8 });
    expect(out.events[3]).toMatchObject({ time: 12, stepIndex: 2, isFirstBar: true,  isLastBar: true,  durationSec: 4, beats: 4, cumulativeStartSec: 12 });
  });

  it("keeps sub-bar steps as a single short event", () => {
    const out = buildProgressionEvents({
      steps: [
        step({ id: "a", duration: { value: 2, unit: "beat" } }), // 2 beats -> 1 event of 2 beats
        step({ id: "b", duration: { value: 1, unit: "bar" } }),
      ],
      tempoBpm: 60,
      beatsPerBar: 4,
    });
    expect(out.events).toHaveLength(2);
    expect(out.events[0]).toMatchObject({ time: 0, stepIndex: 0, isFirstBar: true, isLastBar: true, durationSec: 2, beats: 2 });
    expect(out.events[1]).toMatchObject({ time: 2, stepIndex: 1, isFirstBar: true, isLastBar: true, durationSec: 4, beats: 4 });
    expect(out.totalDurationSec).toBe(6);
  });

  it("skips unresolvable steps but their duration still consumes timeline space", () => {
    const out = buildProgressionEvents({
      steps: [
        step({ id: "a" }),
        step({ id: "b", unavailable: true, root: null, quality: null }),
        step({ id: "c" }),
      ],
      tempoBpm: 60,
      beatsPerBar: 4,
    });
    expect(out.events.map((e) => e.stepIndex)).toEqual([0, 2]);
    expect(out.events[0].time).toBe(0);
    // The unavailable step (4s) still pushes step 2's start to t=8.
    expect(out.events[1].time).toBe(8);
    expect(out.totalDurationSec).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/buildProgressionEvents.test.ts`
Expected: FAIL — `Cannot find module './buildProgressionEvents'`.

- [ ] **Step 3: Implement**

```ts
// src/progressions/audio/buildProgressionEvents.ts
import type { ResolvedProgressionStep } from "../progressionDomain";
import type { ProgressionPartEvent } from "./progressionPart";

export interface BuildProgressionEventsInput {
  steps: readonly ResolvedProgressionStep[];
  tempoBpm: number;
  beatsPerBar: number;
}

export interface BuildProgressionEventsOutput {
  events: ProgressionPartEvent[];
  /** Total length of the full progression in seconds (loops here). */
  totalDurationSec: number;
}

/**
 * Convert FretFlow's resolved progression steps into a per-bar event list
 * for `Tone.Part`. Each event represents one bar of audio scheduling work:
 *
 *  - A bar-unit step expands into `step.duration.value` events, all sharing
 *    the same `stepIndex`. The first event of the run has `isFirstBar:true`
 *    so the audio-playback hook only fires the Jotai active-step write at
 *    real step boundaries (saves N-1 heavy React passes per N-bar chord).
 *  - A beat-unit step becomes a single event of duration `value * spb` and
 *    `beats: value` — a mixed-grid Tone.Part handles this fine.
 *
 * Unresolvable steps (no root/quality) are dropped from the event list but
 * still consume cumulative time so later events line up with what the user
 * hears on the audio clock.
 */
export function buildProgressionEvents(
  input: BuildProgressionEventsInput,
): BuildProgressionEventsOutput {
  const secondsPerBeat = 60 / Math.max(1, input.tempoBpm);
  const events: ProgressionPartEvent[] = [];
  let cumulativeSec = 0;
  input.steps.forEach((step, stepIndex) => {
    const scheduleThisStep = !step.unavailable && step.root && step.quality;

    if (step.duration.unit === "bar") {
      const barsPerStep = Math.max(1, Math.floor(step.duration.value));
      const beatsPerBarEvent = input.beatsPerBar;
      const secPerBarEvent = beatsPerBarEvent * secondsPerBeat;
      for (let bar = 0; bar < barsPerStep; bar++) {
        if (scheduleThisStep) {
          events.push({
            time: cumulativeSec,
            stepIndex,
            isFirstBar: bar === 0,
            isLastBar: bar === barsPerStep - 1,
            durationSec: secPerBarEvent,
            cumulativeStartSec: cumulativeSec,
            beats: beatsPerBarEvent,
          });
        }
        cumulativeSec += secPerBarEvent;
      }
    } else {
      // beat-unit step: one event for the whole step (sub-bar; never expands).
      const stepBeats = Math.max(0, step.duration.value);
      const stepDurationSec = stepBeats * secondsPerBeat;
      if (scheduleThisStep && stepDurationSec > 0) {
        events.push({
          time: cumulativeSec,
          stepIndex,
          isFirstBar: true,
          isLastBar: true,
          durationSec: stepDurationSec,
          cumulativeStartSec: cumulativeSec,
          beats: stepBeats,
        });
      }
      cumulativeSec += stepDurationSec;
    }
  });
  return { events, totalDurationSec: cumulativeSec };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/buildProgressionEvents.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildProgressionEvents.ts src/progressions/audio/buildProgressionEvents.test.ts
git commit -m "feat(audio): per-bar event grid builder for ProgressionPart"
```

---

### Task 3: Rewrite useProgressionAudioPlayback to drive playback from Tone.Part

This task replaces the segment queue, deletes `useProgressionPlaybackLoop`, and folds chord-overlay state advancement into the Part callback.

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Modify: `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx`
- Delete: `src/hooks/useProgressionPlaybackLoop.ts`
- Delete: `src/hooks/useProgressionPlaybackLoop.test.tsx`
- Create: `src/hooks/useProgressionAudioPlayback.test.tsx`

- [ ] **Step 1: Write the failing tests in the new file**

```tsx
// src/hooks/useProgressionAudioPlayback.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../test-utils/renderWithAtoms";
import { isMutedAtom } from "../store/audioAtoms";
import { chordRootAtom } from "../store/chordOverlayAtoms";
import {
  beatsPerBarAtom,
  progressionLoopEnabledAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";

// Mock Tone with a controllable Part + Transport. `start(offset)` records
// when the part was started; `simulateEvent(value)` invokes the callback
// with a constructed audio time so we can drive the React state from tests.
const toneMocks = vi.hoisted(() => {
  const contextNowRef = { fn: () => 0 };
  type Cb = (time: number, value: unknown) => void;

  interface PartInstance {
    callback: Cb;
    events: Array<[number, unknown]>;
    loop: boolean;
    loopEnd: number;
    startedTime: number | null;
    startedOffset: number | null;
    disposed: boolean;
    start(time?: number, offset?: number): PartInstance;
    stop(): PartInstance;
    dispose(): PartInstance;
  }
  const parts: PartInstance[] = [];

  function PartCtor(callback: Cb, events: Array<[number, unknown]>): PartInstance {
    const inst: PartInstance = {
      callback,
      events: [...events],
      loop: false,
      loopEnd: 0,
      startedTime: null,
      startedOffset: null,
      disposed: false,
      start(time?: number, offset?: number) {
        this.startedTime = time ?? 0;
        this.startedOffset = offset ?? 0;
        return this;
      },
      stop() { return this; },
      dispose() { this.disposed = true; return this; },
    };
    parts.push(inst);
    return inst;
  }

  const scheduleOnce = vi.fn((cb: (time: number) => void, time: string) => {
    const delayMs = Math.max(0, parseFloat((time as string).slice(1)) * 1000);
    setTimeout(() => cb(contextNowRef.fn()), delayMs);
    return 1;
  });
  const transport = {
    scheduleOnce,
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    bpm: { value: 120 },
    seconds: 0,
  };

  return {
    contextNowRef,
    parts,
    Part: PartCtor as unknown as new (...args: unknown[]) => unknown,
    getTransport: vi.fn(() => transport),
    getContext: vi.fn(() => ({
      now: () => contextNowRef.fn(),
      immediate: () => contextNowRef.fn(),
    })),
    now: vi.fn(() => contextNowRef.fn()),
    setContext: vi.fn(),
    transport,
    scheduleOnce,
  };
});

vi.mock("tone", () => ({
  Part: toneMocks.Part,
  getTransport: toneMocks.getTransport,
  getContext: toneMocks.getContext,
  now: toneMocks.now,
  setContext: toneMocks.setContext,
}));

import { _resetProgressionAudioForTests } from "../progressions/audio/bus";
import { _resetTimelineForTests } from "../progressions/audio/timeline";
import { useProgressionAudioPlayback } from "./useProgressionAudioPlayback";

function Harness() {
  useProgressionAudioPlayback();
  return null;
}

const threeChords = [
  { id: "one", degree: "I", duration: { value: 1, unit: "beat" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "beat" }, qualityOverride: null },
  { id: "three", degree: "vi", duration: { value: 1, unit: "beat" }, qualityOverride: null },
] as const;

describe("useProgressionAudioPlayback (Tone.Part driver)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    localStorage.clear();
    toneMocks.parts.length = 0;
    toneMocks.scheduleOnce.mockClear();
    _resetTimelineForTests();
    _resetProgressionAudioForTests();
    const audioContext = {
      get currentTime() { return Date.now() / 1000; },
      sampleRate: 44100,
      state: "running" as AudioContextState,
      createGain: () => ({
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          setTargetAtTime: vi.fn(),
        },
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
      }),
      destination: {} as AudioDestinationNode,
      resume: vi.fn(),
    };
    toneMocks.contextNowRef.fn = () => audioContext.currentTime;
    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () { return audioContext; }) as unknown as typeof AudioContext;
  });

  afterEach(() => { vi.useRealTimers(); });

  it("builds a Tone.Part with one event per resolvable chord", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChords],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts).toHaveLength(1);
    // Three 1-beat chords expand to three events (sub-bar steps, no per-bar
    // expansion). `startedTime` should be ~now + SCHEDULE_LEAD_SECONDS.
    expect(toneMocks.parts[0].events).toHaveLength(3);
    expect(toneMocks.parts[0].startedTime).not.toBeNull();
  });

  it("sets part.loop = true and loopEnd = totalDurationSec when loop is enabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChords],
      [progressionTempoBpmAtom, 60], // 1 beat = 1s; 3 beats = 3s
      [beatsPerBarAtom, 4],
      [progressionLoopEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts[0].loop).toBe(true);
    expect(toneMocks.parts[0].loopEnd).toBe(3);
  });

  it("advances chordRootAtom when the Part callback fires", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChords],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    expect(store.get(chordRootAtom)).toBe("C");

    const part = toneMocks.parts[0];
    const [secondEventTime, secondEventValue] = part.events[1];
    act(() => {
      // Simulate Tone firing the callback for chord 2 at the audio-precise
      // time. With our mock's `immediate()` returning the same value as the
      // passed time, the deferral collapses to 0 and the advance runs sync.
      part.callback(secondEventTime, secondEventValue);
    });
    expect(store.get(chordRootAtom)).toBe("G");
  });

  it("disposes the old Part and creates a new one when tempo changes", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChords],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts).toHaveLength(1);
    const firstPart = toneMocks.parts[0];

    act(() => { store.set(progressionTempoBpmAtom, 120); });

    expect(firstPart.disposed).toBe(true);
    expect(toneMocks.parts).toHaveLength(2);
    expect(toneMocks.parts[1].disposed).toBe(false);
  });

  it("disposes the Part on pause", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChords],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts[0].disposed).toBe(false);

    act(() => { store.set(setProgressionPlayingAtom, false); });

    expect(toneMocks.parts[0].disposed).toBe(true);
  });

  it("does not build a Part while muted", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChords],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [isMutedAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts).toHaveLength(0);
  });

  // Regression guard for the 2026-05-25 stall bug.
  it("does NOT wrap advanceProgressionPlayback in Tone.Draw or startTransition", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const raw = readFileSync(
      resolve(process.cwd(), "src/hooks/useProgressionAudioPlayback.ts"),
      "utf8",
    );
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    expect(code).not.toMatch(/Draw\.schedule/);
    expect(code).not.toMatch(/\bstartTransition\b/);
    expect(code).not.toMatch(/from\s+["']tone["'][^;]*\bDraw\b/);
  });
});
```

- [ ] **Step 2: Run the new tests — expect failure**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: FAIL — current `useProgressionAudioPlayback.ts` doesn't construct `Tone.Part`, so `toneMocks.parts` is empty.

- [ ] **Step 3: Rewrite `useProgressionAudioPlayback.ts`**

Replace the entire body of the file with the Tone.Part-driven implementation:

```ts
// src/hooks/useProgressionAudioPlayback.ts
import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { getContext, getTransport } from "tone";
import {
  ensureProgressionAudio,
  resumeProgressionAudio,
  restoreProgressionBus,
  silenceProgressionBus,
} from "../progressions/audio/bus";
import { buildProgressionEvents } from "../progressions/audio/buildProgressionEvents";
import {
  createProgressionPart,
  type ProgressionPartEvent,
  type ProgressionPartHandle,
} from "../progressions/audio/progressionPart";
import { scheduleProgressionStep } from "../progressions/audio/scheduler";
import {
  clearTimeline,
  pauseTimeline,
  setActiveStep,
} from "../progressions/audio/timeline";
import { isMutedAtom } from "../store/audioAtoms";
import {
  advanceProgressionPlaybackAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";
import {
  resolveBassLineNotes,
  resolveChordVoicing,
} from "../progressions/progressionAudio";
import { useProgressionState } from "./useProgressionState";

/** Lead between scheduling and audible hit; matches the previous scheduler. */
const SCHEDULE_LEAD_SECONDS = 0.05;

/**
 * Drive the progression backing track via a single `Tone.Part` that pre-
 * schedules every chord-onset event on the transport clock. The Part's
 * callback handles, in order, for each chord boundary:
 *   1. Audio: `scheduleProgressionStep(...)` for all drum/bass/strum hits.
 *   2. Timeline: `setActiveStep(...)` so the playhead reflects the new step.
 *   3. React state: a setTimeout-deferred `advanceProgressionPlayback()`
 *      Jotai write, aligned with audio onset by the Tone lookahead delta.
 *
 * Tone.Part owns the loop semantics (`part.loop = true`, `loopEnd =
 * totalDurationSec`). The hook rebuilds the Part on any input change
 * (tempo, steps, loop toggle, instrument); the new Part starts at the
 * current Transport position so playback continues from the current bar,
 * not from beat 0.
 */
export function useProgressionAudioPlayback() {
  const {
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionLoopEnabled,
    resolvedProgressionSteps,
    progressionTempoBpm,
    beatsPerBar,
    progressionStrumEnabled,
    progressionBassEnabled,
    progressionDrumsEnabled,
    progressionMetronomeEnabled,
    progressionChordInstrument,
    progressionChordPattern,
    progressionBassPattern,
    progressionDrumPattern,
    progressionDrumVariations,
    progressionSwing,
  } = useProgressionState();
  const isMuted = useAtomValue(isMutedAtom);
  const advance = useSetAtom(advanceProgressionPlaybackAtom);
  const setActiveStepIndex = useSetAtom(setProgressionActiveStepIndexAtom);
  const setPlaying = useSetAtom(setProgressionPlayingAtom);

  const partRef = useRef<ProgressionPartHandle | null>(null);
  const partStartAudioTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const disposePart = () => {
      if (partRef.current) {
        partRef.current.dispose();
        partRef.current = null;
        partStartAudioTimeRef.current = null;
      }
    };

    if (progressionPlaybackBlockedReason || isMuted) {
      disposePart();
      silenceProgressionBus();
      clearTimeline();
      return;
    }
    if (!progressionPlaying) {
      disposePart();
      silenceProgressionBus();
      pauseTimeline();
      return;
    }

    const audio = ensureProgressionAudio();
    if (!audio) return;
    void resumeProgressionAudio();
    restoreProgressionBus();

    const { events, totalDurationSec } = buildProgressionEvents({
      steps: resolvedProgressionSteps,
      tempoBpm: progressionTempoBpm,
      beatsPerBar,
    });

    if (events.length === 0 || totalDurationSec <= 0) {
      disposePart();
      return;
    }

    // Capture "now" once so all per-event closures share the same start
    // reference. Lead by SCHEDULE_LEAD_SECONDS to avoid scheduling at the
    // exact sample where Web Audio would drop the event.
    const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;

    const handle = createProgressionPart({
      events,
      totalDurationSec,
      loop: progressionLoopEnabled,
      onEvent: (audioTime, event) => {
        const step = resolvedProgressionSteps[event.stepIndex];
        if (!step || step.unavailable || !step.root || !step.quality) return;

        // 1. Schedule THIS BAR's audio events on the audio bus. `event.beats`
        //    is one bar (or the sub-bar step's beat count); the existing
        //    scheduler handles per-bar pattern repetition for us.
        //
        //    `nextChordRoot` only matters for chromatic-approach bass on the
        //    LAST bar of the current step. On continuation bars we pass the
        //    current root so any approach-resolution falls back to identity.
        const voicing = resolveChordVoicing(step.root, step.quality);
        const bassNotes = resolveBassLineNotes(step.root, step.quality);
        const secondsPerBeat = 60 / Math.max(1, progressionTempoBpm);
        const nextStep = resolvedProgressionSteps[event.stepIndex + 1];
        scheduleProgressionStep(audio.bus, {
          voicing,
          bassNotes,
          beatsAvailable: event.beats,
          beatsPerBar,
          secondsPerBeat,
          startTime: audioTime,
          enable: {
            strum: progressionStrumEnabled,
            bass: progressionBassEnabled,
            drums: progressionDrumsEnabled,
            metronome: progressionMetronomeEnabled,
          },
          chordInstrument: progressionChordInstrument,
          chordPatternId: progressionChordPattern,
          bassPatternId: progressionBassPattern,
          drumPatternId: progressionDrumPattern,
          drumVariations: progressionDrumVariations,
          swing: progressionSwing,
          currentRoot: step.root,
          currentQuality: step.quality,
          nextChordRoot: event.isLastBar ? (nextStep?.root ?? undefined) : step.root,
        });

        // 2. Publish the active step to the shared timeline (powers playhead).
        //    Use this BAR's start/duration so the playhead's local fraction
        //    resets each bar — the global fraction still scans the full
        //    progression evenly.
        setActiveStep(
          event.stepIndex,
          audioTime,
          event.durationSec,
          event.cumulativeStartSec,
          totalDurationSec,
        );

        // 3. Defer the React active-step swap by the Tone lookahead so the
        //    chord overlay flips at audio onset, not ~100ms early. Plain
        //    setTimeout — no Draw (250ms expiration), no startTransition.
        //    Only fire on first-bar-of-step events: continuation bars don't
        //    change which step is active, so skipping the Jotai write here
        //    saves N-1 heavy Fretboard re-renders per N-bar chord.
        if (event.isFirstBar) {
          const rawNow = getContext().immediate();
          const delayMs = Math.max(0, (audioTime - rawNow) * 1000);
          const applyAdvance = () => setActiveStepIndex(event.stepIndex);
          if (delayMs <= 0) applyAdvance();
          else window.setTimeout(applyAdvance, delayMs);
        }
      },
    });

    partRef.current = handle;
    partStartAudioTimeRef.current = partStart;

    // Transport must be running for Part callbacks to fire — Tone Clock only
    // emits tick events in the "started" state. Idempotent in Tone 15.
    getTransport().start();
    handle.start(partStart);

    // Non-loop progressions: schedule a one-shot pause at the natural end so
    // we stop playback without leaving the Part dangling. Loop mode skips
    // this — `part.loop` keeps firing callbacks indefinitely.
    let endEventId: number | null = null;
    if (!progressionLoopEnabled) {
      endEventId = getTransport().scheduleOnce(
        () => { setPlaying(false); },
        `+${totalDurationSec + SCHEDULE_LEAD_SECONDS}`,
      ) as unknown as number;
    }

    return () => {
      disposePart();
      if (endEventId !== null) getTransport().clear(endEventId);
    };
    // `advance` is read inside the Part callback, kept here only to satisfy
    // the linter without causing extra renders (it's a stable useSetAtom ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    progressionPlaying,
    progressionPlaybackBlockedReason,
    progressionLoopEnabled,
    resolvedProgressionSteps,
    isMuted,
    progressionTempoBpm,
    beatsPerBar,
    progressionStrumEnabled,
    progressionBassEnabled,
    progressionDrumsEnabled,
    progressionMetronomeEnabled,
    progressionChordInstrument,
    progressionChordPattern,
    progressionBassPattern,
    progressionDrumPattern,
    progressionDrumVariations,
    progressionSwing,
    setActiveStepIndex,
    setPlaying,
  ]);

  // Unused `advance` import would trigger noUnusedLocals; we still want it
  // exported as a stable reference for future callers (e.g. previous-step
  // button paths) but for this hook the Part callback is the only driver.
  void advance;
}
```

- [ ] **Step 4: Update ProgressionSummarySlot to drop the playback loop call**

```tsx
// src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx
// Remove these two lines:
//   import { useProgressionPlaybackLoop } from "../../hooks/useProgressionPlaybackLoop";
//   useProgressionPlaybackLoop();
// Keep the existing `useProgressionAudioPlayback()` call.
```

Verify the exact removal:

Run: `grep -n "useProgressionPlaybackLoop" src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx`
Expected: no matches.

- [ ] **Step 5: Delete the loop hook + its test**

```bash
rm src/hooks/useProgressionPlaybackLoop.ts src/hooks/useProgressionPlaybackLoop.test.tsx
```

- [ ] **Step 6: Run the new test suite + neighboring tests**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx src/progressions/audio/timeline.test.ts src/progressions/audio/scheduler.test.ts`
Expected: PASS — new hook tests green, timeline + scheduler unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx \
        src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx
git rm src/hooks/useProgressionPlaybackLoop.ts src/hooks/useProgressionPlaybackLoop.test.tsx
git commit -m "refactor(audio): drive progression playback from Tone.Part

Pre-schedules every chord-onset event on Tone.Transport via Tone.Part.
The Part's callback fires once per chord boundary at the audio-precise
time and (a) schedules the chord's drum/bass/strum/metronome hits via
the existing scheduler, (b) publishes the active step to timeline.ts
for the playhead, (c) defers the Jotai active-step write by the Tone
lookahead so the React chord overlay aligns with audio onset.

Loop semantics come from Tone (part.loop + loopEnd); the bespoke
useProgressionPlaybackLoop chain and its segment-queue companion are
deleted. The setTimeout-deferral pattern (no Draw, no startTransition)
is preserved inside the Part callback — the 250ms-expiration stall
cannot recur via this path."
```

---

### Task 4: Mid-playback rebuild preserves position

`useProgressionAudioPlayback` already rebuilds the Part on dep change (Task 3 effect). But the new Part starts at `audio.ctx.currentTime + LEAD`, i.e. bar 0 of the progression — losing the user's playback position. This task fixes that.

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Modify: `src/hooks/useProgressionAudioPlayback.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// Append to src/hooks/useProgressionAudioPlayback.test.tsx (inside the describe block):
it("preserves the current progression position when tempo changes mid-playback", () => {
  const store = makeAtomStore([
    [rootNoteAtom, "C"],
    [scaleNameAtom, "major"],
    [progressionStepsAtom, threeChords],
    [progressionTempoBpmAtom, 60], // 1 beat = 1s; total = 3s
    [beatsPerBarAtom, 4],
    [progressionLoopEnabledAtom, true],
  ]);
  store.set(setProgressionPlayingAtom, true);
  renderWithStore(<Harness />, store);

  const firstPart = toneMocks.parts[0];
  expect(firstPart.startedTime).toBeCloseTo(toneMocks.contextNowRef.fn() + 0.05, 2);
  expect(firstPart.startedOffset).toBe(0); // fresh start; no offset

  // Advance wall-clock to ~1.4s into playback (mid-step-1).
  act(() => { vi.advanceTimersByTime(1400); });

  // Tempo change: expect a NEW part whose internal cursor (startedOffset)
  // matches the elapsed position modulo total duration (=> ~1.4s into the
  // progression cycle, so the new Part's first-firing event is the one at
  // or after t=1.4 inside its own event list).
  act(() => { store.set(progressionTempoBpmAtom, 120); });

  const secondPart = toneMocks.parts[1];
  expect(secondPart.startedOffset).toBeCloseTo(1.4, 1);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "preserves"`
Expected: FAIL — `started` is `~0.05` not `~1.4`.

- [ ] **Step 3: Track the progression's start audio time and rebuild at the elapsed offset**

Edit `useProgressionAudioPlayback.ts`: replace the `partStart` assignment and the `handle.start(partStart)` call with:

```ts
    // If a previous Part exists, compute how far into the loop we are NOW.
    // Carry that as the offset for the new Part so the user doesn't jump
    // back to bar 0 on tempo / steps / instrument changes.
    let startOffset = 0;
    if (
      partStartAudioTimeRef.current !== null
      && totalDurationSec > 0
    ) {
      const elapsedSinceStart =
        audio.ctx.currentTime - partStartAudioTimeRef.current;
      startOffset = ((elapsedSinceStart % totalDurationSec) + totalDurationSec)
        % totalDurationSec;
    }

    // The Part should "appear to have started" `startOffset` seconds ago, so
    // its event #0 lines up with the current loop position. Tone.Part.start
    // accepts (transportTime, partOffset) — passing `0` as transportTime
    // means "right now", and `startOffset` as the second arg means "skip
    // ahead inside the part by that many seconds".
    //
    // partStartAudioTimeRef tracks "the audio time at which event #0 of the
    // current Part conceptually fired" — useful for the next rebuild.
    const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS - startOffset;
```

Then change the `handle.start(partStart)` call inside `useProgressionAudioPlayback.ts` to use Tone.Part's `(time, offset)` form (Task 1 already shipped the matching wrapper signature):

```ts
    // start(time, offset) — Tone schedules Part to begin at audio time
    // `now + LEAD` with internal cursor at `startOffset`. For first-start
    // (no previous part) `startOffset` is 0 and behavior matches Task 3.
    handle.start(audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS, startOffset);
```

And update `partStartAudioTimeRef.current = partStart;` to `partStartAudioTimeRef.current = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS - startOffset;` so the next rebuild correctly computes `elapsedSinceStart` against the conceptual event-0 time.

- [ ] **Step 4: Run the targeted tests**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS (all tests including the new "preserves position" test).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx
git commit -m "fix(audio): preserve progression position when Part rebuilds mid-playback"
```

---

### Task 5: Full verification + e2e + visual

**Files:** none modified (verification only).

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 2: Full unit test suite**

Run: `pnpm test`
Expected: all suites green. The new `useProgressionAudioPlayback.test.tsx` and `progressionPart.test.ts` + `buildProgressionEvents.test.ts` add tests; `useProgressionPlaybackLoop.test.tsx` is gone. Net change in test count should match those deltas.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 4: E2E (production preview)**

Run: `pnpm test:e2e:production`
Expected: all green. Pay attention to:
- `e2e/progression.visual.spec.ts` — chord swap timing assertions, if any, may now land on the audio-precise frame instead of the lookahead-early frame; expect potential visual diffs at chord boundaries.
- `e2e/storage-persistence.spec.ts` — must still pass (loop toggle, tempo, steps all persist).

- [ ] **Step 5: Refresh visual baselines**

Run: `pnpm test:visual:update`
Expected: baselines refresh for any frames that capture mid-playback chord-boundary state. Inspect the diff before committing — a 1-frame shift at boundaries is expected; anything else needs investigation.

- [ ] **Step 6: Commit refreshed baselines (if any)**

```bash
git add e2e/**/*-snapshots/**
git status   # confirm only baseline images changed
git commit -m "test(visual): refresh baselines after Tone.Part scheduler migration"
```

- [ ] **Step 7: Final sanity check**

Run: `git log --oneline origin/claude/elated-nobel-dd4e76..HEAD`
Expected: 5–6 new commits (one per task plus visual baseline refresh if applicable).

---

## Verification summary

After Task 5 the branch should have:

1. ✅ `lint` clean.
2. ✅ Full unit suite green; net test count = previous + ~10 (new Part + builder + hook tests) − previous loop tests.
3. ✅ `pnpm build` succeeds.
4. ✅ `pnpm test:e2e:production` green.
5. ✅ Visual baselines refreshed (if needed) and explained in the commit message.
6. ✅ Manual smoke check: progression loops cleanly across the boundary; chord overlay flips at audio onset (no longer leads by ~100 ms); pausing mid-bar holds position; resuming continues from there; tempo change mid-playback continues from the same position.
7. ✅ `useProgressionPlaybackLoop` is gone from the codebase; `git grep useProgressionPlaybackLoop` returns nothing.
8. ✅ Regression guard test asserts the new hook never imports `Draw` or uses `startTransition` around `advance`.
