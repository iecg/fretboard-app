# Performance Hot-Paths & Multi-Layer Optimization — Design

**Date:** 2026-09-30  
**Status:** Approved by user, ready for implementation planning  
**Topic:** Address performance hot-paths across runtime SVG rendering, music theory computation caching, and bundle chunking.

---

## 1. Context & Motivation

FretFlow is a React 19 + TypeScript guitar fretboard exploration tool with real-time audio playback, interactive fretboard SVG rendering, and musical theory modeling backed by Tonal.js.

Profiling and codebase analysis revealed three distinct layers of performance bottlenecks:
1. **Runtime SVG & Animation Overhead**: During audio playback and lead-in countdowns, every mounted `FretboardNote` (~150 notes) subscribes to media-query listeners (`useReducedMotion`) and mounts Framer Motion's `<AnimatePresence>` tree, even though only 2–4 guide notes are targeted. Additionally, `useEmphasisContext` returns a fresh unmemoized object literal, busting `useAnimatedFretboardView`'s memoized dependencies, and `renderedNoteSignature` constructs 19-element arrays on every pass.
2. **Uncached Pure Music Theory & Topology Generation**: `getScaleNotes`, `getChordNotes`, and `isFlatKey` dynamically invoke Tonal.js parsers (`Scale.get`, `Chord.get`, `Key.majorKey`) without caching. In `buildStaticFretboardTopology`, `getNoteDisplayInScale` is invoked 150 times per render, `shapePolygons.some(...)` does linear vertex scans per note, and octaves are derived by string-formatting and regex-parsing note names.
3. **Bundle Chunk Bloat**: In `vite.config.ts`, `song-controls` code-splitting group had higher priority (priority 3) than vendor groups (priorities 1–2) and lacked a `node_modules` exclusion, causing 452 kB of vendor dependencies (`lucide-react`, `motion`, `motion-dom`, `@radix-ui/*`, `@tonaljs/*`) to be packed into the component chunk.

---

## 2. Goals & Non-Goals

### Goals
- **Eliminate redundant SVG hooks and motion tree overhead**: Reduce media-query subscriptions from 150 to 1, and evaluate Framer Motion only on active target notes.
- **Stabilize context references**: Memoize `useEmphasisContext` so playback frame updates without harmonic changes do not churn the fretboard SVG tree.
- **Cache high-frequency pure theory lookups**: Add bounded caches to `getScaleNotes`, `getChordNotes`, and static $O(1)$ lookup for `isFlatKey`.
- **Streamline topology generation**: Batch 12-pitch spelling before the 150-note loop, pre-index polygon fret bounds, and use integer octave math.
- **Fix code-splitting priorities**: Ensure third-party libraries live in cacheable vendor chunks, shrinking `song-controls-*.js` from ~452 kB to ~30–40 kB.
- **Zero visual regressions & 100% test pass rate**: Preserve exact musical spelling, visual layout, and test suite integrity.

### Non-Goals
- Altering the visual design, token definitions, or audio synthesis models.
- Changing Jotai state architecture or replacing the Jotai store.
- Rewriting `FretboardSVG` from SVG to HTML Canvas.

---

## 3. System Architecture & Detailed Design

### Section A: Runtime SVG Rendering & Animation Pipeline

#### 1. Hoist Motion Policy to Avoid 150 Hook Subscriptions
- `FretboardSVG` already computes `motionPolicy` via `resolveFretboardMotionPolicy({ prefersReducedMotion, playbackActive })` using a top-level `useReducedMotion()` call.
- Pass `prefersReducedMotion` (or the resolved `animationMode = motionPolicy.noteMode`) down as a prop through `FretboardNoteLayer` to `FretboardNote`.
- Remove `const prefersReducedMotion = useReducedMotion();` from `FretboardNote.tsx`.

#### 2. Conditional Mounting of `<AnimatePresence>`
- Guide countdown rings only appear on notes with an active `guidePhase` (`"landing"` or `"hold"`). Across 150 notes, at most 2–4 notes have this active simultaneously.
- Currently, `<AnimatePresence>` is rendered unconditionally on all 150 notes.
- Track whether a note has (or had in the previous render) a `guidePhase` using a local state/ref flag. Only mount `<AnimatePresence>` on notes undergoing entering or exiting countdown states. All 146 passive notes skip Framer Motion context mounting entirely.

#### 3. Stabilize `useEmphasisContext`
- In `packages/fretboard/src/components/FretboardSVG/hooks/useEmphasisContext.ts`, wrap the returned object in `useMemo`:
  ```ts
  return useMemo(() => ({
    nextGuideTones,
    nextGuideToneLabels,
    nextChordTones,
    incomingTones,
    departingTones,
    guideCountdownActive,
    guideCountdownWindowMs,
    countdownTicks,
    lens,
    commonTones,
    heldTargetTones,
  }), [
    nextGuideTones,
    nextGuideToneLabels,
    nextChordTones,
    incomingTones,
    departingTones,
    guideCountdownActive,
    guideCountdownWindowMs,
    countdownTicks,
    lens,
    commonTones,
    heldTargetTones,
  ]);
  ```
