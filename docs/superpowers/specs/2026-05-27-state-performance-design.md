# Jotai State Performance Refactor Design

## Goal
Improve React rendering performance in the application by granularizing Jotai state access. We will prevent massive unneeded component re-renders by utilizing `selectAtom` for object slices and `splitAtom` for array states, primarily targeting large central store files.

## Architecture & Data Flow Strategy
Instead of components subscribing to monolithic atoms and re-rendering on any change:
- **`selectAtom` (from `jotai/utils`)**: Wraps large base atoms. Components will subscribe only to the precise property they need. A stable equality function will be used so object reference changes don't trigger updates if data is identical.
- **`splitAtom` (from `jotai/utils`)**: Will convert atoms that hold arrays into atoms that hold an array of *item atoms*. When a single item updates, only the component reading that specific item atom re-renders, rather than the parent list.

## Target Components & State Migration
1. **`chordOverlayAtoms.ts`**
   - Identify heavy derived object atoms.
   - Introduce `selectAtom` exports for components that only need a subset of the chord data.
2. **`progressionAtoms.ts`**
   - Apply `splitAtom` to the main progression step array.
   - Refactor `ProgressionTrack` (and related list UI) to render individual step components that subscribe to their specific item atom, preventing the entire track from re-rendering when the active playing step changes.

## Testing & Verification
- **Re-render Auditing:** Use React DevTools Profiler to verify that interacting with the fretboard or timeline no longer cascades re-renders to unaffected UI elements.
- **Unit Tests:** Ensure existing atom tests pass when `selectAtom` and `splitAtom` derivations are introduced.

## Scope
This design is strictly focused on state access granularity (performance). We are intentionally deferring other structural refactors (like moving state to component folders) to ensure we can accurately measure the performance gains in isolation.
