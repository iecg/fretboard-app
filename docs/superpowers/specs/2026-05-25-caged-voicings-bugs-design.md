# CAGED Voicings Bug Fixes — Design Spec

**Goal:** Fix three visual/functional bugs in the CAGED + Close voicing display on the fretboard.

**Architecture:** Three independent fixes touching the store layer (chord highlight positions), CSS (connector-to-polygon color matching), and core (close voicing shape filter tolerance).

**Tech Stack:** TypeScript, Jotai, CSS Modules, CAGED shape system in `packages/core/src/shapes/`.

---

## Fix 1: Chord Highlights on All Strings (Close Mode)

### Problem

When `voicing: "close"` + CAGED pattern active + `chordSnapToScale: true`, `chordHighlightPositionsAtom` returns only positions that are part of actual close voicings. Strings that have chord tones within the active shape's polygon bounds but aren't part of any close voicing receive zero chord emphasis.

For example, if the active CAGED shape spans all 6 strings but a close triad voicing only uses strings 2-3-4, strings 0, 1, and 5 get no chord highlights — even though chord tones exist on those strings within the shape.

### Fix

In `chordHighlightPositionsAtom` — `src/store/chordOverlayAtoms.ts:590-591` — replace:

```ts
if (voicing === "close") {
  return memoizedHighlightSet(get(closeCandidatesAllStringSetsAtom).flatMap((v) => v.positionKeys));
}
```

with:

```ts
if (voicing === "close") {
  const positions = get(closeCandidatesAllStringSetsAtom).flatMap((v) => v.positionKeys);
  if (get(chordSnapToScaleAtom)) {
    const { shapePolygons } = get(shapeDataAtom);
    if (shapePolygons.length > 0) {
      const result = new Set(positions);
      // Add every chord tone inside the shape (like full mode does).
      addChordTonesWithinPolygon(get, result, shapePolygons);
      return memoizedHighlightSet(result);
    }
  }
  return memoizedHighlightSet(positions);
}
```

This mirrors the existing Full mode pattern where `addChordTonesWithinPolygon` is called to fill in chord tones that the voicing engine didn't generate but that still sit within the shape. Changes are gated on `chordSnapToScaleAtom` so the behavior only applies when shape-scoping is active.

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts` (~lines 590-591)
- Test: `src/store/chordOverlayAtoms.test.ts`

---

## Fix 2: Connector Color Match with Polygon Background

### Problem

Shape polygon fills use `var(--caged-e-bg)` (pre-baked rgba like `rgba(230,159,0,0.18)` in dark mode). Connector fills use the solid CAGED color (`var(--caged-e)` = `#E69F00`) with CSS `fill-opacity: 0.15` (dark) or `0.40` (light).

These don't match:
- Dark mode: polygon `0.18` vs connector `0.15` — slightly different opacity
- Light mode: E shape polygon `rgba(184,87,0,0.35)` (dark orange-brown) vs connector `#E69F00` at `0.40` (bright orange) — completely different base color

### Fix

Add CSS rules to `src/components/FretboardSVG/FretboardSVG.module.css` that override the connector fill layer to use the same bg variable as the polygon when a `data-caged-shape` attribute is present:

```css
/* When a CAGED shape is set, the connector fill layer uses the shape's
   background color (matching the polygon fill exactly). */
.chord-connectors path[data-caged-shape][data-layer="fill"] {
  fill-opacity: 1;
}
.chord-connectors path[data-caged-shape="E"][data-layer="fill"] { fill: var(--caged-e-bg); }
.chord-connectors path[data-caged-shape="D"][data-layer="fill"] { fill: var(--caged-d-bg); }
.chord-connectors path[data-caged-shape="C"][data-layer="fill"] { fill: var(--caged-c-bg); }
.chord-connectors path[data-caged-shape="A"][data-layer="fill"] { fill: var(--caged-a-bg); }
.chord-connectors path[data-caged-shape="G"][data-layer="fill"] { fill: var(--caged-g-bg); }
```

The outline layer continues to use `currentColor` (solid CAGED color) via the existing `data-caged-shape` → `color` rules — this preserves edge contrast. The halo layer is unaffected.

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (after line 537)

---

