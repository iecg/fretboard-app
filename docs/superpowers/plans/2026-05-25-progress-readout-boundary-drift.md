# Progress Readout Boundary Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining playback-boundary glitch in the header position readout so it never flashes an impossible end-of-step value before the next step's downbeat.

**Architecture:** The remaining drift comes from the readout still deriving its live position from `stepStartBar + localFraction * stepBars`, which is brittle when step metadata and timeline fractions cross a boundary on different frames. Rework the header readout to follow the same source of truth as the playhead — `getTimelinePosition().globalFraction` — while keeping the existing imperative DOM-write pattern and the stopped-state "bar 1" behavior.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Jotai, pnpm

---

## File Map

- **Modify:** `src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx`
  - Replace step-local live math with global-fraction live math.
  - Simplify props so the component no longer depends on step index / step bars during playback.
- **Modify:** `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx`
  - Stop passing step-local playback metadata into the readout.
  - Keep stopped-state readout anchored at bar `1`.
- **Modify:** `src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx`
  - Add the direct failing reproduction for "displayed step has advanced but localFraction is still terminal".
- **Modify:** `src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx`
  - Add an integration regression proving the header renders `2.1.1`, never `2.4.4`, at the boundary.

## Working Theory To Validate

- `ProgressionPlayhead.tsx` is stable because it reads `getTimelinePosition().globalFraction` directly.
- `ProgressionPositionReadout.tsx` is still vulnerable because it combines parent-provided step metadata with `tl.localFraction`.
- If `tl.stepIndex` has already advanced but `tl.localFraction` is still near `1`, the current formula can still synthesize a bogus terminal position for the new step.
- The fix is to remove that mixed-state calculation entirely and compute the live readout from one continuous clock value: `globalFraction`.

### Task 1: Add failing boundary regressions first

**Files:**
- Modify: `src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx`
- Modify: `src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx`

- [ ] **Step 1: Write the failing unit regression in `ProgressionPositionReadout.test.tsx`**

```tsx
import * as timeline from "../../progressions/audio/timeline";

it("does not flash the new step's terminal sixteenth when localFraction is stale at the boundary", () => {
  vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
    stepIndex: 1,
    globalFraction: 0.5,
    localFraction: 0.9999,
    paused: false,
  });

  render(
    <ProgressionPositionReadout
      playing={true}
      stoppedBar={1}
      totalProgressionBars={2}
      beatsPerBar={4}
      tempoBpm={120}
    />
  );

  expect(screen.getByRole("status", { name: "Position 2.1.1 of 2.0.0" })).toBeTruthy();
  expect(screen.queryByRole("status", { name: "Position 2.4.4 of 2.0.0" })).toBeNull();
});
```

- [ ] **Step 2: Run the unit test to verify it fails for the right reason**

Run:

```bash
pnpm exec vitest run src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx
```

Expected: FAIL because the current implementation still formats from `stepStartBar + localFraction * stepBars`, so the mocked boundary frame renders `2.4.4`.

- [ ] **Step 3: Write the failing integration regression in `HeaderTransportCluster.test.tsx`**

```tsx
import * as timeline from "../../progressions/audio/timeline";

it("follows the continuous timeline position at a playback boundary", () => {
  vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
    stepIndex: 1,
    globalFraction: 0.5,
    localFraction: 0.9999,
    paused: false,
  });

  const store = makeAtomStore([
    [progressionStepsAtom, fourStepProgression],
    [progressionTempoBpmAtom, 120],
    [beatsPerBarAtom, 4],
    [activeProgressionStepIndexAtom, 0],
    [displayedStepIndexPrimitiveAtom, 1],
  ]);
  store.set(setProgressionPlayingAtom, true);

  renderWithStore(
    <TooltipProvider delayDuration={0}>
      <HeaderTransportCluster />
    </TooltipProvider>,
    store,
  );

  expect(screen.getByRole("status", { name: "Position 2.1.1 of 2.0.0" })).toBeTruthy();
  expect(screen.queryByRole("status", { name: "Position 2.4.4 of 2.0.0" })).toBeNull();
});
```

- [ ] **Step 4: Run the integration test to verify it also fails before the fix**

Run:

```bash
pnpm exec vitest run src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx
```

Expected: FAIL because `HeaderTransportCluster` still passes step-local metadata into the readout, letting the readout combine a new step start with a stale terminal `localFraction`.

- [ ] **Step 5: Commit the RED state only if your workflow requires checkpoint commits**

```bash
git add src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx
git commit -m "test(progression): capture readout boundary drift"
```

### Task 2: Refactor the readout to use continuous global position

