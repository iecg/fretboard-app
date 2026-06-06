# Connector Legibility on Wood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chord-connector spines legible on both wood themes — fix the light-theme casing (currently a white halo that makes lines invisible on maple) and make the redundant dash scale with board size — without changing the Okabe-Ito palette.

**Architecture:** Three independent changes validated by the spec
(`docs/superpowers/specs/2026-06-05-connector-legibility-on-wood-design.md`):
(1) flip one light-theme CSS token to a dark casing, guarded by an APCA
contrast-floor unit test that reads the real tokens; (2) a pure
`connectorDashArray(stringRowPx)` helper that reproduces today's `7px 5px` at the
default row height and floors on small boards; (3) wire that helper into the
existing `.fretboard-neck` custom-property site and have the dash CSS read it.
Dark theme is intentionally left unchanged (its colors already carry on rosewood).

**Tech Stack:** React 19 + TypeScript, Vitest (jsdom + node), culori (already a
dep, used by the existing `cssTokens` APCA helper), Playwright visual regression,
CSS Modules, pnpm workspace.

---

## Background the engineer needs

- **Connector rendering:** each voicing draws two paths in the "below" pass —
  `path[data-layer="halo"]` (underlay) and `path[data-layer="spine"]` (accent
  line). Color is per-voicing via `data-palette-index` → `--chord-connector-color-N`;
  overlapping voicings get a redundant dash (`data-dash="true"`). See
  `src/components/FretboardSVG/FretboardConnectorLayer.tsx` and
  `src/components/FretboardSVG/FretboardSVG.module.css` (lines ~352–390).
- **The defect (measured):** in `modern-light` the halo token is white
  (`--fb-connector-halo: rgb(255 255 255 / 0.7)`); composited over the maple wood
  (`--fretboard-wood-mid: #f1c38e`) its APCA |Lc| is **21** — the lines vanish.
  A dark casing (`rgb(0 0 0 / 0.6)`) composites to **57**. Dark theme
  (`#0d0805` rosewood) already reads via the colors (min = blue at 27) and is
  left unchanged.
- **APCA helpers already exist:** `src/styles/__tests__/cssTokens.ts` exports
  `readThemeBlock(theme)`, `resolveVar(value, map)`, and `contrastAPCA(fg, bg)`.
  `readThemeBlock` parses `themes.css` `[data-theme="..."]` blocks only. The
  **dark** wood mid lives in `tokens.css` `:root`, so the test uses it as a
  documented constant.
- **`--string-row-px` precedent:** `FretboardSVG.tsx` already sets
  `--string-row-px` on the `.fretboard-neck` div's inline `style` object (around
  line 631), where `stringRowPx` is in scope. We add `--fb-connector-dash` to the
  same object. Custom properties inherit through the SVG to the spine paths.
- **Default row height:** `STRING_ROW_PX_TABLET = 36` (from
  `src/layout/responsive.ts`). The dash helper must return `"7px 5px"` at 36 so
  the default board is pixel-unchanged.
- **Commit convention:** Conventional Commits with scope. Run
  `pnpm run lint && pnpm run test && pnpm run build` before any PR (mandatory).

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/styles/themes.css` | Theme tokens | Modify: `modern-light` `--fb-connector-halo` → dark casing. `modern-dark` untouched. |
| `src/styles/__tests__/connectorLegibility.test.ts` | APCA contrast-floor guard | Create. Reuses `cssTokens` helpers. |
| `src/components/FretboardSVG/utils/noteSizing.ts` | Pure sizing helpers | Modify: add `connectorDashArray` + constants. |
| `src/components/FretboardSVG/utils/noteSizing.test.ts` | Sizing helper tests | Modify: add `connectorDashArray` cases. |
| `src/components/FretboardSVG/FretboardSVG.tsx` | SVG orchestrator | Modify: set `--fb-connector-dash` on `.fretboard-neck` style. |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Connector styles | Modify: dash rule reads `var(--fb-connector-dash, 7px 5px)`. |
| `src/components/FretboardSVG/FretboardSVG.test.tsx` | Component test | Modify: assert `--fb-connector-dash` is set. |
| `e2e/fretboard-connectors.visual.spec.ts-snapshots/` (+ app-components/fretboard-svg) | Visual baselines | Regenerate darwin + linux. |

---

## Task 1: Light-theme dark casing + contrast-floor guard

**Files:**
- Create: `src/styles/__tests__/connectorLegibility.test.ts`
- Modify: `src/styles/themes.css` (the `modern-light` `--fb-connector-halo` line, currently line ~290)

- [ ] **Step 1: Write the failing test**

Create `src/styles/__tests__/connectorLegibility.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parse, converter, formatHex } from "culori";
import { readThemeBlock, contrastAPCA } from "./cssTokens";

