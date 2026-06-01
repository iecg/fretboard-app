# Playback Render Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the main-thread jank/violations on progression start/stop/loop and the slow genre start, by (1) stopping the full ~150-note `FretboardNoteLayer` re-render on every playback transition, and (2) removing the redundant signal-graph rebuild from the play click task.

**Architecture:** Two independent fixes plus one documented descope.
- **Fix A (render):** `FretboardNoteLayer` maps ~150 notes inline with no per-note memoization. The React Profiler confirms its render self-time is **28.8–30.6ms in every playback commit** (it dominates the 144ms initial and 36ms transition commits). Its `notes` prop (`renderedNotes`) is rebuilt as all-new objects whenever `emphasisContext` changes (anticipation flips near chord changes, step changes, play/stop). Fix: stabilize per-note object identity in `buildRenderedFretboardNotes` and extract a `memo`'d per-note component so only the notes whose emphasis actually changed re-render.
- **Fix B (audio start):** `configureProgressionGraph` tears down + re-materializes + rewires the entire Tone signal graph on **every** play, even when tier+mix are unchanged (the Explore confirmed it is not idempotent). The Chrome trace attributes ~270–290ms of click processing partly to this synchronous work. Fix: skip the rebuild when the plan is unchanged.
- **Descope (Fix C, visualClock):** Evidence does NOT support throttling the rAF loop — the trace shows `requestAnimationFrame` totalled ~117ms across a ~24.7s capture (~0.08ms/frame) and there are no per-frame React subscribers to `progressionVisualFrameAtom`. Documented in Task 4; no code change.

**Tech Stack:** React 19 (React Compiler `infer`), TypeScript, Jotai, Tone.js, Vitest + Testing Library. Worktree: `/Users/isaaccocar/repos/fretboard-app.worktrees/perf-playback-render` (branch `perf-playback-render` off `main`). Run all commands from the worktree root.

**Evidence on file (for reviewers):**
- Mute isolation: play toggle blocks ~74ms pure React (audio torn down).
- Chrome trace (bossa/jazz): INP 338/353ms, processing 272/288ms; bottom-up Recalc Style ~160–194ms, Commit ~150–168ms.
- React Profiler export: `FretboardNoteLayer` self 28.8–30.6ms in commits 0/1/3/6; commit 6 shows it re-rendering for 30.6ms with only 2 fibers committed (so its own render is the cost).
- Node build timing: all genres build in 1.6–2.0ms (build ruled out for "slow start").

---

### Task 1: Stabilize per-note identity in `buildRenderedFretboardNotes`

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Test: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` (create if absent)

**Why:** `buildRenderedFretboardNotes` returns a brand-new object for every note on every recompute. Even a `memo`'d per-note component (Task 2) cannot bail unless unchanged notes keep a stable object reference across emphasis changes. This task adds reference caching keyed by note position so an unchanged note returns its previous object identity.

- [ ] **Step 1: Write the failing test**

Read the current `useAnimatedFretboardView.ts` first to match the exact `RenderedFretboardNote` shape and the `buildRenderedFretboardNotes` signature. Then write a test that renders the hook twice with the SAME inputs except a changed emphasis on ONE note, and asserts that the unchanged notes keep referential identity while the changed note is a new object. Use `renderHook` with a Jotai `Provider`. Concretely:

```ts
import { describe, expect, it } from "vitest";
// import the (newly exported) pure builder so we can test identity directly
import { buildRenderedFretboardNotes } from "./useAnimatedFretboardView";

