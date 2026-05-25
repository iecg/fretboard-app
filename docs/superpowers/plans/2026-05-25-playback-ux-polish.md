# Progression Playback UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the progression-playback UX along three axes — block destructive/seek user actions while playing, replace the chord-overlay `setTimeout` deferral with `Tone.Draw` (raised expiration), and surface a loading state on the play button while audio is spinning up.

**Architecture:** Four independent phases, each shippable on its own. Phase P1 locks the user actions that desync the cursor from audio (prev/next/timeline-click) AND the structural edits that would force a rebuild-from-bar-0 (per-step edits, structure changes, preset loads, key/scale); allows style switches (pattern selects, drum variations, genre, chord instrument) to keep their current rebuild behavior because they're useful mid-jam. Phase P2 swaps the chord-overlay advance from `window.setTimeout(advance, time - immediate())` to `Tone.Draw.schedule(advance, audioTime)` with `Draw.expiration` raised to 5s so heavy renders don't silently drop. Phase P3 adds a transient `progressionPlaybackLoadingAtom`, pre-warms `ensureProgressionAudio()` on first interaction, and renders a spinner in the play button until the first chord-onset callback fires. Phase P5 promotes the Loop toggle out of `buildKey` and handles it transparently via live `Tone.Part.loop = boolean` writes + dynamic end-event rescheduling.

**Action policy (locked in from scope decision):** Three categories of user action map to three responses during playback:

| Category | Examples | Mid-play behavior |
|---|---|---|
| **Desync bugs** | Prev / Next / click timeline block | **Locked** (would move cursor only; audio keeps playing its own schedule) |
| **Structural / content edits** | Edit chord degree/quality/duration, Move/Duplicate/Delete/Add step, Preset select, Key root, Scale | **Locked** (would rebuild from bar 0 mid-jam — surprising) |
| **Style switches** | Chord/Bass/Drum pattern, Drum variations, Genre style, Chord instrument | **Allowed** (rebuild from bar 0 today; useful for "audition this drum pattern" — acceptable for now) |
| **Live updates** | BPM, Swing, Time signature, Layer mutes, Loop toggle (Phase P5) | **Allowed, smooth** (no rebuild) |

**Deferred (feasibility noted, not in this plan):** A future enhancement could replace the rebuild-from-bar-0 path with a rebuild-then-resume-at-next-bar path via `Tone.Part.start(time, offset)`, where `time = ceil(Transport.seconds / barLen) * barLen` and `offset` is the matching offset into the new event timeline. Confirmed feasible with existing Tone APIs (~50–100 lines); not adopted here per scope decision.

**Tech Stack:** React 19 + Jotai atoms (`useAtomValue`, `useSetAtom`), Tone.js v15 (`Tone.Draw`, `Tone.Part`, `Transport`), lucide-react icons, vitest + jsdom.

---

## File Map

**Modify:**
- `src/store/progressionAtoms.ts` — add `progressionPlaybackLoadingAtom`. Wire `previousProgressionStepAtom` and `advanceProgressionPlaybackAtom` to no-op when `progressionPlayingStateAtom === true` (or split into two atom variants: keep the existing one for off-playback use, gate at the caller). Plan uses caller-gating (simpler, no atom contract change).
- `src/components/TransportBar/TransportBar.tsx` — disable Prev/Next when `progressionPlaying`. Render `Loader2` spinner inside the play button when `progressionPlaybackLoading === true`.
- `src/components/TransportBar/TransportBar.module.css` — add `@keyframes` spin + `.spinner` class.
- `src/components/ProgressionTrack/ProgressionTrack.tsx` — gate `selectStep` callback: when `progressionPlaying`, do nothing.
- `src/components/SongControls/SongControls.tsx` — disable the editor-pane controls (Move-left, Move-right, Duplicate, Delete, DegreeGrid cells, Quality select, Duration stepper) when `progressionPlaying`.
- `src/hooks/useProgressionState.ts` — expose `progressionPlaybackLoading` (Phase 3) for components that need it.
- `src/hooks/useProgressionAudioPlayback.ts` — Phase 2 (Draw swap) and Phase 3 (loading flag).

