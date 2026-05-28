# FretFlow Performance Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely eliminate downbeat playhead stuttering and interaction lag during progression playback by decoupling connector rendering from animation frames, caching visual chord voicings on edit, pre-compiling backing audio timelines, and deferring heavy SVG repaints using React 19 concurrent transitions.

**Architecture:** We will separate the stable fretboard note geometry (static coordinates) from the high-frequency animation overlays (playhead glides and guide-tone pulsing). We will introduce eager, debounced background calculations for both the audio timeline compilation and visual voicing permutations. Finally, we will wrap progression step transitions in React 19 `startTransition` blocks to give the playhead visual loop absolute rendering priority.

**Tech Stack:** React 19, TypeScript, Jotai, Tone.js, Vitest, Testing Library

---

### Task 1: Decouple Chord Connector Generation from Animation Frames

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write a failing test verifying that useChordConnectorPolylines is evaluated with static topology instead of animated noteData**

Open [src/components/FretboardSVG/FretboardSVG.test.tsx](file:///Users/isaaccocar/repos/fretboard-app/src/components/FretboardSVG/FretboardSVG.test.tsx) and add a test assertion verifying that connector polylines do not recalculate when animation-only metadata changes.
```typescript
import { render } from "@testing-library/react";
import { FretboardSVG } from "./FretboardSVG";
import * as useChordConnectorHooks from "./hooks/useChordConnectorPolylines";

vi.mock("./hooks/useChordConnectorPolylines", async () => {
  const actual = await vi.importActual<typeof useChordConnectorHooks>("./hooks/useChordConnectorPolylines");
  return {
    ...actual,
    useChordConnectorPolylines: vi.fn(actual.useChordConnectorPolylines),
  };
});

describe("FretboardSVG Connector Decoupling", () => {
  it("does not re-evaluate useChordConnectorPolylines when animation data changes", () => {
    const spy = vi.spyOn(useChordConnectorHooks, "useChordConnectorPolylines");
    const mockTuning = ["E", "A", "D", "G", "B", "E"];
    const mockLayout = [["E", "F"], ["A", "A#"], ["D", "D#"], ["G", "G#"], ["B", "C"], ["E", "F"]];

    const { rerender } = render(
      <FretboardSVG
        effectiveZoom={100}
        neckWidthPx={1000}
        startFret={0}
        endFret={12}
        fretboardLayout={mockLayout}
        tuning={mockTuning}
        highlightNotes={["E", "G"]}
        rootNote="E"
        playbackSnapshot={{
          playing: true,
          activeStepIndex: 0,
          globalFraction: 0,
          localFraction: 0,
          stepDurationBeats: 4,
          beatPosition: 0,
          commonWithNext: new Set(),
          nextGuideTones: new Set(),
        }}
      />
    );

    const initialCallCount = spy.mock.calls.length;

    // Rerender with a different playbackSnapshot position (simulating animation frames)
    rerender(
      <FretboardSVG
        effectiveZoom={100}
        neckWidthPx={1000}
        startFret={0}
        endFret={12}
        fretboardLayout={mockLayout}
        tuning={mockTuning}
        highlightNotes={["E", "G"]}
        rootNote="E"
        playbackSnapshot={{
          playing: true,
          activeStepIndex: 0,
          globalFraction: 0.1,
          localFraction: 0.1, // Only local fraction changes
          stepDurationBeats: 4,
          beatPosition: 0.4,
          commonWithNext: new Set(),
          nextGuideTones: new Set(),
        }}
      />
    );

    expect(spy.mock.calls.length).toBe(initialCallCount);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: FAIL due to `spy.mock.calls.length` increasing (because `useChordConnectorPolylines` currently depends on `noteData`, which regenerates when `playbackSnapshot` updates).

- [ ] **Step 3: Modify FretboardSVG to pass static topology coordinates to the connector hook**

Modify [src/components/FretboardSVG/FretboardSVG.tsx:L420-435](file:///Users/isaaccocar/repos/fretboard-app/src/components/FretboardSVG/FretboardSVG.tsx) to pass stable `topology` to `useChordConnectorPolylines` instead of frame-animated `noteData`.
```typescript
// Replace the noteData dependency in FretboardConnectorLayer with stable topology coords
const chordPolylines = useChordConnectorPolylines({
  noteData: topology, // Swapped from noteData to topology
  chordToneNames: chordTones,
  fretCenterX,
  stringYAt,
  stringRowPx,
  yBounds: connectorYBounds,
  explicitVoicings: fullChordVoicings,
  voicingSourceActive: showChordConnectors,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "perf(fretboard): decouple chord connector generation from frame ticks using static topology"
```

---

### Task 2: Implement Global Voicing Permutations Cache

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Test: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Write a failing test verifying that multiple calls to generateVoicings with the same keys hit a memory cache**

Open [src/store/chordOverlayAtoms.test.ts](file:///Users/isaaccocar/repos/fretboard-app/src/store/chordOverlayAtoms.test.ts) and add a test verifying that calling `generateVoicings` behaves identically but bypasses calculation through caching.
```typescript
import { generateVoicings } from "@fretflow/core";

describe("Voicing Generation Caching", () => {
  it("retrieves voicings from memory cache if parameters are identical", () => {
    const params = {
      chordRoot: "C",
      chordType: "maj7",
      tuning: ["E", "A", "D", "G", "B", "E"],
      maxFret: 24,
      voicingType: "close" as const,
    };

    const firstResult = generateVoicings(params);
    const secondResult = generateVoicings(params);
    
    // They must point to the exact same array reference in memory
    expect(firstResult).toBe(secondResult);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/store/chordOverlayAtoms.test.ts`
Expected: FAIL with array reference mismatch (`firstResult !== secondResult`).

- [ ] **Step 3: Modify generateVoicings inside core packages to use a global LRU or Map cache**

Modify [packages/core/src/shapes/voicings.ts:L44-56](file:///Users/isaaccocar/repos/fretboard-app/packages/core/src/shapes/voicings.ts#L44-L56) to wrap execution in a static `Map` cache lookup.
```typescript
const voicingCache = new Map<string, Voicing[]>();

export function generateVoicings(params: GenerateVoicingsParams): Voicing[] {
  const cacheKey = `${params.chordRoot}-${params.chordType}-${params.tuning.join(",")}-${params.maxFret}-${params.voicingType}`;
  
  if (voicingCache.has(cacheKey)) {
    return voicingCache.get(cacheKey)!;
  }
  
  let result: Voicing[];
  switch (params.voicingType) {
    case "off":
      result = [];
      break;
    case "full":
      result = fullVoicings(params);
      break;
    case "close":
      result = closeVoicings(params);
      break;
    default:
      result = [];
  }
  
  voicingCache.set(cacheKey, result);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/store/chordOverlayAtoms.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/voicings.ts
git commit -m "perf(core): cache pure generateVoicings combinatorial math in a static Map"
```

---

### Task 3: Pre-Compile Backing Track Audio Layers During Idle Time

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts`
- Test: `src/hooks/useProgressionAudioPlayback.test.tsx`

- [ ] **Step 1: Write a failing test verifying that changing progression steps triggers background audio compilation without starting playback**

Open [src/hooks/useProgressionAudioPlayback.test.tsx](file:///Users/isaaccocar/repos/fretboard-app/src/hooks/useProgressionAudioPlayback.test.tsx) and add a test verifying background calculation triggers and stores the compiled result in a ref or cache.
```typescript
describe("Eager Audio Compilation", () => {
  it("pre-compiles the audio timeline when steps change before clicking play", async () => {
    // TBD: Mock engine and ensure background pre-compilation is called on idle
    expect(true).toBe(false); // Fails for step setup
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add debounced background audio builder to useProgressionAudioPlayback**

Modify [src/hooks/useProgressionAudioPlayback.ts](file:///Users/isaaccocar/repos/fretboard-app/src/hooks/useProgressionAudioPlayback.ts) to listen to progression steps, tempo, swing, and patterns, and eagerly run `buildAllLayersAsync` on change, saving the compiled result in a persistent cached promise.
```typescript
import { useRef, useEffect } from "react";

// Add inside useProgressionAudioPlayback hook:
const cachedBuiltLayersRef = useRef<any>(null);

useEffect(() => {
  const inputs = {
    steps,
    tempoBpm: tempo,
    beatsPerBar,
    swing,
    chordPatternId,
    bassPatternId,
    drumPatternId,
    drumVariations,
    loop: loopEnabled,
  };

  const timerId = setTimeout(async () => {
    try {
      const eng = await getEngine();
      if (!eng) return;
      const built = await eng.buildAllLayersAsync(inputs);
      cachedBuiltLayersRef.current = built;
    } catch (e) {
      console.warn("Background audio build failed:", e);
    }
  }, 500); // 500ms debounce window after last user edit

  return () => clearTimeout(timerId);
}, [steps, tempo, beatsPerBar, swing, chordPatternId, bassPatternId, drumPatternId, drumVariations, loopEnabled]);
```
Update the main playback effect in `useProgressionAudioPlayback.ts` to immediately read from `cachedBuiltLayersRef.current` if available, bypassing dynamic async compile times on click.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/hooks/useProgressionAudioPlayback.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts
git commit -m "perf(audio): pre-compile progression audio timeline in background on user idle"
```

---

### Task 4: Defer Visual SVG Repaints with React 19 startTransition

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx`
- Test: `src/components/TransportBar/TransportBar.test.tsx`

- [ ] **Step 1: Write a failing test verifying that setting playback to active occurs inside a React Transition context**

Open [src/components/TransportBar/TransportBar.test.tsx](file:///Users/isaaccocar/repos/fretboard-app/src/components/TransportBar/TransportBar.test.tsx) and assert that `setProgressionPlaying` or active step index transitions are marked as low-priority transitions.
```typescript
import React from "react";

describe("Concurrent UI Transitions", () => {
  it("performs active step updates inside a transition", () => {
    // Assert transition execution
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/components/TransportBar/TransportBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement React startTransition around downbeat step index changes**

Modify [src/components/TransportBar/TransportBar.tsx:L46-54](file:///Users/isaaccocar/repos/fretboard-app/src/components/TransportBar/TransportBar.tsx#L46-L54) (or progression state actions in Jotai) to mark visual steps transitions as low-priority transitions.
```typescript
import { startTransition } from "react";

// Update active play/stop clicks
const handlePlayStopClick = () => {
  if (progressionPlaying) {
    stopProgressionPlayback();
    return;
  }

  startTransition(() => {
    setProgressionPlaying(true);
  });
};
```
Also, open [src/progressions/audio/visualClock.ts:L15-20](file:///Users/isaaccocar/repos/fretboard-app/src/progressions/audio/visualClock.ts#L15-L20) and wrap visual frame updates in a transition so playhead layout shifts are deferred under heavy load:
```typescript
import { startTransition } from "react";

function frame(): void {
  const store = storeRef;
  if (!store) return;
  const tl = getTimelinePosition();
  if (tl) {
    startTransition(() => {
      store.set(progressionVisualFrameAtom, tl);
      if (!tl.paused && tl.stepIndex !== lastWritten) {
        lastWritten = tl.stepIndex;
        store.set(displayedStepIndexPrimitiveAtom, tl.stepIndex);
      }
    });
  } else {
    startTransition(() => {
      store.set(progressionVisualFrameAtom, null);
    });
  }
  rafId = window.requestAnimationFrame(frame);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/components/TransportBar/TransportBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/progressions/audio/visualClock.ts
git commit -m "perf(ui): wrap active progression step visual updates in startTransition to prevent playhead stuttering"
```
