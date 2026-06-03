# Voice-Leading Motion — Pass 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make voice-leading slides musical, bounded, predictable, and fire once per chord — fixing the three issues found in local testing (every-bar re-trigger for multi-bar chords; whole-fretboard slides; arbitrary pairing).

**Architecture:** Two independent changes on the existing `claude/voice-leading-motion` branch. (1) `computeVoiceLeadingMoves` gains a fret/string distance cap, keeps the *shortest* moves, and caps to 3. (2) `leadInActiveAtom` derives step-relative progress from the existing per-step `progressionStepDeadlineAtom` (instead of the per-bar `frame.localFraction`), so the lead-in opens once per chord. No change to the audio scheduler, `timeline.ts`, or the playhead.

**Tech Stack:** React 19 + TypeScript, Jotai, Vitest, pnpm. Work from `/Users/isaaccocar/repos/fretboard-app/.claude/worktrees/voice-leading-motion` (deps installed).

**Spec:** `docs/superpowers/specs/2026-06-02-voice-leading-motion-pass2-design.md`

---

## File Structure

- **Modify** `src/components/FretboardSVG/utils/voiceLeading.ts` — add fret/string-span constants, change `MAX_VOICE_LEADING_MOVES` 4→3, add the cap to the pairing loop, flip the count-cap to keep shortest.
- **Modify** `src/components/FretboardSVG/utils/voiceLeading.test.ts` — flip the cap test, add cap-distance tests, assert new constants.
- **Modify** `src/store/practiceLensAtoms.ts` — add a pure `stepRelativeFraction` helper; rewire `leadInActiveAtom` to use it.
- **Modify** `src/store/practiceLensAtoms.test.ts` — add `stepRelativeFraction` tests + a multi-bar "fires once" test + single-bar regression; migrate the existing `leadInActiveAtom` / perf-budget tests from `frame.localFraction` to the deadline.

---

### Task 1: Bounded nearest-neighbor pairing

**Files:**
- Modify: `src/components/FretboardSVG/utils/voiceLeading.ts`
- Test: `src/components/FretboardSVG/utils/voiceLeading.test.ts`

- [ ] **Step 1: Update the tests (TDD — write the new expectations first)**

In `src/components/FretboardSVG/utils/voiceLeading.test.ts`:

(a) Update the import to include the two new constants:

```ts
import {
  computeVoiceLeadingMoves,
  MAX_VOICE_LEADING_MOVES,
  MIN_VOICE_LEADING_TRAVEL_PX,
  MAX_VOICE_LEADING_FRET_SPAN,
  MAX_VOICE_LEADING_STRING_SPAN,
  type VoiceLeadingNote,
} from "./voiceLeading";
```

(b) **Replace** the existing test `"caps at MAX_VOICE_LEADING_MOVES, keeping the longest travels, and logs the drop"` (the whole `it(...)` block) with this keep-shortest version:

```ts
  it("caps at MAX_VOICE_LEADING_MOVES, keeping the SHORTEST travels, and logs the drop", () => {
    expect(MAX_VOICE_LEADING_MOVES).toBe(3);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const notes: VoiceLeadingNote[] = [];
    // 5 same-fret/adjacent-string pairs (all within the span cap) with increasing
    // pixel travel (20,40,60,80,100). Keep-shortest must keep targets 0-1..0-3.
    for (let i = 1; i <= 5; i++) {
      notes.push(note({ stringIndex: 0, fretIndex: i, cx: i * 10, cy: 0, transitionRole: "incoming" }));
      notes.push(note({ stringIndex: 1, fretIndex: i, cx: i * 10 + i * 20, cy: 0, transitionRole: "departing" }));
    }
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(MAX_VOICE_LEADING_MOVES);
    const kept = moves.map((m) => m.targetKey);
    expect(kept).toContain("0-1");      // shortest travel (20) kept
    expect(kept).not.toContain("0-5");  // longest travel (100) dropped
    expect(kept).not.toContain("0-4");  // second-longest (80) dropped
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][0]).toContain("dropped 2");
  });
```

(c) **Append** these new tests inside the `describe("computeVoiceLeadingMoves", ...)` block:

