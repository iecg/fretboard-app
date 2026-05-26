# Audio-Locked Visual Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the visible chord-transition stutter on both the progression timeline AND the fretboard overlay by sourcing the active-step index from the audio clock via a single RAF driver instead of `Tone.Draw.schedule(...)`.

**Architecture:** Add a per-frame RAF driver (`visualClock.ts`) that polls `getTimelinePosition()` and writes a new primitive `displayedStepIndexPrimitiveAtom`. A derived `displayedProgressionStepIndexAtom` returns the RAF-written value while playing and falls back to the canonical `activeProgressionStepIndexAtom` when stopped. Every visual derivation (chord overlay highlights, lens pitch sets, ProgressionTrack active block) switches its read site from the logical atom to the displayed atom. The Draw-scheduled logical write is kept (it settles editor state on chord boundaries without affecting visuals).

**Tech Stack:** React 19 + React Compiler, Jotai (with custom store), Tone.js, vitest, `requestAnimationFrame`, the existing `src/progressions/audio/timeline.ts` audio-clock module.

---

## Root cause recap (read first)

`useProgressionAudioPlayback.ts:215-224` schedules the React-atom write through `Tone.Draw.schedule(cb, audioTime)`. `audioTime` is `partStart + SCHEDULE_LEAD_SECONDS` ahead of the wall clock. `Draw` fires the callback at the next `requestAnimationFrame` whose `performance.now()` has passed `audioTime`. With even a 30ms-busy main thread, that RAF can land 50-100ms after the audio boundary — but the playhead (`ProgressionPlayhead`) reads `getTimelinePosition()` from its own RAF loop and advances on the audio-accurate frame. Result: highlight trails playhead by 1-2 frames every chord change.

The unstaged diff on `src/components/ProgressionTrack/ProgressionBlock.tsx` and `src/components/ProgressionTrack/ProgressionTrack.tsx` patches this by polling `getTimelinePosition()` in an RAF loop and imperatively flipping `data-active` on block refs. It works but: (a) only covers the timeline, (b) bypasses React reconciliation in a way that doesn't compose with the rest of the atom-driven UI (FretboardSVG, lens overlays, position readouts). This plan replaces that imperative patch with a unified mirror-atom mechanism that fixes the timeline AND the fretboard in one stroke.

The same root cause affects every visual derived from `activeProgressionStepIndexAtom`: `activeResolvedProgressionStepAtom` → `chordHighlightPositionsAtom` (fretboard), `activeChordRootAtom`/`activeChordQualityAtom` (chord-tab UI), `nextChordTonesAtom`/`commonTonesWithNextAtom`/`nextChordGuideTonesAtom` (Lead lens anticipation). Switching the **read site** of these derivations from `activeProgressionStepIndexAtom` to the new `displayedProgressionStepIndexAtom` migrates them all simultaneously.

---

## File map

**Create**

- `src/progressions/audio/visualClock.ts` — singleton RAF driver + start/stop API. Reads `getTimelinePosition()` each frame; calls `store.set(displayedStepIndexPrimitiveAtom, stepIndex)` only on change. Owns its own `requestAnimationFrame` id. Accepts a Jotai store reference on `start(store)`.
- `src/progressions/audio/visualClock.test.ts` — vitest unit test using fake timers + fake RAF + a stub `getTimelinePosition()` to assert: writes on change, no-op on same value, stops on `stop()`.

**Modify**

- `src/store/progressionAtoms.ts` — add `displayedStepIndexPrimitiveAtom` (RAF-written primitive) and `displayedProgressionStepIndexAtom` (derived: `playing ? primitive : logical`). Add re-exports as needed.
- `src/store/progressionAtoms.ts` — rewire `activeResolvedProgressionStepAtom` and `activeProgressionStepAtom` to read from `displayedProgressionStepIndexAtom` (not `activeProgressionStepIndexAtom`). The current bar / position-readout reads stay on the logical atom (they're for the editor's logical position, not for chord visuals).
- `src/store/practiceLensAtoms.ts:359,410` — switch `nextChordTonesAtom` and `nextChordGuideTonesAtom` to read `displayedProgressionStepIndexAtom`. (`commonTonesWithNextAtom` already reads `activeResolvedProgressionStepAtom`, which migrates transitively.)
- `src/hooks/useProgressionAudioPlayback.ts` — import `useStore` from jotai; on the playing-true branch, call `visualClock.start(store)`; on cleanup, call `visualClock.stop()`. KEEP the `Draw.schedule(() => setActiveStepIndex(event.stepIndex), audioTime)` write — it settles the editor's logical state without affecting visuals.
- `src/components/ProgressionTrack/ProgressionTrack.tsx` — revert the unstaged RAF + refs imperative patch; read `displayedProgressionStepIndexAtom` instead of `activeProgressionStepIndexAtom` to drive the block's `active` prop.
- `src/components/ProgressionTrack/ProgressionBlock.tsx` — revert the unstaged `forwardRef` wrapping; component goes back to a plain `memo(ProgressionBlockComponent)`.
- `src/components/ProgressionTrack/ProgressionTrack.test.tsx` — keep existing tests passing; add one new test that simulates playback and asserts the active block follows `displayedProgressionStepIndexAtom` writes.