## Fix 3: Relax Close Voicing Shape Filter with Fallback

### Problem

`fitsStringSpecificRangesForAnyInstance` requires all fretted notes of a close voicing to be within the active shape's diagonal bounds. For some chord + CAGED shape combinations, no perfectly-fitting close voicing exists — so nothing is shown even though partially-fitting voicings would be musically useful.

### Fix

Add a relaxed filtering function that accepts voicings where at least N−1 of N fretted notes are inside the shape's diagonal bounds. The strict filter (all notes inside) is tried first; if it returns nothing, the relaxed filter is used as fallback.

**New utility** (in `src/store/chordOverlayAtoms.ts` or near `fitsStringSpecificRanges`):

```ts
/**
 * Like fitsStringSpecificRangesForAnyInstance, but with a relaxed threshold.
 * - strict pass: all fretted notes must fit (current behavior)
 * - relaxed pass: at least N-1 of N fretted notes must fit
 * Returns true if the voicing clears the strict OR relaxed check.
 */
function fitsStringSpecificRangesForAnyInstanceWithFallback(
  positionKeys: readonly string[],
  allowedPositions: Set<string>,
  instances: readonly ShapeInstanceRange[],
): boolean {
  if (fitsStringSpecificRangesForAnyInstance(positionKeys, allowedPositions, instances)) {
    return true;
  }
  const frettedKeys = positionKeys.filter(
    (k) => Number(k.split("-")[1]) > 0,
  );
  if (frettedKeys.length < 2) return false;
  const insideCount = frettedKeys.filter((fk) =>
    fitsStringSpecificRangesForAnyInstance([fk], allowedPositions, instances),
  ).length;
  return insideCount >= frettedKeys.length - 1;
}
```

**Usage:** Replace calls to `fitsStringSpecificRangesForAnyInstance` in `closeCandidatesAllStringSetsAtom` and `closeCandidatesAtom` with `fitsStringSpecificRangesForAnyInstanceWithFallback`.

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts` (add function, update filter calls)
- Test (core): `packages/core/src/shapes/voicings.test.ts`
- Test (store): `src/store/chordOverlayAtoms.test.ts`

---

## Files Changed Summary

| File | Change | Reason |
|------|--------|--------|
| `src/store/chordOverlayAtoms.ts` | Modify `chordHighlightPositionsAtom` close branch | Fix 1 — add chord tones within polygon |
| `src/store/chordOverlayAtoms.ts` | Add `fitsStringSpecificRangesForAnyInstanceWithFallback` | Fix 3 — relaxed filter |
| `src/store/chordOverlayAtoms.ts` | Replace filter call in `closeCandidatesAllStringSetsAtom` | Fix 3 — use relaxed filter |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Add `data-caged-shape` + `data-layer="fill"` override rules | Fix 2 — match polygon bg color |
| `src/store/chordOverlayAtoms.test.ts` | Add tests for Fix 1 and Fix 3 | Verification |
| `packages/core/src/shapes/voicings.test.ts` | Existing tests should still pass | Regression |

---

## Testing Strategy

### Fix 1
- **Unit (store):** Verify `chordHighlightPositionsAtom` for "close" mode includes chord tones within polygon bounds that aren't part of any close voicing position set. Verify gated behavior when `chordSnapToScaleAtom` is false.

### Fix 2
- **Visual:** Connector fill blob should visually match the polygon background for the same shape. Verify in both light and dark themes. This is primarily CSS — no functional test change needed.

### Fix 3
- **Unit (core):** The existing `fitsStringSpecificRangesForAnyInstance` tests should still pass (strict path unchanged).
- **Unit (store):** Verify that a chord + shape combination with no perfect-fit close voicing produces candidates under the relaxed filter. Verify that N-1 threshold works: for a triad (3 notes), 2 inside + 1 outside passes; 1 inside + 2 outside fails.

---

## Non-Goals

- No changes to the `fullVoicingsAtom` / full-chord matching engine (Fix 1 only affects close mode).
- No changes to the `buildExplicitChordConnectorPolylines` path (connector geometry is unchanged — only color changes).
- No refactoring of `fitsStringSpecificRanges` or `fitsStringSpecificRangesForAnyInstance` signatures — only adding the new relaxed variant.
