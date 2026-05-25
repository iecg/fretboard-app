# Master Chromatic Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push geometric fretboard generation to the absolute limit by pre-computing a single master chromatic sequence and generating all strings via `Array.prototype.slice`.

**Architecture:** 
As you pointed out, the sequences on adjacent strings are just shifted versions of the same master chromatic scale. Instead of generating *any* arrays dynamically per string via `.map()` and modulo `% 12` math, we can pre-allocate one massive chromatic array on boot. Then, generating a string of any length is simply an `O(1)` highly-optimized V8 `Array.slice` from the `openIndex` offset.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Master Chromatic Slice Stamping

**Files:**
- Modify: `packages/core/src/guitar.ts`

- [ ] **Step 1: Write the failing test**
No new test needed. We will rely on the existing extensive `guitar.test.ts` suite to ensure our slicing yields the exact same results as our previous arithmetic sequence generation.

- [ ] **Step 2: Pre-compute the Master Sequence**

At the top level of `packages/core/src/guitar.ts`, right below the `NOTES` import/definition, create a pre-computed master array that is long enough to handle any realistic fret count plus the maximum `openIndex` offset (e.g., 100 slots).

```typescript
// Pre-compute a long master chromatic sequence to allow O(1) slicing for any string length.
// Length 100 covers MAX_FRET (24) + max openIndex (11) with plenty of buffer.
const MASTER_CHROMATIC = Array.from({ length: 100 }, (_, i) => NOTES[i % 12]);
```

- [ ] **Step 3: Update `getFretboardNotes` to use slice**

Replace the current mapping logic inside `getFretboardNotes` with the `slice` method:
```typescript
export function getFretboardNotes(tuning: string[], frets: number = 24): string[][] {
  const key = `${tuning.join(',')}|${frets}`;
  let cached = fretboardCache.get(key);
  if (!cached) {
    cached = tuning.map(stringNote => {
      const parsed = parseNote(stringNote);
      const noteName = parsed?.noteName ?? "E";
      const openIndex = NOTES.indexOf(noteName);
      
      // O(1) slice instead of mapping and modulo math
      return MASTER_CHROMATIC.slice(openIndex, openIndex + frets + 1);
    });
    fretboardCache.set(key, cached);
  }
  return cached;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core test run packages/core/src/guitar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/guitar.ts
git commit -m "perf(core): generate string sequences instantly using O(1) master chromatic slices"
```
