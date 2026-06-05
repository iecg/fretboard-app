# Chord-Connector Overlap Disambiguation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make overlapping chord-connector spines distinguishable by assigning each conflicting voicing a distinct color plus a redundant dash style, computed by greedy-coloring the existing collision graph — without dropping any voicing or moving any spine.

**Architecture:** Replace the dead radius-offset machinery (`OFFSET_BUCKET` / `offsetPx` / `assignConflictOffsets` / the post-clamp radius collision pass) with a screen-independent conflict-graph encoding assigner that runs in the topology stage. It reuses the pure geometry helpers (`polylineDistance` etc.) over normalized `(fret, string)` coordinates, so colors stay stable across resize. Rendering gains a `data-dash` attribute; CSS stops forcing a single accent color so the per-voicing `data-palette-index` finally drives the spine color.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, CSS Modules, Playwright visual regression. Package manager: **pnpm**.

---

## Background (read before starting)

Spec: `docs/superpowers/specs/2026-06-05-chord-connector-overlap-disambiguation-design.md`.

Key facts about the current code:

- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` produces voicings in two stages: a **topology stage** (`buildPendingChordConnectorVoicings`, no pixels — only `(stringIndex, fretIndex)` coords) and a **pixel stage** (`buildPixelChordConnectorVoicings` → `finalizeChordConnectorPolylines`). The conflict/encoding work belongs in the topology stage so it only re-runs on musical change.
- Every voicing currently gets `paletteIndex = V2_PALETTE_INDEX = 0`. The render layer emits `data-palette-index={v.paletteIndex + 1}` (0-based field → 1-based CSS slot `--chord-connector-color-N`). **Keep this `+1` convention.**
- The rendered output uses **only** `spinePath` (halo + spine passes). The `paths.fill`/`paths.outline` and the per-voicing radius are not rendered, but `paths` stays on the output type (deferred cleanup, out of scope). The radius computation stays; only its *offset* input and the radius *collision* pass are removed.
- The pure geometry helpers `pointToSegmentDistance`, `segmentDistance`, `polylineDistance` are coordinate-agnostic (`{x, y}`). Feeding them `{x: fretIndex, y: stringIndex}` makes crossing detection exact and screen-independent. **These helpers are kept** and reused by the new assigner.
- CSS blocker: `src/components/FretboardSVG/FretboardSVG.module.css` rule `.chord-connectors path[data-layer] { color: var(--fb-connector-accent); }` overrides `data-palette-index`. The `data-caged-shape` **attribute** is emitted and asserted by tests — keep the attribute; only the CSS color rules `[data-caged-shape="…"]` are removed.

---

## Task 1: Encoding assigner (pure function, screen-independent)

Adds the conflict-graph + greedy-coloring assigner and its palette rotation. Exported so it can be unit-tested directly.

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`
- Test: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to the end of `useChordConnectorPolylines.test.ts`. Add `assignConflictEncodings` and `CONNECTOR_PALETTE_ROTATION` to the import from `"./useChordConnectorPolylines"` at the top of the file.