describe("buildRenderedFretboardNotes identity stability", () => {
  it("preserves object identity for notes whose inputs are unchanged", () => {
    const noteData = [
      /* two fake NoteData entries at distinct string/fret positions, with the
         minimum fields buildRenderedFretboardNotes reads — fill from the real
         NoteData type. Give each a stable position key. */
    ];
    const a = buildRenderedFretboardNotes({ noteData, /* other args unchanged */ });
    const b = buildRenderedFretboardNotes({ noteData, /* other args unchanged */ });
    expect(b[0]).toBe(a[0]); // same inputs → same reference (cache hit)
    expect(b[1]).toBe(a[1]);
  });

  it("returns a new object only for the note whose inputs changed", () => {
    const base = [/* note0 */, /* note1 */];
    const a = buildRenderedFretboardNotes({ noteData: base, /* ... */ });
    const changed = [base[0], { ...base[1], /* flip one emphasis-affecting field */ }];
    const b = buildRenderedFretboardNotes({ noteData: changed, /* ... */ });
    expect(b[0]).toBe(a[0]); // unchanged note keeps identity
    expect(b[1]).not.toBe(a[1]); // changed note is rebuilt
  });
});
```

The builder must be module-level (not a closure capturing per-render state) and own a `Map<positionKey, { inputsHash; result }>` cache. The cache key is the `"string-fret"` position; the value is invalidated when any field that affects the rendered output changes.

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: FAIL — current builder returns new objects every call.

- [ ] **Step 3: Implement reference caching**

In `useAnimatedFretboardView.ts`, export `buildRenderedFretboardNotes` and give it a module-level cache. For each note compute a cheap structural signature string of exactly the fields that determine the rendered output (`noteClass`, `displayValue`, `cx`, `cy`, `applyDimOpacity`, `applyLensEmphasis.opacityBoost|radiusBoost|glowColor`, `isHidden`, `isTension`, `isGuideTone`, `scaleDegree`, `degreeColor`, `fullChordShape`, `displayFormat`-independent fields, etc. — match the destructured set used by `FretboardNoteLayer`). If the signature for a position key matches the cached entry, return the cached object; otherwise build a fresh object and store it. Keep the cache bounded by clearing entries not seen in the current pass (rebuild a fresh `Map` each call, seeded from the previous one) so it can't leak across fretboard reconfigurations.

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts
git commit -m "perf(fretboard): stabilize per-note object identity across emphasis changes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extract a memoized `FretboardNote` so unchanged notes skip re-render

**Files:**
- Create: `src/components/FretboardSVG/FretboardNote.tsx`
- Modify: `src/components/FretboardSVG/FretboardNoteLayer.tsx`
- Test: `src/components/FretboardSVG/FretboardNoteLayer.test.tsx` (add a render-count assertion; create if absent)

**Why:** Even with stable note identity, the inline `.map()` rebuilds every note's JSX on each `FretboardNoteLayer` render. Extracting each note into a `memo`'d component lets React bail on notes whose `note` object reference is unchanged (Task 1 provides that), cutting the per-transition cost from ~150 notes to the few that changed.

- [ ] **Step 1: Write the failing test**

Add a render-count test to `FretboardNoteLayer.test.tsx`: render `FretboardNoteLayer` with N notes, then re-render with a `notes` array where only ONE note object reference changed (others identical references). Assert that the per-note render counter incremented for exactly one note. Use a module-level counter incremented inside a test spy, or React Testing Library + a `Profiler`/instrumented `FretboardNote`. Concrete approach — count renders via a `Profiler`-free spy:

```tsx
import { render } from "@testing-library/react";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
// Build a notes array of stable references; mutate one reference on re-render.
```

The assertion is behavioral: re-rendering with one changed note reference must NOT re-execute the rendering work for the other notes. If a render-count spy on the extracted `FretboardNote` is hard to wire, assert instead that `FretboardNote` is wrapped in `memo` and that the layer passes the note object by reference (a structural test), plus a snapshot that output is unchanged.

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNoteLayer.test.tsx`
Expected: FAIL — every note re-renders because they're inline (no memo boundary).

- [ ] **Step 3: Extract `FretboardNote`**

Move the entire per-note `.map()` body (lines ~82–219 of the current `FretboardNoteLayer.tsx`) into a new `FretboardNote.tsx` as `export const FretboardNote = memo(function FretboardNote(props) { ... })`. Props: the single `RenderedFretboardNote` (or its destructured primitives) plus `noteBubblePx`, `displayFormat`, `degreeColorsEnabled`, `onNoteClick`, `animationMode`-independent fields. Keep `CAGED_SHAPE_*`, `ROLE_DESCRIPTIONS`, `formatRole`, and the `getNoteVisuals`/`squirclePath` calls inside the new component (or import the shared maps). `FretboardNoteLayer` becomes:

```tsx
export const FretboardNoteLayer = memo(({ notes, noteBubblePx, displayFormat, degreeColorsEnabled, onNoteClick, animationMode = "css" }: FretboardNoteLayerProps) => (
  <g data-motion={animationMode}>
    {notes.map((note) => (
      <FretboardNote
        key={`note-${note.stringIndex}-${note.fretIndex}`}
        note={note}
        noteBubblePx={noteBubblePx}
        displayFormat={displayFormat}
        degreeColorsEnabled={degreeColorsEnabled}
        onNoteClick={onNoteClick}
      />
    ))}
  </g>
));
```

`onNoteClick` is already a stable `useCallback` in `Fretboard.tsx` (verify), so it won't break memo. Pass the whole `note` object so memo compares by the reference Task 1 stabilizes.

- [ ] **Step 4: Run the test + the existing FretboardSVG/visual suites**

Run: `pnpm exec vitest run src/components/FretboardSVG/`
Expected: PASS — render-count test green; existing FretboardNoteLayer/FretboardSVG tests unchanged (output identical).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNoteLayer.tsx src/components/FretboardSVG/FretboardNoteLayer.test.tsx
git commit -m "perf(fretboard): memoize per-note rendering so unchanged notes skip re-render

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Skip redundant signal-graph rebuilds in `configureProgressionGraph`

**Files:**
- Modify: `src/progressions/audio/bus.ts` (the `configureProgressionGraph` function)
- Test: `src/progressions/audio/bus.test.ts` (or `configureGraph.test.ts` — use whichever already tests this function)

**Why:** `configureProgressionGraph` disconnects every layer, disposes the prior graph, materializes a new one, and rewires — on every play, even when the tier+mix (and therefore the `SignalGraphPlan`) are identical. This is synchronous work in the play click task. Guarding it removes that cost on repeated plays of the same genre/quality.

- [ ] **Step 1: Write the failing test**

