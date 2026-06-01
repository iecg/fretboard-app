# Predictable Style-Switch with Explicit Restart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every backing-track change that recompiles the note timeline (style/genre swap, pattern change, chord edits, time signature) restart deterministically from bar 1 with an explicit, non-flashing loading spinner on the play/stop button.

**Architecture:** The playback orchestrator (`useProgressionAudioPlayback.ts`, Effect 2) currently keeps old audio playing while new layers compile, then swaps at an arbitrary build-completion moment ("make-before-break"), which makes the restart point float unpredictably. We replace that with a synchronous up-front teardown: when the effect re-runs while playing, immediately dispose the old parts, clear the timeline (snapping the playhead to bar 1), and rewind the Tone Transport to position 0 — *before* compiling. The 150ms-debounced loading atom already exists; we surface it as a real spinner element on the button and keep that button clickable so the user can cancel a slow load.

**Tech Stack:** React 19, Jotai, Tone.js, Vitest + Testing Library, lucide-react icons, CSS Modules.

**Design spec:** `docs/superpowers/specs/2026-06-01-predictable-style-switch-design.md`

---

## Background the engineer needs

- **Two tiers of interaction** (from the spec):
  - **Live tier** — tempo, swing, layer on/off toggles, mute, volume, mix/quality. These are *not* in `buildKey`, so Effect 2 never re-runs for them; they update in place and must keep doing so. Do not change them.
  - **Restart tier** — anything in `buildKey`: `beatsPerBar` (time signature), `steps` (chord edits), `chordPatternId`, `bassPatternId`, `drumPatternId`, `drumVariations`. A style/genre swap (`applyGenreStyleAtom`) sets the pattern atoms, so it flows through `buildKey` too. All of these already re-run Effect 2; this plan makes that re-run reset cleanly.
- **`buildKey`** is the memo at `src/hooks/useProgressionAudioPlayback.ts:127-143`. Effect 2's dependency array (`:512-521`) includes `buildKey`, `playing`, `blocked`, `muted`.
- **The loading atom** `progressionPlaybackLoadingAtom` is already 150ms-debounced inside Effect 2 (`:307-316`) and forced synchronous under `import.meta.env.MODE === "test"`. We do **not** change that logic — we only render it.
- **Why no new engine helper:** `getTransport()` is re-exported from `src/progressions/audio/progressionAudioEngine.ts:20`. Tone's `Transport.stop()` halts playback **and** resets position to 0, which is exactly the rewind we need. The test mock already stubs `transport.stop` (`useProgressionAudioPlayback.test.tsx:110`).
- **Visual playhead reset is automatic:** the visual clock (`src/progressions/audio/visualClock.ts:52-60`) writes `displayedStepIndexPrimitiveAtom = 0` on the next frame whenever `getTimelinePosition()` returns null. Calling `clearTimeline()` up-front therefore snaps the on-screen playhead to bar 1 with no extra wiring. (This path is mocked in the hook unit test, so it is verified by inspection, not asserted there.)

## File structure

- **Modify:** `src/hooks/useProgressionAudioPlayback.ts` — Effect 2 up-front teardown; remove the now-redundant standalone time-signature live effect.
- **Modify:** `src/hooks/useProgressionAudioPlayback.test.tsx` — add the deterministic-reset test.
- **Modify:** `src/components/TransportBar/TransportBar.tsx` — render the spinner while loading.
- **Modify:** `src/components/TransportBar/TransportBar.module.css` — spinner spin animation.
- **Modify:** `src/components/TransportBar/TransportBar.test.tsx` — rewrite the two loading tests; add a cancel test.

---

## Task 1: Synchronous up-front reset on restart-tier re-run

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts:305` (insert teardown), `:400-402` (remove deferred disposal)
- Test: `src/hooks/useProgressionAudioPlayback.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test inside the top-level `describe("useProgressionAudioPlayback (tone-native orchestrator)", ...)` block in `src/hooks/useProgressionAudioPlayback.test.tsx`, right after the existing `"disposes ALL primitives and rebuilds from 0 when steps change mid-play"` test (ends at line 422):

