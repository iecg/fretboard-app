# Fretboard Transition Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make progression-playback fretboard transitions feel seamless by moving the fretboard onto a single playback-synced visual snapshot, reducing Jotai fan-out, and splitting note/voicing work into stable topology plus cheap frame-local updates.

**Architecture:** Extend the existing RAF-driven visual clock so it publishes a full playback frame, then build a fretboard-specific playback snapshot hook on top of that frame. Thread the snapshot through `Fretboard`/`FretboardSVG`, extract stable fretboard topology from `useNoteData`, and keep playback-time work constrained to a small animated view layer instead of recomputing the whole visible note model every transition.

**Tech Stack:** React 19, TypeScript, Jotai, Vitest, Testing Library, Framer Motion, pnpm.

---

## Scope check

This plan stays inside one subsystem: the fretboard playback/render pipeline. It touches the visual clock, a small slice of store-facing orchestration, and the `Fretboard` / `FretboardSVG` hook stack, but it does not branch into unrelated transport, layout, or audio-engine work.

## File map

**Create**

- `src/store/progressionVisualAtoms.ts` — lightweight primitive atom for the current playback frame mirrored from the audio timeline.
- `src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.ts` — single render-oriented read model for fretboard playback visuals.
- `src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.test.ts` — snapshot hook regressions.
- `src/components/FretboardSVG/hooks/useStaticFretboardTopology.ts` — geometry-independent note/chord/shape topology.
- `src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts` — topology stability regressions.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` — playback-frame styling plus pixel-ready note layout derived from stable topology.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` — playback-only rerender regressions.

**Modify**

- `src/progressions/audio/visualClock.ts` — publish the full timeline frame (`stepIndex`, `globalFraction`, `localFraction`, `paused`) on every RAF tick instead of only writing the displayed step index.
- `src/progressions/audio/visualClock.test.ts` — prove the visual clock publishes the full frame and clears it on stop.
- `src/components/Fretboard/Fretboard.tsx` — call `useFretboardPlaybackSnapshot()` once and thread the result into `FretboardSVG`.
- `src/components/FretboardSVG/FretboardSVG.tsx` — stop reading playback-sensitive lens atoms directly; consume the new snapshot and new topology/view hooks.
- `src/components/FretboardSVG/FretboardSVG.test.tsx` — cover snapshot-driven lead-lens rendering and playback-only updates.
- `src/components/FretboardSVG/FretboardNoteLayer.tsx` — consume pre-shaped rendered notes instead of recomputing geometry from raw note data on every render.
- `src/components/Fretboard/Fretboard.wiring.test.tsx` — keep the higher-level wiring surface green after snapshot threading.
- `src/components/FretboardSVG/hooks/useNoteData.ts` — keep the shared `NoteData` type available during the migration, then remove or reduce the old hook once the new hooks fully replace it.

**Do not change**

- `src/progressions/audio/timeline.ts` audio-clock math
- connector radius/path helpers under `src/components/FretboardSVG/utils/`
- playback transport/readout behavior already fixed in this branch

## Reused patterns

- `renderHook` + `rerender` from `@testing-library/react`
- `createStore` / `Provider` for Jotai integration tests
- existing display-synced playback state via `displayedStepIndexPrimitiveAtom`
- recent topology/geometry split pattern from `useChordConnectorPolylines.ts`

## Tasks

### Task 1: Publish a full playback frame from the visual clock

**Files:**
- Create: `src/store/progressionVisualAtoms.ts`
- Modify: `src/progressions/audio/visualClock.ts`
- Test: `src/progressions/audio/visualClock.test.ts`

- [ ] **Step 1: Write the failing test**

Append this regression to `src/progressions/audio/visualClock.test.ts`:

