# FretFlow Algorithm Time Complexity Audit & Performance Guardrail Specification

This specification provides a comprehensive static and dynamic algorithm complexity audit of the FretFlow core computational paths. It establishes theoretical Big-O baselines, documents integrated optimization architectures, and specifies an automated performance-testing guardrail framework using Vitest to prevent future regressions.

---

## 1. Executive Summary

FretFlow relies on several high-computational algorithms to render visual note shapes, generate theoretical chord voicing permutations, layout visual bounds on the fretboard SVG, and compile real-time audio playback layers. Without careful optimization, these operations scale combinatorially or quadratically, degrading performance on lower-end devices.

By decoupling visual frame animation updates from structural theoretical changes, bounding search limits via global LRU caching, pre-compiling timeline playback streams during user idle time, and sorting coordinate vertices to achieve linear outline hulls, we have reduced major operational complexity bottlenecks to $O(1)$ amortized runtime. 

To maintain this performance profile, this document specifies a deterministic testing framework that asserts mathematical scaling bounds and cache reference integrity without relying on flaky millisecond timers.

---

## 2. FretFlow Complexity Matrix

The following matrix maps the core computational modules of the FretFlow codebase, tracking their theoretical baseline complexity, target optimized complexity, and the active architectural mitigation patterns.

| Component Area | File Path | Baseline Worst-Case | Optimized Complexity | Mitigation Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **Chord Voicings** | [`voicings.ts`](file:///Users/isaaccocar/repos/fretboard-app/packages/core/src/shapes/voicings.ts) | $O(F^S)$ combinatorial | $O(1)$ amortized cache hit / $O(S \cdot W)$ miss | LRU Map cache (100 capacity) + fret span search window pruning |
| **Visual Connectors** | [`FretboardSVG.tsx`](file:///Users/isaaccocar/repos/fretboard-app/src/components/FretboardSVG/FretboardSVG.tsx) | $O(N^2 \log N)$ segment check | $O(1)$ amortized on frame animation | `ChordConnectorEvaluator` decoupling + stable layout note topology |
| **Polygon Hulls** | [`polygons.ts`](file:///Users/isaaccocar/repos/fretboard-app/packages/core/src/shapes/polygons.ts) | $O(V \log V)$ contour sorting | $O(V)$ linear scan | Pre-sorted index sweep-line contour hull construction |
| **Audio Scheduling** | [`useProgressionAudioPlayback.ts`](file:///Users/isaaccocar/repos/fretboard-app/src/hooks/useProgressionAudioPlayback.ts) | $O(S \cdot E)$ scheduling cost | $O(1)$ amortized play initiation | Eager 200ms-debounced background timeline builder and ref cache |

*Legend: $F$ = fret range, $S$ = string count, $W$ = maximum search window fret span, $N$ = notes in voicing, $V$ = polygon vertices/notes, $E$ = step musical events.*

---

## 3. Core Bottleneck Audits & Optimization Designs

### A. Chord Voicings & Permutations
* **File Location**: [`voicings.ts`](file:///Users/isaaccocar/repos/fretboard-app/packages/core/src/shapes/voicings.ts)
* **Algorithmic Baseline**: When searching for chord voicings, a naive depth-first permutation search evaluates possible pitch placements across every fret boundary. Across $S$ strings and $F$ frets, the combinations expand to **$O(F^S)$**.
* **Mitigation Design**:
  1. **LRU Cache Bound**: We maintain `voicingCache` next to a `MAX_CACHE_ENTRIES = 100` constant. Upon hit, the key is moved to the end of the Map’s insertion order. When size exceeds 100, the oldest entry is evicted in $O(1)$ via `voicingCache.delete(voicingCache.keys().next().value)`.
  2. **Search Space Pruning**: For cache misses, searches are constrained strictly within a maximum fret span window of size $W \le 4$. This limits the permutation tree traversal depth to **$O(S \cdot W)$**, preventing deep stack recursion.

### B. Visual Chord Connectors
* **File Location**: [`FretboardSVG.tsx`](file:///Users/isaaccocar/repos/fretboard-app/src/components/FretboardSVG/FretboardSVG.tsx)
* **Algorithmic Baseline**: Generating curves between notes in a chord voicing requires sorting coordinates, mapping bezier controls, and computing overlap/clipping bounds. Rendering these polylines scales to **$O(N^2 \log N)$** for $N$ fretboard notes. If executed on every playhead clock tick, the complexity multiplies to **$O(T \cdot N^2 \log N)$** (where $T$ represents 60fps animation ticks).
* **Mitigation Design**:
  1. **Memoization Decoupling**: Visual playhead snapping triggers visual clock snapshot updates, but the chord shape remains static. We wrap the segment builder inside a memoized `ChordConnectorEvaluator` using the stable layout `topology` list. Rerendering the playhead has a cost of **$O(1)$** for the polylines.
  2. **Deep Prop Comparison**: We implement `areConnectorPropsEqual` to perform explicit length and field checks for `explicitVoicings` and `intervalPolylines` to guarantee updates only trigger when physical fret values actually change.

### C. CAGED/3NPS Polygon Bounds
* **File Location**: [`polygons.ts`](file:///Users/isaaccocar/repos/fretboard-app/packages/core/src/shapes/polygons.ts)
* **Algorithmic Baseline**: Fretboard shape highlighting (CAGED boxes and 3NPS scales) requires tracing notes to form closed convex or non-convex outline polygons. Computing these contours naively involves multi-pass sorting of $V$ note positions, leading to an **$O(V \log V)$** complexity.
* **Mitigation Design**:
  1. **Single-Pass Sweep Hull**: Since strings and fretboard grids are inherently ordered, we pre-sort inputs by string/fret indexes. We then trace coordinates in a single-pass sweep-line scan. This builds the polygon contour in **$O(V)$** linear time.

### D. Audio Timeline & Event Scheduling
* **File Location**: [`useProgressionAudioPlayback.ts`](file:///Users/isaaccocar/repos/fretboard-app/src/hooks/useProgressionAudioPlayback.ts)
* **Algorithmic Baseline**: Constructing Tone.js Parts and mapping chord onset, strum direction, bass frequencies, drums, and metronome events across a song progression scales to **$O(S \cdot E)$**. Running this dynamic scheduling synchronously when clicking "Play" freezes the UI and delays audio start.
* **Mitigation Design**:
  1. **Eager Idle-Time Compilation**: We setup a React `useEffect` hook that listens to changes in progression steps. After a 200ms user idle debounce, it eagerly triggers dynamic engine imports and schedules the full timeline in the background, caching it in `cacheRef.current`. Playback start becomes an $O(1)$ task that simply triggers the pre-cached playback stream.

---

## 4. Performance Guardrail Testing Blueprint

To guarantee these optimized algorithmic paths do not regress, the codebase integrates automated, deterministic complexity checks.

### Guardrail 1: Cache Reference Equality Assertion
Tests must assert that multiple identical parameters yield the exact same array reference in memory, ensuring $O(1)$ retrieval.

```typescript
// Location: packages/core/src/shapes/voicings.test.ts
describe("Chord Voicings Cache Guardrail", () => {
  it("must return the exact same array reference on cache hit", () => {
    const params = {
      chordRoot: "C",
      chordType: "maj7",
      tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
      maxFret: 15,
      voicingType: "full" as const,
    };

    const firstResult = generateVoicings(params);
    const secondResult = generateVoicings(params);

    // Assert absolute reference equality (O(1) memory lookup)
    expect(firstResult).toBe(secondResult);
  });
});
```

### Guardrail 2: Deterministic Operational Scaling Bounds
Instead of measuring execution times in milliseconds (which are volatile in CI), we track primitive operations and enforce a strict sub-quadratic scale factor boundary when input sizes double.

```typescript
// Example Spec for Complexity Scaling Verification
describe("Chord Connector Intersection Scale Guardrail", () => {
  it("scales intersection checks linearly, avoiding O(N^2) expansion", () => {
    // 1x scale input (6-string fretboard layout)
    const baseCount = countConnectorCrossingEvaluations(sixStringLayout);
    
    // 2x scale input (12-string double-neck layout)
    const doubleCount = countConnectorCrossingEvaluations(twelveStringLayout);
    
    // Enforce strict linear boundary: Ops(2x) <= 2.2 * Ops(1x)
    expect(doubleCount).toBeLessThanOrEqual(baseCount * 2.2);
  });
});
```

### Guardrail 3: Main-Thread Non-Blocking Transition Spy
Ensure that visual clock repaints are always deferred using React concurrent transitions to keep the main thread responsive.

```typescript
// Location: src/components/TransportBar/TransportBar.test.tsx
describe("Visual Thread Concurrency Guardrail", () => {
  it("triggers visual clock frame updates within a React transition", () => {
    const transitionSpy = vi.spyOn(React, "startTransition");
    
    // Trigger visual playhead ticks
    act(() => {
      triggerVisualClockUpdate();
    });

    expect(transitionSpy).toHaveBeenCalled();
  });
});
```

---

## 5. Verification & Developer Guidelines

When modifying or extending algorithms in the core package:
* **No Cache Leaks**: All global caching maps (such as `voicingCache`) must be strictly capped using a deterministic eviction strategy (like LRU oldest eviction).
* **Render Isolation**: Keep DOM repaints and complex geometric calculations decoupled. Visual clock ticks should never trigger segment calculations; use memoization wrappers bounded by stable topology props.
* **Sequential Verification**: Always run `pnpm test` and `pnpm run lint` locally before pushing. Do not run parallel build tasks alongside vitest threads to avoid workspace dynamic import conflicts.