```tsx
  it("rewinds the transport to bar 1 and rebuilds up front on a restart-tier change", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });
    const initialParts = [...toneMocks.parts];

    // The engine is now loaded, so the next restart-tier change must rewind the
    // transport synchronously. Clear the spy so we measure only that change.
    toneMocks.transport.stop.mockClear();

    act(() => {
      store.set(progressionStepsAtom, [
        ...threeBars,
        { id: "4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
    });

    // Old parts are disposed up front (before the async rebuild completes).
    initialParts.forEach((p) => expect(p.disposed).toBe(true));
    // Transport was rewound to 0 (deterministic restart from bar 1).
    expect(toneMocks.transport.stop).toHaveBeenCalled();

    // The async rebuild then constructs a fresh set of Parts starting at offset 0.
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(initialParts.length);
    });
    const newOnsets = toneMocks.parts
      .slice(initialParts.length)
      .find((p) => p.events.length === 4);
    expect(newOnsets?.startedOffset).toBe(0);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "rewinds the transport to bar 1"`
Expected: FAIL on `expect(toneMocks.transport.stop).toHaveBeenCalled()` and/or `initialParts.forEach((p) => expect(p.disposed).toBe(true))` — today disposal is deferred until after the async build and `transport.stop()` is never called.

- [ ] **Step 3: Add the up-front teardown block**

In `src/hooks/useProgressionAudioPlayback.ts`, find this (around line 303-306):

```ts
    startVisualClock(store);

    const gen = ++genRef.current;
    
```

Replace it with:

```ts
    startVisualClock(store);

    const gen = ++genRef.current;

    // Restart-tier reset: whenever this effect re-runs while playing — a
    // style/genre swap, pattern change, chord edit, or time-signature change
    // (everything in `buildKey`) — tear the old audio down *up front* and rewind
    // the transport to bar 1 BEFORE compiling. `clearTimeline()` snaps the visual
    // playhead to the top via the visual clock. The debounced spinner below
    // covers the brief compile gap. This replaces the old make-before-break swap,
    // whose build-completion-timed handoff made the restart point float
    // unpredictably (skipped chords / "started over" / "next bar" at random).
    if (engine) {
      engine.disposeAll(primsRef.current);
      primsRef.current = null;
      engine.clearTimeline();
      engine.getTransport().stop();
    }

```

- [ ] **Step 4: Remove the now-redundant deferred disposal**

In the same file, find this (around line 399-402):

```ts
      if (built.chordOnsets.length === 0) { tearDownAndStop(); return; }

      // Dispose OLD parts right before starting new ones to eliminate lag gap!
      eng.disposeAll(primsRef.current);
      eng.clearTimeline();

      const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;
```

Replace it with:

```ts
      if (built.chordOnsets.length === 0) { tearDownAndStop(); return; }

      // Old parts and timeline were already disposed/cleared up front (see the
      // restart-tier reset at the top of this effect), so the new Parts below
      // build against a clean, rewound transport.
      const partStart = audio.ctx.currentTime + SCHEDULE_LEAD_SECONDS;
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `pnpm exec vitest run src/hooks/useProgressionAudioPlayback.test.tsx -t "rewinds the transport to bar 1"`
Expected: PASS

- [ ] **Step 6: Run the full hook suite to confirm no regressions**

Run: `pnpm exec vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS — all tests, including `"disposes ALL primitives and rebuilds from 0 when steps change mid-play"`, `"tempo change is a LIVE update"`, `"loop toggle is a LIVE update"`, `"toggling drums flips the layer gain without rebuilding"`, and the `progressionPlaybackLoadingAtom integration` block.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts src/hooks/useProgressionAudioPlayback.test.tsx
git commit -m "fix(audio): rewind transport to bar 1 on restart-tier changes

