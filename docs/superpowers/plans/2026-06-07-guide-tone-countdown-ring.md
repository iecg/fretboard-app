# Guide-Tone Countdown Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-phase breathe→drain guide-tone hint with one continuous clockwise drain over a single countdown window, plus static beat-tick notches on the halo track, so a player can read how much chord time remains.

**Architecture:** A new single countdown window (`min(step, 2·bar)`) and `active` flag collapse today's planning + lead-in atoms for the animated ring. A pure tick-fraction function (capped at 4 segments) drives static notch positions, threaded as a prop to `FretboardNote`. CSS runs one `stroke-dashoffset` drain over `--guide-duration` with a brightness + gentle looming ramp; the existing on-beat flash stays as the climax. The change is additive first (new atoms/fields), then the emphasis pipeline switches to the single flag, then dead two-phase code is removed.

**Tech Stack:** React 19 + TypeScript, Jotai atoms, CSS Modules, Vitest + Testing Library, Playwright visual regression. Package manager: **pnpm**.

**Spec:** [docs/superpowers/specs/2026-06-07-guide-tone-countdown-ring-design.md](../specs/2026-06-07-guide-tone-countdown-ring-design.md)

**Implementation note on the intensity ramp:** the spec calls for "stroke-width + brightness." The core ring's `stroke-width` is locked with `!important` (to beat the note-role descendant rules — see `FretboardSVG.module.css:250`), and CSS animations cannot override an `!important` declaration. So the escalation is implemented as **core brightness (opacity ramp) + a gentle whole-ring looming scale** on the ring group — same "increasing salience as the beat approaches" intent, no `!important` fight. This is the one deliberate deviation from the spec's literal wording.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/store/practiceLensAtoms.ts` | Window/tick pure math + countdown atoms | Modify |
| `src/store/practiceLensAtoms.test.ts` | Unit tests for the above | Modify |
| `src/components/FretboardSVG/hooks/useEmphasisContext.ts` | Atom→context bridge | Modify |
| `src/components/FretboardSVG/utils/semantics.ts` | `getEmphasis` single-role logic + types | Modify |
| `src/components/FretboardSVG/utils/semantics.test.ts` | `getEmphasis` tests | Modify |
| `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` | Per-note `LeadLensContext` build | Modify |
| `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` | Build tests | Modify |
| `src/components/FretboardSVG/FretboardNote.tsx` | Single drain phase + notches + ramp | Modify |
| `src/components/FretboardSVG/FretboardNote.test.tsx` | Note render tests | Modify |
| `src/components/FretboardSVG/FretboardNoteLayer.tsx` | Thread `countdownTicks` prop | Modify |
| `src/components/FretboardSVG/FretboardSVG.tsx` | `--guide-duration` var, ticks prop, phase attr | Modify |
| `src/components/FretboardSVG/FretboardSVG.test.tsx` | Board-attr / CSS-var tests | Modify |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Single drain + ramp + tick styles | Modify |
| `e2e/**` (fretboard-svg snapshots) | Visual regression baselines | Regenerate |

---

## Task 1: Pure window + tick math

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (add after `isInPlanningWindow`, ~line 174)
- Test: `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/store/practiceLensAtoms.test.ts`. First extend the import on line 11 to include the two new symbols:

```ts
// add to the existing import from "./practiceLensAtoms":
  isInCountdownWindow,
  computeCountdownTickFractions,
```

Then append these `describe` blocks after the `isInPlanningWindow` block (after line 734):

```ts
// ---------------------------------------------------------------------------
// isInCountdownWindow — single continuous countdown window
// ---------------------------------------------------------------------------

describe("isInCountdownWindow", () => {
  it("is active across the whole step when step <= 2 bars", () => {
    // step 2000, bar 2000: window = min(2000, 4000) = 2000 -> start fraction 0
    expect(isInCountdownWindow(0, 2000, 2000)).toBe(true);
    expect(isInCountdownWindow(0.99, 2000, 2000)).toBe(true);
  });

  it("caps the window at 2 bars for long chords", () => {
    // step 8000, bar 2000: window = min(8000, 4000) = 4000 -> start fraction 0.5
    expect(isInCountdownWindow(0.49, 8000, 2000)).toBe(false);
    expect(isInCountdownWindow(0.5, 8000, 2000)).toBe(true);
  });

  it("returns false for a non-positive step duration", () => {
    expect(isInCountdownWindow(0.5, 0, 2000)).toBe(false);
    expect(isInCountdownWindow(0.5, -100, 2000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeCountdownTickFractions — beat/bar boundary notches, capped at 4
// ---------------------------------------------------------------------------

describe("computeCountdownTickFractions", () => {
  it("one tick per beat boundary when <= 4 beats", () => {
    // 4 beats -> 4 segments -> interior ticks at 1/4, 2/4, 3/4
    expect(computeCountdownTickFractions(4000, 1000, 4000)).toEqual([0.25, 0.5, 0.75]);
  });

  it("two beats yields a single midpoint tick", () => {
    expect(computeCountdownTickFractions(2000, 1000, 4000)).toEqual([0.5]);
  });

  it("suppresses ticks below 2 beats", () => {
    expect(computeCountdownTickFractions(1000, 1000, 4000)).toEqual([]);
  });

  it("collapses to bar boundaries when > 4 beats and bars in 2..4", () => {
    // 8 beats, 2 bars -> segment by bar -> one tick at 0.5
    expect(computeCountdownTickFractions(8000, 1000, 4000)).toEqual([0.5]);
    // 12 beats, 3 bars -> ticks at 1/3, 2/3
    expect(computeCountdownTickFractions(12000, 1000, 4000)).toEqual([1 / 3, 2 / 3]);
  });

  it("falls back to 4 even segments when bars also exceed 4", () => {
    // 20 beats, 5 bars -> 4 even segments -> 0.25, 0.5, 0.75
    expect(computeCountdownTickFractions(20000, 1000, 4000)).toEqual([0.25, 0.5, 0.75]);
  });

  it("returns [] for non-positive window or beat length", () => {
    expect(computeCountdownTickFractions(0, 1000, 4000)).toEqual([]);
    expect(computeCountdownTickFractions(4000, 0, 4000)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts -t "isInCountdownWindow"`
Expected: FAIL — `isInCountdownWindow is not a function` / `computeCountdownTickFractions is not a function`.

- [ ] **Step 3: Implement the two pure functions**

In `src/store/practiceLensAtoms.ts`, insert after `isInPlanningWindow` (after line 174, before the `stepRelativeFraction` doc comment on line 176):

```ts
/**
 * True when the playhead is inside the single continuous countdown window — the
 * union of the old planning + landing windows. The window spans the final
 * `min(step, PLANNING_RUNWAY_BARS · bar)` of the step and ends exactly on the
 * beat. Pure so it is unit-testable without atom plumbing.
 */