- Because atoms like `nextGuideTonesAtom` update only at step boundaries, this returns a referentially identical object across intermediate frames, preventing unnecessary invalidation of `buildAnimatedFretboardNotes`.

#### 4. Fast Note Signature Serialization
- In `packages/fretboard/src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, replace the 19-element array `.join("|")` in `renderedNoteSignature` with a direct template string:
  ```ts
  function renderedNoteSignature(note: RenderedFretboardNote): string {
    const emph = note.applyLensEmphasis;
    return `${note.stringIndex}|${note.fretIndex}|${note.noteName}|${note.octave}|${note.noteClass}|${note.displayName}|${note.displayValue}|${note.cx}|${note.cy}|${note.applyDimOpacity}|${emph.opacityBoost}|${emph.radiusBoost}|${emph.transitionRole ?? ""}|${emph.guideTargetLabel ?? ""}|${note.isHidden}|${note.isTension}|${note.isGuideTone}|${note.fullChordShape ?? ""}|${note.isInRegion}`;
  }
  ```

---

### Section B: Theory Caching & Fast Topology Generation

#### 1. Core Function Memoization (`@fretflow/core`)
- **`getScaleNotes(rootNote: string, scaleName: string): string[]`**:
  - Add bounded LRU/Map cache (capacity 256).
  - Cache key: `${rootNote}|${scaleName}`.
  - Returns cached array reference.
- **`getChordNotes(rootNote: string, chordName: string): string[]`**:
  - Add bounded LRU/Map cache (capacity 256).
  - Cache key: `${rootNote}|${chordName}`.
  - Returns cached array reference.
- **`isFlatKey(rootNote: string): boolean`**:
  - Replace `Key.majorKey(rootNote).alteration < 0` with a constant `Set` of known flat roots:
    ```ts
    const FLAT_ROOT_KEYS = new Set([
      "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
      "f", "bb", "eb", "ab", "db", "gb", "cb",
      "A#", "D#", "G#" // enharmonic equivalents where flat preference applies
    ]);
    ```
  - For non-standard inputs, fall back to Tonal's `Key.majorKey`.
- Export `clearTheoryCache()` for deterministic test isolation.

#### 2. Batch Spelling in `buildStaticFretboardTopology`
- There are only 12 chromatic pitches.
- Before the 150-note loop:
  ```ts
  const displayNameByNote = new Map<string, string>();
  for (const n of NOTES) {
    displayNameByNote.set(
      n,
      getNoteDisplayInScale(n, rootNote, scale, preferFlats),
    );
  }
  ```
- In the inner loop, replace `getNoteDisplayInScale(...)` with `displayNameByNote.get(noteName)!`, reducing Tonal queries from 150 to 12.

#### 3. Pre-Indexed Polygon Fret Ranges
- In `buildStaticFretboardTopology`, pre-filter active polygons and precalculate min/max fret bounds per string index:
  ```ts
  const activePolygonRangesByString = new Map<number, Array<{ minFret: number; maxFret: number }>>();
  // populated once before string/fret loop
  ```
- Inside the 150-note loop, checking whether a note position is in playable context becomes an $O(1)$ integer range comparison rather than an array scan across polygon vertices.

#### 4. Integer Octave Arithmetic
- Pre-parse open string pitches once:
  ```ts
  const openStringParsed = tuning.map((openStr) => {
    const p = parseNote(openStr) ?? { noteName: "E", octave: 4 };
    return { octave: p.octave, noteIndex: NOTES.indexOf(p.noteName) };
  });
  ```
- For note `(stringIndex, fretIndex)`, compute octave:
  ```ts
  const open = openStringParsed[stringIndex];
  const octave = open ? open.octave + Math.floor((open.noteIndex + fretIndex) / 12) : 4;
  ```
- Bypasses string concatenation (`${openString}4`) and regex parsing 150 times per render.

---

### Section C: Bundle Code-Splitting & Rolldown Chunk Architecture

#### 1. Rolldown Priority Rebalancing in `vite.config.ts`
- Ensure all vendor groups run at **higher priority** than app component groups.
- Exclude `node_modules` from application component groups:
  ```ts
  codeSplitting: {
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
    ],
  }
  ```

---

## 4. Verification & Testing Plan

### Automated Tests
1. **Unit & Property Tests**:
   - `pnpm --filter @fretflow/core run test` — verify all theory and caching tests pass.
   - `pnpm --filter @fretflow/fretboard run test` — verify topology generation, note signatures, and chord connector tests pass.
   - Full Vitest suite: `pnpm run test` (all 2,779 tests pass).
2. **Boundary & Lint Checks**:
   - `pnpm run lint` — ensures 0 errors and `@fretflow/fretboard` boundaries remain intact.
   - `pnpm run ui:tokens` — ensures no undefined CSS variables.
3. **Production Build & Bundle Size Verification**:
   - `pnpm run build` — ensures clean production compilation.
   - Inspect bundle chunk output: confirm `song-controls-*.js` drops from 452 kB down to <50 kB, and new `vendor-theory` / `vendor-ui` chunks are cleanly created.