```typescript
describe("assignConflictEncodings", () => {
  // Voicing descriptors only need canonicalKey + noteCoords for the assigner.
  const vc = (canonicalKey: string, coords: Array<[number, number]>) => ({
    canonicalKey,
    noteCoords: coords.map(([stringIndex, fretIndex]) => ({ stringIndex, fretIndex })),
  });

  it("a single voicing gets slot 0 → first rotation color, solid", () => {
    const enc = assignConflictEncodings([vc("a", [[0, 0], [1, 2], [2, 4]])]);
    expect(enc.get("a")).toEqual({ paletteIndex: CONNECTOR_PALETTE_ROTATION[0], dashed: false });
  });

  it("voicings that share a note get different palette indices", () => {
    // Both pass through (1,2) → conflict.
    const enc = assignConflictEncodings([
      vc("a", [[0, 0], [1, 2], [2, 4]]),
      vc("b", [[1, 2], [2, 3], [3, 5]]),
    ]);
    expect(enc.get("a")!.paletteIndex).not.toBe(enc.get("b")!.paletteIndex);
  });

  it("dash follows color-slot parity (odd slot → dashed)", () => {
    const enc = assignConflictEncodings([
      vc("a", [[0, 0], [1, 2], [2, 4]]),
      vc("b", [[1, 2], [2, 3], [3, 5]]),
    ]);
    // Greedy by canonicalKey: 'a' → slot 0 (solid), 'b' → slot 1 (dashed).
    expect(enc.get("a")!.dashed).toBe(false);
    expect(enc.get("b")!.dashed).toBe(true);
  });

  it("non-conflicting voicings both get slot 0 (same color, solid)", () => {
    // Far apart, no crossing, no shared note.
    const enc = assignConflictEncodings([
      vc("a", [[0, 0], [1, 0], [2, 0]]),
      vc("b", [[3, 12], [4, 12], [5, 12]]),
    ]);
    expect(enc.get("a")).toEqual(enc.get("b"));
    expect(enc.get("a")).toEqual({ paletteIndex: CONNECTOR_PALETTE_ROTATION[0], dashed: false });
  });

  it("is deterministic and screen-independent (coords drive it, not pixels)", () => {
    const input = [
      vc("a", [[0, 0], [1, 2], [2, 4]]),
      vc("b", [[1, 2], [2, 3], [3, 5]]),
    ];
    const first = assignConflictEncodings(input);
    const second = assignConflictEncodings(input);
    expect([...second.entries()]).toEqual([...first.entries()]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts -t "assignConflictEncodings"`
Expected: FAIL — `assignConflictEncodings`/`CONNECTOR_PALETTE_ROTATION` are not exported.

- [ ] **Step 3: Implement the assigner**

In `useChordConnectorPolylines.ts`, replace the `OFFSET_BUCKET` constant declaration (and its doc comment, currently around lines 135-145) with the following block — the rotation constant, threshold, encoding type, and assigner all go where `OFFSET_BUCKET` was. (`polylineDistance` is a hoisted function declaration, so referencing it from above its definition is fine.)

```typescript
/**
 * Ordered palette slots used to color conflicting voicings, expressed as
 * 0-based indices (the render layer adds 1 → 1-based --chord-connector-color-N).
 * Order is chosen for contrast on the wood neck in both themes; slot 8 (yellow,
 * index 7) and slot 3 (gray, index 2) are skipped as low-contrast on light wood.
 * Resulting CSS slots in order: 1,6,4,7,2,5 → orange, blue, green, purple,
 * vermillion, sky. Clusters needing more than 6 colors wrap modulo.
 */
export const CONNECTOR_PALETTE_ROTATION = [0, 5, 3, 6, 1, 4] as const;

/**
 * Maximum distance, in normalized (fret, string) units, at which two spines
 * are treated as conflicting. 0 covers crossings and shared notes; the small
 * positive slack also catches near-misses. Approximate in pixel terms (fret
 * and string axes differ in px), but crossings are exact and the metric is
 * screen-independent so assigned colors stay stable across resize.
 */
const CONFLICT_THRESHOLD_UNITS = 0.6;

interface ConnectorEncoding {
  /** 0-based palette index; render adds 1 for the 1-based CSS slot. */
  paletteIndex: number;
  /** Redundant second cue — dashed when the assigned color slot is odd. */
  dashed: boolean;
}

/**
 * Assign each voicing a distinct visual encoding (color + dash) so overlapping
 * spines stay distinguishable. Builds a conflict graph — two voicings conflict
 * when their spines cross, share a note, or pass within CONFLICT_THRESHOLD_UNITS
 * — then greedy-colors it (deterministically, ordered by canonicalKey). The
 * color slot maps through CONNECTOR_PALETTE_ROTATION; dash follows slot parity.
 *
 * Operates on normalized (fret, string) coordinates via the pure geometry
 * helpers, so the result is screen-independent: it lives in the topology stage
 * and does not change on resize.
 */
function assignConflictEncodings(
  voicings: ReadonlyArray<{
    canonicalKey: string;
    noteCoords: NormalizedChordConnectorVertex[];
  }>,
): Map<string, ConnectorEncoding> {
  const result = new Map<string, ConnectorEncoding>();
  const polylines = voicings.map((v) =>
    v.noteCoords.map((c) => ({ x: c.fretIndex, y: c.stringIndex })),
  );
  const n = voicings.length;
  const conflicts = voicings.map(() => new Set<number>());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (polylineDistance(polylines[i]!, polylines[j]!) <= CONFLICT_THRESHOLD_UNITS) {
        conflicts[i]!.add(j);
        conflicts[j]!.add(i);
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    voicings[a]!.canonicalKey.localeCompare(voicings[b]!.canonicalKey),
  );

  const slotByIndex = new Map<number, number>();
  for (const idx of order) {
    const used = new Set<number>();
    for (const neighbor of conflicts[idx]!) {
      const slot = slotByIndex.get(neighbor);
      if (slot !== undefined) used.add(slot);
    }
    let slot = 0;
    while (used.has(slot)) slot++;
    slotByIndex.set(idx, slot);
    result.set(voicings[idx]!.canonicalKey, {
      paletteIndex:
        CONNECTOR_PALETTE_ROTATION[slot % CONNECTOR_PALETTE_ROTATION.length]!,
      dashed: slot % 2 === 1,
    });
  }

  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts -t "assignConflictEncodings"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts
git commit -m "feat(connectors): add conflict-graph color+dash encoding assigner"
```