```ts
import { progressionVisualFrameAtom } from "../../store/progressionVisualAtoms";

it("publishes the full timeline frame on each RAF tick", () => {
  vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
    stepIndex: 2,
    globalFraction: 0.625,
    localFraction: 0.5,
    paused: false,
  });

  startVisualClock(store);
  expect(rafCallback).toBeTypeOf("function");
  rafCallback!(16);

  expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(2);
  expect(store.get(progressionVisualFrameAtom)).toEqual({
    stepIndex: 2,
    globalFraction: 0.625,
    localFraction: 0.5,
    paused: false,
  });
});

it("clears the mirrored playback frame when the visual clock stops", () => {
  vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
    stepIndex: 1,
    globalFraction: 0.25,
    localFraction: 0.25,
    paused: false,
  });

  startVisualClock(store);
  rafCallback!(16);
  stopVisualClock();

  expect(store.get(progressionVisualFrameAtom)).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run src/progressions/audio/visualClock.test.ts -t "publishes the full timeline frame"
```

Expected: FAIL because `progressionVisualFrameAtom` does not exist yet and the visual clock only writes `displayedStepIndexPrimitiveAtom`.

- [ ] **Step 3: Add the primitive atom and write to it from the clock**

Create `src/store/progressionVisualAtoms.ts`:

```ts
import { atom } from "jotai";

export interface ProgressionVisualFrame {
  stepIndex: number;
  globalFraction: number;
  localFraction: number;
  paused: boolean;
}

export const progressionVisualFrameAtom = atom<ProgressionVisualFrame | null>(null);
```

Update `src/progressions/audio/visualClock.ts`:

```ts
import { displayedStepIndexPrimitiveAtom } from "../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../store/progressionVisualAtoms";

function frame(): void {
  const store = storeRef;
  if (!store) return;
  const tl = getTimelinePosition();
  if (tl) {
    store.set(progressionVisualFrameAtom, tl);
    if (!tl.paused && tl.stepIndex !== lastWritten) {
      lastWritten = tl.stepIndex;
      store.set(displayedStepIndexPrimitiveAtom, tl.stepIndex);
    }
  }
  rafId = window.requestAnimationFrame(frame);
}

export function stopVisualClock(): void {
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  storeRef?.set(progressionVisualFrameAtom, null);
  storeRef = null;
  lastWritten = Number.NaN;
}
```

- [ ] **Step 4: Run the focused visual-clock tests**

Run:

```bash
pnpm exec vitest run src/progressions/audio/visualClock.test.ts
```

Expected: PASS. Existing step-index tests still pass, and the new assertions prove the clock now mirrors the full playback frame.

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionVisualAtoms.ts src/progressions/audio/visualClock.ts src/progressions/audio/visualClock.test.ts
git commit -m "refactor(playback): publish visual frame state"
```

---

### Task 2: Build a single fretboard playback snapshot hook

**Files:**
- Create: `src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.ts`
- Test: `src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.test.ts`

- [ ] **Step 1: Write the failing hook test**

Create `src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Provider, createStore } from "jotai";
import { renderHook } from "@testing-library/react";
import { progressionPlayingAtom, progressionStepsAtom, beatsPerBarAtom } from "../../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";
import { useFretboardPlaybackSnapshot } from "./useFretboardPlaybackSnapshot";

