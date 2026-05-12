# Chord Connector Halo + Canonical Okabe-Ito Palette

**Date:** 2026-05-11
**Status:** Approved

## Problem

The chord connector palette claims to be "Okabe-Ito derived" but only 3 of 8 slots use canonical values. The warm slots (vermillion, orange, amber) were darkened to L~28-33% to contrast against the light-mode maple wood background (#f1c38e). This undermines the CVD-safe properties of the original palette and produces muddy, hard-to-distinguish browns.

WCAG 3:1 audit confirms: most canonical Okabe-Ito colors fail contrast against maple wood by color alone. The fix must come from the rendering system, not from modifying the palette.

## Solution

Two changes:

1. **Restore canonical Okabe-Ito palette** — identical colors in both light and dark themes.
2. **Add a halo/casing stroke pass** — a wider, semi-transparent white outline rendered behind the fill and colored outline, providing a contrasting edge against any background.

## Palette

All 8 slots use canonical Okabe-Ito values. Both themes share the same palette.

| Slot | Hex       | Name            |
|------|-----------|-----------------|
| 1    | `#E69F00` | Orange          |
| 2    | `#D55E00` | Vermillion      |
| 3    | `#999999` | Gray            |
| 4    | `#009E73` | Bluish green    |
| 5    | `#56B4E9` | Sky blue        |
| 6    | `#0072B2` | Blue            |
| 7    | `#CC79A7` | Reddish purple  |
| 8    | `#F0E442` | Yellow          |

Slot 3 (gray) is assigned to the least-used chord-connector slot. `INVERSION_SLOTS` only assigns slots 0, 3, 5, 6, 7 — slot 2 (1-indexed: slot 3) is never used for chord connectors. Interval connectors can use all 8 slots via `(scaleDegree % 8) + 1`.

CAGED shape colors update to match their corresponding connector slots:
- `--caged-e` → slot 1 (`#E69F00`)
- `--caged-d` → slot 3 (`#999999`)
- `--caged-c` → slot 4 (`#009E73`)
- `--caged-a` → slot 6 (`#0072B2`)
- `--caged-g` → slot 7 (`#CC79A7`)

The `-bg` rgba values update accordingly. The `-fg` (text-on-shape) values may need adjustment for legibility on the new fill colors.

## Halo Rendering

A third render pass is added before the existing fill and outline passes.

### Render order (within connector group)

1. **Halo pass** (bottom) — wide semi-transparent white stroke
2. **Fill pass** (middle) — low-opacity colored fill
3. **Outline pass** (top) — thin colored stroke

### Halo CSS tokens

```css
--chord-connector-halo-width: 3px;
--chord-connector-halo-color: rgba(255, 255, 255, 0.7);  /* light */
--chord-connector-halo-color: rgba(255, 255, 255, 0.3);  /* dark */
```

The halo uses the same path geometry as the outline pass. `stroke-linejoin: round; stroke-linecap: round;` matches the outline.

### Fill opacity

Unchanged: light 0.40, dark 0.15. The halo handles contrast independently.

## WCAG Contrast Audit

### Light mode — canonical Okabe-Ito vs maple wood (without halo)

| Slot | Color      | vs #fbe6c6 (top) | vs #f1c38e (mid) | 3:1? |
|------|------------|------------------|------------------|------|
| 1    | `#E69F00`  | 1.85:1           | 1.39:1           | FAIL |
| 2    | `#D55E00`  | 3.17:1           | 2.38:1           | FAIL |
| 3    | `#999999`  | 2.34:1           | 1.76:1           | FAIL |
| 4    | `#009E73`  | 2.81:1           | 2.11:1           | FAIL |
| 5    | `#56B4E9`  | 1.89:1           | 1.42:1           | FAIL |
| 6    | `#0072B2`  | 4.26:1           | 3.19:1           | PASS |
| 7    | `#CC79A7`  | 2.51:1           | 1.89:1           | FAIL |
| 8    | `#F0E442`  | 1.09:1           | 1.23:1           | FAIL |

The halo provides the white contrasting edge that makes all colors readable regardless of fill-vs-wood luminance similarity.

### Dark mode — canonical Okabe-Ito vs rosewood (without halo)

| Slot | Color      | vs #160d07 (top) | vs #0d0805 (mid) | 3:1? |
|------|------------|------------------|------------------|------|
| 1    | `#E69F00`  | 8.52:1           | 8.85:1           | PASS |
| 2    | `#D55E00`  | 4.96:1           | 5.15:1           | PASS |
| 3    | `#999999`  | 6.73:1           | 6.99:1           | PASS |
| 4    | `#009E73`  | 5.61:1           | 5.82:1           | PASS |
| 5    | `#56B4E9`  | 8.31:1           | 8.63:1           | PASS |
| 6    | `#0072B2`  | 3.70:1           | 3.84:1           | PASS |
| 7    | `#CC79A7`  | 6.27:1           | 6.51:1           | PASS |
| 8    | `#F0E442`  | 14.51:1          | 15.07:1          | PASS |

All pass without halo. The halo adds further readability.

## Files Changed

1. **`src/styles/themes.css`** — Replace 8 light-mode + 8 dark-mode connector color tokens with canonical values; add halo tokens (`--chord-connector-halo-width`, `--chord-connector-halo-color`); update comments.
2. **`src/styles/index.css`** — Update CAGED colors (`--caged-e/d/c/a/g`) and `-bg` rgba values to match new palette. Check/update `-fg` values.
3. **`src/components/FretboardSVG/FretboardSVG.module.css`** — Add `path[data-layer="halo"]` rules for both `.chord-connectors` and `.interval-connectors`.
4. **`src/components/FretboardSVG/FretboardSVG.tsx`** — Add halo render pass (third `.map()` over voicings) before fill pass, for both chord and interval connectors.
5. **`src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`** — Update "Okabe-Ito-derived" comment to "canonical Okabe-Ito".