---

## Task 2: Wire encoding into topology; remove the offset machinery

Switches both voicing branches to `assignConflictEncodings`, adds `dashed` to the types, threads it through the pixel stage, and deletes the dead offset/radius-collision code.

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`
- Test: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

- [ ] **Step 1: Update the output and pending types**

In `ChordConnectorVoicing` (the exported interface), add a field after `paletteIndex`:

```typescript
  /** Redundant dash cue — true when this voicing was assigned a dashed style. */
  dashed: boolean;
```

In `PendingChordConnectorVoicing`, remove `offsetPx: number;` and add `dashed: boolean;` (next to `paletteIndex`).

- [ ] **Step 2: Replace the explicit-voicings branch**

In `buildPendingChordConnectorVoicings`, the explicit branch currently builds `pending` objects with `paletteIndex: V2_PALETTE_INDEX, offsetPx: 0`, then calls `assignConflictOffsets`. Replace the whole `if (explicitVoicings && explicitVoicings.length > 0) { … }` body with:

```typescript
  if (explicitVoicings && explicitVoicings.length > 0) {
    const base = explicitVoicings.map((voicing) => {
      const sourceCombo = createExplicitSourceCombo(voicing.notes)
        .sort((a, b) => a.stringIndex - b.stringIndex);
      const noteCoords: NormalizedChordConnectorVertex[] = sourceCombo.map(
        ({ stringIndex, fretIndex }) => ({ stringIndex, fretIndex }),
      );
      const canonicalKey = voicing.notes
        .map((note) => `${note.stringIndex},${note.fretIndex}`)
        .sort()
        .join("|");
      return {
        canonicalKey,
        voicingKey: voicing.voicingKey,
        noteCoords,
        sourceCombo,
        shape: voicing.shape,
        isFallback: voicing.isFallback,
      };
    });

    const encodings = assignConflictEncodings(base);
    return base.map((pv) => ({
      ...pv,
      ...(encodings.get(pv.canonicalKey) ?? { paletteIndex: 0, dashed: false }),
    }));
  }
```

- [ ] **Step 3: Replace the generated-voicings branch tail**

In the same function, change the `collected` declaration type from `Omit<PendingChordConnectorVoicing, "offsetPx">[]` to:

```typescript
  const collected: Omit<PendingChordConnectorVoicing, "paletteIndex" | "dashed">[] = [];
```

In the `collected.push({ … })` call, remove the `paletteIndex: V2_PALETTE_INDEX,` line (leave `canonicalKey`, `voicingKey`, `noteCoords`, `sourceCombo`, `shape`).

Replace the final two lines of the function (currently `const offsetMap = assignConflictOffsets(collected); return collected.map((pv) => ({ ...pv, offsetPx: … }));`) with:

```typescript
  const encodings = assignConflictEncodings(collected);
  return collected.map((pv) => ({
    ...pv,
    ...(encodings.get(pv.canonicalKey) ?? { paletteIndex: 0, dashed: false }),
  }));