```ts
  it("exposes the span caps", () => {
    expect(MAX_VOICE_LEADING_FRET_SPAN).toBe(3);
    expect(MAX_VOICE_LEADING_STRING_SPAN).toBe(2);
  });

  it("drops a pairing when the source is beyond the fret span (no cross-board slide)", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 2, cx: 20, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 0, fretIndex: 12, cx: 120, cy: 0, transitionRole: "departing" }), // Δfret 10 > 3
    ];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("drops a pairing when the source is beyond the string span", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 5, fretIndex: 5, cx: 100, cy: 100, transitionRole: "departing" }), // Δstring 5 > 2
    ];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("pairs an in-span source even when a nearer-by-pixels source is out of span", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      // in-span (Δfret 1, Δstring 1), dist 12
      note({ stringIndex: 1, fretIndex: 6, cx: 112, cy: 0, transitionRole: "departing" }),
      // out-of-span (Δfret 6 > 3) even though only 10px away — must be ignored
      note({ stringIndex: 0, fretIndex: 11, cx: 110, cy: 0, transitionRole: "held" }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(1);
    expect(moves[0].sourceKey).toBe("1-6");
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/voiceLeading.test.ts`
Expected: FAIL — `MAX_VOICE_LEADING_FRET_SPAN`/`MAX_VOICE_LEADING_STRING_SPAN` are undefined; `MAX_VOICE_LEADING_MOVES` is 4 not 3; cap/keep-shortest assertions fail.

- [ ] **Step 3: Update the constants** in `src/components/FretboardSVG/utils/voiceLeading.ts`

Replace:

```ts
/** Most simultaneous move cues shown in one transition (keeps it legible). */
export const MAX_VOICE_LEADING_MOVES = 4;
/** Minimum source→target distance (SVG user units) for a cue; below this the
 *  ghost just fades in place — no visible slide, so don't add jitter. */
export const MIN_VOICE_LEADING_TRAVEL_PX = 8;
```

with:

```ts
/** Most simultaneous move cues shown in one transition (keeps it legible). */
export const MAX_VOICE_LEADING_MOVES = 3;
/** Minimum source→target distance (SVG user units) for a cue; below this the
 *  ghost just fades in place — no visible slide, so don't add jitter. */
export const MIN_VOICE_LEADING_TRAVEL_PX = 8;
/** A voice-leading move stays within a hand position: at most this many frets… */
export const MAX_VOICE_LEADING_FRET_SPAN = 3;
/** …and at most this many strings away. Beyond EITHER, no slide — the incoming
 *  note just fades in place (prevents cross-fretboard jumps). */
export const MAX_VOICE_LEADING_STRING_SPAN = 2;
```

- [ ] **Step 4: Add the span cap to the pairing loop and flip the count-cap to shortest**

In `computeVoiceLeadingMoves`, replace the inner source loop and the `if (!best) break;` line:

```ts
    for (const source of sources) {
      if (usedSourceKeys.has(keyOf(source))) continue;
      const d = Math.hypot(source.cx - target.cx, source.cy - target.cy);
      if (d < bestDist) {
        bestDist = d;
        best = source;
      }
    }
    if (!best) break;
```

