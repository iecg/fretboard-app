# Performance Pass 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement second-pass performance optimizations across Tone.js critical-path chunk deferral, AABB spatial pruning in chord connector conflict resolution, allocation-free close-voicing ranking/scoring in `@fretflow/core`, and $O(1)$ reference equality checks in `FretboardSVG`.

**Architecture:**
- **Bundle Architecture:** Dynamically import Tone.js inside `ensureToneStarted` (`toneInit.ts`) and `probeOutputHealth` (`audioOutputHealth.ts`), cutting Tone.js out of the initial critical render chunk (`index-*.js`) so `vendor-tone` is only fetched when audio is triggered.
- **Fretboard Geometry:** Add Axis-Aligned Bounding Box (AABB) rejection in `assignConflictEncodings` (`useChordConnectorPolylines.ts`) so disjoint voicings skip all segment distance calculations.
- **Pure Theory Optimization:** Make `scoreCloseVoicing` and `selectNeckSpread` in `packages/core/src/shapes/voicings.ts` zero-allocation by replacing array mapping/filtering/spreading with single-pass loops.
- **Fretboard Connector Optimization:** Streamline `areConnectorPropsEqual` in `FretboardSVG.tsx` to leverage the stable note references and voicing identity keys already produced by `useAnimatedFretboardView`.

**Tech Stack:** React 19, TypeScript, Vitest, Rolldown / Vite 8, Jotai, Tone.js.

## Global Constraints

- Must pass full test suite (2,783+ tests) without breaking any existing test contracts.
- Scale and chord rendering domains must remain strictly independent (per `AGENTS.md`).
- Fretboard boundary check (`node scripts/check-fretboard-boundaries.mjs`) must remain clean.
- All commits must follow Conventional Commits with scope (e.g. `perf(audio): ...`, `perf(fretboard): ...`, `perf(core): ...`).

---

### Task 1: AABB Spatial Pruning in Chord Connector Conflict Resolution

**Files:**
- Modify: `packages/fretboard/src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts:230-250`
- Test: `packages/fretboard/src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

**Interfaces:**
- Consumes: `NormalizedChordConnectorVertex[]` (`fretIndex`, `stringIndex`), `CONFLICT_THRESHOLD_UNITS` (= 0.6)
- Produces: Fast bounding box pre-filtering before `polylineDistance`

- [ ] **Step 1: Inspect test coverage in `useChordConnectorPolylines.test.ts`**
  Run `pnpm run test packages/fretboard/src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts` to establish baseline.

- [ ] **Step 2: Add AABB bounding-box calculation and rejection to `assignConflictEncodings`**
  In `useChordConnectorPolylines.ts`:
  Compute `{ minX, maxX, minY, maxY }` for each voicing in $O(L)$.
  In the `(i, j)` loop, check if:
  `b1.minX - b2.maxX > CONFLICT_THRESHOLD_UNITS || b2.minX - b1.maxX > CONFLICT_THRESHOLD_UNITS || b1.minY - b2.maxY > CONFLICT_THRESHOLD_UNITS || b2.minY - b1.maxY > CONFLICT_THRESHOLD_UNITS`
  If true, skip `polylineDistance`.

- [ ] **Step 3: Run tests to verify identical encoding assignment**
  Run `pnpm run test packages/fretboard/src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`.

- [ ] **Step 4: Commit**
  `git commit -m "perf(fretboard): prune chord connector conflict checks with AABB bounding boxes"`

---

### Task 2: Allocation-Free Close-Voicing Ranking & Scoring in `@fretflow/core`

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts:54-78, 110-130`
- Test: `packages/core/src/shapes/voicings.test.ts`

**Interfaces:**
- Consumes: `Voicing` notes with `fretIndex`
- Produces: Bit-identical `scoreCloseVoicing` and `selectNeckSpread` without heap array allocations

- [ ] **Step 1: Run voicings tests baseline**
  Run `pnpm run test packages/core/src/shapes/voicings.test.ts`.

- [ ] **Step 2: Rewrite `scoreCloseVoicing` to single-pass accumulation**
  In `packages/core/src/shapes/voicings.ts`:
  Replace `.map().filter()`, `Math.max(...fretted)`, `Math.min(...fretted)`, and `reduce` with a direct loop accumulating `minFret`, `maxFret`, `frettedCount`, `openCount`, `topFret`, `sum`, and `compactDevSum`.