```

- [ ] **Step 4: Delete the dead offset code**

Remove these now-unused declarations from `useChordConnectorPolylines.ts`:
- `const V2_PALETTE_INDEX = 0;` and its doc comment.
- `const CONNECTOR_CONFLICT_GAP_PX = 1.5;`
- the entire `function assignConflictOffsets(…) { … }` (replaced by `assignConflictEncodings`).

- [ ] **Step 5: Simplify `computeFinalConnectorRadii`**

Replace the whole `computeFinalConnectorRadii` function with this offset-free, collision-pass-free version (per-voicing radius only):

```typescript
// Resolves per-voicing connector radii (with edge-safe clamps). Radius feeds
// the (currently unrendered) fill/outline paths only; the visible spine is a
// plain center line. No offset or cross-voicing collision adjustment — those
// were for the retired ribbon fill; overlapping voicings are now distinguished
// by color + dash, not by radius.
function computeFinalConnectorRadii(
  pendingVoicings: ReadonlyArray<{
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
  }>,
  stringRowPx: number,
  lowestStringIndex: number,
  yBounds: ConnectorYBounds | undefined,
): number[] {
  const baseRadius = applyConnectorRadiusFloor(
    stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
    stringRowPx,
  );
  return pendingVoicings.map((pv) =>
    resolveConnectorRadiusPx({
      vertices: pv.rawVertices,
      preferredRadius: baseRadius,
      yBounds,
      edgeSafe: touchesOuterString(pv.sourceCombo, lowestStringIndex),
    }),
  );
}
```

- [ ] **Step 6: Thread `dashed` through `finalizeChordConnectorPolylines`**

In `finalizeChordConnectorPolylines`, change the `pendingVoicings` parameter type: remove `offsetPx: number;`, add `dashed: boolean;`. In the returned object (the `.map` that builds each `ChordConnectorVoicing`), add `dashed: pv.dashed,` after `paletteIndex: pv.paletteIndex,`.

No change is needed in `buildPixelChordConnectorVoicings` — it spreads `...pv`, which now carries `dashed`.

- [ ] **Step 7: Update the offset-dependent tests**

In `useChordConnectorPolylines.test.ts`:

(a) Replace the `describe("paletteIndex field (v2.0 — single accent)", …)` block (the one asserting `v.paletteIndex` is always 0) with:

```typescript
describe("paletteIndex + dashed encoding", () => {
  it("a lone voicing keeps the default slot (paletteIndex 0, solid)", () => {
    const result = build(notes([[0, 0, "C"], [1, 2, "E"], [2, 4, "G"]]), ["C", "E", "G"]);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.paletteIndex).toBe(0);
    expect(result[0]!.dashed).toBe(false);
  });

  it("overlapping voicings receive distinct palette indices", () => {
    // Dense C-major field that yields multiple overlapping voicings.
    const result = build(
      notes([
        [0, 0, "E"], [0, 3, "G"], [0, 8, "C"],
        [1, 1, "C"], [1, 5, "E"], [1, 8, "G"],
        [2, 0, "G"], [2, 5, "C"], [2, 9, "E"],
        [3, 2, "E"], [3, 5, "G"], [3, 10, "C"],
      ]),
      ["C", "E", "G"],
    );
    const distinct = new Set(result.map((v) => v.paletteIndex));
    expect(result.length).toBeGreaterThan(1);
    expect(distinct.size).toBeGreaterThan(1);
  });
});
```

(b) Delete the two describe blocks that assert radius offsets — `describe("adjacency-aware offset assignment", …)` and `describe("G major triad overlap offsets (full neck)", …)` — and the `extractRadius` helper they use. Replace them with a single encoding-overlap block:

```typescript
describe("conflict encoding over the full neck", () => {
  // G major triad across the neck produces overlapping voicings; conflicting
  // ones must differ in encoding, and identity stays stable across re-runs.
  const gMajor = notes([
    [0, 3, "G"], [0, 7, "B"], [0, 10, "D"], [0, 15, "G"],
    [1, 0, "B"], [1, 3, "D"], [1, 8, "G"], [1, 12, "B"],
    [2, 0, "G"], [2, 4, "B"], [2, 7, "D"], [2, 12, "G"],
    [3, 0, "D"], [3, 5, "G"], [3, 9, "B"], [3, 12, "D"],
  ]);

  it("no two conflicting (note-sharing) voicings share a palette index", () => {
    const result = build(gMajor, ["G", "B", "D"]);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const setI = new Set(result[i]!.voicingKey.split("|"));
        const sharesNote = result[j]!.voicingKey.split("|").some((p) => setI.has(p));
        if (sharesNote) {
          expect(result[i]!.paletteIndex).not.toBe(result[j]!.paletteIndex);
        }
      }
    }
  });

  it("determinism: identical inputs yield identical encodings", () => {
    const a = build(gMajor, ["G", "B", "D"]);
    const b = build(gMajor, ["G", "B", "D"]);
    expect(a.map((v) => [v.voicingKey, v.paletteIndex, v.dashed]))
      .toEqual(b.map((v) => [v.voicingKey, v.paletteIndex, v.dashed]));
  });
});
```

- [ ] **Step 8: Run the hook test file**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`
Expected: PASS. If any remaining test references `offsetPx`, `OFFSET_BUCKET`, or distinct-radii expectations, it belongs to a block deleted in Step 7 — remove that leftover assertion. The radius-util tests in the `per-voicing offset` block (`computeChordConnectorRadiusPx(STRING_ROW_PX, 3)` etc.) exercise the unchanged `connectorRadius` util and should still pass.

