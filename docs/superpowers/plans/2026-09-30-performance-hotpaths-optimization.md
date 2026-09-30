# Performance Hot-Paths Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate performance hot-paths across runtime SVG note rendering, pure music-theory caching, and bundle code-splitting to ensure smooth 60fps playback transitions, faster state updates, and a smaller initial download.

**Architecture:**
- **Layer 1 (Theory)**: Add bounded LRU/Map caching to `@fretflow/core` for `getScaleNotes`, `getChordNotes`, and a static Set lookup for `isFlatKey`.
- **Layer 2 (Topology)**: In `buildStaticFretboardTopology`, pre-batch the 12 chromatic note spellings, pre-index polygon fret bounds per string, and replace string parsing with integer octave arithmetic.
- **Layer 3 (SVG / Runtime)**: Hoist `prefersReducedMotion` to eliminate 150 media-query hook subscriptions, conditionally mount `<AnimatePresence>` only on active countdown target notes, memoize `useEmphasisContext`, and streamline `renderedNoteSignature`.
- **Layer 4 (Bundle)**: Rebalance Rolldown code-splitting priorities in `vite.config.ts` so third-party dependencies are properly directed into vendor chunks, shrinking `song-controls-*.js` from 452 kB to <50 kB.

**Tech Stack:** React 19, TypeScript, Jotai, Tonal.js, Vite 8 / Rolldown, Vitest, Motion. Branch: `perf-hotpaths-optimization`.

## Global Constraints
- Preserve exact spelling contract (sharps internally, scale-aware flats on display).
- Do not cross-wire scale and chord rendering visibility or color domains.
- All 2,779 tests in `pnpm run test` must pass.
- `pnpm run lint` must pass with 0 errors and fretboard package boundaries intact.
- Follow Conventional Commits: `type(scope): message`.

---

### Task 1: Memoize Pure Theory Lookups in `@fretflow/core` (`getScaleNotes`, `getChordNotes`, `isFlatKey`)

**Files:**
- Modify: `packages/core/src/theory.ts`
- Test: `packages/core/src/theory.test.ts`

**Interfaces:**
- Consumes: `@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`
- Produces:
  - `getScaleNotes(rootNote: string, scaleName: string): string[]` (memoized)
  - `getChordNotes(rootNote: string, chordName: string): string[]` (memoized)
  - `isFlatKey(rootNote: string): boolean` (fast static Set check + Tonal fallback)
  - `clearTheoryCache(): void` (for test cleanup)

- [ ] **Step 1: Write tests for theory caching and `clearTheoryCache`**

In `packages/core/src/theory.test.ts`, add tests verifying cache hit stability and cache clearing:

```ts
import { getScaleNotes, getChordNotes, isFlatKey, clearTheoryCache } from "./theory";

describe("theory caching", () => {
  beforeEach(() => {
    clearTheoryCache();
  });

  it("returns identical array references on repeated getScaleNotes calls", () => {
    const a = getScaleNotes("C", "major");
    const b = getScaleNotes("C", "major");
    expect(a).toBe(b);
  });

  it("returns identical array references on repeated getChordNotes calls", () => {
    const a = getChordNotes("C", "maj7");
    const b = getChordNotes("C", "maj7");
    expect(a).toBe(b);
  });

  it("clears cached references on clearTheoryCache", () => {
    const a = getScaleNotes("C", "major");
    clearTheoryCache();
    const b = getScaleNotes("C", "major");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("correctly identifies flat keys using fast path", () => {
    expect(isFlatKey("F")).toBe(true);
    expect(isFlatKey("Bb")).toBe(true);
    expect(isFlatKey("Eb")).toBe(true);
    expect(isFlatKey("C")).toBe(false);
    expect(isFlatKey("G")).toBe(false);
    expect(isFlatKey("D")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fretflow/core run test -- theory.test.ts`  
Expected: FAIL (cannot find `clearTheoryCache`, `a` is not referentially identical to `b`).