**Untouched**

- `src/progressions/audio/timeline.ts` — the audio-clock source of truth. No changes; it's already correct.
- `ProgressionPlayhead` — already pulls from `getTimelinePosition()`. No changes.
- `FretboardSVG` — already consumes `chordHighlightPositionsAtom` etc. It picks up the new audio-locked timing automatically when those derived atoms switch their source.
- Editor / SongControls — they read `activeProgressionStepIndexAtom` (logical) as today. Editor selection state is decoupled from playback visuals.

---

## Reused utilities

- `getTimelinePosition()` / `setActiveStep()` from `src/progressions/audio/timeline.ts` — the canonical audio-clock state.
- `useStore` from `jotai` — to get a stable store handle inside the playback hook for the RAF driver to write into.
- Existing vitest fake-timer + RAF-stub patterns in `src/progressions/audio/timeline.test.ts` and `src/components/ProgressionTrack/ProgressionTrack.test.tsx`.

---

## Task list

### Task 1: Add primitive + derived "displayed" atoms

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/store/progressionAtoms.test.ts`:

```ts
describe("displayedProgressionStepIndexAtom", () => {
  it("returns logical index when not playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" } },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" } },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 1);
    expect(store.get(displayedProgressionStepIndexAtom)).toBe(1);
  });

  it("returns RAF-written primitive when playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" } },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" } },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(setProgressionPlayingAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    expect(store.get(displayedProgressionStepIndexAtom)).toBe(1);
  });

  it("ignores stale primitive after playback stops", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" } },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" } },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    expect(store.get(displayedProgressionStepIndexAtom)).toBe(0);
  });
});
```

Add the missing imports (`displayedProgressionStepIndexAtom`, `displayedStepIndexPrimitiveAtom`, `setProgressionPlayingAtom`) at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "displayedProgressionStepIndexAtom"`
Expected: FAIL with "displayedProgressionStepIndexAtom is not defined" (or similar).

- [ ] **Step 3: Add the atoms**

In `src/store/progressionAtoms.ts`, immediately after the `activeProgressionStepIndexAtom` definition (currently line ~286), insert:

```ts
/**
 * Primitive RAF-written mirror of the active step index. Written by
 * `visualClock.ts` every animation frame during playback whenever the audio
 * clock crosses into a new step. Stays whatever value it last held when
 * playback stops — consumers should read `displayedProgressionStepIndexAtom`
 * instead, which routes to the logical atom when paused/stopped.
 *
 * Exported for tests and for the visual clock module; UI code should NOT
 * read this directly.
 */
export const displayedStepIndexPrimitiveAtom = atom(0);

/**
 * The step index every chord-visual derivation should read.
 *
 * - During playback: returns the RAF-written primitive, which advances on the
 *   exact frame the audio clock crosses into the next step (same source the
 *   playhead pulls from). Eliminates the `Tone.Draw` scheduling lag that
 *   caused the highlight to trail the playhead by 1-2 frames per chord
 *   transition.
 * - When stopped/paused: returns the canonical logical index, so editor
 *   selection and chord overlays reflect whichever step the user has
 *   clicked on.
 */
export const displayedProgressionStepIndexAtom = atom((get) => {
  if (get(progressionPlayingAtom)) {
    return get(displayedStepIndexPrimitiveAtom);
  }
  return get(activeProgressionStepIndexAtom);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "displayedProgressionStepIndexAtom"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(store): add displayed step index mirror atoms"
```

---

### Task 2: Build the visual clock RAF driver

