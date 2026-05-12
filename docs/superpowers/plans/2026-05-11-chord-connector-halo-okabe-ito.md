# Chord Connector Halo + Canonical Okabe-Ito Palette — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore canonical Okabe-Ito palette for chord/interval connectors and add a halo/casing stroke pass so connectors read clearly against both light maple and dark rosewood fretboard backgrounds.

**Architecture:** CSS token changes for the palette + a third SVG render pass (halo) inserted before the existing fill + outline passes. The halo is a wide, semi-transparent white stroke using the same path geometry as the outline, providing a contrasting edge regardless of background.

**Tech Stack:** CSS custom properties, React (motion/react), SVG `<path>` elements.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/styles/themes.css` | Modify (lines 279-306, 324-357) | Replace connector palette tokens (light + dark) with canonical Okabe-Ito; add halo tokens; update CAGED dark-mode overrides |
| `src/styles/index.css` | Modify (lines 20-34) | Update CAGED base colors + `-bg` rgba values to match canonical palette |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Modify (lines 421-493) | Add `path[data-layer="halo"]` rules for `.chord-connectors` and `.interval-connectors` |
| `src/components/FretboardSVG/FretboardSVG.tsx` | Modify (lines 463-521) | Add halo render pass before fill pass for both chord and interval connectors |
| `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` | Modify (line 34) | Update comment from "Okabe-Ito-derived" to "canonical Okabe-Ito" |

---

### Task 1: Replace connector palette tokens in themes.css

**Files:**
- Modify: `src/styles/themes.css:279-306` (light mode connector block)
- Modify: `src/styles/themes.css:324-357` (dark mode connector block + CAGED overrides)

- [ ] **Step 1: Replace the light-mode connector palette comment and color tokens**

Replace lines 279-306 in `src/styles/themes.css` — the entire light-mode connector block — with:

```css
  /* Chord-tone connector palette — canonical Okabe-Ito 8-color palette.
     Identical across light and dark themes for consistent voicing identity.
     A halo/casing stroke (--chord-connector-halo-*) provides the contrasting
     edge that makes these colors readable against any wood background —
     the palette itself is not modified for contrast. */
  --chord-connector-fill-opacity: 0.40;
  --chord-connector-outline-width: 1.25px;
  --chord-connector-outline-opacity: 0.85;
  --chord-connector-halo-width: 3px;
  --chord-connector-halo-color: rgba(255, 255, 255, 0.7);
  --chord-connector-color-1: #E69F00; /* Okabe-Ito: orange */
  --chord-connector-color-2: #D55E00; /* Okabe-Ito: vermillion */
  --chord-connector-color-3: #999999; /* Okabe-Ito: gray */
  --chord-connector-color-4: #009E73; /* Okabe-Ito: bluish green */
  --chord-connector-color-5: #56B4E9; /* Okabe-Ito: sky blue */
  --chord-connector-color-6: #0072B2; /* Okabe-Ito: blue */
  --chord-connector-color-7: #CC79A7; /* Okabe-Ito: reddish purple */
  --chord-connector-color-8: #F0E442; /* Okabe-Ito: yellow */