- [ ] **Step 3: Implement memoization in `packages/core/src/theory.ts`**

In `packages/core/src/theory.ts`:
1. Add bounded maps for scale and chord notes:
```ts
const MAX_THEORY_CACHE_ENTRIES = 256;
const scaleNotesCache = new Map<string, string[]>();
const chordNotesCache = new Map<string, string[]>();

export function clearTheoryCache(): void {
  scaleNotesCache.clear();
  chordNotesCache.clear();
}
```
2. Fast static Set for flat keys:
```ts
const FLAT_KEY_ROOTS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "f", "bb", "eb", "ab", "db", "gb", "cb",
  "d", "g", "c" // minor keys with flat key signatures
]);

export function isFlatKey(rootNote: string): boolean {
  if (FLAT_KEY_ROOTS.has(rootNote)) return true;
  const key = Key.majorKey(rootNote);
  return typeof key.alteration === "number" && key.alteration < 0;
}
```
3. Update `getScaleNotes`:
```ts
export function getScaleNotes(rootNote: string, scaleName: string): string[] {
  const cacheKey = `${rootNote}|${scaleName}`;
  const cached = scaleNotesCache.get(cacheKey);
  if (cached) return cached;

  const tonalName = normalizeScaleName(scaleName);
  if (!tonalName) return [];
  if (getNoteIndex(rootNote) === -1) return [];
  const tonalScale = Scale.get(`${rootNote} ${tonalName}`);
  const result = tonalScale.notes.map((n) => normalizeToSharps(n));

  if (scaleNotesCache.size >= MAX_THEORY_CACHE_ENTRIES) {
    const oldest = scaleNotesCache.keys().next().value;
    if (oldest !== undefined) scaleNotesCache.delete(oldest);
  }
  scaleNotesCache.set(cacheKey, result);
  return result;
}
```
4. Update `getChordNotes`:
```ts
export function getChordNotes(rootNote: string, chordName: string): string[] {
  const cacheKey = `${rootNote}|${chordName}`;
  const cached = chordNotesCache.get(cacheKey);
  if (cached) return cached;

  const chroma = Note.chroma(rootNote);
  if (typeof chroma !== "number" || isNaN(chroma)) return [];
  const tonalChord = Chord.get(`${rootNote}${chordName}`);
  if (tonalChord.empty) return [];
  const result = tonalChord.notes.map((n) => normalizeToSharps(n));

  if (chordNotesCache.size >= MAX_THEORY_CACHE_ENTRIES) {
    const oldest = chordNotesCache.keys().next().value;
    if (oldest !== undefined) chordNotesCache.delete(oldest);
  }
  chordNotesCache.set(cacheKey, result);
  return result;
}
```
Export `clearTheoryCache` in `packages/core/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core run test -- theory.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theory.ts packages/core/src/theory.test.ts packages/core/src/index.ts
git commit -m "perf(core): memoize scale and chord notes and optimize isFlatKey"
```

---

### Task 2: Fast Batch Spelling, Fret Range Pre-Indexing, and Octave Math in Topology Generation

**Files:**
- Modify: `packages/fretboard/src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts`
- Test: `packages/fretboard/src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts`

**Interfaces:**
- Consumes: `@fretflow/core` (`getNoteDisplayInScale`, `NOTES`, `parseNote`)
- Produces: `buildStaticFretboardTopology` (identical `StaticFretboardTopologyNote[]` output, computed faster)

- [ ] **Step 1: Write a benchmark / consistency test**

In `packages/fretboard/src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts`, ensure that all notes produced by `buildStaticFretboardTopology` retain exact matching `displayName`, `displayValue`, `octave`, `isInsideAnyPolygon`, and `isInActiveShape` across varied scale, tuning, and CAGED configurations.

- [ ] **Step 2: Run test to verify existing behavior passes**

Run: `pnpm --filter @fretflow/fretboard run test -- useStaticFretboardTopology.test.ts`  
Expected: PASS.

