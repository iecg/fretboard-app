# Skeleton & Loading State Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invisible fretboard skeleton, add a missing timeline skeleton, and remove the hardcoded Circle of Fifths loader from the Inspector's generic loading state.

**Architecture:** 
1. **Fretboard Skeleton:** The current SVG uses `--neutral-800` which does not exist in the app's token system, rendering it transparent/invisible. We will update it to use `var(--surface-well)` and `var(--surface-highlight)` which are properly mapped in both light and dark themes.
2. **Timeline Skeleton:** `ProgressionSummarySlot` is wrapped in `<Suspense fallback={null}>`. We will build a lightweight `TimelineSkeleton` matching the dimensions of the DAW progression track and use it as the fallback.
3. **Inspector Skeleton:** `ControlsPanelSkeleton` hardcodes a `.cof-skeleton` circle. Because `Inspector` hosts multiple tabs (and on mobile, CoF isn't even in the default tab), this creates a confusing UX where the CoF loader flashes inappropriately. We will replace the 3rd card with a generic `<CardSkeleton rows={4} />` for 3-column mode.

**Tech Stack:** React, CSS Modules.

---

### Task 1: Fix Fretboard Skeleton Visibility

**Files:**
- Modify: `src/components/Fretboard/FretboardSkeleton.tsx`

- [ ] **Step 1: Update CSS Variables**

In `src/components/Fretboard/FretboardSkeleton.tsx`, update the `fill` and `stroke` attributes to use valid surface tokens from the design system.

```tsx
      <svg width={neckWidthPx} height={neckHeight} className={styles["skeleton-svg"]}>
        <rect width="100%" height="100%" fill="var(--surface-well)" />
        {strings.map((_, i) => (
          <line
            key={`skeleton-string-${i}`}
            x1="0"
            y1={i * stringRowPx + stringRowPx / 2}
            x2="100%"
            y2={i * stringRowPx + stringRowPx / 2}
            stroke="var(--surface-highlight)"
            strokeWidth="2"
          />
        ))}
      </svg>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Fretboard/FretboardSkeleton.tsx
git commit -m "fix(components): map fretboard skeleton to valid surface theme tokens"
```

---

### Task 2: Create Timeline Skeleton

**Files:**
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.tsx`
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add TimelineSkeleton CSS**

In `src/components/LoadingSkeleton/LoadingSkeleton.module.css`, add a container class for the timeline skeleton.

```css
.timeline-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  height: 4.2rem;
  width: 100%;
}
```

- [ ] **Step 2: Create TimelineSkeleton Component**

In `src/components/LoadingSkeleton/LoadingSkeleton.tsx`, export a new `TimelineSkeleton` component that stacks two `SkeletonBar` components to mimic the ruler and lane.

```tsx
export function TimelineSkeleton() {
  return (
    <div className={styles["timeline-skeleton"]} aria-hidden="true">
      <SkeletonBar size="sm" width="100%" />
      <SkeletonBar size="md" width="100%" />
    </div>
  );
}
```

- [ ] **Step 3: Inject TimelineSkeleton into App.tsx**

In `src/App.tsx`, import `TimelineSkeleton` from `./components/LoadingSkeleton/LoadingSkeleton`. Then find the `summary` slot and update its Suspense boundary:

```tsx
// Add import at the top
import { ControlsPanelSkeleton, TimelineSkeleton } from "./components/LoadingSkeleton/LoadingSkeleton";

// Update the summary prop
      summary={
        <Suspense fallback={<TimelineSkeleton />}>
          <ProgressionSummarySlot />
        </Suspense>
      }
```

- [ ] **Step 4: Commit**

```bash
git add src/components/LoadingSkeleton/LoadingSkeleton.module.css src/components/LoadingSkeleton/LoadingSkeleton.tsx src/App.tsx
git commit -m "feat(components): add timeline skeleton loader for progression summary"
```

---

### Task 3: Remove Hardcoded Circle of Fifths Loader

**Files:**
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.tsx`

- [ ] **Step 1: Replace COF with generic CardSkeleton**

In `src/components/LoadingSkeleton/LoadingSkeleton.tsx`, modify `ControlsPanelSkeleton` to remove the `.cof-skeleton` entirely. Replace it with a generic `<CardSkeleton rows={4} />` rendered only in 3-col mode.

```tsx
export function ControlsPanelSkeleton({ mode }: { mode: "3col" | "split" | "stacked" }) {
  return (
    <div className={styles["controls-skeleton"]} data-mode={mode} aria-label="Loading controls" role="status">
      <CardSkeleton rows={4} />
      <CardSkeleton rows={5} />
      {mode === "3col" && <CardSkeleton rows={4} />}
    </div>
  );
}
```

- [ ] **Step 2: Run linter and tests**

Run: `pnpm tsc --noEmit && pnpm eslint src/components/LoadingSkeleton/LoadingSkeleton.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/LoadingSkeleton/LoadingSkeleton.tsx
git commit -m "fix(components): remove hardcoded cof skeleton from generic inspector fallback"
```
