# Reduce Forced Reflow in Fretboard — Design

**Goal:** Eliminate two sources of forced synchronous layout (reflow) in `Fretboard.tsx`: the auto-centering `useEffect` that reads `clientWidth` then writes `scrollTo` in the same post-paint effect, and the drag handler's `handlePointerMove` that reads `offsetLeft` per event.

## Changes

### Fix 1: Auto-centering — `useLayoutEffect` consolidation

**Problem:** `useEffect` at `Fretboard.tsx:187-216` reads `el.clientWidth` (triggering layout calculation after paint) then immediately calls `el.scrollTo(...)` (invalidating layout). The browser must synchronously reflow.

**Fix:** Move the `clientWidth` read + `scrollTo` write into the existing `useLayoutEffect` at line 166 (which already reads `clientWidth` for ResizeObserver setup). The layout effect runs before paint — one layout pass. Add a `ref` tracking whether centering has already happened to avoid re-running on every render.

### Fix 2: Drag handler — cache offsetLeft at pointerdown

**Problem:** `handlePointerMove` at `Fretboard.tsx:242-254` reads `scrollRef.current.offsetLeft` (layout read) then writes `scrollRef.current.scrollLeft` (layout write) in the same synchronous handler, on every pointermove event (up to 60+ times/s during drag).

**Fix:** Capture `scrollRef.current.offsetLeft` once in `handlePointerDown` and store in a ref. On pointermove, use the cached value instead of re-reading `offsetLeft`. Move the `scrollLeft` write inside a `requestAnimationFrame` to batch with the browser's natural layout cycle.

## Files

- Modify: `src/components/Fretboard/Fretboard.tsx`

## Risks

- Moving auto-centering to `useLayoutEffect` changes timing: it executes before the first paint. The first visible render will already be scrolled to the correct position — cleaner UX, no risk of flash.
- Caching `offsetLeft` in the drag handler assumes the scroll container doesn't move relative to the viewport during a drag gesture. The container is a full-width element that doesn't reposition on scroll — assumption holds.