- [ ] **Step 3: Implement batching and pre-indexing in `buildStaticFretboardTopology.ts`**

1. **Pre-compute 12 chromatic spellings**:
Before `stringIndex` loop:
```ts
const displayNameMap = new Map<string, string>();
for (const n of NOTES) {
  displayNameMap.set(
    n,
    getNoteDisplayInScale(n, rootNote, scale, preferFlats),
  );
}
```
Replace the per-note call with:
```ts
const displayName = displayNameMap.get(noteName) ?? noteName;
```

2. **Pre-parse tuning octaves and note indices**:
Before `stringIndex` loop:
```ts
const openStringParsed = tuning.map((openStr) => {
  const p = parseNote(openStr) ?? { noteName: "E", octave: 4 };
  return { octave: p.octave, noteIndex: NOTES.indexOf(p.noteName) };
});
```
Inside the per-note loop, replace `getFretNoteWithOctave` and `parseNote`:
```ts
const open = openStringParsed[stringIndex];
const octave = open && open.noteIndex !== -1
  ? open.octave + Math.floor((open.noteIndex + fretIndex) / 12)
  : 4;
```

3. **Pre-index polygon fret ranges per string**:
Before `stringIndex` loop:
```ts
interface StringFretRange {
  minFret: number;
  maxFret: number;
}
const activePolygonRangesByString = new Map<number, StringFretRange[]>();
if (hasChordOverlay && shapePolygons.length > 0 && activePattern && shapeScope !== "global") {
  for (let s = 0; s < numStrings; s++) {
    const ranges: StringFretRange[] = [];
    for (const poly of shapePolygons) {
      if (shapeScope === "single") {
        if (activePattern === "caged" && poly.shape !== activeShape) continue;
        if (activePattern === "3nps" && poly.shape !== activeShape) continue;
      } else if (shapeScope === "multi" && Array.isArray(activeShape)) {
        if (!(activeShape as CagedShape[]).includes(poly.shape as CagedShape)) continue;
      }
      const leftFret = poly.vertices[s]?.fret;
      const rightFret = poly.vertices[poly.vertices.length - 1 - s]?.fret;
      if (leftFret === undefined || rightFret === undefined) continue;
      const clampedLeft = Math.min(maxFret, Math.max(0, leftFret));
      const clampedRight = Math.min(maxFret, Math.max(0, rightFret));
      if (clampedLeft <= clampedRight) {
        ranges.push({
          minFret: clampedLeft - chordFretSpread,
          maxFret: clampedRight + chordFretSpread,
        });
      }
    }
    activePolygonRangesByString.set(s, ranges);
  }
}
```
Inside the per-note loop, replace the `shapePolygons.some(...)` call with:
```ts
const ranges = activePolygonRangesByString.get(stringIndex);
if (!ranges || ranges.length === 0) return false;
return ranges.some((r) => fretIndex >= r.minFret && fretIndex <= r.maxFret);
```

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `pnpm --filter @fretflow/fretboard run test -- useStaticFretboardTopology.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/fretboard/src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts
git commit -m "perf(fretboard): batch note spelling, pre-index polygon ranges, and optimize octave math in topology"
```

---

### Task 3: Hoist Motion Policy & Gate `<AnimatePresence>` on Fretboard Notes

