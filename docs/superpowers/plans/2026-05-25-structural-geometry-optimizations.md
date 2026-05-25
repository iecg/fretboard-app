# Structural Geometry Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate loops, arrays, maps, and string lookups in our heavy geometry functions by substituting pure O(1) mathematical string-offset relationships.

**Architecture:** 
1. **O(1) Wrapping**: Eliminate array scanning when wrapping overshoot notes by using string fret offsets (`offset = (openS - openTarget + 12) % 12`).
2. **O(1) Deduplication**: Eliminate `Map` allocations and string hashing when deduplicating adjacent strings by comparing frets mathematically.
3. **O(1) CAGED Roots**: Eliminate linear `indexOf` scanning by predicting root frets modulo 12.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: O(1) Fretboard Overshoot Wrapping

**Files:**
- Modify: `packages/core/src/shapes/helpers.ts:80-173`
- Modify: `packages/core/src/theory.ts` (Ensure `NOTES` is exported if not already, wait, it already is!)

- [ ] **Step 1: Write the failing test**
No new tests needed. The geometric drawing functions are extensively covered by `polygons.test.ts`. If our mathematical wrapping places notes differently than the linear scanner did, those shape snapshot tests will fail.

- [ ] **Step 2: Add the math logic to `wrapOvershootNotes`**

In `packages/core/src/shapes/helpers.ts`, import `NOTES` from `../theory`. 
Inside `wrapOvershootNotes`, completely replace the linear `for (let tf = wrapSearchMin...` scan with the offset math. 

```typescript
// Add to imports at top of helpers.ts if missing:
import { NOTES } from '../theory';

// Inside wrapOvershootNotes, replace the target=s-1 block:
  // Wrap positive overshoot to thinner string
  if (intendedMax > frets && intendedMax - frets <= MAX_WRAP_OVERSHOOT) {
    for (let s = numStrings - 1; s >= 0; s--) {
      if (perStringNotes[s].length === 0) continue;
      const target = s - 1;
      if (target < 0) continue;
      
      const openS = NOTES.indexOf(layout[s][0]);
      const openTarget = NOTES.indexOf(layout[target][0]);
      const offset = (openS - openTarget + 12) % 12;

      for (let f = frets + 1; f <= intendedMax; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        
        const rawFret = f + offset;
        const candidates = [rawFret - 12, rawFret, rawFret + 12]
          .filter(c => c >= wrapSearchMin && c <= wrapSearchMax);
          
        if (candidates.length > 0) {
          // Find closest to shapeCenter
          const bestFret = candidates.reduce((a, b) => 
            Math.abs(b - shapeCenter) < Math.abs(a - shapeCenter) ? b : a
          );
          perStringNotes[target].push(bestFret);
          wrappedNotes.add(`${target}-${bestFret}`);
        } else {
          unwrapped++;
        }
      }
    }
  }

  // Replace the target=s+1 block (negative overshoot) similarly:
  if (intendedMin < 0 && -intendedMin <= MAX_WRAP_OVERSHOOT) {
    for (let s = 0; s < numStrings; s++) {
      if (perStringNotes[s].length === 0) continue;
      const target = s + 1;
      if (target >= numStrings) continue;

      const openS = NOTES.indexOf(layout[s][0]);
      const openTarget = NOTES.indexOf(layout[target][0]);
      const offset = (openS - openTarget + 12) % 12;

      for (let f = intendedMin; f < 0; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        
        const rawFret = f + offset;
        const candidates = [rawFret - 12, rawFret, rawFret + 12]
          .filter(c => c >= wrapSearchMin && c <= wrapSearchMax);
          
        if (candidates.length > 0) {
          const bestFret = candidates.reduce((a, b) => 
            Math.abs(b - shapeCenter) < Math.abs(a - shapeCenter) ? b : a
          );
          perStringNotes[target].push(bestFret);
          wrappedNotes.add(`${target}-${bestFret}`);
        } else {
          unwrapped++;
        }
      }
    }
  }
```