Replace make-before-break swap with a synchronous up-front teardown so
style/genre/pattern/chord/time-signature changes always restart playback
deterministically from bar 1 instead of swapping at an arbitrary build-
completion moment."
```

---

## Task 2: Render the loading spinner on the play/stop button

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx:1-10` (import), `:88-92` (icon)
- Modify: `src/components/TransportBar/TransportBar.module.css` (animation)
- Test: `src/components/TransportBar/TransportBar.test.tsx:188-206` (rewrite), plus one new test

- [ ] **Step 1: Rewrite the two loading tests and add a cancel test**

In `src/components/TransportBar/TransportBar.test.tsx`, replace the two existing tests at lines 188-206 (`"keeps the play icon visible while progression is loading"` and `"keeps the stop button enabled while loading if playback already started"`) with:

```tsx
  it("shows a spinner on the play button while loading during playback", () => {
    const store = makeAtomStore([...playableAtoms, [progressionPlaybackLoadingAtom, true]]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    // The spinner replaces the play/stop glyph while a restart-tier build runs.
    expect(screen.getByTestId("transport-play-spinner")).toBeInTheDocument();
    // The button stays enabled so the user can cancel a slow load.
    expect(screen.getByRole("button", { name: "Stop progression" })).toBeEnabled();
  });

  it("lets the user cancel a slow load by clicking the spinner", () => {
    const store = makeAtomStore([...playableAtoms, [progressionPlaybackLoadingAtom, true]]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    const button = screen.getByRole("button", { name: "Stop progression" });
    expect(screen.getByTestId("transport-play-spinner")).toBeInTheDocument();
    expect(button).toBeEnabled();

    fireEvent.click(button);

    // Cancelling stops playback (returns to bar 1, stopped).
    expect(store.get(progressionPlayingAtom)).toBe(false);
  });
```

(`progressionPlayingAtom` and `fireEvent` are already imported at the top of this file — lines 16 and 4.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/TransportBar/TransportBar.test.tsx -t "spinner"`
Expected: FAIL — `getByTestId("transport-play-spinner")` finds no element, because the spinner is not rendered yet.

- [ ] **Step 3: Import the spinner icon**

In `src/components/TransportBar/TransportBar.tsx`, change the lucide-react import block (lines 2-10) from:

```tsx
import {
  AudioWaveform,
  Drum,
  Guitar,
  Play,
  Repeat,
  Square,
  Timer,
} from "lucide-react";
```

to:

```tsx
import {
  AudioWaveform,
  Drum,
  Guitar,
  LoaderCircle,
  Play,
  Repeat,
  Square,
  Timer,
} from "lucide-react";
```

- [ ] **Step 4: Render the spinner when loading**

In the same file, replace the play/stop icon block (lines 88-92):

```tsx
          {playStopIsPlaying ? (
            <Square size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          ) : (
            <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          )}
```

with:

```tsx
          {progressionPlaybackLoading ? (
            <LoaderCircle
              size={14}
              strokeWidth={2.4}
              aria-hidden="true"
              className={styles.playSpinner}
              data-testid="transport-play-spinner"
            />
          ) : playStopIsPlaying ? (
            <Square size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          ) : (
            <Play size={14} strokeWidth={2.4} aria-hidden="true" fill="currentColor" />
          )}
```

(`progressionPlaybackLoading` is already destructured from `usePlaybackTransportModel()` at line 25.)

- [ ] **Step 5: Add the spin animation CSS**

Append to `src/components/TransportBar/TransportBar.module.css`:

```css
.playSpinner {
  animation: transport-play-spin 0.8s linear infinite;
}

@keyframes transport-play-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .playSpinner {
    animation-duration: 2s;
  }
}
```

- [ ] **Step 6: Run the TransportBar suite to verify it passes**

Run: `pnpm exec vitest run src/components/TransportBar/TransportBar.test.tsx`
Expected: PASS — including the rewritten spinner tests, the new cancel test, the existing axe a11y test, and `"renders the transport and instrument buttons"`.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/components/TransportBar/TransportBar.module.css src/components/TransportBar/TransportBar.test.tsx
git commit -m "feat(transport): show a spinner on the play button during restart loads

Surface the 150ms-debounced loading state as a visible spinner that
replaces the play/stop glyph, and keep the button clickable so the user
can cancel a slow load."
```

