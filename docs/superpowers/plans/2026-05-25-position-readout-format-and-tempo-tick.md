# Progression Position Readout — Format + Tempo-Adaptive Tick

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-format the position readout to `bar.beat.sixteenth` (1-indexed, no padding) with totals as `bars.0.0`, and drive its refresh rate from the active tempo so every sixteenth-note tick is rendered exactly once at any BPM.

**Architecture:** Change the centralized `formatProgressionPlaybackPosition` formatter to emit sixteenth-note 1-indexed subdivisions (1–4) without zero-padding and switch total semantics from "last playable position" to "duration as bars.0.0". Add a `tempoBpm` prop to `ProgressionPositionReadout` and compute `TICK_MS = round(15000 / tempoBpm)` (= `60000 / BPM / 4 sixteenths-per-beat`). Restart the `setInterval` when tempo changes via effect deps.

**Tech Stack:** TypeScript, React 19 + React Compiler, vitest, jsdom (fake timers).

---

## Background

Current state (after commit `eaae3b8`):

- `formatProgressionPlaybackPosition` (`src/progressions/progressionDomain.ts:111-153`) returns `bar.beat.subdivision` where bar is zero-padded to width 2, subdivision is "thousandths past current beat" (0-999), zero-padded to width 3. Total = `${pad2(totalBars)}.${safeBeats}.000` (e.g. `04.4.000` for a 4-bar progression in 4/4).
- `ProgressionPositionReadout` (`src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx`) uses a fixed `TICK_MS = 33` (~30 Hz) — runs at the same rate regardless of tempo.

Target state:

- Start of bar 1 reads `1.1.1` (bar 1, beat 1, sixteenth 1) — no padding.
- Total of a 4-bar progression in 4/4 reads `4.0.0` — duration semantics: 4 bars, 0 beats over, 0 sixteenths over.
- Refresh rate is the time of one sixteenth note at the active tempo (`60_000 ms / BPM / 4`). At 60 BPM → 250 ms; 120 BPM → 125 ms; 240 BPM → 62.5 ms (rounded to 63).
- The `setInterval` restarts when tempo changes mid-playback.

Subdivisions per beat = 4 (sixteenth notes). This is fixed (not exposed as config).

---

## File map

**Modify**

- `src/progressions/progressionDomain.ts` — replace zero-padded thousandths with 1-indexed sixteenth-note subdivision; total uses `${totalBars}.0.0`.
- `src/progressions/progressionDomain.test.ts` (lines 304-333) — update the four `formatProgressionPlaybackPosition` test assertions to match the new format.
- `src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx` — add required `tempoBpm: number` prop; derive `tickMs = Math.round(15000 / tempoBpm)`; include `tempoBpm` in the playback `useEffect` deps so the interval restarts on tempo change.
- `src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx` — pass `tempoBpm` in both render calls; update aria-label assertions to the new format; advance fake timers by the BPM-derived interval.
- `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx:55-62` — pass `tempoBpm={progressionTempoBpm}` into the readout.

**Untouched**

- The `formatProgressionPlaybackPosition` interface (`FormattedPlaybackPosition`, `FormattedPlaybackPositionParts`) — the string semantics change but the shape stays the same. Consumers that just render `parts.bar`, `parts.beat`, `parts.subdivision` (the imperative DOM updates in the readout) keep working.
- `currentProgressionBar`, `stepStartBar`, `totalProgressionBars`, `beatsPerBar` props on the readout — unchanged. The 1-based bar input semantics are preserved end-to-end.
- The `digitSub` CSS rule — width stays sized for 1-3 chars (currently a 3-digit number, soon a 1-digit number; no layout reflow).

---

## Reused utilities

- Existing fake-timer + `ensureProgressionAudio()` test scaffolding in `ProgressionPositionReadout.test.tsx`.
- Existing `pad2` helper is deleted; no padding helper needed.

---

## Tasks

### Task 1: Re-format `formatProgressionPlaybackPosition`

**Files:**
- Modify: `src/progressions/progressionDomain.ts:88-153`
- Test: `src/progressions/progressionDomain.test.ts:304-333`

- [ ] **Step 1: Write the failing tests**

Replace the `describe("formatProgressionPlaybackPosition", ...)` block (lines 304-333) with:

```ts
describe("formatProgressionPlaybackPosition", () => {
  it("formats the bar/beat/sixteenth readout at the start of the progression", () => {
    expect(formatProgressionPlaybackPosition(1, 5, 4)).toMatchObject({
      current: "1.1.1",
      total: "5.0.0",
    });
  });

  it("derives beat and 1-indexed sixteenth from the fractional bar offset", () => {
    // 1.25 bars = beat 2 of bar 1, on the downbeat (first sixteenth).
    expect(formatProgressionPlaybackPosition(1.25, 4, 4).current).toBe("1.2.1");
    // 1.3 bars = beat 2 of bar 1, +0.2 beat = 0.8 sixteenths → sixteenth 1 (floor).
    expect(formatProgressionPlaybackPosition(1.3, 4, 4).current).toBe("1.2.1");
    // 1.3125 bars = beat 2 of bar 1, +0.25 beat = exactly the 2nd sixteenth.
    expect(formatProgressionPlaybackPosition(1.3125, 4, 4).current).toBe("1.2.2");
  });

  it("honors the active meter when deriving beat counts", () => {
    expect(formatProgressionPlaybackPosition(2.5, 4, 8)).toMatchObject({
      current: "2.5.1",
      total: "4.0.0",
    });
  });

  it("clamps fractional totals up and pins current at the final sixteenth", () => {
    // Past-end positions clamp to the last playable sixteenth (bar N, beat
    // beatsPerBar, sixteenth 4) so the readout shows the project end instead
    // of freezing earlier in the bar.
    expect(formatProgressionPlaybackPosition(99, 3.25, 4)).toMatchObject({
      current: "4.4.4",
      total: "4.0.0",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/progressions/progressionDomain.test.ts -t "formatProgressionPlaybackPosition"`
Expected: FAIL — current format still emits `01.1.000` / `05.4.000`.

- [ ] **Step 3: Implement the new format**

Replace the body of `formatProgressionPlaybackPosition` (lines 111-153) with:

```ts
export function formatProgressionPlaybackPosition(
  currentProgressionBar: number,
  totalProgressionBars: number,
  beatsPerBar: number,
): FormattedPlaybackPosition {
  const SIXTEENTHS_PER_BEAT = 4;
  const safeBeats = Math.max(1, Math.floor(beatsPerBar));
  const totalBars = Math.max(1, Math.ceil(totalProgressionBars));
  // Position can range over [1, totalBars + 1). bar 1.0 is the first beat of
  // bar 1, bar N + 1 - ε is the final sixteenth of the last bar. Clamping
  // to `totalBars` would freeze the readout at `N.1.1` for the entire
  // last bar instead of advancing through its beats.
  const maxBar = totalBars + 1 - 1e-9;
  const clampedBar = Math.max(1, Math.min(currentProgressionBar, maxBar));
  const bar = Math.floor(clampedBar);
  const positionInBar = Math.max(0, Math.min(1, clampedBar - bar));
  const beatPos = positionInBar * safeBeats;
  const beatIndex = Math.min(safeBeats - 1, Math.floor(beatPos));
  const beat = beatIndex + 1;
  // 1-indexed sixteenth-note subdivision within the current beat (1..4).
  const subInBeatFloat = (beatPos - Math.floor(beatPos)) * SIXTEENTHS_PER_BEAT;
  const subdivision = Math.min(
    SIXTEENTHS_PER_BEAT,
    Math.max(1, Math.floor(subInBeatFloat) + 1),
  );

  const currentParts: FormattedPlaybackPositionParts = {
    bar: String(bar),
    beat: String(beat),
    subdivision: String(subdivision),
  };
  // Total uses duration semantics: `${bars}.0.0` rather than the position of
  // the final tick. Matches Logic/Ableton "song length" displays where a
  // 4-bar loop reads "4.0.0" — i.e. four full bars have elapsed at the end.
  const totalParts: FormattedPlaybackPositionParts = {
    bar: String(totalBars),
    beat: "0",
    subdivision: "0",
  };

  return {
    current: `${currentParts.bar}.${currentParts.beat}.${currentParts.subdivision}`,
    total: `${totalParts.bar}.${totalParts.beat}.${totalParts.subdivision}`,
    parts: { current: currentParts, total: totalParts },
  };
}
```

Also update the docstring above the function (lines 100-110):

```ts
/**
 * Format the DAW-style position readout for the progression track.
 *
 * Returns a bar.beat.sixteenth pair such as `1.2.3 / 4.0.0` where:
 * - bar is the 1-indexed bar (no padding)
 * - beat is the 1-indexed beat within the current bar
 * - subdivision is the 1-indexed sixteenth-note within the current beat (1..4)
 *
 * The total uses duration semantics — `${bars}.0.0` for a `bars`-long
 * progression — matching how Logic and Ableton display song length.
 */
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/progressions/progressionDomain.test.ts -t "formatProgressionPlaybackPosition"`
Expected: PASS (4 tests).

