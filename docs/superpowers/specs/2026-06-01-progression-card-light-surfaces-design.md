# Progression Card — Light-Mode Surface Fix

**Date:** 2026-06-01
**Scope:** CSS-only restyle of the Song-tab Progression card in `modern-light`. No TypeScript or component-logic changes.

## Problem

In light mode, several surfaces in the Progression card read as harsh near-white that clashes with the warm parchment theme:

1. **Inactive chord-list degree chip** (`ProgressionStepList .chip`)
2. **Chord-edit notes strip** — the readout container and its note chips (`ChordTonesReadout .readout` / `.tone`)
3. **Chord-edit navigation pip** (`SongControls .editor-pager`)
4. **Chord-edit editor surface** (`SongControls .editor-panel`) reads as the same material as a selected/active step row — true in both light and dark mode.

### Root cause

These elements were authored for the dark "faceplate" aesthetic. The three white elements derive their background from `--faceplate-bg` via `color-mix(in srgb, var(--faceplate-bg) 60%, transparent)`:

- **Dark:** `--faceplate-bg = #0a121d` (near-black). Mixing 60% near-black over the panel yields a darker **sunken well** — matching the "sunken at rest" design intent in the source comments.
- **Light:** `--faceplate-bg = #f6f2e9`, which is the **brightest** rung of the light surface ladder. The same `color-mix` now produces a surface **brighter** than its container — a harsh near-white blob. The sunken intent is inverted.

The note chips compound this with `color-mix(in srgb, var(--text-main) 3%, transparent)` — a 3% ink wash over the already-near-white readout.

The editor panel is the same disease in a different form: `color-mix(in srgb, var(--faceplate-accent) 5%, transparent)` lets the bright card show through a faint teal wash, so it reads as the same teal-tinted material as the active step row (`color-mix(in srgb, var(--faceplate-accent) 8%, transparent)`).

The light theme already ships a proper surface ladder with genuine recessed tokens that these elements simply bypass:

```
well        #ddd8cf  (control well — distinctly sunken)
card-soft   #e3ddd0  (PANEL-SOFT — the InspectorCard surface behind the progression card)
base        #efebdf
card-nested #f1ede3  (inset card)
card-top    #f6f2e9  (PANEL — brightest card surface)
```

The InspectorCard that wraps the Progression section has a light background of `--surface-card-soft` (`#e3ddd0`), so that is the base surface behind the step list and the editor panel.

## Approach

**Centralized per-theme tokens.** Add three semantic tokens in `src/styles/semantic.css`, defined in both the light (`[data-theme="modern-light"]`) and dark (`[data-theme="modern-dark"]` / `:root`) faceplate blocks. Dark values reproduce the **current expressions verbatim** so dark mode is byte-identical (except the intentional editor-panel separation in §3). Light values route through the warm surface ladder. Component CSS then references the tokens instead of the hardcoded `color-mix` expressions.

This was chosen over per-component `[data-theme]` overrides (scatters logic across three files, easy to drift) and inline expression swaps (repeats magic numbers, no shared source of truth). The token approach matches how the codebase already models surfaces via the ladder.

## Design

### 1. New tokens (`src/styles/semantic.css`)

Add to **both** faceplate token blocks (light and dark):

| Token | Dark value (unchanged behavior) | Light value | Role |
|---|---|---|---|
| `--faceplate-inset` | `color-mix(in srgb, var(--faceplate-bg) 60%, transparent)` | `var(--surface-well)` (`#ddd8cf`) | Sunken well: degree chip, nav pip, notes-strip container |
| `--faceplate-key` | `color-mix(in srgb, var(--text-main) 3%, transparent)` | `var(--surface-card-nested)` (`#f1ede3`) | Raised note key inside the well |
| `--faceplate-surface` | `var(--faceplate-bg-elevated)` (`#0d1726`) | `var(--surface-card-top)` (`#f6f2e9`) | Editor focal-panel base |

The dark tokens carry the existing expressions so no dark surface changes. (Both the chip, pager, and readout share the same `color-mix(... faceplate-bg 60% ...)` expression today, so one token covers all three.)

### 2. Element re-mapping

**`src/components/SongControls/ProgressionStepList.module.css`**
- `.chip` `background-color` → `var(--faceplate-inset)`. Inactive chip becomes a warm sunken well instead of near-white. The `.active .chip` teal override is unchanged.

**`src/components/SongControls/SongControls.module.css`**
- `.editor-pager` `background-color` → `var(--faceplate-inset)`. Sunken control in the panel header.

**`src/components/SongControls/ChordTonesReadout.module.css`**
- `.readout` `background-color` → `var(--faceplate-inset)` (sunken strip).
- `.tone` `background-color` → `var(--faceplate-key)` (raised key). The `.tone.root` teal override is unchanged.

Resulting depth ladder inside the editor panel (light): panel `#f6f2e9` (brightest) → note keys `#f1ede3` → readout well `#ddd8cf` (sunken). The note keys sit **below** the panel's brightness, so nothing out-whites its container — the harsh-white pop is eliminated, and the result mirrors the dark mode "sunken strip + raised keys" material language.

### 3. Editor surface vs. active step (both modes)

Teal is retained; the fix is to the **material**, not the hue.

**`src/components/SongControls/SongControls.module.css`**
- `.editor-panel` `background-color` → `color-mix(in srgb, var(--faceplate-accent) 5%, var(--faceplate-surface))`.

This replaces the transparent wash (which let the container show through) with an **opaque raised base** carrying the teal whisper — light `#f6f2e9`, dark `#0d1726`. The teal border and the existing `box-shadow` are kept.

The master/detail split now reads as a material difference rather than only a tint difference: the step list stays a flat tint on `card-soft`, while the editor becomes a raised, teal-framed, shadowed card. The active row (`accent 8%` flat tint) and the editor panel no longer read as the same surface, in light and dark.

## Files touched

- `src/styles/semantic.css` — add three tokens to the light and dark faceplate blocks.
- `src/components/SongControls/ProgressionStepList.module.css` — `.chip` background.
- `src/components/SongControls/SongControls.module.css` — `.editor-pager` and `.editor-panel` backgrounds.
- `src/components/SongControls/ChordTonesReadout.module.css` — `.readout` and `.tone` backgrounds.

No TypeScript, component, or markup changes.

## Verification

- Verify live in both light and dark mode via the dev-server preview (Song tab → Progression card; open the chord editor to see the notes strip and pager).
- Confirm dark mode is visually unchanged apart from the intentional editor-panel separation (§3).
- Run `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- Refresh visual-regression snapshots with `pnpm run test:visual:update` — the `app-components` and `app-overlays` suites will shift for the light-mode Progression card.

## Out of scope

- Dark-mode white-element restyling (the dark surfaces are already correct).
- Any change to the active-state hue or the teal accent itself.
- The `--faceplate-bg-elevated`-based `.editor-degree-pill` and other controls not listed above.
