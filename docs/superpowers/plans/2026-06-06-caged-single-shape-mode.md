# CAGED Single-Shape Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CAGED fingering pattern show exactly one shape at a time (default E), removing the multi-shape selection that produced the overlapping-region "blob."

**Architecture:** `cagedShapesAtom` stays a `Set<CagedShape>` but is constrained to a one-element invariant by (a) changing its default to `{"E"}`, (b) collapsing any persisted multi-shape value on load, and (c) removing the only multi-writers — `toggleCagedShapeAtom` and the "All" button. Downstream consumers that filter by set membership keep working unchanged; they simply never see more than one shape. No new rendering machinery is added.

**Tech Stack:** React 19 + TypeScript, Jotai (`atomWithStorage`), Vitest + Testing Library, pnpm workspace, CSS Modules, `motion/react`.

---

## File Structure

- `src/store/fingeringAtoms.ts` — change `cagedShapesAtom` default to `{"E"}`; add exported pure helper `collapseToSingleShape`; collapse in storage `deserialize`; delete `toggleCagedShapeAtom`.
- `src/store/fingeringAtoms.test.ts` (new) — unit tests for the default and `collapseToSingleShape`.
- `src/hooks/useShapeState.ts` — drop `toggleCagedShape` and `setCagedShapes`; expose `cagedShapes` read-only + `selectSingleCagedShape`.
- `src/components/FingeringPatternControls/FingeringPatternControls.tsx` — remove "All" button, long-press, and shift-click "add"; plain single-select only; remove the hint affordance.
- `src/components/FingeringPatternControls/FingeringPatternControls.module.css` — remove the now-unused `[data-pressing]` rule.
- `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx` — replace the shift-multi test, remove the help-text test, assert no "All" button.
- `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts` — remove `longPressToAdd`, `shiftClickToAdd`, `shapeHintTouch`, `shapeHintPointer`.
- `src/components/StatusBar/StatusBar.test.tsx` — update the CAGED label test to a single shape.

No changes needed in `shapeAtoms.ts`, `chordOverlayAtoms.ts`, `voicingFallbackAtoms.ts`, `chordScope.ts`, `useFretboardTopologyModel.ts`, `actions.ts`, `scaleAtoms.ts`, or `StatusBar.tsx` — they already work correctly with a single-element set (verified in Task 3).

---

## Task 1: State default + migration

**Files:**
- Modify: `src/store/fingeringAtoms.ts` (lines 21-24 deserialize, 43-48 atom default)
- Create: `src/store/fingeringAtoms.test.ts`

Note: `toggleCagedShapeAtom` (lines 50-59) is **kept in this task** so the hook and component still compile; it is deleted in Task 2 after its callers are removed.

- [ ] **Step 1: Write the failing test**

Create `src/store/fingeringAtoms.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { cagedShapesAtom, collapseToSingleShape } from "./fingeringAtoms";

describe("collapseToSingleShape", () => {
  it("keeps E when present", () => {
    expect(collapseToSingleShape(["C", "A", "G", "E", "D"])).toBe("E");
    expect(collapseToSingleShape(["E"])).toBe("E");
  });

  it("falls back to the first entry when E is absent", () => {
    expect(collapseToSingleShape(["C", "A"])).toBe("C");
    expect(collapseToSingleShape(["G"])).toBe("G");
  });

  it("falls back to E for an empty list", () => {
    expect(collapseToSingleShape([])).toBe("E");
  });
});

describe("cagedShapesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to a single E shape", () => {
    const store = createStore();
    const value = store.get(cagedShapesAtom);
    expect(Array.from(value)).toEqual(["E"]);
  });

  it("collapses a persisted multi-shape value to one shape on load", () => {
    localStorage.setItem("ff.cagedShapes", JSON.stringify(["C", "A", "G", "E", "D"]));
    const store = createStore();
    const value = store.get(cagedShapesAtom);
    expect(Array.from(value)).toEqual(["E"]);
  });
});
```