- [ ] **Step 3: Rewrite `selectNeckSpread` to compute `lo` and `hi` without array allocations**
  In `selectNeckSpread`, calculate `lo` and `hi` in a single pass over `v.notes`.

- [ ] **Step 4: Verify with test suite**
  Run `pnpm run test packages/core/src/shapes/voicings.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "perf(core): eliminate array allocations in close-voicing scoring and neck spread"`

---

### Task 3: Streamline `areConnectorPropsEqual` in `FretboardSVG.tsx`

**Files:**
- Modify: `packages/fretboard/src/components/FretboardSVG/FretboardSVG.tsx:178-226`
- Test: `packages/fretboard/src/components/FretboardSVG/FretboardSVG.test.tsx`

**Interfaces:**
- Consumes: `prev` and `next` props for `ChordConnectorEvaluator`
- Produces: Fast $O(1)$ equality using `voicingKey` equality and reference identity

- [ ] **Step 1: Run FretboardSVG tests baseline**
  Run `pnpm run test packages/fretboard/src/components/FretboardSVG/FretboardSVG.test.tsx`.

- [ ] **Step 2: Optimize `explicitVoicings` and `noteData` comparisons in `areConnectorPropsEqual`**
  - For `explicitVoicings`: compare `length` and `voicingKey`, `isFallback`, `shape` (since `voicingKey` encodes canonical string-fret coordinates). Omit the nested note-by-note loop.
  - For `noteData`: rely on `prev.noteData === next.noteData`.

- [ ] **Step 3: Run FretboardSVG tests**
  Run `pnpm run test packages/fretboard/src/components/FretboardSVG/FretboardSVG.test.tsx`.

- [ ] **Step 4: Commit**
  `git commit -m "perf(fretboard): streamline connector props comparison in FretboardSVG"`

---

### Task 4: Decouple Tone.js from Initial Landing Path

**Files:**
- Modify: `packages/fretboard/src/core/toneInit.ts`
- Modify: `packages/fretboard/src/core/audioOutputHealth.ts`
- Test: `packages/fretboard/src/core/toneInit.test.ts`
- Test: `packages/fretboard/src/core/audioOutputHealth.test.ts`

**Interfaces:**
- Consumes: Web Audio API / Tone.js dynamic import
- Produces: Dynamic `getTone()` loading inside `ensureToneStarted` and `probeOutputHealth`

- [ ] **Step 1: Run toneInit and audioOutputHealth tests baseline**
  Run `pnpm run test packages/fretboard/src/core/toneInit.test.ts packages/fretboard/src/core/audioOutputHealth.test.ts`.

- [ ] **Step 2: Update `toneInit.ts` to dynamically import `tone`**
  Replace top-level `import * as Tone from "tone"` with dynamic `await import("tone")` inside `ensureToneStarted`.

- [ ] **Step 3: Update `audioOutputHealth.ts` to dynamically import `tone`**
  Replace top-level `import * as Tone from "tone"` with dynamic `await import("tone")` inside `probeOutputHealth`.

- [ ] **Step 4: Run unit tests**
  Run `pnpm run test packages/fretboard/src/core/toneInit.test.ts packages/fretboard/src/core/audioOutputHealth.test.ts`.

- [ ] **Step 5: Inspect build output for initial bundle independence**
  Run `pnpm run build` and inspect `dist/assets/index-*.js.map` to confirm `vendor-tone` is no longer in the static import graph of `index-*.js`.

- [ ] **Step 6: Commit**
  `git commit -m "perf(audio): dynamically load tone in toneInit and audioOutputHealth"`

---

### Task 5: Full Verification & Regression Gate

**Files:**
- Verify: Entire repository

- [ ] **Step 1: Run linter and boundary checks**
  Run `pnpm run lint`. Verify 0 errors and boundary check passes.

- [ ] **Step 2: Run CSS token check**
  Run `pnpm run ui:tokens`. Verify 0 undefined tokens.

- [ ] **Step 3: Run complete test suite**
  Run `pnpm run test`. Verify all 2,783+ tests pass.

- [ ] **Step 4: Run production build**
  Run `pnpm run build`. Verify build passes and examine final chunk sizes.