const toRgb = converter("rgb");

/** Alpha-composite a (possibly translucent) CSS color over an opaque bg hex. */
function compositeOver(fg: string, bgHex: string): string {
  const f = toRgb(parse(fg));
  const b = toRgb(parse(bgHex));
  if (!f || !b) throw new Error(`unparseable color: ${fg} / ${bgHex}`);
  const a = f.alpha ?? 1;
  return formatHex({
    mode: "rgb",
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
  });
}

// On light maple the casing is the load-bearing element: a dark outline that
// stays visible regardless of the (pale) core color. Floor = "clearly visible".
const LIGHT_CASING_FLOOR = 45;
// On dark rosewood the colors carry directly; the floor guards against a future
// dark-palette swap going too dark. Current min is blue (slot 6) at 27.
const DARK_COLOR_FLOOR = 25;
// Dark wood mid lives in tokens.css :root, not themes.css. Source:
// src/styles/tokens.css --fretboard-wood-mid.
const DARK_WOOD_MID = "#0d0805";
// CONNECTOR_PALETTE_ROTATION = [0,5,3,6,1,4] → render adds 1 → CSS slots below.
// (Gray slot 3 and yellow slot 8 are excluded from the rotation and never render.)
const ROTATION_SLOTS = [1, 6, 4, 7, 2, 5];