> Note on the storage key: `cagedShapesAtom` uses `k("cagedShapes")`. Confirm the prefix produced by `k()` in `src/utils/storage.ts` — the test above assumes `"ff.cagedShapes"`. If `k()` produces a different prefix, update the `localStorage.setItem` key in the test to match (read `src/utils/storage.ts` to confirm).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/store/fingeringAtoms.test.ts`
Expected: FAIL — `collapseToSingleShape` is not exported, and the default is `["C","A","G","E","D"]` not `["E"]`.

- [ ] **Step 3: Implement**

In `src/store/fingeringAtoms.ts`, add the helper above the `cagedShapesStorage` definition (after the imports, near line 20):

```ts
/**
 * Collapse a persisted (possibly multi-shape) CAGED selection to a single shape.
 * Prefers E (the default), else the first stored entry, else E. Enforces the
 * one-shape invariant for legacy storage written before single-shape mode.
 */
export function collapseToSingleShape(shapes: CagedShape[]): CagedShape {
  if (shapes.includes("E")) return "E";
  return shapes[0] ?? "E";
}
```

Change the storage `deserialize` (line 23) from:

```ts
  deserialize: (v) => new Set(JSON.parse(v) as CagedShape[]),
```

to:

```ts
  deserialize: (v) => new Set<CagedShape>([collapseToSingleShape(JSON.parse(v) as CagedShape[])]),
```

Change the atom default (line 45) from:

```ts
  new Set(CAGED_SHAPES),
```

to:

```ts
  new Set<CagedShape>(["E"]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/store/fingeringAtoms.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/store/fingeringAtoms.ts src/store/fingeringAtoms.test.ts
git commit -m "feat(caged): default to single E shape and collapse legacy multi-shape storage"
```

---

## Task 2: Single-select UI (remove All / long-press / shift-add)

**Files:**
- Modify: `src/hooks/useShapeState.ts` (lines 3, 10-11, 38-39)
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.tsx` (imports + caged `Prop` block)
- Modify: `src/store/fingeringAtoms.ts` (delete `toggleCagedShapeAtom`, lines 50-59)
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.module.css` (remove `[data-pressing]`)
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts`
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`

- [ ] **Step 1: Update the failing/obsolete tests first**

In `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`, replace the entire `it("handles shift-click multi-select for CAGED shapes", ...)` block with these two tests:

```tsx
  it("selects a single CAGED shape on click (no multi-select)", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "caged");
      store.set(cagedShapesAtom, new Set<CagedShape>(["C"]));
    });

    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );

    const aButton = screen.getByText("A");
    // shiftKey is ignored now — selection always replaces.
    fireEvent.click(aButton, { shiftKey: true });

    const result = store.get(cagedShapesAtom);
    expect(result.has("A")).toBe(true);
    expect(result.has("C")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("does not render an 'All' shape button", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "caged");
    });
    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.queryByRole("button", { name: "All" })).toBeNull();
  });
```

Then delete the obsolete help-text test (the `it("renders the Shift+click help text in the Shape label row", ...)` block, formerly ~lines 500-506) entirely.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`
Expected: FAIL — shift-click still adds (so `result.has("C")` is true and `size` is 2), and the "All" button still renders.

- [ ] **Step 3: Update the hook**

In `src/hooks/useShapeState.ts`:

Change the import (line 3) to drop `toggleCagedShapeAtom`:

```ts
import { fingeringPatternAtom, cagedShapesAtom, selectSingleCagedShapeAtom, npsPositionAtom, npsOctaveAtom, clickedShapeAtom, recenterKeyAtom, oneStringIndexAtom, oneStringIntervalAtom, twoStringsPairAtom, twoStringsIntervalAtom } from "../store/fingeringAtoms";
```

Change the imports to use `useAtomValue` for the now read-only set; line 1 already imports `useAtom, useAtomValue, useSetAtom`, so no import change needed there.

Replace lines 10-12:

```ts
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const toggleCagedShape = useSetAtom(toggleCagedShapeAtom);
  const selectSingleCagedShape = useSetAtom(selectSingleCagedShapeAtom);
```

with:

```ts
  const cagedShapes = useAtomValue(cagedShapesAtom);
  const selectSingleCagedShape = useSetAtom(selectSingleCagedShapeAtom);
```