- [ ] **Step 3: Run tests to verify**
Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/polygons.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add packages/core/src/shapes/helpers.ts
git commit -m "perf(core): optimize shape wrapping using O(1) mathematical string offsets"
```

### Task 2: Mathematical Adjacent String Deduplication

**Files:**
- Modify: `packages/core/src/shapes/helpers.ts:13-78`

- [ ] **Step 1: Write the failing test**
Again, existing `polygons.test.ts` acts as our regression suite.

- [ ] **Step 2: Replace Map allocation with modulo math**

In `deduplicateAdjacentStrings`, remove the `Map` logic.
```typescript
export function deduplicateAdjacentStrings(
  perStringNotes: number[][],
  layout: string[][],
  blueNoteName: string | null,
) {
  for (let s = 0; s < perStringNotes.length - 1; s++) {
    const upper = perStringNotes[s];
    const lower = perStringNotes[s + 1];
    if (!upper.length || !lower.length) continue;

    const openS = NOTES.indexOf(layout[s][0]);
    const openTarget = NOTES.indexOf(layout[s + 1][0]);
    const offset = (openS - openTarget + 12) % 12;
    const blueMod = blueNoteName ? (NOTES.indexOf(blueNoteName) - openTarget + 12) % 12 : -1;

    const toRemoveUpper = new Set<number>();
    const toRemoveLower = new Set<number>();

    for (let j = 0; j < lower.length; j++) {
      if (lower[j] % 12 === blueMod) continue;

      for (let i = 0; i < upper.length; i++) {
        if ((upper[i] + offset) % 12 === lower[j] % 12) {
          if (toRemoveUpper.has(i)) continue;

          // Distance to nearest neighbor on upper string
          const upperDist = Math.min(
            i > 0 ? upper[i] - upper[i - 1] : Infinity,
            i < upper.length - 1 ? upper[i + 1] - upper[i] : Infinity,
          );
          // Distance to nearest neighbor on lower string
          const lowerDist = Math.min(
            j > 0 ? lower[j] - lower[j - 1] : Infinity,
            j < lower.length - 1 ? lower[j + 1] - lower[j] : Infinity,
          );

          if (upperDist >= lowerDist) {
            toRemoveUpper.add(i);
          } else {
            toRemoveLower.add(j);
          }
        }
      }
    }

    // Remove marked indices
    if (toRemoveUpper.size > 0) {
      perStringNotes[s] = upper.filter((_, i) => !toRemoveUpper.has(i));
    }
    if (toRemoveLower.size > 0) {
      perStringNotes[s + 1] = lower.filter((_, i) => !toRemoveLower.has(i));
    }
  }
}
```

- [ ] **Step 3: Run tests to verify**
Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/polygons.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add packages/core/src/shapes/helpers.ts
git commit -m "perf(core): eliminate Map allocations in string deduplication via modulo math"
```

### Task 3: O(1) Root Fret Stamping for CAGED Coordinates

**Files:**
- Modify: `packages/core/src/shapes/polygons.ts:87-95`

- [ ] **Step 1: Replace `while` loop with O(1) offset stamp**

In `packages/core/src/shapes/polygons.ts`, replace the `searchFret` loop:
```typescript
  // Find roots using math instead of array scanning
  const rootFrets: number[] = [];
  const openIdx = NOTES.indexOf(layout[rootStringFocus][0]);
  const anchorIdx = NOTES.indexOf(anchorNote);
  const firstFret = (anchorIdx - openIdx + 12) % 12;
  
  for (let f = firstFret; f <= frets; f += 12) {
    rootFrets.push(f);
  }
```

- [ ] **Step 2: Run tests to verify**
Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/polygons.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add packages/core/src/shapes/polygons.ts
git commit -m "perf(core): optimize CAGED root locating using mathematical modulo sequence"
```
