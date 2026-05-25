# Geometric Voicings Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate visual stutter during song chord transitions by caching fretboard geometry voicings, replacing on-the-fly combinatorial DFS with an O(1) lookup.

**Architecture:** Instead of running the expensive `closeVoicings` DFS search on every frame when the chord transitions, we will introduce a `VoicingCache` singleton inside `@fretflow/core`. This cache will generate the geometry for a given `chordRoot`, `chordType`, and `tuning` exactly once. Subsequent requests will hit the O(1) cache. To completely prevent stutter, we will also add a `prewarmVoicings` method that the UI can call during the audio "loading" phase.

**Tech Stack:** TypeScript, Jotai, Vitest.

---

### Task 1: Create the Voicing Cache in `@fretflow/core`

**Files:**
- Create: `packages/core/src/shapes/voicingCache.ts`
- Modify: `packages/core/src/shapes/voicings.ts:38-48`
- Test: `packages/core/src/shapes/voicingCache.test.ts`

- [ ] **Step 1: Write the failing test for the cache**

Create `packages/core/src/shapes/voicingCache.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedVoicings, prewarmVoicings, clearVoicingCache } from "./voicingCache";
import * as voicings from "./voicings";

describe("VoicingCache", () => {
  beforeEach(() => {
    clearVoicingCache();
    vi.restoreAllMocks();
  });

  it("caches generateVoicings calls", () => {
    const spy = vi.spyOn(voicings, "generateVoicingsUncached").mockReturnValue([]);
    
    const params = { chordRoot: "C", chordType: "M", tuning: ["E4", "B3", "G3", "D3", "A2", "E2"], maxFret: 24, voicingType: "close" as const };
    
    getCachedVoicings(params);
    getCachedVoicings(params);
    
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("prewarms the cache for multiple roots", () => {
    const spy = vi.spyOn(voicings, "generateVoicingsUncached").mockReturnValue([]);
    const tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];
    
    prewarmVoicings([{ chordRoot: "C", chordType: "M" }, { chordRoot: "G", chordType: "M" }], tuning, 24);
    
    expect(spy).toHaveBeenCalledTimes(4); // full + close for each of the 2 chords
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/voicingCache.test.ts`
Expected: FAIL with "module not found".

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/shapes/voicingCache.ts`:
```typescript
import { generateVoicingsUncached, type GenerateVoicingsParams, type Voicing } from "./voicings";

const cache = new Map<string, Voicing[]>();

function getCacheKey(params: GenerateVoicingsParams): string {
  return `${params.chordRoot}|${params.chordType}|${params.tuning.join(",")}|${params.maxFret}|${params.voicingType}`;
}

export function getCachedVoicings(params: GenerateVoicingsParams): Voicing[] {
  const key = getCacheKey(params);
  let result = cache.get(key);
  if (!result) {
    result = generateVoicingsUncached(params);
    cache.set(key, result);
  }
  return result;
}

export function prewarmVoicings(
  chords: Array<{ chordRoot: string; chordType: string | null }>,
  tuning: string[],
  maxFret: number
): void {
  for (const { chordRoot, chordType } of chords) {
    if (!chordType) continue;
    getCachedVoicings({ chordRoot, chordType, tuning, maxFret, voicingType: "full" });
    getCachedVoicings({ chordRoot, chordType, tuning, maxFret, voicingType: "close" });
  }
}

export function clearVoicingCache(): void {
  cache.clear();
}
```

Modify `packages/core/src/shapes/voicings.ts`:
```typescript
import { getCachedVoicings } from "./voicingCache";

// Rename the original exported function so the cache can wrap it
export function generateVoicingsUncached(params: GenerateVoicingsParams): Voicing[] {
  switch (params.voicingType) {
    case "off":
      return [];
    case "full":
      return fullVoicings(params);
    case "close":
      return closeVoicings(params);
  }
}

// The public API now routes through the cache
export function generateVoicings(params: GenerateVoicingsParams): Voicing[] {
  return getCachedVoicings(params);
}
```

Export new utilities in `packages/core/src/shapes/index.ts`:
```typescript
export { getCachedVoicings, prewarmVoicings, clearVoicingCache } from "./voicingCache";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/voicingCache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/
git commit -m "perf(core): memoize fretboard voicing geometry to eliminate O(n) search"
```

### Task 2: Pre-warm Visual Geometry during Audio Build

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`

- [ ] **Step 1: Write the failing test**

We don't need a new spec file here; the existing test suite will verify playback orchestration. We just need to add the pre-warm call to the UI hook.

- [ ] **Step 2: Write minimal implementation**

Modify `src/hooks/useProgressionAudioPlayback.ts`:

Add import at the top:
```typescript
import { prewarmVoicings } from "@fretflow/core";
import { currentTuningAtom } from "../store/layoutAtoms";
```

Read the tuning atom near line 125:
```typescript
  const swing = useAtomValue(progressionSwingAtom);
  const tuning = useAtomValue(currentTuningAtom);
```

Add tuning to `buildInputsRef`:
```typescript
    buildInputsRef.current = {
      steps,
      chordPatternId,
      bassPatternId,
      drumPatternId,
      drumVariations,
      tempo,
      beatsPerBar,
      swing,
      loopEnabled,
      tuning, // Added here
    };
```

In `useEffect` (around line 240, right before `buildAllLayers`):
```typescript
    // Pre-calculate the fretboard geometry for every chord in the progression.
    // This runs synchronously behind the loading spinner, converting the heavy DFS 
    // visual search into an O(1) cache lookup to prevent stuttering on transitions.
    prewarmVoicings(
      inputs.steps.map(s => ({ chordRoot: s.root, chordType: s.quality })),
      inputs.tuning,
      24
    );

    const built = buildAllLayers({
```

- [ ] **Step 3: Run existing tests to verify no breakage**

Run: `pnpm test run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts
git commit -m "perf(audio): pre-warm visual voicing geometry before starting playback"
```
