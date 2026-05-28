# React Render Performance Design

**Date:** 2026-05-27
**Topic:** Tighten React rendering cost during progression playback and chord-overlay updates
**Status:** Drafted from code investigation. Supersedes `2026-05-27-state-performance-design.md` and `2026-05-27-micro-optimizations-design.md`.

## Summary

Two related but distinct render-cost issues remain after recent perf work:

1. **Coarse Jotai subscriptions in chord-overlay land.** Several derived atoms in `src/store/chordOverlayAtoms.ts` return fresh object/array references on changes that are irrelevant to most consumers. Components that only need one slice still re-render on every recomputation.
2. **Per-render allocations in two hot components.** `ProgressionTrack` rebuilds its ruler DOM inline on every playhead tick. `FretboardHitTargetLayer` allocates 144 closures per render for the per-button `onClick`.

This spec consolidates both threads into one targeted pass. It is intentionally narrow — no structural refactors, no state-shape redesign.

## Already done — context

These claims appeared in the superseded specs; they are no longer in scope because the work is already on `main`:

- `splitAtom(progressionStepsAtom)` is exported as `progressionStepAtomsAtom` (`src/store/progressionAtoms.ts:101`).
- `ProgressionBlock` already subscribes via its individual `stepAtom: Atom<ProgressionStep>` prop (`src/components/ProgressionTrack/ProgressionBlock.tsx:37`).
- `FretboardHitTargetLayer` is wrapped with `React.memo` (`FretboardHitTargetLayer.tsx:27`).
- `chordHighlightPositionsAtom` is content-fingerprint-stabilized (R3-T1).
- React Compiler is enabled with `compilationMode: 'infer'` across `src/` and `packages/core/src/`, so most components are auto-memoized. Manual `React.memo` should be added only when profiling proves it.

## Goals

1. Eliminate unnecessary chord-overlay re-renders driven by reference-instability in heavy derived atoms.
2. Skip ruler reconciliation when only the playhead/active step changed.
3. Drop the per-render allocation count in `FretboardHitTargetLayer` from 144 closures to 1.
4. Verifiable: each fix must come with a Vitest re-render assertion or a measurable DevTools Profiler delta.

## Non-goals

1. Migrating chord overlay state to component-folder colocation.
2. Re-shaping any atom's stored value (e.g. converting a `Set` to a `Map`).
3. Adding manual `useMemo`/`useCallback` where React Compiler already covers the case.
4. Wholesale `selectAtom` adoption across all 39 exports of `chordOverlayAtoms.ts`. Target only atoms with proven over-rendering.

## Findings

### 1. `chordOverlayAtoms.ts` has heavy derived atoms with broad consumer impact

Notable expensive derivations and their consumer counts (audited 2026-05-27):

| Atom | Returns | Hot consumer | Re-render impact |
|------|---------|--------------|------------------|
| `visibleVoicingMatchesAtom` | `Voicing[]` (~3-6 voicings, each with notes array) | `useFretboardTopologyModel` | Drives every connector polyline recompute |
| `chordHighlightPositionsAtom` | `Set<string>` (fingerprint-stable) | `useFretboardTopologyModel` | Already stabilized; remains as reference baseline |
| `chordLookupAtom` | `{ root, type, notes, … }` object | `chordShortLabelAtom`, `chordMemberFactsAtom` | Most consumers want one field, get whole object |
| `chordMemberFactsAtom` | `ChordMemberFact[]` | Inspector + StatusBar | Re-derives on any chord state change |
| `stringSetOptionsAtom` | `readonly StringSetOption[]` | `ChordStringSetPicker` | Recomputes whenever any upstream voicing input changes |

Only `chordLookupAtom` has the classic `selectAtom` smell: object atom, most consumers read one property. The others are arrays consumed as wholes by topology code — they need reference stability (which `chordHighlightPositionsAtom` already has) rather than slicing.

### 2. `ProgressionTrack.tsx` ruler

Lines 56–74 generate the bar/beat tick DOM inline. The component re-renders whenever `displayedStepIndex`, `playing`, `currentProgressionBar`, or `playbackBlockedReason` changes — which during playback is **once per beat**. The ruler only depends on `totalBarsForDisplay` and `subdivisionsPerBar`, both stable across a playback session.

React Compiler memoizes the JSX expression in place — so the children may be skipped already. But the `Array.from(...).map(...)` factories still execute, allocate, and produce element identity that the Compiler then has to compare. Extracting to a component with `totalBarsForDisplay` + `subdivisionsPerBar` props lets the Compiler skip the whole subtree on prop equality.

### 3. `FretboardHitTargetLayer.tsx` per-button closures

Lines 56–60:

```tsx
onClick={
  onNoteClick
    ? () => onNoteClick(stringIndex, fretIndex, noteName)
    : undefined
}
```

