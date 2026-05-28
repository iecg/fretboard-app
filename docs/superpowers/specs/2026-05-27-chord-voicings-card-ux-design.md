# Chord Voicings Card UX Polish — Design

**Status:** Approved. Implementation sequenced **after** the Lens Consolidation spec (item 6 / group B) lands, so the toggle bar can take the row space the Lens control currently occupies without an interim layout reflow.

**Goal:** Make the chord-voicings card honest about which strings the engine is using, and replace the low-visibility string-set dropdown with a toggle bar that mirrors the CAGED shape control.

**In scope:** items 1, 4, 9 from the 2026-05-27 grab-bag brainstorm.

**Out of scope:** item 2 (CAGED-E recolor), item 6 (lens consolidation), items 3 + 8 (theming), item 10 (overlay surface promotion), item 7 (onboarding). Each gets its own spec.

---

## Context

### Current state

`src/store/chordOverlayAtoms.ts`:

- `voicingStringSetAtom` — `atomWithStorage<string>` holding the option id (`"all"` or `"0-1-2"` style).
- `stringSetOptionsAtom` — emits `[ALL_STRINGS_OPTION]` when no chord is active, otherwise emits *only* the consecutive-string windows from `buildStringSetOptions(voiceCount)`. The `ALL_STRINGS_OPTION` sentinel is **never** prepended in the chord-active branch.
- `effectiveStringSetAtom` — when the stored id doesn't match any option (or matches a disabled one), silently falls back to **first enabled option's strings**, else `ALL_STRINGS_OPTION.strings` (all 6 strings).

`src/components/ChordOverlayControls/`:

- `ChordOverlayControls.tsx` renders the picker `Prop` cell whenever `voicing === "close" || (voicing === "full" && hasFallback)`.
- `ChordStringSetPicker.tsx` wraps `shared/StringSetPicker` (a `LabeledSelect`-based dropdown). Contains an auto-heal `useEffect` that snaps `voicingStringSetAtom` to first enabled option when the stored id is invalid or disabled.

`src/components/FingeringPatternControls/FingeringPatternControls.tsx` has `shapeToggleBar` — the CAGED shape toggle: a single horizontal row of `motion.button`s using `shared["toggle-btn"]` styles, with an `All` button + per-shape buttons. This is the reference pattern for the new string-set toggle bar.

### Bugs and UX gaps

1. **Item 1 — blank picker dead-end.** When every consecutive-string window is disabled (e.g. C dim / C major scale / G shape), the dropdown trigger shows the stored value with no enabled options, looking blank-and-broken. `effectiveStringSetAtom` silently uses all 6 strings under the hood — UI lies about engine state.
2. **Item 4 — phantom control in full+fallback mode.** Picker renders during full-mode fallback but `effectiveStringSetAtom`'s auto-fallback already overrides the user's pick when their window is disabled. Picker pretends to control something it doesn't.
3. **Item 9 — low-visibility dropdown.** Compact but adds extra click cost and visually disappears next to the more prominent toggle controls (Voicing, Lens, CAGED shapes).

---

## Design

### A1 — Always-visible toggle bar; honest dead-end (item 1)

- `stringSetOptionsAtom` stops emitting `ALL_STRINGS_OPTION` entirely. Chord-not-set branch returns `[]`. Chord-active branch unchanged (just the consecutive-string windows, with disable flags).
- New `ChordStringSetToggleBar` component (replaces `ChordStringSetPicker`) always renders in close mode when there's an active chord, regardless of how many options are disabled. Disabled buttons stay visible with greyed styling + `disabledReason` as `title` tooltip.
- When every window is disabled, the visible all-greyed bar **is** the message: "no close voicing fits any string set in this position." User reads it, changes position or switches to full mode.
- `effectiveStringSetAtom` rewrite: gate on `voicingAtom`.
  - `voicing === "full"` → always returns `ALL_STRINGS` (all 6 strings). No user-pick consultation.
  - `voicing === "close"` → returns stored window's strings if option exists and is enabled; if stored exists but is disabled and at least one option is enabled, returns first-enabled's strings (auto-heal path); if no enabled option exists, returns the stored window's strings unchanged so engine renders nothing and the toggle bar shows the dead-end honestly.