export function isInCountdownWindow(
  stepFraction: number,
  stepDurationMs: number,
  barDurationMs = Infinity,
): boolean {
  if (stepDurationMs <= 0) return false;
  const windowMs = Math.min(stepDurationMs, PLANNING_RUNWAY_BARS * barDurationMs);
  if (windowMs <= 0) return false;
  const startFraction = 1 - windowMs / stepDurationMs;
  return stepFraction >= startFraction;
}

/** Lowest beat count that shows interior ticks (a lone tick is noise). */
const MIN_TICK_BEATS = 2;
/** Subitizing cap — at most this many segments (≤ 3 interior ticks). */
const MAX_TICK_SEGMENTS = 4;

/**
 * Window-fractions in (0,1) at which to draw static beat/bar boundary notches.
 *
 * - ≤ 4 beats → one segment per beat (subitizable at a glance).
 * - > 4 beats → collapse to bar lines when there are 2–4 bars, else 4 even
 *   segments (caps interior ticks at 3 — the ~4-object subitizing limit).
 * - < 2 beats → no ticks.
 *
 * Pure so it is unit-testable. `windowMs`/`beatMs`/`barMs` are all in ms.
 */
export function computeCountdownTickFractions(
  windowMs: number,
  beatMs: number,
  barMs: number,
): number[] {
  if (windowMs <= 0 || beatMs <= 0) return [];
  const beats = Math.round(windowMs / beatMs);
  if (beats < MIN_TICK_BEATS) return [];

  let segments: number;
  if (beats <= MAX_TICK_SEGMENTS) {
    segments = beats;
  } else {
    const bars = barMs > 0 ? Math.round(windowMs / barMs) : 0;
    segments = bars >= 2 && bars <= MAX_TICK_SEGMENTS ? bars : MAX_TICK_SEGMENTS;
  }

  const ticks: number[] = [];
  for (let i = 1; i < segments; i++) ticks.push(i / segments);
  return ticks;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts -t "isInCountdownWindow"` then `pnpm run test src/store/practiceLensAtoms.test.ts -t "computeCountdownTickFractions"`
Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(guide-tone): countdown window + tick-fraction pure math"
```

---

## Task 2: Countdown atoms

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (add after `planningWindowActiveAtom`, ~line 665)
- Test: `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

Extend the import on line 11 of `src/store/practiceLensAtoms.test.ts` to add:

```ts
  guideCountdownWindowMsAtom,
  guideCountdownActiveAtom,
  guideCountdownTickFractionsAtom,
```

Append after the `transition perf budget` describe block (end of file). This reuses the existing `makePlayingStore` helper pattern (see lines 785–792) — copy a local helper into this block:

```ts
describe("guide countdown atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makePlayingStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    store.set(progressionPlayingStateAtom, true);
    return store;
  }

  it("guideCountdownWindowMsAtom = min(step, 2·bar)", () => {
    const store = makePlayingStore();
    const step = store.get(progressionStepDurationMsAtom);
    const bar = store.get(progressionBarDurationMsAtom);
    expect(store.get(guideCountdownWindowMsAtom)).toBe(Math.min(step, 2 * bar));
  });

  it("guideCountdownTickFractionsAtom matches the pure helper for the active step", () => {
    const store = makePlayingStore();
    const windowMs = store.get(guideCountdownWindowMsAtom);
    const bar = store.get(progressionBarDurationMsAtom);
    const beatsPerBar = store.get(beatsPerBarAtom);
    const beatMs = beatsPerBar > 0 ? bar / beatsPerBar : 0;
    expect(store.get(guideCountdownTickFractionsAtom)).toEqual(
      computeCountdownTickFractions(windowMs, beatMs, bar),
    );
  });

  it("guideCountdownActiveAtom is false outside the window and true inside", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    const stepMs = store.get(progressionStepDurationMsAtom);
    const bar = store.get(progressionBarDurationMsAtom);
    const windowMs = Math.min(stepMs, 2 * bar);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false });

    // Deadline far in the future → step barely started → outside the window.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 1000);
    expect(store.get(guideCountdownActiveAtom)).toBe(false);

    // Deadline inside the window → active.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 50);
    expect(store.get(guideCountdownActiveAtom)).toBe(true);
  });

  it("guideCountdownActiveAtom holds across the boundary gap (audio ahead of displayed)", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    // Audio frame already on the next step while the fretboard still shows step 0.
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0.0, localFraction: 0.0, paused: false });
    expect(store.get(guideCountdownActiveAtom)).toBe(true);
  });
});
```

(`progressionStepsAtom`, `progressionPlayingStateAtom`, `displayedStepIndexPrimitiveAtom`, `progressionVisualFrameAtom`, `progressionStepDeadlineAtom`, `progressionStepDurationMsAtom`, `progressionBarDurationMsAtom`, `beatsPerBarAtom` are already imported at the top of this test file — they are used by the existing lead-in/perf blocks.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts -t "guide countdown atoms"`
Expected: FAIL — the three atoms are not exported.