**Files:**
- Create: `src/progressions/audio/visualClock.ts`
- Test: `src/progressions/audio/visualClock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/progressions/audio/visualClock.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";
import {
  displayedStepIndexPrimitiveAtom,
} from "../../store/progressionAtoms";
import { startVisualClock, stopVisualClock } from "./visualClock";
import * as timeline from "./timeline";

describe("visualClock", () => {
  let rafCb: FrameRequestCallback | null = null;
  let rafId = 0;
  beforeEach(() => {
    rafId = 0;
    rafCb = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCb = cb;
      return ++rafId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => {
    stopVisualClock();
    vi.restoreAllMocks();
  });

  function tick() {
    const cb = rafCb;
    rafCb = null;
    cb?.(performance.now());
  }

  it("writes stepIndex to the primitive atom every frame stepIndex changes", () => {
    const store = createStore();
    const positions = [
      { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false },
      { stepIndex: 0, globalFraction: 0.5, localFraction: 0.5, paused: false },
      { stepIndex: 1, globalFraction: 0.6, localFraction: 0, paused: false },
    ];
    let i = 0;
    vi.spyOn(timeline, "getTimelinePosition").mockImplementation(
      () => positions[Math.min(i, positions.length - 1)] ?? null,
    );

    startVisualClock(store);

    tick(); i++;
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(0);
    tick(); i++;
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(0);
    tick();
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(1);
  });

  it("is idempotent on start", () => {
    const store = createStore();
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 2, globalFraction: 0, localFraction: 0, paused: false,
    });
    startVisualClock(store);
    startVisualClock(store); // second call must not double-schedule
    tick();
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(2);
  });

  it("stops scheduling after stop()", () => {
    const store = createStore();
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 3, globalFraction: 0, localFraction: 0, paused: false,
    });
    startVisualClock(store);
    tick();
    stopVisualClock();
    expect(rafCb).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/visualClock.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the driver**

Create `src/progressions/audio/visualClock.ts`:

```ts
/**
 * Singleton RAF driver that mirrors the audio-clock step index into a Jotai
 * atom every animation frame. Decouples chord-visual highlighting from
 * `Tone.Draw.schedule`, which trails the audio clock by 50-100ms under main-
 * thread load and caused a visible 1-2 frame stutter at every chord
 * transition.
 *
 * Lifecycle is owned by `useProgressionAudioPlayback.ts`:
 *  - On playback start: `startVisualClock(store)` (after the Jotai store
 *    handle is in scope).
 *  - On playback stop / hook cleanup: `stopVisualClock()`.
 *
 * The driver is a no-op outside playback (idempotent start, safe stop). It
 * does NOT write while `getTimelinePosition()` returns null (pre-first-event)
 * or `paused` (the displayed atom falls back to logical when not playing
 * anyway, so writes during pause would be redundant).
 */
import type { Store } from "../../store/storeTypes";
import { displayedStepIndexPrimitiveAtom } from "../../store/progressionAtoms";
import { getTimelinePosition } from "./timeline";

let rafId: number | null = null;
let storeRef: Store | null = null;
let lastWritten = Number.NaN;

function frame(): void {
  const store = storeRef;
  if (!store) return;
  const tl = getTimelinePosition();
  if (tl && !tl.paused) {
    if (tl.stepIndex !== lastWritten) {
      lastWritten = tl.stepIndex;
      store.set(displayedStepIndexPrimitiveAtom, tl.stepIndex);
    }
  }
  rafId = window.requestAnimationFrame(frame);
}

export function startVisualClock(store: Store): void {
  storeRef = store;
  if (rafId !== null) return;          // idempotent
  lastWritten = Number.NaN;            // force first write to land
  rafId = window.requestAnimationFrame(frame);
}

export function stopVisualClock(): void {
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  storeRef = null;
  lastWritten = Number.NaN;
}
```

Also create `src/store/storeTypes.ts` (one-line module to avoid a tight import cycle and for shared use):

```ts
import type { createStore } from "jotai";

/** Concrete type of the Jotai store returned by `createStore()` / `useStore()`. */
export type Store = ReturnType<typeof createStore>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/visualClock.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/visualClock.ts src/progressions/audio/visualClock.test.ts src/store/storeTypes.ts
git commit -m "feat(audio): add visualClock RAF driver for audio-locked visual sync"
```

---

### Task 3: Wire driver lifecycle into playback hook

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/useProgressionAudioPlayback.test.tsx`:

