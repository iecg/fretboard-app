# Progression Chord List — Single-Tab-Stop Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the progression chord list a single Tab stop that enters on the active row, with `←/→` navigating row-by-row (reusing the chord-nav atoms) while `↑/↓` tempo, `Alt+↑/↓` reorder, and pointer drag stay untouched.

**Architecture:** Apply roving `tabIndex` to the existing `StepSelectButton` rows (active=0, rest=-1) so the list is one Tab stop. A keydown handler on the `.scroll` container turns plain `←/→` into an `onNavigate(direction)` call (wired in `SongControls` to the same `previousProgressionStepAtom`/`advanceProgressionPlaybackAtom` actions as the global shortcut) and bumps a focus counter so a `useLayoutEffect` moves focus onto the active row after re-render. The global `←/→` handler bails when focus is already inside the list to avoid double-advance.

**Tech Stack:** React 19 + TypeScript, Jotai, motion `Reorder`, CSS Modules, Vitest + Testing Library (jsdom).

---

## Spec

See [`docs/superpowers/specs/2026-06-15-progression-listbox-keyboard-nav-design.md`](../specs/2026-06-15-progression-listbox-keyboard-nav-design.md).

## File structure

| File | Responsibility |
| --- | --- |
| `src/components/SongControls/ProgressionStepList.tsx` | Roving `tabIndex` on `StepSelectButton`; new required `onNavigate` prop; `onKeyDown` on `.scroll` for plain `←/→`; `useLayoutEffect` focusing the active row on keyboard nav. |
| `src/components/SongControls/ProgressionStepList.test.tsx` | Add `onNavigate` to existing renders; new tests for roving tabindex + in-list nav + focus follow. |
| `src/components/SongControls/SongControls.tsx` | Destructure `previousProgressionStep`/`advanceProgressionPlayback`; pass `onNavigate` guarded by play state. |
| `src/hooks/useKeyboardShortcuts.ts` | Early bail on plain `←/→` when focus is inside the chord list. |
| `src/hooks/useKeyboardShortcuts.test.tsx` | New test: `←/→` is a no-op when focus is inside the list. |

