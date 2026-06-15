# Keyboard-Shortcut Focus Management — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Problem

Global keyboard shortcuts mutate state but never move DOM focus, so the
`:focus-visible` ring lands in the wrong place:

- **Tempo (↑/↓):** state changes, but focus stays wherever it was. On mobile the
  panel body holds focus (`tabIndex={-1}`, focused on open), so the browser's
  default outline wraps the **entire tab body** instead of the tempo control.
- **Chord navigation (←/→):** the active step changes, but focus does not follow.
  The chord rows are individual tab stops; the surrounding list is not focusable,
  so there is no way to "highlight the list" as a unit.

Root cause: [`src/hooks/useKeyboardShortcuts.ts`](../../../src/hooks/useKeyboardShortcuts.ts)
is a single global `window` keydown handler that sets atoms directly and performs
no focus management. The ring tokens themselves
([`src/styles/semantic.css`](../../../src/styles/semantic.css) `--focus-ring`,
`--focus-ring-glow`) are already correct and are **not** changing.

## Goal

After a shortcut changes a control's value, move focus to that control so the
existing `:focus-visible` ring highlights exactly what changed:

- ↑/↓ → the **tempo stepper group** is ringed.
- ←/→ → the **chord step list** (as a single unit) is ringed.
- The stray "whole tab body" outline on the mobile panel is removed.

This is the standard, accessible behavior: screen readers track the moved focus,
and a subsequent Tab continues from the affected control.

## Non-goals

- No changes to the ring colors, thickness, glow, or offset tokens.
- No change to which keys do what, or to the global "works from anywhere" nature
  of the shortcuts.
- No roving-focus / ARIA-widget refactor of the stepper or list (rejected
  Approach C — it would break the global-shortcut UX).

## Approach (chosen: focus-follows-shortcut)

### Focus targets become programmatically focusable

1. **Tempo stepper group** — [`StepperControl.tsx`](../../../src/components/StepperControl/StepperControl.tsx)
   forwards a stable DOM `id` and `tabIndex={-1}` to the `StepperShell` group
   element (the `role="group"` wrapper). `tabIndex={-1}` makes it focusable
   programmatically without adding a Tab stop (the +/− buttons remain the only
   Tab stops). A `:focus-visible` ring is added to the shell in
   [`StepperShell.module.css`](../../../src/components/StepperShell/StepperShell.module.css)
   using the existing `--focus-ring` / `--focus-ring-glow` tokens, so the ring
   wraps the whole stepper.

   The `id` is passed from the tempo `StepperControl` instance in
   [`SongControls.tsx`](../../../src/components/SongControls/SongControls.tsx)
   (e.g. `progression-tempo-stepper`). Other `StepperControl` instances are
   unaffected because `id`/focusability are opt-in props.

2. **Chord step list** — [`ProgressionStepList.tsx`](../../../src/components/SongControls/ProgressionStepList.tsx)
   gives the scroll container (`.scroll`) a stable `id` (e.g.
   `progression-step-list`) and `tabIndex={-1}`, with a `:focus-visible` ring in
   [`ProgressionStepList.module.css`](../../../src/components/SongControls/ProgressionStepList.module.css).
   Ringing the scroll container (rather than a single row) matches the requested
   "highlight the list" behavior. Individual rows keep their own `:focus-visible`
   rings for direct Tab navigation.

### The hook moves focus after mutating

[`useKeyboardShortcuts.ts`](../../../src/hooks/useKeyboardShortcuts.ts) focuses the
relevant target immediately after the state mutation, reusing the
`document.getElementById(...)?.focus({ preventScroll: true })` pattern already
used in [`MobilePanel.tsx`](../../../src/components/MobileShell/MobilePanel.tsx):

- `ArrowUp` / `ArrowDown`: after setting `progressionTempoBpmAtom`, focus
  `#progression-tempo-stepper`.
- `ArrowLeft` / `ArrowRight`: after the chord step change, focus
  `#progression-step-list`.

`{ preventScroll: true }` avoids the page/list jumping on focus. The existing
in-list scroll-into-view effect ([`ProgressionStepList.tsx`](../../../src/components/SongControls/ProgressionStepList.tsx)
lines 41–49) continues to keep the active row visible.

**Off-tab behavior (decided):** if the target element is not in the DOM (its tab
is not showing), `getElementById` returns `null` and focus is a no-op. The atom
still updates silently. No auto tab-switch. This preserves today's behavior for
the hidden-tab case.

`:focus-visible` after a programmatic `.focus()` matches because the triggering
interaction was a keydown, so the heuristic resolves to keyboard. The ring shows;
it does not show for mouse-driven changes.

### Mobile panel outline — already suppressed (no change)

[`MobilePanel.tsx`](../../../src/components/MobileShell/MobilePanel.tsx) focuses the
panel body as a screen-reader landing zone. Verified during planning: the `.panel`
rule in `MobilePanels.module.css` already sets `outline: none`, so the panel does
not draw its own ring. Once focus moves to the actual control on the next
shortcut, the panel no longer retains focus during shortcut use either. **No CSS
change to the panel is required.**

## Components / files touched

| File | Change |
| --- | --- |
| `src/hooks/useKeyboardShortcuts.ts` | Focus tempo group / chord list after the four arrow shortcuts. |
| `src/components/StepperControl/StepperControl.tsx` | Optional `id` + `tabIndex={-1}` forwarded to the group element. |
| `src/components/StepperShell/StepperShell.module.css` | `:focus-visible` ring on the shell. |
| `src/components/SongControls/SongControls.tsx` | Pass the tempo stepper `id`. |
| `src/components/SongControls/ProgressionStepList.tsx` | `id` + `tabIndex={-1}` on the scroll container. |
| `src/components/SongControls/ProgressionStepList.module.css` | `:focus-visible` ring on the scroll container. |
| `src/components/SongControls/progressionFocusIds.ts` | New: shared id constants for the focus targets (prevents string drift between hook and components). |

## Testing

- **Unit (vitest + Testing Library):** extend the `useKeyboardShortcuts` tests to
  assert that, with the targets rendered, `document.activeElement` becomes the
  tempo group after ↑/↓ and the chord list after ←/→; and that the off-tab case
  (target absent) is a no-op that still mutates the atom.
- **A11y:** confirm the focusable group/list keep their accessible names
  (`role="group"` `aria-label` on the stepper; `aria-label` on the list) and that
  the new `tabIndex={-1}` does not add Tab stops (Tab order unchanged).
- **Visual regression:** the existing overlay/mobile suites cover the panel; add
  or update a snapshot if the panel-outline removal is visible at rest (it should
  not be, since the panel only shows an outline while focused).
- Run `pnpm run lint`, `pnpm run ui:tokens`, `pnpm run test`, `pnpm run build`
  before opening the PR (per AGENTS.md).

## Rejected alternatives

- **B — Transient flash highlight:** paint a temporary ring without moving focus.
  Not accessible (SR users get no focus change), non-standard, and leaves the
  wrong "whole body" outline in place.
- **C — Decentralize into ARIA widgets:** stepper/list handle arrows only when
  focused. Idiomatic ARIA but removes the global-from-anywhere shortcut UX the
  user depends on. Larger, behavior-changing refactor.
