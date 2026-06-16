# Progression Editor Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users reorder progression steps by dragging a per-row handle, and reorder the active step from the keyboard with `Alt+←` / `Alt+→`.

**Architecture:** A new `reorderProgressionStepsAtom({from,to})` becomes the single source of truth for reordering; the existing adjacent-swap `moveProgressionStepAtom` delegates to it. The chord list (`ProgressionStepList`) renders via `motion`'s `Reorder.Group`/`Reorder.Item` with a handle-only drag (`dragListener={false}` + `useDragControls`), so tap/click still selects a step. The global keyboard handler gains an `Alt+Arrow` branch that reorders the active step. No new dependency — `motion` is already used across the app.

**Tech Stack:** React 19, TypeScript, Jotai, `motion/react` (Reorder), `lucide-react` (GripVertical icon), Vitest + Testing Library, `vitest-axe`.

**Reference spec:** `docs/superpowers/specs/2026-06-15-progression-editor-drag-and-drop-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `packages/fretboard/src/store/progressionAtoms.ts` | Reorder action + delegating swap | Modify |
| `packages/fretboard/src/store/progressionAtoms.test.ts` | Atom unit tests | Modify |
| `packages/fretboard/src/hooks/useProgressionState.ts` | Expose `reorderProgressionSteps` | Modify |
| `src/hooks/useKeyboardShortcuts.ts` | `Alt+←/→` reorder active step | Modify |
| `src/hooks/useKeyboardShortcuts.test.tsx` | Keyboard reorder + no-regression tests | Modify |
| `src/components/SongControls/ProgressionStepList.tsx` | Drag UI + `singleMoveDiff` helper | Modify (near-rewrite) |
| `src/components/SongControls/ProgressionStepList.test.tsx` | Helper + render/select/a11y tests | Modify |
| `src/components/SongControls/ProgressionStepList.module.css` | Handle + item layout styles | Modify |
| `src/components/SongControls/SongControls.tsx` | Wire `onReorder` | Modify |

The drag handle is `aria-hidden` (pointer-only): the accessible reorder paths are the existing toolbar Move Up/Down buttons and the new global `Alt+Arrow` shortcut, so no screen-reader-facing handle label / i18n key is needed. This is a deliberate refinement of the spec's "labeled handle" note — a focusable control that does nothing for keyboard users would be worse a11y than hiding the purely-visual grip.

---

## Task 1: Reorder atom + delegate the adjacent swap

**Files:**
- Modify: `packages/fretboard/src/store/progressionAtoms.ts:561-572` (`moveProgressionStepAtom`)
- Test: `packages/fretboard/src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/fretboard/src/store/progressionAtoms.test.ts`. First add `reorderProgressionStepsAtom` to the existing import block (the one that already imports `moveProgressionStepAtom`, `loadedPresetIdAtom`, `activeProgressionStepIndexAtom`, `progressionStepsAtom`):

```ts
import {
  // ...existing imports...
  reorderProgressionStepsAtom,
} from "./progressionAtoms";
```

Then append this `describe` block at the end of the file:

```ts
describe("reorderProgressionStepsAtom", () => {
  const seed = () => [
    { id: "a", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
    { id: "b", degree: "V", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
    { id: "c", degree: "vi", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
  ];

  it("moves a step to a non-adjacent index and follows it with the active cursor", () => {
    const store = createStore();
    store.set(progressionStepsAtom, seed());
    store.set(loadedPresetIdAtom, "some-preset");

    store.set(reorderProgressionStepsAtom, { from: 0, to: 2 });

    expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
    expect(store.get(loadedPresetIdAtom)).toBeNull();
  });

  it("is a no-op for equal or out-of-range indices", () => {
    const store = createStore();
    store.set(progressionStepsAtom, seed());

    store.set(reorderProgressionStepsAtom, { from: 1, to: 1 });
    store.set(reorderProgressionStepsAtom, { from: 0, to: 5 });
    store.set(reorderProgressionStepsAtom, { from: -1, to: 0 });

    expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("moveProgressionStepAtom still swaps adjacent steps via delegation", () => {
    const store = createStore();
    store.set(progressionStepsAtom, seed());

    store.set(moveProgressionStepAtom, { id: "c", direction: -1 });

    expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/fretboard/src/store/progressionAtoms.test.ts -t "reorderProgressionStepsAtom"`
Expected: FAIL — `reorderProgressionStepsAtom` is not exported (import error / undefined).

- [ ] **Step 3: Add the reorder atom and make move delegate**

In `packages/fretboard/src/store/progressionAtoms.ts`, replace the current `moveProgressionStepAtom` block (lines 561-572):

```ts
export const moveProgressionStepAtom = atom(null, (get, set, update: { id: string; direction: -1 | 1 }) => {
  const steps = get(progressionStepsAtom);
  const from = steps.findIndex((step) => step.id === update.id);
  const to = from + update.direction;
  if (from === -1 || to < 0 || to >= steps.length) return;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  set(loadedPresetIdAtom, null);
  set(progressionStepsAtom, next);
  set(activeProgressionStepIndexAtom, to);
});
```

with:

```ts
/** Move a step from one index to another (drag-and-drop / keyboard reorder).
 *  Single source of truth for reordering: clears the loaded-preset marker (the
 *  sequence no longer matches a stored preset) and lets the active cursor follow
 *  the moved step. No-op for equal or out-of-range indices. */
export const reorderProgressionStepsAtom = atom(null, (get, set, update: { from: number; to: number }) => {
  const steps = get(progressionStepsAtom);
  const { from, to } = update;
  if (from === to || from < 0 || from >= steps.length || to < 0 || to >= steps.length) return;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  set(loadedPresetIdAtom, null);
  set(progressionStepsAtom, next);
  set(activeProgressionStepIndexAtom, to);
});

export const moveProgressionStepAtom = atom(null, (get, set, update: { id: string; direction: -1 | 1 }) => {
  const from = get(progressionStepsAtom).findIndex((step) => step.id === update.id);
  if (from === -1) return;
  set(reorderProgressionStepsAtom, { from, to: from + update.direction });
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/fretboard/src/store/progressionAtoms.test.ts`
Expected: PASS (new block + all existing progression atom tests, including the existing "adds, removes, and moves steps" test).

- [ ] **Step 5: Commit**

```bash
git add packages/fretboard/src/store/progressionAtoms.ts packages/fretboard/src/store/progressionAtoms.test.ts
git commit -m "feat(progressions): add reorderProgressionStepsAtom, delegate move to it"
```

---

## Task 2: Expose `reorderProgressionSteps` from the state hook

**Files:**
- Modify: `packages/fretboard/src/hooks/useProgressionState.ts:2` (import line) and `:65` (return object)

- [ ] **Step 1: Add the import**

In `packages/fretboard/src/hooks/useProgressionState.ts`, add `reorderProgressionStepsAtom` to the single large import from `../store/progressionAtoms` (alphabetical neighbors are `removeProgressionStepAtom` / `resolvedProgressionStepsAtom`):

```ts
import { /* ...existing... */ removeProgressionStepAtom, reorderProgressionStepsAtom, resolvedProgressionStepsAtom, /* ...existing... */ } from "../store/progressionAtoms";
```

- [ ] **Step 2: Expose the setter**

In the returned object, directly after the `moveProgressionStep:` line (currently `useProgressionState.ts:65`):

```ts
    moveProgressionStep: useSetAtom(moveProgressionStepAtom),
    reorderProgressionSteps: useSetAtom(reorderProgressionStepsAtom),
```

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm exec tsc -b --pretty false`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/fretboard/src/hooks/useProgressionState.ts
git commit -m "feat(progressions): expose reorderProgressionSteps from useProgressionState"
```

---

## Task 3: Global `Alt+←` / `Alt+→` reorders the active step

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts:5-17` (imports) and `:38` (insert branch before the modifier early-return)
- Test: `src/hooks/useKeyboardShortcuts.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/hooks/useKeyboardShortcuts.test.tsx`, add `progressionStepsAtom` to the existing import from `../store/progressionAtoms` (it already imports `activeProgressionStepIndexAtom`):

```ts
import {
  // ...existing...
  progressionStepsAtom,
} from "../store/progressionAtoms";
```

Add a seed helper near the top of the file (after `makeWrapper`) and four tests inside the `describe("useKeyboardShortcuts", ...)` block:

```ts
const threeSteps = () => [
  { id: "a", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
  { id: "b", degree: "V", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
  { id: "c", degree: "vi", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
];

it("Alt+ArrowRight moves the active step later", () => {
  store.set(progressionStepsAtom, threeSteps());
  store.set(activeProgressionStepIndexAtom, 0);
  renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

  act(() => { fireEvent.keyDown(document, { key: "ArrowRight", altKey: true }); });

  expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["b", "a", "c"]);
  expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
});

it("Alt+ArrowLeft moves the active step earlier", () => {
  store.set(progressionStepsAtom, threeSteps());
  store.set(activeProgressionStepIndexAtom, 2);
  renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

  act(() => { fireEvent.keyDown(document, { key: "ArrowLeft", altKey: true }); });

  expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["a", "c", "b"]);
  expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
});

it("Alt+ArrowLeft is a no-op at the first step", () => {
  store.set(progressionStepsAtom, threeSteps());
  store.set(activeProgressionStepIndexAtom, 0);
  renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

  act(() => { fireEvent.keyDown(document, { key: "ArrowLeft", altKey: true }); });

  expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["a", "b", "c"]);
});

it("plain ArrowUp still changes tempo and is not swallowed by the reorder branch", () => {
  store.set(progressionStepsAtom, threeSteps());
  const before = store.get(progressionTempoBpmAtom);
  renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

  act(() => { fireEvent.keyDown(document, { key: "ArrowUp" }); });

  expect(store.get(progressionTempoBpmAtom)).toBe(before + 5);
});
```

Add `progressionTempoBpmAtom` to the same import if not already present.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/hooks/useKeyboardShortcuts.test.tsx -t "Alt+Arrow"`
Expected: FAIL — Alt+Arrow currently hits the `if (e.metaKey || e.ctrlKey || e.altKey) return;` guard and does nothing, so the order is unchanged.

- [ ] **Step 3: Add the imports**

In `src/hooks/useKeyboardShortcuts.ts`, extend the import from `../store/progressionAtoms` (lines 5-17) with three atoms:

```ts
import {
  progressionPlayingAtom,
  setProgressionPlayingAtom,
  stopProgressionPlaybackAtom,
  progressionLoopEnabledAtom,
  progressionChordEnabledAtom,
  progressionBassEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionMetronomeEnabledAtom,
  previousProgressionStepAtom,
  advanceProgressionPlaybackAtom,
  progressionTempoBpmAtom,
  progressionStepsAtom,
  activeProgressionStepIndexAtom,
  reorderProgressionStepsAtom,
} from "../store/progressionAtoms";
```

- [ ] **Step 4: Insert the reorder branch before the modifier early-return**

In `src/hooks/useKeyboardShortcuts.ts`, the handler currently reads (lines 30-38):

```ts
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
```

Insert the `Alt+Arrow` branch between the focus guard and the modifier early-return (i.e. immediately before `if (e.metaKey || e.ctrlKey || e.altKey) return;`):

```ts
      // Alt+Arrow reorders the active step within the sequence (Option+Arrow on
      // macOS — no default browser/OS binding outside text inputs). Runs before
      // the modifier early-return below, which otherwise drops all alt combos.
      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const steps = store.get(progressionStepsAtom);
        const from = store.get(activeProgressionStepIndexAtom);
        const to = from + (e.key === "ArrowLeft" ? -1 : 1);
        if (from >= 0 && from < steps.length && to >= 0 && to < steps.length) {
          e.preventDefault();
          store.set(reorderProgressionStepsAtom, { from, to });
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS — new Alt+Arrow tests plus all existing keyboard tests (tempo, step nav, toggles) stay green.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/useKeyboardShortcuts.test.tsx
git commit -m "feat(progressions): Alt+Left/Right reorders the active progression step"
```

---

## Task 4: `singleMoveDiff` helper (Reorder → {from,to})

**Files:**
- Modify: `src/components/SongControls/ProgressionStepList.tsx` (add + export the helper)
- Test: `src/components/SongControls/ProgressionStepList.test.tsx`

This pure helper is the unit-testable core of the drag wiring (motion's `Reorder.Group` hands us a full reordered id array; we collapse it to a single `{from,to}` move). Real pointer drag is not simulable in jsdom, so this helper plus the Task 1 atom test are what cover the reorder logic.

- [ ] **Step 1: Write the failing tests**

In `src/components/SongControls/ProgressionStepList.test.tsx`, add to the imports:

```ts
import { ProgressionStepList, singleMoveDiff } from "./ProgressionStepList";
```

Add this `describe` block:

```ts
describe("singleMoveDiff", () => {
  it("detects an element moved later (down the list)", () => {
    expect(singleMoveDiff(["a", "b", "c"], ["b", "a", "c"])).toEqual({ from: 0, to: 1 });
    expect(singleMoveDiff(["a", "b", "c"], ["b", "c", "a"])).toEqual({ from: 0, to: 2 });
  });

  it("detects an element moved earlier (up the list)", () => {
    expect(singleMoveDiff(["a", "b", "c"], ["c", "a", "b"])).toEqual({ from: 2, to: 0 });
    expect(singleMoveDiff(["a", "b", "c"], ["a", "c", "b"])).toEqual({ from: 2, to: 1 });
  });

  it("returns null for an unchanged or mismatched order", () => {
    expect(singleMoveDiff(["a", "b", "c"], ["a", "b", "c"])).toBeNull();
    expect(singleMoveDiff(["a", "b"], ["a", "b", "c"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/components/SongControls/ProgressionStepList.test.tsx -t "singleMoveDiff"`
Expected: FAIL — `singleMoveDiff` is not exported.

- [ ] **Step 3: Add and export the helper**

Add to `src/components/SongControls/ProgressionStepList.tsx` (full new file content is given in Task 5 Step 3; this step is satisfied by that rewrite). For incremental TDD, add just this exported function now near the top of the file, below the imports:

```ts
/**
 * Collapse a full reordered id array (as handed back by motion's Reorder.Group)
 * into the single `{ from, to }` move it represents. Returns null when the arrays
 * are identical or differ by more than one contiguous move.
 */
export function singleMoveDiff(prev: string[], next: string[]): { from: number; to: number } | null {
  if (prev.length !== next.length) return null;
  let lo = 0;
  while (lo < prev.length && prev[lo] === next[lo]) lo++;
  let hi = prev.length - 1;
  while (hi >= 0 && prev[hi] === next[hi]) hi--;
  if (lo > hi) return null;
  if (next[hi] === prev[lo]) return { from: lo, to: hi };
  if (next[lo] === prev[hi]) return { from: hi, to: lo };
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/SongControls/ProgressionStepList.test.tsx -t "singleMoveDiff"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/ProgressionStepList.tsx src/components/SongControls/ProgressionStepList.test.tsx
git commit -m "feat(progressions): add singleMoveDiff reorder helper"
```

---

## Task 5: Drag UI in `ProgressionStepList`

**Files:**
- Modify: `src/components/SongControls/ProgressionStepList.tsx` (rewrite)
- Modify: `src/components/SongControls/ProgressionStepList.module.css`
- Test: `src/components/SongControls/ProgressionStepList.test.tsx`

`onReorder` becomes a **required** prop and the list renders through `Reorder.Group`/`Reorder.Item`. Each row keeps a single `<button>` (the select target, unchanged a11y label); the drag handle is an `aria-hidden` sibling `<span>` that starts the drag via `useDragControls`. Because the handle is a span (not a button), `getAllByRole("button")` still returns exactly one button per row, so the existing select test keeps working.

- [ ] **Step 1: Update existing tests for the required `onReorder` prop and add render/select/a11y tests**

In `src/components/SongControls/ProgressionStepList.test.tsx`, every existing `render(<ProgressionStepList ... />)` call must now pass `onReorder`. Add `onReorder={vi.fn()}` to each existing render. Then add these tests:

```ts
it("still calls onSelect with the row index when the row button is clicked", () => {
  const onSelect = vi.fn();
  render(
    <ProgressionStepList
      steps={steps}
      activeIndex={0}
      onSelect={onSelect}
      onReorder={vi.fn()}
      label="Chords"
      caption="Steps"
    />,
  );
  fireEvent.click(screen.getAllByRole("button")[1]);
  expect(onSelect).toHaveBeenCalledWith(1);
});

it("renders a drag handle per row without an accessibility violation", async () => {
  const { container } = render(
    <ProgressionStepList
      steps={steps}
      activeIndex={0}
      onSelect={vi.fn()}
      onReorder={vi.fn()}
      label="Chords"
      caption="Steps"
    />,
  );
  // One button per row (the select target); handles are aria-hidden spans.
  expect(screen.getAllByRole("button")).toHaveLength(steps.length);
  expect(await axe(container)).toHaveNoViolations();
});
```

- [ ] **Step 2: Run the tests to verify the current state**

Run: `pnpm vitest run src/components/SongControls/ProgressionStepList.test.tsx`
Expected: FAIL — TypeScript flags the missing required `onReorder` and/or the new tests fail because the handle/Reorder markup does not exist yet.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/components/SongControls/ProgressionStepList.tsx` with:

```tsx
import { useEffect, useRef } from "react";
import type { Ref } from "react";
import clsx from "clsx";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical } from "lucide-react";
import {
  formatProgressionDurationLabel,
  type ResolvedProgressionStep,
} from "../../progressions/progressionDomain";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ProgressionStepList.module.css";

interface ProgressionStepListProps {
  steps: ResolvedProgressionStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Reorder a step from one index to another (pointer drag). */
  onReorder: (from: number, to: number) => void;
  /** Accessible label for the list container. */
  label: string;
  /** Visible mono caption above the list (e.g. "Steps"). */
  caption: string;
  /** Right-aligned summary in the caption row (e.g. "9 chords · 10 bars"). */
  meta?: string;
}

/**
 * Collapse a full reordered id array (as handed back by motion's Reorder.Group)
 * into the single `{ from, to }` move it represents. Returns null when the arrays
 * are identical or differ by more than one contiguous move.
 */
export function singleMoveDiff(prev: string[], next: string[]): { from: number; to: number } | null {
  if (prev.length !== next.length) return null;
  let lo = 0;
  while (lo < prev.length && prev[lo] === next[lo]) lo++;
  let hi = prev.length - 1;
  while (hi >= 0 && prev[hi] === next[hi]) hi--;
  if (lo > hi) return null;
  if (next[hi] === prev[lo]) return { from: lo, to: hi };
  if (next[lo] === prev[hi]) return { from: hi, to: lo };
  return null;
}

interface StepRowProps {
  step: ResolvedProgressionStep;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  onDragActive: (dragging: boolean) => void;
}

/**
 * One chord row inside the Reorder.Group. Drag is handle-only
 * (`dragListener={false}` + `useDragControls`) so a tap/click on the row button
 * still selects the step — critical on touch. The grip handle is a sibling span
 * (not nested in the button) and `aria-hidden`: the keyboard reorder path lives
 * in the global Alt+Arrow shortcut and the toolbar Move buttons.
 */
function StepRow({ step, index, active, onSelect, buttonRef, onDragActive }: StepRowProps) {
  const { t } = useTranslation();
  const controls = useDragControls();
  const name = step.resolvedChordLabel ?? t("controls.chordUnavailable");
  const duration = formatProgressionDurationLabel(step.duration);
  return (
    <Reorder.Item
      value={step.id}
      as="li"
      className={styles.item}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => onDragActive(true)}
      onDragEnd={() => onDragActive(false)}
      whileDrag={{ scale: 1.015 }}
    >
      <button
        type="button"
        ref={buttonRef}
        className={clsx(styles.row, { [styles.active]: active })}
        aria-current={active ? "true" : undefined}
        data-unavailable={step.unavailable || undefined}
        aria-label={`${t("controls.chordPositionLabel")} ${index + 1}, ${step.degree}, ${name}, ${duration}${active ? `, ${t("controls.chordSelected")}` : ""}`}
        onClick={() => onSelect(index)}
      >
        <span className={styles.index} aria-hidden="true">{index + 1}</span>
        <span className={styles.chip} aria-hidden="true">{step.degree}</span>
        <span className={styles.name} aria-hidden="true">{name}</span>
        <span className={styles.duration} aria-hidden="true">{duration}</span>
      </button>
      <span
        className={styles.handle}
        aria-hidden="true"
        onPointerDown={(event) => controls.start(event)}
      >
        <GripVertical size={14} />
      </span>
    </Reorder.Item>
  );
}

/**
 * The master pane of the progression editor: a vertical, scrollable list of
 * chords rendered as a "quiet index". Each row is a flat select button with an
 * index, a Roman-numeral chip, the compact chord name, and its duration, plus a
 * grab handle for drag-to-reorder. The active row carries a cyan left-tick +
 * tint. Top/bottom fade hints appear only when the list overflows.
 */
export function ProgressionStepList({ steps, activeIndex, onSelect, onReorder, label, caption, meta }: ProgressionStepListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);

  // Keep the active row visible *within the list's own scrollport* only. Skip
  // while a drag is in flight — the reorder action retargets the active index on
  // every tick, and auto-scrolling mid-drag would fight the pointer.
  useEffect(() => {
    if (draggingRef.current) return;
    const listEl = listRef.current;
    const rowEl = activeRef.current;
    if (!listEl || !rowEl) return;
    const lr = listEl.getBoundingClientRect();
    const rr = rowEl.getBoundingClientRect();
    if (rr.top < lr.top) listEl.scrollTop -= lr.top - rr.top;
    else if (rr.bottom > lr.bottom) listEl.scrollTop += rr.bottom - lr.bottom;
  }, [activeIndex]);

  const ids = steps.map((step) => step.id);
  const handleReorder = (nextIds: string[]) => {
    const move = singleMoveDiff(ids, nextIds);
    if (move) onReorder(move.from, move.to);
  };

  return (
    <div className={styles.col}>
      <div className={styles.caption}>
        <span className={styles.captionTitle}>{caption}</span>
        {meta ? <span className={styles.captionMeta}>{meta}</span> : null}
      </div>
      <div className={styles.scroll}>
        <Reorder.Group
          as="ul"
          axis="y"
          values={ids}
          onReorder={handleReorder}
          className={styles.list}
          aria-label={label}
          ref={listRef}
        >
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              active={index === activeIndex}
              onSelect={onSelect}
              buttonRef={index === activeIndex ? activeRef : undefined}
              onDragActive={(dragging) => {
                draggingRef.current = dragging;
              }}
            />
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the handle + item styles**

In `src/components/SongControls/ProgressionStepList.module.css`:

(a) Change `.row` (currently `width: 100%`) so it shares the row with the handle. Replace the line `  width: 100%;` (inside the `.row` block, line 143) with:

```css
  flex: 1 1 auto;
  min-width: 0;
```

(b) Add these rules immediately after the `.row` block (after line 153):

```css
/* Reorder.Item wrapper: lays the select button beside its drag handle. */
.item {
  display: flex;
  align-items: stretch;
  gap: 0.15rem;
  list-style: none;
}

/* Drag handle — pointer-only affordance. It is aria-hidden because the keyboard
   reorder path lives in the global Alt+Arrow shortcut + toolbar Move buttons, so
   a focusable handle would add a control that does nothing for AT users.
   `touch-action: none` lets a touch drag move the row instead of scrolling. */
.handle {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  border-radius: 6px;
  color: var(--dc-fg-faint, var(--dc-fg-muted));
  cursor: grab;
  touch-action: none;
  opacity: 0.55;
  transition: var(--dc-transition);
}

.handle:hover {
  opacity: 1;
  background-color: var(--dc-bg-hover);
}

.handle:active {
  cursor: grabbing;
}
```

(c) Add a sheet touch-target guard for the handle next to the existing `.row` sheet rule (after line 287):

```css
:global([data-placement="sheet"]) .handle {
  min-height: var(--size-touch-target);
}
```

- [ ] **Step 5: Run the component tests**

Run: `pnpm vitest run src/components/SongControls/ProgressionStepList.test.tsx`
Expected: PASS — `singleMoveDiff` block, the select-still-works test, the handle/axe test, and all pre-existing tests (now passing `onReorder`).

> If `Reorder.Group`/`Reorder.Item` throws in jsdom (it should not — motion renders structure inertly without a layout engine), fall back to rendering the `ul`/`li` directly only when a `data-testid`-gated test environment flag is set. Do **not** add this unless a real failure appears; it is a contingency, not part of the happy path.

- [ ] **Step 6: Commit**

```bash
git add src/components/SongControls/ProgressionStepList.tsx src/components/SongControls/ProgressionStepList.module.css src/components/SongControls/ProgressionStepList.test.tsx
git commit -m "feat(progressions): drag-to-reorder chord rows via motion Reorder + handle"
```

---

## Task 6: Wire `onReorder` in `SongControls`

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx:390-397` (the `<ProgressionStepList>` usage) and the `useProgressionState()` destructure near the top of the component.

- [ ] **Step 1: Destructure the new setter**

In `src/components/SongControls/SongControls.tsx`, find where `moveProgressionStep` is pulled from `useProgressionState()` and add `reorderProgressionSteps` alongside it. For example:

```ts
  const {
    // ...existing...
    moveProgressionStep,
    reorderProgressionSteps,
    // ...existing...
  } = useProgressionState();
```

(If the hook result is accessed as a single object rather than destructured, instead reference `progression.reorderProgressionSteps` at the call site below — match the file's existing access pattern.)

- [ ] **Step 2: Pass `onReorder` to the list**

Update the `<ProgressionStepList>` usage (currently lines 390-397) to add the `onReorder` prop:

```tsx
                <ProgressionStepList
                  steps={resolvedProgressionSteps}
                  activeIndex={activeProgressionStepIndex}
                  onSelect={setActiveProgressionStepIndex}
                  onReorder={(from, to) => reorderProgressionSteps({ from, to })}
                  label={t("controls.progressionNavigation")}
                  caption={t("controls.stepsLabel")}
                  meta={listMeta}
                />
```

- [ ] **Step 3: Run the SongControls suite and type-check**

Run: `pnpm vitest run src/components/SongControls/SongControls.test.tsx && pnpm exec tsc -b --pretty false`
Expected: PASS / no type errors. (The existing "adds, removes, and reorders steps" integration test still passes — the toolbar Move buttons are unchanged.)

- [ ] **Step 4: Commit**

```bash
git add src/components/SongControls/SongControls.tsx
git commit -m "feat(progressions): wire ProgressionStepList drag reorder to the store"
```

---

## Task 7: Full verification + manual drag check

**Files:** none (verification only)

- [ ] **Step 1: Lint, test, build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass. Note: `lint` includes `scripts/check-fretboard-boundaries.mjs`; the package change (Task 1/2) only touches `packages/fretboard/src/store` and `hooks`, importing nothing from `src/`, so the boundary check stays green.

- [ ] **Step 2: Manual drag verification**

Run the app (`pnpm run dev`) or use the `/verify` skill. In the Song tab's progression editor:
- Drag a chord row by its grip handle to a new position; confirm the order updates, the dragged step stays selected, and audio playback (if playing) keeps going without a transport crash.
- Click a row body (not the handle) — confirm it still just selects.
- On a focused editor (not in a text field), press `Alt+→` / `Alt+←` — confirm the active step moves later/earlier and the cursor follows; press plain `↑/↓` — confirm tempo still changes.

- [ ] **Step 3: Refresh visual snapshots if the handle changed committed shots**

The trailing grip handle changes the chord-row appearance. If the visual suite reports diffs for the progression editor:

Run: `pnpm run test:visual:update` (darwin) and, for CI parity, `pnpm run test:visual:update:linux`
Then commit the regenerated snapshots:

```bash
git add e2e/**/*-snapshots/**
git commit -m "test(visual): refresh progression editor snapshots for drag handle"
```

- [ ] **Step 4: Final commit (if any uncommitted verification fixups)**

```bash
git status   # confirm clean or commit remaining changes
```

---

## Self-Review Notes

- **Spec coverage:** drag (Task 5) · handle-only / no select conflict (Task 5) · `Alt+←/→` keyboard reorder of active step (Task 3) · `reorderProgressionStepsAtom` + move delegation (Task 1) · hook exposure (Task 2) · SongControls wiring (Task 6) · drop semantics = active-follows + clear preset (Task 1 atom) · platforms/touch (`touch-action: none`, Task 5) · testing (Tasks 1/3/4/5) · risks: drag-during-playback (Task 7 manual) and scroll-vs-drag (`draggingRef` guard, Task 5).
- **Deliberate spec deviation:** the handle is `aria-hidden` (pointer-only) rather than a labeled focusable control, because the accessible reorder paths are the toolbar buttons + global `Alt+Arrow`. No new i18n key is therefore required.
- **Type consistency:** `reorderProgressionStepsAtom` takes `{ from: number; to: number }` everywhere (atom, hook, keyboard handler, SongControls maps `(from,to)` → `{from,to}`). `singleMoveDiff` returns `{ from, to } | null`. `onReorder` is `(from: number, to: number) => void` at the component boundary.