- [ ] **Step 3: Implement the atoms**

In `src/store/practiceLensAtoms.ts`, add after `planningWindowActiveAtom` (after line 665):

```ts
/**
 * Length of the single continuous countdown window, in ms — `min(step, 2·bar)`.
 * Written to the `--guide-duration` CSS custom property so the drain lasts
 * exactly the window. Changes only when the active step / tempo changes.
 */
export const guideCountdownWindowMsAtom = atom((get): number => {
  const step = get(progressionStepDurationMsAtom);
  const bar = get(progressionBarDurationMsAtom);
  return Math.min(step, PLANNING_RUNWAY_BARS * bar);
});

/**
 * Window-fractions for the static beat-tick notches on the countdown ring.
 * Derived from the countdown window and meter via
 * {@link computeCountdownTickFractions}. Recomputes only on step/tempo/meter
 * change — never per frame.
 */
export const guideCountdownTickFractionsAtom = atom((get): number[] => {
  const windowMs = get(guideCountdownWindowMsAtom);
  const bar = get(progressionBarDurationMsAtom);
  const beatsPerBar = get(beatsPerBarAtom);
  const beatMs = beatsPerBar > 0 ? bar / beatsPerBar : 0;
  return computeCountdownTickFractions(windowMs, beatMs, bar);
});

/**
 * Single continuous countdown phase — the union of the old planning + landing
 * windows. True whenever the playhead is inside {@link isInCountdownWindow} for
 * the active step, AND (like {@link leadInActiveAtom}) held true across the
 * boundary-gap where the audio frame leads the displayed step. Reads the
 * per-frame visual frame, but its VALUE only flips at the window threshold, so
 * subscribers re-render at most twice per step.
 */
export const guideCountdownActiveAtom = atom((get): boolean => {
  if (!get(progressionPlayingAtom)) return false;
  const frame = get(progressionVisualFrameAtom);
  if (!frame || frame.paused) return false;
  const displayed = get(displayedProgressionStepIndexAtom);
  // Boundary gap: audio has crossed into a later step than the fretboard shows —
  // hold the ring on until the displayed shape catches up (same as lead-in).
  if (frame.stepIndex !== displayed) return true;
  // Only trust the step fraction when the deadline's step matches displayed.
  if (get(activeProgressionStepIndexAtom) !== displayed) return false;
  const deadline = get(progressionStepDeadlineAtom);
  if (deadline == null) return false;
  const stepMs = get(progressionStepDurationMsAtom);
  const stepFraction = stepRelativeFraction(deadline, Date.now(), stepMs);
  return isInCountdownWindow(stepFraction, stepMs, get(progressionBarDurationMsAtom));
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts -t "guide countdown atoms"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(guide-tone): countdown window/active/tick atoms"
```

---

