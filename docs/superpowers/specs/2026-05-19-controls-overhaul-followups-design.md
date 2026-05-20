# Controls Overhaul Follow-ups — Design

**Status:** Brainstorm spec. Produced 2026-05-19 from the final code-review of
the Controls Overhaul branch ([PR #419](https://github.com/iecg/fretboard-app/pull/419)).
Two unrelated follow-ups packaged into a single small PR.

**Date:** 2026-05-19

**Scope:** Two surgical fixes left open by PR #419:
1. The voicing engine's position scoping is CAGED-only — 3NPS doesn't filter
   voicings when the Scope-to-position toggle is on.
2. `FingeringPatternControls` uses a misleading TypeScript cast
   (`"__inactive__" as "none"`) to render the inactive cluster.

No new features, no engine changes, no UX changes beyond making the
already-shipped Scope-to-position toggle work consistently in 3NPS.

**Builds on:** PR #419 (controls overhaul). Specifically the
`chordScopeToPositionAtom`, `activePositionAtom`, and `chordBoxBounds`
plumbing in `src/hooks/useFretboardState.ts`, and the two-cluster
`ToggleBar` use inside `src/components/FingeringPatternControls/FingeringPatternControls.tsx`.

---

## 1. Background

### 1a. 3NPS voicing-scope gap

The Controls Overhaul spec §6 says:

> When the toggle is on _and_ an active position exists: the chord overlay —
> both the loose chord-tone highlighting _and_ the voicing-engine output — is
> constrained to that position's fret window.

After PR #419 this is half-true. The chord-tone clamp in `useNoteData` uses
the new `chordBoxBounds` for both CAGED and 3NPS — that part works. The
voicing-engine output (`fullChordMatches`) is filtered by
`selectFullChordMatchesForCagedPosition`, which is CAGED-only:

```ts
// src/hooks/useFretboardState.ts (post-PR #419)
const visibleFullChordMatches = useMemo(
  () =>
    chordScopeToPosition && activePosition && fingeringPattern === "caged"
      ? selectFullChordMatchesForCagedPosition(
          fullChordMatches,
          shapePolygons,
          cagedShapes,
        )
      : fullChordMatches,
  [...],
);
```

The scorer compares each `Voicing`'s notes against polygon vertices — those
don't exist for 3NPS. So when a user switches to 3NPS, opts into the toggle,
and selects a position, the chord-tone *dots* clamp to that position but the
voicing *diagrams* spread freely across the neck. The new toggle's contract
becomes inconsistent across position systems.

### 1b. `ToggleBar` sentinel cast

PR #419 split the fingering selector into two clusters (Position /
String study). Both clusters write the same `fingeringPatternAtom`, so only
one cluster can be active at a time. To render the *other* cluster with all
buttons unpressed, `FingeringPatternControls` passes a sentinel value that
matches no option, cast through one of the option types:

```tsx
value={
  fingeringPattern === "none" || fingeringPattern === "caged" || fingeringPattern === "3nps"
    ? fingeringPattern
    : ("__inactive__" as "none")
}
```

This works because `ToggleBar` compares `option.value === value` at runtime,
and `"__inactive__"` matches no option. The cast lies to TypeScript: the
value is not `"none"`. The comment that follows explains the trick, but the
type assertion is exactly the kind of cast a future contributor will be
unsure whether to trust.

---

## 2. Goals and Non-Goals

### Goals

- The Scope-to-position toggle constrains voicings consistently across CAGED
  and 3NPS — the user-facing contract reads the same regardless of which
  position system is active.
- `FingeringPatternControls` builds without `as`-casts on the cluster `value`
  props. The "no value selected" idiom is `undefined`, not a sentinel string.

### Non-Goals

- No new voicing types, no engine changes.
- No new UI controls, no new atoms, no new i18n keys.
- No change to the CAGED scoping path or the chord-tone clamp.
- No generalised "PositionBounds" abstraction over CAGED + 3NPS — premature
  unification. The two scorers stay parallel.
- No change to the `ToggleBar` runtime behavior — only the prop type widens.

---

## 3. 3NPS voicing scoping

### 3a. Scorer

A new private helper next to `selectFullChordMatchesForCagedPosition` in
`src/hooks/useFretboardState.ts`:

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
    totalOutsideDistance: outsideDistances.reduce((s, d) => s + d, 0),
    maxOutsideDistance: Math.max(...outsideDistances),
    selectedShapePriority: 0, // unused for 3NPS — matches the CAGED record shape
  };
}
```

Symmetry with CAGED: same `≤ 2 notes outside` tolerance, same
`chordFretSpread` buffer, same `FullChordCandidateScore` shape so the
existing `compareFullChordCandidateScores` comparator handles both.
`selectedShapePriority` is a dead field for 3NPS; it stays at `0` so the
comparator never prefers one match over another on that axis. (Renaming or
generalising the record is out of scope — leaving the unused field is the
smallest change.)

### 3b. Selection wrapper

```ts
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

