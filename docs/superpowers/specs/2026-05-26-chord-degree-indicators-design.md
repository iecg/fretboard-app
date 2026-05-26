# Chord Degree Indicators Design

## Summary

Replace the current per-shape unified color scheme for chord connector notes with a chord-degree-based ring color system. Each chord tone (root, third, fifth, seventh) gets a distinct ring color, and all chord-tone notes get a small white inner dot for contrast against CAGED shape fills. This solves the E shape root visibility problem and adds glanceable chord-degree identification to the fretboard.

## Problem Statement

Two related visual problems in the current chord connector system:

1. **E shape root note invisible.** In full-chord-mode, `data-full-chord-shape` CSS flattens all note fills and strokes to the CAGED shape color (`#E69F00` orange for E shape). The root note gets a tonic-ring stroke override (neon-orange), but on the orange fill it provides minimal contrast. The result is a yellow ring on a yellow fill — barely distinguishable.

2. **No chord-degree information.** Notes show their role (chord-root, chord-tone-in-scale, etc.) but not *which* degree they represent (root, third, fifth, seventh). Users can see which notes belong to the chord but cannot tell what each note contributes.

## Goals

- Every chord-tone note is instantly readable against any CAGED shape fill color.
- Each chord-tone note communicates its chord degree (root, third, fifth, seventh) at a glance.
- The connector polyline voicings remain clean — degree info lives on the notes, not the connectors.
- The lens system, scale-degree overlay, and other features interact correctly.
- CSS complexity decreases — replace the fragile `:last-of-type` root restoration with straightforward degree-driven rules.

## Non-Goals

- Adding text labels (R, 3, 5, 7) to notes — existing note-name and scale-interval labels already fill the bubble's text area.
- Replacing the existing note shape system (squircle, hexagon, diamond, circle) — shapes still indicate note role.
- Changing connector polyline colors — connectors remain single-color per voicing to preserve the shape-grouping visual.
- Extended chord degrees (9th, 11th, 13th) — only root, third, fifth, seventh get distinct ring colors in this iteration.

## Design

### 1. Chord Degree Color Map

Ring colors chosen from the Okabe-Ito palette (project standard) to avoid conflict with any CAGED shape fill color:

| Degree | Ring Color | Value | CAGED Conflict Check |
|--------|-----------|-------|---------------------|
| Root | Vermillion | `#D55E00` | Distinct from E shape orange `#E69F00` |
| 3rd | Yellow | `#F0E442` | Distinct from C shape green `#009E73` |
| 5th | Sky Blue | `#56B4E9` | Distinct from A shape blue `#0072B2` |
| 7th | Pink | `#F781BF` | Distinct from G shape purple `#CC79A7` |

Non-primary chord tones (2nd, 4th, 6th, extensions) fall back to `--note-ring-tonic` (neon-orange `#FF9A4D`) — they do not get dedicated degree colors.

### 2. Inner Contrast Dot

Every chord-tone note renders a small white-filled circle at center, ~35% of note radius. This:

- Breaks up the CAGED shape fill color so the note is readable on any background.
- Creates a consistent "these are chord-tone notes" visual language.
- Eliminates the need for shape-specific overrides.
- Works identically across all five CAGED shapes.

### 3. Chord Degree Detection

Determined from the chord quality's interval list (via Tonal.js `Chord.intervals()`):

- `1P` → root (chord-degree-1)
- `2m` / `2M` → second (chord-degree-2)
- `3m` / `3M` → third (chord-degree-3)
- `4P` → fourth (chord-degree-4)
- `5d` / `5P` / `5A` → fifth (chord-degree-5)
- `6m` / `6M` → sixth (chord-degree-6)
- `7d` / `7m` / `7M` → seventh (chord-degree-7)

The `chordDegree` field computed in `buildStaticFretboardTopology.ts` and stored on `StaticFretboardTopologyNote`. Rendered via a `data-chord-degree` attribute on the note group, consumed by CSS.

### 4. Full-Chord-Mode CSS Refactor

The existing `data-full-chord-shape` CSS rules are simplified:

- **Current**: Override `fill` + `stroke` to `var(--caged-{shape})`, then try to restore root stroke via `.chord-root :is(circle, path, polygon):last-of-type`.
- **New**: Override only `fill` to `var(--caged-{shape})`. Stroke driven by `data-chord-degree` (with `data-chord-degree="1"` = vermillion, `"3"` = yellow, `"5"` = sky blue, `"7"` = pink).

This eliminates the specificity battle and makes the root (and every other degree) readable by construction.

### 5. Connector Polylines

Connectors remain unchanged — single-color per voicing, driven by `data-palette-index` and `data-caged-shape`. Degree information lives on the note rings alone, keeping the fretboard from becoming visually noisy.

## Implementation Shape

1. Add `data-chord-degree` attribute to chord-tone notes in `buildStaticFretboardTopology.ts` (compute interval → degree mapping).
2. Pass chord degree info through to `FretboardNoteLayer.tsx` and render as `data-chord-degree` attribute on the note group.
3. Add inner contrast dot SVG element to chord-tone notes (white circle at 35% radius, rendered inside the note squircle/circle).
4. Add CSS variables for the four degree ring colors (both dark and light themes).
5. Refactor `FretboardSVG.module.css` full-chord-mode rules: replace `data-full-chord-shape` stroke overrides with `data-chord-degree` color selectors. Remove the `:last-of-type` root restoration hack.
6. Remove the chord-root halo squircle (now redundant — inner dot + degree color ring replaces it).
7. Update tests.

## Testing Strategy

### Unit tests
- `buildStaticFretboardTopology`: verify `chordDegree` is correctly assigned for major, minor, diminished, augmented, dominant 7th, maj7, min7 qualities.
- verify non-chord-tone notes do not get `chordDegree`.
- verify inner dot only appears on chord-tone notes.

### Visual regression
- Capture full-chord-mode screenshots for each CAGED shape (E, A, D, C, G) — verify root note is readable in all five.
- Capture full-chord-mode screenshots for each shape with a 7th chord quality (4 distinct degree colors visible).
- Run visual diff suite to detect unintended changes.

### Accessibility
- Verify color combinations meet WCAG contrast minima for the white inner dot against all five CAGED shape fills.
- Verify degree ring colors are distinguishable against both dark and light fretboard themes.

## Success Criteria

- E shape root note is immediately readable (no more yellow-on-yellow).
- Chord-degree ring colors are distinct and glanceable for all five CAGED shapes, both themes.
- All existing tests pass, including visual regression snapshots.
- `data-full-chord-shape` CSS is simpler (no `:last-of-type` hack).

## Risks and Trade-Offs

- Adding four new ring color CSS variables increases the theme surface area slightly.
- Inner dot adds one SVG `<circle>` per chord-tone note (at most ~6 notes) — negligible rendering cost.
- User must learn the color→degree mapping. This is a one-time cost, and the colors follow musical intuition (root = warm/first, third = bright/yellow, fifth = cool/blue, seventh = distinctive/pink).

## Recommendation

Proceed with chord-degree ring colors + inner contrast dot as designed. The approach solves both stated problems with minimal code change, eliminates an existing CSS hack, and follows the project's established Okabe-Ito color standard.
