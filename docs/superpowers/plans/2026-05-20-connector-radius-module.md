# Shared Connector-Radius Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the connector-radius constants and pure helpers currently defined in `useChordConnectorPolylines.ts` and consumed by `useIntervalConnectorPolylines.ts` into a new `connectorRadius.ts` module so neither hook owns the other's geometry. Net reduction: ~30–40 LOC, with a clean ownership boundary between the two hooks.

**Architecture:** Today `useChordConnectorPolylines.ts` (971 LOC) defines the constants and pure functions; `useIntervalConnectorPolylines.ts` imports them across hooks, which is an awkward cross-hook dependency. The new module lives next to `pathGeometry.ts` (under `src/components/FretboardSVG/utils/`) — pure geometry, React-free, importable by both hooks symmetrically.

**Tech Stack:** TypeScript, no runtime dependencies.

---

## File Structure

- Create: `src/components/FretboardSVG/utils/connectorRadius.ts` — pure helpers + constants
- Create: `src/components/FretboardSVG/utils/connectorRadius.test.ts` — unit tests for the pure helpers
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` — delete local copies, import from utils
- Modify: `src/components/FretboardSVG/hooks/useIntervalConnectorPolylines.ts` — switch import path

---

## Inventory (current state, from `useChordConnectorPolylines.ts`)

| Symbol | Lines | Type | Move? |
|---|---|---|---|
| `CHORD_CONNECTOR_BASE_RADIUS_FACTOR` | 175 | constant `0.42` | yes |
| `CHORD_CONNECTOR_RADIUS_FACTORS` | 180–184 | object | yes |
| `ConnectorYBounds` | (type referenced by util fns) | type | yes |
| `clampConnectorRadiusToYBounds` | 195–215 | pure fn | yes |
| `resolveConnectorRadiusPx` | 217–231 | pure fn | yes |
| `applyConnectorRadiusFloor` | 253–261 | pure fn | yes |
| `computeChordConnectorRadiusPx` | 270–280 | pure fn | yes (composes the others) |

`useIntervalConnectorPolylines.ts` currently imports `applyConnectorRadiusFloor`, `CHORD_CONNECTOR_RADIUS_FACTORS`, `resolveConnectorRadiusPx`, and the `ConnectorYBounds` type from the chord hook (`useChordConnectorPolylines.ts` lines 4–9).

---

### Task 1: Create `connectorRadius.ts` with constants and the `ConnectorYBounds` type

**Files:**
- Create: `src/components/FretboardSVG/utils/connectorRadius.ts`
- Create: `src/components/FretboardSVG/utils/connectorRadius.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/FretboardSVG/utils/connectorRadius.test.ts
import { describe, it, expect } from "vitest";
import {
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
  CHORD_CONNECTOR_RADIUS_FACTORS,
} from "./connectorRadius";

