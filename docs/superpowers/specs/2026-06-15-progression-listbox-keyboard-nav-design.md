# Progression Chord List — Roving-Tabindex Listbox Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)
**Builds on:** the focus-management work in PR #619 (shared focus-target ids, `.scroll` container focus, hook ←/→ handling).

## Problem

Tabbing into the chord progression list lands on the **first** row, because every
row is its own Tab stop (a deliberate choice documented in
[`ProgressionStepList.tsx`](../../../src/components/SongControls/ProgressionStepList.tsx)).
For a multi-chord progression this means many Tab stops, and entry is always at
row 1 even when a later step is the active/selected one. The desired behavior is
the standard selectable-list pattern: the list is a single Tab stop and entry
lands on the **active** row.

## Goal

Convert the chord list into a roving-tabindex listbox:

- The list is a **single Tab stop**; Tab enters on the **active** option row and
  Tab again leaves the whole list.
- `←/→` navigate between chords; `↑/↓` continue to adjust tempo even while the
  list is focused (decided: reuse the existing horizontal chord-nav keys, leave
  the tempo keys global).
- Selection follows focus — moving within the list sets the active step (there is
  already a single piece of state, `activeProgressionStepIndex`), so focus and
  "active" never diverge.
- Playback-driven active-step changes never steal keyboard focus.

## Non-goals

- No change to the tempo stepper focus behavior shipped in #619.
- No change to the `↑/↓` tempo shortcuts or to which keys are global.
- No visual restyle of the rows beyond what the role/structure change requires
  (the active row keeps its cyan left-tick + tint; the focus ring tokens are
  unchanged).
- No new "activate" affordance (Enter/Space): selection follows focus, and click
  still selects.

## Approach (roving-tabindex listbox)

### Structure (Part A)

[`ProgressionStepList.tsx`](../../../src/components/SongControls/ProgressionStepList.tsx)
becomes a valid listbox:

- The `<ul>` gets `role="listbox"`, `aria-orientation="horizontal"`, and keeps its
  `aria-label`.
- Each row becomes the option itself: `<li role="option" aria-selected={active}
  tabIndex={active ? 0 : -1} onClick=…>`. The inner `<button>` is dropped —
  `listbox > option` is the valid ARIA structure, and with selection-following-
  focus there is no separate activation step. The `.row` class, `aria-label`,
  `aria-current`/`aria-selected`, and `data-unavailable` move onto the `<li>`.
- Roving tabindex: exactly one option (the active one) has `tabIndex={0}`; all
  others have `tabIndex={-1}`. This makes the list a single Tab stop that enters
  at the active row.
- The `.scroll` container keeps its `tabIndex={-1}` and shared id from #619 (used
  as the "ring the whole list" target for the from-outside global shortcut).

ARIA note: a `<li role="option">` with `tabIndex` is focusable and announced as
an option with its selected state. The existing per-row `aria-label`
(position, degree, name, duration, selected) is preserved. `aria-current` is
replaced by `aria-selected` to match listbox semantics; the visual active styling
keys off the same `active` flag (a class), not the ARIA attribute.

### Keyboard reconciliation (Part B)

- **In-list `←/→`:** a `keydown` handler on the `.scroll` container (keydown from
  a focused option bubbles up to it, and the container is itself focusable)
  handles `ArrowLeft`/`ArrowRight`: `preventDefault`, call a new
  `onNavigate(direction: -1 | 1)` prop, and flag that the next render should take
  focus. `↑/↓` and every other key are left alone so tempo keys still work
  (Home/End support is out of scope).
- **`onNavigate` reuses the global atoms:** `ProgressionStepList` stays
  presentational. `SongControls` wires `onNavigate` to the **same** actions the
  global shortcut uses — `previousProgressionStepAtom` (−1) and
  `advanceProgressionPlaybackAtom` (+1) — so in-list navigation is byte-for-byte
  identical to the `←/→` shortcut: it skips unresolvable steps and clamps at the
  ends when stopped (those atoms only wrap while playing+looping, which never
  applies here since navigation is a stopped-state action). Note this is
  intentionally **not** the wrapping `(i + delta + stepCount) % stepCount`
  behavior of the SongControls prev/next pips — the list must match the keyboard
  shortcut, not the pip buttons.
