# Chord Transition Performance — Connector Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the connector-layer stutter during progression chord changes by shortening the overlap animation, removing redundant per-path opacity transitions, and preventing topology recomputation on geometry-only rerenders.

**Architecture:** Keep the public connector output (`ChordConnectorVoicing[]`) unchanged, but simplify the transition path in three layers: make `FretboardConnectorLayer` crossfade instead of wait-then-enter, remove the CSS transition that duplicates the group fade, and split `useChordConnectorPolylines` into a topology memo plus a pixel-geometry memo. The expensive O(N²) collision graph should depend only on musical inputs (`noteData`, `chordToneNames`, `explicitVoicings`, `voicingSourceActive`); zoom/scroll helpers should only rebuild the final SVG path strings.

**Tech Stack:** React 19, TypeScript, Framer Motion (`motion/react`), CSS Modules, Vitest, Testing Library, `useMemo`.

---

## Scope check

This spec stays inside one subsystem: the fretboard SVG connector layer. The animation, CSS, and hook refactor are independent fixes, but they all land in `src/components/FretboardSVG/` and should be implemented in one plan because they ship together and are verified by the same connector-focused test surface.

## File map

**Modify**

- `src/components/FretboardSVG/FretboardConnectorLayer.tsx` — change the connector-group `AnimatePresence` from sequential exit/enter to a crossfade.
- `src/components/FretboardSVG/FretboardConnectorLayer.test.tsx` — add a targeted motion mock so the test can assert the `AnimatePresence` mode without depending on Framer Motion internals.
- `src/components/FretboardSVG/FretboardSVG.module.css` — remove the redundant `opacity` transition from `.chord-connector-path` so the group fade is the only opacity animation.
- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` — extract a geometry-independent pending-voicing stage and a geometry-dependent pixel-path stage; wire the hook through two `useMemo` calls.
- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts` — add regression coverage for the new topology helpers and for geometry-only rerenders.

**Public API that must stay unchanged**

- `ChordConnectorVoicing` shape (`paths`, `vertices`, `paletteIndex`, `shape`, `voicingKey`)
- `UseChordConnectorPolylinesParams`
- `FretboardConnectorLayer` props

**Do not change**

- `motionKey` construction in `FretboardConnectorLayer`
- connector radius math in `src/components/FretboardSVG/utils/connectorRadius.ts`
- path generation in `src/components/FretboardSVG/utils/pathGeometry.ts`
- interval-connector behavior

## Reused patterns

- `renderHook` + `rerender` from `@testing-library/react` in `useChordConnectorPolylines.test.ts`
- SVG wrapper pattern already used in `FretboardConnectorLayer.test.tsx`
- existing `useMemo`-backed hook style in the fretboard hooks directory

## Tasks

### Task 1: Crossfade chord connector groups instead of waiting for exit

**Files:**
- Modify: `src/components/FretboardSVG/FretboardConnectorLayer.tsx`
- Test: `src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`

- [ ] **Step 1: Write the failing test**

At the top of `src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`, replace the `motion/react` import with a mock that captures `AnimatePresence` props while still rendering normal SVG markup:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { FretboardConnectorLayer } from "./FretboardConnectorLayer";
import type { ChordConnectorVoicing } from "./hooks/useChordConnectorPolylines";
import type { CagedShape } from "@fretflow/core";

const animatePresenceModes: Array<string | undefined> = [];

vi.mock("motion/react", () => ({
  AnimatePresence: ({
    children,
    mode,
  }: {
    children: React.ReactNode;
    mode?: string;
  }) => {
    animatePresenceModes.push(mode);
    return <>{children}</>;
  },
  motion: {
    g: ({
      children,
      ...props
    }: React.SVGProps<SVGGElement> & { children?: React.ReactNode }) => (
      <g {...props}>{children}</g>
    ),
  },
}));

