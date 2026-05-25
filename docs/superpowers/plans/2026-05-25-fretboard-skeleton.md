# Skeleton Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a responsive, pulsing skeleton loader that perfectly matches the fretboard's layout geometry across desktop, tablet, and mobile devices while `FretboardSVG` is lazily evaluating.

**Architecture:** 
When we deferred the heavy `FretboardSVG` rendering using `React.lazy`, we used a transparent, empty `<div />` as the fallback. While this prevents layout shifts (CLS), it leaves a blank void on the screen for ~300ms while the SVG chunk evaluates. We will build a lightweight `FretboardSkeleton` component that receives the exact same responsive geometry variables (`neckWidth`, `neckHeight`, `stringRowPx`) as the real SVG. It will render a simplified fretboard board (just the wood background and straight string lines) with a CSS opacity pulse animation. Because it uses the exact same `effectiveZoom` and width calculations, it will perfectly fit desktop, tablet, and mobile layouts.

**Tech Stack:** React, SVG, CSS Modules.

---

### Task 1: Create the FretboardSkeleton Component

**Files:**
- Modify: `src/components/Fretboard/Fretboard.module.css`
- Create: `src/components/Fretboard/FretboardSkeleton.tsx`

- [ ] **Step 1: Add skeleton CSS classes**

In `src/components/Fretboard/Fretboard.module.css`, append the CSS keyframes and classes for the skeleton pulse animation.

```css
.skeleton-container {
  position: absolute;
  top: 0;
  left: 0;
  animation: fretboard-pulse 1.5s infinite ease-in-out;
  border-radius: 4px;
  overflow: hidden;
}

.skeleton-svg {
  display: block;
}

@keyframes fretboard-pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.3; }
  100% { opacity: 0.6; }
}
```

- [ ] **Step 2: Create FretboardSkeleton.tsx**

Create `src/components/Fretboard/FretboardSkeleton.tsx`. It will render a simple SVG matching the fretboard proportions, containing a dark background rectangle and horizontal lines for the strings. (Use `--neutral-800` for the wood and `--neutral-600` for the strings, matching standard app tokens).

```tsx
import styles from "./Fretboard.module.css";

interface FretboardSkeletonProps {
  neckWidthPx: number;
  neckHeight: number;
  numStrings: number;
  stringRowPx: number;
}

export function FretboardSkeleton({
  neckWidthPx,
  neckHeight,
  numStrings,
  stringRowPx,
}: FretboardSkeletonProps) {
  const strings = Array.from({ length: numStrings });

  return (
    <div
      className={styles["skeleton-container"]}
      style={{ width: neckWidthPx, height: neckHeight }}
      aria-hidden="true"
    >
      <svg width={neckWidthPx} height={neckHeight} className={styles["skeleton-svg"]}>
        <rect width="100%" height="100%" fill="var(--neutral-800)" />
        {strings.map((_, i) => (
          <line
            key={`skeleton-string-${i}`}
            x1="0"
            y1={i * stringRowPx + stringRowPx / 2}
            x2="100%"
            y2={i * stringRowPx + stringRowPx / 2}
            stroke="var(--neutral-600)"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Fretboard/Fretboard.module.css src/components/Fretboard/FretboardSkeleton.tsx
git commit -m "feat(components): add responsive pulsing skeleton for fretboard loading state"
```

---

### Task 2: Inject Skeleton into the Suspense Boundary

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx`

- [ ] **Step 1: Import the Skeleton**

In `src/components/Fretboard/Fretboard.tsx`, import the new component.

```tsx
import { FretboardSkeleton } from "./FretboardSkeleton";
```

- [ ] **Step 2: Update the Suspense fallback**

Locate the `<Suspense>` boundary wrapping `<LazyFretboardSVG />`. Replace the empty fallback `div` with the `FretboardSkeleton`, passing it the exact geometry variables that `LazyFretboardSVG` consumes.

```tsx
        <Suspense 
          fallback={
            <FretboardSkeleton 
              neckWidthPx={neckWidth} 
              neckHeight={tuning.length * stringRowPx} 
              numStrings={tuning.length} 
              stringRowPx={stringRowPx} 
            />
          }
        >
```

- [ ] **Step 3: Run the build checks**

Run: `pnpm tsc --noEmit && pnpm eslint src/components/Fretboard/Fretboard.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx
git commit -m "perf(components): utilize fretboard skeleton during SVG lazy load"
```
