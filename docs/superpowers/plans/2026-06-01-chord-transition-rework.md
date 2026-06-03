# Chord Transition Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the snap-heavy chord-change visuals during progression playback with a smooth, low-noise system that previews the next hand position as a hollow "ghost ring" before the change.

**Architecture:** A per-note *transition role* (held / incoming / departing / static) is derived from the current vs next chord during a *lead-in window*. React state stays coarse (≤2 changes per step, same budget as today's `anticipationActiveAtom`); a CSS ramp driven by a `--lead-in-duration` custom property does the continuous animation. Notes that change are rendered early (incoming as ghost rings, including currently-hidden out-of-scale tones), so the boundary is a class flip with a cheap fill/opacity transition — never a `display` snap.

**Tech Stack:** React 19 + TypeScript, Jotai atoms, CSS Modules, Vitest + Testing Library, Playwright visual regression. Package manager is **pnpm**.

**Reference spec:** `docs/superpowers/specs/2026-06-01-chord-transition-rework-design.md`

---

## File Structure

**Domain / state (pure, unit-tested):**
- `src/store/practiceLensAtoms.ts` (modify) — add `computeLeadInWindowMs`, `isInLeadInWindow`, `activeChordTonesAtom`, `incomingTonesAtom`, `departingTonesAtom`, `leadInActiveAtom`, `leadInDurationMsAtom`.
- `src/store/practiceLensAtoms.test.ts` (modify/create) — tests for the above.

**Emphasis → visuals:**
- `src/components/FretboardSVG/utils/semantics.ts` (modify) — extend `LeadLensContext`, add transition-role logic to `getEmphasis`, expose a `transitionRole` on the emphasis result.
- `src/components/FretboardSVG/utils/semantics.test.ts` (modify/create) — tests for `getEmphasis` transition roles.

**Rendering wiring:**
- `src/components/FretboardSVG/hooks/useEmphasisContext.ts` (modify) — surface the new atoms in `EmphasisContext`.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` (modify) — pass the new context fields into `buildAnimatedFretboardNotes`; add `transitionRole` to `renderedNoteSignature`.
- `src/components/FretboardSVG/hooks/useNoteData.ts` (modify) — extend `NoteData` with `transitionRole`.
- `src/components/FretboardSVG/FretboardNote.tsx` (modify) — always-render the glow/ring underlay, add the ghost ring + `data-transition-role`, drive radius via transform.
- `src/components/FretboardSVG/FretboardNoteLayer.tsx` (no change expected; verify).
- `src/components/FretboardSVG/FretboardSVG.tsx` (modify) — set `--lead-in-duration` and `data-transition-phase` on the board div.

**Styling:**
- `src/styles/semantic.css` (modify) — `--note-incoming` token (dark/base).
- `src/styles/themes.css` (modify) — `--note-incoming` light-theme override.
- `src/components/FretboardSVG/FretboardSVG.module.css` (modify) — ghost-ring styles + ramp keyframes, opacity-not-`display` for transitioning notes, remove the pulse, reduced-motion guard.

**Tests:**
- `src/components/FretboardSVG/FretboardSVG.test.tsx` (modify) — integration + perf-render-count.
- `e2e/fretboard-svg.spec.ts` (modify) — visual snapshots for lead-in + post-boundary.

---

## Conventions for this plan

- Run unit/component tests with: `pnpm exec vitest run <path> -t "<name>"`.
- Notes are stored as sharps internally (`C#`, `D#`). All pitch-class sets in this plan use that convention — `getChordNotes` already sharp-normalizes.
- Commit after every task. Branch is already `claude/crazy-montalcini-cad5eb`.
- Before opening a PR: `pnpm run lint`, `pnpm run test`, `pnpm run build` (mandatory per CLAUDE.md).

---

## Task 1: Lead-in window timing helper (pure)

**Files:**
- Modify: `src/store/practiceLensAtoms.ts`
- Test: `src/store/practiceLensAtoms.test.ts`

The lead-in window length is "proportional with a readable floor": the final
`proportion` of the step, but never shorter than `floorMs`, and never longer
than the step itself.

- [ ] **Step 1: Write the failing test**

Add to `src/store/practiceLensAtoms.test.ts` (create the file with the standard
imports if it does not exist — mirror an existing store test's header):

```typescript
import { describe, it, expect } from "vitest";
import { computeLeadInWindowMs, isInLeadInWindow } from "./practiceLensAtoms";

describe("computeLeadInWindowMs", () => {
  it("returns the proportional window for a long step", () => {
    // 2000ms step, 0.5 proportion → 1000ms, above the 600ms floor.
    expect(computeLeadInWindowMs(2000)).toBe(1000);
  });

  it("clamps up to the readable floor for a short step", () => {
    // 800ms step, 0.5 proportion = 400ms < 600ms floor → 600ms.
    expect(computeLeadInWindowMs(800)).toBe(600);
  });

  it("never exceeds the step duration", () => {
    // 400ms step: floor 600ms would exceed it → clamped to 400ms.
    expect(computeLeadInWindowMs(400)).toBe(400);
  });

  it("returns 0 for a non-positive step", () => {
    expect(computeLeadInWindowMs(0)).toBe(0);
    expect(computeLeadInWindowMs(-100)).toBe(0);
  });
});

describe("isInLeadInWindow", () => {
  it("is true once elapsed fraction crosses the window start", () => {
    // 2000ms step, window 1000ms → starts at fraction 0.5.
    expect(isInLeadInWindow(0.49, 2000)).toBe(false);
    expect(isInLeadInWindow(0.5, 2000)).toBe(true);
    expect(isInLeadInWindow(0.95, 2000)).toBe(true);
  });

  it("is false for a non-positive step", () => {
    expect(isInLeadInWindow(0.9, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "computeLeadInWindowMs"`
Expected: FAIL — `computeLeadInWindowMs is not a function` (not yet exported).

- [ ] **Step 3: Implement the helper**

Add near the existing `isInAnticipationWindow` (around line 103) in
`src/store/practiceLensAtoms.ts`:

```typescript
/** Proportion of the step the lead-in ramp occupies (the final half). */
const LEAD_IN_PROPORTION = 0.5;
/** Minimum readable lead-in duration, so fast tempi still show the preview. */
const LEAD_IN_FLOOR_MS = 600;

/**
 * Length of the lead-in preview window for a step of `stepDurationMs`.
 * Proportional (the final {@link LEAD_IN_PROPORTION} of the step) but clamped
 * up to {@link LEAD_IN_FLOOR_MS} and never longer than the step itself.
 * Pure so it can be unit-tested without atom plumbing.
 */
export function computeLeadInWindowMs(stepDurationMs: number): number {
  if (stepDurationMs <= 0) return 0;
  const proportional = stepDurationMs * LEAD_IN_PROPORTION;
  return Math.min(stepDurationMs, Math.max(proportional, LEAD_IN_FLOOR_MS));
}

/**
 * True when the playhead is inside the lead-in window. `localFraction` is the
 * [0,1] fraction of the step elapsed (same source as the anticipation check).
 */
export function isInLeadInWindow(
  localFraction: number,
  stepDurationMs: number,
): boolean {
  const windowMs = computeLeadInWindowMs(stepDurationMs);
  if (windowMs <= 0) return false;
  const startFraction = 1 - windowMs / stepDurationMs;
  return localFraction >= startFraction;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "computeLeadInWindowMs"`
Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "isInLeadInWindow"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(progression): add lead-in window timing helpers"
```

---

## Task 2: Transition delta atoms (incoming / departing / active chord tones)

**Files:**
- Modify: `src/store/practiceLensAtoms.ts`
- Test: `src/store/practiceLensAtoms.test.ts`

`commonTonesWithNextAtom` (line 368) already computes the active chord's tones
inline. Extract them into `activeChordTonesAtom`, then derive the deltas.

- [ ] **Step 1: Write the failing test**

Add to `src/store/practiceLensAtoms.test.ts`. Use the project's existing
store-test harness for setting progression state — search the file (or a sibling
store test) for how `resolvedProgressionStepsAtom` / `displayedProgressionStepIndexAtom`
are seeded with `createStore()` and reuse that exact pattern. The assertion
content:

```typescript
import { createStore } from "jotai";
import {
  activeChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
} from "./practiceLensAtoms";
// + the progression-seeding atoms used elsewhere in this file.

describe("transition delta atoms", () => {
  it("incoming = next − current, departing = current − next", () => {
    const store = createStore();
    // Seed a two-step progression: C major → G major, active = step 0.
    // (Use the same seeding helper the rest of this test file uses.)
    seedProgression(store, ["C", "G"], 0); // C = {C,E,G}, G = {G,B,D}

    const current = store.get(activeChordTonesAtom);
    const incoming = store.get(incomingTonesAtom);
    const departing = store.get(departingTonesAtom);

    expect([...current].sort()).toEqual(["C", "E", "G"]);
    // incoming: in G but not C → B, D
    expect([...incoming].sort()).toEqual(["B", "D"]);
    // departing: in C but not G → C, E
    expect([...departing].sort()).toEqual(["C", "E"]);
  });

  it("returns empty deltas when there is no next chord", () => {
    const store = createStore();
    seedProgression(store, ["C"], 0); // single step, no loop → no next
    expect(store.get(incomingTonesAtom).size).toBe(0);
    expect(store.get(departingTonesAtom).size).toBe(0);
  });
});
```

> Note: `seedProgression` stands in for whatever helper this test file already
> uses. If none exists, set the atoms directly: `store.set(...)` the
> progression-steps source atom and `store.set(displayedProgressionStepIndexAtom, 0)`.
> Inspect `nextChordTonesAtom`'s dependencies (`resolvedProgressionStepsAtom`,
> `displayedProgressionStepIndexAtom`, `progressionLoopEnabledAtom`) for the
> exact atoms to seed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "transition delta atoms"`
Expected: FAIL — atoms not exported.

- [ ] **Step 3: Implement the atoms**

In `src/store/practiceLensAtoms.ts`, add `activeChordTonesAtom` and refactor
`commonTonesWithNextAtom` to reuse it, then add the deltas. Place after
`commonTonesWithNextAtom` (line 376):

```typescript
/**
 * Pitch-class set of the active progression chord. Reads the active step via
 * `activeResolvedProgressionStepAtom` so the index is clamped to the current
 * progression length. Sharps convention. Empty when unresolvable.
 */
export const activeChordTonesAtom = atom((get): Set<string> => {
  const activeStep = get(activeResolvedProgressionStepAtom);
  if (
    !activeStep ||
    activeStep.unavailable ||
    activeStep.root === null ||
    activeStep.quality === null
  ) {
    return new Set();
  }
  return new Set(getChordNotes(activeStep.root, activeStep.quality));
});

/**
 * Pitch classes the next chord introduces that the active chord lacks
 * (`next − current`). These are the positions previewed as incoming ghosts.
 */
export const incomingTonesAtom = atom((get): Set<string> => {
  const current = get(activeChordTonesAtom);
  const next = get(nextChordTonesAtom);
  return new Set([...next].filter((n) => !current.has(n)));
});

/**
 * Pitch classes the active chord drops on the change (`current − next`).
 */
export const departingTonesAtom = atom((get): Set<string> => {
  const current = get(activeChordTonesAtom);
  const next = get(nextChordTonesAtom);
  // When there is no next chord, nothing is "departing" — keep notes calm.
  if (next.size === 0) return new Set();
  return new Set([...current].filter((n) => !next.has(n)));
});
```

Then simplify `commonTonesWithNextAtom` to reuse `activeChordTonesAtom`
(keeps behavior identical, removes the duplicated inline `getChordNotes`):

```typescript
export const commonTonesWithNextAtom = atom((get): Set<string> => {
  const activeTones = get(activeChordTonesAtom);
  const next = get(nextChordTonesAtom);
  return new Set([...activeTones].filter((n) => next.has(n)));
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "transition delta atoms"`
Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts` (whole file — confirm the `commonTonesWithNextAtom` refactor broke nothing)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(progression): add incoming/departing chord-tone delta atoms"
```

---

## Task 3: Lead-in activity + duration atoms

**Files:**
- Modify: `src/store/practiceLensAtoms.ts`
- Test: `src/store/practiceLensAtoms.test.ts`

These mirror `anticipationActiveAtom` (line 436) but use the wider lead-in
window. They keep React updates coarse: the value only flips at the window
threshold, not per frame. `progressionStepDurationMsAtom` already exists in
`progressionAtoms` (imported in this module — verify the import; add it if not).

- [ ] **Step 1: Write the failing test**

```typescript
import {
  leadInActiveAtom,
  leadInDurationMsAtom,
} from "./practiceLensAtoms";
import { progressionPlayingAtom } from "./progressionAtoms";
import { progressionVisualFrameAtom } from "./progressionVisualAtoms";

describe("leadInActiveAtom", () => {
  it("is false when not playing", () => {
    const store = createStore();
    store.set(progressionPlayingAtom, false);
    expect(store.get(leadInActiveAtom)).toBe(false);
  });

  it("is true only once the playhead enters the lead-in window", () => {
    const store = createStore();
    store.set(progressionPlayingAtom, true);
    seedProgression(store, ["C", "G"], 0); // gives a resolvable step duration
    // Drive the visual frame fraction below then above the window start.
    store.set(progressionVisualFrameAtom, { localFraction: 0.1, paused: false });
    expect(store.get(leadInActiveAtom)).toBe(false);
    store.set(progressionVisualFrameAtom, { localFraction: 0.9, paused: false });
    expect(store.get(leadInActiveAtom)).toBe(true);
  });

  it("is false while paused", () => {
    const store = createStore();
    store.set(progressionPlayingAtom, true);
    seedProgression(store, ["C", "G"], 0);
    store.set(progressionVisualFrameAtom, { localFraction: 0.9, paused: true });
    expect(store.get(leadInActiveAtom)).toBe(false);
  });
});

describe("leadInDurationMsAtom", () => {
  it("matches computeLeadInWindowMs of the active step duration", () => {
    const store = createStore();
    seedProgression(store, ["C", "G"], 0);
    const stepMs = store.get(progressionStepDurationMsAtom);
    expect(store.get(leadInDurationMsAtom)).toBe(computeLeadInWindowMs(stepMs));
  });
});
```

> The exact `localFraction` thresholds depend on the seeded step duration; pick
> fractions clearly inside/outside the window (0.1 and 0.9 are safe for any
> window ≤ 90% of the step). If a seeded step is short enough that the floor
> makes the window ≈ the whole step, 0.1 may already be inside — in that case use
> 0.01. Adjust to the concrete seeded duration.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "leadInActiveAtom"`
Expected: FAIL — atoms not exported.

- [ ] **Step 3: Implement the atoms**

Confirm `progressionStepDurationMsAtom` is imported from `./progressionAtoms` at
the top of `practiceLensAtoms.ts`; add it to the import if missing. Then add
after `anticipationActiveAtom` (line 441):

```typescript
/**
 * Length of the active step's lead-in preview window, in milliseconds. Written
 * to the `--lead-in-duration` CSS custom property so the ghost ramp animation
 * lasts exactly the window. Changes only when the active step / tempo changes.
 */
export const leadInDurationMsAtom = atom((get): number =>
  computeLeadInWindowMs(get(progressionStepDurationMsAtom)),
);

/**
 * Discrete lead-in phase. Like `anticipationActiveAtom` it reads the per-frame
 * visual frame, but its VALUE only flips at the window threshold, so Jotai
 * subscribers re-render at most twice per step — never per animation frame.
 */
export const leadInActiveAtom = atom((get): boolean => {
  if (!get(progressionPlayingAtom)) return false;
  const frame = get(progressionVisualFrameAtom);
  if (!frame || frame.paused) return false;
  return isInLeadInWindow(
    frame.localFraction,
    get(progressionStepDurationMsAtom),
  );
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "leadInActiveAtom"`
Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "leadInDurationMsAtom"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(progression): add lead-in active + duration atoms"
```

---

## Task 4: Transition roles in `getEmphasis`

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts`
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

Extend `LeadLensContext` and `LensEmphasis` so emphasis carries a discrete
`transitionRole`. The new logic runs only during the lead-in window and is the
single source of truth for held/incoming/departing/static treatment. This
replaces the old binary `anticipationActive` glow path.

- [ ] **Step 1: Write the failing test**

Create/extend `src/components/FretboardSVG/utils/semantics.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getEmphasis, type LeadLensContext } from "./semantics";

const ctx = (over: Partial<LeadLensContext>): LeadLensContext => ({
  notePc: "C",
  commonWithNext: new Set(),
  nextGuideTones: new Set(),
  nextChordTones: new Set(),
  incomingTones: new Set(),
  departingTones: new Set(),
  leadInActive: true,
  ...over,
});

describe("getEmphasis transition roles", () => {
  it("marks an incoming pitch class as 'incoming'", () => {
    const e = getEmphasis("note-inactive", false, ctx({
      notePc: "B",
      incomingTones: new Set(["B"]),
    }));
    expect(e.transitionRole).toBe("incoming");
  });

  it("marks a departing current chord-tone as 'departing'", () => {
    const e = getEmphasis("chord-tone-in-scale", false, ctx({
      notePc: "C",
      departingTones: new Set(["C"]),
    }));
    expect(e.transitionRole).toBe("departing");
    expect(e.opacityBoost).toBeLessThan(1); // dimmed
  });

  it("marks a held common tone as 'held' with no pulse glow", () => {
    const e = getEmphasis("chord-tone-in-scale", false, ctx({
      notePc: "G",
      commonWithNext: new Set(["G"]),
    }));
    expect(e.transitionRole).toBe("held");
  });

  it("returns 'static' (no transition role) outside the lead-in window", () => {
    const e = getEmphasis("chord-tone-in-scale", false, ctx({
      notePc: "G",
      commonWithNext: new Set(["G"]),
      leadInActive: false,
    }));
    expect(e.transitionRole).toBeUndefined();
  });

  it("falls back to tones-base when no lead context is given", () => {
    const e = getEmphasis("scale-only", false, undefined);
    expect(e.transitionRole).toBeUndefined();
    expect(e.opacityBoost).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "transition roles"`
Expected: FAIL — `incomingTones` not on the type / `transitionRole` undefined logic missing.

- [ ] **Step 3: Implement**

In `src/components/FretboardSVG/utils/semantics.ts`:

Extend the types:

```typescript
export type TransitionRole = "held" | "incoming" | "departing";

export type LensEmphasis = {
  glowColor?: `var(--${string})`;
  radiusBoost: number;
  opacityBoost: number;
  /** Discrete voice-leading role during the lead-in window; undefined = static. */
  transitionRole?: TransitionRole;
};

export type LeadLensContext = {
  notePc: string;
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
  nextChordTones: Set<string>;
  /** Pitch classes the next chord introduces (`next − current`). */
  incomingTones: Set<string>;
  /** Pitch classes the active chord drops on the change (`current − next`). */
  departingTones: Set<string>;
  /** True only during the lead-in preview window. */
  leadInActive: boolean;
};
```

Replace the body of `getEmphasis` (lines 67–111) with the transition-role
model. Held/incoming/departing only apply while `leadInActive`; otherwise the
function returns the calm static treatment:

```typescript
export function getEmphasis(
  noteClass: string,
  isGuideTone: boolean,
  leadContext?: LeadLensContext,
): LensEmphasis {
  if (!leadContext) {
    return applyTonesBase(noteClass, isGuideTone);
  }

  const {
    notePc,
    commonWithNext,
    incomingTones,
    departingTones,
    leadInActive,
  } = leadContext;

  const isCurrentChordTone = CHORD_TONE_CLASSES.has(noteClass);

  if (leadInActive) {
    // 1. Incoming: a pitch the next chord introduces. Ghost-ring preview.
    //    Applies even to notes not currently a chord tone (incl. hidden
    //    out-of-scale tones — un-hidden in Task 5).
    if (incomingTones.has(notePc)) {
      return {
        glowColor: "var(--note-incoming)",
        radiusBoost: 1,
        opacityBoost: 1,
        transitionRole: "incoming",
      };
    }

    // 2. Departing: a current chord tone the next chord drops. Calm dim.
    if (isCurrentChordTone && departingTones.has(notePc)) {
      return { radiusBoost: 0.95, opacityBoost: 0.8, transitionRole: "departing" };
    }

    // 3. Held: a current chord tone that carries through. Steady, no pulse.
    if (isCurrentChordTone && commonWithNext.has(notePc)) {
      return {
        glowColor: "var(--note-glow-hold)",
        radiusBoost: 1.15,
        opacityBoost: 1,
        transitionRole: "held",
      };
    }
  }

  // 4. Static: held chord tones outside the window keep a gentle hold glow;
  //    everything else uses the tones-base treatment.
  if (isCurrentChordTone && commonWithNext.has(notePc)) {
    return { glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 };
  }
  return applyTonesBase(noteClass, isGuideTone);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS. (If existing tests referenced the old `anticipationActive`
field on `LeadLensContext`, update them to the new fields — they are now
`incomingTones` / `departingTones` / `leadInActive`.)

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "feat(fretboard): transition-role emphasis model for chord changes"
```

---

## Task 5: Surface transition context + un-hide incoming ghosts

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useEmphasisContext.ts`
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Modify: `src/components/FretboardSVG/hooks/useNoteData.ts`
- Test: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` (create if absent)

Wire the new atoms through `EmphasisContext` into `buildAnimatedFretboardNotes`,
expose `transitionRole` on `NoteData`, and add it to the render signature.

- [ ] **Step 1: Update `EmphasisContext`**

In `src/components/FretboardSVG/hooks/useEmphasisContext.ts`, replace the
`anticipationActive` field with the new context and import the new atoms:

```typescript
import { useAtomValue } from "jotai";
import {
  commonTonesWithNextAtom,
  nextChordGuideTonesAtom,
  nextChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
  leadInActiveAtom,
} from "../../../store/practiceLensAtoms";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";

export interface EmphasisContext {
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
  nextChordTones: Set<string>;
  incomingTones: Set<string>;
  departingTones: Set<string>;
  leadInActive: boolean;
}

export function useEmphasisContext(enabled: boolean): EmphasisContext | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const leadInActive = useAtomValue(leadInActiveAtom);
  const commonWithNext = useAtomValue(commonTonesWithNextAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);
  const nextChordTones = useAtomValue(nextChordTonesAtom);
  const incomingTones = useAtomValue(incomingTonesAtom);
  const departingTones = useAtomValue(departingTonesAtom);
  if (!enabled || !playing) return null;
  return {
    commonWithNext,
    nextGuideTones,
    nextChordTones,
    incomingTones,
    departingTones,
    leadInActive,
  };
}
```

- [ ] **Step 2: Update `buildAnimatedFretboardNotes`**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, pass the new
fields into the per-note `LeadLensContext` and surface `transitionRole`:

```typescript
if (hasChordOverlay && emphasisContext) {
  leadContext = {
    notePc: note.noteName,
    commonWithNext: emphasisContext.commonWithNext,
    nextGuideTones: emphasisContext.nextGuideTones,
    nextChordTones: emphasisContext.nextChordTones,
    incomingTones: emphasisContext.incomingTones,
    departingTones: emphasisContext.departingTones,
    leadInActive: emphasisContext.leadInActive,
  };
}

const applyLensEmphasis = getEmphasis(note.noteClass, note.isGuideTone, leadContext);
return {
  ...note,
  applyLensEmphasis,
  transitionRole: applyLensEmphasis.transitionRole,
};
```

Add `transitionRole` to `renderedNoteSignature` (after `emph.glowColor` near
line 114) so a note whose only change is its transition role re-renders:

```typescript
    emph.glowColor ?? "",
    emph.transitionRole ?? "",
```

- [ ] **Step 3: Extend `NoteData`**

In `src/components/FretboardSVG/hooks/useNoteData.ts`, add to the `NoteData`
interface (after `applyLensEmphasis`):

```typescript
  /** Discrete voice-leading role during the lead-in window (Task 4). */
  transitionRole?: import("../utils/semantics").TransitionRole;
```

And in `buildStaticFretboardTopology.ts`, where notes are pushed (line 307),
default it so static topology notes carry the field:

```typescript
        applyLensEmphasis: DEFAULT_LENS_EMPHASIS,
        transitionRole: undefined,
```

- [ ] **Step 4: Un-hide incoming ghosts in topology**

The incoming preview must render currently-hidden out-of-scale tones as ghosts,
gated to the active region. In `buildStaticFretboardTopology.ts`, the
`note-inactive` class drives `isHidden` (line 284). We do NOT change `isHidden`
here (topology has no per-frame chord context); instead the un-hiding happens in
CSS in Task 7 keyed off the `data-transition-role="incoming"` attribute set in
Task 6, combined with the existing in-region signal.

To make in-region gating available to that CSS, ensure the rendered `<g>`
carries the region flag. Confirm `isInActiveShape` / `isInsideAnyPolygon` are
already on the topology note (they are — lines 325–327). In Task 6 we surface
`isInsideAnyPolygon` as a data attribute. **No code change in this step** beyond
verifying those fields survive into `RenderedFretboardNote`; if they are not on
`NoteData`, add `isInRegion: boolean` to `NoteData` set from
`isInsideAnyPolygon || !shapePolygons.length` and to `renderedNoteSignature`.

- [ ] **Step 5: Write the test**

Create `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildAnimatedFretboardNotes } from "./useAnimatedFretboardView";

describe("buildAnimatedFretboardNotes transitionRole", () => {
  it("tags an incoming pitch class with transitionRole 'incoming'", () => {
    const topology = [{
      stringIndex: 0, fretIndex: 0, noteName: "B", octave: 4,
      noteClass: "note-inactive", displayName: "B", displayValue: "B",
      applyDimOpacity: false, applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
      isHidden: true, isTension: false, isGuideTone: false,
    }] as never;
    const result = buildAnimatedFretboardNotes({
      topology,
      hasChordOverlay: true,
      emphasisContext: {
        commonWithNext: new Set(), nextGuideTones: new Set(),
        nextChordTones: new Set(["B"]), incomingTones: new Set(["B"]),
        departingTones: new Set(), leadInActive: true,
      },
    });
    expect(result[0].transitionRole).toBe("incoming");
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useEmphasisContext` (if a test exists)
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/FretboardSVG/hooks/ src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts
git commit -m "feat(fretboard): thread transition context into note build"
```

---

## Task 6: Render the ghost ring + always-on underlay + transform radius

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx` (create if absent)

Three rendering changes: (a) always render the glow underlay so it fades instead
of mounting/unmounting; (b) emit `data-transition-role` + the region flag for CSS
to target; (c) keep radius on the transform path.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNote } from "./FretboardNote";

const baseNote = {
  stringIndex: 0, fretIndex: 3, noteName: "B", cx: 10, cy: 10, octave: 4,
  noteClass: "note-inactive", displayName: "B", displayValue: "B",
  applyDimOpacity: false, isHidden: true, isTension: false, isGuideTone: false,
};

describe("FretboardNote transition rendering", () => {
  it("emits data-transition-role for an incoming ghost", () => {
    const note = {
      ...baseNote,
      applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, glowColor: "var(--note-incoming)", transitionRole: "incoming" },
      transitionRole: "incoming",
    } as never;
    const { container } = render(
      <svg><FretboardNote note={note} noteBubblePx={20} displayFormat="notes" /></svg>,
    );
    const g = container.querySelector("g");
    expect(g?.getAttribute("data-transition-role")).toBe("incoming");
  });

  it("always renders the glow underlay even with no glow color", () => {
    const note = {
      ...baseNote,
      noteClass: "scale-only",
      isHidden: false,
      applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
      transitionRole: undefined,
    } as never;
    const { container } = render(
      <svg><FretboardNote note={note} noteBubblePx={20} displayFormat="notes" /></svg>,
    );
    expect(container.querySelector("circle.note-glow-underlay")).not.toBeNull();
  });
});
```

> Use the actual CSS-module class name lookup the project uses in other
> `FretboardNote`/`FretboardSVG` tests (CSS-module classes are hashed) — match the
> existing pattern (e.g. querying by `[class*="note-glow-underlay"]`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: FAIL — underlay missing when no glow; no `data-transition-role`.

- [ ] **Step 3: Implement**

In `src/components/FretboardSVG/FretboardNote.tsx`:

Destructure `transitionRole` from `note` (alongside the existing fields, line 59):

```typescript
    fullChordShape,
    transitionRole,
```

Add the data attribute to the `<g>` (next to `data-lens-emphasis`, line 184):

```typescript
      data-transition-role={transitionRole ?? undefined}
```

Replace the conditional underlay (lines 200–209) with an always-rendered
underlay whose visibility is CSS-driven. When there is no glow color it stays at
opacity 0 (set in CSS), so transitions in/out instead of mounting/unmounting:

```typescript
      <circle
        className={styles["note-glow-underlay"]}
        cx={cx}
        cy={cy}
        r={r}
        style={applyLensEmphasis.glowColor ? { fill: applyLensEmphasis.glowColor } : undefined}
        data-glow={applyLensEmphasis.glowColor ? "on" : "off"}
        aria-hidden="true"
      />
```

The radius is already applied via the `--emph-scale` transform on the `<g>`
(lines 188–192) — no change needed; just confirm no code path sets the base `r`
attribute from `radiusBoost` (it does not).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNote.test.tsx
git commit -m "feat(fretboard): always-render underlay + ghost-ring data attr"
```

---

## Task 7: CSS — incoming token, ghost ring, ramp, un-hide, remove pulse, reduced motion

**Files:**
- Modify: `src/styles/semantic.css`
- Modify: `src/styles/themes.css`
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

- [ ] **Step 1: Add the `--note-incoming` token**

In `src/styles/semantic.css`, next to the existing glow tokens (lines 146–147):

```css
  --note-incoming: #34d399;  /* green-teal "go here next" — distinct from cyan hold, orange tension, violet color */
```

In `src/styles/themes.css`, next to the light-theme glow overrides (lines 216–217):

```css
  --note-incoming: #0f9d72;  /* deeper green-teal for light wood contrast */
```

- [ ] **Step 2: Glow underlay default + ghost ring + ramp**

In `src/components/FretboardSVG/FretboardSVG.module.css`, change the underlay
base rule (lines 395–407) so an underlay with no glow is invisible and fades:

```css
.fretboard-note circle.note-glow-underlay {
  pointer-events: none;
  stroke: none !important;
  opacity: 0;                 /* default invisible; raised by glow/transition rules */
  transform-box: fill-box;
  transform-origin: center;
  filter: blur(3px);
  transition: opacity var(--lead-in-duration, 0.3s) ease, fill 0.15s ease;
}

.fretboard-note circle.note-glow-underlay[data-glow="on"] {
  opacity: 0.55;
}
```

Replace the anticipation-pulse block (lines 409–421) with the incoming ghost
ramp. The incoming note's underlay reads as a hollow ring that ramps up over the
lead-in window, plus an actual ring stroke:

```css
/* Incoming preview — a hollow ghost ring in the dedicated incoming hue that
   ramps in over the lead-in window, then promotes to solid at the boundary. */
.fretboard-note[data-transition-role="incoming"] .note-glow-underlay {
  fill: var(--note-incoming);
  animation: note-incoming-ramp var(--lead-in-duration, 0.6s) ease-out both;
}

.fretboard-note[data-transition-role="incoming"] :is(circle, path, polygon) {
  stroke: var(--note-incoming);
  stroke-dasharray: 4 3;
  fill: transparent;
}

@keyframes note-incoming-ramp {
  from { opacity: 0;   transform: scale(0.8); }
  to   { opacity: 0.7; transform: scale(1); }
}
```

- [ ] **Step 3: Un-hide in-region incoming ghosts**

Incoming positions that are `note-inactive` (out-of-scale next-chord tones) are
`display:none` via `.hidden`. Override that only while they are an incoming
ghost AND in the active region. The board carries `data-transition-phase="lead-in"`
(Task 8). Replace the `.hidden` rule (lines 30–32) and add the override:

```css
.fretboard-note:global(.hidden) {
  display: none;
}

/* During the lead-in, an in-region incoming ghost is shown (as a ring) even if
   it is otherwise a hidden out-of-scale position. */
.fretboard-board[data-transition-phase="lead-in"]
  .fretboard-note:global(.hidden)[data-transition-role="incoming"][data-in-region="true"] {
  display: initial;
}
```

> This requires `data-in-region` on the note `<g>`. Add it in `FretboardNote.tsx`
> from the region flag surfaced in Task 5 Step 4:
> `data-in-region={note.isInRegion ? "true" : undefined}`. If you did not add
> `isInRegion` in Task 5, add it now (NoteData + signature + this attribute).

- [ ] **Step 4: Departing + held treatments**

Add after the incoming rules:

```css
/* Departing — calm dim; opacity already reduced inline via opacityBoost. */
.fretboard-note[data-transition-role="departing"] :is(circle, path, polygon) {
  filter: saturate(0.7);
  transition: opacity 0.15s ease, filter 0.15s ease;
}

/* Held — steady hold glow, no pulse (the pulse keyframe is removed). */
.fretboard-note[data-transition-role="held"] .note-glow-underlay[data-glow="on"] {
  opacity: 0.5;
}
```

- [ ] **Step 5: Reduced motion**

Replace the old reduced-motion guard (lines 419–421):

```css
@media (prefers-reduced-motion: reduce) {
  .fretboard-note[data-transition-role="incoming"] .note-glow-underlay {
    animation: none;
    opacity: 0.6;          /* static ghost — information preserved, motion removed */
  }
  .fretboard-note circle.note-glow-underlay {
    transition: none;
  }
}
```

- [ ] **Step 6: Verify the build compiles the CSS**

Run: `pnpm run lint` (includes stylelint)
Expected: PASS (no stylelint errors). Fix any reported ordering/specificity
issues per the existing file conventions.

- [ ] **Step 7: Commit**

```bash
git add src/styles/semantic.css src/styles/themes.css src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "style(fretboard): incoming ghost-ring tokens, ramp, reduced motion"
```

---

## Task 8: Wire `--lead-in-duration` + `data-transition-phase` on the board

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/FretboardSVG/FretboardSVG.test.tsx` (reuse the file's
existing render helper / atom-seeding harness):

```typescript
it("exposes --lead-in-duration and data-transition-phase during lead-in", () => {
  // Render with a playing progression whose visual frame is inside the lead-in
  // window (seed leadInActiveAtom true via the same harness used elsewhere).
  const { container } = renderFretboardInLeadIn();
  const board = container.querySelector('[data-testid="fretboard-svg"]') as HTMLElement;
  expect(board.style.getPropertyValue("--lead-in-duration")).not.toBe("");
  expect(board.getAttribute("data-transition-phase")).toBe("lead-in");
});
```

> `renderFretboardInLeadIn` stands for the existing harness with
> `progressionPlayingAtom=true` and `progressionVisualFrameAtom` set to a
> fraction inside the window. Follow how the file already seeds playback state.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "lead-in"`
Expected: FAIL — attribute/var absent.

- [ ] **Step 3: Implement**

In `src/components/FretboardSVG/FretboardSVG.tsx`, read the new atoms near the
existing `bpm` read (line 328):

```typescript
import { leadInActiveAtom, leadInDurationMsAtom } from "../../store/practiceLensAtoms";
// ...
const leadInActive = useAtomValue(leadInActiveAtom);
const leadInDurationMs = useAtomValue(leadInDurationMsAtom);
```

Add the attribute + var to the board div (lines 614–622):

```tsx
    <div
      role="group"
      aria-label={ariaLabel}
      className={styles["fretboard-board"]}
      data-degree-colors={degreeColorsEnabled ? "true" : undefined}
      data-full-chord-mode={fullChordVoicings?.length ? "true" : undefined}
      data-transition-phase={leadInActive ? "lead-in" : undefined}
      data-testid="fretboard-svg"
      style={{
        "--beat-duration": `${beatDurationSec}s`,
        "--lead-in-duration": `${leadInDurationMs}ms`,
      } as CSSProperties}
    >
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "lead-in"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "feat(fretboard): wire lead-in duration var and phase attribute"
```

---

## Task 9: Integration + performance-budget tests

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.test.tsx`

Prove the two user-facing wins and the perf guardrail.

- [ ] **Step 1: Write the integration test — incoming ghost incl. hidden tension**

```typescript
it("shows an in-region incoming ghost for an out-of-scale next-chord tone", () => {
  // Seed: scale that excludes the next chord's tension note; progression where
  // the next chord introduces that tension PC; visual frame inside lead-in.
  const { container } = renderFretboardInLeadIn(/* with tension-introducing next chord */);
  const ghost = container.querySelector('[data-transition-role="incoming"][data-in-region="true"]');
  expect(ghost).not.toBeNull();
  // It is shown despite being a .hidden (note-inactive) position.
  expect(ghost?.classList.contains("hidden")).toBe(true); // class present…
  // …but CSS un-hides it (computed style check is e2e; here assert the attr contract).
});
```

- [ ] **Step 2: Write the perf test — ≤2 note-layer renders per step**

```typescript
it("does not re-render the note layer on every animation frame", () => {
  // Spy/count renders of FretboardNoteLayer (wrap with a render counter, or
  // assert getEmphasis-context identity is stable across frame-only updates).
  // Drive progressionVisualFrameAtom across several localFraction values WITHIN
  // the same window phase (e.g. 0.1 → 0.2 → 0.3, all pre-lead-in) and assert the
  // emphasis context reference / render count does not change.
  const renders = countNoteLayerRenders(() => {
    setFrame(0.1); setFrame(0.2); setFrame(0.3); // same phase
  });
  expect(renders).toBeLessThanOrEqual(1);
});
```

> Follow the file's existing approach for counting renders if one exists;
> otherwise wrap `FretboardNoteLayer` via a test-only counter component, or
> assert `useEmphasisContext` returns a referentially-stable object across
> same-phase frame updates (the atoms it reads do not change value within a
> phase). The contract under test: **frame-only updates that stay in one phase
> produce no note-layer re-render.**

- [ ] **Step 3: Run the tests**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS.

- [ ] **Step 4: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS. Fix any tests that referenced the removed `anticipationActiveAtom`
emphasis path or the old `LeadLensContext.anticipationActive` field — migrate
them to the new atoms/fields.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "test(fretboard): integration + per-step render-budget for transitions"
```

---

## Task 10: Visual regression + final gates

**Files:**
- Modify: `e2e/fretboard-svg.spec.ts` (or the closest existing playback visual spec)

- [ ] **Step 1: Add visual snapshot states**

Add a playback scenario that pauses the visual frame at two points — mid-lead-in
(ghost rings visible) and just after a boundary (promoted) — and snapshots the
fretboard SVG. Follow the existing `fretboard-svg` spec's structure for driving
playback deterministically (seed a fixed tempo/progression, set the frame).

```typescript
test("chord transition — mid-lead-in ghosts", async ({ page }) => {
  await gotoFretboardWithProgression(page, { /* fixed C→G, tempo */ });
  await setVisualFrame(page, 0.85); // inside lead-in
  await expect(page.getByTestId("fretboard-svg")).toHaveScreenshot("transition-lead-in.png");
});

test("chord transition — post-boundary promoted", async ({ page }) => {
  await gotoFretboardWithProgression(page, { /* same */ });
  await advanceToNextStep(page);
  await setVisualFrame(page, 0.1); // settled into the new chord
  await expect(page.getByTestId("fretboard-svg")).toHaveScreenshot("transition-promoted.png");
});
```

> Use the helpers the existing visual specs already provide for navigating and
> seeding state. If none exist for setting the visual frame, drive it via the UI
> play controls and `page.waitForTimeout` tied to the known step duration.

- [ ] **Step 2: Generate the darwin snapshots**

Run: `pnpm run test:visual:update`
Expected: New `transition-lead-in` / `transition-promoted` darwin snapshots
created. Inspect them visually: ghost rings present in incoming positions, held
notes calm, departing notes dimmed, no orange-on-orange.

- [ ] **Step 3: Generate the linux snapshots**

Run: `pnpm run test:visual:update:linux`
Expected: Matching linux snapshots committed (cross-platform CI parity).

- [ ] **Step 4: Run the visual suite to confirm stability**

Run: `pnpm run test:visual`
Expected: PASS against the freshly-generated baselines.

- [ ] **Step 5: Final mandatory gates**

Run: `pnpm run lint`
Run: `pnpm run test`
Run: `pnpm run build`
Expected: all PASS (mandatory before PR per CLAUDE.md).

- [ ] **Step 6: Commit**

```bash
git add e2e/ src/components/FretboardSVG/__snapshots__ e2e/**/*-snapshots/**
git commit -m "test(fretboard): visual regression baselines for chord transitions"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- Preview-is-pop-fix, transition roles → Tasks 4, 6, 7.
- Incoming tension-note preview (un-hide, in-region) → Tasks 5, 7.
- Coarse state + CSS ramp (≤2 renders/step) → Tasks 1, 3, 8, 9 (perf test).
- "Only what changes" (held/static calm) → Task 4 logic + Task 7 held/departing.
- Proportional + readable floor timing → Task 1, 3, 8.
- Hollow ghost ring, own hue → Task 6, 7.
- `--note-incoming` token distinct from orange/cyan/violet → Task 7.
- Remove pulse → Task 7 Step 2.
- Always-on, no UI → no toggle task; behavior gated only by playback.
- Reduced motion static ghosts → Task 7 Step 5.
- a11y unaffected (decorative layer) → unchanged hit-test layer; verified in Task 6.
- Testing (unit/component/perf/visual) → Tasks 1–10.

**Open items the executor must resolve against live code (flagged inline):**
- The exact store-test seeding helper names (`seedProgression`, `renderFretboardInLeadIn`, render counter) — use the harness already present in each test file.
- Whether to add `isInRegion` to `NoteData` (Task 5 Step 4 / Task 7 Step 3) — add it if `isInsideAnyPolygon` is not already surfaced to the rendered note.

**Type consistency:** `TransitionRole`, `incomingTones`, `departingTones`,
`leadInActive`, `transitionRole`, `--note-incoming`, `--lead-in-duration`,
`data-transition-role`, `data-transition-phase`, `data-in-region` are used
identically across Tasks 4–9.