**Files:**
- Modify: `src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx`
- Modify: `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx`

- [ ] **Step 1: Simplify the readout props to the data it really needs**

Replace the props contract with:

```tsx
interface ProgressionPositionReadoutProps {
  playing: boolean;
  stoppedBar: number;
  totalProgressionBars: number;
  beatsPerBar: number;
  tempoBpm: number;
}
```

Update the prop ref accordingly:

```tsx
const propsRef = useRef({ stoppedBar, totalProgressionBars, beatsPerBar });
useEffect(() => {
  propsRef.current = { stoppedBar, totalProgressionBars, beatsPerBar };
}, [stoppedBar, totalProgressionBars, beatsPerBar]);
```

- [ ] **Step 2: Implement the minimal live-position rewrite in `ProgressionPositionReadout.tsx`**

Replace the current `tick()` calculation with:

```tsx
const tick = () => {
  const tl = getTimelinePosition();
  const {
    stoppedBar: currentStoppedBar,
    totalProgressionBars: currentTotalBars,
  } = propsRef.current;

  const live = playing && tl && !tl.paused;
  const clampedGlobalFraction = live
    ? Math.max(0, Math.min(1 - Number.EPSILON, tl.globalFraction))
    : 0;

  const positionBar = live
    ? 1 + clampedGlobalFraction * currentTotalBars
    : currentStoppedBar;

  write(positionBar);
};
```

Also update the initial render to use `stoppedBar`:

```tsx
const initialPosition = formatProgressionPlaybackPosition(
  stoppedBar,
  totalProgressionBars,
  beatsPerBar,
);
```

- [ ] **Step 3: Remove the no-longer-needed step-local wiring in `HeaderTransportCluster.tsx`**

Trim the readout call site to:

```tsx
<ProgressionPositionReadout
  playing={progressionPlaying && canPlay}
  stoppedBar={1}
  totalProgressionBars={totalProgressionBars}
  beatsPerBar={beatsPerBar}
  tempoBpm={progressionTempoBpm}
/>
```

Delete the readout-only calculations that are no longer needed:

```tsx
const transportStepIndex = progressionPlaying && canPlay
  ? displayedProgressionStepIndex
  : activeProgressionStepIndex;
const transportStep = resolvedProgressionSteps[transportStepIndex] ?? null;
const activeStepBars = transportStep ? durationToBars(transportStep.duration, beatsPerBar) : 0;
const displayedProgressionBar = 1 + resolvedProgressionSteps
  .slice(0, transportStepIndex)
  .reduce((sum, step) => sum + durationToBars(step.duration, beatsPerBar), 0);
const transportStartBar = progressionPlaying && canPlay ? displayedProgressionBar : 1;
```

After the refactor, remove any now-unused imports / destructured values.

- [ ] **Step 4: Run the focused regressions and verify both now pass**

Run:

```bash
pnpm exec vitest run src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx
```

Expected: PASS, with the boundary frame resolving to `2.1.1`, not `2.4.4`.

- [ ] **Step 5: Commit the minimal fix**

```bash
git add src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.tsx src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx
git commit -m "fix(progression): align readout with timeline clock"
```

### Task 3: Full verification and regression sweep

**Files:**
- Test: `src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx`
- Test: `src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx`
- Test: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`
- Test: `src/components/ProgressionTrack/ProgressionPlayhead.tsx` (reference only; no code change expected)

- [ ] **Step 1: Run the focused playback/readout suite**

Run:

```bash
pnpm exec vitest run src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx src/components/ProgressionTrack/ProgressionTrack.test.tsx
```

Expected: PASS. This confirms the header readout fix did not regress the stopped-playhead behavior or prior header-readout cases.

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm run lint
```

Expected: PASS with no ESLint or Stylelint errors.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm run build
```

Expected: PASS with a successful Vite production build.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
pnpm run test
```

Expected: PASS. If it fails, stop and separate playback/readout regressions from unrelated baseline failures before claiming completion.

- [ ] **Step 5: Commit the verified final state**

```bash
git add src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.tsx src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx
git commit -m "fix(progression): remove readout boundary drift"
```

## Self-Review

- **Spec coverage:** The plan covers (1) a direct reproduction of the still-visible boundary glitch, (2) the implementation change that removes mixed local-step/global-time math, and (3) focused plus repo-wide verification.
- **Placeholder scan:** No `TODO`, `TBD`, or "test the above" placeholders remain; every task includes explicit files, commands, and code snippets.
- **Type consistency:** The refactor consistently renames the readout fallback prop to `stoppedBar` and removes `stepStartBar`, `stepBars`, and `stepIndex` from the live readout contract.
