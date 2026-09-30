# Performance Hotpaths Pass 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant object and string allocations in the 150-note fretboard render pipeline, memoize CAGED/3NPS shape generation in `@fretflow/core`, and streamline derived chord overlay atom calculations for high-efficiency 60fps playback and UI interaction.

**Architecture:**
- **Area 1 (Fretboard Render & Allocation Pruning):** Replace per-note `leadContext` allocations in `buildAnimatedFretboardNotes`, short-circuit cache hit detection in `buildRenderedFretboardNotes` with field equality to avoid allocating 150 objects + 150 signature strings on every frame, memoize column-level `taperAwareRadiusScale`, and stabilize hit-target styles in `FretboardHitTargetLayer`.
- **Area 2 (CAGED & 3NPS Shape Cache):** Add bounded LRU/Map memoization in `@fretflow/core` for `getCagedCoordinates` and `get3NPSCoordinates` across root notes, scale patterns, and tuning.
- **Area 3 (Chord Overlay & Highlight Optimization):** Replace array allocation, sorting, and string concatenation in `memoizedHighlightSet` with zero-allocation Set equality checking; optimize `addChordTonesWithinPolygon` to scan only covered string ranges with O(1) Set tone lookups.

**Tech Stack:** TypeScript, React 19, Jotai, Vitest.

## Global Constraints
- Trunk-based PR workflow: conventional commit format `perf(scope): description`.
- Independent render domains: scale and chord rendering must never cross-wire visibility or color state.
- Package boundaries: `@fretflow/fretboard` must not import from `src/` or `import.meta`.
- Zero test regressions across 196 test suites and all visual regression invariants.

---

### Task 1: CAGED & 3NPS Shape Coordinate Memoization (`@fretflow/core`)

**Files:**
- Modify: `packages/core/src/shapes/polygons.ts`
- Modify: `packages/core/src/shapes/threeNPS.ts`
- Test: `packages/core/src/shapes/shapes.test.ts`
- Test: `packages/core/src/shapes/threeNPS.ts` (or co-located tests)

**Interfaces:**
- Consumes: `getCagedCoordinates(rootNote, shape, scaleName, tuning, frets)` and `get3NPSCoordinates(rootNote, scalePattern, tuning, frets, position, octave)`
- Produces: Identical `ShapeResult` with stable references on identical parameter inputs.

- [x] **Step 1: Write tests for shape coordinate memoization**
  - Add test in `shapes.test.ts` verifying that repeat calls with identical arguments to `getCagedCoordinates` return the exact cached object reference.
  - Add test verifying that repeat calls to `get3NPSCoordinates` return identical cached results.
  - Verify cache distinguishes different root notes, shapes, scales, tunings, positions, and octaves.

- [x] **Step 2: Implement bounded memoization for `getCagedCoordinates`**
  - In `polygons.ts`, add a bounded cache (e.g. max 128 entries) keyed by `${rootNote}|${shape}|${scaleName}|${tuning.join(',')}|${frets}`.
  - If cached, return the cached `ShapeResult`. Otherwise compute, store in cache (evicting oldest if capacity exceeded), and return.

- [x] **Step 3: Implement bounded memoization for `get3NPSCoordinates`**
  - In `threeNPS.ts`, add a bounded cache (e.g. max 128 entries) keyed by `${rootNote}|${scalePattern}|${tuning.join(',')}|${frets}|${position}|${octave}`.
  - If cached, return cached `ShapeResult`.

- [x] **Step 4: Run tests and verify**
  - Run `pnpm run test packages/core/src/shapes/`
  - Ensure all pass without regressions.

---

### Task 2: Derived Atom Highlight Set & Polygon Tone Scan Optimization (`@fretflow/fretboard`)

**Files:**
- Modify: `packages/fretboard/src/store/chordOverlayAtoms.ts`
- Test: `packages/fretboard/src/store/chordOverlayAtoms.test.ts`

**Interfaces:**
- Consumes: `memoizedHighlightSet(positionKeys: Iterable<string>): Set<string>`, `addChordTonesWithinPolygon(get, result, shapePolygons)`
- Produces: Referential stability for equal Sets without sorting or string serialization; faster range-bounded chord tone scanning.

- [x] **Step 1: Write test for Set referential stability and range scanning**
  - In `chordOverlayAtoms.test.ts`, verify that `memoizedHighlightSet` preserves reference equality when given a new Set with the same elements in any order, without string serialization.
  - Verify that `addChordTonesWithinPolygon` produces the exact same highlight coordinates as before.