**Create:**
- (none) — all work fits in existing files.

**Test:**
- `src/components/TransportBar/TransportBar.test.tsx` — add `disabled-while-playing` + spinner-while-loading cases. **Create if missing.**
- `src/components/ProgressionTrack/ProgressionTrack.test.tsx` — extend with a "click step while playing is a no-op" case.
- `src/components/SongControls/SongControls.test.tsx` — extend with "edit controls disabled while playing" case.
- `src/hooks/useProgressionAudioPlayback.test.tsx` — replace setTimeout-based deferral assertion with `Tone.Draw.schedule` mock assertion; add `progressionPlaybackLoadingAtom` flips false on first chord-onset callback.

---

## Phase P1 — Disable Seek + Structural-Edit Actions While Playing

The problem has two parts. **Desync bugs:** `previousProgressionStepAtom`, `advanceProgressionPlaybackAtom`, and the timeline-block click handler each mutate `activeProgressionStepIndexAtom` directly. The Tone.Part orchestrator does NOT subscribe to that atom — it advances on its own audio-clock schedule — so the visual cursor and audio desync. **Jarring restarts:** structural / content edits (per-step degree/quality/duration, add/remove/move/duplicate, preset load, key/scale change) all mutate `progressionStepsAtom` which is in `buildKey`, so Effect 1 disposes everything and rebuilds from bar 0 mid-jam.

**Scope decision:** lock both bug-class and jarring-restart actions. Allow style switches (pattern selects, drum variations, genre, chord instrument) — those also rebuild today, but they're a useful "audition" workflow and the user explicitly wants them available mid-play. The Loop toggle gets its own transparent treatment in Phase P5.

Solution: gate the locked actions at the UI layer with a `disabled` prop. No atom-contract changes.

