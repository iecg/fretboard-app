# Render Performance & LCP Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate main thread contention during initial load by deferring heavy SVG rendering and removing synchronous DOM measurements that cause layout thrashing.

**Architecture:** 
The performance trace reveals two critical React issues during mount:
1. `FretboardSVG` is synchronously imported and rendered, blocking the main thread for ~300ms during the initial commit phase, delaying the LCP paint. We will decouple it using `React.lazy` and `Suspense`, allowing the text UI to paint instantly while the heavy SVG chunk evaluates in a subsequent task.
2. `useLayoutEffect` hooks in `Fretboard.tsx` read `clientWidth` during the commit phase, forcing the browser to synchronously recalculate layout before painting (layout thrashing). We will downgrade these to `useEffect` to shift DOM reads out of the critical rendering path.

**Tech Stack:** React 19 (`lazy`, `Suspense`, `useEffect`), Vite.

---

### Task 1: Defer FretboardSVG via React.lazy

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx`

- [ ] **Step 1: Replace the static import with a lazy import**

In `src/components/Fretboard/Fretboard.tsx`, replace the static `FretboardSVG` import with `lazy` and `Suspense`.

```tsx
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, lazy, Suspense } from "react";
// ...
// Remove: import { FretboardSVG } from "../FretboardSVG/FretboardSVG";

const LazyFretboardSVG = lazy(() => 
  import("../FretboardSVG/FretboardSVG").then((m) => ({ default: m.FretboardSVG }))
);
```

- [ ] **Step 2: Wrap the SVG in a Suspense boundary**

Inside the render method, replace `<FretboardSVG />` with `<LazyFretboardSVG />` wrapped in a `<Suspense>` block. The fallback should preserve the layout height so the page doesn't jump when the SVG loads.

```tsx
      <div
        className={clsx(styles["fretboard-wrapper"], styles["hide-scrollbar"])}
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <Suspense fallback={<div style={{ height: `${tuning.length * stringRowPx}px`, width: "100%" }} />}>
          <LazyFretboardSVG
            effectiveZoom={effectiveZoom}
            // ... (keep all exact same props as before)
            onNoteClick={handleFretClick}
          />
        </Suspense>
      </div>
```

- [ ] **Step 3: Run the build to verify chunking**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: PASS, and Vite will output a new chunk for `FretboardSVG`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx
git commit -m "perf(components): defer FretboardSVG rendering via React.lazy and Suspense"
```

---

### Task 2: Eliminate Layout Thrashing

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx`

- [ ] **Step 1: Downgrade `useLayoutEffect` hooks to `useEffect`**

In `src/components/Fretboard/Fretboard.tsx`, locate the `useLayoutEffect` that initializes the `ResizeObserver` and reads `el.clientWidth`. Change it to `useEffect`.

```tsx
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
```

Also downgrade the auto-centering effect, which reads `el.clientWidth` and calls `scrollTo`. By shifting this to `useEffect`, we allow the browser to paint the SVG first before calculating the scroll target, eliminating the forced synchronous reflow.

```tsx
  useEffect(() => {
    if (!autoCenterTarget) return;
    const el = scrollRef.current;
    if (!el) return;
    const containerW = el.clientWidth;
    // ... keep the rest exactly the same
  }, [autoCenterTarget, recenterKey]);
```
*(Leave the `geometryRef` update as `useLayoutEffect` since it only writes to a ref and does not read from the DOM).*

- [ ] **Step 2: Run linter and tests**

Run: `pnpm eslint src/components/Fretboard/Fretboard.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx
git commit -m "perf(components): shift DOM layout reads to useEffect to prevent layout thrashing"
```

---

### Note on Resource Contention (Vite Dev Server)
The 237 requests and deep `Evaluate module` tasks are a known side-effect of Vite's unbundled ESM development server. In production, Vite uses Rollup to bundle, tree-shake, and minify these into 1-2 optimized chunks, completely eliminating this network/evaluation overhead. To accurately profile LCP and resource contention in the future, always profile using `pnpm build && pnpm preview`.
