# Full Chord Mode CSS Rendering Performance Design

## Goal
Improve the rendering performance of the fretboard during rapid "Full Chord Mode" playback by eliminating complex, CPU-heavy CSS attribute selectors.

## Context
When "Full Chord Mode" is enabled, the SVG fretboard dynamically colors specific note elements based on their CAGED shape (E, A, D, G, C) to visualize intersecting chord shapes. 

Currently, this is handled by CSS rules matching deep attribute structures, such as:
`.fretboard-board[data-full-chord-mode="true"] .fretboard-note[data-full-chord-shape="E"] path`

When chords change quickly (especially during audio playback or rapid interaction), the browser's CSS engine struggles to evaluate these selectors across hundreds of SVG nodes, resulting in layout thrashing, style recalculation overhead, and dropped frames.

## Proposed Architecture: CSS Variables on Groups
To bypass the CSS attribute-selector bottleneck while preserving CSS-based theming, we will transition the dynamic styling responsibility partially into React via inline CSS variables.

1. **React Level (`FretboardNoteLayer.tsx`)**:
   - Compute inline CSS variables for each active shape note mapping its CAGED identifier to theme tokens (`--shape-fill`, `--shape-stroke`, `--text-fill`).
   - Attach these variables to the wrapper `<g>` element using the React `style` prop.
   - Replace the specific `data-full-chord-shape="[A-G]"` attribute with a generic, boolean `data-full-chord-mode` marker.

2. **CSS Level (`FretboardSVG.module.css`)**:
   - Delete all shape-specific color permutations.
   - Use a single, simplified inheritance rule that matches the generic boolean marker and reads the injected variables:
     ```css
     .fretboard-board[data-full-chord-mode="true"] .fretboard-note:where([data-full-chord-mode]) :is(circle, path, polygon) {
       fill: var(--shape-fill);
       stroke: var(--shape-stroke, var(--shape-fill));
     }
     ```

## Advantages
- **Performance**: The browser evaluates one simple rule instead of iterating through dozens of permutations, vastly improving 60FPS playback rendering.
- **Maintainability**: New shapes or themes no longer require adding boilerplate permutations to the CSS file.
- **Separation of Concerns**: Colors remain defined in global CSS tokens, preventing hardcoded HEX values from leaking into the React layout layer.

## Verification
- Unit tests (`FretboardSVG.test.tsx`) will be updated to assert against the presence of the inline CSS variables on the parent `<g>` node rather than the computed `fill` of the inner `<path>`.
- Manual performance validation by toggling full-chord shapes rapidly in the dev server.
