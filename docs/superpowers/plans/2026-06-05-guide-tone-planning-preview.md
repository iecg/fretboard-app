# Two-Phase Guide-Tone Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a calm planning-phase dashed ring on the next chord's guide tones (from chord onset, capped at 2 bars before the change), ahead of the existing landing-phase contracting ring, and remove the dead glow underlay channel.

**Architecture:** A pure window helper + a new Jotai atom decide when the playhead is in the *planning* runway (before the existing lead-in/landing window). The emphasis layer (`getEmphasis`) emits a new `guide-preview` transition role in that window; `FretboardNote` renders the same ring element in two CSS-branched states (static dashed → solid contracting). The glow underlay is deleted as a separate final task because it is invisible in practice and superseded by the ring.

**Tech Stack:** React 19 + TypeScript, Jotai atoms, SVG + CSS Modules, `motion/react`, Vitest + Testing Library, Playwright visual regression.

**Source design:** `docs/superpowers/specs/2026-06-05-guide-tone-planning-preview-design.md`

---

## File Structure

- `src/store/practiceLensAtoms.ts` — **Modify.** Add `PLANNING_RUNWAY_BARS`, pure `isInPlanningWindow(...)`, and `planningWindowActiveAtom` (mirrors `leadInActiveAtom`).
- `src/store/practiceLensAtoms.test.ts` — **Modify.** Unit tests for `isInPlanningWindow` + `planningWindowActiveAtom`.
- `src/components/FretboardSVG/utils/semantics.ts` — **Modify.** Extend `TransitionRole` with `"guide-preview"`; add `planningActive` to `LeadLensContext`; emit `guide-preview` in `getEmphasis`; (Task 6) drop `glowColor`.
- `src/components/FretboardSVG/utils/semantics.test.ts` — **Modify.** Tests for the planning-preview branch; (Task 6) glow assertions removed.
- `src/components/FretboardSVG/hooks/useEmphasisContext.ts` — **Modify.** Read `planningWindowActiveAtom`, expose `planningActive`.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` — **Modify.** Thread `planningActive` into `LeadLensContext`; (Task 6) drop `glowColor` from the render signature.
- `src/components/FretboardSVG/FretboardNote.tsx` — **Modify.** Render the ring for `guide-preview` too with `data-guide-phase`; (Task 6) remove the glow underlay `<circle>`.
- `src/components/FretboardSVG/FretboardNote.test.tsx` — **Modify.** Tests for the `data-guide-phase` ring; (Task 6) remove glow-underlay tests.
- `src/components/FretboardSVG/FretboardSVG.module.css` — **Modify.** Dashed static `preview` ring, scoped landing animation/keyframe; (Task 6) remove glow-underlay rules.
- `e2e/` darwin (+ linux) snapshots — **Refresh** in Task 7.

**Sequencing note:** the glow channel stays intact through Tasks 1–5 so every commit is green; it is removed wholesale in Task 6. Until then `getEmphasis` keeps setting `glowColor` on the landing target exactly as today, and `guide-preview` simply does not set a glow.

---

## Task 1: Pure planning-window helper

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (near `computeLeadInWindowMs`/`isInLeadInWindow`, around line 101–147)
- Test: `src/store/practiceLensAtoms.test.ts` (after the `isInLeadInWindow` describe block, ~line 695)

- [ ] **Step 1: Write the failing tests**

Add to `src/store/practiceLensAtoms.test.ts`. First add `isInPlanningWindow` to the existing import from `./practiceLensAtoms` (the line that already imports `computeLeadInWindowMs, isInLeadInWindow, ...`). Then append this describe block after the `isInLeadInWindow` tests:

```ts
describe("isInPlanningWindow", () => {
  it("is active before the landing window for a single-bar step (runway starts at onset)", () => {
    // step 2000, bar 2000: landing = 1000ms (50%); planning span = whole step.
    // planning = [0, 0.5); landing = [0.5, 1].
    expect(isInPlanningWindow(0.0, 2000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.3, 2000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.5, 2000, 2000)).toBe(false); // landing, not planning
    expect(isInPlanningWindow(0.7, 2000, 2000)).toBe(false);
  });

  it("caps the runway at 2 bars on a long chord (no preview earlier than 2 bars out)", () => {
    // step 8000, bar 2000: landing = 2000 (1-bar cap); planning span = 4000 (2 bars).
    // planning = [0.5, 0.75); landing = [0.75, 1].
    expect(isInPlanningWindow(0.4, 8000, 2000)).toBe(false); // >2 bars out
    expect(isInPlanningWindow(0.5, 8000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.74, 8000, 2000)).toBe(true);
    expect(isInPlanningWindow(0.75, 8000, 2000)).toBe(false); // landing
  });

  it("has no room when the landing floor eats the runway (very fast tempo)", () => {
    // step 1000, bar 200: planning span = min(1000, 400) = 400; landing floor = 600.
    // 400 <= 600 -> no planning room at all.
    expect(isInPlanningWindow(0.1, 1000, 200)).toBe(false);
    expect(isInPlanningWindow(0.5, 1000, 200)).toBe(false);
  });

  it("uses the proportional landing window when no bar length is given", () => {
    // step 8000, no bar: landing = 4000 (50%); planning span = 8000.
    // planning = [0, 0.5).
    expect(isInPlanningWindow(0.3, 8000)).toBe(true);
    expect(isInPlanningWindow(0.5, 8000)).toBe(false);
  });

  it("returns false for a non-positive step duration", () => {
    expect(isInPlanningWindow(0.5, 0, 2000)).toBe(false);
    expect(isInPlanningWindow(0.5, -100, 2000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "isInPlanningWindow"`
Expected: FAIL — `isInPlanningWindow is not a function` (not exported yet).

- [ ] **Step 3: Implement the helper**

In `src/store/practiceLensAtoms.ts`, directly below the `isInLeadInWindow` function (after ~line 147), add:

```ts
/** Planning runway is capped at this many bars before the chord change. */
const PLANNING_RUNWAY_BARS = 2;

/**
 * True when the playhead is in the PLANNING runway — before the landing
 * window, within {@link PLANNING_RUNWAY_BARS} bars of the change. Mutually
 * exclusive with {@link isInLeadInWindow} by construction. The runway spans
 * `[end − min(step, 2·bar), end − landingWindow]`; it is empty when the landing
 * floor leaves no room before it. Pure so it is unit-testable without atoms.
 */
export function isInPlanningWindow(
  stepFraction: number,
  stepDurationMs: number,
  barDurationMs = Infinity,
): boolean {
  if (stepDurationMs <= 0) return false;
  const landingMs = computeLeadInWindowMs(stepDurationMs, barDurationMs);
  const planningSpanMs = Math.min(
    stepDurationMs,
    PLANNING_RUNWAY_BARS * barDurationMs,
  );
  if (planningSpanMs <= landingMs) return false; // landing floor leaves no room
  const startFraction = 1 - planningSpanMs / stepDurationMs;
  const endFraction = 1 - landingMs / stepDurationMs;
  return stepFraction >= startFraction && stepFraction < endFraction;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "isInPlanningWindow"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(fretboard): add isInPlanningWindow runway helper"
```

---

## Task 2: `planningWindowActiveAtom`

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (directly after `leadInActiveAtom`, ~line 589)
- Test: `src/store/practiceLensAtoms.test.ts` (after the `leadInActiveAtom / leadInDurationMsAtom` describe block, ~line 888)

- [ ] **Step 1: Write the failing tests**

Add `planningWindowActiveAtom` to the existing import from `./practiceLensAtoms` in the test file. Then append this describe block after the `leadInActiveAtom / leadInDurationMsAtom` block (reuse the same store-setup helpers + atom imports already present in that file: `progressionPlayingStateAtom`, `progressionVisualFrameAtom`, `displayedStepIndexPrimitiveAtom`, `activeProgressionStepIndexAtom`, `progressionStepDeadlineAtom`, `progressionStepDurationMsAtom`, `progressionBarDurationMsAtom`, `progressionStepsAtom`, `createStore`):

```ts
describe("planningWindowActiveAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeDefaultStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    return store;
  }

  it("is false when not playing", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, false);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.3, localFraction: 0.3, paused: false });
    expect(store.get(planningWindowActiveAtom)).toBe(false);
  });

  it("is false while paused", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.3, localFraction: 0.3, paused: true });
    expect(store.get(planningWindowActiveAtom)).toBe(false);
  });

  it("is true in the planning runway and false once inside the landing window (mutually exclusive)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(activeProgressionStepIndexAtom, 1);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0, paused: false });
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));

    // Just BEFORE the landing window opens -> planning active, lead-in inactive.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 300);
    expect(store.get(planningWindowActiveAtom)).toBe(true);
    expect(store.get(leadInActiveAtom)).toBe(false);

    // Just AFTER the landing window opens -> planning inactive, lead-in active.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 300);
    expect(store.get(planningWindowActiveAtom)).toBe(false);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });

  it("is false during the boundary gap (landing owns it, not planning)", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    // Audio frame already crossed into step 1; displayed step still deferred at 0.
    store.set(displayedStepIndexPrimitiveAtom, 0);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0, paused: false });
    expect(store.get(planningWindowActiveAtom)).toBe(false);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "planningWindowActiveAtom"`
Expected: FAIL — `planningWindowActiveAtom` is not exported.

- [ ] **Step 3: Implement the atom**

In `src/store/practiceLensAtoms.ts`, immediately after `leadInActiveAtom` (after ~line 589), add:

```ts
/**
 * True when the playhead is in the PLANNING runway: the current chord is
 * settled (active === displayed), the audio frame is on that same step, and the
 * step fraction sits inside {@link isInPlanningWindow}. Distinct from
 * {@link leadInActiveAtom}: it does NOT take the boundary-gap "hold" branch —
 * during the deferred-render gap the LANDING ring owns the moment, so planning
 * yields. The two atoms are mutually exclusive.
 *
 * Like leadInActiveAtom this reads the per-frame visual frame, but its VALUE
 * only flips at the window thresholds, so subscribers re-render at most twice
 * per step (planning open / planning close).
 */
