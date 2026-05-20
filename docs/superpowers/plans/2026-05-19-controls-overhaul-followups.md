# Controls Overhaul Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two follow-ups identified during the Controls Overhaul ([PR #419](https://github.com/iecg/fretboard-app/pull/419)) review: make the Scope-to-position toggle constrain voicing-engine output for 3NPS positions (it already constrains chord-tone dots), and drop the misleading `"__inactive__" as "none"` casts from `FingeringPatternControls` by widening `ToggleBar.value` to `Value | undefined`.

**Architecture:** Two independent edits in one PR.
1. `src/components/ToggleBar/ToggleBar.tsx` — widen `value` prop to `Value | undefined`. Backward-compatible.
2. `src/hooks/useFretboardState.ts` — add a parallel `selectFullChordMatchesForThreeNpsPosition` that mirrors the CAGED scorer using per-string `boxBounds` instead of polygon vertices. Extend the existing `visibleFullChordMatches` memo with a 3NPS branch.

**Tech Stack:** React 19 + TypeScript, Jotai, Vitest + Testing Library, Playwright. Commands: `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b`, `pnpm run test:visual`.

---

## File Structure

**Modified:**
- `src/components/ToggleBar/ToggleBar.tsx` — widen prop type.
- `src/components/ToggleBar/ToggleBar.test.tsx` — new `value={undefined}` case.
- `src/components/FingeringPatternControls/FingeringPatternControls.tsx` — drop the two `"__inactive__"` casts and their explanatory comments; pass `undefined` instead.
- `src/hooks/useFretboardState.ts` — add `scoreFullChordForThreeNpsPosition` + `selectFullChordMatchesForThreeNpsPosition` private helpers; extend `visibleFullChordMatches` memo with a 3NPS branch; extend the dep list with `boxBounds` and `chordFretSpread`.
- `src/hooks/useFretboardState.test.tsx` — new 3NPS-scope cases.

**Created:** none.

**Deleted:** none.

---

## Task 1: Widen `ToggleBar.value` to `Value | undefined`

**Files:**
- Modify: `src/components/ToggleBar/ToggleBar.tsx`
- Test: `src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `src/components/ToggleBar/ToggleBar.test.tsx` and read the existing imports + test structure first (the file uses `render` + `screen` from `@testing-library/react` and Vitest's `describe`/`it`/`expect`). Append a new test inside whichever `describe` block exists, or as a new top-level case if the file uses bare `it`:

```tsx
it("renders every option unpressed when value is undefined (Task 1)", () => {
  const onChange = vi.fn();
  render(
    <ToggleBar
      label="Cluster"
      value={undefined}
      onChange={onChange}
      options={[
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ]}
    />,
  );
  for (const name of ["A", "B"]) {
    const btn = screen.getByRole("button", { name });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  }
});
```

`vi.fn()` is the Vitest mock — match the existing test file's import style (`import { vi } from "vitest"` if not already imported).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ToggleBar/ToggleBar.test.tsx`
Expected: FAIL — TypeScript rejects `value={undefined}` because `value: Value` is currently required and `Value extends string | number` does not include `undefined`.

- [ ] **Step 3: Widen the prop type**

In `src/components/ToggleBar/ToggleBar.tsx`, find the `ToggleBarProps` interface (around line 46) and change `value: Value;` to `value: Value | undefined;`. Leave `onChange: (value: Value) => void;` alone — `ToggleBar` only ever emits known option values.

Concrete edit — find:

```ts
interface ToggleBarProps<Value extends string | number> extends VariantProps<
  typeof toggleBarVariants
> {
  options: readonly ToggleBarOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
```

Change to:

```ts
interface ToggleBarProps<Value extends string | number> extends VariantProps<
  typeof toggleBarVariants
> {
  options: readonly ToggleBarOption<Value>[];
  value: Value | undefined;
  onChange: (value: Value) => void;
```