**Files:**
- Modify: `packages/fretboard/src/components/FretboardSVG/FretboardNote.tsx`
- Modify: `packages/fretboard/src/components/FretboardSVG/FretboardNoteLayer.tsx`
- Modify: `packages/fretboard/src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `packages/fretboard/src/components/FretboardSVG/FretboardNote.test.tsx`
- Test: `packages/fretboard/src/components/FretboardSVG/FretboardNoteLayer.test.tsx`

**Interfaces:**
- Consumes: `prefersReducedMotion: boolean` passed via `FretboardNoteLayerProps` and `FretboardNoteProps`
- Produces: Zero `useReducedMotion()` calls inside `FretboardNote`; `<AnimatePresence>` only rendered when `guidePhase` was or is present.

- [ ] **Step 1: Write test for motion policy hoisting and conditional AnimatePresence**

In `packages/fretboard/src/components/FretboardSVG/FretboardNote.test.tsx`:
Add a test asserting that when `guidePhase` is undefined, no `motion.g` countdown ring or unnecessary motion wrapper is mounted. Verify reduced motion prop controls transition duration.

- [ ] **Step 2: Run test to verify current behavior**

Run: `pnpm --filter @fretflow/fretboard run test -- FretboardNote.test.tsx`  
Expected: PASS.

- [ ] **Step 3: Implement motion policy hoisting and `<AnimatePresence>` gating**

1. In `packages/fretboard/src/components/FretboardSVG/FretboardNote.tsx`:
   - Add `prefersReducedMotion?: boolean` to `FretboardNoteProps`.
   - Remove `import { useReducedMotion } from "motion/react";` and `const prefersReducedMotion = useReducedMotion();`.
   - Use `const isReducedMotion = prefersReducedMotion ?? false;`.
   - Track `hasHadGuidePhase`:
     ```ts
     const hasGuidePhase = guidePhase !== undefined;
     const hadGuidePhaseRef = React.useRef(false);
     if (hasGuidePhase) {
       hadGuidePhaseRef.current = true;
     }
     const shouldMountAnimatePresence = hasGuidePhase || hadGuidePhaseRef.current;
     ```
   - Wrap the guide ring conditionally:
     ```tsx
     {shouldMountAnimatePresence && (
       <AnimatePresence>
         {guidePhase && (
           <motion.g ...>
             ...
           </motion.g>
         )}
       </AnimatePresence>
     )}
     ```
2. In `packages/fretboard/src/components/FretboardSVG/FretboardNoteLayer.tsx`:
   - Add `prefersReducedMotion?: boolean` to `FretboardNoteLayerProps`.
   - Forward `prefersReducedMotion` to `<FretboardNote />`.
3. In `packages/fretboard/src/components/FretboardSVG/FretboardSVG.tsx`:
   - Pass `prefersReducedMotion={prefersReducedMotion}` to `<FretboardNoteLayer />`.

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `pnpm --filter @fretflow/fretboard run test -- FretboardNoteLayer.test.tsx FretboardNote.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/fretboard/src/components/FretboardSVG/FretboardNote.tsx packages/fretboard/src/components/FretboardSVG/FretboardNoteLayer.tsx packages/fretboard/src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "perf(fretboard): hoist reduced-motion hook and gate AnimatePresence to active countdown targets"
```

---

### Task 4: Stabilize `useEmphasisContext` & Fast String Signature Serialization

**Files:**
- Modify: `packages/fretboard/src/components/FretboardSVG/hooks/useEmphasisContext.ts`
- Modify: `packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Test: `packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`

**Interfaces:**
- Consumes: Jotai emphasis atoms
- Produces:
  - `useEmphasisContext`: Returns memoized stable reference when constituent values haven't changed.
  - `renderedNoteSignature`: Directly formats packed template string without array overhead.

- [ ] **Step 1: Write test for note signature and emphasis stability**