export const planningWindowActiveAtom = atom((get): boolean => {
  if (!get(progressionPlayingAtom)) return false;
  const frame = get(progressionVisualFrameAtom);
  if (!frame || frame.paused) return false;
  const displayed = get(displayedProgressionStepIndexAtom);
  // Boundary gap (audio ahead of displayed) belongs to the landing ring.
  if (frame.stepIndex !== displayed) return false;
  // Only trust the step fraction when the deadline's step (active) matches the
  // displayed step — same guard as leadInActiveAtom.
  if (get(activeProgressionStepIndexAtom) !== displayed) return false;
  const deadline = get(progressionStepDeadlineAtom);
  if (deadline == null) return false;
  const stepMs = get(progressionStepDurationMsAtom);
  const stepFraction = stepRelativeFraction(deadline, Date.now(), stepMs);
  return isInPlanningWindow(stepFraction, stepMs, get(progressionBarDurationMsAtom));
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts -t "planningWindowActiveAtom"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(fretboard): add planningWindowActiveAtom for the runway phase"
```

---

## Task 3: Emit `guide-preview` from the emphasis layer

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:9` (`TransitionRole`), `:27-44` (`LeadLensContext`), `:72-109` (`getEmphasis`)
- Modify: `src/components/FretboardSVG/hooks/useEmphasisContext.ts`
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts:43-52`
- Test: `src/components/FretboardSVG/utils/semantics.test.ts:380-468`

- [ ] **Step 1: Write the failing tests**

In `src/components/FretboardSVG/utils/semantics.test.ts`, add `planningActive: false` to the shared `baseLeadContext` literal (after the `leadInActive: true` line, ~line 389) so it satisfies the new required field:

```ts
    leadInActive: true,
    planningActive: false,
```

Then append these tests inside the `describe("getEmphasis - voice-leading emphasis", ...)` block (after the existing "outside the lead-in window, a guide tone produces no role" test, ~line 468):

```ts
  it("marks a next-chord guide tone as 'guide-preview' during the planning window", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B", leadInActive: false, planningActive: true,
      nextGuideTones: new Set(["B"]),
      nextGuideToneLabels: new Map([["B", "3"]]),
    };
    // Planning preview: resting size, full opacity, the preview role + label,
    // and NO glow (the ring carries it).
    const e = getEmphasis("scale-only", false, ctx);
    expect(e.transitionRole).toBe("guide-preview");
    expect(e.guideTargetLabel).toBe("3");
    expect(e.opacityBoost).toBe(1);
    expect(e.radiusBoost).toBe(0.85);
    expect(e.glowColor).toBeUndefined();
  });

  it("landing (guide-target) takes precedence over planning when both flags are set", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B", leadInActive: true, planningActive: true,
      nextGuideTones: new Set(["B"]),
      nextGuideToneLabels: new Map([["B", "3"]]),
    };
    expect(getEmphasis("scale-only", false, ctx).transitionRole).toBe("guide-target");
  });

  it("produces no role when neither planning nor lead-in is active", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B", leadInActive: false, planningActive: false,
      nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("note-inactive", false, ctx).transitionRole).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "getEmphasis"`
Expected: FAIL — TS/`LeadLensContext` lacks `planningActive`, and `guide-preview` is not produced.

- [ ] **Step 3: Implement the emphasis branch**

In `src/components/FretboardSVG/utils/semantics.ts`:

(a) Widen the role union (line 9):

```ts
export type TransitionRole = "guide-target" | "guide-preview";
```

(b) Add `planningActive` to `LeadLensContext` (after the `leadInActive: boolean;` field, ~line 43):

```ts
  /** True only during the lead-in (landing) preview window. */
  leadInActive: boolean;
  /** True only during the earlier planning runway (mutually exclusive with leadInActive). */
  planningActive: boolean;