No other change is required: the body's `option.value === value` comparison already returns `false` for every option when `value` is `undefined`, which is exactly the desired effect.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/ToggleBar/ToggleBar.test.tsx`
Expected: PASS — including the new case AND all existing cases (the widening is backward-compatible).

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b`
Expected: PASS — no errors. (If a downstream consumer breaks because it relied on `value` being non-undefined, that's a bug worth knowing about, but at the time of writing this plan no such consumer exists. Task 2 is the one consumer that will exploit the new flexibility.)

- [ ] **Step 6: Commit**

```bash
git add src/components/ToggleBar/
git commit -m "feat(toggle-bar): widen value prop to Value | undefined

Backward-compatible widening: existing call sites pass a concrete
Value and continue to typecheck. Passing undefined leaves every
option unpressed (every option.value === undefined is false), which
is the natural 'no selection' state. Unblocks dropping the sentinel
casts in FingeringPatternControls (next task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Drop sentinel casts from `FingeringPatternControls`

**Files:**
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.tsx`

This task has no new behavior to test — it removes a TypeScript cast. The existing `FingeringPatternControls.test.tsx` (the cluster-split tests added in PR #419) is the regression net. If those tests still pass, the cleanup is correct.

- [ ] **Step 1: Confirm the existing tests still pass before editing**

Run: `pnpm vitest run src/components/FingeringPatternControls/`
Expected: PASS — establishes the green baseline. If anything fails here, stop: the rebased branch state is wrong, not your work.

- [ ] **Step 2: Remove the Position-cluster sentinel cast + comment**

In `src/components/FingeringPatternControls/FingeringPatternControls.tsx`, find the Position cluster's `<ToggleBar>` (around lines 79-89). Replace:

```tsx
          // Sentinel: when the active pattern belongs to the String study cluster,
          // no button in this cluster should appear pressed. Cast through a member
          // type so TypeScript is satisfied — ToggleBar compares value === option.value
          // and finds no match for the sentinel.
          value={
            (fingeringPattern === "none" ||
            fingeringPattern === "caged" ||
            fingeringPattern === "3nps"
              ? fingeringPattern
              : "__inactive__") as "none"
          }
```

with:

```tsx
          value={
            fingeringPattern === "none" ||
            fingeringPattern === "caged" ||
            fingeringPattern === "3nps"
              ? fingeringPattern
              : undefined
          }
```

- [ ] **Step 3: Remove the String-study-cluster sentinel cast + comment**

In the same file, find the String-study cluster's `<ToggleBar>` (around lines 101-107). Replace:

```tsx
          // Sentinel: when the active pattern belongs to the Position cluster,
          // no button in this cluster should appear pressed.
          value={
            (fingeringPattern === "one-string" || fingeringPattern === "two-strings"
              ? fingeringPattern
              : "__inactive__") as "one-string"
          }
```

with:

```tsx
          value={
            fingeringPattern === "one-string" || fingeringPattern === "two-strings"
              ? fingeringPattern
              : undefined
          }
```

- [ ] **Step 4: Confirm no other consumer of `ToggleBar` relies on the sentinel idiom**

Run: `grep -rn '"__inactive__"' src/`
Expected: zero matches. (Only `FingeringPatternControls` used the sentinel; this is a sanity check.)

- [ ] **Step 5: Run the test suite**

Run: `pnpm vitest run src/components/FingeringPatternControls/`
Expected: PASS — every existing test still green.

- [ ] **Step 6: Run typecheck + lint**

```bash
npx tsc -b
pnpm run lint
```

Expected: both PASS. The `as "none"` / `as "one-string"` casts are gone; TypeScript now sees `Value | undefined` thanks to Task 1.

- [ ] **Step 7: Commit**

```bash
git add src/components/FingeringPatternControls/FingeringPatternControls.tsx
git commit -m "refactor(fingering): drop \"__inactive__\" sentinel casts

ToggleBar.value now accepts undefined (previous commit). The inactive
cluster passes undefined directly; no value matches any option, every
button renders aria-pressed=\"false\". Drop the misleading cast through
a known option type and the explanatory comments.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add 3NPS voicing scorer and wire it into `useFretboardState`

**Files:**
- Modify: `src/hooks/useFretboardState.ts`
- Test: `src/hooks/useFretboardState.test.tsx`

This task introduces the 3NPS-position scorer that mirrors `selectFullChordMatchesForCagedPosition` and extends the existing `visibleFullChordMatches` memo with a 3NPS branch. The CAGED scorer uses polygon vertices; the 3NPS scorer uses per-string `boxBounds`. Same tolerance (`outsideCount ≤ 2`, with `chordFretSpread` buffer), same scoring record shape so the existing `compareFullChordCandidateScores` comparator handles both.

- [ ] **Step 1: Read the current hook state**

Open `src/hooks/useFretboardState.ts` and skim:
- The `FullChordCandidateScore` interface (around line 51).
- `scoreFullChordForCagedPosition` (around line 60).
- `compareFullChordCandidateScores` (around line 77).
- `getPositionKey` (around line 87).
- `selectFullChordMatchesForCagedPosition` (around line 91).
- The `visibleFullChordMatches` memo (around line 177).

Also open `src/components/FretboardSVG/utils/semantics.ts:11` to confirm `BoxBound = { minFret: number; maxFret: number }`.

Knowing the existing shape, the new scorer must produce a `FullChordCandidateScore` with `selectedShapePriority: 0` (a dead field for 3NPS — kept to share the comparator).

- [ ] **Step 2: Look at the existing test file structure**

Open `src/hooks/useFretboardState.test.tsx` and note:
- The Jotai `createStore` + `Provider` test helper.
- How an existing "Task 7" describe block seeds `chordScopeToPositionAtom`, `fingeringPatternAtom`, and `cagedShapesAtom` for the CAGED scope test.

You will mirror that pattern for the 3NPS cases.

- [ ] **Step 3: Write the failing tests**

Append to `src/hooks/useFretboardState.test.tsx`:

```tsx
describe("useFretboardState — 3NPS voicing scope (Task 3)", () => {
  it("filters voicings when chordScopeToPosition is on and a 3NPS position is active", () => {
    const store = createStore();
    // Seed a chord with a non-trivial fullChordMatches list. The test-utils
    // helpers used elsewhere in this file already do this — match their
    // pattern. The exact chord doesn't matter; what matters is that the
    // raw fullChordMatchesAtom returns multiple voicings spread across
    // the neck so the filter has something to filter.
    store.set(fingeringPatternAtom, "3nps");
    store.set(npsPositionAtom, 1);
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "major");
    store.set(chordScopeToPositionAtom, true);

    const { result } = renderHook(() => useFretboardState(), {
      wrapper: withStore(store),
    });

    const raw = store.get(fullChordMatchesAtom);
    expect(result.current.fullChordMatches.length).toBeLessThan(raw.length);
    expect(result.current.fullChordMatches.length).toBeGreaterThan(0);
  });

  it("does not filter when chordScopeToPosition is off", () => {
    const store = createStore();
    store.set(fingeringPatternAtom, "3nps");
    store.set(npsPositionAtom, 1);
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "major");
    store.set(chordScopeToPositionAtom, false);

    const { result } = renderHook(() => useFretboardState(), {
      wrapper: withStore(store),
    });

    const raw = store.get(fullChordMatchesAtom);
    expect(result.current.fullChordMatches).toEqual(raw);
  });

  it("does not filter when 3NPS position is 0 (All) — activePositionAtom is false", () => {
    const store = createStore();
    store.set(fingeringPatternAtom, "3nps");
    store.set(npsPositionAtom, 0);
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "major");
    store.set(chordScopeToPositionAtom, true);

    const { result } = renderHook(() => useFretboardState(), {
      wrapper: withStore(store),
    });

    const raw = store.get(fullChordMatchesAtom);
    expect(result.current.fullChordMatches).toEqual(raw);
  });
});
```

Imports — extend the existing top-of-file imports:

```tsx
import {
  // …existing imports
  fingeringPatternAtom,
  npsPositionAtom,
  chordOverlayModeAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
  chordScopeToPositionAtom,
  fullChordMatchesAtom,
} from "../store/atoms";
```

If the existing test file already imports some of these, deduplicate. If it uses a different chord-seed helper (e.g. a `seedManualChord(store, root, quality)`), prefer that and drop the three `store.set` chord lines accordingly.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm vitest run src/hooks/useFretboardState`
Expected: the first new case FAILS — `result.current.fullChordMatches.length` is currently equal to `raw.length` because nothing filters 3NPS voicings yet. The second and third cases may pass already (they exercise the off / no-active-position paths that already fall through) — that is fine.

- [ ] **Step 5: Add the scorer helpers above the hook**

In `src/hooks/useFretboardState.ts`, immediately before `export function useFretboardState()` (around line 117), add:

```ts
import type { BoxBound } from "../components/FretboardSVG/utils/semantics";
```

Place this near the other type imports at the top of the file — find the existing `import type { CagedShape, Voicing, VoicingNote, ShapePolygon } from "@fretflow/core";` line (around line 27) and add the `BoxBound` import directly below it. Do NOT add a duplicate import.

Then, just above `selectFullChordMatchesForCagedPosition` (or just below it — pick whichever keeps the helpers grouped; the existing file puts utilities before the consumer), add:

```ts
function scoreFullChordForThreeNpsPosition(
  match: Voicing,
  boxBounds: BoxBound[],
  chordFretSpread: number,
): FullChordCandidateScore | null {
  const outsideDistances = match.notes.map((note) => {
    const b = boxBounds[note.stringIndex];
    if (!b) return Number.POSITIVE_INFINITY;
    const minFret = b.minFret - chordFretSpread;
    const maxFret = b.maxFret + chordFretSpread;
    if (note.fretIndex < minFret) return minFret - note.fretIndex;
    if (note.fretIndex > maxFret) return note.fretIndex - maxFret;
    return 0;
  });
  const outsideCount = outsideDistances.filter((d) => d > 0).length;
  if (outsideCount > 2) return null;
  return {
    match,
    outsideCount,
    totalOutsideDistance: outsideDistances.reduce((sum, d) => sum + d, 0),
    maxOutsideDistance: Math.max(...outsideDistances),
    selectedShapePriority: 0,
  };
}

function selectFullChordMatchesForThreeNpsPosition(
  matches: Voicing[],
  boxBounds: BoxBound[],
  chordFretSpread: number,
): Voicing[] {
  const byPosition = new Map<string, FullChordCandidateScore>();
  for (const match of matches) {
    const score = scoreFullChordForThreeNpsPosition(match, boxBounds, chordFretSpread);
    if (score === null) continue;
    const positionKey = getPositionKey(match);
    const previous = byPosition.get(positionKey);
    if (!previous || compareFullChordCandidateScores(score, previous) < 0) {
      byPosition.set(positionKey, score);
    }
  }
  return Array.from(byPosition.values()).map((s) => s.match);
}
```

Notes:
- `selectedShapePriority: 0` is intentional — the field is unused for 3NPS but kept so the same `FullChordCandidateScore` record + comparator work for both scorers. (Generalising the record by removing the field is out of scope; the spec calls this out explicitly.)
- The selection iterates matches once and stores the *score* alongside, then maps back to `match` at the end. This avoids re-scoring `previous` inside the comparator.

- [ ] **Step 6: Extend the `visibleFullChordMatches` memo**

In `src/hooks/useFretboardState.ts`, replace the existing `visibleFullChordMatches` memo (around line 177) with:

```ts
  const visibleFullChordMatches = useMemo(() => {
    if (!chordScopeToPosition || !activePosition) return fullChordMatches;
    if (fingeringPattern === "caged") {
      return selectFullChordMatchesForCagedPosition(
        fullChordMatches,
        shapePolygons,
        cagedShapes,
      );
    }
    if (fingeringPattern === "3nps") {
      return selectFullChordMatchesForThreeNpsPosition(
        fullChordMatches,
        boxBounds,
        chordFretSpread,
      );
    }
    return fullChordMatches;
  }, [
    chordScopeToPosition,
    activePosition,
    fingeringPattern,
    fullChordMatches,
    shapePolygons,
    cagedShapes,
    boxBounds,
    chordFretSpread,
  ]);
```

`boxBounds` and `chordFretSpread` are already read by the hook (from `effectiveShapeDataAtom` and `chordFretSpreadAtom` respectively — verify by reading lines ~127 and ~136). They just enter the dependency list now.

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run src/hooks/useFretboardState`
Expected: PASS — including the three new cases.

- [ ] **Step 8: Verify no regression in the CAGED scope path**

Run: `pnpm vitest run src/hooks src/components/Fretboard src/components/FretboardSVG`
Expected: PASS — the existing CAGED scope tests still green; no test that exercises 3NPS without scope on regresses.

- [ ] **Step 9: Run lint + typecheck + build**

```bash
pnpm run lint
npx tsc -b
pnpm run build
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useFretboardState.ts src/hooks/useFretboardState.test.tsx
git commit -m "feat(voicing): scope voicings to 3NPS position when toggle is on

Adds selectFullChordMatchesForThreeNpsPosition mirroring the CAGED
scorer: same outsideCount <= 2 tolerance, same chordFretSpread buffer,
same FullChordCandidateScore record shape so compareFullChordCandidateScores
handles both. Bounds come from the per-string boxBounds instead of
polygon vertices.

The visibleFullChordMatches memo dispatches on fingeringPattern:
caged uses the existing polygon scorer, 3nps uses the new box-bounds
scorer, anything else falls through unmodified. chordScopeToPosition
+ activePosition still gate the entire branch — default behavior is
unchanged.

Closes the spec §6 gap from PR #419: chord-tone dots already clamped
via chordBoxBounds in 3NPS; voicings now match.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full quality gate + visual baselines

**Files:** none modified beyond snapshots.

- [ ] **Step 1: Run the mandatory pre-PR commands**

```bash
pnpm run lint
pnpm run test
pnpm run build
npx tsc -b
```

Expected: all PASS. Read each command's output. Any failure → diagnose, edit, re-run from this step.

- [ ] **Step 2: Run the production e2e suite**

```bash
pnpm run test:e2e:production
```

Expected: PASS. The 3NPS voicing change can affect chord-overlay rendering when a user pairs 3NPS with Scope on — verify no production e2e test trips.

- [ ] **Step 3: Run the visual suite**

```bash
pnpm run test:visual
```

Expected: most snapshots PASS. Failures are expected only for any visual that exercises 3NPS + Scope on simultaneously — none exist today, but if a new failure appears, inspect the diff in `e2e/*-snapshots/` to confirm it reflects the new (correct) behavior (fewer voicings rendered, clamped to the position).

- [ ] **Step 4: Refresh baselines if step 3 surfaced legitimate diffs**

If and only if step 3 reported failures matching the expected new behavior:

```bash
pnpm run test:visual:update
pnpm run test:visual:update:linux
```

Then re-run `pnpm run test:visual` to confirm green against the refreshed baselines.

If step 3 was already green, skip steps 4-5 entirely.

- [ ] **Step 5: Commit baseline refresh (if any)**

```bash
git status --short e2e/
# only if there are modified .png files:
git add e2e/
git commit -m "test(visual): refresh baselines for 3NPS voicing scoping

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If step 4 didn't run, skip this commit entirely.

---

## Acceptance Criteria Coverage Check

| Spec criterion | Task(s) |
|---|---|
| Switching `fingeringPatternAtom` between caged/3nps with Scope on + active position constrains voicings comparably | 3 |
| 3NPS + Scope on + specific position: voicings visibly change when position switches | 3 |
| 3NPS + Scope off OR `npsPosition === 0`: voicings unconstrained | 3 (off + All cases) |
| CAGED scoping unchanged | 3 (no edit to CAGED scorer; existing tests cover) |
| `FingeringPatternControls.tsx` contains no `as` casts on cluster `value` props | 2 |
| `ToggleBar` accepts `value={undefined}` with no cast and renders every option `aria-pressed="false"` | 1 |
| `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` pass | 4 |
