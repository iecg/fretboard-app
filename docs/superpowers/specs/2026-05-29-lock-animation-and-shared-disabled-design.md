# Lock Animation Polish + Shared Composable Disabled Style — Design

- **Status:** Approved design, pre-implementation
- **Date:** 2026-05-29
- **Branch:** `playback-lock-overlay` (builds on the implemented playback-lock redesign)

## Problem

The playback-lock redesign shipped, but three rough edges remain:

1. **The accent line snaps in.** The locked-card left accent line is a `box-shadow: inset 2px 0 0 0 var(--faceplate-accent)` with no transition, so it appears/disappears instantly while the rest of the lock treatment (body dim, lock icon) animates over 300ms. It also forced a light-mode-specific combined-box-shadow rule to avoid clobbering the card's elevation shadow.
2. **The lock icon shifts the layout and pops in.** The header lock icon is conditionally rendered (`{locked ? <Lock/> : null}`). When it mounts it consumes header width, shoving the description text sideways in a single frame — a jarring, un-animated reflow.
3. **Inconsistent disabled styling on locked cards.** During playback the Preset card's **Sequence** dropdown receives `disabled={editsLocked}` and renders the Radix `[data-disabled]` dimmed look, but the **Key** card's Root/Scale selects and the **Progression** card's controls (DegreeGrid, Quality select, Duration stepper/toggle) get no `disabled` prop — they are blocked only by the card-level `inert`, so they remain visually "live" while sitting inside a locked card. The result reads as half-disabled. The codebase also has scattered, inconsistent disabled appearances (opacity `0.3` / `0.4` / `0.45` across `StepperShell`, `ChordTypeGrid`, `Switch`), and some controls have no disabled styling at all (`DegreeGrid`, `NoteGrid`).

## Design Goals

- Every part of the lock treatment animates together (one coherent 300ms transition).
- The lock icon never causes an instantaneous layout jump; its reveal is animated.
- A **single composable source of truth** for the disabled appearance of control-like components.
- Controls inside a locked (`inert`) card automatically adopt the disabled appearance — **without each call site remembering to pass `disabled`** — so this class of bug cannot recur.
- Respect `prefers-reduced-motion`.
- Stay within the existing dark-DAW / neon-cyan aesthetic; CSS-only motion, GPU-friendly transforms.

---

## Issue 1 — Animated accent line (pseudo-element wipe)

Replace the static inset `box-shadow` accent with an absolutely-positioned `::before` bar that animates with a vertical wipe synced to the body dim. A transform-based animation is GPU-friendly and, crucially, does **not** interfere with the card's `box-shadow` elevation — which removes the need for the light-mode combined-box-shadow workaround.

**Remove** from `InspectorCard.module.css`:

```css
.card[data-locked="true"] {
  box-shadow: inset 2px 0 0 0 var(--faceplate-accent);
}

:global([data-theme="modern-light"]) .card[data-locked="true"] {
  box-shadow:
    inset 2px 0 0 0 var(--faceplate-accent),
    0 1px 4px rgb(42 37 29 / 0.06);
}
```

**Add:**

```css
/* Animated left accent line. A 2px bar that wipes in from the top, synced with
   the body dim. Transform-based so it never disturbs the card's box-shadow
   (the light-mode elevation shadow on .card stays untouched). */
.card::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 2px;
  background: var(--faceplate-accent);
  transform: scaleY(0);
  transform-origin: top;
  opacity: 0;
  transition: transform 300ms ease, opacity 300ms ease;
  pointer-events: none;
}

.card[data-locked="true"]::before {
  transform: scaleY(1);
  opacity: 1;
}
```

`.card` already has `position: relative` and `overflow: hidden`, so the bar is clipped to the rounded corners and positions correctly. The light-mode `.card` elevation `box-shadow` (line 25) is no longer touched by the lock state.

---

## Issue 2 — Non-shifting, animated lock icon

The icon is **always rendered** (it is decorative, `aria-hidden`), wrapped in a `.lockSlot` that has zero width when unlocked and animates to its content width when locked. Because the slot collapses to `width: 0` when unlocked, cards that can never lock (Time, Backing Track) reserve no space — no permanent gap. When a card locks, the slot's width animates open over 300ms, so the description text slides rather than jumping, and the icon fades + scales in.

The icon is grouped with the `<h3>` in a `.cardTitle` inline-flex wrapper so the header's `gap: 0.75rem` brackets the title group as a unit (not the icon), avoiding the flex-gap-around-a-zero-width-item problem.

**JSX (`InspectorCard.tsx`)** — replace the current title + conditional icon:

```tsx
        {/* before: <h3 …>{name}</h3> then {locked ? <Lock …/> : null} */}
        <span className={styles.cardTitle}>
          <h3 id={labelledById} className={styles.cardName}>
            {name}
          </h3>
          <span className={styles.lockSlot} aria-hidden="true">
            <Lock size={11} className={styles.lockIcon} />
          </span>
        </span>
```

**CSS (`InspectorCard.module.css`):**

```css
.cardTitle {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.lockSlot {
  display: inline-flex;
  align-items: center;
  width: 0;
  overflow: hidden;
  transition: width 300ms ease;
}

.card[data-locked="true"] .lockSlot {
  width: calc(11px + 0.4rem); /* icon width + its leading gap */
}

.lockIcon {
  margin-inline-start: 0.4rem;
  color: var(--faceplate-accent);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 240ms ease 60ms, transform 240ms ease 60ms;
}

.card[data-locked="true"] .lockIcon {
  opacity: 1;
  transform: scale(1);
}
```

(The current `.lockIcon { color; opacity; transition }` and `.card[data-locked="true"] .lockIcon { opacity: 1 }` rules are replaced by the above.)

**Consequence for tests:** the icon is now in the DOM regardless of `locked`. Tests that asserted the icon's *presence/absence* must instead assert `data-locked` (the real state signal); icon visibility is CSS-driven and not observable in jsdom. See Test Changes.

---

## Issue 3 — Shared composable disabled style

Two complementary pieces: **one value** (a token) and **one automatic application** (an `inert` cascade). Together they make disabled appearance consistent and self-applying.

### 3a. Single token (the value)

Consolidate the scattered opacities to one semantic token. Add to `src/styles/semantic.css` right after the existing `--disabled-opacity` line:

```css
  --disabled-opacity: var(--token-disabled-opacity);
  --control-disabled-opacity: var(--disabled-opacity); /* one knob for all control-like disabled states */
```

Migrate the outliers to reference it (no more magic numbers):
- `src/components/Switch/Switch.module.css` — `.switch:disabled { opacity: 0.45 }` → `opacity: var(--control-disabled-opacity)`
- `src/components/Inspector/ChordTypeGrid.module.css` — `.cell:disabled { opacity: 0.4 }` → `opacity: var(--control-disabled-opacity)`
- `src/components/StepperShell/StepperShell.module.css` — `.button:disabled { opacity: 0.3 }` → `opacity: var(--control-disabled-opacity)`

(`LabeledSelect`, `PresetMenu`, and `shared.module.css .toggle-btn` already use `var(--disabled-opacity)`, which now flows through the same chain.)

### 3b. Automatic `inert` cascade (the application)

The real fix for "controls in a locked card don't look disabled": a global rule that styles every control-like element inside any `inert` subtree. Because each locked `InspectorCard` already sets `inert` on its body (and on its header actions), **all current and future controls placed in a locked card automatically render disabled** — no per-call `disabled` prop required.

Create `src/styles/controls.css`:

```css
/* Canonical disabled appearance for control-like elements inside an inert
   (e.g. locked) region. `inert` already blocks interaction; this gives the
   subtree the matching visual state so it reads as disabled, not merely
   unresponsive. Explicit element selectors (specificity 0,1,1) deliberately
   outrank component module classes (0,1,0) so they win at rest. */
[inert] button,
[inert] [role="button"],
[inert] select,
[inert] input,
[inert] textarea,
[inert] [role="combobox"],
[inert] [role="spinbutton"] {
  opacity: var(--control-disabled-opacity);
  cursor: not-allowed;
}

@media (prefers-reduced-motion: no-preference) {
  [inert] button,
  [inert] [role="button"],
  [inert] select,
  [inert] input {
    transition: opacity 300ms ease;
  }
}
```

Register it in `src/main.tsx` after the other global stylesheets:

```ts
import './styles/tokens.css'
import './styles/index.css'
import './styles/semantic.css'
import './styles/themes.css'
import './styles/controls.css'
```

**Opacity stacking is intentional.** A locked card body is already at `opacity: 0.75`; a control inside it then renders at `0.75 × 0.3 = 0.225`, matching the old "Sequence dropdown looked clearly off" appearance — now applied uniformly to every control in the card. Header-action buttons (in the non-dimmed header) render at the token value directly.

### 3c. Remove the now-redundant per-call `disabled`

With 3b in place, `SongControls.tsx` no longer needs `disabled={editsLocked}` on the Sequence `PresetMenu` (line 213) — the card's `inert` body both blocks interaction and (via the cascade) styles it. Removing it makes the lock mechanism uniform across all Song-tab cards (single source: `locked={editsLocked}` on the card). The `disabled` props that encode *logic* (toolbar buttons disabled because there's no active step, stepper at min/max) stay — those are unrelated to the lock.

---

## Motion & Visual Summary