- **Focusing the new row with correct timing:** the handler records the target
  index in a ref and a `useLayoutEffect` focuses that row after React re-renders
  with the new roving tabindex, avoiding the "focus the stale row" race.
- **Global `←/→` (from outside the list):** unchanged from #619 — advances the
  step and focuses the `.scroll` container so the whole list shows the ring. Once
  focus is inside the list, the in-list handler takes over.
- **No double-advance:** the `ArrowLeft`/`ArrowRight` cases in
  [`useKeyboardShortcuts.ts`](../../../src/hooks/useKeyboardShortcuts.ts) gain an
  early bail when `document.activeElement` is inside the list container (looked up
  by the shared id). When the list is focused, the global handler does nothing and
  the local handler owns navigation. (The window listener fires regardless of
  React's `stopPropagation`, so this guard — not propagation — is what prevents
  the duplicate.)

## Components / files touched

| File | Change |
| --- | --- |
| `src/components/SongControls/ProgressionStepList.tsx` | Listbox roles, roving tabindex, `<li role="option">` rows, in-list `←/→` keydown handler (calls `onNavigate`) + focus-after-render effect; new `onNavigate` prop. |
| `src/components/SongControls/ProgressionStepList.module.css` | Move/keep `.row` styles on the `<li>`; ensure `:focus-visible` ring + active styling still apply. |
| `src/components/SongControls/SongControls.tsx` | Wire `onNavigate` to `previousProgressionStepAtom` / `advanceProgressionPlaybackAtom`. |
| `src/hooks/useKeyboardShortcuts.ts` | Early bail on `←/→` when focus is inside the chord list (avoid double-advance). |

## Testing

- **ProgressionStepList (vitest + Testing Library):**
  - The list renders as `role="listbox"` with `aria-orientation="horizontal"`.
  - Exactly one option has `tabIndex=0` (the active one); the rest have `-1`.
  - Rendering with `activeIndex=2` puts `tabIndex=0` on the third option (Tab
    enters at the active row, not the first).
  - `keydown` `ArrowRight`/`ArrowLeft` on a focused option calls `onNavigate`
    with `+1`/`-1` and (driven by the updated `activeIndex` prop) moves
    `document.activeElement` to the new active option after render.
  - `↑`/`↓` on a focused option do **not** call `onNavigate` or `onSelect` (tempo
    keys pass through).
  - Click on an option still calls `onSelect`.
- **useKeyboardShortcuts:** with a list element present and `document.activeElement`
  inside it, `ArrowRight`/`ArrowLeft` do **not** mutate the step (local handler
  owns it); with focus outside, they still advance + focus the container (the #619
  tests stay green).
- **a11y:** `vitest-axe` on the listbox; confirm option accessible names are
  intact and Tab order is a single stop.
- Run `pnpm run lint`, `pnpm run ui:tokens`, `pnpm run test`, `pnpm run build`.
- **Manual:** Tab into the list lands on the active row; `←/→` move row-by-row and
  carry focus; `↑/↓` still change tempo while the list is focused; mouse click
  still selects; screen reader announces "listbox … option X of N, selected".

## Rejected alternatives

- **Keep every row a Tab stop, but enter at the active row:** smaller, but leaves
  N Tab stops and is a non-standard half-measure (focusable list with no single
  entry point).
- **Standard vertical `↑/↓` navigation:** more ARIA-conventional for a visually
  vertical list, but `↑/↓` are the tempo shortcuts; overloading them while the
  list is focused changes their meaning contextually. Rejected in favor of
  reusing the existing horizontal `←/→` chord-nav keys.
