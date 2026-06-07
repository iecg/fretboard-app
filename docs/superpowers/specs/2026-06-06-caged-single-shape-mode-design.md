# CAGED Single-Shape Mode — Design

Date: 2026-06-06
Status: Approved for planning
Scope: CAGED shape selection state + the `FingeringPatternControls` UI. No change to 3NPS, one-string, two-strings, or "none" fingering patterns. No change to note-role coloring or the chord overlay.

## Problem

When the CAGED pattern is active, the app can show **multiple shapes at once**. The shape-selection state (`cagedShapesAtom`) is a `Set<CagedShape>` whose **default is all five shapes** (`new Set(CAGED_SHAPES)` where `CAGED_SHAPES = ["C","A","G","E","D"]`). Because consecutive CAGED shapes overlap by design, the active region is rendered as several overlapping translucent neutral polygons that merge into one undifferentiated "blob," and the user cannot tell which shape is which.

This was originally framed as a **shape-boundary delineation** problem (how to visually separate overlapping regions). We explored and rejected that path — see "Why not delineation" below.

## Decision

**Drop the ability to show more than one CAGED shape at a time.** CAGED becomes a strict single-shape selector. With only one shape ever visible, regions never overlap, so the blob and the entire delineation problem disappear at the source. The whole-neck "see everything" view is preserved separately by the existing **Pattern = None** mode.

## Why not delineation (research summary)

Two research passes (information-visualization/cartography, and real guitar tools) converged:

- This is a known problem class — *set-membership visualization over a fixed layout with overlapping sets* (BubbleSets, LineSets, KelpFusion; Alsallakh et al. survey).
- **No tool has solved the neutral (no-hue) overlapping-region version.** Every guitar tool that overlays multiple shapes uses **per-shape hue** (the exact channel we reserve for note roles), and everyone else shows **one shape at a time**.
- Both the research ("BubbleSets degrades with many overlapping sets") and player communities (overlapping boxes read as "visual clutter") indicate the all-at-once overlay is the wrong medium regardless of treatment.
- We previewed flat fill, outline, alternating tint, hatch, and smooth-hull+label live on the app; none resolved the dual complaint of **clutter** + **lack of identity** well enough to justify the complexity.

Conclusion: constraining to a single shape is simpler, lower-risk, and aligns with how the domain is actually taught and used.

## Design

### 1. State (`src/store/fingeringAtoms.ts`)

Keep `cagedShapesAtom` typed as `Set<CagedShape>` but enforce a **one-element invariant**. This avoids churning the ~7 downstream consumers that already filter polygons by set membership (`.has(shape)`) — they keep working unchanged for a single-element set.

- **Default:** `new Set(["E"])` (replaces `new Set(CAGED_SHAPES)`). E is the chosen default shape. *(Note: the previous default was all five — that was the out-of-the-box cause of the blob, not E as previously assumed.)*
- **Remove `toggleCagedShapeAtom`** — it is the only multi-add writer. Deleting it (and the "All" button, below) means no code path can ever produce a set with more than one element.
- **Keep `selectSingleCagedShapeAtom`** — it already backs plain-click selection (`set(cagedShapesAtom, new Set([shape]))`).
- **Migration (storage):** existing users may have a persisted multi-shape set (default was all five). Update `cagedShapesStorage.deserialize` to collapse any stored array to a single shape — keep `"E"` if present, else the first stored entry, else `"E"`:

  ```ts
  deserialize: (v) => {
    const arr = JSON.parse(v) as CagedShape[];
    const one = arr.includes("E") ? "E" : (arr[0] ?? "E");
    return new Set<CagedShape>([one]);
  }
  ```

  This guarantees the one-element invariant even from legacy storage, with no separate migration step.

### 2. Control UI (`src/components/FingeringPatternControls/FingeringPatternControls.tsx`)

- **Remove the "All" button** (the `onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}` control and its active-state styling tied to `cagedShapes.size === CAGED_SHAPES.length`).
- **Single-select only:** each shape button calls `selectSingleCagedShape(s)` on plain click. **Remove the shift-click / long-press "add" affordance** entirely (the `e.shiftKey` branch and the touch long-press-to-add handling).
- **Remove the hint line** that renders `shiftClickToAdd` / `longPressToAdd`.
- Active state for a shape button is now `cagedShapes.has(s)` (true for exactly one) — unchanged semantics, just never more than one active.