Structural difference from the CAGED scorer: CAGED iterates over polygons
and picks the best `Voicing` per polygon; 3NPS iterates over `Voicing`s and
keeps the best one per `positionKey`. 3NPS has only one active box-bounds
set at a time (one position, one octave choice), so there's nothing to
iterate over on the bounds side.

### 3c. Hook wiring

The `visibleFullChordMatches` memo gains a second branch:

```ts
const visibleFullChordMatches = useMemo(() => {
  if (!chordScopeToPosition || !activePosition) return fullChordMatches;
  if (fingeringPattern === "caged") {
    return selectFullChordMatchesForCagedPosition(
      fullChordMatches, shapePolygons, cagedShapes,
    );
  }
  if (fingeringPattern === "3nps") {
    return selectFullChordMatchesForThreeNpsPosition(
      fullChordMatches, boxBounds, chordFretSpread,
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

`boxBounds` and `chordFretSpread` are already read by the hook
(`boxBounds` from `effectiveShapeDataAtom`, `chordFretSpread` from
`chordFretSpreadAtom`) — they just enter the dependency list.

`activePositionAtom` already gates `npsPosition > 0` (PR #419), so the 3NPS
branch only runs when a real position is selected; "All" / `npsPosition === 0`
falls through to `fullChordMatches` unmodified.

---

## 4. `ToggleBar` widening

### 4a. Type change

`src/components/ToggleBar/ToggleBar.tsx`:

```ts
interface ToggleBarProps<Value extends string | number> extends VariantProps<
  typeof toggleBarVariants
