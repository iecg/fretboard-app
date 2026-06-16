# Progression Chord List — Single-Tab-Stop Keyboard Navigation Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)
**Builds on:**
- the focus-management work in PR #619 (shared focus-target ids, `.scroll`
  container focus, hook `←/→` handling), and
- the drag-and-drop reorder work merged to main in #618 (the list is now a motion
  `Reorder.Group` of `<button>` rows, with an `Alt+↑/↓` reorder shortcut).

## Problem

Tabbing into the chord progression list lands on the **first** row, because every
row is its own Tab stop. The rows are `<button>` elements (`StepSelectButton` in
[`ProgressionStepList.tsx`](../../../src/components/SongControls/ProgressionStepList.tsx)),
so a multi-chord progression produces many Tab stops, and entry is always at row 1
even when a later step is the active/selected one. The desired behavior is the
standard composite-widget pattern: the list is a **single Tab stop** and entry
lands on the **active** row.

## Goal

- The list is a **single Tab stop**; Tab enters on the **active** row and Tab
  again leaves the whole list.
- `←/→` navigate between chords (matching the existing global chord-nav keys);
  `↑/↓` continue to adjust tempo and `Alt+↑/↓` continue to reorder, even while the
  list is focused (decided: reuse the horizontal chord-nav keys, leave the other
  shortcuts global and untouched).
- Selection follows focus — moving within the list sets the active step (there is
  already a single piece of state, `activeProgressionStepIndex`), so focus and
  "active" never diverge.
- Playback-driven and drag-driven active-step changes never steal keyboard focus.

## Non-goals

- No change to the tempo `↑/↓` shortcut, the `Alt+↑/↓` reorder shortcut, or the
  pointer drag-and-drop reorder from #618.
- No restructure of the list DOM into `role="listbox"`/`role="option"`. Main's
  rows are `<button>`s nested inside motion `Reorder.Item` (`<li>`) elements;
  forcing valid `listbox > option` structure would fight the drag library for
  little gain. We keep the buttons and use **roving tabindex** (the same
  single-tab-stop composite pattern the repo already uses for the HelpModal
  tablist). Full listbox/option ARIA semantics are explicitly deferred.
- No visual restyle of rows; the existing `.row:focus-visible` ring and active
  styling are reused.
- No new Enter/Space "activate" affordance: selection follows focus, and click
  still selects.

## Current structure (post-#618, for reference)