## Task 3: Expose countdown fields on the emphasis context (additive)

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useEmphasisContext.ts`

This task is additive — it adds `guideCountdownActive` + `countdownTicks` to `EmphasisContext` while leaving `leadInActive`/`planningActive` in place, so the codebase still compiles. The switch happens in Task 4.

- [ ] **Step 1: Add the new atoms to the imports**

In `src/components/FretboardSVG/hooks/useEmphasisContext.ts`, extend the import block (lines 2–10):

```ts
import {
  nextChordGuideTonesAtom,
  nextChordGuideToneLabelsAtom,
  nextChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
  leadInActiveAtom,
  planningWindowActiveAtom,
  guideCountdownActiveAtom,
  guideCountdownTickFractionsAtom,
} from "../../../store/practiceLensAtoms";
```

- [ ] **Step 2: Extend the interface and the returned object**

Replace the `EmphasisContext` interface (lines 13–21) with:

```ts
export interface EmphasisContext {
  nextGuideTones: Set<string>;
  nextGuideToneLabels: Map<string, string>;
  nextChordTones: Set<string>;
  incomingTones: Set<string>;
  departingTones: Set<string>;
  leadInActive: boolean;
  planningActive: boolean;
  guideCountdownActive: boolean;
  countdownTicks: number[];
}
```

Replace the body of `useEmphasisContext` (lines 28–47) with:

```ts
export function useEmphasisContext(enabled: boolean): EmphasisContext | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const leadInActive = useAtomValue(leadInActiveAtom);
  const planningActive = useAtomValue(planningWindowActiveAtom);
  const guideCountdownActive = useAtomValue(guideCountdownActiveAtom);
  const countdownTicks = useAtomValue(guideCountdownTickFractionsAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);
  const nextGuideToneLabels = useAtomValue(nextChordGuideToneLabelsAtom);
  const nextChordTones = useAtomValue(nextChordTonesAtom);
  const incomingTones = useAtomValue(incomingTonesAtom);
  const departingTones = useAtomValue(departingTonesAtom);
  if (!enabled || !playing) return null;
  return {
    nextGuideTones,
    nextGuideToneLabels,
    nextChordTones,
    incomingTones,
    departingTones,
    leadInActive,
    planningActive,
    guideCountdownActive,
    countdownTicks,
  };
}
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `pnpm run test src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: PASS (existing tests still green — the new fields are optional additions consumers don't yet read).

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/hooks/useEmphasisContext.ts
git commit -m "feat(guide-tone): expose countdown active + ticks on emphasis context"
```

---

## Task 4: Switch `getEmphasis` to the single countdown role

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts`
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`
- Test: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`

- [ ] **Step 1: Update the failing tests first**

In `src/components/FretboardSVG/utils/semantics.test.ts`, find the test at line 468 (`marks a next-chord guide tone as 'guide-preview' during the planning window`). Replace that test — and adjust any sibling test that passes `leadInActive`/`planningActive` — so the context uses the new single flag. The replacement test:

```ts
it("marks a next-chord guide tone as 'guide-target' during the countdown window", () => {
  const e = getEmphasis("chord-tone-in-scale", true, {
    notePc: "B",
    nextGuideTones: new Set(["B"]),
    nextGuideToneLabels: new Map([["B", "3"]]),
    nextChordTones: new Set(["B", "D", "G"]),
    incomingTones: new Set(["B"]),
    departingTones: new Set(),
    guideCountdownActive: true,
  });
  expect(e.transitionRole).toBe("guide-target");
  expect(e.guideTargetLabel).toBe("3");
});

it("returns the resting emphasis when the countdown window is inactive", () => {
  const e = getEmphasis("chord-tone-in-scale", true, {
    notePc: "B",
    nextGuideTones: new Set(["B"]),
    nextGuideToneLabels: new Map([["B", "3"]]),
    nextChordTones: new Set(["B", "D", "G"]),
    incomingTones: new Set(["B"]),
    departingTones: new Set(),
    guideCountdownActive: false,
  });
  expect(e.transitionRole).toBeUndefined();
});
```

Search the rest of `semantics.test.ts` for any other object literal that sets `leadInActive:` or `planningActive:` and replace those keys with `guideCountdownActive:` (true where either was true).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/components/FretboardSVG/utils/semantics.test.ts`
Expected: FAIL — `LeadLensContext` still requires `leadInActive`/`planningActive`; `guideCountdownActive` is not a known property.

- [ ] **Step 3: Update `LeadLensContext` and `getEmphasis`**

In `src/components/FretboardSVG/utils/semantics.ts`, replace the two phase fields in `LeadLensContext` (lines 39–42):

```ts
  /** True while the single continuous countdown window is open. */
  guideCountdownActive: boolean;
```

Replace the body of `getEmphasis` after the `if (!leadContext)` guard (lines 71–96) with:

```ts
  const { notePc, nextGuideTones, nextGuideToneLabels, guideCountdownActive } = leadContext;

  // The note's resting emphasis when not actively targeted — the base model.
  const resting: LensEmphasis = applyTonesBase(noteClass);

  // Countdown: the next chord's guide tones get the single continuous ring.
  if (guideCountdownActive && nextGuideTones.has(notePc)) {
    return {
      radiusBoost: resting.radiusBoost,
      opacityBoost: 1,
      transitionRole: "guide-target",
      guideTargetLabel: nextGuideToneLabels.get(notePc),
    };
  }
  return resting;
```

Leave `TransitionRole` (line 9) as `"guide-target" | "guide-preview"` for now — `"guide-preview"` becomes unused but the union stays valid; it is removed in Task 8.

- [ ] **Step 4: Update the per-note context build**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, replace the `leadContext` assignment (lines 43–52) with:

```ts
      leadContext = {
        notePc: note.noteName,
        nextGuideTones: emphasisContext.nextGuideTones,
        nextGuideToneLabels: emphasisContext.nextGuideToneLabels,
        nextChordTones: emphasisContext.nextChordTones,
        incomingTones: emphasisContext.incomingTones,
        departingTones: emphasisContext.departingTones,
        guideCountdownActive: emphasisContext.guideCountdownActive,
      };
```

- [ ] **Step 5: Update any build-test that sets the old flags**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`, search for `leadInActive`/`planningActive` in any `EmphasisContext` literal and replace with `guideCountdownActive` (and add `countdownTicks: []` if the literal is a full `EmphasisContext`). Run the file to see exact failures:

Run: `pnpm run test src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected before fix: FAIL (type/shape mismatch). Fix each literal, then re-run.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm run test src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts
git commit -m "feat(guide-tone): single countdown role in getEmphasis"
```

---

## Task 5: FretboardNote — single drain phase + notches + `countdownTicks` prop

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`
- Modify: `src/components/FretboardSVG/FretboardNoteLayer.tsx`
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Update the failing tests first**

In `src/components/FretboardSVG/FretboardNote.test.tsx`:

Replace the `guide-preview` ring test (lines 145–155) with a notch-rendering test, and update the backing test (lines 195–199). Replace those two tests with:

```ts
  it("renders no ring for a note without a transition role", () => {
    const { container } = renderNote(makeNote({ transitionRole: undefined }));
    expect(container.querySelector("[data-guide-ring]")).toBeNull();
  });

  it("renders beat-tick notches for a primary guide-target note when ticks are provided", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target", isInRegion: true }),
      { countdownTicks: [0.25, 0.5, 0.75] },
    );
    expect(container.querySelectorAll("[data-guide-tick]")).toHaveLength(3);
  });

  it("renders no notches for a secondary (out-of-region) guide-target note", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target", isInRegion: false }),
      { countdownTicks: [0.25, 0.5, 0.75] },
    );
    expect(container.querySelectorAll("[data-guide-tick]")).toHaveLength(0);
  });
```

Find the `renderNote` helper near the top of the file. It currently renders `<FretboardNote note={...} .../>` inside an `<svg>`. Add an optional second argument so tests can pass `countdownTicks`:

```ts
  function renderNote(
    note: RenderedFretboardNote,
    extra?: { countdownTicks?: number[] },
  ) {
    return render(
      <svg>
        <FretboardNote
          note={note}
          noteBubblePx={24}
          displayFormat="notes"
          countdownTicks={extra?.countdownTicks}
        />
      </svg>,
    );
  }
```

(If the existing helper signature differs, adapt — the key change is forwarding `countdownTicks`.) Also confirm `makeNote` supports an `isInRegion` field; it is part of `RenderedFretboardNote`, so add `isInRegion: false` to the `makeNote` defaults if missing, and allow overrides.

Update the landing test at line 157 to also assert `data-guide-phase='landing'` still holds for `guide-target` (unchanged behavior). The test at line 145 referencing `'preview'` is the one being replaced above.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: FAIL — `countdownTicks` is not a prop; no `[data-guide-tick]` elements.

- [ ] **Step 3: Add the prop + collapse the phase mapping**

In `src/components/FretboardSVG/FretboardNote.tsx`:

Add to `FretboardNoteProps` (after line 38, before `onNoteClick`):

```ts
  /** Window-fractions (0,1) for static beat-tick notches on the countdown ring. */
  countdownTicks?: number[];
```

Add `countdownTicks` to the destructured params (after `numStrings,` on line 47):

```ts
  countdownTicks,
```

Replace the `guidePhase` computation (lines 71–76) with the single-role mapping:

```ts
  const guidePhase = transitionRole === "guide-target" ? "landing" : undefined;
```

Add a tick-length constant near the top of the file (after the `formatRole` definition, ~line 28):

```ts
// Arc length (in pathLength=100 units) of a single tick notch on the ring.
const TICK_ARC_LEN = 1.2;
```

- [ ] **Step 4: Render the notches inside the ring group**

In `FretboardNote.tsx`, inside the `<motion.g>` ring group, after the flash `<circle>` (line 226) and before the closing `</motion.g>` (line 227), add:

```tsx
            {/* Static beat-tick notches — dark pips on the halo track that the
                green core sweeps past, giving a countable "segment done" read.
                Only on PRIMARY (in-region) targets, and only when the step has
                enough beats to warrant ticks (countdownTicks empty otherwise).
                Drawn with the SAME pathLength=100 circle parametrization as the
                drain so each notch sits exactly where the hand is at that
                window-fraction — no trig, no origin/direction mismatch.
                NOTE: if a snapshot shows the notches mirrored relative to the
                drain hand, flip the sign of strokeDashoffset (use `100 * f`). */}
            {note.isInRegion &&
              countdownTicks?.map((f, i) => (
                <circle
                  key={`tick-${i}`}
                  className={styles["note-guide-ring-tick"]}
                  data-guide-tick="true"
                  cx={cx}
                  cy={cy}
                  r={ringR}
                  pathLength={100}
                  strokeDasharray={`${TICK_ARC_LEN} ${100 - TICK_ARC_LEN}`}
                  strokeDashoffset={-100 * f}
                  aria-hidden="true"
                />
              ))}
```

- [ ] **Step 5: Thread the prop through the layer**

In `src/components/FretboardSVG/FretboardNoteLayer.tsx`:

Add to `FretboardNoteLayerProps` (after line 14):

```ts
  /** Window-fractions for the countdown ring's beat-tick notches. */
  countdownTicks?: number[];
```

Add `countdownTicks` to the destructured props (after `numStrings,` on line 29):

```ts
  countdownTicks,
```

Pass it to each `FretboardNote` (inside the map, after `numStrings={numStrings}` on line 43):

```tsx
        countdownTicks={countdownTicks}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm run test src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNoteLayer.tsx src/components/FretboardSVG/FretboardNote.test.tsx
git commit -m "feat(guide-tone): single drain phase + beat-tick notches in FretboardNote"
```

---

## Task 6: FretboardSVG — `--guide-duration`, ticks prop, phase attr

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Update the failing tests first**

In `src/components/FretboardSVG/FretboardSVG.test.tsx`, update the two tests at lines 851–887. The board now exposes `--guide-duration` and `data-transition-phase="countdown"` while the countdown window is active. Replace those tests:

```ts
    it("exposes --guide-duration and data-transition-phase during the countdown window", () => {
      // (Keep the same store/frame/deadline setup the original test used to put
      // the playhead inside the window — only the assertions change.)
      const board = screen.getByTestId("fretboard-svg");
      expect(board.style.getPropertyValue("--guide-duration")).toMatch(/\d+ms/);
      expect(board.getAttribute("data-transition-phase")).toBe("countdown");
    });

    it("data-transition-phase is absent when the playhead is outside the countdown window", () => {
      // (Same setup as the original "outside the lead-in window" test.)
      const board = screen.getByTestId("fretboard-svg");
      expect(board.getAttribute("data-transition-phase")).toBeNull();
    });
```

Keep the existing arrange/setup lines from the original two tests (the store seeding that drives `guideCountdownActiveAtom` true/false) — only swap the assertions and the test titles. If the original setup drove `leadInActiveAtom` via deadline inside the 50% window, that same setup also puts the playhead inside the countdown window (the countdown window is a superset), so the "active" test stays valid. For the "outside" test, ensure the deadline is far enough out that `isInCountdownWindow` is false (deadline > now + 2·bar).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/components/FretboardSVG/FretboardSVG.test.tsx -t "data-transition-phase"`
Expected: FAIL — board still emits `--lead-in-duration` / `"lead-in"`.

- [ ] **Step 3: Swap the atom wiring**

In `src/components/FretboardSVG/FretboardSVG.tsx`:

Replace the import on line 11:

```ts
import { guideCountdownActiveAtom, guideCountdownWindowMsAtom, guideCountdownTickFractionsAtom } from "../../store/practiceLensAtoms";
```

Replace the two `useAtomValue` lines (323–324) with:

```ts
  const guideCountdownActive = useAtomValue(guideCountdownActiveAtom);
  const guideCountdownWindowMs = useAtomValue(guideCountdownWindowMsAtom);
  const countdownTicks = useAtomValue(guideCountdownTickFractionsAtom);
```

Find every other use of `leadInActive` in this file (it previously came from `leadInActiveAtom`). The board attribute on line 611 used `leadInActive`; replace line 611 with:

```tsx
      data-transition-phase={guideCountdownActive ? "countdown" : undefined}
```

Replace the style block (lines 613–616) with:

```tsx
      style={{
        "--guide-duration": `${guideCountdownWindowMs}ms`,
      } as CSSProperties}
```

Pass ticks to the note layer — in the `<FretboardNoteLayer .../>` (lines 697–705), add after `numStrings={numStrings}`:

```tsx
                    countdownTicks={countdownTicks}
