# Backing Track Variation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the monotony of static 1–2 bar backing-track loops by adding chord/bass structural variations (genre-coupled turnaround fills) and extending the existing per-hit humanizer with groove-lock and probabilistic ghost-dropping.

**Architecture:** Three independent tiers built on existing infrastructure. (A) The **Safe Humanizer** extends `humanize.ts` with two pure helpers (`shouldDropHit`, `grooveLockTimeAmount`) wired into the three humanized layers in `buildAllLayers.ts`. (B) **Variation Events** mirror the existing `DrumVariation` model with `ChordVariation`/`BassVariation` (substitutive, not additive), plumbed through `BuildAllLayersInput` → playback hook → Jotai atoms → `GenreStyle` (the coupling guarantee). (C) **Extended base patterns** are catalog-only and already supported by `sliceCellToBar`. Each phase ships independently.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Jotai (`atomWithStorage`), Tone.js playback. Package manager **pnpm**.

**Source spec:** [docs/superpowers/specs/2026-06-08-backing-track-variation-design.md](../specs/2026-06-08-backing-track-variation-design.md)

**Resolved design decisions (from spec):**
- Loop variety: **per-bar only** (build-once-replay retained; no per-pass seed).
- Groove lock: integer beats get **~40%** timing jitter; off-beats full. Velocity jitter unaffected.
- Ghost drop: velocity **< 0.4 → flat ~12%** drop; **≥ 0.4 → never**.
- Chord/bass variations are **substitutive** (replace the bar's base hits); drums stay **additive** (unchanged). At most one substitutive variation per bar — **first in catalog order wins**.
- Humanizer **never** touches `metronome` or `chordOnsets`; only `chordStrums`, `bass`, `drums`.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/progressions/audio/humanize.ts` | Pure per-hit jitter + new drop/groove helpers | Add `shouldDropHit`, `grooveLockTimeAmount` |
| `src/progressions/audio/humanize.test.ts` | Humanizer unit tests | Add drop + groove-lock tests |
| `src/progressions/audio/patterns.ts` | Pattern + variation catalogs and getters | Add `ChordVariation`/`BassVariation` types, catalogs, getters |
| `src/progressions/audio/patterns.test.ts` | Catalog + gating tests | Add chord/bass variation tests |
| `src/progressions/audio/buildAllLayers.ts` | Pure layer builder | Wire humanizer helpers; chord/bass variation substitution; new input fields |
| `src/progressions/audio/buildAllLayers.test.ts` | Builder integration tests | Add substitution + humanizer-integration tests; extend `vi.mock` |
| `src/progressions/audio/genres.ts` | Genre bundles (coupling) | Add `chordVariations`/`bassVariations` fields + data |
| `src/progressions/audio/genres.test.ts` | Genre wiring tests | Add coupling tests |
| `src/store/progressionAtoms.ts` | Jotai state | Add two atoms, wire `applyGenreStyleAtom` + reset |
| `src/store/progressionAtoms.test.ts` | Atom tests | Add genre-apply + reset tests |
| `src/hooks/useProgressionAudioPlayback.ts` | Reads atoms → calls builder | Read + thread two new atoms through all call sites + deps |

**Pre-flight (run once before Task 1):**

```bash
cd /Users/isaaccocar/repos/fretboard-app.worktrees/backing-track-variation
pnpm install
pnpm run test -- src/progressions/audio
```
Expected: existing suite passes (green baseline).

---

## PHASE A — Safe Humanizer

### Task 1: `shouldDropHit` predicate

**Files:**
- Modify: `src/progressions/audio/humanize.ts`
- Test: `src/progressions/audio/humanize.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/humanize.test.ts`:

```typescript
import { applyJitter, shouldDropHit } from "./humanize";

describe("shouldDropHit", () => {
  it("never drops hits with velocity >= 0.4", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(shouldDropHit(0.4, seed)).toBe(false);
      expect(shouldDropHit(0.7, seed)).toBe(false);
      expect(shouldDropHit(1, seed)).toBe(false);
    }
  });

  it("drops a small fraction of sub-0.4 ghost hits (~12%)", () => {
    let dropped = 0;
    const N = 2000;
    for (let seed = 0; seed < N; seed++) {
      if (shouldDropHit(0.2, seed)) dropped++;
    }
    const rate = dropped / N;
    expect(rate).toBeGreaterThan(0.07);
    expect(rate).toBeLessThan(0.17);
  });

  it("is deterministic for a fixed velocity + seed", () => {
    expect(shouldDropHit(0.2, 42)).toBe(shouldDropHit(0.2, 42));
    expect(shouldDropHit(0.2, 42)).not.toBe(undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/progressions/audio/humanize.test.ts`
Expected: FAIL — `shouldDropHit is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/progressions/audio/humanize.ts`, after `applyJitter`, add (reuse the existing private `seededRandom`):

```typescript
/** Threshold below which a hit is a droppable "ghost". */
const GHOST_VELOCITY_THRESHOLD = 0.4;
/** Drop probability applied to sub-threshold ghosts. */
const GHOST_DROP_CHANCE = 0.12;
/** Seed offset so the drop roll is independent of the time/velocity rolls. */
const DROP_SEED_OFFSET = 54321;

/**
 * Deterministic, seeded decision: should this hit be dropped entirely to
 * simulate a player occasionally skipping a ghost stroke? Uses the hit's
 * *authored* (pre-jitter) velocity so a ±10% velocity jitter can never flip a
 * borderline ghost across the threshold. Structural hits (>= 0.4) never drop.
 */
export function shouldDropHit(velocity: number, seed: number): boolean {
  if (velocity >= GHOST_VELOCITY_THRESHOLD) return false;
  return seededRandom(seed + DROP_SEED_OFFSET) < GHOST_DROP_CHANCE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/progressions/audio/humanize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/humanize.ts src/progressions/audio/humanize.test.ts
git commit -m "feat(audio): add seeded shouldDropHit ghost-drop predicate"
```

---

### Task 2: `grooveLockTimeAmount` helper

**Files:**
- Modify: `src/progressions/audio/humanize.ts`
- Test: `src/progressions/audio/humanize.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/humanize.test.ts` (extend the import to include `grooveLockTimeAmount`):

```typescript
import { applyJitter, shouldDropHit, grooveLockTimeAmount } from "./humanize";

describe("grooveLockTimeAmount", () => {
  it("reduces jitter on integer (anchor) beats to ~40%", () => {
    expect(grooveLockTimeAmount(0, 0.015)).toBeCloseTo(0.006);
    expect(grooveLockTimeAmount(2, 0.015)).toBeCloseTo(0.006);
    expect(grooveLockTimeAmount(0, 0.005)).toBeCloseTo(0.002);
  });

  it("leaves off-beats at full jitter", () => {
    expect(grooveLockTimeAmount(0.5, 0.015)).toBe(0.015);
    expect(grooveLockTimeAmount(1.75, 0.015)).toBe(0.015);
    expect(grooveLockTimeAmount(2.5, 0.005)).toBe(0.005);
  });

  it("is meter-agnostic (works for any integer beat)", () => {
    expect(grooveLockTimeAmount(5, 0.015)).toBeCloseTo(0.006);
    expect(grooveLockTimeAmount(6, 0.015)).toBeCloseTo(0.006);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/progressions/audio/humanize.test.ts`
Expected: FAIL — `grooveLockTimeAmount is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/progressions/audio/humanize.ts`, add:

```typescript
/** Fraction of full timing jitter applied to anchor (integer) beats. */
const ANCHOR_JITTER_FACTOR = 0.4;

/**
 * Groove lock: integer beats (the structural pulse) get reduced timing jitter;
 * off-beat subdivisions keep the full amount. Meter-agnostic — keys off the
 * bar-local beat value. Returns the `timeAmountSec` to feed `applyJitter`.
 * (Velocity jitter is unaffected — only timing.)
 */
export function grooveLockTimeAmount(beat: number, fullAmountSec: number): number {
  return Number.isInteger(beat) ? fullAmountSec * ANCHOR_JITTER_FACTOR : fullAmountSec;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/progressions/audio/humanize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/humanize.ts src/progressions/audio/humanize.test.ts
git commit -m "feat(audio): add grooveLockTimeAmount for anchor-beat timing lock"
```

---

### Task 3: Wire humanizer helpers into `buildAllLayers`

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts:23` (import), `:294-343` (chord loop), `:373-408` (bass loop), `:419-435` (drum loop)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

**Context:** `buildAllLayers.test.ts` mocks `./humanize` as a passthrough (line 13-15). The new helpers must be added to that mock or the builder crashes. The integration tests for drop/groove use the **real** module via `vi.importActual` in a separate `describe`.

- [ ] **Step 1: Write the failing tests**

First, extend the existing `vi.mock` at the top of `src/progressions/audio/buildAllLayers.test.ts` so the default-mocked suite keeps passing:

```typescript
vi.mock("./humanize", () => ({
  applyJitter: (params: { time: number; velocity: number }) => ({ time: params.time, velocity: params.velocity }),
  shouldDropHit: () => false,
  grooveLockTimeAmount: (_beat: number, full: number) => full,
}));
```

Then add a new test file `src/progressions/audio/buildAllLayers.humanize.test.ts` that uses the **real** humanizer (no mock):

```typescript
import { describe, expect, it } from "vitest";
import { buildAllLayersAsync } from "./buildAllLayers";
import type { ResolvedProgressionStep } from "../progressionDomain";

const step = (over: Partial<ResolvedProgressionStep> = {}): ResolvedProgressionStep => ({
  id: "x", index: 0, degree: "I", duration: { value: 1, unit: "bar" },
  qualityOverride: null, qualityOverrideApplied: false, invalidQualityOverride: false,
  manualRoot: null, root: "C", quality: "M", diatonicQuality: "M",
  label: "I", resolvedChordLabel: "C major", shortChordLabel: "C",
  unavailable: false, unavailableReason: null, ...over,
});

const baseInput = {
  tempoBpm: 60, beatsPerBar: 4, swing: 0,
  chordPatternId: "ballad-whole", bassPatternId: "root-fifth",
  drumPatternId: "rock", drumVariations: [] as string[], loop: true,
};

describe("buildAllLayers humanizer integration (real humanize)", () => {
  it("never drops the metronome or shifts it off the grid", async () => {
    const out = await buildAllLayersAsync({ ...baseInput, steps: [step(), step({ id: "b", index: 1, root: "G" })] });
    // Metronome stays on exact beat boundaries (secondsPerBeat = 1 at 60bpm).
    expect(out.metronome.every((m) => Number.isInteger(m.time))).toBe(true);
    expect(out.metronome).toHaveLength(8);
  });

  it("keeps every chordOnset on its exact bar boundary (never humanized)", async () => {
    const out = await buildAllLayersAsync({ ...baseInput, steps: [step(), step({ id: "b", index: 1, root: "G" })] });
    expect(out.chordOnsets.map((o) => o.time)).toEqual([0, 4]);
  });

  it("never drops a high-velocity structural drum hit", async () => {
    // rock kick on beat 0 has velocity 1 — must always survive.
    const out = await buildAllLayersAsync({ ...baseInput, steps: Array.from({ length: 8 }, (_, i) => step({ id: `s${i}`, index: i })) });
    const beatZeroKicks = out.drums.filter((d) => d.value.type === "kick" && d.value.velocity > 0.7);
    expect(beatZeroKicks.length).toBeGreaterThanOrEqual(8); // one per bar, none dropped
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/progressions/audio/buildAllLayers.humanize.test.ts`
Expected: FAIL — high-velocity kick count drops below 8 (real `shouldDropHit` not yet keyed to the structural hit) OR groove-lock import missing. (If they happen to pass because wiring is absent, the drop/groove behaviors aren't exercised — proceed to Step 3 to wire and re-confirm.)

- [ ] **Step 3: Write the implementation**

In `src/progressions/audio/buildAllLayers.ts`, update the import (line 23):

```typescript
import { applyJitter, shouldDropHit, grooveLockTimeAmount } from "./humanize";
```

**Chord loop** — replace the `applyJitter` call (around line 298-305) so drop is checked first and timing uses groove lock (preserve the LH-bass grid-lock):

```typescript
          const chordSeed = stepIndex * 10000 + bar * 100 + hit.beat;
          if (!isLhBass && shouldDropHit(hit.velocity, chordSeed)) continue;
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: chordSeed,
            // LH bass doubles the upright an octave up — lock it to the grid.
            timeAmountSec: isLhBass ? 0 : grooveLockTimeAmount(hit.beat, 0.015),
          });
```

**Bass loop** — replace the `applyJitter` call (around line 391-399):

```typescript
          const bassSeed = stepIndex * 10000 + bar * 100 + hit.beat + 1;
          if (!lockBassToGrid && shouldDropHit(hit.velocity, bassSeed)) continue;
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: bassSeed,
            // Lock to the grid when the comp doubles this line (bossa LH).
            timeAmountSec: lockBassToGrid ? 0 : grooveLockTimeAmount(hit.beat, 0.015),
          });
```

**Drum loop** — replace the `applyJitter` call (around line 422-429):

```typescript
          const drumSeed = stepIndex * 10000 + bar * 100 + hit.beat + 2;
          if (shouldDropHit(hit.velocity, drumSeed)) continue;
          const baseTime = barStart + swingBeat(hit.beat, input.swing) * secondsPerBeat;
          const { time: hitTime, velocity } = applyJitter({
            time: baseTime,
            velocity: hit.velocity,
            seed: drumSeed,
            timeAmountSec: grooveLockTimeAmount(hit.beat, 0.005), // tighter base for drums
            velocityAmount: 0.05,
          });
```

> Note: the chromatic-approach bass note carries `TURNAROUND_APPROACH_VELOCITY` (0.75) so it is never dropped — confirmed by the `>= 0.4` guard. The bass `chromatic-approach` synthetic hit has no `beat % 1` guarantee, but `grooveLockTimeAmount` handles any value.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/progressions/audio/buildAllLayers.test.ts src/progressions/audio/buildAllLayers.humanize.test.ts`
Expected: PASS (both the mocked suite and the real-humanizer suite).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts src/progressions/audio/buildAllLayers.humanize.test.ts
git commit -m "feat(audio): apply ghost-drop and groove-lock in buildAllLayers, exclude metronome/onsets"
```

---

## PHASE B — Variation Events & Genre Coupling

### Task 4: `ChordVariation` / `BassVariation` models + catalogs

**Files:**
- Modify: `src/progressions/audio/patterns.ts:99-107` (after `DrumVariation`), `:603-617` (getters)
- Test: `src/progressions/audio/patterns.test.ts`

**Context:** `variationFiresOnBar` already accepts any `{ barInterval, barPhase? }` — generalize its parameter type so chord/bass variations reuse it without duplication.

- [ ] **Step 1: Write the failing tests**

Add to `src/progressions/audio/patterns.test.ts` (extend imports to include `CHORD_VARIATIONS`, `BASS_VARIATIONS`, `getChordVariation`, `getBassVariation`):

```typescript
describe("chord & bass variation catalogs", () => {
  it("exposes chord and bass variation catalogs with unique IDs", () => {
    const chordIds = CHORD_VARIATIONS.map((v) => v.id);
    expect(new Set(chordIds).size).toBe(chordIds.length);
    const bassIds = BASS_VARIATIONS.map((v) => v.id);
    expect(new Set(bassIds).size).toBe(bassIds.length);
  });

  it("gates chord/bass variations through the shared variationFiresOnBar", () => {
    const funkChord = getChordVariation("funk-turnaround-chord")!;
    expect(funkChord.barInterval).toBe(4);
    expect(funkChord.barPhase).toBe(3);
    expect(variationFiresOnBar(funkChord, 3)).toBe(true);
    expect(variationFiresOnBar(funkChord, 0)).toBe(false);

    const funkBass = getBassVariation("funk-turnaround-bass")!;
    expect(variationFiresOnBar(funkBass, 3)).toBe(true);
    expect(variationFiresOnBar(funkBass, 7)).toBe(true);
  });

  it("keeps every variation's hits in bar-local range [0, 4)", () => {
    for (const v of CHORD_VARIATIONS) {
      for (const h of v.hits) expect(h.beat).toBeGreaterThanOrEqual(0), expect(h.beat).toBeLessThan(4);
    }
    for (const v of BASS_VARIATIONS) {
      for (const h of v.hits) expect(h.beat).toBeGreaterThanOrEqual(0), expect(h.beat).toBeLessThan(4);
    }
  });

  it("lookups return correct variations and undefined for misses", () => {
    expect(getChordVariation("funk-turnaround-chord")).toBeDefined();
    expect(getBassVariation("funk-turnaround-bass")).toBeDefined();
    expect(getChordVariation("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/progressions/audio/patterns.test.ts`
Expected: FAIL — `CHORD_VARIATIONS` / getters not exported.

- [ ] **Step 3: Write the implementation**

In `src/progressions/audio/patterns.ts`, after the `DrumVariation` interface (line 107), add:

```typescript
/** A single-bar harmonic variation that *replaces* (not layers) the base
 *  chord pattern's hits when it fires. Mirrors DrumVariation's gating fields. */
export interface ChordVariation {
  id: string;
  label: string;
  barInterval: number;
  barPhase?: number;
  hits: readonly ChordHit[];
}

/** A single-bar bass variation that *replaces* the base bass pattern's hits
 *  when it fires (applied before the §3.4 turnaround tail-swap). */
export interface BassVariation {
  id: string;
  label: string;
  barInterval: number;
  barPhase?: number;
  hits: readonly CatalogBassHit[];
}
```

Generalize the gating predicate signature (line 623) so it accepts any variation shape:

```typescript
export function variationFiresOnBar(
  variation: { barInterval: number; barPhase?: number },
  absoluteBar: number,
): boolean {
  if (variation.barInterval <= 0) return false;
  return absoluteBar % variation.barInterval === (variation.barPhase ?? 0);
}
```

Add the catalogs after `DRUM_VARIATIONS` (line 601). These are concrete starting points — tune musically later:

```typescript
export const CHORD_VARIATIONS: readonly ChordVariation[] = [
  {
    id: "funk-turnaround-chord",
    label: "Funk Turnaround Comp",
    barInterval: 4,
    barPhase: 3,
    // Pushed turnaround bar: a strong stab on the one, anticipated color stabs
    // driving into the next chord.
    hits: [
      { beat: 0, velocity: 0.92, direction: "down", articulation: "stab" },
      { beat: 1.5, velocity: 0.6, direction: "up", articulation: "muted" },
      { beat: 2.5, velocity: 0.7, direction: "down", articulation: "color-stab" },
      { beat: 3.5, velocity: 0.75, direction: "down", articulation: "color-stab" },
    ],
  },
];

export const BASS_VARIATIONS: readonly BassVariation[] = [
  {
    id: "funk-turnaround-bass",
    label: "Funk Turnaround Walk",
    barInterval: 4,
    barPhase: 3,
    // Walk-up turnaround: root anchor, octave pop, then a chromatic approach
    // into the next chord on the last beat.
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.7, note: "octave", articulation: "staccato" },
      { beat: 2.5, velocity: 0.6, note: "fifth", articulation: "staccato" },
      { beat: 3, velocity: 0.8, note: "chromatic-approach", articulation: "legato" },
    ],
  },
];
```

Add getters after `getDrumVariation` (line 617):

```typescript
export function getChordVariation(id: string): ChordVariation | undefined {
  return CHORD_VARIATIONS.find((v) => v.id === id);
}

export function getBassVariation(id: string): BassVariation | undefined {
  return BASS_VARIATIONS.find((v) => v.id === id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/progressions/audio/patterns.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(audio): add ChordVariation/BassVariation models, catalogs, and getters"
```

---

### Task 5: Chord-variation substitution in `buildAllLayers`

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts:10-22` (imports), `:63-73` (input type), `:180-188` (resolve), `:289-293` (chord hit selection)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/buildAllLayers.test.ts` (mocked-humanize suite):

```typescript
describe("chord variation substitution", () => {
  it("replaces the base chord hits on a firing turnaround bar", async () => {
    // pop-8ths base has 6 hits per bar; funk-turnaround-chord has 4. On bar 3
    // (phase 3, interval 4) the comp must switch to the variation's hit count.
    const steps = Array.from({ length: 8 }, (_, i) =>
      step({ id: `s${i}`, index: i, root: i % 2 === 0 ? "C" : "G" }),
    );
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "pop-8ths",
      chordVariations: ["funk-turnaround-chord"],
      bassPatternId: "root-fifth",
      steps,
    });
    // Strums in bar index 3 (time window [12,16) at 60bpm).
    const bar3 = out.chordStrums.filter((s) => s.time >= 12 && s.time < 16);
    const bar0 = out.chordStrums.filter((s) => s.time >= 0 && s.time < 4);
    expect(bar0).toHaveLength(6); // base pop-8ths
    expect(bar3).toHaveLength(4); // variation
  });

  it("leaves non-firing bars on the base pattern", async () => {
    const steps = Array.from({ length: 8 }, (_, i) => step({ id: `s${i}`, index: i }));
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "pop-8ths",
      chordVariations: ["funk-turnaround-chord"],
      steps,
    });
    const bar1 = out.chordStrums.filter((s) => s.time >= 4 && s.time < 8);
    expect(bar1).toHaveLength(6); // base pop-8ths, untouched
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/progressions/audio/buildAllLayers.test.ts`
Expected: FAIL — `chordVariations` not on input type / no substitution.

- [ ] **Step 3: Write the implementation**

Update imports (line 10-22) to add `getChordVariation`, `variationFiresOnBar` (already imported), and the `ChordVariation` type:

```typescript
import {
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  getChordVariation,
  variationFiresOnBar,
  repeatPatternToBeats,
  sliceCellToBar,
  type CatalogDrumPattern,
  type DrumHit,
  type DrumVariation,
  type ChordVariation,
  type BassArticulation,
} from "./patterns";
```

Add to `BuildAllLayersInput` (after line 71):

```typescript
  drumVariations: readonly string[];
  chordVariations: readonly string[];
  bassVariations: readonly string[];
  loop: boolean;
```

Resolve the chord variations once, near the drum-variation resolution (after line 187):

```typescript
  const chordVariationDefs: ChordVariation[] = input.chordVariations
    .map((id) => getChordVariation(id))
    .filter((v): v is ChordVariation => Boolean(v));
```

In the chord block, replace the hit selection (lines 290-293). The firing variation **replaces** the bar; first in catalog order wins:

```typescript
        const chordCellBars = chordPattern.bars ?? 1;
        const firingChordVariation = chordVariationDefs.find((v) =>
          variationFiresOnBar(v, absoluteBar),
        );
        const sourceHits = firingChordVariation
          ? firingChordVariation.hits
          : chordPattern.hits;
        const hits = !firingChordVariation && isBarUnit && chordCellBars > 1
          ? sliceCellToBar(sourceHits, absoluteBar % chordCellBars, input.beatsPerBar)
          : repeatPatternToBeats(sourceHits, eventBeats, input.beatsPerBar);
```

> Variations are always 1 bar, so they take the `repeatPatternToBeats` path (the `sliceCellToBar` branch only applies to the multi-bar *base* cell when no variation fires).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/progressions/audio/buildAllLayers.test.ts`
Expected: FAIL on unrelated existing tests — every existing `buildAllLayersAsync` call in the suite now needs `chordVariations`/`bassVariations`. Add `chordVariations: [], bassVariations: []` to the shared `baseInput` object (top of the file). Re-run.
Expected after fix: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(audio): substitute chord pattern with firing chord variation per bar"
```

---

### Task 6: Bass-variation substitution (with §3.4 turnaround interaction)

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (imports, resolve, bass block lines 346-372)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

**Context — the interaction:** the bass block already has a §3.4 turnaround that drops the pattern tail and appends a chromatic approach when `bassPattern.turnaround === true`. Decision: a firing **bass variation replaces the base `patternHits` selection**; the §3.4 tail-swap then runs on that replaced set exactly as today (orthogonal — it leads into the next chord regardless of which groove plays). The variation chosen here (`funk-turnaround-bass`) already ends on a chromatic approach, and `funk-syncopated` has `turnaround` unset, so they do not double up.

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/buildAllLayers.test.ts`:

```typescript
describe("bass variation substitution", () => {
  it("replaces the base bass hits on a firing turnaround bar", async () => {
    // funk-syncopated has 5 hits/bar; funk-turnaround-bass has 4. Bar 3 fires.
    const steps = Array.from({ length: 8 }, (_, i) =>
      step({ id: `s${i}`, index: i, root: i % 2 === 0 ? "C" : "G" }),
    );
    const out = await buildAllLayersAsync({
      ...baseInput,
      bassPatternId: "funk-syncopated",
      bassVariations: ["funk-turnaround-bass"],
      chordPatternId: "ballad-whole",
      steps,
    });
    const bar3 = out.bass.filter((b) => b.time >= 12 && b.time < 16);
    const bar0 = out.bass.filter((b) => b.time >= 0 && b.time < 4);
    expect(bar0).toHaveLength(5); // base funk-syncopated
    expect(bar3).toHaveLength(4); // variation
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/progressions/audio/buildAllLayers.test.ts`
Expected: FAIL — no bass substitution (bar 3 still has 5 hits).

- [ ] **Step 3: Write the implementation**

Add `getBassVariation` and `type BassVariation` to the patterns import. Resolve once near the chord-variation resolution:

```typescript
  const bassVariationDefs: BassVariation[] = input.bassVariations
    .map((id) => getBassVariation(id))
    .filter((v): v is BassVariation => Boolean(v));
```

In the bass block, replace the base-pattern selection (lines 347-350) so a firing variation supplies `patternHits` *before* the §3.4 logic:

```typescript
        const bassCellBars = bassPattern.bars ?? 1;
        const firingBassVariation = bassVariationDefs.find((v) =>
          variationFiresOnBar(v, absoluteBar),
        );
        const baseBassHits = firingBassVariation
          ? firingBassVariation.hits
          : bassPattern.hits;
        const patternHits = !firingBassVariation && isBarUnit && bassCellBars > 1
          ? sliceCellToBar(baseBassHits, absoluteBar % bassCellBars, input.beatsPerBar)
          : repeatPatternToBeats(baseBassHits, eventBeats, input.beatsPerBar);
```

The existing `isTurnaroundBar` / tail-swap block (lines 355-372) is unchanged — it operates on `patternHits` as before.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(audio): substitute bass pattern with firing bass variation per bar"
```

---

### Task 7: Plumb new input fields through the playback hook

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts` (atom reads + every `buildAllLayersAsync` input + memo deps)

**Context:** there is no unit test for this hook; correctness is verified by `tsc` (the new required `BuildAllLayersInput` fields make the build fail until every call site is updated). Grep `drumVariations` to find all sites (reads at ~133, input objects at ~158/176/219/253/434, deps arrays at ~163/201/291).

- [ ] **Step 1: Verify the build currently fails (the failing "test")**

Run: `pnpm run build`
Expected: FAIL — `buildAllLayersAsync` calls in the hook are missing `chordVariations`/`bassVariations` (now required on `BuildAllLayersInput`).

- [ ] **Step 2: Read the new atoms**

In `src/hooks/useProgressionAudioPlayback.ts`, next to `const drumVariations = useAtomValue(progressionDrumVariationsAtom);` (line 133), add (import the atoms from `../store/progressionAtoms`):

```typescript
  const chordVariations = useAtomValue(progressionChordVariationsAtom);
  const bassVariations = useAtomValue(progressionBassVariationsAtom);
```

- [ ] **Step 3: Thread through every call site + deps**

For **each** object literal passed to `buildAllLayersAsync` (and the `inputs` memo it derives from), add the two fields next to `drumVariations`:

```typescript
        drumVariations,
        chordVariations,
        bassVariations,
```

And add `chordVariations, bassVariations` to **every** dependency array that already lists `drumVariations` (the `useMemo`/`useCallback` deps at ~163, ~201, ~291).

- [ ] **Step 4: Verify the build passes**

Run: `pnpm run build`
Expected: PASS (tsc clean). Then:
Run: `pnpm run test -- src/progressions/audio src/hooks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts
git commit -m "feat(audio): thread chord/bass variations through playback hook"
```

---

### Task 8: State atoms + genre apply + reset

**Files:**
- Modify: `src/store/progressionAtoms.ts:262-287` (atoms + applyGenreStyle), `:733-738` (reset)
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/store/progressionAtoms.test.ts` (import the new atoms + `applyGenreStyleAtom`):

```typescript
describe("chord/bass variation atoms", () => {
  it("applyGenreStyle populates chord and bass variations from the genre bundle", () => {
    const store = createStore();
    store.set(applyGenreStyleAtom, "funk");
    expect(store.get(progressionChordVariationsAtom)).toContain("funk-turnaround-chord");
    expect(store.get(progressionBassVariationsAtom)).toContain("funk-turnaround-bass");
  });

  it("reset returns chord/bass variations to empty defaults", () => {
    const store = createStore();
    store.set(progressionChordVariationsAtom, ["funk-turnaround-chord"]);
    store.set(progressionBassVariationsAtom, ["funk-turnaround-bass"]);
    store.set(resetProgressionAtomsAtom);
    expect(store.get(progressionChordVariationsAtom)).toEqual([]);
    expect(store.get(progressionBassVariationsAtom)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/store/progressionAtoms.test.ts`
Expected: FAIL — atoms not exported.

- [ ] **Step 3: Write the implementation**

In `src/store/progressionAtoms.ts`, after `progressionDrumVariationsAtom` (line 267), add:

```typescript
export const progressionChordVariationsAtom = atomWithStorage<string[]>(
  k("progressionChordVariations"),
  [],
  stringArrayStorage,
  GET_ON_INIT,
);

export const progressionBassVariationsAtom = atomWithStorage<string[]>(
  k("progressionBassVariations"),
  [],
  stringArrayStorage,
  GET_ON_INIT,
);
```

In `applyGenreStyleAtom` (after line 284):

```typescript
  set(progressionDrumVariationsAtom, genre.drumVariations);
  set(progressionChordVariationsAtom, genre.chordVariations);
  set(progressionBassVariationsAtom, genre.bassVariations);
```

In the reset action (after line 738):

```typescript
  set(progressionDrumVariationsAtom, RESET);
  set(progressionChordVariationsAtom, RESET);
  set(progressionBassVariationsAtom, RESET);
```

> This depends on Task 9's `GenreStyle.chordVariations`/`bassVariations` fields. If executing Task 8 before Task 9, `tsc` will flag the missing fields — do Task 9 first or in the same batch.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/store/progressionAtoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progression): add chord/bass variation atoms with genre-apply and reset"
```

---

### Task 9: Genre coupling — `GenreStyle` fields + matched-phase data

**Files:**
- Modify: `src/progressions/audio/genres.ts:3-14` (interface), `:16-59` (data)
- Test: `src/progressions/audio/genres.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/progressions/audio/genres.test.ts` (import `getChordVariation`, `getBassVariation`):

```typescript
describe("genre chord/bass variation coupling", () => {
  it("every genre declares chord and bass variation arrays", () => {
    for (const g of GENRE_STYLES) {
      expect(Array.isArray(g.chordVariations)).toBe(true);
      expect(Array.isArray(g.bassVariations)).toBe(true);
    }
  });

  it("keeps every referenced chord/bass variation id resolvable", () => {
    for (const g of GENRE_STYLES) {
      for (const id of g.chordVariations) expect(getChordVariation(id), `${g.id}:${id}`).toBeDefined();
      for (const id of g.bassVariations) expect(getBassVariation(id), `${g.id}:${id}`).toBeDefined();
    }
  });

  it("funk couples chord/bass/drum turnarounds on the same bar (interval 4, phase 3)", () => {
    const funk = getGenreStyle("funk")!;
    const chord = getChordVariation(funk.chordVariations[0])!;
    const bass = getBassVariation(funk.bassVariations[0])!;
    expect(chord.barInterval).toBe(4);
    expect(chord.barPhase).toBe(3);
    expect(bass.barInterval).toBe(4);
    expect(bass.barPhase).toBe(3);
    // Drum funk-fill-4 already fires on interval 4 / phase 3 — all three lock.
    expect(funk.drumVariations).toContain("funk-fill-4");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/progressions/audio/genres.test.ts`
Expected: FAIL — `chordVariations`/`bassVariations` not on `GenreStyle`.

- [ ] **Step 3: Write the implementation**

In `src/progressions/audio/genres.ts`, add to the `GenreStyle` interface (after `drumVariations`):

```typescript
  drumVariations: string[];
  chordVariations: string[];
  bassVariations: string[];
```

Add both fields to **every** entry in `GENRE_STYLES`. Most are `[]`; funk carries the coupled pair:

```typescript
  // pop:        chordVariations: [], bassVariations: [],
  // rock:       chordVariations: [], bassVariations: [],
  // blues:      chordVariations: [], bassVariations: [],
  // jazz:       chordVariations: [], bassVariations: [],
  // ballad:     chordVariations: [], bassVariations: [],
  // funk:       chordVariations: ["funk-turnaround-chord"], bassVariations: ["funk-turnaround-bass"],
  // bossa-nova: chordVariations: [], bassVariations: [],
```

Apply each as a literal field on its genre object (the comment block above is the mapping, not the code — add `chordVariations: [...], bassVariations: [...]` to each of the 7 objects).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/progressions/audio/genres.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/genres.test.ts
git commit -m "feat(audio): couple chord/bass turnarounds to genres via GenreStyle bundle"
```

---

## PHASE C — Extended Base Patterns (optional, catalog-only)

### Task 10: Author a 4-bar extended pattern (representative)

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (one new pattern in `CHORD_PATTERNS` or `BASS_PATTERNS`)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

**Context:** no renderer change — `sliceCellToBar` + `absoluteBar % bars` already select the right bar of a `bars: N` cell on bar-unit steps. This task proves the path with a 4-bar cell and documents the beat-unit collapse caveat. Skip this task if no 4-bar pattern is desired yet.

- [ ] **Step 1: Write the failing test**

Add to `src/progressions/audio/buildAllLayers.test.ts`:

```typescript
describe("extended (4-bar) base pattern", () => {
  it("plays a different bar of a 4-bar cell on each successive bar", async () => {
    const steps = Array.from({ length: 4 }, (_, i) => step({ id: `s${i}`, index: i }));
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "extended-4bar-demo",
      bassPatternId: "root-fifth",
      steps,
    });
    // Bar 0 has 1 hit (beat 0); bar 3 has 2 hits (the authored turnaround bar).
    const bar0 = out.chordStrums.filter((s) => s.time >= 0 && s.time < 4);
    const bar3 = out.chordStrums.filter((s) => s.time >= 12 && s.time < 16);
    expect(bar0).toHaveLength(1);
    expect(bar3).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/progressions/audio/buildAllLayers.test.ts`
Expected: FAIL — `extended-4bar-demo` pattern not found.

- [ ] **Step 3: Write the implementation**

Add to `CHORD_PATTERNS` in `src/progressions/audio/patterns.ts`:

```typescript
  {
    id: "extended-4bar-demo",
    label: "Extended 4-Bar Demo",
    bars: 4,
    // One sustained chord per bar for bars 0-2; bar 3 (beats 12-15) adds a
    // second anticipation stab as a turnaround — proves multi-bar evolution
    // without any variation event.
    hits: [
      { beat: 0, velocity: 0.8, style: "sustained" },
      { beat: 4, velocity: 0.8, style: "sustained" },
      { beat: 8, velocity: 0.8, style: "sustained" },
      { beat: 12, velocity: 0.85, style: "sustained" },
      { beat: 14.5, velocity: 0.7, direction: "up" },
    ],
  },
```

Update the catalog-count assertion in `patterns.test.ts` (`has 10 chord patterns` → `11`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(audio): add 4-bar extended chord pattern demonstrating multi-bar evolution"
```

---

## Final Verification (run after all tasks)

- [ ] **Lint, test, build (MANDATORY before PR):**

```bash
pnpm run lint
pnpm run test
pnpm run build
```
Expected: all green.

- [ ] **Optional — audition in the dev server:**

```bash
pnpm run dev
```
Load the funk genre, set an 8+ bar progression, enable chords/bass/drums, play looped. Confirm: the turnaround bar (bar 4 of each group) audibly pushes chords + bass + drums together; repeats don't sound machine-gunned; the pulse stays tight on downbeats.

---

## Self-Review notes (author)

- **Spec coverage:** Extended patterns → Task 10; ChordVariation/BassVariation → Tasks 4-6; substitution semantics (replace, first-wins) → Tasks 5-6; genre coupling → Task 9; humanizer groove-lock → Task 2; ghost-drop → Task 1; exclusions (metronome/onsets) → Task 3. Density Selection is intentionally **out of scope** per the spec.
- **Type consistency:** `shouldDropHit(velocity, seed)`, `grooveLockTimeAmount(beat, fullAmountSec)`, `getChordVariation`/`getBassVariation`, `progressionChordVariationsAtom`/`progressionBassVariationsAtom`, `GenreStyle.chordVariations`/`bassVariations`, and `BuildAllLayersInput.chordVariations`/`bassVariations` are used identically across every task.
- **Ordering dependency:** Task 8 (atoms) references `GenreStyle.chordVariations`/`bassVariations` from Task 9 — execute Task 9 before or with Task 8. Task 7's build only passes once Tasks 5-6 add the input fields.
- **Known caveat (documented, not a bug):** extended patterns collapse to bar 0 on *beat-unit* steps (`repeatPatternToBeats` path) — acceptable; surfaced in the Task 10 context note.
