# Skeleton Accuracy Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adjust the application loading skeletons to accurately match the structural layout and aesthetics of the real components, as demonstrated in the application screenshots.

**Architecture:** 
1. **FretboardSkeleton**: Upgrade from generic rectangles to a convincing fretboard mockup. We will use the exact `var(--fretboard-wood-mid)` and `var(--string-wire)` tokens from the theme, and add evenly-spaced vertical fret wires (`var(--fret-wire-dark)`) to simulate the neck grid.
2. **TimelineSkeleton**: Refine the dimensions and layout to perfectly match the `ProgressionTrack` component (a 0.82rem ruler over a 1.95rem lane).
3. **ControlsPanelSkeleton**: Replace generic text-paragraph bones with structurally accurate mockups of the `Scale` and `Chord` cards. We will introduce new semantic skeleton primitives (`SkeletonToggle`, `SkeletonDropdown`, `SkeletonSegmentedControl`) to mimic the actual UI controls.

**Tech Stack:** React, CSS Modules.

---

### Task 1: Refine Fretboard Skeleton Aesthetics

**Files:**
- Modify: `src/components/Fretboard/FretboardSkeleton.tsx`

- [ ] **Step 1: Update SVG to include fret wires and wood styling**

In `src/components/Fretboard/FretboardSkeleton.tsx`, update the component to draw vertical fret wires and use the correct guitar-themed CSS variables instead of generic surface tokens.

```tsx
import styles from "./Fretboard.module.css";

export interface FretboardSkeletonProps {
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
  // Approximate 24 frets evenly spaced for the skeleton
  const numFrets = 24;
  const fretSpacing = neckWidthPx / numFrets;
  const strings = Array.from({ length: numStrings });
  const frets = Array.from({ length: numFrets });

  return (
    <div className={styles["skeleton-container"]} aria-label="Loading fretboard">
      <svg width={neckWidthPx} height={neckHeight} className={styles["skeleton-svg"]}>
        {/* Wood background */}
        <rect width="100%" height="100%" fill="var(--fretboard-wood-mid)" />
        
        {/* Fret wires */}
        {frets.map((_, i) => (
          <line
            key={`skeleton-fret-${i}`}
            x1={i * fretSpacing}
            y1="0"
            x2={i * fretSpacing}
            y2="100%"
            stroke="var(--fret-wire-dark)"
            strokeWidth="2"
            opacity="0.3"
          />
        ))}

        {/* Strings */}
        {strings.map((_, i) => (
          <line
            key={`skeleton-string-${i}`}
            x1="0"
            y1={i * stringRowPx + stringRowPx / 2}
            x2="100%"
            y2={i * stringRowPx + stringRowPx / 2}
            stroke="var(--string-wire)"
            strokeWidth="1.5"
            opacity="0.5"
          />
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Fretboard/FretboardSkeleton.tsx
git commit -m "feat(components): enhance fretboard skeleton with wood and fret wires"
```

---

### Task 2: Structural Timeline Skeleton

**Files:**
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.module.css`
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.tsx`

- [ ] **Step 1: Update Timeline Skeleton CSS**

In `src/components/LoadingSkeleton/LoadingSkeleton.module.css`, adjust the `.timeline-skeleton` class and add specific classes for the ruler and lane bones to match the exact dimensions of `ProgressionTrack`.

```css
/* Replace the existing .timeline-skeleton with this: */
.timeline-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.34rem 0.7rem 0.32rem;
  width: 100%;
}

.timeline-ruler-bone {
  composes: bone;
  height: 0.82rem;
  width: 100%;
}

.timeline-lane-bone {
  composes: bone;
  height: 1.95rem;
  width: 100%;
}
```

- [ ] **Step 2: Update TimelineSkeleton Component**

In `src/components/LoadingSkeleton/LoadingSkeleton.tsx`, update the `TimelineSkeleton` component to use the new exact-dimension classes instead of generic `SkeletonBar`s.

