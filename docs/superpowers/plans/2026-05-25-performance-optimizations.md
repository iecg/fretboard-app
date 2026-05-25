# Codebase Performance Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize computational bottlenecks across the app (fretboard allocation, layout effects, async yielding, and root finding) to ensure perfectly smooth rendering and audio loading.

**Architecture:** 
1. Memoize `getFretboardNotes` globally to prevent redundant 6x25 array allocations on every chord shape render.
2. Fix the React Compiler opt-out in `Fretboard.tsx` by using a `useRef` to decouple layout geometry from the dependency array, safely allowing automatic granular memoization again.
3. Make the `buildAllLayers` audio compiler `async`, yielding to the event loop every few steps to ensure the loading spinner animation doesn't freeze on massive progressions.
4. Replace the linear O(N) anchor fret scan in `fullChordShapes` with an O(1) mathematical root-finding algorithm.

**Tech Stack:** TypeScript, React, Vitest.

---

### Task 1: Memoize Fretboard Matrix Generation

**Files:**
- Modify: `packages/core/src/guitar.ts:72-84`
- Modify: `packages/core/src/guitar.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test block to the end of `packages/core/src/guitar.test.ts`:
```typescript
describe('getFretboardNotes caching', () => {
  it('returns the same array instance for identical tuning and frets', () => {
    const layout1 = getFretboardNotes(['E4', 'B3'], 24);
    const layout2 = getFretboardNotes(['E4', 'B3'], 24);
    expect(layout1).toBe(layout2); // reference equality
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fretflow/core test run packages/core/src/guitar.test.ts`
Expected: FAIL on reference equality.

- [ ] **Step 3: Write minimal implementation**

Modify `packages/core/src/guitar.ts` above `getFretboardNotes`:
```typescript
const fretboardCache = new Map<string, string[][]>();

/**
 * Returns a 2D array representing the fretboard.
 * Array of strings (top/thinnest to bottom/thickest), each containing an array of notes from fret 0 to maxFret.
 */
export function getFretboardNotes(tuning: string[], frets: number = 24): string[][] {
  const key = `${tuning.join(',')}|${frets}`;
  let cached = fretboardCache.get(key);
  if (!cached) {
    cached = tuning.map(stringNote => {
      const stringNotes = [];
      for (let currentFret = 0; currentFret <= frets; currentFret++) {
        stringNotes.push(getFretNote(stringNote, currentFret));
      }
      return stringNotes;
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
git add packages/core/src/guitar.ts packages/core/src/guitar.test.ts
git commit -m "perf(core): globally memoize getFretboardNotes to prevent redundant allocations"
```

### Task 2: Restore React Compiler in Fretboard

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx:84-86, 188-217`

- [ ] **Step 1: Write the failing test**
No tests needed for this React refactor. We'll manually verify UI compilation.

- [ ] **Step 2: Remove the React Compiler opt-outs**

In `src/components/Fretboard/Fretboard.tsx`, delete lines 84-86:
```typescript
  // TODO(react-compiler): It intentionally disables exhaustive-deps for stable refs 
  // in specific useMemo blocks which confuses the compiler's auto-memoization logic.
  'use no memo';
```
Also delete the two eslint disable comments right before the `useLayoutEffect` dependency array around line 215:
```typescript
  // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trigger only on target/key changes; geometry derived from current values
```

- [ ] **Step 3: Decouple dependencies with a ref**

Right above the `useLayoutEffect` that handles `autoCenterTarget`, add a ref to store the latest geometry values without triggering effect reruns:
```typescript
  // Keep the latest geometry decoupled from the centering effect to avoid jumpy scrolling
  const geometryRef = useRef({ effectiveZoom, totalColumns, stringRowPx, startFret, endFret });
  geometryRef.current = { effectiveZoom, totalColumns, stringRowPx, startFret, endFret };

  useLayoutEffect(() => {
    if (!autoCenterTarget) return;
    const el = scrollRef.current;
    if (!el) return;
    const containerW = el.clientWidth;
    if (containerW <= 0) return;

    const { effectiveZoom, totalColumns, stringRowPx, startFret, endFret } = geometryRef.current;
    const neckWidth = totalColumns * effectiveZoom;
    const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
    
    const { openColumnWidth, scaleLeftAnchor, scalePx } = getFretboardScale(
      startFret,
      endFret,
      neckWidth,
      noteBubblePx
    );

    const wireX = (wireIndex: number): number =>
      getWireX(wireIndex, startFret, openColumnWidth, scalePx, scaleLeftAnchor);

    const shapeLeft = autoCenterTarget.minFret === 0 ? 0 : wireX(autoCenterTarget.minFret - 1);
    const shapeRight = wireX(autoCenterTarget.maxFret);
    const shapeCenter = (shapeLeft + shapeRight) / 2;

    el.scrollTo({ left: Math.max(0, shapeCenter - containerW / 2), behavior: "smooth" });
  }, [autoCenterTarget, recenterKey]); // Ref values safely omitted
```

- [ ] **Step 4: Verify build**

Run: `pnpm tsc --noEmit && pnpm eslint src/components/Fretboard/Fretboard.tsx`
Expected: PASS with no react-hooks/exhaustive-deps warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx
git commit -m "perf(ui): restore React Compiler in Fretboard by decoupling layout effects"
```

### Task 3: Async Yielding in buildAllLayers

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts`
- Modify: `src/hooks/useProgressionAudioPlayback.ts:241-255`

- [ ] **Step 1: Write the failing test**
We will skip writing a specific test for the yielding, but we must run the existing tests to ensure the async refactor didn't break orchestration.

- [ ] **Step 2: Make `buildAllLayers` async**

In `src/progressions/audio/buildAllLayers.ts`, change the signature:
```typescript
export async function buildAllLayersAsync(input: BuildAllLayersInput): Promise<BuiltLayers> {
```
Also change the inner `.forEach` loop to a standard `for` loop so we can use `await`:
```typescript
  // Replace input.steps.forEach((step, stepIndex) => { with:
  for (let stepIndex = 0; stepIndex < input.steps.length; stepIndex++) {
    const step = input.steps[stepIndex];
    
    // Yield to the event loop every 8 steps to prevent UI lockup
    if (stepIndex > 0 && stepIndex % 8 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
```
*(Ensure you close the loop correctly and `export async function buildAllLayersAsync` is exported instead of `buildAllLayers`)*.

- [ ] **Step 3: Update `useProgressionAudioPlayback.ts`**

In `src/hooks/useProgressionAudioPlayback.ts`, update the usage to `await` the result. Inside Effect 1 (around line 241):
```typescript
    let isCancelled = false;
    
    async function loadAudio() {
      try {
        const built = await buildAllLayersAsync({
          steps: inputs.steps,
          tempoBpm: inputs.tempo,
          beatsPerBar: inputs.beatsPerBar,
          swing: inputs.swing,
          chordPatternId: inputs.chordPatternId,
          bassPatternId: inputs.bassPatternId,
          drumPatternId: inputs.drumPatternId,
          drumVariations: inputs.drumVariations,
          loop: inputs.loopEnabled,
        });
        
        if (isCancelled) return;
        
        primitivesRef.current = await initializeTonePlayback(built, inputs.loopEnabled);
        
        if (isCancelled) {
          primitivesRef.current.cleanup();
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Audio build failed", err);
      }
    }
    
    loadAudio();
    
    return () => {
      isCancelled = true;
    };
```
*(You must rename the import to `buildAllLayersAsync` at the top of the file).*

- [ ] **Step 4: Run tests to verify**

Run: `pnpm test run src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/hooks/useProgressionAudioPlayback.ts
git commit -m "perf(audio): make buildAllLayers async to yield to event loop during heavy loads"
```

### Task 4: O(1) Root Finding for Full Voicings

**Files:**
- Modify: `packages/core/src/shapes/fullChordShapes.ts:65-74`

- [ ] **Step 1: Write the failing test**
No new tests needed. We will run the existing test suite (`fullChordShapes.test.ts` and `voicings.test.ts`) to verify our O(1) logic behaves exactly like the old loop.

- [ ] **Step 2: Replace linear fret scan with O(1) math**

In `packages/core/src/shapes/fullChordShapes.ts` (around line 65 inside the `for (const template of FULL_CHORD_TEMPLATES)` loop):
Replace the linear `anchorFret` scan:
```typescript
    const anchorNotes = fretboard[template.anchorString];
    if (!anchorNotes) {
      continue;
    }

    for (let anchorFret = 0; anchorFret < anchorNotes.length; anchorFret += 1) {
      if (anchorNotes[anchorFret] !== chordRoot) {
        continue;
      }
```
With the mathematical lookup:
```typescript
    const anchorNotes = fretboard[template.anchorString];
    if (!anchorNotes || anchorNotes.length === 0) continue;

    const openIndex = NOTES.indexOf(anchorNotes[0]);
    if (openIndex < 0) continue;

    const firstRootFret = (rootIndex - openIndex + 12) % 12;
    const rootFrets: number[] = [];
    for (let f = firstRootFret; f <= maxFret; f += 12) {
      rootFrets.push(f);
    }

    for (const anchorFret of rootFrets) {
```

- [ ] **Step 3: Run tests to verify**

Run: `pnpm --filter @fretflow/core test run packages/core/src/shapes/fullChordShapes.test.ts`
Expected: PASS (It should generate the exact same valid CAGED shapes but without executing 25 iterations per template).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shapes/fullChordShapes.ts
git commit -m "perf(core): optimize full voicing geometric template stamping to O(1)"
```