with (adds the span gate; `break` → `continue` so a target with no in-span source doesn't abort the others):

```ts
    for (const source of sources) {
      if (usedSourceKeys.has(keyOf(source))) continue;
      // A voice-leading move stays within a hand position — skip any source
      // beyond the fret/string span so nothing slides across the neck.
      if (Math.abs(source.fretIndex - target.fretIndex) > MAX_VOICE_LEADING_FRET_SPAN) continue;
      if (Math.abs(source.stringIndex - target.stringIndex) > MAX_VOICE_LEADING_STRING_SPAN) continue;
      const d = Math.hypot(source.cx - target.cx, source.cy - target.cy);
      if (d < bestDist) {
        bestDist = d;
        best = source;
      }
    }
    if (!best) continue;
```

Then replace the count-cap block:

```ts
  const kept = [...candidates]
    .sort((a, b) => b.dist - a.dist)
    .slice(0, MAX_VOICE_LEADING_MOVES);
```

with (keep the SHORTEST):

```ts
  const kept = [...candidates]
    .sort((a, b) => a.dist - b.dist)
    .slice(0, MAX_VOICE_LEADING_MOVES);
```

- [ ] **Step 5: Update the doc comment** on `computeVoiceLeadingMoves`

Replace `caps at {@link MAX_VOICE_LEADING_MOVES} keeping the longest travels` with `keeps only moves within the fret/string span, caps at {@link MAX_VOICE_LEADING_MOVES} keeping the SHORTEST travels`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/voiceLeading.test.ts`
Expected: PASS (all, including the existing nearest/threshold/region tests which remain valid under the span cap).

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm exec tsc -b` (expect clean)

```bash
git add src/components/FretboardSVG/utils/voiceLeading.ts src/components/FretboardSVG/utils/voiceLeading.test.ts
git commit -m "fix(fretboard): bound voice-leading slides to nearby moves, keep shortest"
```

---

### Task 2: Step-relative lead-in (fire once per chord)

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (add `stepRelativeFraction`; rewire `leadInActiveAtom`)
- Test: `src/store/practiceLensAtoms.test.ts`

**Context:** `leadInActiveAtom` currently calls `isInLeadInWindow(frame.localFraction, …)`. `frame.localFraction` is fraction-through-the-current-**bar** (the timeline calls `setActiveStep` once per bar with a one-bar duration), so a multi-bar chord re-opens the window every bar. The fix swaps the fraction source to step-relative progress derived from `progressionStepDeadlineAtom` (already set per step to `Date.now() + stepDurationMs`), mirroring how `beatPositionAtom` reads the deadline. `progressionStepDeadlineAtom` is already imported in this file.

- [ ] **Step 1: Write the failing tests**

In `src/store/practiceLensAtoms.test.ts`:

(a) Add `stepRelativeFraction` to the import from `"./practiceLensAtoms"` (line 11 — append it to the existing destructured list).

(b) **Append** a new pure-function describe block at the end of the file:

```ts
describe("stepRelativeFraction", () => {
  it("returns 0 when there is no deadline", () => {
    expect(stepRelativeFraction(null, 1000, 2000)).toBe(0);
  });
  it("returns 0 for a non-positive step duration", () => {
    expect(stepRelativeFraction(3000, 1000, 0)).toBe(0);
  });
  it("is ~0 at the start of the step (full duration remaining)", () => {
    // deadline = now + stepDuration → elapsed 0
    expect(stepRelativeFraction(1000 + 2000, 1000, 2000)).toBeCloseTo(0, 5);
  });
  it("is 0.5 halfway through the step", () => {
    // 1000ms remaining of a 2000ms step → elapsed 1000 → 0.5
    expect(stepRelativeFraction(1000 + 1000, 1000, 2000)).toBeCloseTo(0.5, 5);
  });
  it("clamps to [0,1] past the deadline", () => {
    expect(stepRelativeFraction(500, 1000, 2000)).toBe(1); // deadline already passed
  });
});
```

(c) **Append** a multi-bar regression block (the core issue-1 fix) — drives the lead-in via the deadline, mirroring the `beatPositionAtom` tests:

```ts
describe("leadInActiveAtom — fires once per chord (multi-bar)", () => {
  beforeEach(() => { localStorage.clear(); });

  function makeMultiBarStore() {
    const store = createStore();
    const unsub = store.sub(progressionStepsAtom, () => {});
    unsub();
    // Active step is a 4-bar chord.
    store.set(progressionStepsAtom, [
      { id: "long", degree: "I", duration: { value: 4, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(progressionPlayingStateAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 0);
    // Frame present, displayed == audio step, not paused (the per-frame ticker).
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false });
    return store;
  }

  it("is FALSE during an earlier bar of a multi-bar chord", () => {
    const store = makeMultiBarStore();
    const barMs = store.get(progressionBarDurationMsAtom);
    // 2.5 bars remaining of a ~4-bar chord → well before the final-bar window.
    store.set(progressionStepDeadlineAtom, Date.now() + 2.5 * barMs);
    expect(store.get(leadInActiveAtom)).toBe(false);
  });

  it("is TRUE only in the final bar of a multi-bar chord", () => {
    const store = makeMultiBarStore();
    const barMs = store.get(progressionBarDurationMsAtom);
    // 0.5 bar remaining → inside the (1-bar-capped) lead-in window.
    store.set(progressionStepDeadlineAtom, Date.now() + 0.5 * barMs);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });
});
```

(d) **Replace** the existing `leadInActiveAtom` test `"flips true once the playhead crosses the window start"` (lines ~886-902) with a deadline-driven version:

```ts
  it("flips true once the playhead crosses the window start", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 0);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false });
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));
    // Before the window: more than windowMs remaining.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 300);
    expect(store.get(leadInActiveAtom)).toBe(false);
    // Inside the window: less than windowMs remaining.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 300);
    expect(store.get(leadInActiveAtom)).toBe(true);
  });
```

(e) **Replace** the `"turns false once the displayed step catches up to the audio step"` test (lines ~920-927) to set a far deadline so it stays meaningful:

```ts
  it("turns false once the displayed step catches up to the audio step", () => {
    const store = makeDefaultStore();
    store.set(progressionPlayingStateAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    store.set(progressionVisualFrameAtom, { stepIndex: 1, globalFraction: 0, localFraction: 0.05, paused: false });
    // Early in the new step: a full step's worth of time remaining.
    store.set(progressionStepDeadlineAtom, Date.now() + store.get(progressionStepDurationMsAtom));
    expect(store.get(leadInActiveAtom)).toBe(false);
  });
```

(f) **Replace** the two `"transition perf budget"` tests (lines ~775-808 and ~810-831) to drive the phase via the deadline rather than `frame.localFraction`:

```ts
  it("frame writes within a phase do not notify the note-driving atoms", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));
    // Comfortably BEFORE the window and staying there for the whole (sub-ms) test.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 5000);
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false });
    store.get(leadInActiveAtom);
    store.get(incomingTonesAtom);

    let leadInNotifs = 0;
    let incomingNotifs = 0;
    const u1 = store.sub(leadInActiveAtom, () => { leadInNotifs++; });
    const u2 = store.sub(incomingTonesAtom, () => { incomingNotifs++; });

    // Advance the frame several times (the per-frame ticker) — the lead-in
    // boolean is deadline-driven and stays false, so no note re-render.
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.11, localFraction: 0.11, paused: false });
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.12, localFraction: 0.12, paused: false });
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.13, localFraction: 0.13, paused: false });

    expect(leadInNotifs).toBe(0);
    expect(incomingNotifs).toBe(0);
    u1(); u2();
  });

  it("crossing the lead-in threshold notifies leadInActiveAtom exactly once", () => {
    const store = makePlayingStore();
    store.set(displayedStepIndexPrimitiveAtom, 0);
    const stepMs = store.get(progressionStepDurationMsAtom);
    const windowMs = computeLeadInWindowMs(stepMs, store.get(progressionBarDurationMsAtom));
    store.set(progressionVisualFrameAtom, { stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false });
    // Start before the window.
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs + 300);
    store.get(leadInActiveAtom);

    let notifs = 0;
    const u = store.sub(leadInActiveAtom, () => { notifs++; });

    // Move the deadline inside the window (one change → boolean flips once).
    store.set(progressionStepDeadlineAtom, Date.now() + windowMs - 300);
    expect(notifs).toBe(1);
    expect(store.get(leadInActiveAtom)).toBe(true);
    u();
  });
```

Note: `makePlayingStore` (in the perf-budget block) and `makeDefaultStore` (in the leadInActiveAtom block) already exist — reuse them; do not redefine. They already seed a playing two-step progression / default store.

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts`
Expected: FAIL — `stepRelativeFraction` is not exported; the multi-bar/threshold tests fail because `leadInActiveAtom` still reads `frame.localFraction`.

- [ ] **Step 3: Add the pure helper** in `src/store/practiceLensAtoms.ts`

Immediately after `isInLeadInWindow` (after its closing `}` near line 157), add:

```ts
/**
 * Fraction [0,1] of the active STEP elapsed, derived from the per-step deadline
 * (`Date.now() + stepDurationMs`, set on each step advance) rather than the
 * visual frame's `localFraction` — which the timeline resets every BAR, so a
 * multi-bar chord would otherwise re-open the lead-in each bar. Pure: pass an
 * explicit `nowMs` so it is unit-testable. Returns 0 when there is no deadline
 * or a non-positive duration ("not started" → no lead-in).
 */
