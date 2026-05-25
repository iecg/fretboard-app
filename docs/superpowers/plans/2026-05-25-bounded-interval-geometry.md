# Bounded Interval Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate $O(N^2)$ double-loops in `practicePatterns.ts` by bounding interval searches to a single octave using absolute pitch offsets.

**Architecture:** 
In `getTwoStringsIntervalPairs` and `getOneStringIntervalPairs`, the engine searches for notes that form specific intervals (like 3rds or 6ths). Currently, it loops through every fret on the first string, and then blindly scans every fret on the target string to find matches. 
Since intervals within a scale repeat every octave, the maximum pitch distance between any two targeted chord tones is bounded by 12 semitones. By calculating the absolute tuning offset between the strings, we can replace the entire-string inner scan with a fast 12-iteration `semitoneDiff` bounded search, vastly reducing iterations.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Bounded Search for `getTwoStringsIntervalPairs`

**Files:**
- Modify: `packages/core/src/shapes/practicePatterns.ts:213-228`

- [ ] **Step 1: Write the failing test**
No new tests needed. The robust `practicePatterns.test.ts` suite covers all interval shape generation visually and mathematically. If our bounded search misses an interval that the old $O(N^2)$ loop found, the tests will fail.

- [ ] **Step 2: Replace the inner `fretB` loop**

In `packages/core/src/shapes/practicePatterns.ts`, locate the `getTwoStringsIntervalPairs` function. Calculate the tuning offset before the loops, and replace the `for (let fretB = 0; fretB < rowB.length; fretB++)` loop with a bounded 12-semitone loop.

```typescript
  const offset = absolutePitch(openA, 0) - absolutePitch(openB, 0);

  for (let fretA = 0; fretA < rowA.length; fretA++) {
    const noteA = rowA[fretA];
    if (!noteA || !scaleNoteSet.has(noteA)) continue;
    const pitchA = absolutePitch(openA, fretA);

    // Instead of checking all frets on string B, we only check up to 12 semitones below pitchA.
    // pitchA - pitchB = diff
    // fretA + offset - fretB = diff  =>  fretB = fretA + offset - diff
    for (let diff = 1; diff <= 12; diff++) {
      const fretB = fretA + offset - diff;
      if (fretB < 0 || fretB >= rowB.length) continue;
      
      const noteB = rowB[fretB];
      if (!noteB || !scaleNoteSet.has(noteB)) continue;
      
      const pitchB = pitchA - diff;
      const dist = sdStepsBetween(pitchB, pitchA, scaleDegreeSet);
      if (dist === targetSdDistance) {
        pairs.push({ a: `${sA}-${fretA}`, b: `${sB}-${fretB}` });
      }
    }
  }
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/practicePatterns.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shapes/practicePatterns.ts
git commit -m "perf(core): optimize two-string interval search using 12-semitone geometric bounds"
```

### Task 2: Bounded Search for `getOneStringIntervalPairs`

**Files:**
- Modify: `packages/core/src/shapes/practicePatterns.ts:268-283`

- [ ] **Step 1: Replace the inner `fHigh` loop**

In `getOneStringIntervalPairs`, replace the inner loop that scans the rest of the string with a bounded 12-semitone loop.

```typescript
  for (let fLow = 0; fLow < row.length; fLow++) {
    const noteLow = row[fLow];
    if (!noteLow || !scaleNoteSet.has(noteLow)) continue;
    const pitchLow = absolutePitch(openNote, fLow);

    // Instead of scanning the rest of the string, only check up to 12 frets (semitones) higher
    for (let diff = 1; diff <= 12; diff++) {
      const fHigh = fLow + diff;
      if (fHigh >= row.length) break;

      const noteHigh = row[fHigh];
      if (!noteHigh || !scaleNoteSet.has(noteHigh)) continue;
      
      const pitchHigh = pitchLow + diff;
      const dist = sdStepsBetween(pitchLow, pitchHigh, scaleDegreeSet);
      if (dist === targetSdDistance) {
        pairs.push({ a: `${stringIndex}-${fHigh}`, b: `${stringIndex}-${fLow}` });
      }
    }
  }
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/practicePatterns.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shapes/practicePatterns.ts
git commit -m "perf(core): optimize single-string interval search using 12-semitone geometric bounds"
```
