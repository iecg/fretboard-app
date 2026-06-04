# Full-Mode Voicing Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Full-mode connector show clean close-voicing grips wherever a CAGED template is absent — including Scale Pattern None — and bring power chords in as 2-note grips.

**Architecture:** A pure playability scorer in `@fretflow/core` ranks close voicings. Phase 1 uses it to render one best grip per CAGED/3NPS position (de-clutter). Phase 2 adds a position-less "neck spread" path so the fallback fires when no scale pattern is active. Phase 3 lets `closeVoicings` emit 2-note dyads so power chords flow through both close mode and the fallback.

**Tech Stack:** TypeScript, React 19, Jotai atoms, Vitest, pnpm workspace (`@fretflow/core` package + `src/` app).

**Spec:** `docs/superpowers/specs/2026-06-03-full-voicing-fallback-design.md`

---

## File Structure

**Create:** none (all changes extend existing files).

**Modify:**
- `packages/core/src/shapes/voicings.ts` — add `scoreCloseVoicing`, `compareCloseVoicings`, `selectNeckSpread`, weight/threshold/tolerance constants; lower the close-voicing voice-count floor to 2.
- `packages/core/src/shapes/index.ts` — re-export the new public symbols.
- `packages/core/src/shapes/voicings.test.ts` — new scorer/spread/power tests; update the power-chord-returns-empty test.
- `src/hooks/voicingSelection.ts` — sort the two close-fallback selectors best-first.
- `src/hooks/voicingSelection.test.ts` — selector-ranking test (create if absent).
- `src/store/voicingFallbackAtoms.ts` — reduce to one grip per polygon (Phase 1); add `neckSpreadFallbackActiveAtom` + neck-spread branch (Phase 2); fix stale spec comment.
- `src/store/voicingFallbackAtoms.test.ts` — Phase 1 + Phase 2 atom tests; tighten the "no pattern" test.

**Conventions to follow:**
- Tests are co-located, Vitest + `describe/it/expect`. Run from repo root; root Vitest covers `packages/core` too.
- Atom tests use `createStore()` (jotai) or `makeAtomStore([[atom, value], …])` from `src/test-utils/renderWithAtoms`.
- A chord is made "active" by setting `rootNoteAtom`, `scaleNameAtom`, and `progressionStepsAtom` with one step carrying `manualRoot` + `qualityOverride`.
- Commits: Conventional Commits with scope, e.g. `feat(voicings): …`.

---

## Task 1: Playability scorer (`scoreCloseVoicing` + tie-break comparator)

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts`
- Modify: `packages/core/src/shapes/index.ts`
- Test: `packages/core/src/shapes/voicings.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/shapes/voicings.test.ts`:

```ts
import {
  scoreCloseVoicing,
  compareCloseVoicings,
  CLOSE_VOICING_SCORE_WEIGHTS,
  HIGH_NECK_THRESHOLD,
} from "./voicings";
import type { Voicing } from "./voicings";

// frets: [stringIndex, fretIndex][] — noteName/midi are irrelevant to scoring.
function vc(frets: Array<[number, number]>): Voicing {
  return {
    positionKeys: frets.map(([s, f]) => `${s}-${f}`),
    notes: frets.map(([s, f]) => ({ stringIndex: s, fretIndex: f, noteName: "X", midi: 0 })),
  };
}

describe("scoreCloseVoicing", () => {
  it("exposes named weights and the high-neck threshold", () => {
    expect(CLOSE_VOICING_SCORE_WEIGHTS.span).toBe(3);
    expect(CLOSE_VOICING_SCORE_WEIGHTS.open).toBe(1.5);
    expect(HIGH_NECK_THRESHOLD).toBe(7);
  });

  it("prefers a compact low grip over a wide high stretch", () => {
    const compactLow = vc([[0, 1], [1, 2], [2, 2]]);
    const wideHigh = vc([[0, 12], [1, 16], [2, 14]]);
    expect(scoreCloseVoicing(compactLow)).toBeLessThan(scoreCloseVoicing(wideHigh));
  });

  it("rewards open strings over a fully fretted equivalent", () => {
    const withOpen = vc([[0, 0], [1, 2], [2, 2]]);
    const allFretted = vc([[0, 3], [1, 2], [2, 2]]);
    expect(scoreCloseVoicing(withOpen)).toBeLessThan(scoreCloseVoicing(allFretted));
  });
});

