# `pathGeometry.ts` JSDoc Trim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `src/components/FretboardSVG/utils/pathGeometry.ts` from 624 LOC by ~60–80 LOC by trimming JSDoc blocks that restate math the code already shows, keeping only public API contracts.

**Architecture:** No behavioral or signature changes. Each exported function keeps a concise top-line JSDoc describing inputs/outputs and any non-obvious contract (sweep-flag convention, mutation behavior). Multi-paragraph derivations of Minkowski sums, winding/shoelace formulae, and coordinate-system flips are removed; what remains is the API surface a caller needs.

**Tech Stack:** TypeScript, no runtime dependencies.

---

## File Structure

- Modify: `src/components/FretboardSVG/utils/pathGeometry.ts`
- Modify (if it exists): any co-located test file — `src/components/FretboardSVG/utils/pathGeometry.test.ts`. The plan does not change behavior; tests must continue to pass unchanged.

---

## Scope: what to keep, what to cut

| Function | Current docs | Keep | Cut |
|---|---|---|---|
| `interface Point` (L9–12) | tiny | all | none |
| `polarSort` (docs L23–27) | API contract | all | none |
| `offsetOutlinePath` (docs L42–72) | 31 lines, much math | top-line summary + return-type contract (L71–72) | L53–66 (Minkowski/winding/shoelace exposition, coordinate-flip restated) |
| `offsetOpenPolylinePath` (docs L245–290) | 46 lines, heavy math | top-line summary + sweep-flag contract + return-type contract (L289–290) | L263–281 (cross-product semantics, side A/B normal derivation, interior-corner logic restated) |
| `inflatedCapsulePath` (docs L560–576) | API contract | all | none |

Replacement docs should each be ≤6 lines of `/** … */` block: one summary line, one input/output line, plus any non-derivable contract (e.g. "uses SVG arc sweep-flag = 1 for convex fillets, the caller relies on this when stroking").

---

### Task 1: Snapshot current behavior

**Files:**
- Read: `src/components/FretboardSVG/utils/pathGeometry.ts`
- Read: `src/components/FretboardSVG/utils/pathGeometry.test.ts` (if present)

- [ ] **Step 1: Confirm a test exists for each exported function**

Run: `pnpm vitest run src/components/FretboardSVG/utils/pathGeometry`
Expected: tests exist and PASS. If no test file exists, STOP and write characterization tests before continuing — JSDoc trimming is otherwise unverifiable as no-op. (If you must write characterization tests, add a Task 1a covering `polarSort`, `offsetOutlinePath`, `offsetOpenPolylinePath`, `inflatedCapsulePath` with a handful of representative inputs and snapshot outputs.)

- [ ] **Step 2: Record baseline LOC**

Run: `wc -l src/components/FretboardSVG/utils/pathGeometry.ts`
Expected: 624 (record actual number for diff verification later).

---

### Task 2: Trim `offsetOutlinePath` JSDoc

**Files:**
- Modify: `src/components/FretboardSVG/utils/pathGeometry.ts:42-72`

- [ ] **Step 1: Read the current block**

Open the file at lines 42–72 and identify the JSDoc block immediately above `export function offsetOutlinePath`.

- [ ] **Step 2: Replace with concise block**

Replace the entire JSDoc block (lines 42–72) with:

```ts
/**
 * Returns an SVG path string outlining the Minkowski sum of `points` (CCW polygon)
 * and a circle of radius `radius`. Result has rounded convex corners and the same
 * winding direction as the input.
 *
 * @returns SVG path data starting with `M`, suitable for a `<path d=…>` attribute.
 */
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG/utils/pathGeometry`
Expected: PASS (no behavioral change).

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/utils/pathGeometry.ts
git commit -m "docs(pathGeometry): trim offsetOutlinePath JSDoc to API contract"
```

---

### Task 3: Trim `offsetOpenPolylinePath` JSDoc

**Files:**
- Modify: `src/components/FretboardSVG/utils/pathGeometry.ts:245-290`

- [ ] **Step 1: Read the current block**

Open the file at lines 245–290 (line numbers may have shifted after Task 2 — locate by the `export function offsetOpenPolylinePath` declaration).

- [ ] **Step 2: Replace with concise block**

Replace the entire JSDoc block above `export function offsetOpenPolylinePath` with:

```ts
/**
 * Returns an SVG path that traces both sides of an open polyline `points` offset
 * by `radius` on each side, with semicircular caps at the endpoints and quadratic
 * fillets at interior corners. Uses sweep-flag = 1 for convex fillets; callers
 * stroking the result rely on this orientation.
 *
 * @returns SVG path data starting with `M`, closed at the caps (no explicit `Z`).
 */
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG/utils/pathGeometry`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/utils/pathGeometry.ts
git commit -m "docs(pathGeometry): trim offsetOpenPolylinePath JSDoc to API contract"
```

---

### Task 4: Remove inline math comments inside function bodies

**Files:**
- Modify: `src/components/FretboardSVG/utils/pathGeometry.ts` (function bodies of `offsetOutlinePath` and `offsetOpenPolylinePath`)

This step is optional polish. Many redundant inline comments inside the two large functions explain math that variable names already convey (e.g. `// cross product determines turn direction`, `// flip y because SVG y grows downward`). Remove only comments that restate the immediately-following line; keep comments that name a non-obvious step or cite a corner case (e.g. "collinear points: fall through to straight segment").

- [ ] **Step 1: Scan each function body**

Read `offsetOutlinePath` body and `offsetOpenPolylinePath` body. For each comment, ask: "Could a reader infer this from the next 1–2 lines?" If yes, delete. If no, keep.

- [ ] **Step 2: Apply deletions**

Use the Edit tool per comment block; do not batch large deletions.

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG/utils/pathGeometry`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/utils/pathGeometry.ts
git commit -m "docs(pathGeometry): drop redundant inline comments restating code"
```

---

### Task 5: Verify LOC delta and full test pass

- [ ] **Step 1: Measure LOC reduction**

Run: `wc -l src/components/FretboardSVG/utils/pathGeometry.ts`
Expected: ~544–564 (baseline 624 minus 60–80).

- [ ] **Step 2: Full verification**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all green.

- [ ] **Step 3: Visual regression sanity check**

Run: `pnpm run test:visual` (darwin only — skip on linux).
Expected: PASS — geometry output is byte-identical, so visual snapshots must not move.