### 3. Hook (`src/hooks/useShapeState.ts`)

- Remove the `toggleCagedShape` binding (atom deleted).
- Remove `setCagedShapes` if it was only used by the "All" button; keep `selectSingleCagedShape`.

### 4. Rendering (no change needed)

`cagedShapeDataAtom` (`src/store/shapeAtoms.ts`) filters `CAGED_SHAPES` by set membership and emits polygons for the active shape(s) — with a single-element set it emits one shape's polygons. `FretboardShapeLayer` already paints the single neutral `--fb-region-tint`. **No hull, label, outline, or overlap machinery is added.** One box cannot blob.

### 5. Status bar (`src/components/StatusBar/StatusBar.tsx`)

The label `${PATTERN_LABELS.caged} · ${CAGED_SHAPES.filter(s => cagedShapes.has(s)).join("")}` now yields a single letter (e.g. `CAGED · E`). No code change strictly required, but verify the single-letter output reads correctly and update any test expecting multi-letter output (e.g. `CAG`).

### 6. i18n (`src/i18n/en.ts`, `es.ts`, `types.ts`)

Remove the now-unused `shiftClickToAdd` and `longPressToAdd` strings and their type entries.

### 7. Whole-neck view

No work needed. **Pattern = None** already renders the full scale across the neck with no box, covering the use case the "All" button partially served.

## Non-goals / explicitly dropped

- **Shape-boundary delineation** of overlapping regions (hulls, outlines, hatching, alternating tint, additive overlap). Dropped — the single-shape constraint removes the need.
- **A "show all positions" overview.** The deferred 5-hue overview (visual-language doc §6) remains deferred and is unaffected; it is a separate future feature behind its own toggle, not the default CAGED behavior.
- **3NPS / one-string / two-strings** patterns — unchanged (3NPS is already a single-position stepper).
- **Per-shape labels on the neck** — unnecessary; the control indicates the active shape.
- **Collapsing `cagedShapesAtom` from `Set` to a scalar type** — a possible future cleanup, deliberately out of scope to keep the change low-risk. The one-element invariant is enforced by removing multi-writers.

## Consumers to verify (no behavior change expected, single-element set)

These read `cagedShapesAtom` via `.has()` / `.size` / array conversion and must continue to work with a one-element set:

- `src/store/shapeAtoms.ts` (`cagedShapeDataAtom` — membership filter).
- `src/store/chordOverlayAtoms.ts` (full-chord scoping by active shapes).
- `src/store/voicingFallbackAtoms.ts` (close-voicing fallback scoping).
- `src/store/chordScope.ts` (`get(cagedShapesAtom).size > 0`).
- `src/hooks/useFretboardTopologyModel.ts` (branches on size 0/1/>1 — the `>1` branch becomes unreachable but harmless; may be simplified opportunistically).
- `src/store/actions.ts` (`set(cagedShapesAtom, RESET)` → resets to the new single-E default).
- `src/store/scaleAtoms.ts:100` (already sets `new Set(["E"])` on progression-preset load — consistent with the new model; no change).

## Testing

- **State:** new-session default is `{"E"}`; selecting a shape replaces (never adds); deserialize of a legacy multi `["C","A","G","E","D"]` collapses to `{"E"}`; deserialize of `["C","A"]` collapses to `{"C"}` (E absent → first in stored order... note: collapse rule is "E if present else first array entry").
- **UI:** no "All" button rendered; no shift-click/long-press hint; plain click selects a single shape; shift-click does **not** add a second shape (now behaves as a plain select).
- **StatusBar:** shows a single shape letter (e.g. `CAGED · E`).
- **Regression:** chord overlay / voicing fallback / topology behave correctly with one active shape (existing suites should pass; update any that seeded multiple shapes).
- **Visual:** the all-five default snapshot(s) change to a single-shape region — update affected darwin + linux visual baselines.

## Risks

- **Behavior change for returning users:** anyone whose persisted state was the all-five default now sees a single E shape. This is intentional; the migration makes it deterministic.
- **Visual snapshots:** the default state changes from five regions to one — expect baseline updates in the fretboard/overlay visual suites.
- **Dead multi-shape code:** the `size > 1` branch in `useFretboardTopologyModel` and any multi-letter StatusBar formatting become unreachable. Leaving them is safe; removing them is optional cleanup noted for the plan.
