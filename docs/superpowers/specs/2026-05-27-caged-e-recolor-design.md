# CAGED-E Recolor — Design

**Status:** Approved. Standalone; can land independently of the other specs in this batch (no sequencing constraint).

**Goal:** Swap the CAGED E-shape's color from Okabe-Ito orange (`#E69F00`) to Okabe-Ito sky blue (`#56B4E9`) to stop colliding with two other orange surfaces on the fretboard (chord-tone ring + non-CAGED connector slot 1).

**In scope:** item 2 from the 2026-05-27 grab-bag brainstorm.

**Out of scope:** the broader theming pass (items 3 + 8) — that spec will revisit the entire CAGED palette, note-color tokens, and light-mode treatment. This spec is a surgical recolor.

---

## Context

CAGED-E currently uses Okabe-Ito orange in both modes:

| Token | File | Current | Notes |
|---|---|---|---|
| `--caged-e` (dark) | `src/styles/index.css:20` | `#E69F00` | base color |
| `--caged-e-fg` (dark) | `src/styles/index.css:21` | `#fff1f2` | warm white foreground |
| `--caged-e-bg` (dark) | `src/styles/index.css:30` | `rgba(230, 159, 0, 0.18)` | 18% alpha fill |
| `--caged-e` (light) | `src/styles/themes.css:357` | `#E69F00` | light-mode redeclare |
| `--caged-e-bg` (light, fallback block) | `src/styles/themes.css:362` | `rgba(230, 159, 0, 0.18)` | dark-mode-override-block alias |
| `--caged-e-bg` (light, boosted) | `src/styles/themes.css:191` | `rgba(184, 87, 0, 0.35)` | light-mode visibility boost using darkened `#B85700` |

Conflicts the user wants resolved:

1. `--chord-connector-color-1` (`themes.css:295`, `:333`) — Okabe-Ito orange used by the non-CAGED connector palette slot 1.
2. Chord-tone ring color in the note overlay — also orange.

Both are independent of CAGED-E and stay orange. The recolor decouples CAGED-E so the orange-orange overlap disappears.

### Collateral / known minor collision

The Okabe-Ito 8-color palette is fully consumed by `--chord-connector-color-1..8` (themes.css 295–302 and 333–340). Sky blue `#56B4E9` is the slot-5 connector color. After this swap, CAGED-E shares a hue with the connector slot 5. This is acceptable because:

- CAGED shapes render as low-alpha background polygons.
- Chord connectors render as line strokes with halos, on top of the polygons.
- Different visual primitives; minimal perceptual overlap.

If the theming pass (items 3 + 8) later changes the chord-connector palette, this collision can be revisited there.

---

## Design

### Token swaps

**`src/styles/index.css`:**

```css
/* before */
--caged-e: #E69F00;      /* Okabe-Ito orange, connector slot 1 */
--caged-e-fg: #fff1f2;
--caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */

/* after */
--caged-e: #56B4E9;      /* Okabe-Ito sky blue, decoupled from connector slot 1 */
--caged-e-fg: #f0f9ff;   /* cool white, paired with sky-blue base */
--caged-e-bg: rgba(86, 180, 233, 0.18);   /* E #56B4E9 + 0.18 */
```

**`src/styles/themes.css`:**

```css
/* before — light-mode block (line 191) */
--caged-e-bg: rgba(184, 87, 0, 0.35);    /* E #B85700 + 0.35 boost */

/* after — keep the +0.35 boost convention; darken sky blue to maintain
   visibility against the warm maple background */
--caged-e-bg: rgba(0, 119, 178, 0.35);   /* E #0077B2 (darkened sky blue) + 0.35 boost */
```

```css
/* before — light-mode redeclare (lines 357, 362) */
--caged-e: #E69F00;                        /* Okabe-Ito orange, slot 1 */
--caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */

/* after */
--caged-e: #56B4E9;                        /* Okabe-Ito sky blue */
--caged-e-bg: rgba(86, 180, 233, 0.18);   /* E #56B4E9 + 0.18 */
```

### Foreground rationale

`--caged-e-fg` is the text color paired with the CAGED-E base on filled chips. Today it's `#fff1f2` (warm white, harmonizing with orange). For sky blue, `#f0f9ff` (cool white) pairs better and keeps WCAG contrast well above 4.5:1 against `#56B4E9`.

### Light-mode boost rationale

The current light-mode override uses `#B85700` (darkened orange) at 0.35 alpha to maintain visibility against the light maple background. Mirror that pattern for sky blue: `#0077B2` is a darkened sky blue (same hue, lower lightness) that keeps the visibility boost without shifting the perceived color family.

If empirical visual testing shows the chosen darkened blue clashes with the existing `--caged-a` (`#0072B2`, also a blue), revisit with a different darkening curve (e.g. `#1B7CC2` — keeps slightly lighter to differentiate). This is a tuning detail for the implementer; flagged as a verification step below.

---

## Verification

- **Visual baseline refresh:** `pnpm run test:visual:update` after the swap. All darwin snapshots that show CAGED-E polygons or chips need refresh — expect updates in `e2e/app-components/fretboard-svg-*` and any chord-overlay snapshots that include the E shape.
- **Manual smoke (`pnpm dev`):**
  - Dark mode + light mode: load C major + CAGED + select E shape. Confirm the polygon renders sky blue (not orange), the chip in `FingeringPatternControls`'s shape toggle shows sky blue with cool-white text, and no remaining orange leaks from CAGED-E.
  - Side-by-side check: enable Full voicing in a position where multiple CAGED shapes overlap (e.g. C major scale at fret 5). Confirm E (sky blue) and A (blue `#0072B2`) are visually distinguishable — they're both blues but at different lightness levels. If they look too similar in light mode, swap the light-mode E to a slightly lighter blue (see Light-mode boost rationale above).
  - Confirm chord-connector slot 5 strokes (also sky blue) and CAGED-E polygons coexist without perceptual confusion — they should, because of the different stroke vs. fill treatment.

---

## Tests

- **`FretboardSVG.test.tsx:244`:** existing test asserts `--shape-fill: var(--caged-e)`. No code change needed — token-name binding survives the value swap. Test passes as-is.
- **No new unit tests required.** Token values are not asserted in unit tests; visual regression covers the actual rendering.

---

## Files to touch

**Modify:**
- `src/styles/index.css` — three `--caged-e*` tokens.
- `src/styles/themes.css` — `--caged-e-bg` at line 191 (light-mode boost), plus the `--caged-e` and `--caged-e-bg` at lines 357 and 362 (fallback block).

**No new files. No deletes. No code changes.**

**Visual baselines:** refresh affected darwin snapshots via `pnpm run test:visual:update`. Linux baselines auto-rebuild on next CI run.

---

## Sequencing

Standalone. No constraints from or to the other specs in the 2026-05-27 batch. Can land before, between, or after group A / group B without coordination.

If shipped before the Theming spec (items 3 + 8), the theming work will inherit this swap as the starting state for CAGED-E.