### Task P1-T1: Disable Prev/Next/Play button cluster while playing

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx`
- Test: `src/components/TransportBar/TransportBar.test.tsx`

- [ ] **Step 1: Check if TransportBar.test.tsx exists**

Run: `ls src/components/TransportBar/TransportBar.test.tsx 2>/dev/null && echo EXISTS || echo MISSING`

If MISSING, create a minimal skeleton first:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { TransportBar } from "./TransportBar";
import { progressionPlayingStateAtom } from "../../store/progressionAtoms";

function renderWith(playing: boolean) {
  const store = createStore();
  store.set(progressionPlayingStateAtom, playing);
  return render(
    <Provider store={store}>
      <TransportBar />
    </Provider>,
  );
}

describe("TransportBar", () => {
  it("renders the play button", () => {
    renderWith(false);
    expect(screen.getByLabelText(/play progression/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing test**

Add to `src/components/TransportBar/TransportBar.test.tsx`:

```tsx
it("disables prev/next buttons while progression is playing", () => {
  renderWith(true);
  expect(screen.getByLabelText(/previous chord/i)).toBeDisabled();
  expect(screen.getByLabelText(/next chord/i)).toBeDisabled();
  // Play button stays enabled — that's how the user pauses.
  expect(screen.getByLabelText(/pause progression/i)).toBeEnabled();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/components/TransportBar/TransportBar.test.tsx -t "disables prev/next"`
Expected: FAIL — buttons are still enabled.

- [ ] **Step 4: Implement — gate `disabled` on prev/next**

In `src/components/TransportBar/TransportBar.tsx`, change the Prev and Next buttons to include `progressionPlaying` in the disabled predicate:

```tsx
// Previous button (around line 55-63):
<button
  type="button"
  className={styles.transportButton}
  onClick={() => previousProgressionStep()}
  disabled={!canPlay || progressionPlaying}
  aria-label="Previous chord"
>
  <SkipBack size={13} strokeWidth={2.4} aria-hidden="true" />
</button>

// Next button (around line 77-85):
<button
  type="button"
  className={styles.transportButton}
  onClick={() => advanceProgressionPlayback()}
  disabled={!canPlay || progressionPlaying}
  aria-label="Next chord"
>
  <SkipForward size={13} strokeWidth={2.4} aria-hidden="true" />
</button>
```

The play button itself stays enabled (canPlay only) — that's the user's exit.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/TransportBar/TransportBar.test.tsx -t "disables prev/next"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/components/TransportBar/TransportBar.test.tsx
git commit -m "fix(transport): disable prev/next while progression is playing"
```

### Task P1-T2: Make timeline-block click a no-op while playing

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`
- Test: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/ProgressionTrack/ProgressionTrack.test.tsx` (use the file's existing render helper / store pattern):

```tsx
it("ignores timeline-block clicks while progression is playing", () => {
  const store = createStore();
  store.set(progressionStepsAtom, [
    { id: "a", root: "C", quality: "maj", duration: "1" },
    { id: "b", root: "G", quality: "maj", duration: "1" },
  ]);
  store.set(progressionPlayingStateAtom, true);
  store.set(activeProgressionStepIndexAtom, 0);

  render(
    <Provider store={store}>
      <ProgressionTrack />
    </Provider>,
  );

  // Click the second block.
  const blocks = screen.getAllByRole("button", { name: /chord/i });
  fireEvent.click(blocks[1]);

  // Active step did NOT change — playing is true, so the click is ignored.
  expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
});
```

(If the existing file uses a different render helper, mirror it. Import `progressionStepsAtom`, `progressionPlayingStateAtom`, `activeProgressionStepIndexAtom` from `../../store/progressionAtoms`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ProgressionTrack/ProgressionTrack.test.tsx -t "ignores timeline-block clicks while"`
Expected: FAIL — index changes to 1.

- [ ] **Step 3: Implement — gate `selectStep`**

In `src/components/ProgressionTrack/ProgressionTrack.tsx`, change the `selectStep` callback (currently around line 59):

```tsx
import { useAtomValue } from "jotai";
import { progressionPlayingStateAtom } from "../../store/progressionAtoms";

// inside the component:
const progressionPlaying = useAtomValue(progressionPlayingStateAtom);

const selectStep = useCallback(
  (index: number) => {
    if (progressionPlaying) return;
    setActiveProgressionStepIndex(index);
  },
  [setActiveProgressionStepIndex, progressionPlaying],
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ProgressionTrack/ProgressionTrack.test.tsx -t "ignores timeline-block clicks while"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionTrack.tsx src/components/ProgressionTrack/ProgressionTrack.test.tsx
git commit -m "fix(progression-track): ignore timeline-block clicks while playing"
```

### Task P1-T3: Disable destructive edit controls in SongControls while playing

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Test: `src/components/SongControls/SongControls.test.tsx`

The targets in `SongControls.tsx` (locations from current grep):
- Line 286: Move-left button
- Line 295: Move-right button
- Line 304: Duplicate button
- Line 317: Delete button
- The editor-grid (around line 382): DegreeGrid cells + Quality select + Duration stepper

- [ ] **Step 1: Write the failing test**

Add to `src/components/SongControls/SongControls.test.tsx`:

```tsx
it("disables step-edit controls while progression is playing", () => {
  const store = createStore();
  store.set(progressionStepsAtom, [
    { id: "a", root: "C", quality: "maj", duration: "1" },
    { id: "b", root: "G", quality: "maj", duration: "1" },
  ]);
  store.set(activeProgressionStepIndexAtom, 0);
  store.set(progressionPlayingStateAtom, true);

  render(
    <Provider store={store}>
      <SongControls />
    </Provider>,
  );

  expect(screen.getByRole("button", { name: /move left/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /move right/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /duplicate/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx -t "disables step-edit controls"`
Expected: FAIL.

- [ ] **Step 3: Implement — `editsLocked` predicate**

In `src/components/SongControls/SongControls.tsx`, near the top of the component:

```tsx
import { progressionPlayingStateAtom } from "../../store/progressionAtoms";
// ...
const progressionPlaying = useAtomValue(progressionPlayingStateAtom);
const editsLocked = progressionPlaying;
```

Then OR `editsLocked` into the four button `disabled` predicates and any select / stepper / DegreeGrid that mutates steps. For example the Move-left button becomes:

```tsx
disabled={!activeStep || activeProgressionStepIndex === 0 || editsLocked}
```

And for the DegreeGrid + Quality select + Duration stepper inside the editor grid, pass `disabled={editsLocked}` (or `readOnly` for the inputs that don't support `disabled` cleanly — verify per control during execution).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx -t "disables step-edit controls"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.test.tsx
git commit -m "fix(song-controls): disable step-edit controls while progression is playing"
```

---

## Phase P2 — Replace `setTimeout` Visual Sync with `Tone.Draw`

The current chord-overlay advance in `useProgressionAudioPlayback.ts:266-285` defers the Jotai write with `window.setTimeout(setActiveStepIndex, audioTime - immediate())`. That works but it bypasses the animation frame, so the React commit lands whenever the JS event loop gets to it. `Tone.Draw.schedule(cb, audioTime)` does the same alignment via `requestAnimationFrame` — visually smoother and idiomatic.

**Why this is safe now (when it wasn't in commit `3fa9ce5`):** the prior breakage was that `Draw`'s default `expiration = 0.25s` silently dropped events under heavy main-thread load, stalling the chain. Two fixes: (1) raise `Draw.expiration` to 5s — chord boundaries are ≥ 0.5s apart at sane tempos, 5s gives a 10× margin; (2) the *only* thing being scheduled through Draw is the chord-overlay React state advance — `setActiveStep` (timeline state) and the audio Parts run independently. A dropped Draw call lags the chord overlay by one chord at worst; audio + playhead keep flowing.

### Task P2-T1: Raise `Tone.Draw.expiration` on bus setup

**Files:**
- Modify: `src/progressions/audio/bus.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/bus.test.ts` (or `toneBus.test.ts` if that's where bus mounting is asserted — confirm the file during execution and put it next to the existing tone-bind test):

```ts
import { getDraw } from "tone";
import { ensureProgressionAudio, _resetProgressionAudioForTests } from "./bus";

it("raises Tone.Draw.expiration to 5s so heavy renders don't silently drop chord-overlay advances", () => {
  _resetProgressionAudioForTests();
  ensureProgressionAudio();
  expect(getDraw().expiration).toBe(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/bus.test.ts -t "raises Tone.Draw.expiration"`
Expected: FAIL — `expiration` is still the default 0.25.

- [ ] **Step 3: Implement**

In `src/progressions/audio/bus.ts`, inside `ensureProgressionAudio()`'s success path (after `bindToneToProgressionContext(...)`, before `return`):

```ts
import { getDraw } from "tone";
// ...
bindToneToProgressionContext({ ctx, bus, layers });
// Default Draw.expiration is 250ms — under heavy main-thread load (e.g. a
// chord-boundary Fretboard re-render) that window is too tight and the
// visual advance is silently dropped. Chord boundaries are >=0.5s at sane
// tempos; 5s gives a 10x margin for stalls without ever firing stale.
getDraw().expiration = 5;
return { ctx, bus, layers };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/bus.test.ts -t "raises Tone.Draw.expiration"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/bus.ts src/progressions/audio/bus.test.ts
git commit -m "feat(audio): raise Tone.Draw.expiration to 5s for chord-overlay advances"
```

### Task P2-T2: Swap `setTimeout` advance for `Tone.Draw.schedule`

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Test: `src/hooks/useProgressionAudioPlayback.test.tsx`

- [ ] **Step 1: Write the failing test**

Edit `src/hooks/useProgressionAudioPlayback.test.tsx` — replace the existing setTimeout-deferral assertion with a Draw-based one. The Tone mock needs a `getDraw` stub. Search for the existing block that asserts `setTimeout` is called with a delay and update it to:

```tsx
const drawSchedule = vi.fn((cb: () => void) => cb());
vi.mock("tone", async () => {
  const actual = await vi.importActual<typeof import("tone")>("tone");
  return {
    ...actual,
    getDraw: () => ({ expiration: 5, schedule: drawSchedule }),
    Draw: { schedule: drawSchedule, expiration: 5 }, // deprecated alias
  };
});

it("defers chord-overlay advance via Tone.Draw.schedule (not setTimeout)", () => {
  // ... mount hook, fire the chord-onset callback with a future audioTime ...
  expect(drawSchedule).toHaveBeenCalledWith(expect.any(Function), expectedAudioTime);
  // And: source must not import or call window.setTimeout for this path.
});

it("source uses Tone.Draw, not setTimeout, for chord-overlay advance", async () => {
  const fs = await import("node:fs/promises");
  const src = await fs.readFile("src/hooks/useProgressionAudioPlayback.ts", "utf-8");
  // Regression guard — see commit history for the 250ms Draw.expiration story
  // and the subsequent setTimeout workaround. This test locks in the post-fix shape.
  expect(src).not.toMatch(/setTimeout.*setActiveStepIndex|pendingAdvanceTimeouts/);
  expect(src).toMatch(/getDraw\(\)\.schedule/);
});
```

(Use whichever style matches the existing test file — the existing file already mocks `tone`, mirror that pattern; key point is the assertions.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "Tone.Draw"`
Expected: FAIL on both new tests.

- [ ] **Step 3: Implement — swap setTimeout for Draw**

In `src/hooks/useProgressionAudioPlayback.ts`:

(a) Replace the `import { getContext, getTransport } from "tone"` line at the top with:

```ts
import { getDraw, getTransport } from "tone";
```

(b) Replace the chord-onset Part's `onEvent` deferral block (currently lines 266-285) with:

```ts
onEvent: (audioTime, event) => {
  setActiveStep(
    event.stepIndex,
    audioTime,
    event.durationSec,
    event.cumulativeStartSec,
    totalDurationSec,
  );
  if (event.isFirstBar) {
    // Visual-audio alignment via Tone.Draw — schedules on the nearest
    // animation frame at audioTime. Draw.expiration is raised to 5s in
    // bus.ts so heavy main-thread renders don't silently drop the advance
    // (the 0.25s default was the 3fa9ce5 regression; see commit history).
    getDraw().schedule(() => setActiveStepIndex(event.stepIndex), audioTime);
  }
},
```

(c) Delete the `pendingAdvanceTimeouts` Set + its tracking in Effect 1 (lines ~250, ~280-283, ~386-387). Cleanup becomes just:

```ts
return () => {
  disposeAll(primsRef.current);
  primsRef.current = null;
};
```

(d) Add a one-line cancel-on-teardown call so a paused-mid-lookahead Draw doesn't fire after dispose:

```ts
return () => {
  getDraw().cancel();
  disposeAll(primsRef.current);
  primsRef.current = null;
};
```

(e) Remove the now-unused `getContext` import if nothing else uses it (grep first).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS (all cases, including the source-regression guard).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx
git commit -m "refactor(audio): use Tone.Draw for chord-overlay advance (rAF-aligned)"
```

---

## Phase P3 — Loading State on Play Button

`ensureProgressionAudio()` constructs an `AudioContext`, builds layer buses, and binds Tone — fast on a warm context but on first-ever click it's the AudioContext creation + Tone first-touch + voice/sample lazy init. Plus `buildAllLayers()` walks the resolved steps. End-to-end: 100–800 ms before audio onset. Today the play button flips to Pause instantly with no indication anything is happening. Add a transient loading flag flipped true at the start of Effect 1 and false when the first chord-onset callback fires; render a `Loader2` spinner inside the play button when true.

### Task P3-T1: Add `progressionPlaybackLoadingAtom`

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/store/progressionAtoms.test.ts`:

```ts
import { createStore } from "jotai";
import { progressionPlaybackLoadingAtom } from "./progressionAtoms";

it("progressionPlaybackLoadingAtom defaults to false", () => {
  const store = createStore();
  expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
});

it("progressionPlaybackLoadingAtom is a writable boolean", () => {
  const store = createStore();
  store.set(progressionPlaybackLoadingAtom, true);
  expect(store.get(progressionPlaybackLoadingAtom)).toBe(true);
  store.set(progressionPlaybackLoadingAtom, false);
  expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "progressionPlaybackLoadingAtom"`
Expected: FAIL — atom doesn't exist.

- [ ] **Step 3: Implement**

In `src/store/progressionAtoms.ts`, near the other transient playback atoms (e.g. next to `progressionStepDeadlineAtom`):

```ts
/**
 * True from the moment `setProgressionPlaying(true)` is honored until the
 * first audio callback fires. Drives the spinner overlay on the play button
 * so the user gets feedback during the AudioContext warm-up + buildAllLayers
 * window (typically 100–800ms on a cold context). Transient — not persisted.
 */
export const progressionPlaybackLoadingAtom = atom<boolean>(false);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "progressionPlaybackLoadingAtom"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progression): add progressionPlaybackLoadingAtom"
```

### Task P3-T2: Set / clear the loading flag in the playback orchestrator

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Test: `src/hooks/useProgressionAudioPlayback.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/hooks/useProgressionAudioPlayback.test.tsx`:

```tsx
it("flips progressionPlaybackLoading true at start, false on first chord-onset", async () => {
  const store = createStore();
  store.set(progressionStepsAtom, [{ id: "a", root: "C", quality: "maj", duration: "1" }]);
  store.set(progressionPlayingStateAtom, true);

  renderHook(() => useProgressionAudioPlayback(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });

  // After mount, before any audio callback fires: loading is true.
  expect(store.get(progressionPlaybackLoadingAtom)).toBe(true);

  // Simulate the first chord-onset callback via the Tone.Part mock.
  await firstChordOnsetCallback({ stepIndex: 0, isFirstBar: true, /* ... */ });

  expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
});

it("clears progressionPlaybackLoading when playback stops", () => {
  // ... mount hook with playing=true, then flip playing=false ...
  expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
});
```

(`firstChordOnsetCallback` — extract whatever utility the existing test file uses to fire the mocked Tone.Part callback. If none exists yet, capture the `onEvent` arg from the `createProgressionPart` mock and call it directly.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "progressionPlaybackLoading"`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/hooks/useProgressionAudioPlayback.ts`:

(a) Add the setter at the top of the hook:

```ts
import { progressionPlaybackLoadingAtom, /* existing imports */ } from "../store/progressionAtoms";
// ...
const setLoading = useSetAtom(progressionPlaybackLoadingAtom);
```

(b) In Effect 1, right after the `if (!playing) { tearDown(); pauseTimeline(); return; }` branch, set loading true before the heavy build:

```ts
setLoading(true);
const audio = ensureProgressionAudio();
if (!audio) { setLoading(false); return; }
```

(c) In the chord-onset `onEvent` callback, clear the flag on first invocation. Track with a closure-local flag:

```ts
let hasFiredOnce = false;
const chordOnsetPart = createProgressionPart<ChordOnsetEvent>({
  events: built.chordOnsets,
  loop: inputs.loopEnabled,
  loopEnd: totalDurationSec,
  onEvent: (audioTime, event) => {
    if (!hasFiredOnce) {
      hasFiredOnce = true;
      setLoading(false);
    }
    setActiveStep(/* ... */);
    if (event.isFirstBar) {
      getDraw().schedule(() => setActiveStepIndex(event.stepIndex), audioTime);
    }
  },
});
```

(d) In the tear-down branches (`blocked || muted`, `!playing`, and the cleanup return), also clear the flag so stop-while-loading doesn't leave the spinner spinning:

```ts
const tearDown = () => {
  disposeAll(primsRef.current);
  primsRef.current = null;
  silenceProgressionBus();
  setLoading(false);
};
```

(e) Add `setLoading` to the deps array of Effect 1.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx
git commit -m "feat(audio): wire progressionPlaybackLoading flag through orchestrator"
```

### Task P3-T3: Render spinner in play button while loading

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx`
- Modify: `src/components/TransportBar/TransportBar.module.css`
- Test: `src/components/TransportBar/TransportBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/TransportBar/TransportBar.test.tsx`:

```tsx
it("shows a spinner in the play button while progression is loading", () => {
  const store = createStore();
  store.set(progressionPlayingStateAtom, true);
  store.set(progressionPlaybackLoadingAtom, true);
  render(
    <Provider store={store}>
      <TransportBar />
    </Provider>,
  );
  expect(screen.getByTestId("transport-play-spinner")).toBeInTheDocument();
});

it("hides the spinner once loading clears", () => {
  const store = createStore();
  store.set(progressionPlayingStateAtom, true);
  store.set(progressionPlaybackLoadingAtom, false);
  render(
    <Provider store={store}>
      <TransportBar />
    </Provider>,
  );
  expect(screen.queryByTestId("transport-play-spinner")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/TransportBar/TransportBar.test.tsx -t "spinner"`
Expected: FAIL — spinner not rendered.

- [ ] **Step 3: Implement**

In `src/components/TransportBar/TransportBar.tsx`:

(a) Import `Loader2`:

```ts
import { AudioWaveform, Drum, Guitar, Loader2, Pause, Play, Repeat, SkipBack, SkipForward, Timer } from "lucide-react";
```

(b) Read the loading atom:

```ts
import { progressionPlaybackLoadingAtom } from "../../store/progressionAtoms";
import { useAtomValue } from "jotai";
// ...
const progressionPlaybackLoading = useAtomValue(progressionPlaybackLoadingAtom);
```

(c) In the play-button JSX (around line 64-76), branch on `progressionPlaybackLoading` first:

```tsx
<button
  type="button"
  className={clsx(styles.transportButton, styles.playButton, progressionPlaying && styles["transportButton--accent"])}
  onClick={() => setProgressionPlaying(!progressionPlaying)}
  disabled={!canPlay}
  aria-label={progressionPlaying ? "Pause progression" : "Play progression"}
  aria-busy={progressionPlaybackLoading || undefined}
>
  {progressionPlaybackLoading ? (
    <Loader2
      size={14}
      strokeWidth={2.4}
      aria-hidden="true"
      className={styles.spinner}
      data-testid="transport-play-spinner"
    />
  ) : progressionPlaying ? (
    <Pause size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
  ) : (
    <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
  )}
</button>
```

(d) In `src/components/TransportBar/TransportBar.module.css`, add:

```css
@keyframes transport-spinner-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.spinner {
  animation: transport-spinner-rotate 0.9s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/TransportBar/TransportBar.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/components/TransportBar/TransportBar.module.css src/components/TransportBar/TransportBar.test.tsx
git commit -m "feat(transport): spinner in play button while progression is loading"
```

### Task P3-T4: Pre-warm AudioContext on first interaction with SongControls

This shaves the first-play AudioContext-creation latency by piggy-backing on an earlier user gesture. The first time the user opens / interacts with the Song tab, fire `ensureProgressionAudio()` (which is a no-op idempotent on subsequent calls). Browsers require a user-gesture for AudioContext construction, but mounting the Song tab is always a result of a click on the tab strip — so the gesture context is live.

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/SongControls/SongControls.test.tsx`:

```tsx
it("calls ensureProgressionAudio on mount to pre-warm the AudioContext", () => {
  const ensureSpy = vi.fn();
  vi.doMock("../../progressions/audio/bus", async () => ({
    ...(await vi.importActual<typeof import("../../progressions/audio/bus")>("../../progressions/audio/bus")),
    ensureProgressionAudio: ensureSpy,
  }));
  render(
    <Provider store={createStore()}>
      <SongControls />
    </Provider>,
  );
  expect(ensureSpy).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx -t "pre-warm"`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/components/SongControls/SongControls.tsx`:

```tsx
import { useEffect } from "react";
import { ensureProgressionAudio } from "../../progressions/audio/bus";

// inside the component, near the top:
useEffect(() => {
  // Pre-warm the AudioContext on first Song-tab mount so the first play
  // click doesn't pay the full AudioContext-construction + Tone-bind
  // latency. Idempotent; safe to call on every mount.
  ensureProgressionAudio();
}, []);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx -t "pre-warm"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.test.tsx
git commit -m "perf(audio): pre-warm AudioContext when SongControls mounts"
```

---

## Phase P4 — Verification

### Task P4-T1: Full local verification

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 2: Unit tests**

Run: `pnpm test`
Expected: all green (~1957 + new cases).

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: clean build.

- [ ] **Step 4: E2E production**

Run: `pnpm test:e2e:production`
Expected: 50/50.

- [ ] **Step 5: Visual regression refresh**

Visuals likely shift in two places: TransportBar (spinner overlay can land in a snapshot if a test happens to be mid-load) and disabled-state styles. Run the visual update first to capture the new baseline:

```bash
pnpm test:visual:update
```

Then verify:

```bash
pnpm test:visual
```

Expected: 44/44, no unexpected diffs. Inspect any diffs that aren't transport-bar-related.

- [ ] **Step 6: Commit any visual baseline updates**

```bash
git add e2e/visual/
git commit -m "test(visual): refresh baselines after playback-UX polish"
```

---

## Self-Review Notes

**Spec coverage check:**
- Concern 1 (disable destructive actions during playback): covered by P1-T1 (prev/next), P1-T2 (timeline click), P1-T3 (editor pane). Play button itself stays live for pause.
- Concern 2 (Tone.Draw instead of setTimeout): covered by P2-T1 (raise expiration) + P2-T2 (swap implementation). The prior 250ms-expiration regression is explicitly addressed with `expiration = 5`.
- Concern 3 (loading indicator + startup optimization): covered by P3-T1 (atom), P3-T2 (wire orchestrator), P3-T3 (spinner UI), P3-T4 (pre-warm). Pre-warm is the only optimization; further audio-graph optimizations (e.g. eager voice / drum-buffer instantiation) are deferred — measure first.

**Placeholder scan:** no TBDs; every code-changing step shows the code.

**Type consistency:**
- `progressionPlaybackLoadingAtom` (added P3-T1) consumed by P3-T2 (orchestrator) and P3-T3 (TransportBar). Name stable across all three.
- `editsLocked` is a local in P1-T3 only — no cross-task contract.
- `getDraw()` is the non-deprecated Tone v15 accessor (confirmed against `node_modules/tone/build/esm/index.d.ts:78`).

**Out of scope (call out if user re-asks):**
- The legacy `progressionStepDeadlineAtom` is still read by `practiceLensAtoms.ts:458` for a tension/decay effect. The Tone.Part rewrite no longer updates that atom, so the lens visualisation is stale during playback. Not user-reported; leave for a follow-up.
- "Optimize startup" beyond pre-warming the AudioContext (e.g. eager voice instantiation, drum-buffer preloading) is intentionally deferred — measure with the new loading flag first to see where the time actually goes.