In `packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`:
Verify that `buildRenderedFretboardNotes` signature matching correctly preserves object identity for all 19 fields while avoiding array allocation.

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @fretflow/fretboard run test -- useAnimatedFretboardView.test.ts`  
Expected: PASS.

- [ ] **Step 3: Implement memoization and template string signature**

1. In `packages/fretboard/src/components/FretboardSVG/hooks/useEmphasisContext.ts`:
   Wrap returned object in `useMemo` with all 11 atom values in the dependency array.
2. In `packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`:
   Refactor `renderedNoteSignature`:
   ```ts
   function renderedNoteSignature(note: RenderedFretboardNote): string {
     const emph = note.applyLensEmphasis;
     return `${note.stringIndex}|${note.fretIndex}|${note.noteName}|${note.octave}|${note.noteClass}|${note.displayName}|${note.displayValue}|${note.cx}|${note.cy}|${note.applyDimOpacity}|${emph.opacityBoost}|${emph.radiusBoost}|${emph.transitionRole ?? ""}|${emph.guideTargetLabel ?? ""}|${note.isHidden}|${note.isTension}|${note.isGuideTone}|${note.fullChordShape ?? ""}|${note.isInRegion}`;
   }
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fretflow/fretboard run test -- useAnimatedFretboardView.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/fretboard/src/components/FretboardSVG/hooks/useEmphasisContext.ts packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts
git commit -m "perf(fretboard): memoize emphasis context and optimize rendered note signature"
```

---

### Task 5: Rebalance Rolldown Code-Splitting Priorities in `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`
- Test: Production build bundle analyzer / chunk size assertion

**Interfaces:**
- Consumes: Rolldown `codeSplitting.groups` configuration
- Produces: Correctly isolated vendor chunks (`vendor-react`, `vendor-state`, `vendor-motion`, `vendor-tone`, `vendor-theory`, `vendor-ui`, `vendor`) and application chunks without third-party leak.

- [ ] **Step 1: Check existing chunk output before editing**

Run: `pnpm run build`  
Note `song-controls-*.js` size (~452 kB).

- [ ] **Step 2: Update codeSplitting groups in `vite.config.ts`**

Update `groups` in `vite.config.ts`:
```ts
groups: [
  {
    name: 'vendor-react',
    test: /node_modules[\\/](react-dom|react|scheduler)[\\/]/,
    priority: 10,
  },
  {
    name: 'vendor-state',
    test: /node_modules[\\/]jotai[\\/]/,
    priority: 10,
  },
  {
    name: 'vendor-motion',
    test: /node_modules[\\/](framer-motion|motion-dom|motion-utils|motion)[\\/]/,
    priority: 9,
  },
  {
    name: 'vendor-tone',
    test: /node_modules[\\/](tone|standardized-audio-context)[\\/]/,
    priority: 9,
  },
  {
    name: 'vendor-theory',
    test: /node_modules[\\/]@tonaljs[\\/]/,
    priority: 8,
  },
  {
    name: 'vendor-ui',
    test: /node_modules[\\/](@radix-ui|lucide-react|vaul)[\\/]/,
    priority: 8,
  },
  {
    name: 'vendor',
    test: /node_modules/,
    priority: 5,
  },
  {
    name: 'song-controls',
    test: (id: string) => !id.includes('node_modules') && id.includes('src/components/SongControls'),
    priority: 3,
  },
  {
    name: 'status-bar',
    test: (id: string) => !id.includes('node_modules') && id.includes('src/components/StatusBar'),
    priority: 3,
  },
]
```

- [ ] **Step 3: Run production build and verify chunk sizes**

Run: `pnpm run build`  
Expected:
- `song-controls-*.js` is < 50 kB.
- `vendor-ui-*.js` and `vendor-theory-*.js` exist as independent cacheable chunks.
- Production build succeeds without error.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf(build): isolate vendor chunks from song-controls in rolldown code-splitting"
```

---

### Task 6: Full Verification & Regression Gate

**Files:**
- Entire repository

- [ ] **Step 1: Run linter and boundaries check**

Run: `pnpm run lint`  
Expected: 0 errors, 1 known pre-existing warning in `useFretboardTopologyModel.ts`.

- [ ] **Step 2: Run CSS tokens audit**

Run: `pnpm run ui:tokens`  
Expected: 0 undefined tokens.

- [ ] **Step 3: Run entire Vitest test suite**

Run: `pnpm run test`  
Expected: All 2,779 tests pass.

- [ ] **Step 4: Run production build**

Run: `pnpm run build`  
Expected: Successful build with clean chunk distribution.

- [ ] **Step 5: Verify git status is clean**

Run: `git status`  
Expected: Clean working tree on `perf-hotpaths-optimization`.