```

- [ ] **Step 4: Resolve any remaining `leadInActive` references**

Run: `grep -n "leadInActive\|leadInDurationMs\|planningDurationMs\|lead-in-duration\|planning-duration" src/components/FretboardSVG/FretboardSVG.tsx`
Expected: no matches. If any remain (e.g. an unused import of `leadInDurationMsAtom`/`planningDurationMsAtom`), delete them.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm run test src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "feat(guide-tone): drive countdown ring from single window in FretboardSVG"
```

---

## Task 7: CSS — single continuous drain + ramp + tick notches

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

No new unit test (CSS behavior is covered by the visual regression suite in Task 9). Each step is a concrete edit.

- [ ] **Step 1: Point the backing disc at the single phase**

Replace the two backing rules (lines 227–233) with one (the `preview` phase no longer exists):

```css
.note-target-backing[data-guide-phase="landing"] {
  opacity: 0.52;
}
```

- [ ] **Step 2: Remove the breathe, run one drain over the full window**

Delete the planning/breathe rule and keyframes (lines 281–298). Replace the landing core rule (lines 300–309) with a continuous drain plus a brightness ramp over `--guide-duration`:

```css
/* Countdown — the green core DRAINS clockwise around the dark halo track, like
   a clock hand, over the WHOLE countdown window, reaching empty exactly on the
   beat. A brightness (opacity) ramp escalates salience as the beat nears; the
   stroke weight stays constant (its `!important` lock can't be animated). The
   on-beat flash is the climax. `pathLength=100` (set in FretboardNote) lets the
   dash maths be radius-independent. */
.note-guide-ring[data-guide-phase="landing"][data-guide-primary="true"] .note-guide-ring-core {
  stroke-dasharray: 100;
  animation:
    note-guide-ring-drain var(--guide-duration, 4s) linear both,
    note-guide-ring-ramp var(--guide-duration, 4s) ease-in both;
}

@keyframes note-guide-ring-drain {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: 100; }
}

@keyframes note-guide-ring-ramp {
  0%   { opacity: 0.72; }
  70%  { opacity: 0.88; }
  100% { opacity: 1; }
}
```

- [ ] **Step 3: Add the looming scale on the ring group**

After the core rule above, add a gentle whole-ring looming scale over the window (composited transform — cheap). The ring group already has `transform-box: fill-box; transform-origin: center`:

```css
/* Looming — the whole countdown ring scales up very slightly across the window
   so the target reads as "approaching" (increasing-salience cue). Transform is
   GPU-composited, so this adds no per-frame paint. */
.note-guide-ring[data-guide-phase="landing"][data-guide-primary="true"] {
  animation: note-guide-ring-loom var(--guide-duration, 4s) ease-in both;
}

@keyframes note-guide-ring-loom {
  from { transform: scale(1); }
  to   { transform: scale(1.06); }
}
```

- [ ] **Step 4: Style the tick notches**

After the flash rules (after line 338), add:

```css
/* Beat-tick notches — short dark pips on the halo track at beat/bar
   boundaries. Drawn over the halo + core so they read as gauge marks the green
   hand sweeps past. Static (no animation) → zero per-frame paint. Stroke wider
   than the halo so each pip visibly crosses the whole track. */
.note-guide-ring-tick {
  fill: none !important;
  stroke: rgb(0 0 0 / 0.7) !important;
  stroke-width: 5.5 !important;
  pointer-events: none;
}
```

- [ ] **Step 5: Update reduced-motion**

Replace the reduced-motion block (lines 342–348) so it also kills the ramp + loom, and keeps the ticks as a static gauge over a full (non-draining) ring:

```css
/* Reduced motion: no drain, no ramp, no loom, no flash — a static full ring
   plus static tick notches still marks the target and conveys the beat grid;
   only the live countdown motion is dropped. */
@media (prefers-reduced-motion: reduce) {
  .note-guide-ring[data-guide-phase="landing"][data-guide-primary="true"],
  .note-guide-ring[data-guide-phase="landing"] .note-guide-ring-core,
  .note-guide-ring[data-guide-phase="landing"] .note-guide-ring-flash {
    animation: none;
  }
}
```

- [ ] **Step 6: Verify no stale `--planning-duration` / breathe references remain**

Run: `grep -n "planning-duration\|breathe\|guide-preview\|data-guide-phase=\"preview\"" src/components/FretboardSVG/FretboardSVG.module.css`
Expected: no matches.

- [ ] **Step 7: Lint the stylesheet + run the component tests**

Run: `pnpm run lint`
Expected: PASS (eslint + stylelint).

Run: `pnpm run test src/components/FretboardSVG/FretboardNote.test.tsx src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(guide-tone): continuous drain + brightness/loom ramp + tick notch CSS"
```

---

## Task 8: Cleanup — remove dead two-phase code

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts`
- Modify: `src/components/FretboardSVG/hooks/useEmphasisContext.ts`
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`
- Modify: tests touched below

This removes the now-unused `guide-preview` role and the `leadInActive`/`planningActive` context fields. Do this only after confirming nothing else consumes them.