```

(c) In `getEmphasis`, destructure `planningActive` and add the preview branch. Replace the destructure line (~line 84) and the lead-in block (~line 99-108) with:

```ts
  const { notePc, nextGuideTones, nextGuideToneLabels, commonWithNext, leadInActive, planningActive } = leadContext;
```

```ts
  // Landing: the next chord's guide tones get the urgent contracting ring.
  if (leadInActive && nextGuideTones.has(notePc)) {
    return {
      glowColor: "var(--note-incoming)",
      radiusBoost: resting.radiusBoost,
      opacityBoost: 1,
      transitionRole: "guide-target",
      guideTargetLabel: nextGuideToneLabels.get(notePc),
    };
  }
  // Planning: the same guide tones get a calm static preview (no glow — the
  // dashed ring carries it). Brought to full opacity so the target reads.
  if (planningActive && nextGuideTones.has(notePc)) {
    return {
      radiusBoost: resting.radiusBoost,
      opacityBoost: 1,
      transitionRole: "guide-preview",
      guideTargetLabel: nextGuideToneLabels.get(notePc),
    };
  }
  return resting;
```

(d) In `src/components/FretboardSVG/hooks/useEmphasisContext.ts`: import `planningWindowActiveAtom`, add `planningActive: boolean` to `EmphasisContext`, read it, and return it. Apply:

```ts
import {
  commonTonesWithNextAtom,
  nextChordGuideTonesAtom,
  nextChordGuideToneLabelsAtom,
  nextChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
  leadInActiveAtom,
  planningWindowActiveAtom,
} from "../../../store/practiceLensAtoms";
```

```ts
export interface EmphasisContext {
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
  nextGuideToneLabels: Map<string, string>;
  nextChordTones: Set<string>;
  incomingTones: Set<string>;
  departingTones: Set<string>;
  leadInActive: boolean;
  planningActive: boolean;
}
```

```ts
  const leadInActive = useAtomValue(leadInActiveAtom);
  const planningActive = useAtomValue(planningWindowActiveAtom);
