# Light Mode Audit

Date: 2026-04-30
Scope: research-only audit of the current light-mode implementation before any palette changes.

## Summary

- Light mode already has a dedicated theme layer in `src/styles/themes.css`, but the shell still leans cool blue-gray and the app gradient is effectively flattened.
- The fretboard already has maple-oriented base tokens, but the rendered result is being pushed darker and lower-contrast by the current texture, vignette, and inlay settings.
- Light-mode fretboard notes are intentionally forced to solid fills instead of ring-style bubbles.
- The header text uses light-theme tokens, but the SVG brandmark and SVG wordmark still hardcode neon cyan/orange fills and glow colors.
- Degree-color mode is a separate hardcoded palette path and will need an explicit decision: leave it independent, or harmonize it with the warmer light-mode direction.

## Key Findings

### 1. Theme shell and surfaces

- `src/styles/themes.css:11-37` controls the light shell, cards, nested surfaces, wells, and floating surfaces.
- `src/styles/themes.css:21-28` defines the light-mode app background gradient tokens.
- `src/styles/App.css:19-40` consumes the `--bg-app-*` tokens for the visible app background.
- The current light gradient is visually flat because `--bg-app-gradient-start`, `--bg-app-gradient-mid`, and `--bg-app-gradient-end` are all set to `#eef2f7`.
- The current shell warmth issue is not a missing feature. It is a token choice in `themes.css`.

### 2. Shared accent system

- `src/styles/themes.css:54-71` defines light-mode `--accent-primary`, `--neon-cyan*`, `--neon-orange*`, and `--neon-violet*`.
- `src/styles/semantic.css:123-165` fans those accents out into shared semantic roles:
  `--note-ring`, `--note-ring-tonic`, `--note-ring-color-tone`,
  `--chip-*`,
  `--role-scale-*`,
  `--role-chord-*`,
  `--role-color-tone-*`.
- This means a warmer light-mode pass will affect more than the header and fretboard. It will also touch chips, pills, active controls, and the circle of fifths unless those surfaces are decoupled.

### 3. Light-mode note bubbles are solid by design

- `src/styles/themes.css:174-203` overrides the fretboard note fill tokens in light mode so fills match the ring colors.
- `src/components/FretboardSVG/FretboardSVG.module.css:74-170` adds explicit light-mode selectors that replace ring-style interiors with solid fills for tonic, active, scale-only, color-tone, and chord-tone notes.
- `src/components/FretboardSVG/FretboardSVG.module.css:326-330` adds another solid-fill path for degree-color mode by setting both stroke and fill to `--degree-color`.
- Result: restoring hollow/ring-style note bubbles in light mode will require coordinated changes in both `themes.css` and `FretboardSVG.module.css`.

### 4. Fretboard wood, texture, and inlays

- `src/styles/themes.css:105-138` already defines light-mode fretboard wood, string, fret, nut, and inlay tokens.
- `src/components/FretboardSVG/FretboardDefs.tsx:18-35` builds the wood gradient and vignette.
- `src/components/FretboardSVG/FretboardDefs.tsx:36-106` defines the turbulence-based grain, highlight, and pore filters.
- `src/components/FretboardSVG/hooks/useWoodGrainTexture.ts:15-34` duplicates those turbulence settings for the rasterized texture path.
- `src/components/FretboardSVG/FretboardBackground.tsx:37-92` stacks the wood gradient, grain layers, and vignette in the rendered board.
- The maple base is present, but inlays are low-contrast because light-mode uses dark slate pearl stops with low opacities in `src/styles/themes.css:123-131`.
- Insets also compete against a fairly strong vignette and visible dark fret-wire shadowing from `src/components/FretboardSVG/FretboardBackground.tsx:96-118`.

### 5. Branding and logo paths

- `src/components/AppHeader/AppHeader.module.css:95-111` routes light-mode header text to `var(--neon-cyan)` and `var(--neon-orange)`.
- `src/components/BrandMark/BrandMark.tsx:31-92` hardcodes cyan/orange fills and glow filters with `#4DE4FF` and `#FF9A4D`.
- `src/components/FretFlowWordmark/FretFlowWordmark.tsx:29-89` does the same for the SVG wordmark.
- `public/favicon.svg` also contains hardcoded cyan branding.
- Result: changing light-mode brand color tokens alone will not fully update the logo system.

### 6. Degree-color mode is separate from theme accents

- `src/core/degrees.ts:66-99` hardcodes the degree palette and the blue-note color.
- `src/components/FretboardSVG/hooks/useNoteData.ts` injects `degreeColor` from `DEGREE_COLORS`.
- `src/components/DegreeChipStrip/DegreeChipStrip.module.css:145-149` and `src/components/ChordPracticeBar/ChordPracticeBar.module.css:195-199` use that degree palette in degree-color mode.
- If the goal is only warmer light mode and not a theory-color redesign, degree-color mode may be best left untouched.

## Inventory By Area

### App shell and surface warmth

- `src/styles/themes.css`
- `src/styles/App.css`
- `src/styles/index.css`
- `src/styles/semantic.css`
- `src/components/shared/shared.module.css`

### Fretboard rendering and materials

- `src/styles/themes.css`
- `src/components/FretboardSVG/FretboardDefs.tsx`
- `src/components/FretboardSVG/FretboardBackground.tsx`
- `src/components/FretboardSVG/hooks/useWoodGrainTexture.ts`
- `src/components/FretboardSVG/FretboardSVG.module.css`

### Brand and accent surfaces

- `src/components/AppHeader/AppHeader.module.css`
- `src/components/BrandMark/BrandMark.tsx`
- `src/components/FretFlowWordmark/FretFlowWordmark.tsx`
- `public/favicon.svg`
- `src/components/DegreeChipStrip/DegreeChipStrip.module.css`
- `src/components/ChordPracticeBar/ChordPracticeBar.module.css`
- `src/components/CircleOfFifths/CircleOfFifths.module.css`

## Test Constraints

- `e2e/theme-contract.spec.ts:45-64` currently locks in the cool shell color.
- `e2e/theme-contract.spec.ts:67-80` currently locks in the existing maple token values.
- `e2e/theme-contract.spec.ts:83-97` currently locks in solid active chip colors for light mode.
- Any intentional light-mode palette pass will need coordinated updates to these expectations.

## Planning Inputs

- Decide whether the warmer pass should affect only standard light mode or also degree-color mode.
- Decide whether the SVG brand assets should become token-driven, or just be retuned with new light-mode-specific hardcoded colors.
- Restore ring-style fretboard notes by changing both token values and light-mode selectors, not just one side.
- Improve visible inlays by adjusting pearl stop colors and opacity, then tune the wood texture and vignette only if contrast is still weak.
