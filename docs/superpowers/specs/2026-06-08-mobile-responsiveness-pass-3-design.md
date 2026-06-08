# Mobile Responsiveness Pass 3 — Design Spec

**Date:** 2026-06-08
**Scope:** CSS-only (plus one minor JSX wrapper) mobile-tier polish pass
**Approach:** Option A — pure CSS overrides scoped to `[data-layout-tier="mobile"]`

---

## Background

This is the third dedicated mobile responsiveness sweep. It addresses 7 user-reported issues
and 3 additional issues found during the audit. All fixes are scoped to the mobile layout tier
(`data-layout-tier="mobile"`) using the existing pattern throughout the codebase. No new
components, no new props, no new state.

---

## Issues & Design

### Issue 1 — Remove TransportBar / ProgressionTrack Divider

**Problem:** On mobile, the `ProgressionTrack` renders a top border on `.track` that doubles
up with the `TransportBar`'s bottom border, producing two hairlines 6px apart. Redundant and
visually noisy.

**Fix:** In `ProgressionTrack.module.css`, add to the existing mobile `.track` override:

```css
:global(.app-container[data-layout-tier="mobile"]) .track {
  border-top: none;
}
```

---

### Issue 2 — AppHeader Action Buttons: Tap Targets

**Problem:** `icon-button--sm` is 2rem x 2rem (32px), below the 44px minimum touch target.
The mobile `app-header-actions` gap of 0.3rem also doesn't tighten enough to leave room.

**Fix:**

In `shared.module.css`, add a mobile override:

```css
:global(.app-container[data-layout-tier="mobile"]) .icon-button--sm {
  width: var(--size-touch-target);   /* 2.75rem = 44px */
  height: var(--size-touch-target);
}
```

In `AppHeader.module.css`, tighten the mobile actions gap to 0.15rem so 4 x 44px buttons
fit within the `max-width: 44vw` constraint already in place:

```css
:global(.app-container[data-layout-tier="mobile"]) .app-header-actions {
  gap: 0.15rem;
}
```

---

### Issue 3 — Fretboard to Inspector Gap

**Problem:** The mobile `@media` block in `App.css` sets `gap: 0.5rem` between all flex
children of `.app-container`. This gap between the fretboard and the inspector panel reads
slightly too loose on mobile given the header already provides clear separation above.

**Fix:** In `App.css`, reduce the mobile gap:

```css
@media (max-width: 767px) {
  .app-container {
    gap: 0.35rem;
  }
}
```

---

### Issue 4 — Progression Card Header Toolbar Button Sizes

**Problem:** On mobile:
- `.toolbar-button` (Add) has text hidden but still has `padding: 0 var(--space-2)` — wide
  rectangle, not a square.
- `.delete-button` has the same padding issue — taller than wide.
- `.grouped-button` already sets `width: var(--control-height)` but its height comes from
  the parent group's stretch, not an explicit value — inconsistent.

**Fix:** In `SongControls.module.css`, add to the mobile section:

```css
:global(.app-container[data-layout-tier="mobile"]) .toolbar-button {
  width: var(--control-height);
  padding: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .delete-button {
  width: var(--control-height);
  padding: 0;
  margin-left: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .grouped-button {
  height: var(--control-height);
}
```

---

### Issue 5 — Quality Row: Collapse to One Row + Icon-Only Lock

**Problem:** On mobile, Root and Quality each occupy their own `editor-grid` row
(single-column grid), with the lock toggle sitting beneath the quality select. Three rows
for what should be one. The lock button's "Adapts" / "Locked" text label wastes horizontal
space that the icon shape (open/closed padlock) + `aria-pressed` already communicate per
WCAG 1.4.1.

**Fix:**

**CSS** (`SongControls.module.css`): Add a `.root-quality-row` class that, on mobile,
creates a flex row combining root select, quality select, and lock icon:

```css
:global(.app-container[data-layout-tier="mobile"]) .root-quality-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

:global(.app-container[data-layout-tier="mobile"]) .lock-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border-width: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .lock-toggle {
  width: var(--control-height);
  padding: 0;
  flex-shrink: 0;
}
```

**JSX** (`SongControls.tsx`): Wrap the Root `control-section` and Quality `control-section`
divs together in a new `<div className={styles["root-quality-row"]}>` wrapper. This wrapper
is always in the DOM; on desktop it has no effect (no styles target it at non-mobile tiers).

---

### Issue 6 — Editor Pager Navigation: Tap Target Size

**Problem:** `.pager-button` is 1.75rem x 1.6rem (approx 28px x 26px) — well below 44px
in both dimensions.

**Fix:** In `SongControls.module.css`:

```css
:global(.app-container[data-layout-tier="mobile"]) .pager-button {
  width: var(--control-height);
  height: var(--control-height);
}
```

---

### Issue 7 — Duration Row: Stepper vs. ToggleBar Height Mismatch