| Element | Property animated | Curve | Duration / delay |
|---|---|---|---|
| Card accent line (`::before`) | `transform: scaleY`, `opacity` | ease | 300ms |
| Lock slot | `width` (0 → icon+gap) | ease | 300ms |
| Lock icon | `opacity`, `transform: scale` | ease | 240ms, 60ms delay |
| Card body | `opacity` (1 → 0.75) | ease | 300ms (existing) |
| Controls in locked card | `opacity` | ease | 300ms (cascade) |

All transitions are skipped under `@media (prefers-reduced-motion: reduce)` — see below.

### Reduced motion

Add to `InspectorCard.module.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .card::before,
  .lockSlot,
  .lockIcon,
  .cardBody {
    transition: none;
  }
}
```

(The `controls.css` transition is already gated behind `prefers-reduced-motion: no-preference`, so it is absent under reduce.)

---

## Component / File Changes

| File | Change |
|---|---|
| `src/components/Inspector/InspectorCard.tsx` | Wrap `<h3>` + always-rendered `<Lock>` in `.cardTitle` / `.lockSlot` |
| `src/components/Inspector/InspectorCard.module.css` | Remove locked box-shadow rules; add `::before` accent wipe; add `.cardTitle` / `.lockSlot`; replace `.lockIcon` rules; add reduced-motion block |
| `src/styles/semantic.css` | Add `--control-disabled-opacity` token |
| `src/styles/controls.css` (new) | Global `inert` disabled cascade |
| `src/main.tsx` | Import `controls.css` |
| `src/components/Switch/Switch.module.css` | `:disabled` opacity → token |
| `src/components/Inspector/ChordTypeGrid.module.css` | `:disabled` opacity → token |
| `src/components/StepperShell/StepperShell.module.css` | `:disabled` opacity → token |
| `src/components/SongControls/SongControls.tsx` | Drop redundant `disabled={editsLocked}` on Sequence `PresetMenu` |
| `src/components/Inspector/InspectorCard.test.tsx` | Icon presence tests → `data-locked` / always-present assertions |
| `src/components/SongControls/SongControls.test.tsx` | "shows lock icons" test → assert locked-card controls are within `[inert]` (cascade target) |

---

## Test Changes

- **InspectorCard.test.tsx**
  - "renders a header lock icon when locked=true" → keep, still passes (icon present).
  - "does not render a lock icon when locked=false" → **rewrite**: the icon is always rendered now; assert instead that an unlocked card has no `data-locked` section *and* the lock icon is present-but-decorative (`aria-hidden`). Concretely: `section[data-locked='true']` is null, `.lucide-lock` is in the document, and its closest `[aria-hidden='true']` wrapper exists.
  - Add: "always renders the lock icon regardless of locked (visibility is CSS-driven)" asserting `.lucide-lock` is present for both `locked` and unlocked renders.
- **SongControls.test.tsx**
  - "shows lock icons in the Key and Progression card headers during playback" (lines 220-232) → **repurpose** to guard the cascade: during playback, the Sequence trigger and a Progression-card control resolve `.closest("[inert]")` to a non-null element (so the shared disabled style applies). Keeps the icon assertions only as a secondary check (icons are always present).
  - Existing `data-locked` tests (lines 178-191, 235-244) and the inert Add-button test (lines 208-218) stay unchanged and remain the authoritative lock assertions.
- No i18n changes.

---

## Out of Scope

- Adding `disabled` support to `DegreeGrid` / `NoteGrid` as React props (the `inert` cascade already covers them visually inside locked cards; a standalone disabled prop is a separate need).
- Changing the `0.75` locked-body opacity or any other part of the shipped lock visual language.
- TransportBar, fretboard, progression playback engine.
- Converting components to a shared `cva` disabled variant (the token + cascade is the chosen composable mechanism; a cva refactor is larger and unnecessary here).

---

## Spec Self-Review

- **Placeholders:** None. All CSS/JSX shown in full.
- **Internal consistency:** Issue 1 removes the box-shadow accent and the light-mode workaround, replaced by a `::before` that does not touch `box-shadow`; the light-mode elevation shadow on `.card` is therefore preserved without special-casing. Issue 2's always-rendered icon is reconciled with the test suite in Test Changes. Issue 3's token feeds every control's `:disabled` rule and the `inert` cascade.
- **Specificity check:** `[inert] button` etc. are `(0,1,1)` and outrank component module classes `(0,1,0)`, so the cascade wins at rest without `!important`.
- **Opacity stacking:** Documented and intentional (`0.75 × 0.3`), matching the prior Sequence-dropdown look now applied uniformly.
- **A11y:** Lock icon stays `aria-hidden`; the global TransportBar `aria-live` announcement (shipped) remains the screen-reader signal. Reduced-motion disables all new transitions.
- **Scope:** Three cohesive issues over the same lock/disabled surface; one plan.
