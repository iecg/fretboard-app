# Chord-root Bubble Size During Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the chord root note bubble from appearing disproportionately large during progression playback by removing the common-tone `radiusBoost` from the emphasis layer.

**Architecture:** During playback, `getEmphasis()` gives common tones a `1.15×` `radiusBoost` that is applied as a CSS `scale()` on the entire note `<g>` (bubble + guide ring + label). Roots are almost always common tones, so they get singled out and — when also a next-chord guide target — the whole decorated cluster balloons. The fix removes that boost so playback size encodes only the existing chord-tier vs scale-tier distinction, then prunes the now-dead `commonWithNext` plumbing.

**Tech Stack:** React 19 + TypeScript, Jotai atoms, Vitest, Playwright visual regression, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-07-chord-root-bubble-size-playback-design.md`

---

## File Structure

| File | Responsibility in this change |
|---|---|
| `src/components/FretboardSVG/utils/semantics.ts` | Remove the common-tone boost in `getEmphasis`; delete the now-orphaned local `CHORD_TONE_CLASSES` set; drop `commonWithNext` from `LeadLensContext` |
| `src/components/FretboardSVG/utils/semantics.test.ts` | Rewrite the two "hold glow" tests to assert no boost; remove `commonWithNext` from fixtures |
| `src/components/FretboardSVG/hooks/useEmphasisContext.ts` | Drop the `commonWithNext` field, its atom read, and the now-unused import |
| `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` | Drop the `commonWithNext` pass-through |
| `src/store/practiceLensAtoms.ts` | Unchanged — `commonTonesWithNextAtom` is kept (tested, reusable) |

**Note on `CHORD_TONE_CLASSES`:** there are two unrelated sets with this name. The one being removed is the module-private set in `semantics.ts:51`, used only by the boost branch. The exported `CHORD_TONE_CLASSES` in `hooks/useChordConnectorPolylines.ts` is unrelated and stays.

---

### Task 1: Rewrite the two "hold glow" tests to assert no size boost (RED)

These tests currently lock in the `1.15×` boost. Rewrite them to assert the desired
post-fix behavior — a held common tone gets no enlargement. At this point the
implementation is unchanged, so they must FAIL. `commonWithNext` is still part of
`LeadLensContext` here, so the test contexts keep it (it is pruned in Task 3).

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.test.ts:436-444` and `:454-461`

- [ ] **Step 1: Rewrite the DURING-lead-in test**

Replace the existing test at `semantics.test.ts:436-444`:

```ts
  it("a held common tone keeps its hold glow DURING the lead-in (no flicker)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A",
      commonWithNext: new Set(["A"]), nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      radiusBoost: 1.15, opacityBoost: 1,
    });
  });
```

with:

```ts
  it("a held common tone is NOT enlarged DURING the lead-in", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A",
      commonWithNext: new Set(["A"]), nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      radiusBoost: 1, opacityBoost: 1,
    });
  });
```

- [ ] **Step 2: Rewrite the OUTSIDE-lead-in test**

Replace the existing test at `semantics.test.ts:454-461`:

```ts
  it("outside the lead-in window, a held common tone keeps a static hold glow (no role)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A", commonWithNext: new Set(["A"]), leadInActive: false,
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      radiusBoost: 1.15, opacityBoost: 1,
    });
  });
```

with:

```ts
  it("outside the lead-in window, a held common tone is NOT enlarged (no role)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A", commonWithNext: new Set(["A"]), leadInActive: false,
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      radiusBoost: 1, opacityBoost: 1,
    });
  });
```

- [ ] **Step 3: Run the two tests to verify they FAIL**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "NOT enlarged"`
Expected: FAIL — both assertions report `radiusBoost: 1.15` received vs `1` expected.

- [ ] **Step 4: Commit the red tests**

```bash
git add src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "test(fretboard): assert held common tones are not enlarged during playback"
```

---

### Task 2: Remove the common-tone boost in getEmphasis (GREEN)

Collapse the `resting` emphasis to the base model and delete the now-unused local
`CHORD_TONE_CLASSES` set and the `commonWithNext` destructure binding (leaving either in
place would trip `@typescript-eslint/no-unused-vars`).

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:47-57` (delete set + doc comment), `:85` (destructure), `:90-93` (resting)

- [ ] **Step 1: Delete the orphaned local `CHORD_TONE_CLASSES` set**

Remove these lines (`semantics.ts:47-57`) in full:

```ts
/**
 * Chord-tone noteClass values — a note with one of these classes is considered
 * a "current chord tone" for the Lead lens hold/departing logic.
 */
const CHORD_TONE_CLASSES = new Set([
  "chord-root",
  "chord-root-outside",
  "chord-tone-in-scale",
  "chord-tone-outside-scale",
  "note-diatonic-chord",
]);
```

- [ ] **Step 2: Drop `commonWithNext` from the destructure**

At `semantics.ts:85`, change:

```ts
  const { notePc, nextGuideTones, nextGuideToneLabels, commonWithNext, leadInActive, planningActive } = leadContext;
```

to:

```ts
  const { notePc, nextGuideTones, nextGuideToneLabels, leadInActive, planningActive } = leadContext;
```

- [ ] **Step 3: Simplify `resting` to the base model**