afterEach(() => {
  animatePresenceModes.length = 0;
});
```

Then append this regression near the bottom of the file:

```tsx
it("uses sync mode so entering and exiting connector groups crossfade", () => {
  const polylines = [makePolyline("0,5|1,5|2,5", "E")];

  renderInSvg(
    <FretboardConnectorLayer
      {...BASE_PROPS}
      chordPolylines={polylines}
      connectorMotionMode="group"
    />,
  );

  expect(animatePresenceModes).toContain("sync");
  expect(animatePresenceModes).not.toContain("wait");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx -t "uses sync mode"`

Expected: FAIL because `animatePresenceModes` contains `"wait"`.

- [ ] **Step 3: Implement the one-line motion change**

In `src/components/FretboardSVG/FretboardConnectorLayer.tsx`, change the connector wrapper from:

```tsx
<AnimatePresence mode="wait">
```

to:

```tsx
<AnimatePresence mode="sync">
```

Do not change `motionKey`, `initial`, `animate`, `exit`, or `transition`.

- [ ] **Step 4: Run the targeted test and the full file**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`

Expected: PASS. Existing rendering tests still pass, and the new regression proves the layer now crossfades.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardConnectorLayer.tsx src/components/FretboardSVG/FretboardConnectorLayer.test.tsx
git commit -m "perf(connectors): crossfade chord connector groups"
```

---

### Task 2: Remove the redundant per-path opacity transition

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

- [ ] **Step 1: Remove the duplicate opacity animation**

In `src/components/FretboardSVG/FretboardSVG.module.css`, replace:

```css
.chord-connector-path {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
```

with:

```css
.chord-connector-path {
  transition: transform 0.2s ease;
}
```

This preserves any future transform animation while ensuring opacity is driven only by the parent `<motion.g>`.

- [ ] **Step 2: Run focused linting and connector tests**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
pnpm run lint
```

Expected:

- Vitest passes unchanged (no DOM contract changes).
- Lint passes; no CSS syntax/stylelint regressions.

- [ ] **Step 3: Run the visual regression suite that covers fretboard overlays**

Run: `pnpm run test:visual -- --grep "fretboard|overlay"`

Expected: PASS with no visible connector fade regression; fades should look the same or smoother, without a second per-path opacity ramp.

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "perf(connectors): remove per-path opacity transition"
```

---

### Task 3: Split connector topology from pixel geometry

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`
- Test: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

- [ ] **Step 1: Write the failing tests for the topology/pixel split**

Append these tests to `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`:

```ts
import {
  buildChordConnectorPolylines,
  buildPendingChordConnectorVoicings,
  buildPixelChordConnectorVoicings,
  MAX_PLAYABLE_FRET_POSITIONS,
  CHORD_TONE_CLASSES,
  useChordConnectorPolylines,
} from "./useChordConnectorPolylines";
```

Add this new describe block near the bottom of the file:

```ts
describe("connector topology memo split", () => {
  it("builds pending generated voicings without pixel geometry inputs", () => {
    const pending = buildPendingChordConnectorVoicings({
      noteData: notes([
        [0, 5, "C", "chord-root"],
        [1, 5, "E"],
        [2, 5, "G"],
      ]),
      chordToneNames: ["C", "E", "G"],
    });

    expect(pending).toEqual([
      expect.objectContaining({
        canonicalKey: "0,5|1,5|2,5",
        voicingKey: "0,5|1,5|2,5",
        paletteIndex: 0,
        noteCoords: [
          { stringIndex: 0, fretIndex: 5 },
          { stringIndex: 1, fretIndex: 5 },
          { stringIndex: 2, fretIndex: 5 },
        ],
      }),
    ]);
  });

  it("rebuilds pixel vertices when geometry helpers change but preserves voicing identity", () => {
    const noteData = notes([
      [0, 5, "C", "chord-root"],
      [1, 5, "E"],
      [2, 5, "G"],
    ]);
    const firstFretCenterX = (fi: number) => fi * 10;
    const secondFretCenterX = (fi: number) => fi * 20;
    const firstStringYAt = (si: number, _x: number) => si * 20;
    const secondStringYAt = (si: number, _x: number) => si * 25;

    const { result, rerender } = renderHook(
      ({
        fretCenterX,
        stringYAt,
      }: {
        fretCenterX: (fretIndex: number) => number;
        stringYAt: (stringIndex: number, x: number) => number;
      }) =>
        useChordConnectorPolylines({
          noteData,
          chordToneNames: ["C", "E", "G"],
          fretCenterX,
          stringYAt,
          stringRowPx: STRING_ROW_PX,
        }),
      {
        initialProps: {
          fretCenterX: firstFretCenterX,
          stringYAt: firstStringYAt,
        },
      },
    );

    expect(result.current[0]?.voicingKey).toBe("0,5|1,5|2,5");
    expect(result.current[0]?.vertices).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 20 },
      { x: 50, y: 40 },
    ]);

    rerender({
      fretCenterX: secondFretCenterX,
      stringYAt: secondStringYAt,
    });

    expect(result.current[0]?.voicingKey).toBe("0,5|1,5|2,5");
    expect(result.current[0]?.vertices).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 25 },
      { x: 100, y: 50 },
    ]);
  });

  it("keeps the pure builder output identical after the refactor", () => {
    const noteData = notes([
      [0, 5, "C", "chord-root"],
      [1, 5, "E"],
      [2, 5, "G"],
    ]);
    const pending = buildPendingChordConnectorVoicings({
      noteData,
      chordToneNames: ["C", "E", "G"],
    });

    const pixel = buildPixelChordConnectorVoicings({
      pendingVoicings: pending,
      fretCenterX,
      stringYAt,
      stringRowPx: STRING_ROW_PX,
    });

    expect(pixel).toEqual(
      buildChordConnectorPolylines(
        noteData,
        ["C", "E", "G"],
        fretCenterX,
        stringYAt,
        STRING_ROW_PX,
      ),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts -t "connector topology memo split"`

Expected: FAIL because `buildPendingChordConnectorVoicings` and `buildPixelChordConnectorVoicings` do not exist yet.

- [ ] **Step 3: Introduce the intermediate topology types**

Near the `ChordConnectorVoicing` definition in `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`, add these types:

```ts
interface NormalizedChordConnectorVertex {
  stringIndex: number;
  fretIndex: number;
}

interface PendingChordConnectorVoicing {
  canonicalKey: string;
  voicingKey: string;
  noteCoords: NormalizedChordConnectorVertex[];
  sourceCombo: NoteData[];
  paletteIndex: number;
  offsetPx: number;
  shape?: CagedShape;
}
```

`noteCoords` must stay geometry-independent so the expensive collision-graph stage does not depend on `fretCenterX` or `stringYAt`.

- [ ] **Step 4: Extract the generated-topology builder**

Replace the current collection logic inside `buildChordConnectorPolylines(...)` with a new exported helper:

```ts
export function buildPendingChordConnectorVoicings({
  noteData,
  chordToneNames,
  explicitVoicings,
  voicingSourceActive,
}: {
  noteData: NoteData[];
  chordToneNames: string[];
  explicitVoicings?: ExplicitChordConnectorVoicing[];
  voicingSourceActive?: boolean;
}): PendingChordConnectorVoicing[] {
  if (explicitVoicings && explicitVoicings.length > 0) {
    return explicitVoicings.map((voicing) => {
      const sourceCombo = createExplicitSourceCombo(voicing.notes)
        .sort((left, right) => left.stringIndex - right.stringIndex);
      const canonicalKey = voicing.notes
        .map((note) => `${note.stringIndex},${note.fretIndex}`)
        .sort()
        .join("|");

      return {
        canonicalKey,
        voicingKey: voicing.voicingKey,
        noteCoords: sourceCombo.map((note) => ({
          stringIndex: note.stringIndex,
          fretIndex: note.fretIndex,
        })),
        sourceCombo,
        paletteIndex: V2_PALETTE_INDEX,
        offsetPx: 0,
        shape: voicing.shape,
      };
    });
  }

  if (voicingSourceActive) return [];

  // Move the existing generated-voicing scan here, but collect
  // `noteCoords` instead of `{x, y}` vertices.
  // Keep the exact filtering, dedupe, and playability logic unchanged.
}
```

The generated branch should reuse the existing:

- active-tone filtering
- N-string window scan
- required chord-tone coverage check
- `voicingFrettedPositionCount`
- canonical-key dedupe

Before returning, assign `offsetPx` once in this topology stage. Refactor `assignConflictOffsets(...)` so it can operate on normalized fret/string coordinates rather than current pixel vertices:

```ts
function toTopologyVertices(
  noteCoords: NormalizedChordConnectorVertex[],
): ChordConnectorVertex[] {
  return noteCoords.map(({ fretIndex, stringIndex }) => ({
    x: fretIndex,
    y: stringIndex,
  }));
}
```

Then assign offsets from the normalized pending list:

```ts
const pendingWithoutOffsets = /* collected pending voicings */;
const lowestStringIndex = pendingWithoutOffsets.reduce(
  (max, voicing) =>
    Math.max(max, ...voicing.noteCoords.map((note) => note.stringIndex)),
  0,
);
const offsetMap = assignConflictOffsets(
  pendingWithoutOffsets.map((voicing) => ({
    rawVertices: toTopologyVertices(voicing.noteCoords),
    sourceCombo: voicing.sourceCombo,
    canonicalKey: voicing.canonicalKey,
    shape: voicing.shape,
  })),
  1,
  undefined,
  lowestStringIndex,
);

return pendingWithoutOffsets.map((voicing) => ({
  ...voicing,
  offsetPx: offsetMap.get(voicing.canonicalKey) ?? 0,
}));
```

The important behavior change is **where** the conflict graph runs, not the public output: once per voicing-set change, never on geometry-only rerenders.

- [ ] **Step 5: Extract the pixel-path builder**

Add a second exported helper below the pending builder:

```ts
export function buildPixelChordConnectorVoicings({
  pendingVoicings,
  fretCenterX,
  stringYAt,
  stringRowPx,
  yBounds,
}: {
  pendingVoicings: PendingChordConnectorVoicing[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  stringRowPx: number;
  yBounds?: ConnectorYBounds;
}): ChordConnectorVoicing[] {
  if (pendingVoicings.length === 0) return [];

  const pixelPendingVoicings = pendingVoicings.map((voicing) => {
    const rawVertices = voicing.noteCoords.map((note) => {
      const x = fretCenterX(note.fretIndex);
      const y = stringYAt(note.stringIndex, x);
      return { x, y };
    });

    return {
      rawVertices,
      sourceCombo: voicing.sourceCombo,
      paletteIndex: voicing.paletteIndex,
      canonicalKey: voicing.canonicalKey,
      offsetPx: voicing.offsetPx,
      voicingKey: voicing.voicingKey,
      shape: voicing.shape,
    };
  });

  return finalizeChordConnectorPolylines(pixelPendingVoicings, stringRowPx, yBounds);
}
```

Refactor `computeFinalConnectorRadii(...)` so it no longer calls `assignConflictOffsets(...)`. Instead, it should:

1. read `offsetPx` from each pending voicing,
2. apply that offset to the base preferred radius,
3. keep only the post-clamp collision fix that compares final pixel radii after `resolveConnectorRadiusPx(...)`.

The pre-clamp O(N²) graph must be gone from this stage.

Do **not** invent a new finalizer. Reuse the existing file-local helper already present later in the file:

```ts
function finalizeChordConnectorPolylines(
  pendingVoicings: Array<{
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
    paletteIndex: number;
    canonicalKey: string;
    voicingKey: string;
    offsetPx: number;
    shape?: CagedShape;
  }>,
  stringRowPx: number,
  yBounds?: ConnectorYBounds,
): ChordConnectorVoicing[]
```

Update that existing helper's input type to include `offsetPx`, then make it call the refactored `computeFinalConnectorRadii(...)`. The output shape stays unchanged.

- [ ] **Step 6: Recompose the pure builder and the hook**

Rewrite `buildChordConnectorPolylines(...)` as a composition of the two helpers:

```ts
export function buildChordConnectorPolylines(
  noteData: NoteData[],
  chordToneNames: string[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  stringRowPx: number,
  yBounds?: ConnectorYBounds,
): ChordConnectorVoicing[] {
  const pendingVoicings = buildPendingChordConnectorVoicings({
    noteData,
    chordToneNames,
  });

  return buildPixelChordConnectorVoicings({
    pendingVoicings,
    fretCenterX,
    stringYAt,
    stringRowPx,
    yBounds,
  });
}
```

Then rewrite `useChordConnectorPolylines(...)` to use two `useMemo`s:

```ts
const pendingVoicings = useMemo(
  () =>
    buildPendingChordConnectorVoicings({
      noteData,
      chordToneNames,
      explicitVoicings,
      voicingSourceActive,
    }),
  [noteData, chordToneNames, explicitVoicings, voicingSourceActive],
);

return useMemo(
  () =>
    buildPixelChordConnectorVoicings({
      pendingVoicings,
      fretCenterX,
      stringYAt,
      stringRowPx,
      yBounds,
    }),
  [pendingVoicings, fretCenterX, stringYAt, stringRowPx, yBounds],
);
```

This is the critical perf fix: changing zoom/scroll functions should reuse `pendingVoicings` and only rebuild the pixel output.

- [ ] **Step 7: Run the targeted test file**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

Expected: PASS. Existing connector-geometry behavior remains intact, and the new regressions prove the refactor preserved output while splitting the topology stage.

- [ ] **Step 8: Run the connected rendering tests**

Run:

```bash
pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
pnpm run build
```

Expected:

- Connector-layer tests pass with the new hook implementation.
- Production build passes; exported helper changes did not break type-check or bundling.

- [ ] **Step 9: Commit**

```bash
git add src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts
git commit -m "perf(connectors): split connector topology from pixel geometry"
```

---

### Task 4: Final verification

**Files:**
- Modify: none
- Test: repository verification only

- [ ] **Step 1: Run the full targeted quality sweep**

Run:

```bash
pnpm run lint
pnpm run test
pnpm run build
```

Expected:

- Lint passes.
- Test suite passes.
- Build passes.

- [ ] **Step 2: Review the runtime behavior manually**

Run: `pnpm run dev`

In the browser:

1. Open a progression with chord connectors visible.
2. Start playback and watch a dense connector change (10+ visible connector paths is the stress case).
3. Zoom or scroll the fretboard during playback.

Expected:

- Connector group fades in/out as one crossfade, not exit-then-enter.
- No per-path opacity shimmer on fill/outline layers.
- Zoom/scroll no longer stalls the first frame of the next chord transition.

- [ ] **Step 3: Commit any remaining snapshot or config updates only if the verification commands produced them**

```bash
git status --short
```

Expected: only the intentional connector-layer files are modified. If visual tests generated snapshot updates unexpectedly, review them before staging.

## Self-review

### Spec coverage

- `AnimatePresence mode="wait"` regression is covered by **Task 1**.
- `.chord-connector-path` redundant opacity transition removal is covered by **Task 2**.
- `useChordConnectorPolylines` memo split and geometry/topology separation are covered by **Task 3**.
- Focused connector tests plus full repo validation are covered by **Task 4**.

No spec requirements are missing.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Every code-edit step includes concrete code blocks or exact replacements.
- Every verification step names exact commands and expected outcomes.

### Type consistency

- The plan uses one helper naming scheme throughout: `buildPendingChordConnectorVoicings` and `buildPixelChordConnectorVoicings`.
- `PendingChordConnectorVoicing.noteCoords` consistently refers to `{ stringIndex, fretIndex }`.
- `ChordConnectorVoicing` remains the final public output everywhere.
