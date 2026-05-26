# Wood Grain Texture Optimization

## Problem

`useWoodGrainTexture` generates a wood grain texture by:
1. Creating an inline SVG string with `feTurbulence` filters
2. Loading that SVG into an `Image` via a Blob URL
3. Rasterizing the SVG to a Canvas via `drawImage`
4. Encoding to PNG via `canvas.toDataURL('image/png')`

Step 4 blocks the main thread for ~135ms on every page load and every fretboard pan (when `startFret`/`maxFret` change). The LCP trace shows this as the single largest contributor to the 516ms element render delay.

## Solution

Remove the Canvas rasterization entirely. Use the live SVG `feTurbulence` filters as the primary rendering path. These filters (wood grain, highlights, pores) are already defined in `FretboardDefs.tsx` and are GPU-accelerated in Chrome/Blink, running as shaders rather than on the main thread.

## Changes

### Delete `src/components/FretboardSVG/hooks/useWoodGrainTexture.ts`

Remove the entire 76-line hook. It is only consumed by `FretboardBackground.tsx`.

### Edit `FretboardBackground.tsx`

- Remove the `useWoodGrainTexture` import and call
- Remove the `<image>` element (the rasterized PNG overlay) and its conditional rendering
- The three `feTurbulence` filter rects (grain, highlights, pores) are always rendered — this is already the existing fallback path

### Edit `FretboardBackground.test.tsx`

- Remove the `vi.mock(...)` for `useWoodGrainTexture` since the module won't exist
- The test currently exercises the SVG filter fallback path (mocked return `null`) — this path is now the primary path, so tests should pass unchanged

## Risks

- **SVG `feTurbulence` GPU cost:** In theory, live filter compositing is heavier than a single PNG texture. In practice, Chrome/Blink's GPU-accelerated `feTurbulence` makes the difference negligible for a single SVG view. No browser has been identified that falls back to CPU rendering for these filter primitives.
- **Visual regression:** The rendered output is identical — same defs, same filter parameters, same color matrix values. Only the rendering mechanism changes.
