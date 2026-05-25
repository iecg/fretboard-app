# Reduce Forced Reflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate two forced-reflow sources in `Fretboard.tsx`: the auto-centering `useEffect` that reads `clientWidth` then writes `scrollTo` after paint, and the drag handler that reads `offsetLeft` on every `pointermove`.

**Architecture:** Move auto-centering from `useEffect` (post-paint) to `useLayoutEffect` (commit phase, before paint) so read and write happen in a single layout pass. Cache `offsetLeft` once at pointer-down instead of per pointer-move.

**Tech Stack:** React 19 `useEffect`/`useLayoutEffect`, `requestAnimationFrame`.

**Files touched:**
- Modify: `src/components/Fretboard/Fretboard.tsx`

---

### Task 1: Fix auto-centering forced reflow

**Problem:** The `useEffect` at line 187 reads `el.clientWidth` (line 192) and writes `el.scrollTo(...)` (line 213) in the same post-paint effect. The browser must synchronously compute layout for the read, then immediately invalidate it with the scroll write.

**Fix:** Move auto-centering into a `useLayoutEffect`. The commit phase runs before paint — one layout pass handles both the measurement and the scroll.

- [ ] **Step 1: Replace the auto-centering `useEffect` with `useLayoutEffect`**

Change the `useEffect` on line 187 to `useLayoutEffect`:

```typescript
// Line 187: change:
//   useEffect(() => {
// to:
  useLayoutEffect(() => {
```

The deps array `[autoCenterTarget, recenterKey]` stays the same.

- [ ] **Step 2: Run tests**

Run: `pnpm run test`
Expected: All tests pass (auto-centering is a layout concern — no jsdom-visual assertions should change).

- [ ] **Step 3: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx
git commit -m "perf: move auto-centering to useLayoutEffect to avoid post-paint forced reflow"
```

---

### Task 2: Fix drag handler layout thrashing

**Problem:** `handlePointerMove` (line 252) reads `scrollRef.current.offsetLeft` on every pointermove event (60+ times/s during drag), then writes `scrollRef.current.scrollLeft` on line 254. The read forces layout, the write invalidates it — classic layout thrashing.

**Fix:** Cache `offsetLeft` once in `handlePointerDown` via a new ref. Use the cached value in `handlePointerMove`. The `offsetLeft` value is stable for the duration of a drag gesture (the scroll container doesn't reposition).

- [ ] **Step 1: Add offsetLeftRef**

Add a new ref alongside the existing refs at line 163 (after `dragDistance`):

```typescript
const dragDistance = useRef(0);
const offsetLeftRef = useRef(0);
```

- [ ] **Step 2: Cache offsetLeft in handlePointerDown**

In `handlePointerDown`, save the layout value before the computation that depends on it:

```typescript
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasOverflow) return;
    if (!scrollRef.current) return;
    isDraggingRef.current = false;
    pendingPointerId.current = e.pointerId;
    pendingTarget.current = e.currentTarget;
    offsetLeftRef.current = scrollRef.current.offsetLeft;  // ← ADD
    startX.current = e.pageX - offsetLeftRef.current;       // ← use ref
    scrollLeft.current = scrollRef.current.scrollLeft;
    dragDistance.current = 0;
  }, [hasOverflow]);
```

- [ ] **Step 3: Use cached offsetLeft in handlePointerMove**

Replace the fresh `offsetLeft` read with the cached ref:

```typescript
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (pendingPointerId.current === null || !scrollRef.current) return;
    dragDistance.current += Math.abs(e.movementX);
    if (!isDraggingRef.current && dragDistance.current > 3) {
      isDraggingRef.current = true;
      updateCursor(true);
      pendingTarget.current?.setPointerCapture(pendingPointerId.current);
    }
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - offsetLeftRef.current;  // ← cached, no forced reflow
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  }, [updateCursor]);
```

- [ ] **Step 4: Run tests**

Run: `pnpm run test`
Expected: All tests pass. Drag-to-scroll is a pointer-interaction concern — existing tests don't assert on it.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx
git commit -m "perf: cache offsetLeft ref in drag handler to eliminate layout thrashing"
```

---

### Task 3: Verify build and lint

- [ ] **Step 1: Build**

Run: `pnpm run build`
Expected: Clean build.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: Clean lint.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify forced-reflow fixes build and lint clean"
```