- [ ] **Step 9: Typecheck**

Run: `pnpm exec tsc -b`
Expected: no errors. (Catches any literal still setting `offsetPx` or missing `dashed`.)

- [ ] **Step 10: Commit**

```bash
git add src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts
git commit -m "refactor(connectors): assign color+dash per voicing, drop OFFSET_BUCKET radius machinery"
```

---

## Task 3: Render the dash cue

**Files:**
- Modify: `src/components/FretboardSVG/FretboardConnectorLayer.tsx`
- Test: `src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`

- [ ] **Step 1: Write the failing test**

In `FretboardConnectorLayer.test.tsx`, first update the `makePolyline` factory so its `ChordConnectorVoicing` literal includes the new required field — add `dashed: false,` after `paletteIndex: 0,`. Optionally extend the signature so a test can set it: change the factory to `(voicingKey: string, shape?: CagedShape, dashed = false)` and use `dashed,` in the literal.

Then add this test (place it near the other rendering tests):

```typescript
it("emits data-dash='true' on the spine of a dashed voicing", () => {
  const { container } = renderInSvg(
    <FretboardConnectorLayer
      {...BASE_PROPS}
      pass="below"
      chordPolylines={[makePolyline("0,0|1,2|2,4", undefined, true)]}
    />,
  );
  expect(
    container.querySelector('path[data-layer="spine"][data-dash="true"]'),
  ).not.toBeNull();
});

it("omits data-dash on a solid voicing", () => {
  const { container } = renderInSvg(
    <FretboardConnectorLayer
      {...BASE_PROPS}
      pass="below"
      chordPolylines={[makePolyline("0,0|1,2|2,4", undefined, false)]}
    />,
  );
  expect(container.querySelector('path[data-layer="spine"][data-dash]')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx -t "data-dash"`
Expected: FAIL — no `data-dash` attribute is rendered.

- [ ] **Step 3: Emit the attribute**

In `FretboardConnectorLayer.tsx`, in `renderChordPath`, add the `data-dash` attribute to the `<path>` (only meaningful on the spine layer; the halo stays solid):

