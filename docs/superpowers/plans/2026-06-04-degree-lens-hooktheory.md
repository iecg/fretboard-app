# Degree-Lens Hooktheory Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the opt-in degree-color lens so its note fills adopt the Hooktheory/Hookpad scale-degree palette (1=red…7=pink), with uniform white labels + dark contour and a distinct neutral-slate treatment for chromatic/blue notes.

**Architecture:** The lens already binds a per-note inline `--degree-color` (from the core `DEGREE_COLORS` map) and `data-scale-degree`; CSS turns those into `--note-degree-fill` (light = per-degree token, dark = `color-mix` of the base hue with navy). We (1) reassign the seven proven, separation-passing base colors to Hooktheory degree positions, (2) re-point the light-mode fill tokens, (3) re-tune dark-mode muting so the white label clears APCA, (4) force white+contour degree labels in light mode, and (5) lock it all with an APCA glyph-on-fill gate.

**Tech Stack:** TypeScript (`@fretflow/core`), Vitest, CSS custom properties (`themes.css`, CSS Modules), culori (color math in tests), Playwright visual regression.

**Spec:** `docs/superpowers/specs/2026-06-04-degree-lens-hooktheory-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `packages/core/src/degrees.ts` | `DEGREE_COLORS` map + `BLUE_NOTE_COLOR` | Reassign 7 base hues to Hooktheory order; slate for blue note; add `b2/b6/b7` |
| `packages/core/src/degrees.test.ts` | Palette property tests | Hooktheory hue-ordering + slate non-hue + ≠degree-5 guard |
| `src/styles/themes.css` | `--degree-light-fill-*` tokens + dark `color-mix` rules | Re-point light tokens; re-tune dark muting; broaden chromatic selector |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Degree-note label rendering | Light-mode degree labels → white + dark contour |
| `src/styles/__tests__/fbColorTokens.test.ts` | APCA glyph-on-fill gate | Gate white glyph on all 8 degree fills × {light, dark} |
| `docs/design/fretboard-visual-language.md` | Durable design reference | Record final palette + slate + white-label-contour decision |

**Key facts for the implementer (verified against the codebase):**
- The seven current `DEGREE_COLORS` values already satisfy the existing pairwise-separation test (`oklabDistance ≥ 0.14`). Reassigning the *same* hex values to new degree positions preserves that — do **not** invent new base hex.
- Dark-mode degree fills are computed as `color-mix(in srgb, var(--degree-color) N%, #0f172a)` where `--degree-color` is set inline per note from `DEGREE_COLORS`. Re-pointing `DEGREE_COLORS` automatically updates dark fills; the per-degree `N%` overrides are what you tune.
- Light-mode note labels resolve to `--fretboard-note-text-fill: #2a251d` (INK) via the base theme rule. The current degree override re-asserts INK. To get white labels you must **replace** the override with white+contour (mirroring the home-marker rule at `FretboardSVG.module.css:82`), not delete it. Dark mode already renders white (`FretboardSVG.module.css:65`).

---

## Task 1: Reassign `DEGREE_COLORS` to Hooktheory order + slate blue note

**Files:**
- Modify: `packages/core/src/degrees.ts:98-131`
- Test: `packages/core/src/degrees.test.ts:263-345` (extend the `describe('DEGREE_COLORS')` block)

- [ ] **Step 1: Add hue/chroma helpers + Hooktheory-mapping tests (failing)**

In `packages/core/src/degrees.test.ts`, immediately after the existing `oklabDistance` function (around line 45), add:

```ts
function oklabHue(color: string) {
  const [, a, b] = toOklab(color);
  return (Math.atan2(b, a) * 180) / Math.PI;
}
function oklabHueDeg(color: string) {
  return (oklabHue(color) + 360) % 360;
}
function oklabChroma(color: string) {
  const [, a, b] = toOklab(color);
  return Math.hypot(a, b);
}
```

Then inside the existing `describe('DEGREE_COLORS', () => { … })` block, add these tests:

```ts
it('maps degree 1 to red', () => {
  const h = oklabHueDeg(DEGREE_COLORS['I']);
  expect(h).toBeGreaterThan(10);
  expect(h).toBeLessThan(50);
});

it('maps degree 5 to blue', () => {
  const h = oklabHueDeg(DEGREE_COLORS['V']);
  expect(h).toBeGreaterThan(220);
  expect(h).toBeLessThan(290);
});

it('orders degree hues spectrally 1→7 (red→pink)', () => {
  const hues = BASE_DEGREE_COLOR_KEYS.map((d) => oklabHueDeg(DEGREE_COLORS[d]));
  for (let i = 1; i < hues.length; i++) {
    expect(hues[i]).toBeGreaterThan(hues[i - 1]);
  }
});

it('renders the blue note as a low-chroma non-hue, distinct from degree 5', () => {
  expect(oklabChroma(BLUE_NOTE_COLOR)).toBeLessThan(0.05);
  BASE_DEGREE_COLOR_KEYS.forEach((d) => {
    expect(oklabChroma(DEGREE_COLORS[d])).toBeGreaterThan(0.05);
  });
  expect(oklabDistance(BLUE_NOTE_COLOR, DEGREE_COLORS['V'])).toBeGreaterThanOrEqual(0.14);
});
```

Also extend the existing `it("has a distinct blue-note color …")` test body to cover the new tokens and the degree-5 guard:

```ts
it("has a distinct blue-note color for blues-scale color tones", () => {
  expect(DEGREE_COLORS["b3"]).toBe(BLUE_NOTE_COLOR);
  expect(DEGREE_COLORS["b5"]).toBe(BLUE_NOTE_COLOR);
  expect(DEGREE_COLORS["b2"]).toBe(BLUE_NOTE_COLOR);
  expect(DEGREE_COLORS["b6"]).toBe(BLUE_NOTE_COLOR);
  expect(DEGREE_COLORS["b7"]).toBe(BLUE_NOTE_COLOR);
  expect(BLUE_NOTE_COLOR).not.toBe(DEGREE_COLORS["II"]);
  expect(BLUE_NOTE_COLOR).not.toBe(DEGREE_COLORS["V"]);
  expect(BLUE_NOTE_COLOR).not.toBe(DEGREE_COLORS["VII"]);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm --filter @fretflow/core exec vitest run src/degrees.test.ts -t "DEGREE_COLORS"`
Expected: FAIL — current map has degree 1 = orange (hue ~62°, not <50°), hues not spectrally ordered, and `b2/b6/b7` undefined / `BLUE_NOTE_COLOR` (#0047ff) collides nowhere yet but chroma is high.

- [ ] **Step 3: Reassign the palette in `degrees.ts`**

Replace lines `98-131` of `packages/core/src/degrees.ts` (the `BLUE_NOTE_COLOR` const and the `DEGREE_COLORS` object) with:

```ts
// Slate — chromatic/blue-note degrees. A deliberate low-chroma non-hue so it
// can't be mistaken for any of the seven degree hues (esp. degree-5 blue); the
// diamond shape carries the "chromatic" meaning. See
// docs/design/fretboard-visual-language.md §A.
export const BLUE_NOTE_COLOR = "#6b7884";

// Hooktheory/Hookpad scale-degree palette, mapped BY DEGREE NUMBER (all quality
// variants share their number's hue): 1=red, 2=orange, 3=yellow, 4=green,
// 5=blue, 6=purple, 7=pink. These are the seven previously-shipped, separation-
// passing colors reassigned to Hooktheory positions.
export const DEGREE_COLORS: Record<string, string> = {
  "I": "#e41a1c", "I+": "#e41a1c", "i": "#e41a1c", "i°": "#e41a1c",          // 1 red
  "II": "#ff7f00", "II+": "#ff7f00", "ii": "#ff7f00", "ii°": "#ff7f00",      // 2 orange
  "III": "#fdd835", "III+": "#fdd835", "iii": "#fdd835", "iii°": "#fdd835",  // 3 yellow
  "IV": "#4daf4a", "IV+": "#4daf4a", "iv": "#4daf4a", "iv°": "#4daf4a",      // 4 green
  "V": "#377eb8", "V+": "#377eb8", "v": "#377eb8", "v°": "#377eb8",          // 5 blue
  "VI": "#7e22ce", "VI+": "#7e22ce", "vi": "#7e22ce", "vi°": "#7e22ce",      // 6 purple
  "VII": "#f781bf", "VII+": "#f781bf", "vii": "#f781bf", "vii°": "#f781bf",  // 7 pink
  "b2": BLUE_NOTE_COLOR,
  "b3": BLUE_NOTE_COLOR,
  "b5": BLUE_NOTE_COLOR,
  "b6": BLUE_NOTE_COLOR,
  "b7": BLUE_NOTE_COLOR,
};
```

- [ ] **Step 4: Run the full `degrees.test.ts` to verify green**

Run: `pnpm --filter @fretflow/core exec vitest run src/degrees.test.ts`
Expected: PASS — all `DEGREE_COLORS` tests pass, including the existing separation (`≥0.14`) and dominant-vs-leading (`≥0.3`) tests (same hex values, so distances are unchanged), plus the new hue-ordering/slate tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/degrees.ts packages/core/src/degrees.test.ts
git commit -m "feat(core): map degree colors to the Hooktheory palette

Reassign the seven scale-degree base colors to Hooktheory order
(1=red…7=pink) and make the chromatic blue note a distinct low-chroma
slate (was vivid blue, which now collides with degree-5 blue). Adds
b2/b6/b7 chromatic tokens. Locks the mapping with spectral hue-ordering
and slate non-hue tests.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Re-point light-mode degree fill tokens + broaden chromatic selector

**Files:**
- Modify: `src/styles/themes.css:97-104` (the `--degree-light-fill-*` tokens) and `:425-427` (the light chromatic selector)

- [ ] **Step 1: Re-point the light fill tokens**

Replace lines `97-104` of `src/styles/themes.css` (the eight `--degree-light-fill-*` declarations, keeping `--degree-light-fill-default` at line 96 unchanged) with the reassigned dark, white-label-legible fills:

```css
  --degree-light-fill-I: #b5161b;   /* 1 red */
  --degree-light-fill-II: #b45d00;  /* 2 orange */
  --degree-light-fill-III: #8f6e00; /* 3 yellow */
  --degree-light-fill-IV: #2f8a3d;  /* 4 green */
  --degree-light-fill-V: #1f5f95;   /* 5 blue */
  --degree-light-fill-VI: #5f22ab;  /* 6 purple */
  --degree-light-fill-VII: #ad4b80; /* 7 pink */
  --degree-light-fill-blue: #56646e;/* slate — chromatic/blue note */
```

- [ ] **Step 2: Broaden the light-mode chromatic selector**

Replace the existing rule at `src/styles/themes.css:425-427`:

```css
[data-theme="modern-light"] :is([data-scale-degree="b3"], [data-scale-degree="b5"]) {
  --note-degree-fill: var(--degree-light-fill-blue);
}
```

with the full chromatic set (so any interval-name fallback gets slate):

```css
[data-theme="modern-light"]
  :is(
    [data-scale-degree="b2"],
    [data-scale-degree="b3"],
    [data-scale-degree="b5"],
    [data-scale-degree="b6"],
    [data-scale-degree="b7"]
  ) {
  --note-degree-fill: var(--degree-light-fill-blue);
}
```

- [ ] **Step 3: Verify lint passes (no test yet — locked by Task 5)**

Run: `pnpm run lint`
Expected: PASS (stylelint clean — no malformed selectors/values).

- [ ] **Step 4: Commit**

```bash
git add src/styles/themes.css
git commit -m "feat(fretboard): re-point light-mode degree fills to Hooktheory palette

Reassign the per-degree light fill tokens to the Hooktheory hue order
and point the chromatic/blue-note token at slate. Broaden the light
chromatic selector to cover b2/b3/b5/b6/b7.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Re-tune dark-mode degree muting

**Files:**
- Modify: `src/styles/themes.css:429-440` (the `modern-dark` `[data-scale-degree]` rules)

- [ ] **Step 1: Rewrite the dark-mode degree rules**

Replace lines `429-440` of `src/styles/themes.css` (the default dark rule plus the two existing III/VI overrides) with a default plus per-bright-hue overrides. Brightness now follows the Hooktheory reassignment, so the bright hues needing extra muting are degree 2 (orange), 3 (yellow), 4 (green), and 7 (pink):

```css
[data-theme="modern-dark"] [data-scale-degree] {
  --note-degree-fill: color-mix(in srgb, var(--degree-color, #377eb8) 62%, #0f172a);
}

/* Bright hues are muted harder toward the navy base so the white label clears
   the APCA glyph-on-fill gate (see fbColorTokens.test.ts). Percentages are
   gate-locked — keep them in sync with DARK_DEGREE_MIX_PCT in that test. */
[data-theme="modern-dark"]
  :is([data-scale-degree="II"], [data-scale-degree="ii"], [data-scale-degree="ii°"], [data-scale-degree="II+"]) {
  --note-degree-fill: color-mix(in srgb, var(--degree-color) 52%, #0f172a); /* orange */
}
[data-theme="modern-dark"]
  :is([data-scale-degree="III"], [data-scale-degree="iii"], [data-scale-degree="iii°"], [data-scale-degree="III+"]) {
  --note-degree-fill: color-mix(in srgb, var(--degree-color) 46%, #0f172a); /* yellow */
}
[data-theme="modern-dark"]
  :is([data-scale-degree="IV"], [data-scale-degree="iv"], [data-scale-degree="iv°"], [data-scale-degree="IV+"]) {
  --note-degree-fill: color-mix(in srgb, var(--degree-color) 52%, #0f172a); /* green */
}
[data-theme="modern-dark"]
  :is([data-scale-degree="VII"], [data-scale-degree="vii"], [data-scale-degree="vii°"], [data-scale-degree="VII+"]) {
  --note-degree-fill: color-mix(in srgb, var(--degree-color) 56%, #0f172a); /* pink */
}
```

> Note: degree 1 (red), 5 (blue), 6 (purple) and the slate blue note are dark enough to use the 62% default. The percentages above are starting points; Task 5's gate is authoritative — adjust a percentage (and its mirror in the test) if any degree fails.

- [ ] **Step 2: Verify lint passes**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes.css
git commit -m "feat(fretboard): re-tune dark-mode degree muting for Hooktheory hues

Mute the bright reassigned hues (orange/yellow/green/pink) harder toward
the navy base so the white degree label stays legible in dark mode.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Light-mode degree labels → white + dark contour

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css:294-297`

- [ ] **Step 1: Replace the light-mode degree-text override**

Replace the rule at `src/components/FretboardSVG/FretboardSVG.module.css:294-297`:

```css
:global([data-theme="modern-light"]) .fretboard-board[data-degree-colors="true"] .fretboard-note[data-scale-degree] text {
  fill: var(--note-label-on-color);
  stroke: var(--note-label-on-color-stroke);
}
```

with a white glyph + dark contour (matching the home-marker treatment at line 82; `paint-order: stroke` and `stroke-width` are inherited from the base `.fretboard-note text` rule):

```css
/* Degree-lens labels render white + dark contour in BOTH themes (dark mode
   already does via the base rule). The contour — not a per-degree glyph color —
   carries legibility across the palette, incl. the paler yellow and slate. */
:global([data-theme="modern-light"]) .fretboard-board[data-degree-colors="true"] .fretboard-note[data-scale-degree] text {
  fill: #ffffff;
  stroke: rgb(0 0 0 / 0.4);
}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(fretboard): render degree-lens labels white + contour in light mode

Replace the light-mode dark-ink degree glyph with a white glyph + dark
contour (the home-marker treatment), so degree labels are uniform white
with a legibility halo across both themes.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: APCA glyph-on-fill gate for degree fills (the lock)

**Files:**
- Modify: `src/styles/__tests__/fbColorTokens.test.ts` (add imports + a new `describe`)

- [ ] **Step 1: Add the degree-fill APCA gate**

At the top of `src/styles/__tests__/fbColorTokens.test.ts`, extend the culori import (line 3) to include `interpolate`, and add an import of the core palette:

```ts
import { differenceEuclidean, parse, converter, formatHex, interpolate } from "culori";
import { DEGREE_COLORS, BLUE_NOTE_COLOR } from "@fretflow/core";
```

Then append this `describe` block at the end of the file (after the existing APCA block):

```ts
/**
 * Degree-lens glyph gate. The lens renders a WHITE number glyph + dark contour
 * on each degree fill (FretboardSVG.module.css). We gate white-on-fill at the
 * text tier (|Lc| ≥ 45); the contour is an additional, un-credited safety
 * margin. Light fills are resolvable theme tokens; dark fills are computed as
 * color-mix(in srgb, <base hue> N%, #0f172a) with the base hue from the core
 * DEGREE_COLORS map. DARK_DEGREE_MIX_PCT MUST mirror the modern-dark
 * [data-scale-degree] percentages in themes.css.
 */
describe("APCA: degree-lens white glyph on degree fills (text gate)", () => {
  const DEGREES = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
  const NAVY = "#0f172a";
  const DARK_DEGREE_MIX_PCT: Record<string, number> = {
    I: 62, II: 52, III: 46, IV: 52, V: 62, VI: 62, VII: 56,
  };
  const mixSrgb = (hue: string, pct: number) =>
    formatHex(interpolate([NAVY, hue], "srgb")(pct / 100)) ?? hue;

  const lb = readThemeBlock("modern-light");
  for (const d of DEGREES) {
    it(`modern-light white glyph on degree ${d} fill |Lc|≥${APCA_TEXT_MIN}`, () => {
      const fill = hexOf(resolveVar(lb[`--degree-light-fill-${d}`], lb));
      expect(Math.abs(contrastAPCA("#ffffff", fill))).toBeGreaterThanOrEqual(APCA_TEXT_MIN);
    });
  }
  it(`modern-light white glyph on blue-note (slate) fill |Lc|≥${APCA_TEXT_MIN}`, () => {
    const fill = hexOf(resolveVar(lb["--degree-light-fill-blue"], lb));
    expect(Math.abs(contrastAPCA("#ffffff", fill))).toBeGreaterThanOrEqual(APCA_TEXT_MIN);
  });

  for (const d of DEGREES) {
    it(`modern-dark white glyph on degree ${d} fill |Lc|≥${APCA_TEXT_MIN}`, () => {
      const fill = mixSrgb(DEGREE_COLORS[d], DARK_DEGREE_MIX_PCT[d]);
      expect(Math.abs(contrastAPCA("#ffffff", fill))).toBeGreaterThanOrEqual(APCA_TEXT_MIN);
    });
  }
  it(`modern-dark white glyph on blue-note (slate) fill |Lc|≥${APCA_TEXT_MIN}`, () => {
    const fill = mixSrgb(BLUE_NOTE_COLOR, 62);
    expect(Math.abs(contrastAPCA("#ffffff", fill))).toBeGreaterThanOrEqual(APCA_TEXT_MIN);
  });
});
```

- [ ] **Step 2: Run the gate**

Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts`
Expected: PASS. If any DARK degree fails (`|Lc| < 45`), lower that degree's percentage in **both** `DARK_DEGREE_MIX_PCT` (this test) **and** the matching `themes.css` rule (Task 3), then re-run until green. If any LIGHT degree fails, darken that `--degree-light-fill-*` token (Task 2). Adjust L/C only — never the hue.

- [ ] **Step 3: Commit**

```bash
git add src/styles/__tests__/fbColorTokens.test.ts src/styles/themes.css
git commit -m "test(styles): gate APCA legibility of white degree-lens labels

Add a glyph-on-fill text gate (|Lc|≥45) for the white degree label over
all eight degree fills in both themes (dark fills replicate the CSS
color-mix), locking the Hooktheory palette's legibility.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Update durable doc + refresh visual snapshots + full gate

**Files:**
- Modify: `docs/design/fretboard-visual-language.md:100-105` and `:251`
- Update: visual regression snapshots under `e2e/` (degree-lens scenarios, if any)

- [ ] **Step 1: Record the final decision in the durable doc**

In `docs/design/fretboard-visual-language.md`, replace the degree-lens bullet (lines 100-105) with text that records the shipped result:

```markdown
- **Degree-color lens → Hooktheory mapping (shipped 2026-06-04).** The opt-in
  degree lens (which *deliberately overrides* the amber-home palette while active)
  adopts Hookpad's mapping by degree number: 1=red, 2=orange, 3=yellow, 4=green,
  5=blue, 6=purple, 7=pink (all quality variants share their number's hue;
  `data-scale-degree` is key-relative, so it's interval-relative across keys).
  Hues are realized as OKLCH-disciplined fills tuned for wood + the APCA
  glyph-on-fill gate; labels are uniform **white + dark contour** in both themes
  (the contour carries legibility, not a per-degree glyph color). Chromatic/blue
  notes (e.g. the blues ♭5) use a distinct low-chroma **slate** — never a hue —
  so they can't be read as degree-5 blue; the diamond shape carries "chromatic".
  Rationale: maximal cross-tool familiarity for Hookpad learners, within our
  color discipline. **[web]** Hooktheory scale-degree colors.
```

Then remove the now-resolved open-item line at `docs/design/fretboard-visual-language.md:251`:

```markdown
- **Degree lens → Hooktheory** chromatic/blue-note degree hue and dark-mode muting values.
```

- [ ] **Step 2: Refresh visual snapshots**

Run: `pnpm run test:visual:update`
Expected: any snapshot diffs are confined to degree-lens (degree-colored) note fills/labels. Inspect the changed PNGs to confirm — no diffs outside degree-colored notes. (If no degree-lens visual scenario exists, the suite passes with no degree-related diffs; note that and proceed.)

- [ ] **Step 3: Run the full local gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/design/fretboard-visual-language.md e2e
git commit -m "docs(design): record shipped degree-lens Hooktheory palette + refresh snapshots

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3.1 hue-by-number mapping → Task 1 (palette) + Task 1 tests (hue ordering).
- §3.2 uniform white labels + contour → Task 4 (light; dark already white) + Task 5 gate uses white glyph.
- §3.3 chromatic → slate (incl. interval-name fallbacks b2/b6/b7) → Task 1 (`DEGREE_COLORS`) + Task 2 (light selector) + slate non-hue/≠degree-5 tests.
- §3.4 dark-mode color-mix muting → Task 3 + Task 5 gate.
- §4 palette tokens → Task 1 (base) + Task 2 (light) + Task 3 (dark).
- §5.1–5.7 surface → Tasks 1–6 (5.6 topology: no change needed, confirmed; 5.7 doc → Task 6).
- §6 testing → Task 1/5 unit+gate, Task 6 visual + full gate.

**Placeholder scan:** none — every code step shows the exact code/selector and an exact command with expected output.

**Type/name consistency:** `DEGREE_COLORS`, `BLUE_NOTE_COLOR`, `--degree-light-fill-{I..VII,blue,default}`, `--note-degree-fill`, `--degree-color`, `data-scale-degree`, `data-degree-colors`, `APCA_TEXT_MIN`, `readThemeBlock`, `resolveVar`, `contrastAPCA`, `hexOf` all match their definitions in the codebase. `DARK_DEGREE_MIX_PCT` (test) is explicitly tied to the Task 3 CSS percentages.