describe("compareCloseVoicings tie-break", () => {
  it("breaks equal scores by lower top fret", () => {
    const low = vc([[0, 1], [1, 2], [2, 2]]);
    const high = vc([[0, 3], [1, 4], [2, 4]]); // same shape, shifted up — equal score
    expect(scoreCloseVoicing(low)).toBe(scoreCloseVoicing(high));
    expect(compareCloseVoicings(low, high)).toBeLessThan(0);
  });

  it("then breaks ties by lower lowest-string index", () => {
    const lowStrings = vc([[0, 2], [1, 3], [2, 3]]);
    const highStrings = vc([[3, 2], [4, 3], [5, 3]]); // identical frets, higher strings
    expect(scoreCloseVoicing(lowStrings)).toBe(scoreCloseVoicing(highStrings));
    expect(compareCloseVoicings(lowStrings, highStrings)).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts -t "scoreCloseVoicing"`
Expected: FAIL — `scoreCloseVoicing is not exported` / undefined.

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/shapes/voicings.ts`, after the `Voicing` interface (around line 26), add:

```ts
export interface CloseVoicingScoreWeights {
  span: number;
  fretted: number;
  compact: number;
  highNeck: number;
  open: number;
}

/** Lower total = more playable. Hand-tuned starting weights; adjustable. */
export const CLOSE_VOICING_SCORE_WEIGHTS: CloseVoicingScoreWeights = {
  span: 3, // wide stretches hurt most
  fretted: 1, // fewer fretted notes = easier
  compact: 1, // reward grips clustered near one hand position
  highNeck: 0.5, // mild lower-neck preference
  open: 1.5, // reward open strings
};

/** Fret above which a grip starts paying the high-neck penalty. */
export const HIGH_NECK_THRESHOLD = 7;

/**
 * Playability cost for a close voicing. Pure of any polygon/position/string-set
 * context — depends only on `voicing.notes` — so the same scorer ranks grips
 * both inside a CAGED polygon (Phase 1) and across the whole neck (Phase 2).
 * Lower is better.
 */
export function scoreCloseVoicing(
  voicing: Voicing,
  weights: CloseVoicingScoreWeights = CLOSE_VOICING_SCORE_WEIGHTS,
): number {
  const fretted = voicing.notes.map((n) => n.fretIndex).filter((f) => f > 0);
  const openCount = voicing.notes.length - fretted.length;
  const span = fretted.length > 0 ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const mean = fretted.length > 0 ? fretted.reduce((a, b) => a + b, 0) / fretted.length : 0;
  const compact = fretted.reduce((s, f) => s + Math.abs(f - mean), 0);
  const topFret = voicing.notes.length > 0 ? Math.max(...voicing.notes.map((n) => n.fretIndex)) : 0;
  const highNeck = Math.max(0, topFret - HIGH_NECK_THRESHOLD);

  return (
    weights.span * span +
    weights.fretted * fretted.length +
    weights.compact * compact +
    weights.highNeck * highNeck -
    weights.open * openCount
  );
}

/**
 * Deterministic ordering: lower cost first; ties broken by lower top fret, then
 * lower lowest-string index. Guarantees stable, repeatable grip selection.
 */
export function compareCloseVoicings(a: Voicing, b: Voicing): number {
  const sa = scoreCloseVoicing(a);
  const sb = scoreCloseVoicing(b);
  if (sa !== sb) return sa - sb;
  const topA = Math.max(...a.notes.map((n) => n.fretIndex));
  const topB = Math.max(...b.notes.map((n) => n.fretIndex));
  if (topA !== topB) return topA - topB;
  const lowA = Math.min(...a.notes.map((n) => n.stringIndex));
  const lowB = Math.min(...b.notes.map((n) => n.stringIndex));
  return lowA - lowB;
}
```

In `packages/core/src/shapes/index.ts`, extend the value export from `./voicings`:

```ts
export {
  generateVoicings, openStringMidi,
  scoreCloseVoicing, compareCloseVoicings,
  CLOSE_VOICING_SCORE_WEIGHTS, HIGH_NECK_THRESHOLD,
} from "./voicings";
export type { CloseVoicingScoreWeights } from "./voicings";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts -t "scoreCloseVoicing"` and `… -t "compareCloseVoicings"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/index.ts packages/core/src/shapes/voicings.test.ts
git commit -m "feat(voicings): add scoreCloseVoicing playability scorer and tie-break"
```

---

## Task 2: Neck-spread selector (`selectNeckSpread`)

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts`
- Modify: `packages/core/src/shapes/index.ts`
- Test: `packages/core/src/shapes/voicings.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/shapes/voicings.test.ts` (reuses the `vc` helper from Task 1):

```ts
import { selectNeckSpread, NECK_SPREAD_OVERLAP_TOLERANCE } from "./voicings";

describe("selectNeckSpread", () => {
  it("exposes the overlap tolerance constant", () => {
    expect(NECK_SPREAD_OVERLAP_TOLERANCE).toBe(1);
  });

  it("collapses a within-tolerance cluster to a single grip", () => {
    const a = vc([[0, 1], [1, 2], [2, 2]]); // fretted window [1,2]
    const b = vc([[0, 2], [1, 3], [2, 3]]); // fretted window [2,3] — touches a
    expect(selectNeckSpread([a, b]).length).toBe(1);
  });

  it("keeps grips separated by more than the tolerance", () => {
    const low = vc([[0, 1], [1, 2], [2, 2]]); // [1,2]
    const high = vc([[3, 9], [4, 10], [5, 10]]); // [9,10]
    expect(selectNeckSpread([low, high]).length).toBe(2);
  });

  it("orders the spread best-first", () => {
    const wideHigh = vc([[0, 10], [1, 14], [2, 12]]);
    const compactLow = vc([[3, 1], [4, 2], [5, 2]]);
    expect(selectNeckSpread([wideHigh, compactLow])[0]).toBe(compactLow);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts -t "selectNeckSpread"`
Expected: FAIL — `selectNeckSpread is not exported`.

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/shapes/voicings.ts`, after `compareCloseVoicings`, add:

```ts
/**
 * Max fret gap below which two grips are considered to share neck space.
 * Grips whose fretted-fret windows are within this many frets of each other
 * collapse to the single best-scored grip, so the neck spread never draws
 * overlapping/crossing connectors.
 */
export const NECK_SPREAD_OVERLAP_TOLERANCE = 1;

/**
 * Position-less grip selection for Full mode when no scale pattern is active.
 * Ranks candidates best-first, then greedily accepts a grip only if its
 * fretted-fret window does not overlap an already-accepted grip's window
 * (within NECK_SPREAD_OVERLAP_TOLERANCE). Yields a clean, non-overlapping
 * spread of best grips up the neck — mirroring how Full mode already spreads
 * multiple CAGED shapes across the neck in Scale None.
 */
export function selectNeckSpread(candidates: Voicing[]): Voicing[] {
  const ranked = [...candidates].sort(compareCloseVoicings);
  const accepted: Voicing[] = [];
  const windows: Array<{ lo: number; hi: number }> = [];

  for (const v of ranked) {
    const fretted = v.notes.map((n) => n.fretIndex).filter((f) => f > 0);
    const lo = fretted.length > 0 ? Math.min(...fretted) : 0;
    const hi = fretted.length > 0 ? Math.max(...fretted) : 0;
    const overlaps = windows.some(
      (w) => lo <= w.hi + NECK_SPREAD_OVERLAP_TOLERANCE && hi >= w.lo - NECK_SPREAD_OVERLAP_TOLERANCE,
    );
    if (overlaps) continue;
    accepted.push(v);
    windows.push({ lo, hi });
  }
  return accepted;
}
```

In `packages/core/src/shapes/index.ts`, add to the `./voicings` value export:

```ts
  selectNeckSpread, NECK_SPREAD_OVERLAP_TOLERANCE,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts -t "selectNeckSpread"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/index.ts packages/core/src/shapes/voicings.test.ts
git commit -m "feat(voicings): add selectNeckSpread for position-less grip selection"
```

---

## Task 3: Power chords as 2-note dyads

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts:122-136`
- Test: `packages/core/src/shapes/voicings.test.ts:84-93` (replace) + new

- [ ] **Step 1: Update the existing test that asserts power chords are empty, and add the dyad test**

In `packages/core/src/shapes/voicings.test.ts`, **replace** the existing test (currently "'close' returns [] for chord types with <3 members (dyad: Power Chord)"):

```ts
  it("'close' returns 2-note dyads for a power chord (root + 5th)", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "5",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "close",
    });
    expect(result.length).toBeGreaterThan(0);
    for (const v of result) {
      expect(v.notes.length).toBe(2);
      // Adjacent string pair.
      const strings = v.notes.map((n) => n.stringIndex).sort((a, b) => a - b);
      expect(strings[1] - strings[0]).toBe(1);
      // Only the two power-chord pitch classes: C (0) and G (7).
      const pcs = new Set(v.notes.map((n) => n.midi % 12));
      expect(pcs).toEqual(new Set([0, 7]));
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts -t "2-note dyads for a power chord"`
Expected: FAIL — `result.length` is 0 (current floor rejects <3 voices).

- [ ] **Step 3: Lower the voice-count floor and update the doc comment**

In `packages/core/src/shapes/voicings.ts`, update the `closeVoicings` doc comment (lines 122-127) and the gate (line 136):

Comment — change the note-count line to include dyads:

```ts
/**
 * Generate Close voicings: 2/3/4/5-note polygons on adjacent strings, where
 * each polygon contains every chord tone (no skipped tones). Note count matches
 * the chord's tone count: dyads (power chords) = 2, triads = 3, tetrads = 4,
 * pentads = 5.
 *
 * Span limit: see {@link CLOSE_VOICING_SPAN_LIMIT}.
 */
```

Gate — lower the floor from 3 to 2:

```ts
  if (voiceCount < 2 || voiceCount > 5) return [];
```

- [ ] **Step 4: Run tests to verify pass + no regressions**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts`
Expected: PASS (the new dyad test plus all existing triad/tetrad tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/voicings.test.ts
git commit -m "feat(voicings): emit 2-note close voicings for power chords"
```

---

## Task 4: Phase 1 — rank fallback selectors, render one grip per position

**Files:**
- Modify: `src/hooks/voicingSelection.ts:184-214`
- Modify: `src/store/voicingFallbackAtoms.ts:179-195`
- Test: `src/hooks/voicingSelection.test.ts` (create if absent), `src/store/voicingFallbackAtoms.test.ts`

- [ ] **Step 1: Write the failing selector-ranking test**

Create `src/hooks/voicingSelection.test.ts` (or append if it exists):

```ts
import { describe, it, expect } from "vitest";
import { selectCloseFallbacksForCagedPosition } from "./voicingSelection";
import type { ShapePolygon, Voicing } from "@fretflow/core";

function vc(frets: Array<[number, number]>): Voicing {
  return {
    positionKeys: frets.map(([s, f]) => `${s}-${f}`),
    notes: frets.map(([s, f]) => ({ stringIndex: s, fretIndex: f, noteName: "X", midi: 0 })),
  };
}

// distanceOutsidePolygon only reads vertices[i].fret, so a minimal vertex list
// (6 left bounds then 6 mirrored right bounds) is enough. Box covering [lo, hi]
// on every string.
function boxPolygon(lo: number, hi: number): ShapePolygon {
  const vertices = [
    ...Array.from({ length: 6 }, () => ({ fret: lo })),
    ...Array.from({ length: 6 }, () => ({ fret: hi })),
  ];
  return { vertices } as unknown as ShapePolygon;
}

describe("selectCloseFallbacksForCagedPosition ranking", () => {
  it("returns fitting grips ordered best-first", () => {
    const box = boxPolygon(0, 5);
    const wide = vc([[0, 1], [1, 4], [2, 4]]); // span 3
    const compact = vc([[0, 1], [1, 2], [2, 2]]); // span 1 — better
    const out = selectCloseFallbacksForCagedPosition([wide, compact], box);
    expect(out.length).toBe(2);
    expect(out[0]).toBe(compact);
  });

  it("still excludes grips with any note outside the polygon", () => {
    const box = boxPolygon(0, 3);
    const outside = vc([[0, 1], [1, 5], [2, 2]]); // fret 5 > 3
    expect(selectCloseFallbacksForCagedPosition([outside], box)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/hooks/voicingSelection.test.ts -t "ranking"`
Expected: FAIL — order is input order, `out[0]` is `wide` not `compact`.

- [ ] **Step 3: Sort both close-fallback selectors best-first**

In `src/hooks/voicingSelection.ts`, update the import (line 7) and the two selectors:

```ts
import type { CagedShape, Voicing, VoicingNote, ShapePolygon } from "@fretflow/core";
import { compareCloseVoicings } from "@fretflow/core";
```

Replace `selectCloseFallbacksForThreeNpsPosition` (lines 184-194):

```ts
export function selectCloseFallbacksForThreeNpsPosition(
  closeMatches: Voicing[],
  patternPositions: Set<string>,
): Voicing[] {
  const fitted =
    patternPositions.size === 0
      ? closeMatches
      : closeMatches.filter((match) =>
          match.notes.every((note) =>
            patternPositions.has(`${note.stringIndex}-${note.fretIndex}`),
          ),
        );
  return [...fitted].sort(compareCloseVoicings);
}
```

Replace `selectCloseFallbacksForCagedPosition` (lines 207-214):

```ts
export function selectCloseFallbacksForCagedPosition(
  closeMatches: Voicing[],
  polygon: ShapePolygon,
): Voicing[] {
  return closeMatches
    .filter((match) => match.notes.every((note) => distanceOutsidePolygon(polygon, note) === 0))
    .sort(compareCloseVoicings);
}
```

- [ ] **Step 4: Run selector test to verify it passes**

Run: `pnpm exec vitest run src/hooks/voicingSelection.test.ts -t "ranking"`
Expected: PASS.

- [ ] **Step 5: Write the failing "one grip per polygon" atom test**

Append to `src/store/voicingFallbackAtoms.test.ts` (imports `rootNoteAtom`, `scaleNameAtom`, `progressionStepsAtom`, `progressionWith`, `makeAtomStore`, `fallbackPolygonsAtom` are already present in the file):

```ts
describe("fallbackVoicingMatchesAtom — one grip per polygon (Phase 1)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("emits exactly one fallback grip per qualifying polygon", () => {
    // B dim with the C-shape selected: dim has no C-shape full template, so
    // every qualifying polygon routes through the close-voicing fallback.
    const store = makeAtomStore([
      [rootNoteAtom, "B"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "B", qualityOverride: "dim" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);
    const polys = store.get(fallbackPolygonsAtom);
    const matches = store.get(fallbackVoicingMatchesAtom);
    expect(polys.length).toBeGreaterThan(0);
    expect(matches.length).toBe(polys.length);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm exec vitest run src/store/voicingFallbackAtoms.test.ts -t "one grip per polygon"`
Expected: FAIL — `matches.length` exceeds `polys.length` (current loop pushes every fitting grip).

- [ ] **Step 7: Reduce the fallback atom to one grip per position**

In `src/store/voicingFallbackAtoms.ts`, replace the CAGED and 3NPS result construction inside `fallbackVoicingMatchesAtom` (lines 179-195):

```ts
  let result: Voicing[];
  if (boxBounds !== null) {
    const { highlightNotes } = get(shapeDataAtom);
    const patternPositions = new Set(highlightNotes.filter((n) => n.includes("-")));
    result = selectCloseFallbacksForThreeNpsPosition(closes, patternPositions)
      .slice(0, 1)
      .map((v) => ({ ...v, isFallback: true }));
  } else {
    result = [];
    for (const polygon of polygons) {
      const ranked = selectCloseFallbacksForCagedPosition(closes, polygon);
      if (ranked.length > 0) {
        result.push({ ...ranked[0], shape: polygon.shape, isFallback: true });
      }
    }
  }
  return memoizeFallbackVoicings(result);
```

- [ ] **Step 8: Run atom test + full fallback suite**

Run: `pnpm exec vitest run src/store/voicingFallbackAtoms.test.ts`
Expected: PASS (new test plus the existing stability/string-set tests).

- [ ] **Step 9: Commit**

```bash
git add src/hooks/voicingSelection.ts src/hooks/voicingSelection.test.ts src/store/voicingFallbackAtoms.ts src/store/voicingFallbackAtoms.test.ts
git commit -m "feat(voicings): render single best fallback grip per CAGED/3NPS position"
```

---

## Task 5: Phase 2 — neck-spread fallback for position-less patterns

**Files:**
- Modify: `src/store/voicingFallbackAtoms.ts`
- Test: `src/store/voicingFallbackAtoms.test.ts`

- [ ] **Step 1: Write the failing Phase 2 atom tests**

Append to `src/store/voicingFallbackAtoms.test.ts`:

```ts
describe("fallbackVoicingMatchesAtom — neck spread in Scale None (Phase 2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a non-empty fallback spread for a no-template chord (C6) in Scale None", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "6" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    const matches = store.get(fallbackVoicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.isFallback === true)).toBe(true);
  });

  it("returns a non-empty spread for a power chord in Scale None", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "5" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(fallbackVoicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it("stays empty for a CAGED-able chord (C major) in Scale None — a full template exists", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });
});
```

Also **tighten** the existing test "returns empty when no fingering pattern is active" (currently lines 45-49) so it stays deterministic under the new path — pin a CAGED-able chord that has a full template:

```ts
  it("returns empty in 'none' pattern when the active chord has a full template", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });
```

(Remove the old `createStore()`-based version of that test; `makeAtomStore`, `rootNoteAtom`, `scaleNameAtom`, `progressionStepsAtom`, `progressionWith` are already imported in this file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/store/voicingFallbackAtoms.test.ts -t "neck spread in Scale None"`
Expected: FAIL — C6 and power-chord cases return `[]` (no position-less path yet).

- [ ] **Step 3: Add the neck-spread activation atom**

In `src/store/voicingFallbackAtoms.ts`, after `fallbackContextActiveAtom` (around line 58), add:

```ts
/**
 * Phase 2: the position-less fallback path. Active in Full mode when the active
 * chord has NO full-chord template (voicingMatchesAtom empty) AND there is no
 * single active CAGED/3NPS position to scope to (Scale None, multi-shape CAGED,
 * one-string / two-strings modes). Mutually exclusive with the polygon/box
 * paths, which require an active position.
 */
const neckSpreadFallbackActiveAtom = atom((get): boolean => {
  if (get(voicingAtom) !== "full") return false;
  if (get(chordOverlayHiddenAtom)) return false;
  if (get(activePositionAtom)) return false;
  if (get(voicingMatchesAtom).length > 0) return false;
  return true;
});
```

Add the imports needed for this atom (extend the existing import blocks):

- From `./chordOverlayAtoms`, `voicingMatchesAtom` and `closeCandidatesAllStringSetsAtom` and `effectiveStringSetAtom` and `chordOverlayHiddenAtom` are already imported (lines 26-31). No change.
- From `@fretflow/core`, add `selectNeckSpread`:

```ts
import { selectNeckSpread } from "@fretflow/core";
```

- [ ] **Step 4: Wire the neck-spread branch into `fallbackVoicingMatchesAtom`**

In `src/store/voicingFallbackAtoms.ts`, replace the early-return guard at the top of `fallbackVoicingMatchesAtom` (currently lines 164-167):

```ts
export const fallbackVoicingMatchesAtom = atom((get): Voicing[] => {
  const polygons = get(fallbackPolygonsAtom);
  const boxBounds = get(fallback3NpsBoxBoundsAtom);

  if (polygons.length === 0 && boxBounds === null) {
    // Phase 2: no active position — spread best grips across the neck instead.
    if (!get(neckSpreadFallbackActiveAtom)) return memoizeFallbackVoicings([]);
    const allCloses = get(closeCandidatesAllStringSetsAtom);
    const stringSet = new Set(get(effectiveStringSetAtom));
    const closes =
      stringSet.size === 6
        ? allCloses
        : allCloses.filter((v) => v.notes.every((n) => stringSet.has(n.stringIndex)));
    if (closes.length === 0) return memoizeFallbackVoicings([]);
    const spread = selectNeckSpread(closes).map((v) => ({ ...v, isFallback: true as const }));
    return memoizeFallbackVoicings(spread);
  }
```

Leave the remainder of the function (the `allCloses`/`stringSet`/`closes` block for the polygon path and the `if (boxBounds !== null) … else …` from Task 4) unchanged below this guard.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/store/voicingFallbackAtoms.test.ts`
Expected: PASS — all Phase 2 tests plus the tightened "none pattern" test and the existing suites.

- [ ] **Step 6: Commit**

```bash
git add src/store/voicingFallbackAtoms.ts src/store/voicingFallbackAtoms.test.ts
git commit -m "feat(voicings): add neck-spread fallback for Scale None and position-less patterns"
```

---

## Task 6: Integration regression-lock + stale-comment fix

**Files:**
- Modify: `src/store/voicingFallbackAtoms.ts:5` (comment only)
- Test: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Write the failing end-to-end pipeline test**

Append to `src/store/chordOverlayAtoms.test.ts`. First confirm the file's existing imports; add any missing ones from this list at the top:

```ts
import { createStore } from "jotai";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import { voicingAtom, visibleVoicingMatchesAtom } from "./chordOverlayAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { progressionStepsAtom } from "./progressionAtoms";
import type { ProgressionStep } from "../progressions/progressionDomain";
import type { DegreeId } from "@fretflow/core";

const STEP_DEFAULTS = {
  duration: { value: 1, unit: "bar" as const },
  qualityOverride: null,
  manualRoot: null,
};
function progressionWith(
  patch: Partial<Omit<ProgressionStep, "id">> & { degree: DegreeId },
): ProgressionStep[] {
  return [{ id: "step-1", ...STEP_DEFAULTS, ...patch }];
}
```

Then the tests:

```ts
describe("visibleVoicingMatchesAtom — Full + Scale None fallback (regression 2026-06-03)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("C6 + Scale None + Full renders connector voicings (was zero)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "6" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(visibleVoicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it("power chord + Scale None + Full renders connector voicings", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "5" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(visibleVoicingMatchesAtom).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it passes (Tasks 1-5 already make it green)**

Run: `pnpm exec vitest run src/store/chordOverlayAtoms.test.ts -t "Scale None fallback"`
Expected: PASS. (If it fails, the upstream wiring in Tasks 4-5 is incomplete — fix there, not here.)

- [ ] **Step 3: Fix the stale spec reference comment**

In `src/store/voicingFallbackAtoms.ts:5`, update the comment path:

Old:
```ts
 * See docs/superpowers/specs/2026-05-26-close-voicing-fallback-design.md.
```
New:
```ts
 * See docs/superpowers/specs/2026-06-03-full-voicing-fallback-design.md.
```

- [ ] **Step 4: Commit**

```bash
git add src/store/chordOverlayAtoms.test.ts src/store/voicingFallbackAtoms.ts
git commit -m "test(voicings): lock C6/power Full+Scale-None connector regression"
```

---

## Task 7: Full verification + visual snapshot refresh

**Files:** none (verification + generated snapshots).

- [ ] **Step 1: Run the full unit/component suite**

Run: `pnpm run test`
Expected: PASS, no regressions.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: PASS (eslint + stylelint).

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build`).

- [ ] **Step 4: Refresh visual snapshots for the changed connector rendering**

The de-clutter (Phase 1) and the new Scale-None spread (Phase 2) change `fretboard-svg` output. Regenerate darwin snapshots:

Run: `pnpm run test:visual:update`
Then inspect the diff: confirm a previously-cluttered in-position scenario now shows one clean grip, and a Full + Scale None sixth/extended chord now shows a clean spread.

- [ ] **Step 5: Run the visual suite to confirm green against the new snapshots**

Run: `pnpm run test:visual`
Expected: PASS.

- [ ] **Step 6: Commit the refreshed snapshots**

```bash
git add e2e
git commit -m "test(visual): refresh fretboard-svg snapshots for fallback connector changes"
```

---

## Self-Review Notes

- **Spec coverage:** Phase 1 scorer → Task 1; single-grip render → Task 4. Phase 2 gate + neck spread → Tasks 2, 5. Phase 3 power chords → Task 3. Regression-lock for the reported C6 bug → Task 6. Visual refresh → Task 7. All spec sections map to a task.
- **Type/name consistency:** `scoreCloseVoicing`, `compareCloseVoicings`, `selectNeckSpread`, `CLOSE_VOICING_SCORE_WEIGHTS`, `HIGH_NECK_THRESHOLD`, `NECK_SPREAD_OVERLAP_TOLERANCE`, `neckSpreadFallbackActiveAtom` are used identically across tasks. Selectors keep their existing names (`selectCloseFallbacksForCagedPosition` / `…ForThreeNpsPosition`).
- **Mutual exclusion:** the polygon/box paths require `activePositionAtom`; the neck-spread path requires `!activePositionAtom` — they never both fire, so `fallbackVoicingMatchesAtom` returns one source.
- **Out of scope (unchanged):** `FULL_CHORD_TEMPLATES`, full-chord matching, the off/close/full toggle, and 3-note (doubled-root) power chords.
```