Also run the full file to catch any other tests that referenced the old format:
`pnpm vitest run src/progressions/progressionDomain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/progressionDomain.ts src/progressions/progressionDomain.test.ts
git commit -m "refactor(progression-readout): emit 1-indexed bar.beat.sixteenth with duration-style total"
```

---

### Task 2: Add tempo-adaptive tick to `ProgressionPositionReadout`

**Files:**
- Modify: `src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx`
- Modify: `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx:55-62`
- Test: `src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the body of `ProgressionPositionReadout.test.tsx` with this version (rewrites both existing tests + adds one for tempo-adaptive tick). The big changes: pass `tempoBpm` prop in every render, assert against the new format, advance timers by the BPM-derived interval.

```ts
import { axe } from "vitest-axe";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ProgressionPositionReadout } from "./ProgressionPositionReadout";
import { setActiveStep, _resetTimelineForTests } from "../../progressions/audio/timeline";
import { _resetProgressionAudioForTests, ensureProgressionAudio } from "../../progressions/audio/bus";

describe("ProgressionPositionReadout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetTimelineForTests();
    _resetProgressionAudioForTests();

    const audioContext = {
      get currentTime() {
        return 0;
      },
      createGain: () => ({
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }),
      destination: {},
    };

    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        return audioContext;
      }) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders initial position correctly and has no accessibility violations", async () => {
    const { container } = render(
      <ProgressionPositionReadout
        playing={false}
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={120}
      />
    );

    let violations;
    await act(async () => {
      vi.useRealTimers();
      violations = await axe(container);
      vi.useFakeTimers();
    });
    expect(violations).toHaveNoViolations();

    // New format: start = `1.1.1`, 4-bar total = `4.0.0`.
    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();
  });

  it("updates digits during playback without NaN", async () => {
    let mockTime = 0;
    const audioContext = {
      get currentTime() {
        return mockTime;
      },
      createGain: () => ({
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }),
      destination: {},
    };

    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        return audioContext;
      }) as unknown as typeof AudioContext;

    ensureProgressionAudio();

    setActiveStep(0, 0, 2.0, 0, 8.0); // 2s step, total 8s

    const { container } = render(
      <ProgressionPositionReadout
        playing={true}
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={120}
      />
    );

    // Initial label
    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();

    // At 120 BPM the tick is 60000 / 120 / 4 = 125 ms. Advance past one tick.
    // 0.5 s = 25% of step = beat 2 of bar 1, first sixteenth → `1.2.1`.
    act(() => {
      mockTime = 0.5;
      vi.advanceTimersByTime(125);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.1 of 4.0.0" })).toBeTruthy();

    // 0.75 s = 37.5% of step = beat 2 + half-beat = 2nd sixteenth → `1.2.3`.
    // (Half a beat = 2 sixteenths past beat 2's first sixteenth → 1+2 = 3.)
    act(() => {
      mockTime = 0.75;
      vi.advanceTimersByTime(125);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.3 of 4.0.0" })).toBeTruthy();

    let playbackViolations;
    await act(async () => {
      vi.useRealTimers();
      playbackViolations = await axe(container);
      vi.useFakeTimers();
    });
    expect(playbackViolations).toHaveNoViolations();

    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("restarts the tick interval when tempo changes", () => {
    let mockTime = 0;
    const audioContext = {
      get currentTime() {
        return mockTime;
      },
      createGain: () => ({
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }),
      destination: {},
    };

    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        return audioContext;
      }) as unknown as typeof AudioContext;

    ensureProgressionAudio();
    setActiveStep(0, 0, 2.0, 0, 8.0);

    const { rerender } = render(
      <ProgressionPositionReadout
        playing={true}
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={60}
      />
    );

    // At 60 BPM the tick is 250 ms. Advancing 125 ms does NOT fire a tick.
    act(() => {
      mockTime = 0.5;
      vi.advanceTimersByTime(125);
    });
    // Label is still the initial value (no interval has fired yet).
    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();

    // Re-render at 240 BPM. New tick = 62.5 → 63 ms. After 70 ms the tick has
    // fired and the label reflects the new position.
    rerender(
      <ProgressionPositionReadout
        playing={true}
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={240}
      />
    );
    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.1 of 4.0.0" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx`
Expected: FAIL — component prop type doesn't include `tempoBpm`; format assertions also fail.

- [ ] **Step 3: Add `tempoBpm` to the component + derive `tickMs`**

In `src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx`:

(a) Replace the `ProgressionPositionReadoutProps` interface (lines 9-16):

```ts
interface ProgressionPositionReadoutProps {
  playing: boolean;
  stepStartBar: number;
  stepBars: number;
  stepIndex: number;
  totalProgressionBars: number;
  beatsPerBar: number;
  /** Active tempo in BPM. Drives the imperative tick interval: one render per
   *  sixteenth-note (`60_000 / tempoBpm / 4` ms) so the subdivision digit
   *  advances exactly once per sub-beat at any tempo. */
  tempoBpm: number;
}
```

(b) Delete the fixed `TICK_MS` constant (lines 18-22) entirely.

(c) Replace the function signature (line 61-68) and the `useEffect` block (lines 97-162) with:

```ts
export function ProgressionPositionReadout({
  playing,
  stepStartBar,
  stepBars,
  stepIndex,
  totalProgressionBars,
  beatsPerBar,
  tempoBpm,
}: ProgressionPositionReadoutProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const barRef = useRef<HTMLSpanElement | null>(null);
  const beatRef = useRef<HTMLSpanElement | null>(null);
  const subRef = useRef<HTMLSpanElement | null>(null);
  const lastBarRef = useRef<string>("");
  const lastBeatRef = useRef<string>("");
  const lastSubRef = useRef<string>("");
  const lastAriaLabelRef = useRef<string>("");

  const propsRef = useRef({ stepStartBar, stepBars, stepIndex, totalProgressionBars, beatsPerBar });
  useEffect(() => {
    propsRef.current = { stepStartBar, stepBars, stepIndex, totalProgressionBars, beatsPerBar };
  }, [stepStartBar, stepBars, stepIndex, totalProgressionBars, beatsPerBar]);

  const initialPosition = formatProgressionPlaybackPosition(
    stepStartBar,
    totalProgressionBars,
    beatsPerBar,
  );

  useEffect(() => {
    const write = (positionBar: number) => {
      const { totalProgressionBars: currentTotalBars, beatsPerBar: currentBPB } = propsRef.current;
      const p = formatProgressionPlaybackPosition(
        positionBar,
        currentTotalBars,
        currentBPB,
      );
      const { bar, beat, subdivision } = p.parts.current;
      if (bar !== lastBarRef.current && barRef.current) {
        barRef.current.textContent = bar;
        lastBarRef.current = bar;
      }
      if (beat !== lastBeatRef.current && beatRef.current) {
        beatRef.current.textContent = beat;
        lastBeatRef.current = beat;
      }
      if (subdivision !== lastSubRef.current && subRef.current) {
        subRef.current.textContent = subdivision;
        lastSubRef.current = subdivision;
      }

      const currentAriaLabel = `Position ${p.current} of ${p.total}`;
      if (currentAriaLabel !== lastAriaLabelRef.current && containerRef.current) {
        containerRef.current.setAttribute("aria-label", currentAriaLabel);
        lastAriaLabelRef.current = currentAriaLabel;
      }
    };

    const tick = () => {
      const tl = getTimelinePosition();
      const {
        stepStartBar: currentStepStartBar,
        stepBars: currentStepBars,
        stepIndex: currentStepIndex,
      } = propsRef.current;

      const live =
        playing
        && tl
        && tl.stepIndex === currentStepIndex
        && !tl.paused
        && currentStepBars > 0;
      const positionBar = live ? currentStepStartBar + tl.localFraction * currentStepBars : currentStepStartBar;
      write(positionBar);
    };

    lastBarRef.current = "";
    lastBeatRef.current = "";
    lastSubRef.current = "";
    lastAriaLabelRef.current = "";
    tick();

    if (!playing) return;
    // One render per sixteenth note at the active tempo: 60_000 ms / BPM / 4.
    // At 60 BPM → 250 ms; 120 → 125 ms; 240 → 63 ms. Clamp to 16 ms floor so
    // accidentally-huge tempos (>3750 BPM) don't hammer the main thread.
    const tickMs = Math.max(16, Math.round(15000 / Math.max(1, tempoBpm)));
    const id = window.setInterval(tick, tickMs);
    return () => window.clearInterval(id);
  }, [playing, tempoBpm]);
```

(The rest of the component — the JSX returned at line 164 — is unchanged.)

- [ ] **Step 4: Wire `tempoBpm` from `HeaderTransportCluster`**

In `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx`, change the `<ProgressionPositionReadout ... />` render (lines 55-62) to:

```tsx
      <ProgressionPositionReadout
        playing={progressionPlaying && canPlay}
        stepStartBar={currentProgressionBar}
        stepBars={activeStepBars}
        stepIndex={activeProgressionStepIndex}
        totalProgressionBars={totalProgressionBars}
        beatsPerBar={beatsPerBar}
        tempoBpm={progressionTempoBpm}
      />
```

(`progressionTempoBpm` is already destructured from `useProgressionState()` — see line 35; no other changes needed.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/HeaderTransportCluster/`
Expected: ALL pass (3 tests in `ProgressionPositionReadout.test.tsx` + any cluster tests).

Also broader sweep for regressions:
- `pnpm vitest run src/components/`

If anything else broke (e.g. another component renders `ProgressionPositionReadout` without `tempoBpm`), TypeScript will surface it; fix the missing prop at the call site.

- [ ] **Step 6: Commit**

```bash
git add src/components/HeaderTransportCluster/ProgressionPositionReadout.tsx src/components/HeaderTransportCluster/HeaderTransportCluster.tsx src/components/HeaderTransportCluster/ProgressionPositionReadout.test.tsx
git commit -m "feat(progression-readout): tempo-adaptive tick at sixteenth-note resolution"
```

---

### Task 3: Full local verification + visual baseline refresh

**Files:** none modified directly.

- [ ] **Step 1: Run the full verification suite**

```bash
pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production
```

Expected: all four exit 0. No known orthogonal failures remain after `eaae3b8` fixed the ProgressionPositionReadout test.

If any test breaks beyond what Tasks 1+2 expected, STOP and investigate before continuing.

- [ ] **Step 2: Refresh visual baselines**

The position-readout digits will change ("01" → "1", "000" → "1", etc.) which means cropping width / pixel positions of the digits in the header transport cluster snapshot will differ.

Run: `pnpm test:visual:update`

Inspect changes via `git status e2e/` and `git diff --stat e2e/`. Expected: header-transport-cluster screenshot diffs only. Investigate any other snapshot that changed (likely none).

- [ ] **Step 3: Commit visual snapshots**

```bash
git status -- e2e/
# If snapshots changed:
git add 'e2e/**/*-snapshots/**'
git commit -m "test(visual): refresh baselines for new position-readout format"
```

If no snapshots changed, skip.

- [ ] **Step 4: Final sanity**

```bash
git status        # should be clean
git log --oneline -5
```

Expected: tip of branch is the visual snapshot commit (or the Task 2 commit if no snapshots changed), preceded by Tasks 2 and 1.

---

## Verification

1. **Unit:** `pnpm test` green, including the 4 reformatted tests in `progressionDomain.test.ts` and 3 tests in `ProgressionPositionReadout.test.tsx`.
2. **Lint:** `pnpm lint` clean.
3. **Build:** `pnpm build` succeeds. TypeScript catches any missing `tempoBpm` prop at all `ProgressionPositionReadout` call sites.
4. **E2E:** `pnpm test:e2e:production` passes.
5. **Visual:** `pnpm test:visual` passes against refreshed baselines.
6. **Manual smoke:** Run `pnpm dev`. Open the app, load a 4-bar progression in 4/4 at 120 BPM, press Play. Confirm:
   - Initial readout shows `1.1.1 / 4.0.0`.
   - During playback, sub digit advances 1 → 2 → 3 → 4 (then wraps to 1 with beat incrementing).
   - Change tempo to 60 BPM mid-playback: the sub digit visibly slows to ~4 Hz.
   - Change tempo to 240 BPM mid-playback: the sub digit speeds up to ~16 Hz.

---

## Self-review

**1. Spec coverage:**
- (1) Replace `01.1.000` start with `1.1.1` → Task 1 step 3 (no-pad bar, 1-indexed sixteenth subdivision).
- (1) Replace `04.4.000` total with `4.0.0` → Task 1 step 3 (duration-style total).
- (2) Refresh rate depends on tempo → Task 2 step 3 (`tickMs = 15000 / tempoBpm`, restarted on tempo change via effect deps).

**2. Placeholder scan:** no "TBD", "handle edge cases", or vague directions. Every step that changes code includes the code.

**3. Type consistency:**
- `tempoBpm: number` — same name in interface, function signature, JSX prop site, and tests.
- `tickMs` — local const in the effect; not exposed.
- `SIXTEENTHS_PER_BEAT = 4` — only inside the formatter; consumers don't see it.
- `formatProgressionPlaybackPosition` return shape unchanged (`FormattedPlaybackPosition` interface untouched) — imperative DOM writes in the readout don't need code changes.