For 6 strings × 24 frets = 144 buttons, every render allocates 144 closures. The component is `memo()`-wrapped so the parent must change its props (`noteData`, `fretCenterX`, `stringYAt`, `onNoteClick`) to trigger re-render — but each tuning change, neck-size change, or note-data change cascades all 144 allocations.

Event delegation via the parent container collapses this to one stable closure.

## Approaches considered

### Tactic A — Slice `chordLookupAtom` with `selectAtom`

**Option A1 (recommended):** Create derived atoms via `selectAtom` for the two consumed fields:
```ts
import { selectAtom } from "jotai/utils";
export const chordLookupRootAtom = selectAtom(chordLookupAtom, (l) => l.root);
export const chordLookupTypeAtom = selectAtom(chordLookupAtom, (l) => l.type);
```
Rewire `chordShortLabelAtom` (which currently reads the whole lookup just for `root` + `type`) to depend on the slices.

**Option A2:** Restructure `chordLookupAtom` itself into multiple primitive-returning atoms. Heavier refactor, breaks the unified type, no Profiler win over A1.

→ **A1** wins on cost/benefit.

### Tactic B — Extract `ProgressionRuler`

**Option B1 (recommended):** Pure component, no manual `React.memo`. Props `{ totalBarsForDisplay, subdivisionsPerBar }`. Let React Compiler handle memoization (`compilationMode: 'infer'` covers it).
**Option B2:** Same component, explicit `React.memo` wrapper. Redundant under current Compiler config; documents intent but adds noise.

→ **B1** wins. If profiler later shows the Compiler skipped memoization (e.g. due to a Rules-of-React violation lint surfaces), fall back to B2.

### Tactic C — Event delegation on `FretboardHitTargetLayer`

**Option C1 (recommended):** Single `onClick` on the parent container. Buttons keep their per-button DOM (focus, ARIA), gain `data-string-index` / `data-fret-index` / `data-note-name`. Parent handler uses `event.target.closest("button")` and reads attributes.
**Option C2:** Pass a stable callback factory via `useCallback`, keyed on `(stringIndex, fretIndex)`. Doesn't actually help — the resulting per-button closures still allocate; you've just moved the allocation site.
**Option C3:** Switch from `<button>` to a single SVG `<rect>` overlay with pointer-event hit-testing. Wholesale a11y rewrite, out of scope.

→ **C1** wins.

## Recommended design

### Tactic A — `selectAtom` slicing of `chordLookupAtom`

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts` — add `chordLookupRootAtom`, `chordLookupTypeAtom`; rewire `chordShortLabelAtom` to consume the slices.
- Modify: `src/store/chordOverlayAtoms.test.ts` — add assertions that `chordLookupRootAtom` does not change reference when only `notes` changes.

**Equality:** Both slices return primitives (`string` / `string | null`), so default `Object.is` equality is correct. No custom comparator needed.

**Out of scope for Tactic A:** `chordMemberFactsAtom`, `visibleVoicingMatchesAtom`, `stringSetOptionsAtom`. These return arrays consumed as wholes; slicing would not reduce consumer re-render count. If profiling later reveals they over-render, address in a follow-up — do not preempt.

### Tactic B — `ProgressionRuler` extraction

**Files:**
- Create: `src/components/ProgressionTrack/ProgressionRuler.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx` — replace lines 56–74 with `<ProgressionRuler totalBarsForDisplay={…} subdivisionsPerBar={…} />`.
- Create: `src/components/ProgressionTrack/ProgressionRuler.test.tsx` — render-count assertion (see Testing below).

**Component shape:**
```tsx
interface ProgressionRulerProps {
  totalBarsForDisplay: number;
  subdivisionsPerBar: number;
}
export function ProgressionRuler({ totalBarsForDisplay, subdivisionsPerBar }: ProgressionRulerProps) {
  return (
    <div className={styles.ruler} aria-hidden="true">
      {/* exact JSX moved verbatim from ProgressionTrack lines 57–73 */}
    </div>
  );
}
```

**No `React.memo`.** The Compiler will infer memoization from the pure prop signature.

### Tactic C — Event delegation in `FretboardHitTargetLayer`

**Files:**
- Modify: `src/components/FretboardSVG/FretboardHitTargetLayer.tsx`
- Modify: `src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx` — add allocation-count + keyboard-activation tests.

**Implementation sketch:**
```tsx
const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
  if (!onNoteClick) return;
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button || button.dataset.stringIndex === undefined) return;
  const stringIndex = Number(button.dataset.stringIndex);
  const fretIndex = Number(button.dataset.fretIndex);
  const noteName = button.dataset.noteName ?? "";
  onNoteClick(stringIndex, fretIndex, noteName);
};
```

**Per-button:**
```tsx
<button
  key={`btn-${stringIndex}-${fretIndex}`}
  type="button"
  data-string-index={stringIndex}
  data-fret-index={fretIndex}
  data-note-name={noteName}
  disabled={!onNoteClick}
  aria-hidden={isHidden || undefined}
  tabIndex={isHidden ? -1 : undefined}
  aria-label={…}
  …
