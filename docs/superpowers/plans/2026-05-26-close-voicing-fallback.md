# Close-Voicing Fallback in Full Mode + Overlap Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every active CAGED / 3NPS position show a chord by falling back to close voicings when no full-chord template exists; ship the prerequisite audit report first.

**Architecture:** Phase A produces a one-time research report (no runtime change) comparing every `FULL_CHORD_TEMPLATES` entry against generated close voicings. Phase B introduces pure `selectCloseFallbacksFor{Caged,ThreeNps}Position` selectors plus `fallbackVoicingMatchesAtom` + `hasFallbackPositionsAtom`, then merges fallbacks into `visibleVoicingMatchesAtom` so downstream consumers (connectors, highlight pipeline) need no changes. The string-set dropdown in `ChordOverlayControls` becomes visible in Full mode when at least one position uses a fallback.

**Tech Stack:** TypeScript, React 19, Jotai, vitest, Tonal.js (already in place via `@fretflow/core`).

**Spec:** `docs/superpowers/specs/2026-05-26-close-voicing-fallback-design.md`

---

## File Structure

**New files:**
- `scripts/audit-full-close-overlap.ts` — Node-runnable script that enumerates close and full voicings per chord quality, computes overlap, prints a markdown table to stdout.
- `docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md` — committed report (script output + commit SHA reference + appendix listing the script).
- `src/store/voicingFallbackAtoms.ts` — Holds `fallbackVoicingMatchesAtom` and `hasFallbackPositionsAtom`. Kept in a small dedicated file because the new atoms depend on `voicingSelection.ts` + a subset of `chordOverlayAtoms` (`voicingMatchesAtom`, `shapeDataAtom`, `effectiveStringSetAtom`, `chordSnapToScaleAtom`, `activePositionAtom`, `chordScopeToPositionAtom`, `fingeringPatternAtom`, `cagedShapesAtom`), and `chordOverlayAtoms.ts` is already 730+ lines.
- `src/store/voicingFallbackAtoms.test.ts` — Atom tests.

**Modified:**
- `src/hooks/voicingSelection.ts` — Add `selectCloseFallbacksForCagedPosition` + `selectCloseFallbacksForThreeNpsPosition` (mirrors existing full selectors).
- `src/hooks/voicingSelection.test.ts` (new) — Unit tests for the two new selectors. **Check whether this file exists; if not, create it with a docblock header.**
- `src/store/chordOverlayAtoms.ts` — `visibleVoicingMatchesAtom` merges `[...fullMatches, ...fallbackMatches]` in Full mode.
- `src/store/chordOverlayAtoms.test.ts` — Tests for the new branches.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — Replace `voicing === "close"` gate with `voicing === "close" || hasFallbackPositionsAtom`.
- `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` — Test the new visibility branch.
- Visual snapshots (darwin) under `e2e/__snapshots__/` if any active positions now render fallback voicings that previously rendered empty.

---

## Phase A — Overlap Audit

### Task A1: Write and run the audit script; commit the report

**Files:**
- Create: `scripts/audit-full-close-overlap.ts`
- Create: `docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md`

- [ ] **Step 1: Write the audit script**

Create `scripts/audit-full-close-overlap.ts`:

```typescript
/**
 * Audit: identifies FULL_CHORD_TEMPLATES entries that are pitch-and-position
 * identical to a generated close voicing across all 12 roots.
 *
 * Run:  pnpm tsx scripts/audit-full-close-overlap.ts > docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md
 *
 * Output is markdown — paste-ready for the research doc (the script also emits
 * a top-level title and commit-SHA placeholder; replace the placeholder before
 * committing the report).
 */
import { CHORD_DEFINITIONS, NOTES } from "../packages/core/src/theory";
import { STANDARD_TUNING } from "../packages/core/src/guitar";
import { generateVoicings } from "../packages/core/src/shapes/voicings";
import type { Voicing } from "../packages/core/src/shapes/voicings";
import { FULL_CHORD_TEMPLATES } from "../packages/core/src/shapes/templates";

const MAX_FRET = 24;
const ROOTS = NOTES; // 12 chromatic roots, sharps

/** Normalize a voicing to a frets-relative shape signature.
 *  Anchor: subtract the minimum fretted fret from every note. Returns a sorted
 *  "stringIndex:relativeFret" string. Open strings (fret 0) anchor to 0.
 */
function shapeSignature(v: Voicing): string {
  const fretted = v.notes.filter((n) => n.fretIndex > 0).map((n) => n.fretIndex);
  const anchor = fretted.length > 0 ? Math.min(...fretted) : 0;
  return v.notes
    .map((n) => `${n.stringIndex}:${n.fretIndex === 0 ? 0 : n.fretIndex - anchor}`)
    .sort()
    .join(",");
}

interface OverlapRow {
  shape: string;
  templateFrets: string;
  hasCloseEquivalent: boolean;
  stringSet: string;
}

function auditQuality(chordType: string): OverlapRow[] {
  const rows: OverlapRow[] = [];
  const templatesForQuality = FULL_CHORD_TEMPLATES.filter((t) => t.quality === chordType);

  for (const template of templatesForQuality) {
    let identicalForAllRoots = true;
    let stringSet = "";

    for (const root of ROOTS) {
      const fulls = generateVoicings({
        chordRoot: root,
        chordType,
        tuning: STANDARD_TUNING,
        maxFret: MAX_FRET,
        voicingType: "full",
      }).filter((v) => v.shape === template.shape);

      const closes = generateVoicings({
        chordRoot: root,
        chordType,
        tuning: STANDARD_TUNING,
        maxFret: MAX_FRET,
        voicingType: "close",
      });

      if (fulls.length === 0) {
        identicalForAllRoots = false;
        break;
      }

      const closeSigs = new Set(closes.map(shapeSignature));
      const matched = fulls.some((f) => closeSigs.has(shapeSignature(f)));
      if (!matched) {
        identicalForAllRoots = false;
        break;
      }

      // Capture string set from the first matching full voicing for reporting.
      if (stringSet === "") {
        const f = fulls[0];
        stringSet = f.notes.map((n) => n.stringIndex).sort().join(",");
      }
    }

    rows.push({
      shape: template.shape,
      templateFrets: JSON.stringify(template.fretsHighToLow),
      hasCloseEquivalent: identicalForAllRoots,
      stringSet,
    });
  }

  return rows;
}

function emitReport(): void {
  const qualities = Array.from(new Set(FULL_CHORD_TEMPLATES.map((t) => t.quality))).sort();

  console.log("# Full / Close Voicing Overlap Audit");
  console.log("");
  console.log("> Generated by `scripts/audit-full-close-overlap.ts` at commit `<REPLACE-WITH-HEAD-SHA>`.");
  console.log("");
  console.log("Identifies `FULL_CHORD_TEMPLATES` entries that are pitch-and-position identical to a generated close voicing (after fret-anchor normalization) across all 12 chromatic roots. Identical entries are cosmetic duplicates and candidates for deletion.");
  console.log("");

  const deletionCandidates: string[] = [];
  for (const quality of qualities) {
    console.log(`## ${quality}`);
    console.log("");
    console.log("| CAGED shape | Template fretsHighToLow | Close equivalent? | String set |");
    console.log("|---|---|---|---|");
    const rows = auditQuality(quality);
    for (const row of rows) {
      console.log(`| ${row.shape} | \`${row.templateFrets}\` | ${row.hasCloseEquivalent ? "yes" : "no"} | ${row.stringSet || "—"} |`);
      if (row.hasCloseEquivalent) {
        deletionCandidates.push(`- ${quality} / ${row.shape}-shape — \`${row.templateFrets}\``);
      }
    }
    console.log("");
  }

  console.log("## Deletion candidates");
  console.log("");
  if (deletionCandidates.length === 0) {
    console.log("_None — every full template has at least one root where it is not exactly a close voicing._");
  } else {
    for (const c of deletionCandidates) console.log(c);
  }
  console.log("");
  console.log("## Appendix — script");
  console.log("");
  console.log("Source: `scripts/audit-full-close-overlap.ts` in the same commit as this report.");
}