In the bus test file, mock/spy `materializeSignalGraph` (or assert via a side effect) and call `configureProgressionGraph(plan)` twice with a deeply-equal plan. Assert the graph is materialized **once** (second call is a no-op), and that calling with a DIFFERENT plan does rebuild. Also assert the returned graph is the existing one on the no-op path.

```ts
it("does not rebuild the graph when the plan is unchanged", () => {
  const plan = planSignalGraph(TIER_PROFILES.standard, DEFAULT_GENRE_MIX);
  const g1 = configureProgressionGraph(plan);
  const g2 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.standard, DEFAULT_GENRE_MIX)); // equal plan
  expect(g2).toBe(g1); // reused, not rebuilt
});

it("rebuilds when the plan changes", () => {
  const g1 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.standard, GENRE_MIX_A));
  const g2 = configureProgressionGraph(planSignalGraph(TIER_PROFILES.standard, GENRE_MIX_B));
  expect(g2).not.toBe(g1);
});
```

Match the real exports for `planSignalGraph`, `TIER_PROFILES`, `DEFAULT_GENRE_MIX`, and two distinct genre mixes. If the test env lacks a Web Audio context, guard like the existing bus tests do (they already handle `unsupported`).

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/bus.test.ts`
Expected: FAIL — current code always rebuilds (`g2 !== g1`).

- [ ] **Step 3: Implement the guard**

In `bus.ts`, store the last applied plan alongside `currentGraph` (module-level `let lastPlanKey: string | null`). At the top of `configureProgressionGraph`, compute a stable serialization of `plan` (`JSON.stringify` of the plain plan object — it's a pure data object from `planSignalGraph`). If it equals `lastPlanKey` and `currentGraph` exists, return `currentGraph` without disconnect/dispose/rewire. Otherwise do the existing teardown+materialize+rewire and set `lastPlanKey`. Ensure `lastPlanKey` is reset wherever `currentGraph` is disposed/reset elsewhere (search for `currentGraph =` assignments and keep them in sync), and on `ensureProgressionAudio` teardown.

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/bus.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/bus.ts src/progressions/audio/bus.test.ts
git commit -m "perf(progressions): skip redundant signal-graph rebuild when plan is unchanged

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Document the visualClock descope + full verification gate

**Files:**
- Modify: `src/progressions/audio/visualClock.ts` (comment only)
- Verification only otherwise.

- [ ] **Step 1: Add a comment recording the evidence-based decision**

At the top of the `frame()` function in `visualClock.ts`, add a brief comment:

```ts
// PERF NOTE (2026-06-01): profiling showed this rAF loop is cheap — ~117ms total
// across a ~24.7s capture (~0.08ms/frame), with no per-frame React subscribers to
// progressionVisualFrameAtom (only the derived anticipationActiveAtom, which flips
// at thresholds, and ProgressionPlayhead's WAAPI callback). The playback jank was
// the FretboardNoteLayer re-render (see 2026-06-01-playback-render-perf.md), not
// this loop. Do not throttle without fresh evidence.
```

- [ ] **Step 2: Full verification gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all green. (`tsc -b` exit 0 is ground truth.)

- [ ] **Step 3: Re-profile to confirm the fix (manual, with the user)**

After build, the user re-captures a React Profiler trace of a play→stop. Expected: `FretboardNoteLayer` self-time per playback commit drops from ~29ms to a few ms (only changed notes render), and the play/stop INP drops out of the violation range.

- [ ] **Step 4: Commit + push + open PR**

```bash
git add src/progressions/audio/visualClock.ts docs/superpowers/plans/2026-06-01-playback-render-perf.md
git commit -m "docs(perf): record visualClock descope rationale + playback render plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin perf-playback-render
gh pr create --draft --base main --head perf-playback-render \
  --title "perf: stop full fretboard re-render on playback + skip redundant signal-graph rebuild" \
  --body "Fixes the start/stop/loop main-thread violations and slow genre start. Profiler-confirmed root cause: FretboardNoteLayer re-rendered all ~150 notes (~29ms) on every playback transition; configureProgressionGraph rebuilt the whole signal graph on every play. visualClock throttling was investigated and dropped (rAF ~0.08ms/frame). 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review Notes

- **Confirmed targets only:** Fix A targets `FretboardNoteLayer` (React-Profiler-confirmed 29ms hotspot); Fix B targets `configureProgressionGraph` (Explore-confirmed non-idempotent rebuild). No speculative changes.
- **Descope is evidence-backed:** visualClock left unchanged with a comment citing the rAF measurement.
- **Risk:** Fix A's identity cache (Task 1) is the linchpin for Task 2's memo to help — Task 2 is near-useless without Task 1, so they ship together and are verified by the render-count test and a re-profile.
- **Type consistency:** `buildRenderedFretboardNotes` (exported in Task 1) and `FretboardNote` (created in Task 2) must agree on the `RenderedFretboardNote` shape from `useAnimatedFretboardView.ts`.
- **No placeholders that hide work:** the test bodies reference real exports the implementer must read from source; the implementer reads `useAnimatedFretboardView.ts` and `FretboardNoteLayer.tsx` first (both are short) to fill the exact field lists.