```

```ts
  return {
    commonWithNext,
    nextGuideTones,
    nextGuideToneLabels,
    nextChordTones,
    incomingTones,
    departingTones,
    leadInActive,
    planningActive,
  };
```

(e) In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, thread the field into `LeadLensContext` (in the `leadContext = { ... }` literal, after `leadInActive: emphasisContext.leadInActive,` ~line 51):

```ts
        leadInActive: emphasisContext.leadInActive,
        planningActive: emphasisContext.planningActive,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS (including the 3 new tests; existing guide-target/hold tests still green because the landing branch still sets `glowColor`).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/hooks/useEmphasisContext.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts
git commit -m "feat(fretboard): emit guide-preview role during the planning runway"
```

---

## Task 4: Render the two-phase ring in `FretboardNote`

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx:62-63` (phase derivation) and `:151-167` (ring JSX)
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx` (new describe block after the existing "guide-target ring" block)

- [ ] **Step 1: Write the failing tests**

Append to `src/components/FretboardSVG/FretboardNote.test.tsx`:

```ts
describe("FretboardNote — two-phase guide ring", () => {
  it("renders the ring with data-guide-phase='preview' for a guide-preview note", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "guide-preview",
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, guideTargetLabel: "3" },
      }),
    );
    const ring = container.querySelector("[data-guide-ring]");
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("data-guide-phase")).toBe("preview");
  });

  it("renders the ring with data-guide-phase='landing' for a guide-target note", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target" }),
    );
    const ring = container.querySelector("[data-guide-ring]");
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("data-guide-phase")).toBe("landing");
  });

  it("renders no guide ring when there is no transition role", () => {
    const { container } = renderNote(makeNote({ transitionRole: undefined }));
    expect(container.querySelector("[data-guide-ring]")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx -t "two-phase guide ring"`
Expected: FAIL — preview produces no ring / no `data-guide-phase`.

- [ ] **Step 3: Implement the two-phase ring**

In `src/components/FretboardSVG/FretboardNote.tsx`, after the `guideFade` line (~line 63) add the phase derivation:

```ts
  const guidePhase =
    transitionRole === "guide-target"
      ? "landing"
      : transitionRole === "guide-preview"
        ? "preview"
        : undefined;
```

Replace the existing guide-ring `AnimatePresence` block (~line 151-167) with:

```tsx
      <AnimatePresence>
        {guidePhase && (
          <motion.circle
            key="guide-ring"
            className={styles["note-guide-ring"]}
            data-guide-ring="true"
            data-guide-phase={guidePhase}
            cx={cx}
            cy={cy}
            r={r + 4}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: guidePhase === "preview" ? 0.7 : 0.95 }}
            exit={{ opacity: 0 }}
            transition={guideFade}
          />
        )}
      </AnimatePresence>
```

(The `"3"`/`"b7"` label block directly below is unchanged — `getEmphasis` now sets `guideTargetLabel` in both phases, so the label shows during planning and landing automatically.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS (existing guide-target ring test still passes — it now also carries `data-guide-phase="landing"`; new block passes).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNote.test.tsx
git commit -m "feat(fretboard): render two-phase guide ring (preview + landing)"
```

---

## Task 5: Dashed preview ring + gentle landing keyframe (CSS)

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css:249-275` (`.note-guide-ring`, keyframe, reduced-motion)

- [ ] **Step 1: Scope the landing animation and add the preview variant**

Replace the `.note-guide-ring` base rule and its keyframe (~line 249-262) with the following. The base rule keeps shape/stroke; the **landing** variant owns the contraction; the **preview** variant is a static dashed ring:

```css
.note-guide-ring {
  fill: none;
  stroke: var(--note-incoming);
  stroke-width: 2;
  transform-box: fill-box;
  transform-origin: center;
}

/* Planning phase — calm, static, dashed. No motion: a static form raises no
   sensory transient, so it sits in the periphery as a "plan toward this" cue
   without competing with the single contracting landing ring. */
.note-guide-ring[data-guide-phase="preview"] {
  stroke-dasharray: 3 3;
}

/* Landing phase — the urgent contracting countdown. Starts near the preview's
   resting size (NOT a big re-bloom) so the phase transition reads as "the calm
   ring tightens and lands". OPACITY is motion-owned (see FretboardNote). */
.note-guide-ring[data-guide-phase="landing"] {
  animation: note-guide-ring-contract var(--lead-in-duration, 0.6s) ease-out both;
}

@keyframes note-guide-ring-contract {
  0%   { transform: scale(1.18); }
  60%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
```

Then update the reduced-motion rule (~line 267-271) to target the landing variant:

```css
@media (prefers-reduced-motion: reduce) {
  .note-guide-ring[data-guide-phase="landing"] {
    animation: none;
    transform: none;
  }
  .fretboard-note circle.note-glow-underlay {
    transition: none;
  }
}
```

- [ ] **Step 2: Verify lint + the existing component tests still pass**

Run: `pnpm run lint && pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS (CSS is presentation-only; no JS test asserts the keyframe).

- [ ] **Step 3: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(fretboard): style the dashed planning ring and soften the landing contract"
```

---

## Task 6: Remove the dead glow underlay channel

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (`LensEmphasis.glowColor`, landing/hold returns)
- Modify: `src/components/FretboardSVG/FretboardNote.tsx` (glow `<circle>`, `glowR`, import)
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts:114` (signature)
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (glow rules)
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`, `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Update the tests first (remove glow expectations)**

In `src/components/FretboardSVG/utils/semantics.test.ts`:
- Lines ~15 and ~34 assert `expect(e.glowColor).toBeUndefined()` / `expect(getEmphasis(...).glowColor).toBeUndefined()`. Delete those two assertions (the property no longer exists on the type).
- The "marks a next-chord guide tone as 'guide-target' ..." test (~line 401-413): change its expectation to drop `glowColor`:

```ts
    expect(getEmphasis("scale-only", false, ctx)).toEqual({
      radiusBoost: 0.85, opacityBoost: 1,
      transitionRole: "guide-target", guideTargetLabel: "3",
    });
```

- The two "held common tone ... hold glow" tests (~line 436-444 and ~454-461): drop `glowColor` from both expectations:

```ts
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      radiusBoost: 1.15, opacityBoost: 1,
    });
```

In `src/components/FretboardSVG/FretboardNote.test.tsx`:
- Delete the entire `describe("FretboardNote — always-rendered glow underlay", ...)` block (~line 79-109).
- In the remaining guide-target tests that build `glowColor` (the `data-transition-role` test ~line 45-56 and the guide-target ring test ~line 111+), remove the `glowColor` constant and drop it from `applyLensEmphasis` so they read e.g. `applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 }`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: FAIL — type errors (`glowColor` still on `LensEmphasis` / still set in `semantics.ts`), or the deleted-underlay query mismatch.

- [ ] **Step 3: Remove glow from the emphasis layer**

In `src/components/FretboardSVG/utils/semantics.ts`:
- In `LensEmphasis` (~line 11-19) delete the `glowColor?: \`var(--${string})\`;` field.
- In `applyTonesBase` / the `resting` hold branch (~line 89-92), drop `glowColor`:

```ts
  const resting: LensEmphasis =
    CHORD_TONE_CLASSES.has(noteClass) && commonWithNext.has(notePc)
      ? { radiusBoost: 1.15, opacityBoost: 1 }
      : applyTonesBase(noteClass);
```

- In the landing branch added in Task 3, delete the `glowColor: "var(--note-incoming)",` line so it returns only `radiusBoost`/`opacityBoost`/`transitionRole`/`guideTargetLabel`.

- [ ] **Step 4: Remove the glow underlay from the renderer + signature**

In `src/components/FretboardSVG/FretboardNote.tsx`:
- Delete the glow underlay element (~line 136-144, the `<circle className={styles["note-glow-underlay"]} ... data-glow=... />`).
- Delete the `const glowR = glowUnderlayRadiusPx(r);` line (~line 69).
- Remove `glowUnderlayRadiusPx` from the import on line 6 (keep `reduceCircleRadius`): `import { reduceCircleRadius } from "./utils/noteSizing";`

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, delete the `emph.glowColor ?? "",` line from `renderedNoteSignature` (~line 114). (`transitionRole` + `guideTargetLabel` remain, so preview/landing still bust the cache.)

- [ ] **Step 5: Remove the glow CSS**

In `src/components/FretboardSVG/FretboardSVG.module.css`:
- Delete the two `.fretboard-note circle.note-glow-underlay` rules (~line 221-237) and the comment block above them (the "Voice-leading glow underlay" comment ~line 216-220).
- In the reduced-motion block, delete the `.fretboard-note circle.note-glow-underlay { transition: none; }` rule added back in Task 5 so the block contains only the landing rule.

- [ ] **Step 6: Sweep for stragglers**

Run: `grep -rn "glowColor\|note-glow-underlay\|glowUnderlayRadiusPx\|data-glow" src/ packages/`
Expected: no matches in non-test source. If `glowUnderlayRadiusPx` is now unused in `src/components/FretboardSVG/utils/noteSizing.ts`, leave the helper if other callers exist; if it has zero remaining references, delete its export and its test in `noteSizing.test.ts` (only if present — verify with the grep above before removing).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/`
Expected: PASS — glow gone, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/FretboardSVG/
git commit -m "refactor(fretboard): remove the dead glow underlay channel"
```

---

## Task 7: Full verification + visual snapshot refresh

**Files:**
- Refresh: `e2e/` darwin snapshots (and linux via the cross-platform script if CI requires)

- [ ] **Step 1: Lint, unit tests, build (mandatory pre-PR gate)**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass. Fix any type/lint fallout before continuing.

- [ ] **Step 2: Refresh darwin visual snapshots**

Run: `pnpm run test:visual:update`
Expected: updated snapshots under `e2e/` for the dashed planning ring and the removed glow. Review the image diffs to confirm the planning ring is a calm dashed outline and the landing ring still contracts — reject anything unexpected.

- [ ] **Step 3: Manual high-BPM sanity check**

Run: `pnpm run dev`, load a progression, raise the tempo to a high BPM, and play. Confirm: at chord onset the next chord's guide tone(s) show a static dashed ring + `3`/`b7` label; at the change the ring goes solid and contracts onto the beat; no leftover glow.

- [ ] **Step 4: Commit the snapshots**

```bash
git add e2e/
git commit -m "test(fretboard): refresh visual snapshots for two-phase guide ring"
```

---

## Self-Review Notes

- **Spec coverage:** planning runway (Tasks 1–2), 2-bar cap (Task 1), `guide-preview` role + plumbing (Task 3), label in both phases (Task 4, via `guideTargetLabel`), dashed-static → solid-contracting ring (Tasks 4–5), gentle landing keyframe (Task 5), glow removal (Task 6), reduced-motion survival via dashed-vs-solid (Task 5), edge cases — fast tempo no-room + long-chord cap (Task 1 tests), boundary gap (Task 2 test), last-step/power-chord (covered by existing empty guide-tone atoms; no new code), tests + visual regression (all tasks + Task 7).
- **No new colors/shapes:** the preview ring reuses `--note-incoming`; only the stroke/dash/motion channel is added.
- **Mutual exclusivity** of planning vs landing is enforced in both `isInPlanningWindow` (window math) and `planningWindowActiveAtom` (guards), and asserted in Task 2.
- **Cache stale-guard:** `renderedNoteSignature` keeps `transitionRole` + `guideTargetLabel`, so preview↔landing transitions invalidate the per-note cache after `glowColor` is dropped.