emitReport();
```

- [ ] **Step 2: Confirm `tsx` is available**

Run: `pnpm tsx --version`
Expected: prints a version string (or use `pnpm exec tsx --version`). If unavailable, run `pnpm add -D tsx -w` first.

- [ ] **Step 3: Run the script and write the report**

Run:
```bash
pnpm tsx scripts/audit-full-close-overlap.ts > docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md
```

- [ ] **Step 4: Replace the SHA placeholder**

Get the current HEAD SHA and substitute into the report:
```bash
SHA=$(git rev-parse HEAD)
sed -i.bak "s/<REPLACE-WITH-HEAD-SHA>/${SHA}/" docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md && rm docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md.bak
```

Verify by opening the file and confirming the SHA appears in the header line.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-full-close-overlap.ts docs/superpowers/research/2026-05-26-full-close-voicing-overlap.md
git commit -m "docs(research): audit full/close voicing overlap"
```

**Pause point.** The user reviews the report. Any template deletions motivated by the report happen in a follow-up PR before Phase B is implemented (so Phase B has fewer "no-full" positions to fall back from, but more importantly so the user's call on deletions is not blocked by Phase B work).

---

## Phase B — Runtime Fallback

### Task B1: Add `selectCloseFallbacksForCagedPosition` selector

**Files:**
- Modify: `src/hooks/voicingSelection.ts`
- Create or modify: `src/hooks/voicingSelection.test.ts`

- [ ] **Step 1: Write the failing test**

If `src/hooks/voicingSelection.test.ts` does not exist, create it with this header import block at the top:

```typescript
import { describe, it, expect } from "vitest";
import type { Voicing, ShapePolygon } from "@fretflow/core";
import {
  selectCloseFallbacksForCagedPosition,
} from "./voicingSelection";
```

Append:

```typescript
describe("selectCloseFallbacksForCagedPosition", () => {
  // Build a synthetic polygon whose per-string fret range is [3, 5] on strings 0..3,
  // closed/empty on 4..5. vertices ordering matches existing selector convention
  // (mirrored — index i and length-1-i bracket the per-string range).
  const polygon: ShapePolygon = {
    shape: "C",
    truncated: false,
    vertices: [
      { stringIndex: 0, fret: 3 },
      { stringIndex: 1, fret: 3 },
      { stringIndex: 2, fret: 3 },
      { stringIndex: 3, fret: 5 },
      { stringIndex: 4, fret: 5 },
      { stringIndex: 5, fret: 5 },
    ],
  } as unknown as ShapePolygon;

  const inside: Voicing = {
    positionKeys: ["0-4", "1-3", "2-5"],
    notes: [
      { stringIndex: 0, fretIndex: 4, noteName: "G#", midi: 68 },
      { stringIndex: 1, fretIndex: 3, noteName: "D", midi: 62 },
      { stringIndex: 2, fretIndex: 5, noteName: "G", midi: 67 },
    ],
  };

  const outside: Voicing = {
    positionKeys: ["0-7", "1-3", "2-5"],
    notes: [
      { stringIndex: 0, fretIndex: 7, noteName: "B", midi: 71 },
      { stringIndex: 1, fretIndex: 3, noteName: "D", midi: 62 },
      { stringIndex: 2, fretIndex: 5, noteName: "G", midi: 67 },
    ],
  };

  it("returns voicings whose every fretted note lies inside the polygon", () => {
    const result = selectCloseFallbacksForCagedPosition([inside, outside], polygon);
    expect(result).toEqual([inside]);
  });

  it("returns empty when no candidate fits", () => {
    const result = selectCloseFallbacksForCagedPosition([outside], polygon);
    expect(result).toEqual([]);
  });

  it("skips truncated polygons", () => {
    const truncated = { ...polygon, truncated: true } as ShapePolygon;
    const result = selectCloseFallbacksForCagedPosition([inside], truncated);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/voicingSelection.test.ts`
Expected: FAIL with "selectCloseFallbacksForCagedPosition is not a function" (or "not exported").

- [ ] **Step 3: Implement the selector**

Append to `src/hooks/voicingSelection.ts`:

```typescript
/**
 * Picks close voicings that fit entirely inside a CAGED polygon. Used when
 * the polygon has no full-chord template available, so a close voicing
 * stands in. Stricter than the full picker: requires `outsideCount === 0`.
 */
export function selectCloseFallbacksForCagedPosition(
  closeMatches: Voicing[],
  polygon: ShapePolygon,
): Voicing[] {
  if (polygon.truncated) return [];
  return closeMatches.filter((match) =>
    match.notes.every((note) => distanceOutsidePolygon(polygon, note) === 0),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/voicingSelection.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/voicingSelection.ts src/hooks/voicingSelection.test.ts
git commit -m "feat(voicing): add selectCloseFallbacksForCagedPosition"
```

---

### Task B2: Add `selectCloseFallbacksForThreeNpsPosition` selector

**Files:**
- Modify: `src/hooks/voicingSelection.ts`
- Modify: `src/hooks/voicingSelection.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/voicingSelection.test.ts`:

```typescript
import type { BoxBound } from "../components/FretboardSVG/utils/semantics";
import { selectCloseFallbacksForThreeNpsPosition } from "./voicingSelection";

describe("selectCloseFallbacksForThreeNpsPosition", () => {
  const boxBounds: BoxBound[] = [
    { minFret: 5, maxFret: 7 },
    { minFret: 5, maxFret: 7 },
    { minFret: 5, maxFret: 7 },
    { minFret: 5, maxFret: 7 },
    { minFret: 5, maxFret: 7 },
    { minFret: 5, maxFret: 7 },
  ];

  const inside: Voicing = {
    positionKeys: ["1-6", "2-7"],
    notes: [
      { stringIndex: 1, fretIndex: 6, noteName: "F", midi: 65 },
      { stringIndex: 2, fretIndex: 7, noteName: "B", midi: 71 },
    ],
  };

  const outside: Voicing = {
    positionKeys: ["1-9", "2-7"],
    notes: [
      { stringIndex: 1, fretIndex: 9, noteName: "G#", midi: 68 },
      { stringIndex: 2, fretIndex: 7, noteName: "B", midi: 71 },
    ],
  };

  it("returns voicings whose every fretted note lies inside the per-string boxBounds", () => {
    const result = selectCloseFallbacksForThreeNpsPosition([inside, outside], boxBounds);
    expect(result).toEqual([inside]);
  });

  it("returns empty when no candidate fits", () => {
    const result = selectCloseFallbacksForThreeNpsPosition([outside], boxBounds);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/voicingSelection.test.ts`
Expected: FAIL on the new describe block with "is not a function".

- [ ] **Step 3: Implement the selector**

Append to `src/hooks/voicingSelection.ts`:

```typescript
/**
 * 3NPS analogue of selectCloseFallbacksForCagedPosition. Uses per-string
 * boxBounds with chordFretSpread=0 (no buffer — fallback must fit cleanly).
 */
export function selectCloseFallbacksForThreeNpsPosition(
  closeMatches: Voicing[],
  boxBounds: BoxBound[],
): Voicing[] {
  return closeMatches.filter((match) =>
    match.notes.every((note) => {
      const b = boxBounds[note.stringIndex];
      if (!b) return false;
      return note.fretIndex >= b.minFret && note.fretIndex <= b.maxFret;
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/voicingSelection.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/voicingSelection.ts src/hooks/voicingSelection.test.ts
git commit -m "feat(voicing): add selectCloseFallbacksForThreeNpsPosition"
```

---

### Task B3: Add `fallbackVoicingMatchesAtom` and `hasFallbackPositionsAtom`

**Files:**
- Create: `src/store/voicingFallbackAtoms.ts`
- Create: `src/store/voicingFallbackAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/voicingFallbackAtoms.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import {
  chordRootAtom,
  chordTypeAtom,
  voicingAtom,
} from "./chordOverlayAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { activePositionAtom } from "./chordScope";
import {
  fallbackVoicingMatchesAtom,
  hasFallbackPositionsAtom,
} from "./voicingFallbackAtoms";

describe("fallbackVoicingMatchesAtom", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("returns empty when voicing mode is 'close'", () => {
    store.set(voicingAtom, "close");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });

  it("returns empty when voicing mode is 'off'", () => {
    store.set(voicingAtom, "off");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });

  it("returns empty when no fingering pattern is active", () => {
    store.set(voicingAtom, "full");
    store.set(fingeringPatternAtom, "none");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });

  // Full coverage of the "real fallback" path is exercised end-to-end in
  // chordOverlayAtoms.test.ts via visibleVoicingMatchesAtom — see Task B4.
  // Here we only verify the gate atoms behave.
});

describe("hasFallbackPositionsAtom", () => {
  it("is false when fallback list is empty", () => {
    const store = createStore();
    store.set(voicingAtom, "close");
    expect(store.get(hasFallbackPositionsAtom)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/voicingFallbackAtoms.test.ts`
Expected: FAIL with "Cannot find module './voicingFallbackAtoms'".

- [ ] **Step 3: Implement the atoms**

Create `src/store/voicingFallbackAtoms.ts`:

```typescript
/**
 * Atoms that compute close-voicing fallbacks for CAGED / 3NPS positions
 * lacking a full-chord template. Surfaced in Full mode only — does not
 * displace the connector source for positions where a full match exists.
 * See docs/superpowers/specs/2026-05-26-close-voicing-fallback-design.md.
 */
import { atom } from "jotai";
import type { Voicing } from "@fretflow/core";
import {
  voicingAtom,
  visibleVoicingMatchesAtom,
  closeCandidatesAllStringSetsAtom,
  effectiveStringSetAtom,
  chordOverlayHiddenAtom,
} from "./chordOverlayAtoms";
import { shapeDataAtom } from "./shapeAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { activePositionAtom } from "./chordScope";
import { cagedShapesAtom } from "./shapeAtoms";
import {
  selectCloseFallbacksForCagedPosition,
  selectCloseFallbacksForThreeNpsPosition,
  scoreFullChordForCagedPosition,
  scoreFullChordForThreeNpsPosition,
} from "../hooks/voicingSelection";
import { voicingMatchesAtom } from "./chordOverlayAtoms";

/**
 * For each active polygon / 3NPS position that has NO full-chord match,
 * the close voicings (already snap-to-scale + string-set filtered) that
 * fit inside it. Empty when voicing !== "full" or chord-overlay is hidden.
 */
export const fallbackVoicingMatchesAtom = atom((get): Voicing[] => {
  const voicing = get(voicingAtom);
  if (voicing !== "full") return [];
  if (get(chordOverlayHiddenAtom)) return [];

  const pattern = get(fingeringPatternAtom);
  if (pattern !== "caged" && pattern !== "3nps") return [];

  const activePosition = get(activePositionAtom);
  if (!activePosition) return [];

  // Source close voicings already have snap-to-scale applied; further filter
  // by user's effective string-set so the dropdown drives fallback choice.
  const allCloses = get(closeCandidatesAllStringSetsAtom);
  const stringSet = new Set(get(effectiveStringSetAtom));
  const closes = stringSet.size === 6
    ? allCloses
    : allCloses.filter((v) => v.notes.every((n) => stringSet.has(n.stringIndex)));
  if (closes.length === 0) return [];

  const fulls = get(voicingMatchesAtom);
  const result: Voicing[] = [];

  if (pattern === "caged") {
    const { shapePolygons } = get(shapeDataAtom);
    const cagedShapes = get(cagedShapesAtom);
    for (const polygon of shapePolygons) {
      if (polygon.shape !== undefined && !cagedShapes.has(polygon.shape)) continue;
      if (polygon.truncated) continue;

      // Polygon has a full match if any voicing scores against it.
      const hasFull = fulls.some((m) => scoreFullChordForCagedPosition(m, polygon, cagedShapes) !== null);
      if (hasFull) continue;

      const fallbacks = selectCloseFallbacksForCagedPosition(closes, polygon);
      for (const fb of fallbacks) {
        result.push({ ...fb, shape: polygon.shape });
      }
    }
    return result;
  }

  // 3NPS
  const { boxBounds } = get(shapeDataAtom);
  if (boxBounds.length === 0) return [];
  const hasFull = fulls.some((m) => scoreFullChordForThreeNpsPosition(m, boxBounds, 0) !== null);
  if (hasFull) return [];
  return selectCloseFallbacksForThreeNpsPosition(closes, boxBounds);
});

/**
 * True when at least one active position uses a close-voicing fallback.
 * Drives the string-set dropdown visibility gate in ChordOverlayControls.
 */
export const hasFallbackPositionsAtom = atom((get): boolean => {
  return get(fallbackVoicingMatchesAtom).length > 0;
});
```

> **Note:** This file imports `visibleVoicingMatchesAtom` to keep the dependency arrow one-way (consumers may not reverse it later by importing from `chordOverlayAtoms`). The fallback atom itself uses `voicingMatchesAtom` (raw full matches) rather than the visible-filtered set, because the question "does this polygon have a full" must be answered with the raw set — `visibleVoicingMatchesAtom` will *include* the fallback once Task B4 lands and would create a cycle.

Remove the unused `visibleVoicingMatchesAtom` import if linting flags it; it's intentionally referenced in the docstring above but not in code.

- [ ] **Step 2a: Trim unused import**

Edit the imports — remove `visibleVoicingMatchesAtom,` from the imports block in the file you just created.

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm vitest run src/store/voicingFallbackAtoms.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add src/store/voicingFallbackAtoms.ts src/store/voicingFallbackAtoms.test.ts
git commit -m "feat(voicing): add fallbackVoicingMatchesAtom + hasFallbackPositionsAtom"
```

---

### Task B4: Merge fallbacks into `visibleVoicingMatchesAtom`

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts` (the `visibleVoicingMatchesAtom` block)
- Modify: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/store/chordOverlayAtoms.test.ts` (in or after the existing `visibleVoicingMatchesAtom` describe block):

```typescript
import { fallbackVoicingMatchesAtom } from "./voicingFallbackAtoms";

describe("visibleVoicingMatchesAtom — full mode with close fallback", () => {
  it("merges full matches and fallback matches in full mode", () => {
    const store = createStore();
    // Pick a chord whose CAGED coverage we know is partial. B diminished
    // currently has dim templates for shapes other than C/G (both deleted).
    store.set(chordRootAtom, "B");
    store.set(chordTypeAtom, "dim");
    store.set(voicingAtom, "full");
    store.set(fingeringPatternAtom, "caged");
    // Use a known active position so polygons resolve. Test fixture should be
    // crafted so at least one polygon has no full match and at least one close
    // voicing fits inside it (see Task B3 + spec). If your local snapshot of
    // shapeDataAtom differs, adjust to a fixture that exhibits the same shape.
    // (Confirm by calling fallbackVoicingMatchesAtom directly first.)

    const visible = store.get(visibleVoicingMatchesAtom);
    const fallbacks = store.get(fallbackVoicingMatchesAtom);

    // Every fallback voicing must appear in the visible set.
    for (const fb of fallbacks) {
      const key = fb.positionKeys.join("|");
      expect(visible.some((v) => v.positionKeys.join("|") === key)).toBe(true);
    }
  });
});
```

> **Note on fixtures:** If `store` lookups for `shapeDataAtom` return empty in the test environment, the implementer should follow the pattern used by the existing `visibleVoicingMatchesAtom` tests in this file (which already set up `shapeDataAtom` via the helpers in `test-utils`). If no such helper exists, mock `shapeDataAtom` with a small polygon fixture matching the polygon used in `voicingSelection.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts`
Expected: FAIL — `visible` does not include fallback positions yet.

- [ ] **Step 3: Update `visibleVoicingMatchesAtom`**

Edit `src/store/chordOverlayAtoms.ts`. Locate the `visibleVoicingMatchesAtom` definition (around line 551). At the top of the file, add:

```typescript
// Lazy import to avoid module cycle (voicingFallbackAtoms imports from here).
import { fallbackVoicingMatchesAtom } from "./voicingFallbackAtoms";
```

> If the lazy-import workaround is rejected by the cycle check, use a local `get` callback inside the atom body to defer the import via `await import(...)` — but jotai atoms are synchronous, so the canonical fix is to break the cycle by moving `voicingMatchesAtom`/`closeCandidatesAllStringSetsAtom`/`effectiveStringSetAtom`/`chordOverlayHiddenAtom` to a leaf file shared by both. **Try the direct import first**; circular imports in TypeScript only break when one side uses the symbol at module-init time. Atoms read each other lazily via `get`, so a direct import is normally fine.

Replace the `return matches;` final line of `visibleVoicingMatchesAtom` with:

```typescript
const fallbacks = get(fallbackVoicingMatchesAtom);
return fallbacks.length > 0 ? [...matches, ...fallbacks] : matches;
```

(Insert just before the closing `});` of the atom. The earlier branches that return scoped CAGED/3NPS matches should also merge fallbacks. Apply the same `[...matches, ...fallbacks]` merge in those returns by extracting `const fallbacks = get(fallbackVoicingMatchesAtom);` once at the top of the atom body.)

The final shape of the atom:

```typescript
export const visibleVoicingMatchesAtom = atom((get): Voicing[] => {
  const matches = get(voicingMatchesAtom);
  const fallbacks = get(fallbackVoicingMatchesAtom);
  if (matches.length === 0 && fallbacks.length === 0) return matches;

  const pattern = get(fingeringPatternAtom);
  const activePosition = get(activePositionAtom);

  let scoped: Voicing[];
  if (pattern === "caged" && activePosition) {
    const { shapePolygons } = get(shapeDataAtom);
    const cagedShapes = get(cagedShapesAtom);
    scoped = selectFullChordMatchesForCagedPosition(matches, shapePolygons, cagedShapes);
  } else if (pattern === "3nps" && get(chordScopeToPositionAtom) && activePosition) {
    const { boxBounds } = get(shapeDataAtom);
    scoped = selectFullChordMatchesForThreeNpsPosition(matches, boxBounds, 0);
  } else {
    scoped = matches;
  }

  return fallbacks.length > 0 ? [...scoped, ...fallbacks] : scoped;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts`
Expected: PASS (all tests in this file).

- [ ] **Step 5: Commit**

```bash
git add src/store/chordOverlayAtoms.ts src/store/chordOverlayAtoms.test.ts
git commit -m "feat(voicing): merge fallback voicings into visibleVoicingMatchesAtom"
```

---

### Task B5: Show string-set picker in Full mode when fallbacks exist

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`:

```typescript
import { hasFallbackPositionsAtom } from "../../store/voicingFallbackAtoms";

describe("ChordOverlayControls — string-set picker visibility in Full mode", () => {
  it("shows the picker when hasFallbackPositionsAtom is true and voicing is full", () => {
    const store = createStore();
    store.set(voicingAtom, "full");
    // The test fixture must arrange a chord/pattern that yields a fallback.
    // Mirrors the fixture used in chordOverlayAtoms.test.ts Task B4.
    // Verify the picker label/region is present.
    renderWithStore(<ChordOverlayControls />, store);
    // Picker uses inspector.chordStringSetLabel
    expect(screen.queryByLabelText(/string set/i)).toBeInTheDocument();
  });

  it("hides the picker when voicing is full and no fallbacks exist", () => {
    const store = createStore();
    store.set(voicingAtom, "full");
    // Chord with full coverage across active positions
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "maj");
    renderWithStore(<ChordOverlayControls />, store);
    expect(screen.queryByLabelText(/string set/i)).not.toBeInTheDocument();
  });
});
```

(Adjust imports — the existing test file already imports `renderWithStore`, `screen`, `createStore`, `voicingAtom`, `chordRootAtom`, `chordTypeAtom`; add only what's missing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: FAIL on "shows the picker when hasFallbackPositionsAtom is true" — picker is currently gated on `voicing === "close"` only.

- [ ] **Step 3: Update the gate**

In `src/components/ChordOverlayControls/ChordOverlayControls.tsx`:

Add the import:
```typescript
import { hasFallbackPositionsAtom } from "../../store/voicingFallbackAtoms";
```

Add the atom read near the other `useAtomValue` calls in the component body:
```typescript
const hasFallback = useAtomValue(hasFallbackPositionsAtom);
```

Replace the line:
```typescript
{voicing === "close" ? (
```
with:
```typescript
{(voicing === "close" || (voicing === "full" && hasFallback)) ? (
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordOverlayControls/ChordOverlayControls.tsx src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
git commit -m "feat(chord-overlay): show string-set picker in full mode when fallbacks exist"
```

---

### Task B6: Visual baseline refresh

**Files:**
- Modify: snapshots under `e2e/__snapshots__/` (darwin)

- [ ] **Step 1: Run the visual suite**

Run: `pnpm test:visual:update`
Expected: Vite build succeeds, snapshots regenerate. Inspect the diff — any active position that previously rendered no chord and now renders a fallback should show a connector polyline. The string-set picker should appear in Full mode for chords that have fallback positions.

- [ ] **Step 2: Review the diff**

Run: `git status -s e2e/__snapshots__/` to see which snapshots changed. Spot-check each visual diff (open the new and old PNGs side-by-side) and confirm every change matches the expected fallback rendering. If unexpected snapshots changed, stop and investigate.

- [ ] **Step 3: Commit**

```bash
git add e2e/__snapshots__/
git commit -m "test(visual): refresh baselines for close-voicing fallback"
```

---

### Task B7: Full verification

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 2: Unit + component tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 4: E2E (production)**

Run: `pnpm test:e2e:production`
Expected: PASS.

- [ ] **Step 5: Manual smoke test**

1. `pnpm dev`
2. Pick a chord with partial CAGED coverage (e.g. B diminished after G/C dim deletions).
3. Set voicing to Full.
4. Confirm: every CAGED position shows *some* chord — full where available, close fallback where not. The string-set dropdown appears.
5. Change the string-set selection; fallback voicings update; full voicings unchanged.
6. Switch to a chord with full CAGED coverage (e.g. C major). Confirm the string-set dropdown disappears.
7. Switch to 3NPS pattern; confirm the same fallback behavior applies.

- [ ] **Step 6: No commit required** — verification only.

---

## Self-Review Notes

- **Spec coverage:**
  - Part A audit deliverable → Task A1 ✓
  - Part B trigger (no-full polygon) → Tasks B1, B2, B3 ✓
  - Picker algorithm (in-polygon + string-set filter) → Task B3 ✓
  - `fallbackVoicingMatchesAtom` + `hasFallbackPositionsAtom` → Task B3 ✓
  - `visibleVoicingMatchesAtom` merge → Task B4 ✓
  - String-set dropdown gating → Task B5 ✓
  - Visual identical-to-full → Tasks B4 + B6 (no special styling code added; existing connector rendering applies uniformly) ✓
  - Lock-to-scale inherited via `closeCandidatesAllStringSetsAtom` → Task B3 ✓
  - 3NPS symmetry → Tasks B2, B3 ✓
  - Tests for selectors, atoms, component → B1–B5 ✓
  - Visual refresh → B6 ✓
  - Full verification → B7 ✓

- **Placeholder scan:** All steps include code or exact commands. No TBDs.

- **Type consistency:** `selectCloseFallbacksForCagedPosition(matches, polygon)` and `selectCloseFallbacksForThreeNpsPosition(matches, boxBounds)` signatures match between definition (B1/B2) and usage (B3). `fallbackVoicingMatchesAtom` returns `Voicing[]` consistently. The polygon `vertices` access pattern matches the existing `distanceOutsidePolygon` helper.

- **Known risk:** The fixture used in B4 test depends on `shapeDataAtom` returning a non-empty polygon set in the test environment. If the existing test helpers don't already exercise this, the implementer may need to mock `shapeDataAtom` directly. Flagged in B4 Step 1 notes.