```ts
it("starts visual clock on playback and stops it on teardown", async () => {
  const startSpy = vi.spyOn(await import("../progressions/audio/visualClock"), "startVisualClock");
  const stopSpy = vi.spyOn(await import("../progressions/audio/visualClock"), "stopVisualClock");

  const { unmount } = renderPlaybackHookWithProgression();
  await act(async () => {
    setPlaying(true);
    await flushAsync();
  });
  expect(startSpy).toHaveBeenCalledTimes(1);

  unmount();
  expect(stopSpy).toHaveBeenCalled();
});
```

(Use the existing test harness in `useProgressionAudioPlayback.test.tsx`. If the helper functions `renderPlaybackHookWithProgression` / `setPlaying` / `flushAsync` are named differently in the file, adapt to the existing API rather than introducing new wrappers.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "visual clock"`
Expected: FAIL — driver not wired yet.

- [ ] **Step 3: Wire the driver**

In `src/hooks/useProgressionAudioPlayback.ts`:

Add to the imports:

```ts
import { useStore } from "jotai";
import { startVisualClock, stopVisualClock } from "../progressions/audio/visualClock";
```

Inside `useProgressionAudioPlayback`, after the existing `useSetAtom` calls:

```ts
const store = useStore();
```

Inside the main effect's `tearDown` function, add at the top:

```ts
stopVisualClock();
```

Inside the main effect, immediately after `if (!playing) { tearDown(); engine?.pauseTimeline(); return; }`, add:

```ts
startVisualClock(store);
```

In the effect's cleanup function (currently lines 297-308), add at the top:

```ts
stopVisualClock();
```

Also add `store` to the effect's dependency array.

**Keep** the existing `eng.getDraw().schedule(() => setActiveStepIndex(event.stepIndex), audioTime)` call unchanged — it still settles the editor's logical state on chord boundaries; only the *visual* read path moves to the RAF mirror.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "visual clock"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx
git commit -m "feat(playback): start/stop visualClock with playback lifecycle"
```

---

### Task 4: Rewire chord-visual derivations to displayed atom

**Files:**
- Modify: `src/store/progressionAtoms.ts:351-359`
- Modify: `src/store/practiceLensAtoms.ts:359,410`
- Test: `src/store/practiceLens.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/store/practiceLens.test.ts`:

```ts
describe("chord-visual derivations follow displayedProgressionStepIndexAtom during playback", () => {
  it("activeResolvedProgressionStepAtom mirrors RAF-written index while playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" } },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" } },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);   // logical = 0
    store.set(setProgressionPlayingAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 1);     // RAF advances to 1
    expect(store.get(activeResolvedProgressionStepAtom)?.degree).toBe("V");
  });

  it("activeResolvedProgressionStepAtom falls back to logical when not playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" } },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" } },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(displayedStepIndexPrimitiveAtom, 1);     // stale RAF write
    expect(store.get(activeResolvedProgressionStepAtom)?.degree).toBe("I");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/practiceLens.test.ts -t "follow displayedProgressionStepIndexAtom"`
Expected: FAIL — derived atoms still read logical index.

- [ ] **Step 3: Switch the read sites**

In `src/store/progressionAtoms.ts`, replace lines 351-359:

```ts
export const activeProgressionStepAtom = atom((get) => {
  const steps = get(progressionStepsAtom);
  return steps[clampProgressionIndex(get(displayedProgressionStepIndexAtom), steps)] ?? null;
});

export const activeResolvedProgressionStepAtom = atom((get) => {
  const steps = get(resolvedProgressionStepsAtom);
  return steps[clampProgressionIndex(get(displayedProgressionStepIndexAtom), steps)] ?? null;
});
```

In `src/store/practiceLensAtoms.ts`:
- Line 47: add `displayedProgressionStepIndexAtom` alongside `activeProgressionStepIndexAtom` in the import block from `./progressionAtoms`.
- Line 359 (`nextChordTonesAtom`): change `const active = get(activeProgressionStepIndexAtom);` to `const active = get(displayedProgressionStepIndexAtom);`
- Line 410 (`nextChordGuideTonesAtom`): change `const active = get(activeProgressionStepIndexAtom);` to `const active = get(displayedProgressionStepIndexAtom);`

Leave `currentProgressionBarAtom` (line 315-324) reading `activeProgressionStepIndexAtom` — the bar counter is for editor/status display, not for chord visuals; flipping it on every RAF write would be wasteful.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/store/`
Expected: PASS (all store tests, including the new ones).

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/practiceLensAtoms.ts src/store/practiceLens.test.ts
git commit -m "refactor(store): chord-visual derivations read displayed step index"
```

---

### Task 5: Revert unstaged imperative track patch, switch to atom

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionBlock.tsx`
- Test: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/ProgressionTrack/ProgressionTrack.test.tsx`:

```ts
it("active block follows displayedProgressionStepIndexAtom during playback", async () => {
  const store = createStore();
  store.set(progressionStepsAtom, [
    { id: "a", degree: "I", duration: { value: 1, unit: "bar" } },
    { id: "b", degree: "V", duration: { value: 1, unit: "bar" } },
  ] as never);
  store.set(setProgressionActiveStepIndexAtom, 0);
  store.set(setProgressionPlayingAtom, true);

  render(
    <Provider store={store}>
      <ProgressionTrack />
    </Provider>,
  );

  // Initial: primitive defaults to 0
  expect(screen.getAllByRole("button")[0]).toHaveAttribute("data-active", "true");

  await act(async () => {
    store.set(displayedStepIndexPrimitiveAtom, 1);
  });

  expect(screen.getAllByRole("button")[1]).toHaveAttribute("data-active", "true");
  expect(screen.getAllByRole("button")[0]).not.toHaveAttribute("data-active", "true");
});
```

- [ ] **Step 2: Run test to verify it fails (or asserts on the imperative diff)**

Run: `pnpm vitest run src/components/ProgressionTrack/ProgressionTrack.test.tsx -t "follows displayedProgressionStepIndexAtom"`
Expected: FAIL — the existing implementation reads the wrong atom, or its imperative RAF doesn't fire under fake timers.

- [ ] **Step 3: Revert the imperative patch and switch to atom**

Discard the unstaged changes in `ProgressionTrack.tsx` and `ProgressionBlock.tsx`:

```bash
git checkout HEAD -- src/components/ProgressionTrack/ProgressionTrack.tsx src/components/ProgressionTrack/ProgressionBlock.tsx
```

Then in `src/components/ProgressionTrack/ProgressionTrack.tsx`, change the active-block subscription. Replace the existing `activeProgressionStepIndexAtom` read (driving the block's `active` prop) with `displayedProgressionStepIndexAtom`. Concretely: locate the `useAtomValue(activeProgressionStepIndexAtom)` (or its access via `useProgressionState`) used to compute `index === activeProgressionStepIndex` in the block map (file line ~155 in the unstaged version; in the post-revert version it's already in the map closure). Switch the subscription to read `displayedProgressionStepIndexAtom` instead. If the read happens through `useProgressionState`, add a new field `displayedProgressionStepIndex` to that hook and read it here.

Concretely, in `src/hooks/useProgressionState.ts`, add:

```ts
import { displayedProgressionStepIndexAtom } from "../store/progressionAtoms";
// ... inside the hook return object:
displayedProgressionStepIndex: useAtomValue(displayedProgressionStepIndexAtom),
```

Then in `ProgressionTrack.tsx`, where the block's `active={index === activeProgressionStepIndex}` is rendered (currently sourced from `useProgressionState`), change to `active={index === displayedProgressionStepIndex}`.

The `onSelect` click handler keeps writing to the LOGICAL atom (`setProgressionActiveStepIndexAtom`) — clicking a block while paused selects that step in the editor.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/ProgressionTrack/`
Expected: PASS (existing tests still pass; new one passes).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionState.ts src/components/ProgressionTrack/
git commit -m "refactor(track): active block follows displayed step index"
```

---

### Task 6: Verify fretboard chord overlay locks to audio

**Files:**
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx` (or wherever chord overlay rendering is exercised)

- [ ] **Step 1: Write the verifying test**

Append to the most appropriate fretboard chord-overlay test file (look for one that already exercises `chordHighlightPositionsAtom`; if none exists, create `src/store/chordOverlayAtoms.test.ts`):

```ts
it("chordHighlightPositionsAtom advances with displayedStepIndexPrimitiveAtom during playback", () => {
  const store = createStore();
  store.set(progressionStepsAtom, [
    { id: "a", degree: "I", duration: { value: 1, unit: "bar" } },
    { id: "b", degree: "V", duration: { value: 1, unit: "bar" } },
  ] as never);
  store.set(setProgressionActiveStepIndexAtom, 0);
  store.set(setProgressionPlayingAtom, true);

  const before = store.get(chordHighlightPositionsAtom);

  store.set(displayedStepIndexPrimitiveAtom, 1);
  const after = store.get(chordHighlightPositionsAtom);

  // Different chord = different highlight set.
  expect(after).not.toEqual(before);
});
```

(Import `chordHighlightPositionsAtom` from `src/store/chordOverlayAtoms.ts`.)

- [ ] **Step 2: Run test to verify it passes (after Task 4 changes)**

Run: `pnpm vitest run -t "chordHighlightPositionsAtom advances"`
Expected: PASS — Task 4 already rewired the upstream atoms.

- [ ] **Step 3: Commit**

```bash
git add <the test file>
git commit -m "test(fretboard): regression-guard chord overlay audio-lock"
```

---

### Task 7: Full local verification + visual baseline refresh

**Files:** none modified directly.

- [ ] **Step 1: Lint + unit + build + e2e**

Run:

```bash
pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production
```

Expected: all four commands exit 0.

- [ ] **Step 2: Manual smoke test in dev**

Run: `pnpm dev`.
With the dev server open: enable Chord overlay, load a I-IV-V progression, press Play. Confirm:
1. The active block in the timeline flips at the exact moment the playhead reaches it (no perceived trail).
2. The fretboard chord highlight changes on the same frame as the timeline block.
3. Pausing snaps both displays to the current chord; resuming continues from the same chord.

- [ ] **Step 3: Refresh visual baselines**

Run: `pnpm test:visual:update`.
Expected: snapshots regenerate. Inspect the diff for any unexpected change beyond timing-adjacent pixels.

- [ ] **Step 4: Commit visuals**

```bash
git add e2e/**/*-snapshots/
git commit -m "test(visual): refresh baselines for audio-locked visual sync"
```

---

## Stretch tasks (optional — explore only if Task 1-7 ship cleanly and the user still wants to compare)

### Stretch S1: `useSyncExternalStore` selector variant

Build a parallel `useTimelineStepIndex()` hook that wraps `useSyncExternalStore` over a tiny pub/sub keyed off `getTimelinePosition()`. Drop the `displayedStepIndexPrimitiveAtom` write entirely — the RAF driver instead pumps an emitter inside the new store. Compare:
- React DevTools highlight count per second
- Time-to-paint of a chord boundary (Performance panel)

Decision criteria: pick the winner; revert the other.

### Stretch S2: Imperative DOM patch for FretboardSVG hot path

If the atom-driven path still shows React reconciliation cost at 60Hz under DevTools profiling, add an `<svg>`-level ref + RAF loop that patches `class` / `data-role` attributes on the affected `<circle>` / `<polygon>` elements directly, bypassing reconciliation. Scope strictly to the chord-tones highlight (don't bypass the rest of the SVG render pipeline). This is the highest-perf but most-fragile option — only ship it with profiling evidence justifying the maintenance cost.

---

## Verification

1. **Unit:** all of `pnpm test` green, including the new tests in Tasks 1, 2, 3, 4, 5, 6.
2. **Lint:** `pnpm lint` clean (no new ESLint or stylelint findings).
3. **Build:** `pnpm build` succeeds (TypeScript and Vite).
4. **E2E:** `pnpm test:e2e:production` passes — includes the playback smoke test in `e2e/`.
5. **Visual:** `pnpm test:visual` passes against the refreshed darwin baselines.
6. **Manual:** chord transitions on both timeline AND fretboard advance on the same frame as the playhead, with no visible trail.

---

## Self-review (post-write)

**1. Spec coverage:**
- (a) Eliminate timeline highlight stutter → Tasks 1, 2, 3, 5.
- (b) Apply same mechanism to fretboard → Tasks 1, 2, 3, 4, 6.
- (c) Unify under one pattern (drop unstaged ref-based fix) → Task 5 explicitly reverts and replaces.
- (d) Keep `activeProgressionStepIndexAtom` as the logical/editor source → Task 4 leaves `currentProgressionBarAtom` and the SongControls reads untouched; only chord-visual derivations switch.

**2. Placeholder scan:** no "TBD", "implement later", or "add appropriate error handling" remain. All steps that change code include the code.

**3. Type consistency:**
- `startVisualClock(store: Store)` / `stopVisualClock()` — consistent across Tasks 2, 3 and the test in Task 3.
- `displayedStepIndexPrimitiveAtom` / `displayedProgressionStepIndexAtom` names used identically in Tasks 1, 2, 4, 5, 6.
- `Store` type alias defined in Task 2 (`src/store/storeTypes.ts`) and imported in Task 2's driver.
