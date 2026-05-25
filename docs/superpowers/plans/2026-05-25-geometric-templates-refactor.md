# Geometric Template Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely replace the brute-force DFS voicing search with an O(1) mathematical geometry engine based on guitar transposition properties, eliminating the need for any caching.

**Architecture:** Instead of searching the fretboard, we algorithmically derive primitive chord shapes. By taking the pitch classes of a chord and generating permutations for adjacent string sets, we calculate the exact fret offsets modulo 12. Finding the combination of octave shifts (+12) that minimizes the fret span gives us our base generic template. We then slide this template up the neck into all playable octaves. This reduces the problem from millions of loop iterations to a few hundred arithmetic operations, making it instantaneously fast on the main thread. 

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Revert the Caching Band-Aid

**Files:**
- Modify: `packages/core/src/shapes/index.ts:16-19`
- Modify: `packages/core/src/shapes/voicings.ts:38-48`
- Modify: `src/hooks/useProgressionAudioPlayback.ts:125-240`
- Delete: `packages/core/src/shapes/voicingCache.ts`
- Delete: `packages/core/src/shapes/voicingCache.test.ts`

- [ ] **Step 1: Write the failing test**
We don't need a new test here. This is a cleanup task to revert the caching we added previously.

- [ ] **Step 2: Revert `packages/core/src/shapes/index.ts`**

Remove the cache exports so it looks like this again:
```typescript
export type {
  Voicing,
  VoicingNote,
  VoicingType,
  GenerateVoicingsParams,
} from "./voicings";
export {
  generateVoicings, openStringMidi,
} from "./voicings";
```

- [ ] **Step 3: Revert `packages/core/src/shapes/voicings.ts` API**

Remove the cache imports and restore the original `generateVoicings` signature:
```typescript
export function generateVoicings(params: GenerateVoicingsParams): Voicing[] {
  switch (params.voicingType) {
    case "off":
      return [];
    case "full":
      return fullVoicings(params);
    case "close":
      return closeVoicings(params);
  }
}
```
*(Make sure `generateVoicingsUncached` is completely removed).*

- [ ] **Step 4: Revert `src/hooks/useProgressionAudioPlayback.ts`**

Remove the `prewarmVoicings` import and the pre-warming call before `buildAllLayers`. Also remove `tuning` from `buildInputsRef`.

```typescript
    // Removed prewarmVoicings call here
    const built = buildAllLayers({
      steps: inputs.steps,
```

- [ ] **Step 5: Delete cache files and verify tests pass**

Run:
```bash
rm packages/core/src/shapes/voicingCache.ts
rm packages/core/src/shapes/voicingCache.test.ts
pnpm --filter @fretflow/core test
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/shapes/ src/hooks/useProgressionAudioPlayback.ts
git commit -m "refactor(core): remove voicing cache in preparation for O(1) geometry engine"
```

### Task 2: Implement the Mathematical Geometry Engine

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts:71-160`

- [ ] **Step 1: Write the failing test**
The existing `packages/core/src/shapes/voicings.test.ts` already has comprehensive tests for `closeVoicings`. We will rely on these to prove our mathematical engine yields identical valid shapes as the old DFS.

- [ ] **Step 2: Add permutation utility**

Add this helper function above `closeVoicings` in `packages/core/src/shapes/voicings.ts`:
```typescript
function getPermutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const perm of getPermutations(remaining)) {
      result.push([current, ...perm]);
    }
  }
  return result;
}
```

- [ ] **Step 3: Write minimal implementation**

Replace the entire `closeVoicings` function with the geometric implementation:

```typescript
function closeVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret } = params;
  const def = CHORD_DEFINITIONS[chordType];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (!def || rootIndex < 0 || tuning.length !== 6) return [];

  const voiceCount = def.members.length;
  if (voiceCount < 3 || voiceCount > 5) return [];

  const chordPCs = def.members.map((m) => (rootIndex + m.semitone) % 12);
  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];

  const voicings: Voicing[] = [];
  const seen = new Set<string>();

  const stringSets: number[][] = [];
  for (let start = 0; start + voiceCount <= 6; start++) {
    const set = [];
    for (let i = 0; i < voiceCount; i++) set.push(start + i);
    stringSets.push(set);
  }

  const pcPermutations = getPermutations(chordPCs);

  for (const stringSet of stringSets) {
    const openStrings = stringSet.map((s) => openMidis[s] as number);

    for (const perm of pcPermutations) {
      const baseFrets = perm.map((pc, i) => {
        const openPc = openStrings[i] % 12;
        return (pc - openPc + 12) % 12;
      });

      let minSpan = Infinity;
      let bestFrets: number[] | null = null;
      const combinations = 1 << voiceCount;
      
      for (let c = 0; c < combinations; c++) {
        let minF = Infinity;
        let maxF = -Infinity;
        const currentFrets = [];
        for (let i = 0; i < voiceCount; i++) {
          const shift = (c & (1 << i)) !== 0 ? 12 : 0;
          const f = baseFrets[i] + shift;
          currentFrets.push(f);
          if (f < minF) minF = f;
          if (f > maxF) maxF = f;
        }
        const span = maxF - minF;
        if (span < minSpan) {
          minSpan = span;
          bestFrets = currentFrets;
        }
      }

      if (minSpan > CLOSE_VOICING_SPAN_LIMIT || !bestFrets) continue;

      let minFret = Math.min(...bestFrets);
      while (minFret >= 12) {
        for (let i = 0; i < voiceCount; i++) bestFrets[i] -= 12;
        minFret -= 12;
      }

      for (let octave = 0; octave * 12 <= maxFret; octave++) {
        const instanceFrets = bestFrets.map((f) => f + octave * 12);
        const highestFret = Math.max(...instanceFrets);

        if (highestFret > maxFret) break;

        const hasOpen = instanceFrets.some((f) => f === 0);
        if (hasOpen && highestFret >= 5) continue;

        const notes: VoicingNote[] = [];
        for (let i = 0; i < voiceCount; i++) {
          const stringIndex = stringSet[i];
          const fretIndex = instanceFrets[i];
          const midi = (openMidis[stringIndex] as number) + fretIndex;
          notes.push({
            stringIndex,
            fretIndex,
            noteName: NOTES[midi % 12],
            midi,
          });
        }

        const positionKeys = notes.map((n) => `${n.stringIndex}-${n.fretIndex}`);
        const key = positionKeys.join("|");

        if (!seen.has(key)) {
          seen.add(key);
          voicings.push({ positionKeys, notes });
        }
      }
    }
  }

  return voicings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/voicings.test.ts`
Expected: PASS (All tests should pass, confirming our mathematical engine is perfectly backwards-compatible with the old DFS output).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/voicings.ts
git commit -m "perf(core): replace DFS voicing search with O(1) mathematical geometry engine"
```