**Problem:** The stepper's `.mobile` override sets `min-height: var(--size-touch-target)`
on the inner buttons only. The ToggleBar's `.mobile-tab` has a hardcoded
`min-height: 2.85rem` (approx 45.6px). The two controls sit in the same `duration-row`
but appear different heights.

**Fix:**

In `StepperControl.module.css`, update the `.mobile` variant to use `--control-height`:

```css
.stepper-control.mobile .stepper-btn {
  min-height: var(--control-height);
  min-width: var(--control-height);
}
```

In `ToggleBar.module.css`, replace the hardcoded value with the token:

```css
.mobile-tab-bar .mobile-tab {
  min-height: var(--control-height);
}
```

Both controls now track the same `--control-height` token (44px on mobile).

---

### Issue 8 — LabeledSelect Dropdown Items: Tap Target

**Problem:** `.labeled-select-item` has `min-height: 1.85rem` (approx 30px) at all
viewports. On mobile, chord root and quality picker options are high-frequency interactions
and need the 44px minimum.

**Fix:** In `LabeledSelect.module.css`:

```css
:global(.app-container[data-layout-tier="mobile"]) .labeled-select-item {
  min-height: var(--control-height);
  padding-block: 0.6rem;
}
```

---

### Issue 9 — InspectorCard Head: Empty Placeholder Span + Toolbar Ordering

**Problem:** When `description` is absent, `InspectorCard` renders an empty
`<span aria-hidden />` placeholder. On mobile, where `cardDesc` is hidden via
`display: none`, this span still occupies a flex item slot, creating an invisible gap
between the card name and the actions toolbar. Toolbar wrap order is also implicit,
which looks inconsistent across different content lengths.

**Fix:** In `InspectorCard.module.css`, extend the mobile block:

```css
:global(.app-container[data-layout-tier="mobile"]) .cardDesc {
  display: none;
}

:global(.app-container[data-layout-tier="mobile"]) .cardHeadActions {
  order: 3;
  flex: 1 1 100%;
  justify-content: flex-end;
}
```

The `display: none` covers both the real description and the empty placeholder span.
The explicit `order: 3` ensures the toolbar always wraps to its own second row predictably.

---

### Issue 10 — Editor Panel Header: Overflow on Narrow Screens

**Problem:** `.editor-panel-header` is a single unwrapped flex row: degree badge + title
+ pager. On a 320px viewport, the badge and pager can crowd out the chord name.
No flex-wrap guard exists.

**Fix:** In `SongControls.module.css`:

```css
:global(.app-container[data-layout-tier="mobile"]) .editor-panel-header {
  flex-wrap: wrap;
  row-gap: 0.35rem;
  align-items: flex-start;
}

:global(.app-container[data-layout-tier="mobile"]) .editor-pager {
  order: 3;
  flex: 1 1 100%;
  justify-content: center;
  margin-left: 0;
}
```

The pager drops to its own full-width centered row, reachable with both thumbs, while the
degree badge and chord title share the first row with ample space.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/shared/shared.module.css` | Add mobile `icon-button--sm` override (44px) |
| `src/styles/App.css` | Reduce mobile gap 0.5rem to 0.35rem |
| `src/components/ProgressionTrack/ProgressionTrack.module.css` | Add `border-top: none` to mobile `.track` |
| `src/components/SongControls/SongControls.module.css` | Toolbar button squares, pager size, quality row layout, editor header wrap, lock label sr-only |
| `src/components/SongControls/SongControls.tsx` | Wrap Root + Quality sections in `.root-quality-row` div |
| `src/components/StepperControl/StepperControl.module.css` | Use `--control-height` token in `.mobile` override |
| `src/components/ToggleBar/ToggleBar.module.css` | Replace `2.85rem` with `var(--control-height)` |
| `src/components/LabeledSelect/LabeledSelect.module.css` | Add mobile dropdown item min-height |
| `src/components/Inspector/InspectorCard.module.css` | Hide `cardDesc` fully on mobile, fix `cardHeadActions` ordering |
| `src/components/AppHeader/AppHeader.module.css` | Tighten mobile actions gap to 0.15rem |

---

## Testing

**No new tests required.** The changes are visual/layout CSS overrides.

- Existing CSS module snapshot tests (`*.module.css.test.ts`) may need snapshot updates for
  files that have string-match assertions — mechanical updates, not logic changes.
- `layout.test.tsx` guards the mobile header height budget; the `max-width: 44vw` clamp on
  `.app-header-actions` already accommodates 4 x 44px buttons.
- All existing functional tests (`SongControls.test.tsx`, `ToggleBar.test.tsx`, etc.) are
  unaffected — they test behavior, not pixel dimensions.
- Playwright visual snapshot tests will catch any unintended regressions at next run.

---

## Non-Goals

- No changes to desktop or tablet tiers.
- No refactoring of component structure beyond the single `root-quality-row` wrapper div.
- No changes to animation, theming, or token values.
- No new shared utility classes introduced.