---

## Task 3: Make time signature a clean restart-tier change

This removes the standalone time-signature live effect. `beatsPerBar` is already in `buildKey`, so a change re-runs Effect 2 (now an up-front reset) and the build path re-applies the time signature at `src/hooks/useProgressionAudioPlayback.ts:349` before constructing Parts. The standalone effect only mattered for a beats-per-bar change that did *not* rebuild — which cannot happen — so it is dead and its presence muddies the live-vs-restart tier model. This is a behavior-preserving cleanup verified by the existing suite.

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts:533-536` (remove)

- [ ] **Step 1: Remove the redundant live effect**

In `src/hooks/useProgressionAudioPlayback.ts`, delete this effect (lines 533-536):

```ts
  useEffect(() => {
    if (!engine) return;
    engine.setPlaybackTimeSignature(beatsPerBar);
  }, [beatsPerBar]);
```

Leave the tempo (`:523-526`) and swing (`:528-531`) live effects untouched — those remain live-tier.

- [ ] **Step 2: Run the full hook suite to confirm behavior is preserved**

Run: `pnpm exec vitest run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS — the time-signature tests (`"metronome Part loopEnd matches totalDurationSec"` uses `beatsPerBar: 3`) still pass because durations come from `buildAllLayers`, and the build path still calls `setPlaybackTimeSignature` at line 349.

- [ ] **Step 3: Verify no other caller depends on the removed effect**

Run: `git grep -n "setPlaybackTimeSignature" src`
Expected: the only remaining call site in the hook is inside the build path (`useProgressionAudioPlayback.ts`, around line 349); the engine definition stays in `progressionAudioEngine.ts:47`. No dangling references.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts
git commit -m "refactor(audio): drop redundant live time-signature effect

beatsPerBar is part of buildKey, so a time-signature change already
triggers a restart-tier rebuild that re-applies the signature before
building Parts. The standalone live effect was dead code that blurred the
live-vs-restart tier model."
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: PASS (eslint + stylelint, including the new `@keyframes` and `react-compiler` rules).

- [ ] **Step 2: Full test suite**

Run: `pnpm run test`
Expected: PASS — full Vitest run with no regressions.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build`).

- [ ] **Step 4: Manual smoke check (preview)**

Start the dev server and confirm by ear/eye:
- Press play, then switch style from Jazz to Bossa Nova mid-playback. Playback restarts cleanly from bar 1 every time; the playhead snaps to the top; a spinner shows on the play button if the build is slow, and does not flash for fast changes.
- Toggle a layer (drums) and nudge the tempo while playing — these stay live with no restart and no spinner.
- Start a slow style switch and click the spinner — playback stops and the playhead is at bar 1.

---

## Self-review notes

- **Spec coverage:** Live vs restart tiers → Task 1 (reset only fires on `buildKey` re-runs; live effects untouched) + Task 3 (time signature). Reset-to-bar-1 + transport rewind → Task 1. Spinner element + 150ms debounce preserved → Task 2 (renders the existing debounced atom). Cancel-during-load → Task 2 cancel test (the button is already enabled while `playing` is true). Visual playhead snap → automatic via `clearTimeline()` + visual clock (documented in Background).
- **Type/name consistency:** `engine.getTransport().stop()`, `engine.disposeAll`, `engine.clearTimeline` all match `progressionAudioEngine.ts` exports. `progressionPlaybackLoading`, `progressionPlaying`, `setProgressionPlaying`, `stopProgressionPlayback` match `usePlaybackTransportModel` returns. `transport-play-spinner` testid matches between component and tests. `styles.playSpinner` matches the CSS class.
- **No placeholders:** every code step shows the full before/after.