- Auto-heal `useEffect` moves from `ChordStringSetPicker` into the new toggle-bar component, same logic: snap `voicingStringSetAtom` to first enabled when stored is invalid or disabled. When no enabled option exists, it's a no-op (stored stays put).

### A2 — Hide picker in full mode (item 4)

- `ChordOverlayControls.tsx` row 1 cell renders the toggle bar `Prop` only when `voicing === "close" && hasActiveChord`. Drop the `(voicing === "full" && hasFallback)` branch entirely.
- No code change needed in `voicingFallbackAtoms.ts`. A1's voicing-mode-aware `effectiveStringSetAtom` returns `ALL_STRINGS` in full mode; `fallbackVoicingMatchesAtom`'s existing `stringSet.size === 6` short-circuit then skips the filter automatically. Cascading behavior, not a duplicated rule.
- User intent: full mode is a "best-effort" surface where the system picks; close mode is a precision surface where the user picks.

### A3 — Dropdown → toggle bar (item 9)

- New component `src/components/ChordOverlayControls/ChordStringSetToggleBar.tsx` (replaces `ChordStringSetPicker.tsx`). Visual model: copy `shapeToggleBar` from `FingeringPatternControls.tsx` (single row of `motion.button` elements using `shared["toggle-btn"]` + a local `chordStringSetButton` class as needed).
  - One button per consecutive-string window. Label format: `strings.map((n) => n + 1).join("·")` — same as today's `StringSetPicker.formatLabel`, e.g. `"1·2·3"`.
  - **No `All` button.** Per item 1's design, `All` is not a pickable concept in close mode.
  - Disabled buttons: `disabled` attribute, `aria-disabled="true"`, `title={disabledReason}`, visual treatment matching disabled state in `shared["toggle-btn"]`.
  - Active button: `aria-pressed="true"` + `shared.active`.
  - `whileTap={{ scale: 0.96 }}` and the same scale-pulse on activation as `shapeToggleBar`.
- `ChordOverlayControls.tsx` `Prop` cell `span` grows from `2` → `9` (matching `shapeToggleBar` row width) so the toggle bar gets adequate horizontal room. Worst case 4 buttons fits comfortably in a 9-column span at every layout tier (mobile, tablet-split, desktop-3col).
- Row layout while lens still exists (interim, will not occur — see Sequencing):
  - Row 1: `Voicing (span 3) | Lens (span 5) | String set (span 9)` — overflows 12 columns, wraps String set to row 2.
- Row layout after lens cleanup (target state):
  - Close mode: `Voicing (span 3) | String set (span 9)` — single row, 12 columns.
  - Full mode: `Voicing (span 3)` alone — or repurpose the freed span for a different control (TBD by group B's spec; not this one's problem).

### Cleanups / collateral

- Delete `ChordStringSetPicker.tsx` and its test; replace with `ChordStringSetToggleBar.tsx` + test.
- Sweep usages of `ALL_STRINGS_OPTION` after the `stringSetOptionsAtom` change. Expected consumers: only `stringSetOptionsAtom` itself (chord-not-set branch — removed) and `effectiveStringSetAtom` (kept as the all-6-strings constant for full mode). Inline the constant if no longer worth a separate export.
- Update `voicingStringSets.test.ts` to reflect the new emission contract (still no `ALL_STRINGS_OPTION` in `buildStringSetOptions`; that test stays).
- Update `chordOverlayAtoms.test.ts` cases for `stringSetOptionsAtom` (no-chord branch now empty) and `effectiveStringSetAtom` (mode-aware behavior).

### Out of scope explicitly

- Connector dimming when fallback is in use — already addressed (FIX-3 dashed stroke).
- Visual snapshot refresh — required by the implementation plan but not a design decision here.

---

## Tests

### Atom contracts (`src/store/`)

- **`stringSetOptionsAtom`:**
  - No chord active → returns `[]`.
  - Chord active + no position fits → returns all windows with `disabled: true` + `disabledReason` set.
  - Chord active + partial fits → mix of enabled/disabled, preserves `disabledReason` on disabled entries.
  - Never includes an `ALL_STRINGS_OPTION` entry (regression-guard).