Verified during planning:
- `StepSelectButton` (the shared row body) is rendered in both the `Reorder.Group` (drag) and the plain `<ul>` (mobile) branches, so changing it covers both.
- `useProgressionState()` already returns `previousProgressionStep` and `advanceProgressionPlayback` (both `useSetAtom` of the same atoms the global shortcut uses).
- `SongControls` already imports `useAtomValue` (jotai) and `progressionPlayingAtom`.
- The `.scroll` container already has `id={PROGRESSION_STEP_LIST_ID}` and `tabIndex={-1}` (from #619).

---

## Task 1: Roving tabindex + `onNavigate` prop

Makes the list a single Tab stop entering at the active row. (Navigation behavior comes in Task 2.)

**Files:**
- Modify: `src/components/SongControls/ProgressionStepList.tsx`
- Test: `src/components/SongControls/ProgressionStepList.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `ProgressionStepList.test.tsx` (the file already defines `makeStep`, a `steps` array, and imports `vi`):

```tsx
describe("ProgressionStepList roving tabindex", () => {
  it("makes only the active row a tab stop (tabIndex 0), others -1", () => {
    render(
      <ProgressionStepList
        steps={steps}
        activeIndex={1}
        onSelect={() => {}}
        onReorder={vi.fn()}
        onNavigate={vi.fn()}
        label="Chords"
        caption="Steps"
      />,
    );
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveAttribute("tabindex", "-1");
    expect(rows[1]).toHaveAttribute("tabindex", "0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/SongControls/ProgressionStepList.test.tsx -t "roving tabindex"`
Expected: FAIL — buttons currently have no `tabindex` attribute (it is `null`), and `onNavigate` is not yet a prop (TypeScript error on the render).

- [ ] **Step 3: Add the `onNavigate` prop to the interface**

In `ProgressionStepList.tsx`, add to `ProgressionStepListProps` (right after the `onReorder` member):

```typescript
  /** Move the active step by one in the list (keyboard ←/→). Wired to the same
   * actions as the global chord-nav shortcut so behavior is identical. */
  onNavigate: (direction: -1 | 1) => void;
```

- [ ] **Step 4: Apply roving tabindex on the row button**

In `StepSelectButton`, add `tabIndex` to the `<button>` (right after the `ref={buttonRef}` line):

```tsx
      ref={buttonRef}
      tabIndex={active ? 0 : -1}
```

- [ ] **Step 5: Keep existing renders compiling**

`onNavigate` is now required. In `ProgressionStepList.test.tsx`, add `onNavigate={vi.fn()}` immediately after the existing `onReorder={vi.fn()}` in **every** `render(<ProgressionStepList … />)` call that does not already have it (including the "focus target" test added earlier and the a11y test). Each call already passes `onReorder={vi.fn()}`; mirror it.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/SongControls/ProgressionStepList.test.tsx`
Expected: PASS (all existing tests plus the new roving-tabindex test).

- [ ] **Step 7: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: errors only in `SongControls.tsx` (it does not pass `onNavigate` yet — fixed in Task 4). If you see errors elsewhere, fix them. It is acceptable to leave only the `SongControls.tsx` "missing onNavigate" error at this point.

- [ ] **Step 8: Commit**

```bash
git add src/components/SongControls/ProgressionStepList.tsx src/components/SongControls/ProgressionStepList.test.tsx
git commit -m "feat(progression): roving tabindex makes the chord list a single tab stop"
```

---

## Task 2: In-list `←/→` navigation + focus follow

**Files:**
- Modify: `src/components/SongControls/ProgressionStepList.tsx`
- Test: `src/components/SongControls/ProgressionStepList.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `ProgressionStepList.test.tsx`:

```tsx
describe("ProgressionStepList keyboard navigation", () => {
  function renderList(activeIndex: number, onNavigate = vi.fn()) {
    const utils = render(
      <ProgressionStepList
        steps={steps}
        activeIndex={activeIndex}
        onSelect={() => {}}
        onReorder={vi.fn()}
        onNavigate={onNavigate}
        label="Chords"
        caption="Steps"
      />,
    );
    return { ...utils, onNavigate };
  }

  it("calls onNavigate(+1) on plain ArrowRight", () => {
    const { onNavigate } = renderList(0);
    fireEvent.keyDown(screen.getAllByRole("button")[0], { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("calls onNavigate(-1) on plain ArrowLeft", () => {
    const { onNavigate } = renderList(1);
    fireEvent.keyDown(screen.getAllByRole("button")[1], { key: "ArrowLeft" });
    expect(onNavigate).toHaveBeenCalledWith(-1);
  });

  it("ignores ArrowRight with Alt (reorder shortcut passes through)", () => {
    const { onNavigate } = renderList(0);
    fireEvent.keyDown(screen.getAllByRole("button")[0], { key: "ArrowRight", altKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("ignores ArrowUp/ArrowDown (tempo keys pass through)", () => {
    const { onNavigate } = renderList(0);
    fireEvent.keyDown(screen.getAllByRole("button")[0], { key: "ArrowUp" });
    fireEvent.keyDown(screen.getAllByRole("button")[0], { key: "ArrowDown" });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("moves focus to the new active row after navigation re-renders", () => {
    const { rerender } = renderList(0);
    fireEvent.keyDown(screen.getAllByRole("button")[0], { key: "ArrowRight" });
    // Simulate the atom update that onNavigate would cause:
    rerender(
      <ProgressionStepList
        steps={steps}
        activeIndex={1}
        onSelect={() => {}}
        onReorder={vi.fn()}
        onNavigate={vi.fn()}
        label="Chords"
        caption="Steps"
      />,
    );
    expect(document.activeElement).toBe(screen.getAllByRole("button")[1]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/SongControls/ProgressionStepList.test.tsx -t "keyboard navigation"`
Expected: FAIL — no keydown handling yet (`onNavigate` never called; focus never moves).

- [ ] **Step 3: Add imports and the nav state/handlers**

In `ProgressionStepList.tsx`, change the React import to include `useLayoutEffect` and `useState`:

```typescript
import { useEffect, useLayoutEffect, useRef, useState } from "react";
```

Inside the `ProgressionStepList` component body, after the existing `const draggingRef = useRef(false);`, add the focus counter:

```typescript
  // Bumped on each in-list ←/→ keystroke so the active row takes focus after the
  // navigation re-renders. A counter (not a boolean) so it still fires when the
  // index clamps at an end — focusing the unchanged active row is harmless and
  // avoids a stale flag stealing focus on a later playback-driven change.
  const [navFocusTick, setNavFocusTick] = useState(0);

  useLayoutEffect(() => {
    if (navFocusTick === 0) return;
    activeRef.current?.focus({ preventScroll: true });
  }, [navFocusTick]);

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    onNavigate(event.key === "ArrowLeft" ? -1 : 1);
    setNavFocusTick((tick) => tick + 1);
  };
```

Add `onNavigate` to the destructured props in the function signature (it is already in the interface from Task 1):

```typescript
export function ProgressionStepList({ steps, activeIndex, onSelect, onReorder, onNavigate, label, caption, meta, enableDrag = true }: ProgressionStepListProps) {
```

- [ ] **Step 4: Attach the handler to the scroll container**

Change the `.scroll` div to add `onKeyDown` (keep the existing `id`/`tabIndex`):

```tsx
      <div className={styles.scroll} id={PROGRESSION_STEP_LIST_ID} tabIndex={-1} onKeyDown={handleListKeyDown}>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/SongControls/ProgressionStepList.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/SongControls/ProgressionStepList.tsx src/components/SongControls/ProgressionStepList.test.tsx
git commit -m "feat(progression): in-list left/right chord navigation with focus follow"
```

---

## Task 3: Global `←/→` bails when the list is focused

Prevents the window-level handler from double-advancing while the in-list handler owns navigation.

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts`
- Test: `src/hooks/useKeyboardShortcuts.test.tsx`

- [ ] **Step 1: Write the failing test**

In `useKeyboardShortcuts.test.tsx`, append inside the top-level `describe("useKeyboardShortcuts", …)` block:

```tsx
  it("ArrowRight does not advance the step when focus is inside the chord list", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 0);
    const list = document.createElement("div");
    list.id = PROGRESSION_STEP_LIST_ID;
    const row = document.createElement("button");
    list.appendChild(row);
    document.body.appendChild(list);
    row.focus();
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
    document.body.removeChild(list);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/hooks/useKeyboardShortcuts.test.tsx -t "focus is inside the chord list"`
Expected: FAIL — the global handler still advances the step to 1.

- [ ] **Step 3: Add the bail guard**

In `useKeyboardShortcuts.ts`, add a helper just below the existing `focusShortcutTarget` function:

```typescript
/** True when keyboard focus is currently inside the chord list — in which case
 * the list's own ←/→ handler owns navigation and the global one must stand down
 * (the window listener fires regardless of React's stopPropagation). */
function focusInsideChordList() {
  const list = document.getElementById(PROGRESSION_STEP_LIST_ID);
  return !!list && list.contains(document.activeElement);
}
```

Update the `ArrowLeft` and `ArrowRight` cases to bail when focus is inside the list. The cases currently start with `if (store.get(progressionPlayingAtom)) return;` — add the list check on the same guard line:

```typescript
        case "ArrowLeft":
          if (store.get(progressionPlayingAtom) || focusInsideChordList()) return;
          e.preventDefault();
          store.set(previousProgressionStepAtom);
          focusShortcutTarget(PROGRESSION_STEP_LIST_ID);
          break;
        case "ArrowRight":
          if (store.get(progressionPlayingAtom) || focusInsideChordList()) return;
          e.preventDefault();
          store.set(advanceProgressionPlaybackAtom);
          focusShortcutTarget(PROGRESSION_STEP_LIST_ID);
          break;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS (the new test plus all existing ones, including the #619 from-outside focus tests and the #618 `Alt+↑/↓` reorder tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/useKeyboardShortcuts.test.tsx
git commit -m "feat(shortcuts): global left/right stands down when the chord list is focused"
```

---

## Task 4: Wire `onNavigate` in SongControls + verification

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`

- [ ] **Step 1: Destructure the nav actions**

In `SongControls.tsx`, add `previousProgressionStep` and `advanceProgressionPlayback` to the object destructured from `useProgressionState()` (the block that already includes `reorderProgressionSteps` and `setActiveProgressionStepIndex`):

```typescript
    reorderProgressionSteps,
    previousProgressionStep,
    advanceProgressionPlayback,
```

- [ ] **Step 2: Read play state for the guard**

`SongControls` already imports `useAtomValue` and `progressionPlayingAtom`. Add, near the other derived values at the top of the component body (e.g. just after the `useProgressionState()` destructure):

```typescript
  const isProgressionPlaying = useAtomValue(progressionPlayingAtom);
```

(If `progressionPlayingAtom` is not already imported in this file, add it to the existing `../../store/progressionAtoms` import alongside `CUSTOM_PRESET_ID`.)

- [ ] **Step 3: Pass `onNavigate` to the list**

In the `<ProgressionStepList … />` usage, add the `onNavigate` prop next to `onReorder` — mirroring the global shortcut: do nothing while playing, otherwise step backward/forward via the same atoms:

```tsx
                  onReorder={(from, to) => reorderProgressionSteps({ from, to })}
                  onNavigate={(direction) => {
                    if (isProgressionPlaying) return;
                    if (direction < 0) previousProgressionStep();
                    else advanceProgressionPlayback();
                  }}
```

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.tsx
git commit -m "feat(song): wire chord-list keyboard navigation to the chord-nav atoms"
```

- [ ] **Step 6: Full verification**

Run each and confirm:
- `pnpm run lint` → 0 errors (a single pre-existing `react-hooks/exhaustive-deps` warning in `packages/fretboard/src/hooks/useFretboardTopologyModel.ts` is expected and unrelated); fretboard boundaries OK.
- `pnpm run ui:tokens` → no **new** undefined tokens (this change adds no `var(--x)` references).
- `pnpm run test` → all pass.
- `pnpm run build` → `tsc -b` + `vite build` succeed.

- [ ] **Step 7: Manual smoke (dev server)**

`pnpm run dev`, open the Song tab:
- Tab into the chord list — focus lands on the **active** row (not always the first); Tab again leaves the list entirely.
- With a row focused, `←/→` move chord-by-chord and focus follows the active row; at the ends it clamps (no wrap) just like the global shortcut.
- `↑/↓` still change tempo and `Alt+↑/↓` still reorder the active step while the list is focused.
- Mouse click still selects a row; pointer drag (grip handle) still reorders.
- From outside the list, the first `←/→` still rings the whole list (container) and advances.

---

## Self-review notes

- **Spec coverage:** single Tab stop entering at active row (Task 1); in-list `←/→` reusing the nav atoms + focus follow (Tasks 2, 4); `↑/↓`/`Alt+↑/↓`/drag untouched (handler ignores modifiers and non-`←/→` keys — Task 2; nothing else changed); no double-advance (Task 3); from-outside global behavior preserved (Task 3 leaves the non-focused path intact). All covered.
- **Type/name consistency:** `onNavigate: (direction: -1 | 1) => void` defined in Task 1, consumed in Task 2, supplied in Task 4; `navFocusTick`/`handleListKeyDown`/`focusInsideChordList` each defined and used in one place; `PROGRESSION_STEP_LIST_ID` reused from the existing import in both the component and the hook.
- **Why a counter, not a boolean flag:** at a clamped end, `onNavigate` may not change `activeIndex`, so an effect keyed on `activeIndex` would not run and a boolean "pending focus" flag could later fire on an unrelated (playback) index change and steal focus. The `navFocusTick` state changes on every keystroke, so the focus effect runs every time and only ever targets the current active row.
- **jsdom note:** `:focus-visible` is not evaluated in unit tests; tests assert `document.activeElement` and `tabindex` attributes. The visible ring is covered by the manual smoke step.