export function stepRelativeFraction(
  deadlineMs: number | null,
  nowMs: number,
  stepDurationMs: number,
): number {
  if (deadlineMs == null || stepDurationMs <= 0) return 0;
  const elapsed = stepDurationMs - (deadlineMs - nowMs);
  return Math.min(1, Math.max(0, elapsed / stepDurationMs));
}
```

- [ ] **Step 4: Rewire `leadInActiveAtom`** (replace its body)

Replace:

```ts
  return isInLeadInWindow(
    frame.localFraction,
    get(progressionStepDurationMsAtom),
    get(progressionBarDurationMsAtom),
  );
});
```

with:

```ts
  // Step-relative progress, NOT frame.localFraction (which the timeline resets
  // each bar — a multi-bar chord would re-open the window every bar). Reading
  // `frame` above keeps this recomputing per frame; Date.now() is the live
  // clock (same pattern as beatPositionAtom).
  const stepMs = get(progressionStepDurationMsAtom);
  const stepFraction = stepRelativeFraction(
    get(progressionStepDeadlineAtom),
    Date.now(),
    stepMs,
  );
  return isInLeadInWindow(stepFraction, stepMs, get(progressionBarDurationMsAtom));
});
```

Verify `progressionStepDeadlineAtom` is imported at the top of the file (it is — `beatPositionAtom` uses it). If not, add it to the existing `./progressionAtoms` import.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/practiceLensAtoms.test.ts`
Expected: PASS (new helper tests, multi-bar tests, migrated threshold/perf-budget tests, and the unchanged not-playing/paused/boundary-gap tests).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm exec tsc -b` (expect clean)

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "fix(progression): lead-in fires once per chord (step-relative, not per-bar)"
```