```tsx
export function TimelineSkeleton() {
  return (
    <div className={styles["timeline-skeleton"]} aria-hidden="true">
      <div className={styles["timeline-ruler-bone"]} />
      <div className={styles["timeline-lane-bone"]} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LoadingSkeleton/LoadingSkeleton.module.css src/components/LoadingSkeleton/LoadingSkeleton.tsx
git commit -m "feat(components): strictly align timeline skeleton with progression track dimensions"
```

---

### Task 3: High-Fidelity Controls Panel Skeleton

**Files:**
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.module.css`
- Modify: `src/components/LoadingSkeleton/LoadingSkeleton.tsx`

- [ ] **Step 1: Add Component Mockup CSS**

In `src/components/LoadingSkeleton/LoadingSkeleton.module.css`, append classes for the new structural primitives:

```css
/* Control skeleton primitives */
.skel-header-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.skel-toggle {
  composes: bone;
  height: 1.5rem;
  width: 2.75rem;
  border-radius: 1rem;
}

.skel-controls-grid {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.skel-control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 120px;
}

.skel-dropdown {
  composes: bone;
  height: 2.5rem;
  width: 100%;
  border-radius: var(--radius-sm);
}

.skel-segmented {
  display: flex;
  gap: 2px;
  height: 2.5rem;
  width: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.skel-segment {
  composes: bone;
  flex: 1;
  border-radius: 0;
}
```

- [ ] **Step 2: Implement High-Fidelity Mockups**

In `src/components/LoadingSkeleton/LoadingSkeleton.tsx`, replace the generic `CardSkeleton` instances in `ControlsPanelSkeleton` with customized layouts simulating the "SCALE" and "CHORD" cards.

```tsx
// Keep SkeletonBar and existing imports

function ControlCardSkeleton({
  titleWidth,
  groups
}: {
  titleWidth: string;
  groups: { labelWidth: string; segments?: number; isDropdown?: boolean }[];
}) {
  return (
    <div className={styles["card-skeleton"]} aria-hidden="true">
      <div className={styles["card-skeleton__header"]}>
        <div className={styles["skel-header-row"]}>
          <div className={styles["skel-toggle"]} />
          <SkeletonBar size="md" width={titleWidth} />
        </div>
      </div>
      <div className={styles["card-skeleton__body"]}>
        <div className={styles["skel-controls-grid"]}>
          {groups.map((g, i) => (
            <div key={i} className={styles["skel-control-group"]} style={{ flex: g.segments ? g.segments : 1 }}>
              <SkeletonBar size="sm" width={g.labelWidth} />
              {g.isDropdown ? (
                <div className={styles["skel-dropdown"]} />
              ) : (
                <div className={styles["skel-segmented"]}>
                  {Array.from({ length: g.segments || 1 }).map((_, j) => (
                    <div key={j} className={styles["skel-segment"]} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ControlsPanelSkeleton({ mode }: { mode: "3col" | "split" | "stacked" }) {
  return (
    <div className={styles["controls-skeleton"]} data-mode={mode} aria-label="Loading controls" role="status">
      {/* SCALE CARD MOCKUP */}
      <ControlCardSkeleton 
        titleWidth="8rem" 
        groups={[
          { labelWidth: "4rem", isDropdown: true },
          { labelWidth: "3rem", segments: 5 }
        ]} 
      />
      {/* CHORD CARD MOCKUP */}
      <ControlCardSkeleton 
        titleWidth="9rem" 
        groups={[
          { labelWidth: "4.5rem", isDropdown: true },
          { labelWidth: "2.5rem", segments: 2 },
          { labelWidth: "6rem", isDropdown: true } // Lock to scale mock
        ]} 
      />
      {/* Third Card for 3col layout */}
      {mode === "3col" && (
        <ControlCardSkeleton 
          titleWidth="7rem" 
          groups={[
            { labelWidth: "5rem", isDropdown: true }
          ]} 
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test and Commit**

Run: `pnpm tsc --noEmit && pnpm eslint src/components/LoadingSkeleton/LoadingSkeleton.tsx`
Expected: PASS

```bash
git add src/components/LoadingSkeleton/LoadingSkeleton.module.css src/components/LoadingSkeleton/LoadingSkeleton.tsx
git commit -m "feat(components): upgrade control panel skeletons to high-fidelity component mockups"
```
