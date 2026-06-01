# Phrase-Aware Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `buildAllLayersAsync` a monotonic absolute-bar index and wire the currently-dead `DrumVariation.barInterval` into real interval+phase gating, with zero audible change for existing genres.

**Architecture:** Add an optional `barPhase` field + a pure `variationFiresOnBar(variation, absoluteBar)` helper to `patterns.ts`. Correct the two unused variation definitions so their labels are truthful. Restructure the drum block in `buildAllLayers.ts` to resolve assigned variations once, track an `absoluteBar` counter across the whole progression, and per bar include only the variations whose interval+phase match. Jitter seeds and base-pattern collection are untouched, preserving byte-identical output.

**Tech Stack:** TypeScript, Vitest. Worktree: `/Users/isaaccocar/repos/fretboard-app.worktrees/slice2-phrase-aware-scheduler` (branch `slice2-phrase-aware-scheduler` off `main`). Spec: `docs/superpowers/specs/2026-05-31-phrase-aware-scheduler-design.md`.

**Run all commands from the worktree root:** `/Users/isaaccocar/repos/fretboard-app.worktrees/slice2-phrase-aware-scheduler`

---

### Task 1: `barPhase` field + `variationFiresOnBar` helper

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (DrumVariation interface ~76-81; add helper near `getDrumVariation` ~474-476)
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/patterns.test.ts`. First ensure `variationFiresOnBar` and the `DrumVariation` type are in the import from `./patterns` (add them to the existing import). Then append this describe block:

```ts
describe("variationFiresOnBar", () => {
  const v = (barInterval: number, barPhase?: number): DrumVariation => ({
    id: "t",
    label: "t",
    barInterval,
    barPhase,
    pattern: { id: "p", label: "p", kicks: [], snares: [], hats: [] },
  });

  it("fires every bar at interval 1, phase 0", () => {
    for (let b = 0; b < 8; b++) expect(variationFiresOnBar(v(1, 0), b)).toBe(true);
  });

  it("fires on the turnaround (interval 4, phase 3): bars 3 and 7", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((b) => variationFiresOnBar(v(4, 3), b)))
      .toEqual([false, false, false, true, false, false, false, true]);
  });

  it("fires on phrase start (interval 4, phase 0): bars 0 and 4", () => {
    expect([0, 1, 2, 3, 4].map((b) => variationFiresOnBar(v(4, 0), b)))
      .toEqual([true, false, false, false, true]);
  });

  it("defaults barPhase to 0 when omitted", () => {
    expect(variationFiresOnBar(v(2), 0)).toBe(true);
    expect(variationFiresOnBar(v(2), 1)).toBe(false);
    expect(variationFiresOnBar(v(2), 2)).toBe(true);
  });

  it("never fires for a non-positive interval (total/guarded)", () => {
    expect(variationFiresOnBar(v(0, 0), 0)).toBe(false);
    expect(variationFiresOnBar(v(-4, 0), 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "variationFiresOnBar"`
Expected: FAIL — `variationFiresOnBar` is not exported (and/or `barPhase` not assignable on `DrumVariation`).

- [ ] **Step 3: Add the `barPhase` field**

In `src/progressions/audio/patterns.ts`, change the `DrumVariation` interface (currently lines ~76-81):

```ts
export interface DrumVariation {
  id: string;
  label: string;
  barInterval: number;
  /** Which bar of the `barInterval` cycle this fires on (default 0). A
   *  variation fires on absolute bar N when N % barInterval === (barPhase ?? 0). */
  barPhase?: number;
  pattern: CatalogDrumPattern;
}
```

- [ ] **Step 4: Add the helper**

In `src/progressions/audio/patterns.ts`, add immediately after the `getDrumVariation` function (~line 476):

```ts
/**
 * Pure gating predicate: does `variation` fire on the given absolute bar index?
 * Total — a non-positive `barInterval` never fires (no divide-by-zero / nonsense).
 */
export function variationFiresOnBar(
  variation: DrumVariation,
  absoluteBar: number,
): boolean {
  if (variation.barInterval <= 0) return false;
  return absoluteBar % variation.barInterval === (variation.barPhase ?? 0);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "variationFiresOnBar"`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): add barPhase + variationFiresOnBar gating predicate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Correct the two unused variation definitions

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (`fill-every-4` ~418-433; `crash-bar-1` ~447-459)
- Test: `src/progressions/audio/patterns.test.ts`
- Modify: `src/progressions/audio/genres.test.ts` (stale test name ~71)

Neither `fill-every-4` nor `crash-bar-1` is assigned to any genre, so these definition edits change no audible output; they make the labels truthful and give real fixtures.

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/audio/patterns.test.ts`. Ensure `DRUM_VARIATIONS` is in the `./patterns` import. Then:

```ts
describe("DRUM_VARIATIONS definitions are truthful", () => {
  const byId = (id: string) => {
    const found = DRUM_VARIATIONS.find((v) => v.id === id);
    if (!found) throw new Error(`missing variation ${id}`);
    return found;
  };

  it("fill-every-4 lands on the 4th bar (turnaround), not the 1st", () => {
    const fill = byId("fill-every-4");
    expect(fill.barInterval).toBe(4);
    expect(variationFiresOnBar(fill, 0)).toBe(false);
    expect(variationFiresOnBar(fill, 3)).toBe(true);
    expect(variationFiresOnBar(fill, 7)).toBe(true);
  });

  it("crash-bar-1 lands on the 1st bar of each 4-bar group", () => {
    const crash = byId("crash-bar-1");
    expect(crash.barInterval).toBe(4);
    expect(variationFiresOnBar(crash, 0)).toBe(true);
    expect(variationFiresOnBar(crash, 1)).toBe(false);
    expect(variationFiresOnBar(crash, 4)).toBe(true);
  });

  it("open-hat-and-of-4 still fires every bar (unchanged)", () => {
    const oh = byId("open-hat-and-of-4");
    expect(oh.barInterval).toBe(1);
    expect([0, 1, 2, 3].every((b) => variationFiresOnBar(oh, b))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "truthful"`
Expected: FAIL — `fill-every-4` currently fires on bar 0 (phase defaults to 0) and `crash-bar-1` has `barInterval: 1`.

- [ ] **Step 3: Correct the definitions**

In `src/progressions/audio/patterns.ts`, in the `fill-every-4` object add `barPhase: 3` right after its `barInterval: 4` line:

```ts
    id: "fill-every-4",
    label: "Fill Every 4 Bars",
    barInterval: 4,
    barPhase: 3, // turnaround: fires on the 4th bar of each 4-bar group
```

In the `crash-bar-1` object, change `barInterval: 1` to:

```ts
    id: "crash-bar-1",
    label: "Crash on Bar 1",
    barInterval: 4,
    barPhase: 0, // fires on the 1st bar of each 4-bar group
```

(`open-hat-and-of-4` stays `barInterval: 1`, no `barPhase`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "truthful"`
Expected: PASS (3 tests).

- [ ] **Step 5: Refresh the stale genres.test.ts rationale**

The test at `src/progressions/audio/genres.test.ts:71` is named `"does NOT assign fill-every-4 to any genre (barInterval not yet honored)"`. Its assertion stays valid (genre default sets are deferred), but the parenthetical is now false. Replace the `it(...)` title only — leave the body unchanged:

```ts
  it("does NOT assign fill-every-4 to any genre (genre default sets deferred)", () => {
```

- [ ] **Step 6: Run the genres suite to confirm still green**

Run: `pnpm exec vitest run src/progressions/audio/genres.test.ts`
Expected: PASS (unchanged assertions).

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts src/progressions/audio/genres.test.ts
git commit -m "feat(progressions): make fill-every-4/crash-bar-1 defs match their labels

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Absolute-bar index + per-bar variation gating in the scheduler

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (imports ~8-17; variation prep ~144-150; pre-loop state ~158-160; per-step setup ~170-208; drum block ~289-305)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

The test file mocks `applyJitter` to a pass-through (see its top), so drum-event times are exact. At `tempoBpm: 60, beatsPerBar: 4`: 1 beat = 1s, 1 bar = 4s. Bars start at 0, 4, 8, 12s.

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/audio/buildAllLayers.test.ts`, inside the existing top-level `describe("buildAllLayers", ...)` block (so `step` and `baseInput` are in scope). Use a 4-bar progression built from two 2-bar steps to prove the index crosses step boundaries:

```ts
  describe("drum variation gating (absolute bar)", () => {
    // Two 2-bar steps = 4 absolute bars (0..3). At 60bpm each bar is 4s.
    const fourBarSteps = [
      step({ id: "a", duration: { value: 2, unit: "bar" } }),
      step({ id: "b", index: 1, root: "G", duration: { value: 2, unit: "bar" } }),
    ];

    it("fires fill-every-4 only on the 4th absolute bar (turnaround), not every bar", async () => {
      const base = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      const withFill = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["fill-every-4"] });

      const snares = (b: typeof base) => b.drums.filter((d) => d.value.type === "snare");
      // The fill adds its 4-snare flurry exactly ONCE (one firing bar), not 4×.
      expect(snares(withFill).length - snares(base).length).toBe(4);

      // …and those 4 extra snares all land inside bar 3 (absolute), i.e. [12,16)s.
      const inBar3 = (b: typeof base) => snares(b).filter((d) => d.time >= 12 && d.time < 16).length;
      expect(inBar3(withFill) - inBar3(base)).toBe(4);
      // Nothing added in bars 0..2 ([0,12)s).
      const before = (b: typeof base) => snares(b).filter((d) => d.time < 12).length;
      expect(before(withFill)).toBe(before(base));
    });

    it("keeps open-hat-and-of-4 firing every bar (backwards-compatible)", async () => {
      const base = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      const withOpenHat = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["open-hat-and-of-4"] });
      const openHats = (b: typeof base) => b.drums.filter((d) => d.value.type === "openHat").length;
      // interval 1 → one open-hat per bar across all 4 bars.
      expect(openHats(withOpenHat) - openHats(base)).toBe(4);
    });

    it("adds nothing when no variations are assigned (no-op)", async () => {
      const a = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      const b = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: [] });
      expect(a.drums).toEqual(b.drums);
    });

    it("is deterministic for the same input", async () => {
      const a = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["fill-every-4"] });
      const b = await buildAllLayersAsync({ ...baseInput, steps: fourBarSteps, drumVariations: ["fill-every-4"] });
      expect(a.drums).toEqual(b.drums);
    });

    it("counts an unavailable bar toward the absolute index (turnaround stays aligned)", async () => {
      // [2-bar C][1-bar unavailable][1-bar G] → absolute bars 0,1,(2 rest),3.
      // fill-every-4 (phase 3) must fire on absolute bar 3 = the final G bar (12..16s).
      const steps = [
        step({ id: "a", duration: { value: 2, unit: "bar" } }),
        step({ id: "r", index: 1, unavailable: true, root: null, quality: null, duration: { value: 1, unit: "bar" } }),
        step({ id: "g", index: 2, root: "G", duration: { value: 1, unit: "bar" } }),
      ];
      const base = await buildAllLayersAsync({ ...baseInput, steps, drumVariations: [] });
      const withFill = await buildAllLayersAsync({ ...baseInput, steps, drumVariations: ["fill-every-4"] });
      const snares = (b: typeof base) => b.drums.filter((d) => d.value.type === "snare");
      const inBar3 = (b: typeof base) => snares(b).filter((d) => d.time >= 12 && d.time < 16).length;
      expect(snares(withFill).length - snares(base).length).toBe(4);
      expect(inBar3(withFill) - inBar3(base)).toBe(4);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "drum variation gating"`
Expected: FAIL — today variations fire on every bar, so `fill-every-4` adds 16 snares (4 bars × 4), not 4; the turnaround-alignment tests fail too.

- [ ] **Step 3: Import the type + helper**

In `src/progressions/audio/buildAllLayers.ts`, extend the existing `./patterns` import (lines ~8-17) to add `getDrumVariation` is already present; add `variationFiresOnBar` and the `DrumVariation` type:

```ts
import {
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  variationFiresOnBar,
  repeatPatternToBeats,
  type CatalogDrumPattern,
  type DrumHit,
  type DrumVariation,
  type BassArticulation,
} from "./patterns";
```

- [ ] **Step 4: Resolve variations once (replace the pre-flattening)**

Replace the current variation prep + `drumHits` merge (lines ~144-150):

```ts
  const variationHits: VoicedDrumHit[] = input.drumVariations
    .map((id) => getDrumVariation(id)?.pattern)
    .filter((p): p is CatalogDrumPattern => Boolean(p))
    .flatMap((p) => collectDrumHits(p));
  const drumHits: VoicedDrumHit[] = drumPattern
    ? [...collectDrumHits(drumPattern), ...variationHits]
    : variationHits;
```

with:

```ts
  // Base drum pattern hits apply every bar; variations are gated per bar below.
  const baseDrumHits: VoicedDrumHit[] = drumPattern ? collectDrumHits(drumPattern) : [];
  const variations: DrumVariation[] = input.drumVariations
    .map((id) => getDrumVariation(id))
    .filter((v): v is DrumVariation => Boolean(v));
```

- [ ] **Step 5: Add the absolute-bar counter**

In the pre-loop state block (after `let lastBassNote ...`, ~line 160), add:

```ts
  let absoluteBar = 0;
```

- [ ] **Step 6: Move `barsInStep` above the unavailable guard and advance the counter for rests**

Currently `isBarUnit`/`barsInStep` are computed at ~line 202-205 (after the unavailable `continue`). Move the `isBarUnit` + `barsInStep` declarations to just after `stepDurationSec` is computed (~line 173), BEFORE the unavailable check, and delete them from their old location. Then update the unavailable guard (~line 175-178) to advance `absoluteBar`:

```ts
    const isBarUnit = step.duration.unit === "bar";
    const barsInStep = isBarUnit
      ? Math.max(1, Math.floor(step.duration.value))
      : 1;

    if (step.unavailable || step.root === null || step.quality === null) {
      cumulativeSec += stepDurationSec;
      absoluteBar += barsInStep; // a rest bar still occupies its phrase slot
      continue;
    }
```

At the old declaration site (~line 202-205) leave only `eventBeats`/`eventSec`:

```ts
    const eventBeats = isBarUnit ? input.beatsPerBar : stepBeats;
    const eventSec = eventBeats * secondsPerBeat;
```

- [ ] **Step 7: Gate variations inside the bar loop and increment the counter**

Replace the drum block (currently `if (drumHits.length > 0) { ... }`, ~lines 289-305) with the gated version, and append `absoluteBar++` as the LAST statement of the `for (let bar ...)` body:

```ts
      const firingVariationHits: VoicedDrumHit[] = variations
        .filter((v) => variationFiresOnBar(v, absoluteBar))
        .flatMap((v) => collectDrumHits(v.pattern));
      const drumHitsForBar: VoicedDrumHit[] = [...baseDrumHits, ...firingVariationHits];
      if (drumHitsForBar.length > 0) {
        const hits = repeatPatternToBeats(drumHitsForBar, eventBeats, input.beatsPerBar);
        for (const hit of hits) {
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: stepIndex * 10000 + bar * 100 + hit.beat + 2, // offset for drums
            timeAmountSec: 0.005, // tighter timing jitter for drums
            velocityAmount: 0.05,
          });
          drums.push({
            time: hitTime,
            value: { type: hit.type, velocity },
          });
        }
      }

      absoluteBar++;
```

Note: base-pattern hit order (`baseDrumHits` first) and the jitter seed (per-step `bar`) are unchanged, so genres using `open-hat-and-of-4` (interval 1) stay byte-identical.

- [ ] **Step 8: Run the new tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "drum variation gating"`
Expected: PASS (5 tests).

- [ ] **Step 9: Run the full buildAllLayers + genres + patterns suites**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts src/progressions/audio/genres.test.ts src/progressions/audio/patterns.test.ts`
Expected: PASS (no regressions; the pre-existing `buildAllLayers` tests still green).

- [ ] **Step 10: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): gate drum variations by absolute-bar interval+phase

Wires the previously-dead DrumVariation.barInterval into real per-bar gating
via a monotonic absolute-bar index. Existing genres (open-hat interval 1) stay
byte-identical; unavailable bars still advance the phrase index.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + full test suite + build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all green. (`tsc -b` exit 0 is ground truth — ignore stale IDE diagnostics.)

- [ ] **Step 2: Push the branch**

```bash
git push -u origin slice2-phrase-aware-scheduler
```

- [ ] **Step 3: (Optional) open a draft PR**

```bash
gh pr create --draft --base main --head slice2-phrase-aware-scheduler \
  --title "feat(progressions): phrase-aware scheduler — absolute-bar index + drum variation gating" \
  --body "Implements Slice 2 §3.1 (absolute-bar index) + §3.2 (variation gating mechanism). phraseLengthBars param and genre default variation sets deferred. Mechanism-only: byte-identical output for existing genres. Spec: docs/superpowers/specs/2026-05-31-phrase-aware-scheduler-design.md"
```

---

## Self-Review Notes

- **Spec coverage:** §3.1 absolute-bar index → Task 3 (counter + unavailable-bar advance). §3.2 gating mechanism → Tasks 1-3 (helper, corrected defs, scheduler wiring). §6 tests → truth table (T1), absolute-index-across-steps + no-op + determinism + unavailable-alignment (T3), backwards-compat (T3 open-hat). Deferred items (`phraseLengthBars`, genre defaults, §3.3-3.5) explicitly out of scope.
- **Type consistency:** `variationFiresOnBar(variation, absoluteBar)`, `barPhase?`, `baseDrumHits`, `variations`, `firingVariationHits`, `drumHitsForBar`, `absoluteBar` are used identically across Tasks 1-3.
- **No placeholders:** every code/test block is complete and copy-pasteable.