`ProgressionStepList` renders a `.scroll` container (already
`id={PROGRESSION_STEP_LIST_ID} tabIndex={-1}` from #619) holding one of two
branches:

- `enableDrag` (desktop/tablet-inline): `Reorder.Group as="ul"` whose children are
  `DraggableStepRow` → `Reorder.Item as="li"` → `StepSelectButton` (`<button>`).
- otherwise (mobile sheet): a plain `<ul>` of `<li>` → `StepSelectButton`.

`StepSelectButton` is the shared row body: a `<button>` with `.row`,
`aria-current`, the accessible name, `onClick={() => onSelect(index)}`, and an
optional trailing drag handle. The active row's button receives a shared
`activeRef` (used today for scroll-into-view).

## Approach

### Roving tabindex (Part A)

- `StepSelectButton` sets `tabIndex={active ? 0 : -1}`. Exactly one button (the
  active one) is in the Tab order; the rest are reachable only programmatically.
  Result: the list is a single Tab stop and Tab enters at the active row. This
  applies to **both** render branches because it lives in the shared
  `StepSelectButton`.
- No role/structure changes; the buttons keep `aria-current` and their accessible
  names. The drag handle and `Reorder.Item` wiring are untouched.

### Keyboard navigation + focus (Part B)

- **In-list `←/→`:** an `onKeyDown` handler on the `.scroll` container (keydown
  from any focused row button bubbles up to it, and the container is itself
  focusable) handles **plain** `ArrowLeft`/`ArrowRight` only: it `preventDefault`s,
  calls a new `onNavigate(direction: -1 | 1)` prop, and sets a "pending focus"
  ref. It returns early (does nothing) when any of `altKey`/`metaKey`/`ctrlKey`/
  `shiftKey` is set, so `Alt+↑/↓` reorder and every other shortcut pass through
  untouched, and it ignores `↑/↓` so tempo keys keep working while the list is
  focused.
- **`onNavigate` reuses the global atoms:** `ProgressionStepList` stays
  presentational. `SongControls` wires `onNavigate` to the **same** actions the
  global `←/→` shortcut uses — `previousProgressionStepAtom` (−1) and
  `advanceProgressionPlaybackAtom` (+1) — so in-list navigation is identical to
  the shortcut: it skips unresolvable steps and clamps at the ends when stopped
  (those atoms only wrap while playing+looping, which never applies here). This is
  intentionally **not** the wrapping `(i + delta + n) % n` behavior of the
  SongControls Move pips — the list matches the keyboard shortcut.
- **Focus follows navigation, with correct timing:** the existing
  `useEffect([activeIndex])` (scroll-into-view) is extended so that when the
  "pending focus" ref is set, it focuses `activeRef.current` (the active row
  button) after React re-renders with the moved roving tabindex, then clears the
  ref. Because only the in-list `←/→` handler sets that ref, focus never moves on
  click, drag, playback, or the from-outside global shortcut.
- **Global `←/→` (from outside the list):** unchanged from #619 — advances the
  step and focuses the `.scroll` container so the whole list shows the ring. Once
  focus is inside the list (container or a row), the in-list handler owns
  navigation and focus moves row-to-row.
- **No double-advance:** the `ArrowLeft`/`ArrowRight` switch cases in
  [`useKeyboardShortcuts.ts`](../../../src/hooks/useKeyboardShortcuts.ts) gain an
  early bail when `document.getElementById(PROGRESSION_STEP_LIST_ID)` contains
  `document.activeElement`. When the list is focused the global handler does
  nothing for `←/→` and the local handler owns it. (The window listener fires
  regardless of React `stopPropagation`, so this guard — not propagation — is what
  prevents the duplicate.) The `Alt+↑/↓` reorder branch and the tempo `↑/↓` cases
  are not touched by this guard.

### Net entry behavior

- **Tab** → active row focused (single Tab stop).
- **First global `←/→` from outside** → step advances, whole-list ring (container).
- **Subsequent `←/→` inside** → row-by-row, focus follows the active row.
- **`↑/↓`** → tempo, unaffected. **`Alt+↑/↓`** → reorder, unaffected.

## Components / files touched

| File | Change |
| --- | --- |
| `src/components/SongControls/ProgressionStepList.tsx` | `tabIndex={active ? 0 : -1}` on `StepSelectButton`; `onKeyDown` on `.scroll` for plain `←/→` → `onNavigate` + pending-focus; extend the active-index effect to focus the active row on keyboard nav; new `onNavigate` prop. |
| `src/components/SongControls/SongControls.tsx` | Wire `onNavigate` to `previousProgressionStepAtom` / `advanceProgressionPlaybackAtom`. |
| `src/hooks/useKeyboardShortcuts.ts` | Early bail on plain `←/→` when focus is inside the chord list (avoid double-advance). |

## Testing

- **ProgressionStepList (vitest + Testing Library):**
  - Exactly one row button has `tabIndex=0` (the active one); the rest are `-1`.
  - With `activeIndex=2`, the third button has `tabIndex=0` (Tab enters at the
    active row, not the first).
  - `keydown` plain `ArrowRight`/`ArrowLeft` on a focused row calls `onNavigate`
    with `+1`/`-1`; `Alt+ArrowLeft`/`Alt+ArrowRight` and `↑/↓` do **not** call
    `onNavigate` (they pass through).
  - After `onNavigate` updates `activeIndex`, `document.activeElement` is the new
    active row button.
  - Click on a row still calls `onSelect`.
  - Covers both `enableDrag` and the static (`enableDrag={false}`) branch.
- **useKeyboardShortcuts:** with the list element present and `document.activeElement`
  inside it, plain `ArrowRight`/`ArrowLeft` do **not** mutate the step (local
  handler owns it); with focus outside, they still advance + focus the container
  (the #619 tests stay green); the `Alt+↑/↓` reorder tests from #618 stay green.
- **a11y:** `vitest-axe` on the list; confirm row accessible names are intact and
  Tab order is a single stop.
- Run `pnpm run lint`, `pnpm run ui:tokens`, `pnpm run test`, `pnpm run build`.
- **Manual:** Tab into the list lands on the active row; `←/→` move row-by-row and
  carry focus; `↑/↓` still change tempo and `Alt+↑/↓` still reorder while the list
  is focused; mouse click still selects; pointer drag still reorders.

## Rejected alternatives

- **Convert to `role="listbox"`/`option`:** cleaner ARIA in the abstract, but
  invalid/awkward against main's `ul(Reorder.Group) > li(Reorder.Item) > button`
  structure and the drag library. Roving tabindex over the existing buttons
  achieves the single-tab-stop goal with far less risk. Full listbox semantics can
  be a separate follow-up if desired.
- **Keep every row a Tab stop, enter at the active row:** smaller, but leaves N
  Tab stops — a non-standard half-measure.
- **Standard vertical `↑/↓` navigation:** more conventional for a visually
  vertical list, but `↑/↓` are the tempo shortcut and `Alt+↑/↓` the reorder
  shortcut; overloading the vertical axis would clash. Reusing the horizontal
  `←/→` chord-nav keys avoids all of that.