```tsx
const renderChordPath = (v: ChordConnectorVoicing, layer: "halo" | "spine") => (
  <path
    key={`${layer}-${v.voicingKey}`}
    className={layer === "halo" ? undefined : styles["chord-connector-path"]}
    d={v.spinePath}
    data-layer={layer}
    data-caged-shape={v.shape}
    data-palette-index={v.paletteIndex + 1}
    data-dash={layer === "spine" && v.dashed ? "true" : undefined}
    data-fallback={v.isFallback ? "true" : undefined}
  />
);
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`
Expected: PASS (whole file).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardConnectorLayer.tsx src/components/FretboardSVG/FretboardConnectorLayer.test.tsx
git commit -m "feat(connectors): emit data-dash on dashed voicing spines"
```

---

## Task 4: CSS — let palette color through, add the dash style

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

- [ ] **Step 1: Remove the single-accent override and caged-shape color rules**

Delete these rules from `FretboardSVG.module.css` (in the `.chord-connectors` block, roughly lines 396-408):

```css
.chord-connectors path[data-caged-shape="E"] { color: var(--caged-e); }
.chord-connectors path[data-caged-shape="D"] { color: var(--caged-d); }
.chord-connectors path[data-caged-shape="C"] { color: var(--caged-c); }
.chord-connectors path[data-caged-shape="A"] { color: var(--caged-a); }
.chord-connectors path[data-caged-shape="G"] { color: var(--caged-g); }

/* The ribbon connector uses the higher-contrast close-voicing color instead of
   the per-CAGED-shape colors, which reads better over CAGED region shading. The
   [data-layer] attribute lifts specificity above the palette-index / caged-shape
   rules above so this wins regardless of source order. */
.chord-connectors path[data-layer] {
  color: var(--fb-connector-accent);
}
```

Keep the `.chord-connectors path[data-palette-index="1".."8"]` rules — they now drive the spine color.

- [ ] **Step 2: Add the dash rule**

Add this immediately after the spine rule (`.chord-connectors path[data-layer="spine"] { … }`):

```css
/* Redundant second cue: dashed spine for voicings the conflict-graph assigned
   an odd color slot. The solid halo underlay shows through the gaps. */
.chord-connectors path[data-layer="spine"][data-dash="true"] {
  stroke-dasharray: 7px 5px;
}
```

- [ ] **Step 3: Lint the stylesheet**

Run: `pnpm run lint`
Expected: PASS (eslint + stylelint). Fix any stylelint ordering/format complaints it reports on the edited block.

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "style(connectors): drive spine color by palette index, add dash rule"
```

---

## Task 5: Verify in the app, refresh visual snapshots, full gate

**Files:**
- Possibly update: `e2e/**` darwin visual snapshots (auto-written by the update script).

- [ ] **Step 1: Visually confirm in the running app**

Start the dev server and reproduce the worst case: light theme, scale Pattern = **None**, chord overlay on (Voicing **Full**), select a chord with many neck voicings (e.g. the **Am** step of the default progression). Confirm the overlapping spines now show in **multiple colors** with **dashed/solid interleaving** where they overlap, and that a single isolated voicing is still solid orange. Confirm CAGED multi-shape and one-/two-string scale modes still render their connectors without regressions.

- [ ] **Step 2: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS. In particular `FretboardSVG.test.tsx` (the `data-caged-shape` attribute assertions still hold — the attribute is unchanged) and the connector hook/layer suites.

- [ ] **Step 3: Refresh darwin visual snapshots**

The multi-color/dash output changes connector pixels, so the committed visual baselines must be updated.

Run: `pnpm run test:visual:update`
Then review the regenerated snapshots under `e2e/` (especially `fretboard-svg` and `app-overlays`) to confirm the diffs are the intended color+dash change and nothing else.

Note: linux baselines are maintained separately (`pnpm run test:visual:update:linux` / CI). Call out in the PR that linux snapshots need regeneration if your environment can't produce them.

- [ ] **Step 4: Production build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build`).

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh connector snapshots for color+dash disambiguation"
```

---

## Final verification checklist

- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run build` passes
- [ ] No remaining references to `OFFSET_BUCKET`, `offsetPx`, `assignConflictOffsets`, `V2_PALETTE_INDEX`, or `CONNECTOR_CONFLICT_GAP_PX`: `git grep -nE "OFFSET_BUCKET|offsetPx|assignConflictOffsets|V2_PALETTE_INDEX|CONNECTOR_CONFLICT_GAP_PX" src` returns nothing.
- [ ] Manual check: isolated voicing solid orange; overlapping voicings multi-color + dash interleave.