Remove `setCagedShapes,` and `toggleCagedShape,` from the returned object (formerly lines 38-39). The returned object keeps `cagedShapes,` and `selectSingleCagedShape,`.

- [ ] **Step 4: Rewrite the control component**

In `src/components/FingeringPatternControls/FingeringPatternControls.tsx`:

Replace the top imports (lines 1-13) with (removes the `react` hooks, `CagedShape`, and adds nothing):

```tsx
import { motion } from "motion/react";
import clsx from "clsx";
import { CAGED_SHAPES, ANIMATION_DURATION_FAST } from "@fretflow/core";
import { useShapeState } from "../../hooks/useShapeState";
import type { FingeringPattern } from "../../store/fingeringAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { StringSetPicker } from "../shared/StringSetPicker";
import { GroupHeader, Prop } from "../Inspector/InspectorGrid";
import shared from "../shared/shared.module.css";
import styles from "./FingeringPatternControls.module.css";
```

Delete the module-level constants and the touch-detection (formerly lines 15-20):

```tsx
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

const isTouchPrimary =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
```

Change the `useShapeState()` destructure to drop `setCagedShapes` and `toggleCagedShape`:

```tsx
  const {
    fingeringPattern,
    setFingeringPattern,
    cagedShapes,
    selectSingleCagedShape,
    npsPosition,
    setNpsPosition,
    npsOctave,
    setNpsOctave,
    onShapeClick,
    onRecenter,
    oneStringIndex,
    setOneStringIndex,
    oneStringInterval,
    setOneStringInterval,
    twoStringsPair,
    setTwoStringsPair,
    twoStringsInterval,
    setTwoStringsInterval,
  } = useShapeState();
```

Delete the long-press scaffolding (formerly lines 60-74): the `shapeHelpId` `useId()` line, the `pressTimerRef`, `pressStartRef`, `longPressedShapeRef`, `pressingShape`/`setPressingShape` state, and the `cancelPress` callback.

Replace the entire `{fingeringPattern === "caged" && ( ... )}` block (formerly lines 107-209) with:

```tsx
      {fingeringPattern === "caged" && (
        <Prop label={t("controls.shape")} span={9}>
          <div
            className={styles.shapeToggleBar}
            role="group"
            aria-label={t("controls.shape")}
          >
            {CAGED_SHAPES.map((s) => {
              const isActive = cagedShapes.has(s);
              return (
                <motion.button
                  key={s}
                  type="button"
                  className={clsx(
                    shared["toggle-btn"],
                    styles.shapeToggleButton,
                    isActive && shared.active,
                  )}
                  aria-pressed={isActive}
                  onClick={() => {
                    onShapeClick?.(s);
                    onRecenter?.();
                    selectSingleCagedShape(s);
                  }}
                  whileTap={{ scale: 0.96 }}
                  animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={{ duration: ANIMATION_DURATION_FAST }}
                >
                  {s}
                </motion.button>
              );
            })}
          </div>
        </Prop>
      )}
```

- [ ] **Step 5: Delete the dead atom and CSS, and remove i18n strings**

In `src/store/fingeringAtoms.ts`, delete `toggleCagedShapeAtom` entirely (formerly lines 50-59):

```ts
export const toggleCagedShapeAtom = atom(null, (get, set, shape: CagedShape) => {
  const prev = get(cagedShapesAtom);
  const next = new Set(prev);
  if (next.has(shape)) {
    if (next.size > 1) next.delete(shape);
  } else {
    next.add(shape);
  }
  set(cagedShapesAtom, next);
});
```

In `src/components/FingeringPatternControls/FingeringPatternControls.module.css`, delete the `[data-pressing]` rule (formerly line 18 block):

```css
[data-pressing] {
```
(remove the full rule body).

In `src/i18n/en.ts` and `src/i18n/es.ts`, delete the `longPressToAdd`, `shiftClickToAdd`, `shapeHintTouch`, and `shapeHintPointer` entries from the `controls` block. In `src/i18n/types.ts`, delete the matching four type members (`longPressToAdd: string;`, `shiftClickToAdd: string;`, `shapeHintTouch: string;`, `shapeHintPointer: string;`).

