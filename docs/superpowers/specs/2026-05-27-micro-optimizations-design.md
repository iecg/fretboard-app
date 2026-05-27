# React Micro-Optimizations Design

## Goal
Eliminate minor CPU overhead and garbage collection pressure in the React rendering cycle during progression playback and fretboard layout generation.

## Context
A fresh performance audit confirmed that the major hot-paths (Jotai atomic invalidation, SVG topology caching, CSS engine selectors) are highly optimized. However, two minor React reconciliation issues remain:

1. **`ProgressionTrack` Ruler Re-renders**: The `<ProgressionTrack>` component re-renders every time the playhead active step changes. Because the timeline ruler (which generates dozens of tick `<span>` elements) is rendered inline, React unnecessarily diffs these static elements 60 times a second.
2. **`FretboardHitTargetLayer` Inline Allocations**: The accessible fretboard buttons are rendered with an inline arrow function for the `onClick` handler. When the fretboard topology renders (e.g. on tuning changes), this instantiates 144 temporary arrow functions, adding slight pressure to the JavaScript Garbage Collector.

## Proposed Architecture

### 1. Progression Ruler Memoization
Extract the inline ruler DOM out of `ProgressionTrack.tsx` and into a new pure component: `ProgressionRuler.tsx`. 
- **Props**: `totalBarsForDisplay` (number), `subdivisionsPerBar` (number).
- Wrap the component in `React.memo`. 
- This ensures that when `ProgressionTrack` re-renders to update the playhead or active step, the ruler DOM is completely skipped by the React reconciler.

### 2. Hit Target Event Delegation
In `FretboardHitTargetLayer.tsx`, remove the inline `onClick` handlers from the individual `<button>` elements.
- Apply a single `onClick` event listener to the parent container `<div className={styles["fretboard-a11y-layer"]}>`.
- Add data attributes to the buttons (e.g. `data-string-index={stringIndex}`, `data-fret-index={fretIndex}`, `data-note-name={noteName}`).
- When the parent intercepts a click event, it will read these attributes from the `event.target` (using `closest("button")`) and invoke the top-level `onNoteClick` handler. 
- This drops the function allocation count per render from 144 down to 1.

## Verification
- Run the existing Vitest suite (`pnpm run test`) to ensure interactions (like clicking notes) and visual regression tests still pass.
- Verify `ProgressionRuler` prop stability in development using React DevTools Profiler (ensuring the component does not render when playback is active).
