# Card Visibility Fixes — Design Spec

**Goal:** Fix two UI issues in the InspectorCard: controls falsely appearing disabled when overlay visibility is off, and layout shift when the state label ("Showing"/"Hidden") changes width.

**Files touched:** `src/components/Inspector/InspectorCard.module.css` only — pure CSS fixes.

---

## Issue 1: Disabled-style dimming on active controls

### Problem

When `active={false}` (overlay hidden), `InspectorCard` sets `data-active="false"`, which triggers `.card[data-active="false"] .cardBody { opacity: 0.42; }`. The controls inside (pattern selector, voicing controls, etc.) remain fully interactive — they change scale patterns, toggle the overlay back on, etc. — but they *look* disabled, which is misleading.

### Solution

Remove the body-dim rule entirely. The card body always renders at `opacity: 1`. The only visual feedback that the overlay is hidden comes from:
- The `<Switch>` in the card header is toggled off.
- The stateLabel text reads "Hidden" (vs "Showing").
- The stateLabel color shifts to muted via `.card[data-active="false"] .cardState { color: var(--dc-fg-muted); }` — this rule remains.

---

## Issue 2: Layout shift on stateLabel text change

### Problem

The card header is a flex row: `[Switch] [h3 name] [stateLabel] [description (flex:1)] [actions]`. The `cardState` span has `flex: 0 0 auto` (default) — its width depends on rendered text. When "Showing" (7 chars) ↔ "Hidden" (6 chars) or Spanish "Mostrando" (9 chars) ↔ "Oculto" (7 chars), the width changes. The `cardDesc` span with `flex: 1` reflows into the vacated/gained space, shifting the description text.

### Solution

Add `min-width: 11ch` to `.cardState`. The font is monospace at `0.625rem` with `letter-spacing: 0.18em` and `text-transform: uppercase`. The widest translation is Spanish `MOSTRANDO` (9 chars). `11ch` accounts for the base character width plus letter-spacing overhead (~10.6ch needed), reserving enough room so text changes never push the description.

---

## Test Plan

- Visual: verify card body has no opacity change when switch is toggled off.
- Visual: verify description text does not shift when stateLabel changes between "Showing" and "Hidden" (or Spanish equivalents).
- Unit: existing `InspectorCard` tests pass (no functional changes).