```

- [ ] **Step 2: Replace the dark-mode connector palette and CAGED overrides**

Replace lines 324-357 in `src/styles/themes.css` — the entire `[data-theme="modern-dark"]` connector + CAGED block — with:

```css
  /* Chord-tone connector overrides for dark mode.
     Same canonical Okabe-Ito palette as light mode. Lower fill opacity because
     dark rosewood provides high contrast at lower alpha. Halo is subtler on
     dark backgrounds. */
  --chord-connector-fill-opacity: 0.15;
  --chord-connector-outline-width: 1.25px;
  --chord-connector-outline-opacity: 0.85;
  --chord-connector-halo-width: 3px;
  --chord-connector-halo-color: rgba(255, 255, 255, 0.3);
  --chord-connector-color-1: #E69F00; /* Okabe-Ito: orange */
  --chord-connector-color-2: #D55E00; /* Okabe-Ito: vermillion */
  --chord-connector-color-3: #999999; /* Okabe-Ito: gray */
  --chord-connector-color-4: #009E73; /* Okabe-Ito: bluish green */
  --chord-connector-color-5: #56B4E9; /* Okabe-Ito: sky blue */
  --chord-connector-color-6: #0072B2; /* Okabe-Ito: blue */
  --chord-connector-color-7: #CC79A7; /* Okabe-Ito: reddish purple */
  --chord-connector-color-8: #F0E442; /* Okabe-Ito: yellow */

  /* CAGED shapes — canonical Okabe-Ito palette (same as light mode) */
  --caged-e: #E69F00;                        /* Okabe-Ito orange, slot 1 */
  --caged-d: #999999;                        /* Okabe-Ito gray, slot 3 */
  --caged-c: #009E73;                        /* Okabe-Ito bluish green, slot 4 */
  --caged-a: #0072B2;                        /* Okabe-Ito blue, slot 6 */
  --caged-g: #CC79A7;                        /* Okabe-Ito reddish purple, slot 7 */
  --caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */
  --caged-d-bg: rgba(153, 153, 153, 0.18);  /* D #999999 + 0.18 */
  --caged-c-bg: rgba(0, 158, 115, 0.18);    /* C #009E73 + 0.18 */
  --caged-a-bg: rgba(0, 114, 178, 0.18);    /* A #0072B2 + 0.18 */
  --caged-g-bg: rgba(204, 121, 167, 0.18);  /* G #CC79A7 + 0.18 */
```

- [ ] **Step 3: Verify no syntax errors**

Run: `npx stylelint src/styles/themes.css`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles/themes.css
git commit -m "refactor(themes): replace connector palette with canonical Okabe-Ito + add halo tokens"
```

---

### Task 2: Update CAGED base colors in index.css

**Files:**
- Modify: `src/styles/index.css:20-34`

- [ ] **Step 1: Replace CAGED color definitions**

Replace lines 20-34 with:

```css
  --caged-e: #E69F00;      /* Okabe-Ito orange, connector slot 1 */
  --caged-e-fg: #fff1f2;
  --caged-d: #999999;      /* Okabe-Ito gray, connector slot 3 */
  --caged-d-fg: #fff8db;
  --caged-c: #009E73;      /* Okabe-Ito bluish green, connector slot 4 */
  --caged-c-fg: #f0fdf4;
  --caged-a: #0072B2;      /* Okabe-Ito blue, connector slot 6 */
  --caged-a-fg: #eff6ff;
  --caged-g: #CC79A7;      /* Okabe-Ito reddish purple, connector slot 7 */
  --caged-g-fg: #faf5ff;
  --caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */
  --caged-d-bg: rgba(153, 153, 153, 0.18);  /* D #999999 + 0.18 */
  --caged-c-bg: rgba(0, 158, 115, 0.18);    /* C #009E73 + 0.18 */
  --caged-a-bg: rgba(0, 114, 178, 0.18);    /* A #0072B2 + 0.18 */
  --caged-g-bg: rgba(204, 121, 167, 0.18);  /* G #CC79A7 + 0.18 */
```

Note: `--caged-c`, `--caged-a`, `--caged-c-bg`, `--caged-a-bg` are unchanged from current values. `--caged-g-bg` is also unchanged. Only `--caged-e`, `--caged-d`, `--caged-e-bg`, `--caged-d-bg`, and `--caged-g` change.

- [ ] **Step 2: Verify no syntax errors**

Run: `npx stylelint src/styles/index.css`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/index.css
git commit -m "refactor(styles): update CAGED colors to canonical Okabe-Ito palette"
```

---

### Task 3: Add halo CSS rules to FretboardSVG.module.css

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css:421-493`

- [ ] **Step 1: Add halo layer rules for chord connectors**

Insert the following immediately after the comment block at line 421 (before the existing `path[data-layer="fill"]` rule at line 428), so the halo rule comes first in source order:

```css
.chord-connectors path[data-layer="halo"] {
  fill: none;
  stroke: var(--chord-connector-halo-color, rgba(255, 255, 255, 0.5));
  stroke-width: var(--chord-connector-halo-width, 3px);
  stroke-linejoin: round;
  stroke-linecap: round;
}
```

- [ ] **Step 2: Update the comment block to describe three-pass rendering**

Replace the comment at lines 421-427:

```css
/* -----------------------------------------------------------------------
   Chord-tone connector layer — three-pass halo + fill + outline render.
   Halo layer: wide semi-transparent white stroke for background contrast.
   Fill layer: low-opacity closed polygon beneath note bubbles.
   Outline layer: thin contrasting stroke traced on top.
   All layers use the same closed-path geometry (polygon or capsule).
   Color driven by --chord-connector-color-N via data-palette-index attribute selectors.
   ----------------------------------------------------------------------- */
```

- [ ] **Step 3: Add halo layer rules for interval connectors**

Insert immediately before the existing `.interval-connectors path[data-layer="fill"]` rule (currently line 471):

```css
.interval-connectors path[data-layer="halo"] {
  fill: none;
  stroke: var(--chord-connector-halo-color, rgba(255, 255, 255, 0.5));
  stroke-width: var(--chord-connector-halo-width, 3px);
  stroke-linejoin: round;
  stroke-linecap: round;
}
```

- [ ] **Step 4: Update the interval connectors comment block**

Replace the comment at lines 466-470:

```css
/* -----------------------------------------------------------------------
   2-Strings interval connectors — polyline style matching chord connectors.
   Three-pass halo + fill + outline render; per-pair color via --chord-connector-color-N.
   Shares the same CSS token convention as .chord-connectors.
   ----------------------------------------------------------------------- */
```

- [ ] **Step 5: Verify no syntax errors**

Run: `npx stylelint "src/components/FretboardSVG/FretboardSVG.module.css"`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(fretboard): add halo CSS layer for chord and interval connectors"
```

---

### Task 4: Add halo render pass in FretboardSVG.tsx

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx:452-522`

- [ ] **Step 1: Add halo pass for chord connectors**

Inside the `<motion.g key="chord-connectors" ...>` group (after the opening tag, before the fill pass comment at line 463), insert a new halo pass:

```tsx
                  {/* Halo pass: wide semi-transparent white stroke for background contrast */}
                  {connectorPolylines.map((voicing) => (
                    <motion.path
                      key={`halo-${voicing.voicingKey}`}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      d={voicing.paths.outline}
                      data-layer="halo"
                      data-palette-index={voicing.paletteIndex + 1}
                      style={{ originX: "50%", originY: "50%" }}
                    />
                  ))}
```

Note: the halo uses `voicing.paths.outline` (not `.fill`) — same geometry as the colored outline.

- [ ] **Step 2: Add halo pass for interval connectors**

Inside the interval connectors `<g>` group (after the opening tag, before the fill pass comment at line 503), insert:

```tsx
                {/* Halo pass */}
                {intervalConnectorPolylines.map((line) => (
                  <path
                    key={`iv-halo-${line.key}`}
                    d={line.paths.outline}
                    data-layer="halo"
                    data-palette-index={line.paletteIndex}
                  />
                ))}
```

Note: interval connectors use plain `<path>` (not `<motion.path>`) — matching the existing fill/outline passes.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Run unit tests**

Run: `npm run test`
Expected: all pass. Snapshot tests may need updating if they include connector SVG structure.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "feat(fretboard): add halo render pass for chord and interval connectors"
```

---

### Task 5: Update comment in useChordConnectorPolylines.ts

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts:34`

- [ ] **Step 1: Update the palette description comment**

Change line 34 from:

```ts
 * distance across the 8-color Okabe-Ito-derived palette:
```

to:

```ts
 * distance across the 8-color canonical Okabe-Ito palette:
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts
git commit -m "docs(chord-overlay): update palette comment to canonical Okabe-Ito"
```

---

### Task 6: Build verification and visual snapshot update

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: successful build with no errors.

- [ ] **Step 2: Run full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 3: Update visual regression snapshots**

Run: `npm run test:visual:update`
Expected: connector snapshots regenerate with new palette colors and halo strokes. All 28 snapshots in `e2e/fretboard-connectors.visual.spec.ts-snapshots/` will change, plus any other visual specs that capture connector-visible states.

- [ ] **Step 4: Commit updated snapshots**

```bash
git add e2e/
git commit -m "test(visual): update snapshots for canonical Okabe-Ito palette + halo"
```