describe("connectorRadius constants", () => {
  it("exposes the base radius factor", () => {
    expect(CHORD_CONNECTOR_BASE_RADIUS_FACTOR).toBe(0.42);
  });
  it("exposes density-keyed radius factors in monotonic order", () => {
    expect(CHORD_CONNECTOR_RADIUS_FACTORS.compact).toBeLessThan(CHORD_CONNECTOR_RADIUS_FACTORS.medium);
    expect(CHORD_CONNECTOR_RADIUS_FACTORS.medium).toBeLessThan(CHORD_CONNECTOR_RADIUS_FACTORS.max);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm vitest run src/components/FretboardSVG/utils/connectorRadius.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `src/components/FretboardSVG/utils/connectorRadius.ts`:

```ts
export const CHORD_CONNECTOR_BASE_RADIUS_FACTOR = 0.42;

export const CHORD_CONNECTOR_RADIUS_FACTORS = {
  compact: 0.34,
  medium: 0.38,
  max: 0.42,
} as const;

export interface ConnectorYBounds {
  top: number;
  bottom: number;
}
```

(If `ConnectorYBounds` has a different shape in the source file, copy it verbatim — Task 2 will use the same definition; do not redefine here.)

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG/utils/connectorRadius.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/connectorRadius.ts src/components/FretboardSVG/utils/connectorRadius.test.ts
git commit -m "feat(svg): scaffold connectorRadius utils module"
```

---

### Task 2: Move `clampConnectorRadiusToYBounds`

**Files:**
- Modify: `src/components/FretboardSVG/utils/connectorRadius.ts`
- Modify: `src/components/FretboardSVG/utils/connectorRadius.test.ts`

- [ ] **Step 1: Read source lines 195–215 of `useChordConnectorPolylines.ts`**

Identify the exact body and signature of `clampConnectorRadiusToYBounds`. Note its return type and any helpers it calls (it should be self-contained — if not, STOP and reassess scope).

- [ ] **Step 2: Write the failing test**

Append to `connectorRadius.test.ts`:

```ts
import { clampConnectorRadiusToYBounds } from "./connectorRadius";

describe("clampConnectorRadiusToYBounds", () => {
  it("returns the requested radius when bounds allow it", () => {
    const r = clampConnectorRadiusToYBounds(10, { top: 0, bottom: 100 }, 50);
    expect(r).toBe(10);
  });
  it("shrinks the radius to fit between centerY and top bound", () => {
    const r = clampConnectorRadiusToYBounds(40, { top: 0, bottom: 100 }, 5);
    expect(r).toBeLessThanOrEqual(5);
  });
  it("shrinks the radius to fit between centerY and bottom bound", () => {
    const r = clampConnectorRadiusToYBounds(40, { top: 0, bottom: 100 }, 95);
    expect(r).toBeLessThanOrEqual(5);
  });
});
```

(Adjust the test inputs to match the actual signature read in Step 1 — the contract above assumes `(radius, bounds, centerY)`; if it's different, mirror the real shape.)

- [ ] **Step 3: Verify failure**

Run: `pnpm vitest run src/components/FretboardSVG/utils/connectorRadius.test.ts`
Expected: FAIL — function not exported.

- [ ] **Step 4: Move the function**

Copy the function body verbatim from `useChordConnectorPolylines.ts:195-215` into `connectorRadius.ts` and add the `export` keyword. Delete the original from the hook file. If `useChordConnectorPolylines.ts` still references it, add an import:

```ts
import { clampConnectorRadiusToYBounds } from "../utils/connectorRadius";
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG`
Expected: all PASS — both the new utility tests and the existing hook tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG
git commit -m "refactor(svg): move clampConnectorRadiusToYBounds to connectorRadius utils"
```

---

### Task 3: Move `resolveConnectorRadiusPx`

**Files:**
- Modify: `src/components/FretboardSVG/utils/connectorRadius.ts`
- Modify: `src/components/FretboardSVG/utils/connectorRadius.test.ts`
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`

- [ ] **Step 1: Read source lines 217–231 of the hook**

Capture the signature, body, and which constants/helpers it depends on. If it calls `clampConnectorRadiusToYBounds` (Task 2), the import chain works because both now live in `connectorRadius.ts`.

- [ ] **Step 2: Write the failing test**

Append a test that exercises `resolveConnectorRadiusPx` with a representative density (`"medium"`) and known fret spacing — copy any existing characterization values from `useChordConnectorPolylines.test.ts` if present, otherwise pick inputs that produce a known finite output and assert `Number.isFinite(result)` plus monotonicity (larger spacing → larger or equal radius).

- [ ] **Step 3: Verify failure**

Run: `pnpm vitest run src/components/FretboardSVG/utils/connectorRadius.test.ts`
Expected: FAIL — `resolveConnectorRadiusPx` not exported.

- [ ] **Step 4: Move the function**

Copy the function verbatim into `connectorRadius.ts`, export it, delete from hook file, add the import in `useChordConnectorPolylines.ts`.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG
git commit -m "refactor(svg): move resolveConnectorRadiusPx to connectorRadius utils"
```

---

### Task 4: Move `applyConnectorRadiusFloor`

**Files:**
- Modify: `src/components/FretboardSVG/utils/connectorRadius.ts`
- Modify: `src/components/FretboardSVG/utils/connectorRadius.test.ts`
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`

- [ ] **Step 1: Read source lines 253–261 of the hook**

The function is 9 LOC and likely takes `(radius, minRadius)` returning `Math.max(radius, minRadius)`-style behavior. Capture the exact contract.

- [ ] **Step 2: Write the failing test**

Append:

```ts
import { applyConnectorRadiusFloor } from "./connectorRadius";

describe("applyConnectorRadiusFloor", () => {
  it("returns the radius when it exceeds the floor", () => {
    expect(applyConnectorRadiusFloor(10, 4)).toBe(10);
  });
  it("returns the floor when the radius is below it", () => {
    expect(applyConnectorRadiusFloor(2, 4)).toBe(4);
  });
});
```

(Mirror the actual signature.)

- [ ] **Step 3: Verify failure**

Run: `pnpm vitest run src/components/FretboardSVG/utils/connectorRadius.test.ts`
Expected: FAIL.

- [ ] **Step 4: Move the function**

Same procedure as Tasks 2–3.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG
git commit -m "refactor(svg): move applyConnectorRadiusFloor to connectorRadius utils"
```

---

### Task 5: Move `computeChordConnectorRadiusPx`

**Files:**
- Modify: `src/components/FretboardSVG/utils/connectorRadius.ts`
- Modify: `src/components/FretboardSVG/utils/connectorRadius.test.ts`
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`

This function composes the three already-moved helpers. Once it's relocated, the entire radius pipeline lives in one module.

- [ ] **Step 1: Read source lines 270–280 of the hook**

- [ ] **Step 2: Write a characterization test**

Append a test that snapshots `computeChordConnectorRadiusPx(...)` output for one or two representative input vectors. Use values copied from the existing hook tests if available.

- [ ] **Step 3: Verify failure**

Run: `pnpm vitest run src/components/FretboardSVG/utils/connectorRadius.test.ts`
Expected: FAIL.

- [ ] **Step 4: Move the function**

Copy, export, delete from hook, re-import.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG
git commit -m "refactor(svg): move computeChordConnectorRadiusPx to connectorRadius utils"
```

---

### Task 6: Switch `useIntervalConnectorPolylines.ts` import path

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useIntervalConnectorPolylines.ts:4-9`

- [ ] **Step 1: Read existing imports**

Open lines 1–15. Note the current import: `from "./useChordConnectorPolylines"` (or similar relative path).

- [ ] **Step 2: Replace import**

Change the import line to:

```ts
import {
  applyConnectorRadiusFloor,
  CHORD_CONNECTOR_RADIUS_FACTORS,
  resolveConnectorRadiusPx,
  type ConnectorYBounds,
} from "../utils/connectorRadius";
```

- [ ] **Step 3: Audit the chord hook for stale re-exports**

In `useChordConnectorPolylines.ts`, ensure none of the moved symbols are still `export`ed there. If they were re-exported, delete those exports — consumers now use `connectorRadius.ts` directly.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/components/FretboardSVG`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/hooks
git commit -m "refactor(svg): point useIntervalConnectorPolylines at connectorRadius utils"
```

---

### Task 7: Full verification

- [ ] **Step 1: Lint + test + build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all green.

- [ ] **Step 2: Visual regression sanity check**

Run: `pnpm run test:visual` (darwin only).
Expected: PASS — no rendered geometry change.

- [ ] **Step 3: LOC delta**

Run: `wc -l src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts src/components/FretboardSVG/hooks/useIntervalConnectorPolylines.ts src/components/FretboardSVG/utils/connectorRadius.ts`
Expected: chord hook drops by ~70–90 LOC, interval hook unchanged or slightly smaller, new utils file ~50–70 LOC. Net reduction ~30–40 LOC.