At `semantics.ts:90-93` (line numbers before Step 1's deletion; locate by content), change:

```ts
  const resting: LensEmphasis =
    CHORD_TONE_CLASSES.has(noteClass) && commonWithNext.has(notePc)
      ? { radiusBoost: 1.15, opacityBoost: 1 }
      : applyTonesBase(noteClass);
```

to:

```ts
  const resting: LensEmphasis = applyTonesBase(noteClass);
```

Leave the surrounding comment block describing `resting` (the "size/shape a note shows
OUTSIDE the lead-in window") in place — trim its mention of the hold glow if present, but
the resting concept still holds.

- [ ] **Step 4: Run the full semantics suite to verify GREEN**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS — all tests, including the two from Task 1, pass.

- [ ] **Step 5: Lint the file to confirm no orphaned symbols**

Run: `pnpm run lint`
Expected: PASS — no `no-unused-vars` on `CHORD_TONE_CLASSES` or `commonWithNext`.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts
git commit -m "fix(fretboard): remove common-tone size boost that enlarged chord roots during playback"
```

---

### Task 3: Prune the now-dead `commonWithNext` plumbing (REFACTOR)

`commonWithNext` is no longer read anywhere. Remove it from the context type, the two
hooks that populate it, and the remaining test fixtures.

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:29-30` (type field)
- Modify: `src/components/FretboardSVG/hooks/useEmphasisContext.ts:3,15,34,42`
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts:45`
- Modify: `src/components/FretboardSVG/utils/semantics.test.ts:382,439,456`

- [ ] **Step 1: Remove the `commonWithNext` field from `LeadLensContext`**

At `semantics.ts:29-30`, delete these two lines:

```ts
  /** Notes shared between the active chord and the next chord (common tones). */
  commonWithNext: Set<string>;
```

- [ ] **Step 2: Remove `commonWithNext` from `useEmphasisContext`**

In `src/components/FretboardSVG/hooks/useEmphasisContext.ts`:

Remove the import line (`:3`) `commonTonesWithNextAtom,` from the import block — final block:

```ts
import {
  nextChordGuideTonesAtom,
  nextChordGuideToneLabelsAtom,
  nextChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
  leadInActiveAtom,
  planningWindowActiveAtom,
} from "../../../store/practiceLensAtoms";
```

Remove the interface field (`:15`) `commonWithNext: Set<string>;` from `EmphasisContext`.

Remove the atom read (`:34`) `const commonWithNext = useAtomValue(commonTonesWithNextAtom);`.

Remove the `commonWithNext,` property (`:42`) from the returned object.

- [ ] **Step 3: Remove the `commonWithNext` pass-through in `useAnimatedFretboardView`**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, delete line `:45`:

```ts
        commonWithNext: emphasisContext.commonWithNext,
```

- [ ] **Step 4: Remove `commonWithNext` from the test fixtures**

In `src/components/FretboardSVG/utils/semantics.test.ts`:

Delete the `commonWithNext: new Set<string>(),` line from `baseLeadContext` (`:382`).

In the two tests rewritten in Task 1, remove the `commonWithNext: new Set(["A"])` entry
from each context object so they no longer reference the removed field. Final form:

```ts
  it("a held common tone is NOT enlarged DURING the lead-in", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A", nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      radiusBoost: 1, opacityBoost: 1,
    });
  });
```

```ts
  it("outside the lead-in window, a held common tone is NOT enlarged (no role)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A", leadInActive: false,
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      radiusBoost: 1, opacityBoost: 1,
    });
  });
```

- [ ] **Step 5: Typecheck, lint, and run the affected tests**

Run: `pnpm run lint`
Expected: PASS — no unused `commonTonesWithNextAtom` import, no dangling references.

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/hooks`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/hooks/useEmphasisContext.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "refactor(fretboard): drop unused commonWithNext emphasis plumbing"
```

---

### Task 4: Full verification + refresh visual snapshots

**Files:**
- Modify (generated): darwin visual snapshots under `e2e/` for fretboard/overlay playback states

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS — full Vitest run green.

- [ ] **Step 2: Build**

Run: `pnpm run build`
Expected: `tsc -b` and `vite build` succeed with no type errors.

- [ ] **Step 3: Refresh darwin visual snapshots**

Run: `pnpm run test:visual:update`
Expected: snapshots for playback/overlay scenes regenerate.

- [ ] **Step 4: Review the snapshot diff before committing**

Run: `git status --short e2e` then inspect the changed `.png` files.
Expected: chord-root bubbles during playback are the same size as sibling chord tones
(no `1.15×` enlargement, no enlarged guide-ring cluster on roots). Confirm nothing else
shifted — non-root, non-playback scenes should be unchanged. If unrelated snapshots
changed, stop and investigate before committing.

- [ ] **Step 5: Commit the refreshed snapshots**

```bash
git add e2e
git commit -m "test(visual): refresh playback snapshots after removing chord-root size boost"
```

---

## Notes for the implementer

- **TDD ordering caveat:** Task 1's tests must keep `commonWithNext` in their context objects to produce a meaningful red, because the boost only triggers when `commonWithNext` contains the note's pitch class. Task 3 removes those keys once the field is deleted from the type. This is why the two tests are touched twice — it is intentional, not redundant.
- **Do not** delete `commonTonesWithNextAtom` or its tests in `src/store/practiceLensAtoms.test.ts`. The atom is retained as a reusable selector (see spec, "Keep `commonTonesWithNextAtom`").
- **Do not** change the root stroke width (`2.4` in `FretboardSVG.module.css:79`) or the guide-ring behavior — both are explicitly out of scope.