- [ ] **Step 6: Confirm no dangling references**

Run:

```bash
grep -rn "toggleCagedShapeAtom\|longPressToAdd\|shiftClickToAdd\|shapeHintTouch\|shapeHintPointer\|setCagedShapes\|toggleCagedShape" src
```

Expected: no matches (outside this change). If any remain, remove them.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`
Expected: PASS — single-select test passes, no "All" button, no help-text test.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useShapeState.ts src/components/FingeringPatternControls/ src/store/fingeringAtoms.ts src/i18n/
git commit -m "feat(caged): single-select shape control; remove All, long-press, and shift-add"
```

---

## Task 3: StatusBar test + full verification + visual baselines

**Files:**
- Modify: `src/components/StatusBar/StatusBar.test.tsx` (lines 50-57)

- [ ] **Step 1: Update the StatusBar test**

In `src/components/StatusBar/StatusBar.test.tsx`, replace the `it("appends the active shapes for the CAGED pattern", ...)` block (lines 50-57) with:

```tsx
  it("shows the active shape for the CAGED pattern", () => {
    renderWithAtoms(<StatusBar />, [
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["E"])],
    ]);
    expect(screen.getByTestId("status-pattern")).toHaveTextContent("CAGED · E");
  });
```

- [ ] **Step 2: Run the StatusBar test**

Run: `pnpm exec vitest run src/components/StatusBar/StatusBar.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS. If any other test seeded a multi-shape set or asserted the "All" button / multi-letter label, update it to the single-shape model (seed `new Set(["E"])`, expect one shape). Do not weaken assertions about live behavior.

- [ ] **Step 4: Lint and build**

Run: `pnpm run lint`
Expected: 0 errors. Fix any unused-import / unused-var fallout from the removals (e.g. a now-unused `useAtom` import in `useShapeState.ts` if it became unused — verify and remove).

Run: `pnpm run build`
Expected: `tsc -b && vite build` succeeds with no type errors (the deleted i18n type members and atom must have no remaining references).

- [ ] **Step 5: Refresh visual baselines**

The default state changes from five regions to one, so committed visual snapshots that exercise the default CAGED state will differ.

Run: `pnpm run test:visual`
Expected: some snapshot diffs in the fretboard/overlay suites. Inspect the diffs to confirm they reflect only the intended single-shape change (one region instead of five; notes/connectors otherwise identical).

If the diffs are legitimate, update the darwin baselines:

Run: `pnpm run test:visual:update`

For the committed linux baselines, regenerate via the documented cross-platform path:

Run: `pnpm run test:visual:update:linux`

(If the linux/docker path is unavailable in this environment, note that the linux baselines must be regenerated in CI or a docker run before merge, and do not hand-edit PNGs.)

- [ ] **Step 6: Commit**

```bash
git add src/components/StatusBar/StatusBar.test.tsx e2e
git commit -m "test(caged): single-shape StatusBar label and refreshed visual baselines"
```

---

## Self-Review

**Spec coverage:**
- State → single `Set` with `{"E"}` default + collapse migration → Task 1. ✓
- Remove `toggleCagedShapeAtom` → Task 2 Step 5. ✓
- UI single-select; remove "All", shift-click, long-press, hint → Task 2 Steps 4-5. ✓
- Hook drops toggle/setCagedShapes → Task 2 Step 3. ✓
- Rendering unchanged (single neutral tint) → no task needed (verified Task 3 Step 3-4). ✓
- StatusBar single-letter → Task 3 Step 1. ✓
- i18n strings removed → Task 2 Step 5. ✓
- Whole-neck via Pattern=None → no work (documented). ✓
- Consumer verification (chordOverlay/voicingFallback/chordScope/topology/actions/scaleAtoms) → Task 3 Step 3-4 (full suite + build). ✓
- Visual baselines → Task 3 Step 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact code. ✓

**Type consistency:** `collapseToSingleShape(shapes: CagedShape[]): CagedShape` used identically in Task 1 helper, deserialize, and tests. `selectSingleCagedShape` / `cagedShapes` names match across hook and component. `cagedShapesAtom` remains `Set<CagedShape>` throughout. ✓