- [ ] **Step 1: Confirm the old symbols are unused outside their definitions**

Run:
```bash
grep -rn "guide-preview\|planningActive\|\bleadInActive\b" src/components --include='*.ts' --include='*.tsx' | grep -v ".test."
```
Expected: matches only in the files listed for this task (definitions about to be removed). `leadInActiveAtom`, `planningWindowActiveAtom`, `leadInDurationMsAtom`, `planningDurationMsAtom` remain defined in `practiceLensAtoms.ts` with their own tests — leave those atoms in place (they are still independently tested and harmless); this task only removes the *component-layer* consumption.

- [ ] **Step 2: Remove `guide-preview` from the type and phase mapping**

In `src/components/FretboardSVG/utils/semantics.ts`, change line 9:

```ts
export type TransitionRole = "guide-target";
```

In `src/components/FretboardSVG/FretboardNote.tsx`, confirm `guidePhase` (now `transitionRole === "guide-target" ? "landing" : undefined`) has no remaining `"guide-preview"` reference (it was already collapsed in Task 5). Run: `grep -n "guide-preview" src/components/FretboardSVG/FretboardNote.tsx` → expect no matches.

- [ ] **Step 3: Drop the unused context fields**

In `src/components/FretboardSVG/hooks/useEmphasisContext.ts`:
- Remove `leadInActive` and `planningActive` from the `EmphasisContext` interface.
- Remove their `useAtomValue` reads and their keys in the returned object.
- Remove `leadInActiveAtom` and `planningWindowActiveAtom` from the import.

- [ ] **Step 4: Remove any test references to the dropped fields**

Run:
```bash
grep -rn "planningActive\|leadInActive\b" src/components/FretboardSVG --include='*.test.ts' --include='*.test.tsx'
```
For each match in `useEmphasisContext`/`useAnimatedFretboardView`/`semantics` tests, delete the field from the `EmphasisContext`/`LeadLensContext` literal (the `guideCountdownActive` field already replaces them from Tasks 3–4).

- [ ] **Step 5: Run the affected suites**

Run: `pnpm run test src/components/FretboardSVG`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG
git commit -m "refactor(guide-tone): remove dead two-phase preview machinery"
```

---

## Task 9: Visual regression + full verification

**Files:**
- Regenerate: `e2e/**` darwin snapshots for the `fretboard-svg` suite

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS (entire suite green).

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b` + `vite build` succeed with no type errors.

- [ ] **Step 4: Refresh darwin visual snapshots**

The guide ring's rendered output changed (single drain, ticks, ramp), so the committed fretboard snapshots will differ intentionally.

Run: `pnpm run test:visual:update`
Expected: updated PNG baselines under the `fretboard-svg` (and any overlay) suites.

- [ ] **Step 5: Re-run the visual suite to confirm green against the new baselines**

Run: `pnpm run test:visual`
Expected: PASS.

- [ ] **Step 6: Review the snapshot diffs by eye**

Open the changed snapshot PNGs (git diff shows them) and confirm: the next chord's guide tones show a single green drain over the whole chord, dark tick notches divide the ring at beat boundaries (≤ 3 interior ticks), and the on-beat flash still fires. No leftover breathing.

- [ ] **Step 7: Commit**

```bash
git add e2e
git commit -m "test(guide-tone): refresh fretboard visual snapshots for countdown ring"
```

---

## Self-Review Notes

**Spec coverage check:**
- Behavior (single drain + ticks, secondary unchanged) → Tasks 4, 5, 7. ✓
- Window `min(step, 2·bar)` + collapsed flag → Tasks 1, 2. ✓
- Ticks (angle from time-fraction, adaptive cap 4, <2-beat suppression, static, derived in atoms) → Tasks 1, 2, 5. ✓
- Intensity ramp (escalate, gentle early) → Task 7 (brightness + loom; stroke-width deviation documented in header). ✓
- Edge cases: reduced-motion → Task 7 Step 5; short step (no ticks) → Task 1 (`< 2 beats → []`); meter → Task 1 (bar/beat collapse); secondary targets → Task 5 (`note.isInRegion` gate). ✓
- Performance (per-frame ≈ one drain; ticks static; loom composited) → Tasks 5, 7. ✓
- Files touched list → matches the File Structure table. ✓
- Testing (window/tick unit tests, visual refresh, reduced-motion) → Tasks 1, 2, 9. ✓

**Type consistency:** `guideCountdownActive` used identically across `EmphasisContext`, `LeadLensContext`, and atoms. `countdownTicks: number[]` flows `guideCountdownTickFractionsAtom` → `EmphasisContext`/FretboardSVG prop → `FretboardNoteLayer` → `FretboardNote`. `TransitionRole` narrows to `"guide-target"` only in Task 8 (after all `"guide-preview"` emitters are gone). CSS var renamed `--lead-in-duration`/`--planning-duration` → `--guide-duration` consistently in Tasks 6 (set) and 7 (consume).