describe("connector legibility on wood", () => {
  it("light theme: composited dark casing clears the visibility floor on maple", () => {
    const light = readThemeBlock("modern-light");
    const wood = light["--fretboard-wood-mid"];
    const casing = light["--fb-connector-halo"];
    expect(wood, "--fretboard-wood-mid in modern-light").toBeDefined();
    expect(casing, "--fb-connector-halo in modern-light").toBeDefined();
    const effective = compositeOver(casing, wood);
    expect(Math.abs(contrastAPCA(effective, wood))).toBeGreaterThanOrEqual(
      LIGHT_CASING_FLOOR,
    );
  });

  it("dark theme: every rotation palette color clears the floor on rosewood", () => {
    const dark = readThemeBlock("modern-dark");
    for (const slot of ROTATION_SLOTS) {
      const color = dark[`--chord-connector-color-${slot}`];
      expect(color, `slot ${slot} defined`).toBeDefined();
      expect(
        Math.abs(contrastAPCA(color, DARK_WOOD_MID)),
        `slot ${slot} (${color}) vs rosewood`,
      ).toBeGreaterThanOrEqual(DARK_COLOR_FLOOR);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify the light assertion fails**

Run: `pnpm exec vitest run src/styles/__tests__/connectorLegibility.test.ts`
Expected: the **light** test FAILS — current white halo `rgb(255 255 255 / 0.7)`
composites to |Lc| ≈ 21, below the 45 floor. The **dark** test PASSES (colors
unchanged; min blue 27 ≥ 25).

- [ ] **Step 3: Flip the light-theme casing token**

In `src/styles/themes.css`, inside the `[data-theme="modern-light"]` block,
change the connector halo line from:

```css
  --fb-connector-halo: rgb(255 255 255 / 0.7); /* light wood: pale halo lifts the line */
```

to:

```css
  --fb-connector-halo: rgb(0 0 0 / 0.6); /* light wood: dark casing carves the line (APCA composited Lc ~57 vs maple) */
```

Do **not** touch the `[data-theme="modern-dark"]` `--fb-connector-halo`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/styles/__tests__/connectorLegibility.test.ts`
Expected: PASS (light |Lc| ≈ 57 ≥ 45; dark all ≥ 25).

- [ ] **Step 5: Confirm no existing token test regressed**

Run: `pnpm exec vitest run src/styles/__tests__/cssTokens.test.ts`
Expected: PASS (it asserts `--fb-connector-accent` → color-2; the halo change is
unrelated).

- [ ] **Step 6: Commit**

```bash
git add src/styles/themes.css src/styles/__tests__/connectorLegibility.test.ts
git commit -m "fix(connectors): dark casing for legible spines on light wood

Light-theme --fb-connector-halo was white; composited over maple its APCA
Lc is ~21, so the colored spines vanished. Flip it to rgb(0 0 0 / 0.6)
(composited Lc ~57) so each line reads as a dark-outlined colored stroke.
Dark theme is unchanged (its colors already carry on rosewood). Guarded by
a new APCA contrast-floor test reading the real tokens.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `connectorDashArray` pure helper

**Files:**
- Modify: `src/components/FretboardSVG/utils/noteSizing.ts`
- Test: `src/components/FretboardSVG/utils/noteSizing.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/components/FretboardSVG/utils/noteSizing.test.ts` (add
`connectorDashArray` to the existing top-of-file import from `./noteSizing`):

```ts
describe("connectorDashArray", () => {
  it("reproduces the legacy 7px 5px at the default tablet row height (36)", () => {
    expect(connectorDashArray(36)).toBe("7px 5px");
  });

  it("scales up on a taller (desktop) row height", () => {
    expect(connectorDashArray(42)).toBe("8px 6px");
  });

  it("never shrinks below the dash/gap floor on tiny boards", () => {
    expect(connectorDashArray(10)).toBe("6px 4px");
    expect(connectorDashArray(0)).toBe("6px 4px");
  });

  it("clamps to the maximum on very large row heights", () => {
    expect(connectorDashArray(1000)).toBe("10px 7px");
  });

  it("is monotonically non-decreasing in stringRowPx", () => {
    const dash = (s: number) => Number(connectorDashArray(s).split("px")[0]);
    for (let s = 8; s < 80; s++) {
      expect(dash(s + 1)).toBeGreaterThanOrEqual(dash(s));
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/noteSizing.test.ts -t connectorDashArray`
Expected: FAIL with "connectorDashArray is not a function" (or an import error).

- [ ] **Step 3: Implement the helper**

Append to `src/components/FretboardSVG/utils/noteSizing.ts`:

```ts
/**
 * Dash geometry for the connector spine's redundant dash cue. Scales with the
 * board's vertical row height so the dash never collapses to dots on small/zoomed
 * boards. Tuned so the default tablet row height (STRING_ROW_PX_TABLET = 36)
 * yields the legacy "7px 5px"; smaller boards floor at DASH/GAP minimums and
 * larger boards grow to the maxima.
 */
export const CONNECTOR_DASH_FACTOR = 0.194; // 7 / 36
export const CONNECTOR_GAP_FACTOR = 0.139; // 5 / 36
export const CONNECTOR_DASH_MIN_PX = 6;
export const CONNECTOR_DASH_MAX_PX = 10;
export const CONNECTOR_GAP_MIN_PX = 4;
export const CONNECTOR_GAP_MAX_PX = 7;

export function connectorDashArray(stringRowPx: number): string {
  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));
  const safe = Number.isFinite(stringRowPx) && stringRowPx > 0 ? stringRowPx : 0;
  const dash = clamp(
    Math.round(safe * CONNECTOR_DASH_FACTOR),
    CONNECTOR_DASH_MIN_PX,
    CONNECTOR_DASH_MAX_PX,
  );
  const gap = clamp(
    Math.round(safe * CONNECTOR_GAP_FACTOR),
    CONNECTOR_GAP_MIN_PX,
    CONNECTOR_GAP_MAX_PX,
  );
  return `${dash}px ${gap}px`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/noteSizing.test.ts -t connectorDashArray`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/noteSizing.ts src/components/FretboardSVG/utils/noteSizing.test.ts
git commit -m "feat(connectors): add zoom-aware connectorDashArray helper

Pure helper returning the spine dash 'dash gap' string scaled from
stringRowPx, reproducing the legacy 7px 5px at the default tablet row
height and flooring so the dash never collapses to dots on small boards.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire the dash custom property + CSS

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx` (import + `.fretboard-neck` style object, around line 624–634)
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (dash rule, line ~374)
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write the failing component test**

Add to `src/components/FretboardSVG/FretboardSVG.test.tsx` (inside the
`describe("FretboardSVG/FretboardSVG", ...)` block; `renderCMajor` already exists
at the top of the file):

```ts
it("sets the --fb-connector-dash custom property on the neck", () => {
  const { container } = renderCMajor();
  const neck = container.querySelector('[style*="--fb-connector-dash"]');
  expect(neck).not.toBeNull();
  expect(neck!.getAttribute("style")).toMatch(/--fb-connector-dash:\s*\d+px \d+px/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "fb-connector-dash"`
Expected: FAIL — no element carries `--fb-connector-dash` yet (querySelector returns null).

- [ ] **Step 3: Set the custom property in FretboardSVG.tsx**

`FretboardSVG.tsx` does not currently import from `./utils/noteSizing`, so add a
new import line near the other local imports (e.g. just below the
`import ... from "./FretboardConnectorLayer";` line at the top of the file):

```ts
import { connectorDashArray } from "./utils/noteSizing";
```

(`CSSProperties` is already imported at the top of the file — no change needed
there.)

Then in the `.fretboard-neck` `style` object (the one already containing
`"--string-row-px": \`${stringRowPx}px\``), add one line:

```tsx
        style={
          {
            height: `${neckHeight}px`,
            width: `${neckWidthPx}px`,
            willChange: "transform",
            "--string-row-px": `${stringRowPx}px`,
            "--fb-connector-dash": connectorDashArray(stringRowPx),
            "--fretboard-svg-glow-orange-url": glowFilterUrls.orange,
          } as CSSProperties
        }
```

- [ ] **Step 4: Update the dash CSS rule to read the property**

In `src/components/FretboardSVG/FretboardSVG.module.css`, change the dashed-spine
rule from:

```css
.chord-connectors path[data-layer="spine"][data-dash="true"] {
  stroke-dasharray: 7px 5px;
}
```

to:

```css
.chord-connectors path[data-layer="spine"][data-dash="true"] {
  stroke-dasharray: var(--fb-connector-dash, 7px 5px);
}
```

- [ ] **Step 5: Run the component test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx -t "fb-connector-dash"`
Expected: PASS.

- [ ] **Step 6: Run the connector layer tests to confirm no regression**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardConnectorLayer.test.tsx`
Expected: PASS — the layer's structure is unchanged; existing dashed-spine
assertions still hold via the `7px 5px` CSS fallback.

- [ ] **Step 7: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.module.css src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "feat(connectors): drive spine dash from zoom-aware custom property

Set --fb-connector-dash on the existing .fretboard-neck style (where
stringRowPx is in scope) via connectorDashArray; the dashed-spine rule reads
it with a 7px 5px fallback. Inherits through the SVG to the spine paths; no
new connector-layer prop. Default board is pixel-unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full gate + visual-regression refresh

**Files:**
- Modify (regenerate): `e2e/fretboard-connectors.visual.spec.ts-snapshots/*` and any
  `app-components` / `fretboard-svg` snapshots that include connectors, darwin + linux.

- [ ] **Step 1: Run the full local gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: lint 0 errors; all unit/component tests pass (including the two new
suites); build succeeds.

- [ ] **Step 2: Refresh darwin visual snapshots**

Run: `pnpm run test:visual:update`
Expected: the `fretboard-connectors` **light** baselines change (spines now
visible with a dark casing); **dark** baselines change only if the dash geometry
differs at the captured row height (casing unchanged). Other suites unchanged
except where they render connectors.

- [ ] **Step 3: Inspect the refreshed light-theme baselines**

Open `e2e/fretboard-connectors.visual.spec.ts-snapshots/connector-c-major-light-chromium-darwin.png`
and `connector-c-major-spread-edge-light-chromium-darwin.png`. Confirm visually:
- Every spine is now a clearly-outlined colored line on the maple wood (no longer
  washed out).
- Overlapping voicings remain distinguishable (distinct colors; dashed vs solid).

If a spine is still hard to see, STOP and report — the casing alpha may need a
small bump (the floor test will still pass; this is a visual confirmation gate).

- [ ] **Step 4: Regenerate the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: the matching `*-chromium-linux.png` baselines update for the same
frames. (This is the cross-platform path referenced in CLAUDE.md.)

- [ ] **Step 5: Commit the snapshots**

```bash
git add e2e
git commit -m "test(connectors): refresh connector visual baselines for wood legibility

Light-theme spines are now dark-cased and visible; dash may differ where the
captured row height changes the scaled dasharray. darwin + linux.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] Re-run the full gate once more on the finished branch:
  `pnpm run lint && pnpm run test && pnpm run build` — all green.
- [ ] Confirm the acceptance criteria from the spec:
  - Light theme: `connectorLegibility` light test passes (casing |Lc| ≥ 45).
  - Dark theme: `connectorLegibility` dark test passes (rotation colors |Lc| ≥ 25).
  - Dash is `7px 5px` at row height 36 (noteSizing test) and floors on small boards.
  - Light-theme connector snapshots show visible, distinguishable spines.
- [ ] Hand off via superpowers:finishing-a-development-branch.
