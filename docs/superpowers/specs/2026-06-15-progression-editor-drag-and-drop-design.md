# Progression Editor — Drag-and-Drop Reordering

**Date:** 2026-06-15
**Status:** Approved design — ready for implementation plan

## Summary

Add drag-and-drop reordering to the chord list in the progression editor
(`ProgressionStepList`), plus a first-class keyboard reorder shortcut. Reordering
today is only possible through the toolbar Move Up / Move Down buttons, which do
single adjacent swaps. This feature lets users drag a step to any position and
reorder the active step with `Alt+↑ / Alt+↓`, consistent with the app's existing
global keyboard model.

Built on `motion` (already a dependency, v^12.40) via `Reorder.Group` /
`Reorder.Item` — **no new package**.

## Goals

- Drag any chord step to any position in the list (pointer + touch).
- Keyboard reordering of the active step via `Alt+ArrowUp` / `Alt+ArrowDown`,
  added to the existing global keyboard handler.
- Preserve all existing behavior: tap/click selects a step, Move Up/Down toolbar
  buttons remain, and the current global shortcuts (`↑/↓` tempo, `←/→` step nav)
  are untouched.
- No accessibility regression (drag handle is labeled; keyboard path is real).

## Non-Goals

- No screen-reader live-region drag announcements (would require `@dnd-kit`); the
  keyboard shortcut + toolbar buttons are the accessible reorder path.
- No multi-select drag, no drag between different progressions.
- No new Playwright coverage in this change (jsdom can't simulate pointer drag);
  real drag UX can get a follow-up visual/e2e test.

## Behavior Specification

### Drag affordance
- Each row gains a **dedicated grip handle** (vertical-grip icon) on its leading or
  trailing edge.
- Drag starts **only from the handle** — `Reorder.Item` is configured with
  `dragListener={false}` and a `useDragControls()` instance whose `.start(event)`
  is fired from the handle's `onPointerDown`. This guarantees tap/click on the rest
  of the row still selects the step (critical on touch).
- The handle is `aria-hidden` (pointer-only) with `cursor: grab`. A focusable,
  labeled handle was deliberately rejected: it would expose an AT control that
  does nothing, since the accessible reorder paths are the global `Alt+↑/↓`
  shortcut and the toolbar Move Up/Down buttons (see Non-Goals).

### Drop semantics
On drop (and on every keyboard reorder), the editor matches the existing
`moveProgressionStepAtom` semantics:
1. Reorder `progressionStepsAtom` to the new order.
2. Set `activeProgressionStepIndexAtom` to the dragged step's new index (focus/active
   follows the step).
3. Clear `loadedPresetIdAtom` (the progression no longer matches a stored preset).

### Keyboard behavior (global)

The app uses a single global `keydown` listener (`src/hooks/useKeyboardShortcuts.ts`)
that acts on the **active step**, not on DOM-focused rows — the progression list has
no roving focus; rows are plain Tab stops. The listener skips when focus is in an
`INPUT` / `TEXTAREA` / `SELECT` / `contentEditable`, and currently early-returns when
`metaKey || ctrlKey || altKey` is held. Existing arrow bindings are unchanged:

- **↑ / ↓** — tempo ±5 BPM (unchanged).
- **← / →** — previous / next step when not playing (unchanged).

New bindings added to the same handler (handled **before** the modifier early-return):

- **Alt+↑ (Option+↑)** — move the active step one position **earlier** (toward index 0).
- **Alt+↓ (Option+↓)** — move the active step one position **later**.
  - Both call the reorder action on the active index and let the active index
    follow the step. Handler always calls `preventDefault()` for the combo.
  - No-op at the sequence boundaries (active step already first / last).
  - **Why the vertical axis, not Alt+←/→:** Chrome on Windows/Linux binds
    `Alt+Left`/`Alt+Right` to history **Back/Forward**, which the editor must not
    hijack (and at a boundary no-op the keydown would fall through and navigate).
    `Alt+Up`/`Alt+Down` has no browser/OS history binding and also matches the
    vertical layout of the editor list.
  - Cross-platform: `Alt` = Option on macOS; `Option+↑/↓` has no default browser/OS
    binding outside text inputs (the global handler already skips text inputs), so
    capturing it is safe on macOS, Windows, Linux.

### Platforms
Pointer drag (motion `Reorder`) is enabled only when the inspector renders
**inline** — desktop and tablet non-sheet layouts (`!useSheetShell`). Respect
`prefers-reduced-motion` for the layout animation; drag still functions when
reduced motion is set.

Inside the **bottom sheet** (mobile tier and the `tablet-split` variant, i.e.
`useSheetShell === true`) the list renders as a plain selectable `ul`/`li` with
**no** drag handle. Reordering there is done with the toolbar Move Up/Down buttons
(and, on a hardware keyboard, the global `Alt+↑/↓`). This is a hard constraint, not
a preference: motion `Reorder`'s layout animations deadlock the sheet's
`AnimatePresence` exit, leaving the sheet stuck open after a close. `SongControls`
passes `enableDrag={!useSheetShell}` to switch variants.

## State / Atom Changes

File: `packages/fretboard/src/store/progressionAtoms.ts`

Add one write-only action atom:

```ts
export const reorderProgressionStepsAtom = atom(
  null,
  (get, set, update: { from: number; to: number }) => {
    const steps = get(progressionStepsAtom);
    const { from, to } = update;
    if (
      from === to ||
      from < 0 || from >= steps.length ||
      to < 0 || to >= steps.length
    ) {
      return;
    }
    const next = [...steps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    set(loadedPresetIdAtom, null);
    set(progressionStepsAtom, next);
    set(activeProgressionStepIndexAtom, to);
  },
);
```

`moveProgressionStepAtom` is reimplemented to delegate to the new atom (resolve the
step's current index, compute `to = from + direction`, bounds-check, dispatch),
keeping a single source of truth for reorder semantics.

Exposed through `useProgressionState` as `reorderProgressionSteps`.

## Component Wiring

File: `src/components/SongControls/ProgressionStepList.tsx`

- `ProgressionStepList` stays a controlled presentational component.
- New optional props:
  - `onReorder?(fromIndex: number, toIndex: number): void`
- When `onReorder` is provided, the list renders as `Reorder.Group` (keyed by
  `step.id`) with each row as a `Reorder.Item` carrying a grip handle wired to
  `useDragControls`. When omitted, it falls back to the current static `<button>`
  rows — preserving existing usages and tests.
- `Reorder.Group`/`onReorder` translation: the group operates on the ordered step-id
  array; on change, diff old vs new order to derive `{ from, to }` and call
  `onReorder`.
- The list does **not** handle the keyboard reorder itself — that lives in the
  global hook (below) so it stays consistent with the app's active-step model.

File: `src/components/SongControls/SongControls.tsx`

- Pass `onReorder` wired to `reorderProgressionSteps` from `useProgressionState`.

File: `src/hooks/useKeyboardShortcuts.ts`

- Add `Alt+ArrowUp` / `Alt+ArrowDown` handling that resolves the active step and
  dispatches the reorder action (move active step earlier / later). This branch runs
  before the existing `metaKey || ctrlKey || altKey` early-return. Existing
  `ArrowUp/ArrowDown` (tempo) and unmodified `ArrowLeft/ArrowRight` (step nav) paths
  are untouched.

File: `src/components/SongControls/ProgressionStepList.module.css`

- Styles for the grip handle (`cursor: grab` / `grabbing`, hover affordance,
  touch target ≥ 24px), and a dragging state for the active item.

## Testing

- **Atom unit test** (`progressionAtoms.test.ts`): `reorderProgressionStepsAtom`
  moves a non-adjacent step, is a no-op for out-of-range / equal indices, clears
  `loadedPresetIdAtom`, and sets the active index to `to`. Confirm
  `moveProgressionStepAtom` still behaves after delegating.
- **Global shortcut test** (existing `src/hooks/useKeyboardShortcuts.test.tsx`):
  dispatching `Alt+ArrowUp` / `Alt+ArrowDown` reorders the
  active step earlier / later and updates `activeProgressionStepIndexAtom`; boundaries
  are no-ops; plain `ArrowUp/ArrowDown` still changes tempo and plain
  `ArrowLeft/ArrowRight` still navigates steps (no regression).
- **Component test** (`ProgressionStepList.test.tsx`):
  - `onReorder` callback contract: invoking it with `{from, to}` indices is wired
    correctly (the diff-to-`onReorder` translation produces correct indices).
  - Grip handle exposes an accessible label; `vitest-axe` passes.
- **Integration test** (`SongControls.test.tsx`): `onReorder` path updates
  `progressionStepsAtom` order and `activeProgressionStepIndexAtom` through the real
  store wiring.
- jsdom cannot simulate real pointer drag; pointer-drag UX is validated by the
  callback contract above plus existing visual suites.

## Risks & Mitigations

- **Select vs drag conflict on touch** → mitigated by handle-only drag
  (`dragListener={false}` + drag controls).
- **`motion` `Reorder` keying** → each item keyed by stable `step.id`.
- **Reorder during playback** → the Tone.js engine reads from atoms, so a live
  reorder re-sequences; verify the transport does not crash mid-playback.
- **`prefers-reduced-motion`** → drag remains functional; layout animation is
  suppressed by motion.

## Touched Files

1. `packages/fretboard/src/store/progressionAtoms.ts` — new `reorderProgressionStepsAtom`, refactor `moveProgressionStepAtom` to delegate.
2. `packages/fretboard/src/store/progressionAtoms.test.ts` — atom tests.
3. `packages/fretboard/src/hooks/useProgressionState.ts` — expose `reorderProgressionSteps`.
4. `src/components/SongControls/ProgressionStepList.tsx` — Reorder.Group/Item, grip handle, `onReorder` prop.
5. `src/components/SongControls/ProgressionStepList.module.css` — handle + dragging styles.
6. `src/components/SongControls/ProgressionStepList.test.tsx` — callback-contract + a11y tests.
7. `src/components/SongControls/SongControls.tsx` — wire `onReorder`.
8. `src/components/SongControls/SongControls.test.tsx` — integration test.
9. `src/hooks/useKeyboardShortcuts.ts` — add `Alt+↑/↓` reorder-active-step branch.
10. `src/hooks/useKeyboardShortcuts.test.tsx` — keyboard reorder + no-regression tests.