/>
```

**Why this preserves a11y:** `<button>` elements still receive focus, Enter/Space keyboard activations are converted by the browser into synthetic click events that bubble to the parent container. The `aria-label`, `aria-hidden`, and `tabIndex` per-button semantics are unchanged.

**Why the disabled branch is safe:** When `onNoteClick` is undefined, each button has `disabled` set, and the parent handler short-circuits at `if (!onNoteClick) return;`. No click handlers fire either way.

## Risk surfaces

1. **`selectAtom` reference stability under derivation churn.** Verified safe for primitives; the only consumer-side regression would be if a downstream atom captured the previous reference identity. Mitigated by keeping changes scoped to two slices and one rewired consumer.
2. **Data-attribute parsing cost.** `Number(string)` for each click is O(1) and runs only on user input, not on render. Cost is negligible compared to the 144-closure-per-render savings.
3. **`closest("button")` returning null.** Possible if the click somehow lands on the container outside any button (e.g. the absolute-positioned buttons with `opacity: 0` cover the layer, but the gap is < 1px). The early return makes this fail-safe — no thrown error, just no callback fired.
4. **React Compiler skip on `ProgressionRuler` failing silently.** If the rule `react-compiler/react-compiler` flags an issue (e.g. an accidental closure over mutable state), the lint will fail at PR time. CI guards this.
5. **Keyboard activation on hidden buttons.** `tabIndex={-1}` + `aria-hidden` already removes them from the focus order. The delegated handler also won't fire for `disabled` buttons because the browser suppresses click events from disabled buttons.

## Testing

Each tactic has a paired test that asserts the intended behavior. Avoid relying on Profiler-only validation — make assertions deterministic.

### Tactic A tests

Add to `chordOverlayAtoms.test.ts`:

1. **Slice reference stability:** Mutate an upstream atom in a way that changes `chordLookupAtom.notes` but keeps `root` and `type` identical. Assert that `store.get(chordLookupRootAtom)` returns the same reference (`===`) as before.
2. **`chordShortLabelAtom` consumer:** Assert that a state mutation which leaves `root` + `type` unchanged does not retrigger `chordShortLabelAtom`'s subscriber. Use a `store.sub()` call counter.

### Tactic B tests

Create `ProgressionRuler.test.tsx`:

1. **Static render:** With `totalBarsForDisplay=4`, `subdivisionsPerBar=4`, assert 4 `.rulerBar` elements, 12 `.rulerTick--beat` elements.
2. **Render-skip under Compiler memoization:** Add a `useEffect(() => { effectCount.current++; })` inside `ProgressionRuler` exposed via a forwarded ref. Render once, then `rerender` four times with the same prop object. Assert `effectCount.current === 1` — the Compiler should skip both render and effect on stable props. If the Compiler ever stops memoizing this component (e.g. a Rules-of-React regression), this test fails loudly.

### Tactic C tests

Update `FretboardHitTargetLayer.test.tsx`:

1. **Click delegation:** Simulate a click on a button at `(stringIndex=2, fretIndex=5)`, assert `onNoteClick` called with `(2, 5, "<note>")`.
2. **Keyboard activation:** Use `userEvent.keyboard("{Enter}")` on a focused button, assert callback fires identically.
3. **Disabled state:** With `onNoteClick={undefined}`, click and assert no errors and the parent handler short-circuits (no callback registered to assert against — verify no thrown errors and no DOM mutation).
4. **No callback prop:** With `onNoteClick` undefined, assert buttons have `disabled` attribute and `pointer-events: none`.

## Implementation slicing

Stage as three independent commits, each with its own tests:

1. **Slice A** — `selectAtom` for `chordLookupAtom`. Smallest, lowest-risk.
2. **Slice B** — Extract `ProgressionRuler`. Pure JSX move + new component.
3. **Slice C** — Event delegation in `FretboardHitTargetLayer`. Largest a11y surface; ship last with extra test coverage.

Each slice independently lands `pnpm lint && pnpm test && pnpm build` green. Visual regression snapshots should be unchanged (no DOM-shape changes; data attributes are invisible).

## Verification

After all three slices:

1. `pnpm lint && pnpm test && pnpm build` — must pass.
2. `pnpm test:e2e:production` — must pass (delegation must not break click-to-add-tone interaction).
3. Manual DevTools Profiler smoke (`pnpm dev`):
   - Start playback. Confirm `ProgressionRuler` does not appear in the "rendered components" panel per playback tick.
   - Toggle a chord tone visibility. Confirm `chordShortLabelAtom` consumers (e.g. `StatusBar`) do not re-render if the slice fields didn't change.
   - Click a fretboard note. Confirm the click registers correctly and only one closure exists for the layer.
4. Visual baseline refresh (`pnpm test:visual:update`) — expected to be a no-op; if any baselines move, investigate before accepting.