- [x] **Step 2: Implement zero-allocation Set comparison in `memoizedHighlightSet`**
  - Replace the array spread, `.sort()`, and `.join("|")` with an O(N) Set comparison:
    ```ts
    const nextSet = positionKeys instanceof Set ? positionKeys : new Set(positionKeys);
    if (nextSet.size === cachedHighlightSet.size) {
      let equal = true;
      for (const item of nextSet) {
        if (!cachedHighlightSet.has(item)) { equal = false; break; }
      }
      if (equal) return cachedHighlightSet;
    }
    cachedHighlightSet = nextSet;
    return cachedHighlightSet;
    ```

- [x] **Step 3: Optimize `addChordTonesWithinPolygon` using `polygonCoverage.stringRanges`**
  - Convert `tones` to `const toneSet = new Set(tones)` for O(1) checks.
  - Iterate through `polygonCoverage.stringRanges` instead of all 6 strings x 25 frets.
  - Only test notes in `[range.minFret, range.maxFret]` for strings that have polygon coverage.

- [x] **Step 4: Run tests and verify**
  - Run `pnpm run test packages/fretboard/src/store/chordOverlayAtoms.test.ts`

---

### Task 3: Fretboard Render Loop & Note Allocation Pruning

**Files:**
- Modify: `packages/fretboard/src/components/FretboardSVG/utils/semantics.ts`
- Modify: `packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Modify: `packages/fretboard/src/components/FretboardSVG/utils/noteSizing.ts`
- Modify: `packages/fretboard/src/components/FretboardSVG/FretboardHitTargetLayer.tsx`
- Test: `packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
- Test: `packages/fretboard/src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx`

**Interfaces:**
- Consumes: `buildAnimatedFretboardNotes`, `buildRenderedFretboardNotes`, `getEmphasis`, `taperAwareRadiusScale`
- Produces: Byte-identical rendered notes and hit target DOM, with 0 intermediate object/string allocations on cache hits.

- [x] **Step 1: Write tests for render loop stability and hit-target optimization**
  - Verify that `buildRenderedFretboardNotes` retains stable references on cache hits.
  - Verify `getEmphasis` handles direct context correctly.

- [x] **Step 2: Streamline `buildAnimatedFretboardNotes` and `getEmphasis`**
  - In `semantics.ts`, update `getEmphasis` to accept `noteName: string` and optional `emphasisContext` directly (or support a light signature), removing the need to allocate `{ notePc: note.noteName, ... }` 150 times.
  - Update `buildAnimatedFretboardNotes` to call `getEmphasis(note.noteClass, note.isGuideTone, note.noteName, emphasisContext)`.

- [x] **Step 3: Fast-path cache hit check in `buildRenderedFretboardNotes`**
  - Implement `isRenderedNoteMatch(prev, note, cx, cy)` that checks primitive fields directly.
  - In `buildRenderedFretboardNotes`, check `prev && isRenderedNoteMatch(prev.result, note, cx, cy)`.
  - If matched, reuse `prev.result` immediately without allocating `{ ...note, cx, cy }` or building `sig`.
  - Only compute `positioned` and `sig` on cache miss.

- [x] **Step 4: Memoize `taperAwareRadiusScale` by fret column / x coordinate**
  - In `noteSizing.ts`, memoize `taperAwareRadiusScale` results by `(x, neckWidthPx, neckHeight, numStrings, noteBubblePx)`.
  - With 25 discrete fret columns, all 6 strings at the same fret hit the cache, saving ~125 recalculations per render.

- [x] **Step 5: Optimize `FretboardHitTargetLayer` hit target rendering**
  - Memoize individual hit target items or pre-cache static style objects `{ position, left, top, width, height, ... }` keyed by `(left, top, noteBubblePx, noteFontPx, isInteractive)`.

- [x] **Step 6: Run test suite and visual regression checks**
  - Run `pnpm run test`
  - Run `pnpm run lint`
  - Run `pnpm run build`

---

### Task 4: Integration Verification, PR & Cleanup

- [x] **Step 1: Full verification**
  - Execute `pnpm run lint`, `pnpm run test`, `pnpm run build`, `pnpm run ui:tokens`.
- [ ] **Step 2: Commit changes**
  - Conventional commits: `perf(core, fretboard): pass 3 hotpaths and allocation pruning`.
- [ ] **Step 3: Push branch and create PR**
  - Push `perf-hotpaths-pass-3` to GitHub and open PR using `gh pr create`.