---

### Task 3: Full gates + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `pnpm run test`
Expected: all pass.

- [ ] **Step 2: Lint + typecheck + build**

Run: `pnpm run lint` (expect 0 errors; the pre-existing `useFretboardTopologyModel.ts` exhaustive-deps warning is acceptable)
Run: `pnpm exec tsc -b` (expect clean)
Run: `pnpm run build` (expect success)

- [ ] **Step 3: Push (updates PR #512)**

```bash
git push
```

- [ ] **Step 4: Manual verification checklist (user-run, in `pnpm run dev`)**

Not automatable (animation + audio). Confirm:
- A multi-bar chord slides **once**, in its final bar — not every bar.
- No note slides across the neck; slides are short (≤ ~3 frets / 2 strings).
- Which notes slide is predictable (a note slides iff a near departing/held tone exists); at most 3 at once.
- Single-bar chords behave as before.

---

## Self-Review

**Spec coverage:**
- "Fire once per chord (step-relative lead-in), atom layer only" → Task 2 (`stepRelativeFraction` + `leadInActiveAtom` rewire; no scheduler/timeline/playhead change). ✅
- "Hard fret/string distance cap" → Task 1 Step 4 (span gate). ✅
- "Nearest within cap, one source per target" → preserved loop + span gate. ✅
- "Keep shortest, cap to 3" → Task 1 Steps 3–4 (`MAX_VOICE_LEADING_MOVES = 3`, sort ascending). ✅
- "Min-travel threshold unchanged" → `MIN_VOICE_LEADING_TRAVEL_PX` untouched. ✅
- Constants `MAX_VOICE_LEADING_FRET_SPAN=3`, `MAX_VOICE_LEADING_STRING_SPAN=2` → Task 1 Step 3. ✅
- Testing (pairing cap/keep-shortest; step-relative pure fn; multi-bar once; single-bar regression; migrate old tests) → Tasks 1 & 2. ✅
- "No audio infra change" → Task 2 touches only `practiceLensAtoms.ts`. ✅

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `stepRelativeFraction(deadlineMs: number|null, nowMs: number, stepDurationMs: number): number` is defined in Task 2 Step 3 and used identically in tests (Step 1b) and the atom (Step 4). New constants `MAX_VOICE_LEADING_FRET_SPAN` / `MAX_VOICE_LEADING_STRING_SPAN` are defined (Task 1 Step 3), consumed in the loop (Step 4), and asserted in tests (Step 1c) with matching names. `MAX_VOICE_LEADING_MOVES` is 3 consistently across impl and tests.