> {
  options: readonly ToggleBarOption<Value>[];
  value: Value | undefined;          // ← widened from Value
  onChange: (value: Value) => void;  // unchanged — only known values emit
  variant?: "default" | "tabs";
  label?: string;
  overflow?: "scroll";
}
```

The destructured `value` inside the component body is then `Value | undefined`,
which the existing `option.value === value` comparison handles correctly —
no runtime change. `aria-pressed={option.value === value}` becomes `false`
for every option when `value` is `undefined`, which is the desired effect.

This is a backward-compatible widening: callers that pass a concrete `Value`
continue to typecheck.

### 4b. `FingeringPatternControls` cleanup

Both `value={...}` expressions in `FingeringPatternControls.tsx` lose their
casts. Position cluster:

```tsx
value={
  fingeringPattern === "none" ||
  fingeringPattern === "caged" ||
  fingeringPattern === "3nps"
    ? fingeringPattern
    : undefined
}
```

String-study cluster:

```tsx
value={
  fingeringPattern === "one-string" || fingeringPattern === "two-strings"
    ? fingeringPattern
    : undefined
}
```

Delete the two comment blocks that explained the sentinel idiom — `undefined`
is self-documenting.

No other call site of `ToggleBar` in the codebase passes a sentinel; every
other consumer passes a concrete known value and is unaffected.

---

## 5. File-level impact

- `src/hooks/useFretboardState.ts` — add `scoreFullChordForThreeNpsPosition`
  and `selectFullChordMatchesForThreeNpsPosition` private helpers; extend
  the `visibleFullChordMatches` memo with the 3NPS branch; extend the dep
  list with `boxBounds` and `chordFretSpread`.
- `src/hooks/useFretboardState.test.tsx` — new cases for 3NPS scope (see §6).
- `src/components/ToggleBar/ToggleBar.tsx` — widen `value: Value | undefined`.
- `src/components/ToggleBar/ToggleBar.test.tsx` — new case: `value={undefined}`
  renders every option with `aria-pressed="false"`.
- `src/components/FingeringPatternControls/FingeringPatternControls.tsx` —
  replace the two sentinel casts with `undefined`; delete the explanatory
  comments.

No store changes, no atoms changes, no i18n changes, no CSS changes, no
new tests for store atoms (the gating logic in `useFretboardState` already
covers `activePositionAtom`).

---

## 6. Testing (TDD — failing test first per task)

### `useFretboardState.test.tsx`

Build on the existing Task 7 cases:

- **3NPS scope on, position active, voicings filtered.** Set
  `fingeringPattern = "3nps"`, `npsPosition = 1`, `chordScopeToPosition = true`.
  Construct a chord whose raw `fullChordMatches` includes voicings inside *and*
  outside the position-1 fret window. Assert `result.current.fullChordMatches.length`
  is less than the raw atom value's length AND non-zero. For each retained
  voicing, assert that at most two of its notes fall outside
  `[boxBounds[stringIndex].minFret − chordFretSpread, boxBounds[stringIndex].maxFret + chordFretSpread]`
  (the scorer's tolerance).

- **3NPS scope off → no filtering.** Same setup but `chordScopeToPosition = false`.
  Assert `result.current.fullChordMatches` equals the raw `fullChordMatchesAtom`.

- **3NPS with `npsPosition = 0` (All) → no filtering.** `activePositionAtom`
  is false; the scope branch falls through.

- **CAGED path unchanged.** Re-run the existing CAGED scope test to confirm
  no regression.

### `ToggleBar.test.tsx`

- **`value={undefined}` renders every option unpressed.** Render with three
  options and `value={undefined}`. Assert every button's `aria-pressed === "false"`.

- **TypeScript: `value` accepts `undefined`.** Add a typed render call passing
  `value={undefined}` with no cast — its very compilation is the assertion.
  (The new test file uses TS so a plain `render(<ToggleBar … value={undefined} />)`
  call is sufficient — no `// @ts-expect-error` needed.)

### `FingeringPatternControls.test.tsx`

The existing cluster-split tests cover the rendering. Verify they still pass
after the casts are removed. Add a quick "no `as` cast" guard at the source
level via a grep in CI? No — over-engineered. The TS compiler enforces the
contract once the cast is gone.

---

## 7. Cross-Cutting Notes

- No new user-facing strings.
- No visual changes — voicing diagrams will simply *not* appear outside the
  active 3NPS position when the toggle is on. The chord-tone clamp from PR
  #419 already trims dots; this PR brings the voicings into line.
- Mandatory before the PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`,
  `npx tsc -b`.
- Visual-regression baselines refresh for any 3NPS-with-scope snapshot. Audit
  `e2e/*.visual.spec.ts` for tests that exercise 3NPS + chord overlay
  simultaneously — none today, but verify before assuming no refresh is needed.
  Add a new visual test only if a regression-prone path is identified.

---

## 8. Acceptance Criteria

- Switching `fingeringPatternAtom` between `caged` and `3nps` with the
  Scope-to-position toggle on and an active position produces a comparable
  effect: voicings constrained to the active position's fret window in both
  cases.
- With 3NPS + Scope on + a specific position, the rendered voicings change
  visibly when the user switches positions.
- With 3NPS + Scope off OR `npsPosition === 0`, voicings render unconstrained
  (matches PR #419 behavior).
- The CAGED scoping path is unchanged — existing CAGED-with-scope tests pass.
- `FingeringPatternControls.tsx` contains no `as` casts on the two cluster
  `value` props.
- `ToggleBar` accepts `value={undefined}` without a cast and renders every
  option with `aria-pressed="false"`.
- `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` all pass.