describe("useFretboardPlaybackSnapshot", () => {
  it("derives beat position and next-step emphasis data from the mirrored playback frame", () => {
    const store = createStore();
    store.set(progressionPlayingAtom, true);
    store.set(beatsPerBarAtom, 4);
    store.set(progressionStepsAtom, [
      { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(progressionVisualFrameAtom, {
      stepIndex: 0,
      globalFraction: 0.125,
      localFraction: 0.75,
      paused: false,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useFretboardPlaybackSnapshot("lead"), { wrapper });

    expect(result.current).toMatchObject({
      playing: true,
      activeStepIndex: 0,
      globalFraction: 0.125,
      localFraction: 0.75,
      stepDurationBeats: 4,
      beatPosition: 3,
    });
    expect(result.current.commonWithNext).toBeInstanceOf(Set);
    expect(result.current.nextGuideTones).toBeInstanceOf(Set);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.test.ts
```

Expected: FAIL because the hook does not exist yet.

- [ ] **Step 3: Implement the snapshot hook**

Create `src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.ts`:

```ts
import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { progressionPlayingAtom, activeStepDurationBeatsAtom } from "../../../store/progressionAtoms";
import { commonTonesWithNextAtom, nextChordGuideTonesAtom } from "../../../store/practiceLensAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";
import type { PracticeLens } from "@fretflow/core";

const EMPTY_SET = new Set<string>();

export interface FretboardPlaybackSnapshot {
  playing: boolean;
  activeStepIndex: number;
  globalFraction: number;
  localFraction: number;
  stepDurationBeats: number;
  beatPosition: number;
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
}

export function useFretboardPlaybackSnapshot(
  practiceLens?: PracticeLens,
): FretboardPlaybackSnapshot | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const frame = useAtomValue(progressionVisualFrameAtom);
  const stepDurationBeats = useAtomValue(activeStepDurationBeatsAtom);
  const commonWithNext = useAtomValue(commonTonesWithNextAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);

  return useMemo(() => {
    if (!playing || !frame) return null;
    return {
      playing,
      activeStepIndex: frame.stepIndex,
      globalFraction: frame.globalFraction,
      localFraction: frame.localFraction,
      stepDurationBeats,
      beatPosition: frame.localFraction * stepDurationBeats,
      commonWithNext: practiceLens === "lead" ? commonWithNext : EMPTY_SET,
      nextGuideTones: practiceLens === "lead" ? nextGuideTones : EMPTY_SET,
    };
  }, [playing, frame, stepDurationBeats, practiceLens, commonWithNext, nextGuideTones]);
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.test.ts src/store/practiceLens.test.ts
```

Expected: PASS. The new hook passes, and existing practice-lens contracts still hold.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.ts src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.test.ts
git commit -m "refactor(fretboard): add playback snapshot hook"
```

---

### Task 3: Thread the playback snapshot through `Fretboard` and `FretboardSVG`

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write the failing component regression**

Append this regression to `src/components/FretboardSVG/FretboardSVG.test.tsx`:

```tsx
it("renders lead-lens playback state from the snapshot prop instead of direct playback atom reads", () => {
  const { container } = renderCMajor({
    practiceLens: "lead",
    playbackSnapshot: {
      playing: true,
      activeStepIndex: 0,
      globalFraction: 0.25,
      localFraction: 0.75,
      stepDurationBeats: 4,
      beatPosition: 3,
      commonWithNext: new Set(["G"]),
      nextGuideTones: new Set(["B", "F"]),
    },
  });

  expect(container.querySelectorAll('[data-note-guide-tone="true"]').length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "renders lead-lens playback state from the snapshot prop"
```

Expected: FAIL because `playbackSnapshot` is not a valid prop yet.

- [ ] **Step 3: Implement the prop threading**

Update `src/components/Fretboard/Fretboard.tsx`:

```tsx
import { useFretboardPlaybackSnapshot } from "../FretboardSVG/hooks/useFretboardPlaybackSnapshot";

export function Fretboard(props: FretboardProps) {
  const state = useFretboardState();
  const playbackSnapshot = useFretboardPlaybackSnapshot(state.practiceLens);

  // ...

  return (
    <Suspense fallback={<FretboardSkeleton stringRowPx={stringRowPx} />}>
      <LazyFretboardSVG
        // existing props...
        practiceLens={state.practiceLens}
        playbackSnapshot={playbackSnapshot}
      />
    </Suspense>
  );
}
```

Update `src/components/FretboardSVG/FretboardSVG.tsx`:

```tsx
import type { FretboardPlaybackSnapshot } from "./hooks/useFretboardPlaybackSnapshot";

interface FretboardSVGProps {
  // existing props...
  playbackSnapshot?: FretboardPlaybackSnapshot | null;
}

export function FretboardSVG({
  // existing props...
  playbackSnapshot = null,
}: FretboardSVGProps) {
  const leadLensData =
    practiceLens === "lead" && playbackSnapshot
      ? {
          commonWithNext: playbackSnapshot.commonWithNext,
          nextGuideTones: playbackSnapshot.nextGuideTones,
          beatPosition: playbackSnapshot.beatPosition,
          stepDurationBeats: playbackSnapshot.stepDurationBeats,
        }
      : undefined;

  const noteData = useNoteData({
    // existing props...
    leadLensData,
  });
}
```

Also delete the direct playback-sensitive atom reads from `FretboardSVG.tsx`:

```tsx
- import {
-   commonTonesWithNextAtom,
-   nextChordGuideTonesAtom,
-   beatPositionAtom,
-   activeStepDurationBeatsAtom,
- } from "../../store/practiceLensAtoms";

- const leadCommonWithNext = useAtomValue(commonTonesWithNextAtom);
- const leadNextGuideTones = useAtomValue(nextChordGuideTonesAtom);
- const leadBeatPosition = useAtomValue(beatPositionAtom);
- const leadStepDurationBeats = useAtomValue(activeStepDurationBeatsAtom);
```

- [ ] **Step 4: Run the focused component tests**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx src/components/Fretboard/Fretboard.wiring.test.tsx
```

Expected: PASS. The new regression proves `FretboardSVG` can render from a snapshot prop, and the wiring tests still pass with the prop threaded from `Fretboard`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "refactor(fretboard-svg): route playback through snapshot"
```

---

### Task 4: Split note derivation into static topology and animated view

**Files:**
- Create: `src/components/FretboardSVG/hooks/useStaticFretboardTopology.ts`
- Create: `src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts`
- Create: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Create: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Modify: `src/components/FretboardSVG/FretboardNoteLayer.tsx`
- Modify: `src/components/FretboardSVG/hooks/useNoteData.ts`

- [ ] **Step 1: Write the failing topology/view split tests**

Create `src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { getFretboardNotes } from "@fretflow/core";
import { useStaticFretboardTopology } from "./useStaticFretboardTopology";

const tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];
const fretboardLayout = getFretboardNotes(tuning, 24);

describe("useStaticFretboardTopology", () => {
  it("keeps topology reference stable across playback-only rerenders", () => {
    const { result, rerender } = renderHook((props: { colorNotes: string[] }) =>
      useStaticFretboardTopology({
        numStrings: 6,
        fretboardLayout,
        totalColumns: 12,
        startFret: 0,
        maxFret: 24,
        hiddenNotes: undefined,
        highlightNotes: ["C", "E", "G"],
        hasChordOverlay: true,
        chordTones: ["C", "E", "G"],
        rootNote: "C",
        chordRoot: "C",
        colorNotes: props.colorNotes,
        shapePolygons: [],
        chordFretSpread: 0,
        activePattern: "none",
        shapeScope: "global",
        activeShape: undefined,
        tuning,
        fullChordPositionKeys: undefined,
        fullChordShapeByPosition: undefined,
        chordBoxBounds: null,
      }),
    , {
      initialProps: { colorNotes: [] },
    });

    const first = result.current;
    rerender({ colorNotes: [] });
    expect(result.current).toBe(first);
  });
});
```

Create `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAnimatedFretboardView } from "./useAnimatedFretboardView";
import { useStaticFretboardTopology } from "./useStaticFretboardTopology";

describe("useAnimatedFretboardView", () => {
  it("recomputes animated note output when only the playback snapshot changes", () => {
    const { result, rerender } = renderHook(
      ({ beatPosition }) =>
        {
          const topology = useStaticFretboardTopology({
            numStrings: 1,
            fretboardLayout: [["C", "D", "E", "F"]],
            totalColumns: 3,
            startFret: 0,
            maxFret: 4,
            hiddenNotes: undefined,
            highlightNotes: ["C", "E", "G"],
            hasChordOverlay: true,
            chordTones: ["C", "E", "G"],
            rootNote: "C",
            chordRoot: "C",
            colorNotes: [],
            shapePolygons: [],
            chordFretSpread: 0,
            activePattern: "none",
            shapeScope: "global",
            activeShape: undefined,
            tuning: ["E4"],
            fullChordPositionKeys: undefined,
            fullChordShapeByPosition: undefined,
            chordBoxBounds: null,
          });

          return {
            topology,
            view: useAnimatedFretboardView({
              topology,
              playbackSnapshot: {
                playing: true,
                activeStepIndex: 0,
                globalFraction: 0.1,
                localFraction: beatPosition / 4,
                stepDurationBeats: 4,
                beatPosition,
                commonWithNext: new Set(["G"]),
                nextGuideTones: new Set(["B", "F"]),
              },
              practiceLens: "lead",
              displayFormat: "notes",
              degreeColorsEnabled: false,
              preferFlats: false,
              scaleName: "Major",
              rootNote: "C",
            }),
          };
        },
      { initialProps: { beatPosition: 1 } },
    );

    const firstTopology = result.current.topology;
    const first = result.current.view.renderedNotes;
    rerender({ beatPosition: 3 });
    expect(result.current.topology).toBe(firstTopology);
    expect(result.current.view.renderedNotes).not.toBe(first);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts
```

Expected: FAIL because neither hook exists yet.

- [ ] **Step 3: Extract stable topology and animated view hooks**

Create `src/components/FretboardSVG/hooks/useStaticFretboardTopology.ts`:

```ts
import { useMemo } from "react";
import { getFretNoteWithOctave } from "@fretflow/core";
import type { BoxBound } from "../utils/semantics";
import type { ActiveShapeType } from "../../../hooks/useFretboardState";
import type { ShapePolygon, CagedShape } from "@fretflow/core";

export interface StaticFretboardNote {
  positionKey: string;
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  octave: number;
  fullChordShape?: CagedShape;
  isMatchedFullChordPosition: boolean;
  isInsideAnyPolygon: boolean;
}

interface UseStaticFretboardTopologyInput {
  numStrings: number;
  fretboardLayout: string[][];
  totalColumns: number;
  startFret: number;
  maxFret: number;
  hiddenNotes?: Set<string>;
  highlightNotes: string[];
  hasChordOverlay: boolean;
  chordTones: string[];
  rootNote: string;
  chordRoot?: string;
  colorNotes: string[];
  shapePolygons: ShapePolygon[];
  chordFretSpread: number;
  activePattern?: "caged" | "3nps" | "none";
  shapeScope?: "single" | "multi" | "global";
  activeShape?: ActiveShapeType;
  tuning: string[];
  fullChordPositionKeys?: Set<string>;
  fullChordShapeByPosition?: Map<string, CagedShape>;
  chordBoxBounds: BoxBound[] | null;
}

export function buildStaticFretboardTopology(input: UseStaticFretboardTopologyInput) {
  const {
    numStrings,
    fretboardLayout,
    totalColumns,
    startFret,
    maxFret,
    shapePolygons,
    tuning,
    fullChordPositionKeys,
    fullChordShapeByPosition,
  } = input;

  const notes: StaticFretboardNote[] = [];
  for (let stringIndex = 0; stringIndex < numStrings; stringIndex++) {
    const layoutRow = fretboardLayout[stringIndex]!;
    for (let idx = 0; idx <= totalColumns; idx++) {
      const fretIndex = startFret + idx;
      if (fretIndex >= maxFret) continue;
      const positionKey = `${stringIndex}-${fretIndex}`;
      const { octave } = getFretNoteWithOctave(tuning[stringIndex]!, fretIndex);
      notes.push({
        positionKey,
        stringIndex,
        fretIndex,
        noteName: layoutRow[fretIndex]!,
        octave,
        fullChordShape: fullChordShapeByPosition?.get(positionKey),
        isMatchedFullChordPosition: fullChordPositionKeys?.has(positionKey) ?? false,
        isInsideAnyPolygon: shapePolygons.some((poly) => {
          if (poly.truncated) return false;
          const leftFret = poly.vertices[stringIndex]?.fret;
          const rightFret = poly.vertices[poly.vertices.length - 1 - stringIndex]?.fret;
          return leftFret !== undefined && rightFret !== undefined && fretIndex >= leftFret && fretIndex <= rightFret;
        }),
      });
    }
  }

  return { notes };
}

export function useStaticFretboardTopology(input: UseStaticFretboardTopologyInput) {
  return useMemo(() => buildStaticFretboardTopology(input), [
    numStrings,
    fretboardLayout,
    totalColumns,
    startFret,
    maxFret,
    shapePolygons,
    tuning,
    fullChordPositionKeys,
    fullChordShapeByPosition,
  ]);
}
```

Create `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`:

```ts
import { useMemo } from "react";
import type { PracticeLens } from "@fretflow/core";
import type { FretboardPlaybackSnapshot } from "./useFretboardPlaybackSnapshot";
import type { NoteData } from "./useNoteData";
import type { StaticFretboardNote } from "./useStaticFretboardTopology";

export interface RenderedFretboardNote extends NoteData {
  cx: number;
  cy: number;
}

export function useAnimatedFretboardView(input: {
  topology: { notes: StaticFretboardNote[] };
  playbackSnapshot: FretboardPlaybackSnapshot | null | undefined;
  practiceLens?: PracticeLens;
  displayFormat: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  preferFlats: boolean;
  scaleName: string;
  rootNote: string;
  fretCenterX?: (fretIndex: number) => number;
  stringYAt?: (stringIndex: number, x: number) => number;
}) {
  const {
    topology,
    fretCenterX,
    stringYAt,
  } = input;

  return useMemo(() => {
    const renderedNotes: RenderedFretboardNote[] = topology.notes.map((note) => {
      const cx = fretCenterX ? fretCenterX(note.fretIndex) : note.fretIndex;
      const cy = stringYAt ? stringYAt(note.stringIndex, cx) : note.stringIndex;
      return {
        stringIndex: note.stringIndex,
        fretIndex: note.fretIndex,
        noteName: note.noteName,
        octave: note.octave,
        noteClass: "note-inactive",
        displayValue: note.noteName,
        applyDimOpacity: false,
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, glowColor: null },
        isHidden: false,
        isTension: false,
        isGuideTone: false,
        fullChordShape: note.fullChordShape,
        cx,
        cy,
      };
    });
    return { renderedNotes };
  }, [topology, fretCenterX, stringYAt]);
}
```

Then update `src/components/FretboardSVG/FretboardSVG.tsx` to replace the old `useNoteData` call:

```tsx
const topology = useStaticFretboardTopology({
  numStrings,
  fretboardLayout,
  totalColumns,
  startFret,
  maxFret,
  hiddenNotes,
  highlightNotes,
  hasChordOverlay,
  chordTones,
  rootNote,
  chordRoot,
  colorNotes,
  shapePolygons,
  chordFretSpread,
  activePattern,
  shapeScope,
  activeShape,
  tuning,
  fullChordPositionKeys,
  fullChordShapeByPosition,
  chordBoxBounds,
});

const { renderedNotes } = useAnimatedFretboardView({
  topology,
  playbackSnapshot,
  practiceLens,
  displayFormat,
  degreeColorsEnabled,
  preferFlats,
  scaleName: scaleName || "",
  rootNote,
  fretCenterX,
  stringYAt,
});
```

Update `src/components/FretboardSVG/FretboardNoteLayer.tsx`:

```tsx
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";

interface FretboardNoteLayerProps {
  notes: RenderedFretboardNote[];
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
  filter?: "chord" | "non-chord";
  animationMode?: NoteAnimationMode;
}

const filteredNotes = filter
  ? notes.filter(({ noteClass }) => {
      const isChord = CHORD_NOTE_CLASSES.has(noteClass);
      return filter === "chord" ? isChord : !isChord;
    })
  : notes;

const cx = note.cx;
const cy = note.cy;
```

Keep `src/components/FretboardSVG/hooks/useNoteData.ts` around only for shared types during the migration:

```ts
export interface NoteData {
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  octave: number;
  noteClass: string;
  displayValue: string;
  applyDimOpacity: boolean;
  applyLensEmphasis: LensEmphasis;
  isHidden: boolean;
  isTension: boolean;
  isGuideTone: boolean;
  scaleDegree?: string;
  degreeColor?: string;
  fullChordShape?: CagedShape;
}
```

- [ ] **Step 4: Run the hook and fretboard SVG tests**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts src/components/FretboardSVG/FretboardSVG.test.tsx
```

Expected: PASS. The split hooks work, and existing SVG behavior still renders correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/hooks/useStaticFretboardTopology.ts src/components/FretboardSVG/hooks/useStaticFretboardTopology.test.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardNoteLayer.tsx src/components/FretboardSVG/hooks/useNoteData.ts
git commit -m "perf(fretboard): split topology from animated view"
```

---

### Task 5: Lock the playback-only render path and run full verification

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write the failing playback-only integration guard**

Append this regression to `src/components/FretboardSVG/FretboardSVG.test.tsx`:

```tsx
import * as staticTopologyHooks from "./hooks/useStaticFretboardTopology";

it("does not rebuild static fretboard topology when only the playback snapshot changes", () => {
  const topologySpy = vi.spyOn(staticTopologyHooks, "buildStaticFretboardTopology");
  const firstSnapshot = {
    playing: true,
    activeStepIndex: 0,
    globalFraction: 0.125,
    localFraction: 0.25,
    stepDurationBeats: 4,
    beatPosition: 1,
    commonWithNext: new Set(["G"]),
    nextGuideTones: new Set(["B", "F"]),
  };

  const { rerender } = renderCMajor({ practiceLens: "lead", playbackSnapshot: firstSnapshot });
  expect(topologySpy).toHaveBeenCalledTimes(1);

  rerender(
    <FretboardSVG
      {...BASE_PROPS}
      {...C_MAJOR}
      practiceLens="lead"
      playbackSnapshot={{
        ...firstSnapshot,
        globalFraction: 0.25,
        localFraction: 0.75,
        beatPosition: 3,
      }}
    />,
  );

  expect(topologySpy).toHaveBeenCalledTimes(1);
  topologySpy.mockRestore();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "does not rebuild static fretboard topology"
```

Expected: FAIL because the new topology layer is not isolated yet, or playback-only rerenders still recreate its dependencies.

- [ ] **Step 3: Fix any remaining unstable dependencies**

Tighten the memo inputs in `src/components/Fretboard/Fretboard.tsx`, `src/components/FretboardSVG/FretboardSVG.tsx`, and the new hooks until playback-only updates stay on the animated path.

The target shape is:

```tsx
const topology = useStaticFretboardTopology({
  // only harmonic / viewport-topology inputs
});

const animatedView = useAnimatedFretboardView({
  topology,
  playbackSnapshot,
  // frame-local visual inputs only
});
```

Do not let `playbackSnapshot`, `beatPosition`, `globalFraction`, or `localFraction` leak into `useStaticFretboardTopology`.

- [ ] **Step 4: Run full project verification**

Run:

```bash
pnpm run lint
pnpm run test
pnpm run build
```

Expected:

- `pnpm run lint` exits 0
- `pnpm run test` exits 0
- `pnpm run build` exits 0

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.test.tsx src/components/Fretboard/Fretboard.tsx src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "test(fretboard): lock playback-only render path"
```

## Self-review

### Spec coverage

- **Playback-synced visual snapshot:** covered by Tasks 1-3.
- **Reduce Jotai fan-out:** covered by Tasks 2-3.
- **Split topology from frame-local view:** covered by Task 4.
- **Concrete profiling / validation loop:** covered by Task 5’s render-path guard plus full verification.

No spec sections are left without a concrete task.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to” placeholders remain.
- Every code-changing step includes explicit file paths and code blocks.
- Every validation step includes an exact command and an expected outcome.

### Type consistency

- `ProgressionVisualFrame` is defined once in `src/store/progressionVisualAtoms.ts` and reused by the snapshot hook.
- `FretboardPlaybackSnapshot` is defined once in `useFretboardPlaybackSnapshot.ts` and threaded into `FretboardSVG`.
- `useStaticFretboardTopology` owns topology-only data; `useAnimatedFretboardView` owns playback-time rendering output; Task 5 explicitly guards that dependency boundary.