- **`effectiveStringSetAtom`:**
  - `voicing === "full"` → returns `ALL_STRINGS` regardless of stored value or option list.
  - `voicing === "close"` + stored enabled → returns stored window's strings.
  - `voicing === "close"` + stored disabled + ≥1 enabled → returns first enabled's strings (auto-heal path).
  - `voicing === "close"` + stored disabled + 0 enabled → returns stored window's strings (no silent ALL fallback).
  - `voicing === "close"` + stored id not in options at all (e.g. after chord swap shrinks voice count) + ≥1 option → returns first enabled's strings.
- **`fallbackVoicingMatchesAtom`** (no code change; behavior emerges from A1's `effectiveStringSetAtom` update):
  - `voicing === "full"` → matches identical regardless of `voicingStringSetAtom` value (since `effectiveStringSetAtom` returns all 6 strings).
  - `voicing === "close"` → matches filtered by `effectiveStringSetAtom` membership (existing behavior preserved).

### Component contracts

- **`ChordOverlayControls`:**
  - Snapshot: voicing="close" + active chord → toggle bar present.
  - Snapshot: voicing="full" → no picker present, even when `hasFallback` is true.
  - Snapshot: voicing="close" + no active chord → toggle bar absent (`Prop` cell not rendered) because there's nothing to pick.
- **`ChordStringSetToggleBar`:**
  - Renders one `button` per option, label matches `strings.map(n => n+1).join("·")`.
  - Enabled button click → calls `setValue` with the button's option id.
  - Disabled button has `aria-disabled="true"` and `title` set to `disabledReason`; click is a no-op.
  - Active option's button has `aria-pressed="true"` and the `shared.active` class.
  - Auto-heal: when stored becomes disabled and another option is enabled, `setValue` is called with first-enabled's id on next effect tick.
  - Auto-heal no-op: when all options are disabled, `setValue` is never called.

### Visual / e2e

- Visual snapshot for close-mode toggle bar (active button + at least one disabled) — covered by existing app-overlays suite once components swap.
- E2e smoke: enter C major + D-shape CAGED + close voicing → toggle bar present with `1·2·3` enabled (open-C close voicing fits the truncated D-shape per the prior fix). Click another window → state updates. (Reuses scaffolding from existing chord-overlay e2e tests.)

---

## Sequencing

This spec MUST land **after** the Lens Consolidation spec (group B, item 6). Reason: A3 grows the string-set `Prop` to `span={9}`. While the Lens toggle still occupies `span={5}` in row 1, the result wraps to row 2 — visible regression of card height during the in-between commit. Sequencing lens-removal first means the toggle bar drops cleanly into the freed row width.

If we ever ship them out of order, the interim wrap is acceptable for one PR but should not stay merged into `main`.

The standalone CAGED-E recolor (item 2) is independent of this work and can land before, after, or between B and A without coordination.

---

## Files to touch

**Create:**
- `src/components/ChordOverlayControls/ChordStringSetToggleBar.tsx`
- `src/components/ChordOverlayControls/ChordStringSetToggleBar.test.tsx`
- `src/components/ChordOverlayControls/ChordStringSetToggleBar.module.css` *(if local styles are needed beyond `shared["toggle-btn"]`)*

**Modify:**
- `src/store/chordOverlayAtoms.ts` — `stringSetOptionsAtom` no-chord branch returns `[]`; `effectiveStringSetAtom` becomes voicing-mode-aware.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — render gate `voicing === "close" && hasActiveChord` only; bump `Prop` `span` from `2` to `9`; swap `ChordStringSetPicker` import to `ChordStringSetToggleBar`.
- `src/store/chordOverlayAtoms.test.ts` — atom contract updates per Tests section.
- `src/store/voicingFallbackAtoms.test.ts` — assert full-mode emergent bypass via `effectiveStringSetAtom` returning all 6 strings (regression-guard; no production code change).

**Delete:**
- `src/components/ChordOverlayControls/ChordStringSetPicker.tsx`
- `src/components/ChordOverlayControls/ChordStringSetPicker.test.tsx`
- `ALL_STRINGS_OPTION` export from `src/store/voicingStringSets.ts` (if no remaining consumers; otherwise keep as a private constant in `chordOverlayAtoms.ts`).

**Visual baselines:** refresh `e2e/app-overlays` and any chord-overlay-card visual specs at the end of implementation.
