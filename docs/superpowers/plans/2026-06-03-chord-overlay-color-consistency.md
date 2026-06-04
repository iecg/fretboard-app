# Chord Overlay Color Consistency — OKLCH Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the fretboard overlay's parallel hand-tuned light/dark hex tokens into single-source OKLCH semantic tokens (hue + chroma defined once, lightness derived per theme), remove the now-orphaned multi-hue note-role tokens, prune confirmed dead tokens, and verify every marker/label pair against both wood backgrounds with APCA — completing §6–§8 of the approved color-consistency design.

**Architecture:** The amber-home / teal-guide / neutral-rest *visual* language (§3–§5) is already live in `FretboardSVG.module.css` and `FretboardShapeLayer.tsx`; this plan changes only the **token representation** in `src/styles/themes.css` (plus a small test/script harness). Each `--fb-*` semantic color becomes `oklch(var(--fb-X-l) var(--fb-X-c) var(--fb-X-h))`, where `--fb-X-h`/`--fb-X-c` (hue/chroma) live in a shared block and each theme overrides only `--fb-X-l` (lightness) — and, where the design intentionally inverts saturation, `--fb-X-c`. The migration is **equivalence-preserving**: OKLCH triplets are machine-derived from the existing hex so the rendered board is visually unchanged, *then* APCA-driven lightness nudges land as separate, visible commits. Visual-regression snapshots are the safety net.

**Tech Stack:** CSS custom properties + `oklch()` + `color-mix()`; Vitest (token-invariant + APCA unit tests, Node environment); `culori` (devDependency, sRGB↔OKLCH conversion in a one-shot script + test helper); inlined APCA-W3 lightness-contrast formula; Playwright visual regression (`pnpm run test:visual`).

---

## Current state — already implemented (DO NOT re-do)

Verified by exploration on 2026-06-03. These parts of the design are **live** and out of scope here:

- **§3–§4 visual language:** amber `--fb-home-*`, teal `--fb-guide-*` (wired via `[data-note-guide-tone]` attribute in `FretboardNote.tsx:149` → `FretboardSVG.module.css:100-104`), neutral `--fb-neutral-*` for scale/diatonic/chromatic. No cyan/violet hue reaches a marker fill.
- **§5 full-chord recolor removed:** no `--shape-fill`/`--shape-stroke`; `data-full-chord-mode` attribute is set but has no CSS consumer.
- **§5 region tint:** `FretboardShapeLayer.tsx:44-56` hard-codes `fill="var(--fb-region-tint)"` (single neutral tint); the CAGED 5-hue palette is defined-but-ignored.
- **§5 connector accent:** `--fb-connector-accent` (vermillion light / orange dark) wired at `FretboardSVG.module.css:403-405`.
- **§5 degree-color lens:** opt-in `scaleDegreeColorsEnabledAtom` (`src/store/uiAtoms.ts`) preserved, overrides role colors when on.
- **§6 practice-lens CSS:** removed — no `[data-practice-lens]` in output.

## Remaining scope (this plan)

- **§7 OKLCH single-source migration** of the eight `--fb-*` semantic colors (the core work). *Not done — all tokens are hex/rgb with parallel light/dark values.*
- **§6 neutralize leftovers:** the role markers already point at neutral tokens, but the old hue tokens (`--note-ring` cyan, `--note-ring-color-tone` sage, `--note-blue` cyan) still linger — remove the ones with zero remaining consumers.
- **§8 dead-token cleanup** (grep-guarded).
- **§7 APCA audit** of every marker/label pair against both wood backgrounds.

**Explicitly out of scope (design backlog, §8):** the opt-in "show all CAGED positions" 5-hue overview; Hooktheory degree-mapping alignment; the marker-spec geometry backlog (diamonds, vertical-voicing band, ♭6). Do not touch the degree-color palette (`--degree-light-fill-*`) or the lens-emphasis token chains beyond what Task 6 explicitly removes.

---

## Token inventory (the eight `--fb-*` semantic colors)

Source: `src/styles/themes.css`. Current values:

| Token | Light value | Dark value | Migration |
|---|---|---|---|
| `--fb-home-fill` | `#b5670a` | `#b5670a` (same) | OKLCH, single L (identical both themes) |
| `--fb-home-stroke` | `var(--note-ring-tonic)` → `#b1431b` | `var(--note-ring-tonic)` → `var(--neon-orange)` | Replace var-chain with explicit OKLCH |
| `--fb-guide-fill` | `#cfeefb` (pale teal) | `#1f5876` (deep teal) | OKLCH, **L + C invert**, shared hue |
| `--fb-guide-stroke` | `#1583a6` (mid teal) | `#7cecff` (bright cyan) | OKLCH, L + C invert, shared hue |
| `--fb-neutral-fill` | `#e3ddd8` (warm cream) | `#1b232c` (cool navy) | OKLCH, low C, hue differs by theme (documented) |
| `--fb-neutral-stroke` | `#574d40` (warm brown) | `#9aa3ab` (cool gray) | OKLCH, low C, hue differs by theme |
| `--fb-region-tint` | `rgba(107,93,79,0.20)` | `rgba(154,163,171,0.14)` | OKLCH + `/ alpha` |
| `--fb-connector-accent` | `var(--chord-connector-color-2)` (`#D55E00`) | `var(--chord-connector-color-1)` (`#E69F00`) | **Leave as palette ref** (Okabe-Ito identity colors — not part of the L-derived semantic set) |
| `--fb-connector-halo` | `rgb(255 255 255 / 0.7)` | `rgb(0 0 0 / 0.5)` | **Leave** (halo, not a hue) |

Backgrounds for APCA:
- **Light maple:** `--fretboard-wood-top #fbe6c6`, `--fretboard-wood-mid #f1c38e`, `--fretboard-wood-bottom #e0ab68` (`themes.css:149-151`).
- **Dark rosewood:** `--fretboard-wood-top #160d07`, `--fretboard-wood-mid #0d0805`, `--fretboard-wood-bottom #080403` (`tokens.css:132-134`).

---

## File structure

- `package.json` — add `culori` devDependency.
- `scripts/derive-fb-oklch.mjs` — **create.** One-shot deterministic converter: reads the current hex anchors, prints exact OKLCH triplets + an APCA table. Output is pasted into Task 3; the script is kept for future re-derivation.
- `src/styles/__tests__/fbColorTokens.test.ts` — **create.** Node-env Vitest: (a) every `--fb-*` resolves to a parseable color in both themes; (b) OKLCH values round-trip to the original sRGB within ΔE tolerance (equivalence guard); (c) APCA of each marker/label pair against each wood background meets threshold.
- `src/styles/__tests__/cssTokens.ts` — **create.** Shared helper: parse a theme block out of `themes.css`, one-hop `var()` resolution, expose `culori`-backed parse + an inlined APCA-W3 `contrastAPCA(text, bg)`.
- `src/styles/themes.css` — **modify.** The migration: shared `--fb-*-h/-c` anchors + per-theme `-l`; replace the eight token definitions; remove orphaned hue tokens (Task 5) and dead tokens (Task 6).
- `e2e/` visual snapshots — regenerated in Task 7.

---

### Task 1: Tooling — `culori` devDep + CSS-token test helper

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `src/styles/__tests__/cssTokens.ts`
- Test: `src/styles/__tests__/cssTokens.test.ts`

- [ ] **Step 1: Add the `culori` devDependency**

Run:
```bash
pnpm add -D culori
```
Expected: `package.json` gains `"culori": "^4.x"` under `devDependencies`; lockfile updates.

- [ ] **Step 2: Write the failing test for the helper**

Create `src/styles/__tests__/cssTokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readThemeBlock, resolveVar, contrastAPCA } from "./cssTokens";

describe("cssTokens helper", () => {
  it("extracts a custom property from a theme block", () => {
    const light = readThemeBlock("modern-light");
    expect(light["--fb-home-fill"]).toBeDefined();
  });

  it("one-hop resolves a var() reference within the block", () => {
    const light = readThemeBlock("modern-light");
    // --fb-home-stroke: var(--note-ring-tonic); --note-ring-tonic: #b1431b
    expect(resolveVar(light["--fb-home-stroke"], light)).toBe("#b1431b");
  });

  it("computes APCA Lc with the expected sign and magnitude", () => {
    // Black text on white bg → APCA ≈ 106 (light-context, large positive)
    expect(Math.round(contrastAPCA("#000000", "#ffffff"))).toBeGreaterThan(100);
    // White text on black bg → APCA ≈ -108 (dark-context, large negative)
    expect(Math.round(contrastAPCA("#ffffff", "#000000"))).toBeLessThan(-100);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run src/styles/__tests__/cssTokens.test.ts`
Expected: FAIL — "Cannot find module './cssTokens'".

- [ ] **Step 4: Implement the helper**

Create `src/styles/__tests__/cssTokens.ts`:
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse, converter } from "culori";

const THEMES_CSS = fileURLToPath(new URL("../themes.css", import.meta.url));

/** Parse `[data-theme="<theme>"] { ... }` into a {token: value} map. */
export function readThemeBlock(theme: string): Record<string, string> {
  const css = readFileSync(THEMES_CSS, "utf8");
  const head = `[data-theme="${theme}"] {`;
  const start = css.indexOf(head);
  if (start === -1) throw new Error(`theme block not found: ${theme}`);
  // Match to the first top-level closing brace of this block.
  let depth = 0;
  let i = start + head.length - 1;
  let bodyStart = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = css.slice(bodyStart, i);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** Resolve a single `var(--x)` (one hop) against a token map; returns input unchanged if not a bare var(). */
export function resolveVar(value: string, map: Record<string, string>): string {
  const m = value.match(/^var\((--[\w-]+)\)$/);
  if (!m) return value;
  const resolved = map[m[1]];
  return resolved !== undefined ? resolved.trim() : value;
}

const toRgb = converter("rgb");

/**
 * APCA-W3 0.1.9 lightness contrast (Lc). Positive ⇒ light-mode polarity
 * (dark text on light bg); negative ⇒ dark-mode polarity. Magnitude is the
 * perceptual contrast. Public, stable formula — see apcacontrast.com.
 */
export function contrastAPCA(textColor: string, bgColor: string): number {
  const lum = (hex: string): number => {
    const c = toRgb(parse(hex));
    if (!c) throw new Error(`unparseable color: ${hex}`);
    const lin = (v: number) => Math.pow(v, 2.4);
    return 0.2126729 * lin(c.r) + 0.7151522 * lin(c.g) + 0.072175 * lin(c.b);
  };
  let Ytxt = lum(textColor);
  let Ybg = lum(bgColor);
  const Yclamp = (Y: number) => (Y > 0.022 ? Y : Y + Math.pow(0.022 - Y, 1.414));
  Ytxt = Yclamp(Ytxt);
  Ybg = Yclamp(Ybg);
  if (Math.abs(Ybg - Ytxt) < 0.0005) return 0;
  let Sapc: number;
  let outputContrast: number;
  if (Ybg > Ytxt) {
    Sapc = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * 1.14;
    outputContrast = Sapc < 0.001 ? 0 : Sapc - 0.027;
  } else {
    Sapc = (Math.pow(Ybg, 0.65) - Math.pow(Ytxt, 0.62)) * 1.14;
    outputContrast = Sapc > -0.001 ? 0 : Sapc + 0.027;
  }
  return outputContrast * 100;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/styles/__tests__/cssTokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/styles/__tests__/cssTokens.ts src/styles/__tests__/cssTokens.test.ts
git commit -m "test(styles): add css-token + APCA helper for color migration"
```

---

### Task 2: Derive exact OKLCH triplets from current hex (one-shot script)

**Files:**
- Create: `scripts/derive-fb-oklch.mjs`

- [ ] **Step 1: Write the conversion script**

Create `scripts/derive-fb-oklch.mjs`:
```js
// Deterministic sRGB → OKLCH derivation for the --fb-* semantic tokens.
// Run: node scripts/derive-fb-oklch.mjs
// Paste the printed triplets into themes.css (Task 3). Re-run any time the
// source hex changes. APCA columns flag pairs below the §7 thresholds.
import { parse, converter } from "culori";

const oklch = converter("oklch");
const fmt = (hex) => {
  const c = oklch(parse(hex));
  const L = c.l.toFixed(4);
  const C = (c.c ?? 0).toFixed(4);
  const H = (c.h ?? 0).toFixed(1);
  return `oklch(${L} ${C} ${H})  // from ${hex}`;
};

const TOKENS = {
  "--fb-home-fill        (light=dark)": "#b5670a",
  "--fb-home-stroke      (light=dark)": "#b1431b",
  "--fb-guide-fill       light": "#cfeefb",
  "--fb-guide-fill       dark":  "#1f5876",
  "--fb-guide-stroke     light": "#1583a6",
  "--fb-guide-stroke     dark":  "#7cecff",
  "--fb-neutral-fill     light": "#e3ddd8",
  "--fb-neutral-fill     dark":  "#1b232c",
  "--fb-neutral-stroke   light": "#574d40",
  "--fb-neutral-stroke   dark":  "#9aa3ab",
  "--fb-region-tint      light": "#6b5d4f", // alpha 0.20 applied in CSS
  "--fb-region-tint      dark":  "#9aa3ab", // alpha 0.14 applied in CSS
};

console.log("=== OKLCH triplets ===");
for (const [name, hex] of Object.entries(TOKENS)) {
  console.log(name.padEnd(34), fmt(hex));
}
```

- [ ] **Step 2: Run it and capture output**

Run: `node scripts/derive-fb-oklch.mjs`
Expected: a table of `oklch(L C H) // from #hex` lines. **Copy the exact triplets** — they are the authoritative values for Task 3. (Hand-estimated anchors for sanity-checking the script ran: home-fill ≈ `oklch(0.60 0.14 60)`; guide-fill light ≈ `oklch(0.93 0.035 220)`, dark ≈ `oklch(0.42 0.07 240)`; neutral-fill light ≈ `oklch(0.90 0.008 80)`, dark ≈ `oklch(0.24 0.018 250)`. If the script's numbers are wildly different, stop and debug the script — do not proceed with bad values.)

- [ ] **Step 3: Commit the script**

```bash
git add scripts/derive-fb-oklch.mjs
git commit -m "chore(styles): add fb-token oklch derivation script"
```

---

### Task 3: Migrate the eight `--fb-*` tokens to single-source OKLCH

**Files:**
- Modify: `src/styles/themes.css` (light block ~311-320; dark block ~362-371)
- Test: `src/styles/__tests__/fbColorTokens.test.ts`

- [ ] **Step 1: Write the failing equivalence test**

Create `src/styles/__tests__/fbColorTokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { differenceEuclidean, parse, converter } from "culori";
import { readThemeBlock, resolveVar } from "./cssTokens";

const toRgb = converter("rgb");
const deltaE = differenceEuclidean("oklab");

// The migration MUST be visually equivalent to these pre-migration hex values.
const EXPECTED = {
  "modern-light": {
    "--fb-home-fill": "#b5670a",
    "--fb-home-stroke": "#b1431b",
    "--fb-guide-fill": "#cfeefb",
    "--fb-guide-stroke": "#1583a6",
    "--fb-neutral-fill": "#e3ddd8",
    "--fb-neutral-stroke": "#574d40",
  },
  "modern-dark": {
    "--fb-home-fill": "#b5670a",
    "--fb-guide-fill": "#1f5876",
    "--fb-guide-stroke": "#7cecff",
    "--fb-neutral-fill": "#1b232c",
    "--fb-neutral-stroke": "#9aa3ab",
  },
} as const;

describe("--fb-* tokens migrated to equivalent OKLCH", () => {
  for (const [theme, tokens] of Object.entries(EXPECTED)) {
    const block = readThemeBlock(theme);
    for (const [token, hex] of Object.entries(tokens)) {
      it(`${theme} ${token} ≈ ${hex} (ΔE<0.02)`, () => {
        const raw = resolveVar(block[token], block);
        expect(raw, `${token} should be an oklch() value`).toMatch(/oklch\(/);
        const got = toRgb(parse(raw));
        const want = toRgb(parse(hex));
        expect(got).toBeTruthy();
        expect(deltaE(got, want)).toBeLessThan(0.02);
      });
    }
  }
});
```
(`--fb-home-stroke` is asserted only for light — the dark value resolves through `--neon-orange`, captured in Step 3.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts`
Expected: FAIL — values are still hex (`toMatch(/oklch\(/)` fails).

- [ ] **Step 3: Rewrite the light-mode `--fb-*` block**

In `src/styles/themes.css`, replace the light block at lines 311-320 (`/* Chord-overlay semantic colors ... */` through `--fb-connector-halo`). Use the **exact triplets from Task 2's script output** in place of the anchor values shown:
```css
  /* Chord-overlay semantic colors (2026-06 redesign): amber=home, teal=guide, neutral=rest.
     OKLCH single-source: hue (-h) and chroma (-c) are shared across themes; each theme
     overrides lightness (-l) — and chroma where the design intentionally inverts saturation
     (guide pale↔deep). Neutral hue differs by theme by design: warm on maple, cool on rosewood.
     Triplets derived from prior hex via scripts/derive-fb-oklch.mjs (equivalence-guarded by
     src/styles/__tests__/fbColorTokens.test.ts). */
  --fb-home-h: 60;    --fb-home-c: 0.14;
  --fb-home-l: 0.60;
  --fb-home-fill: oklch(var(--fb-home-l) var(--fb-home-c) var(--fb-home-h));
  --fb-home-stroke-h: 38; --fb-home-stroke-c: 0.158; --fb-home-stroke-l: 0.515;
  --fb-home-stroke: oklch(var(--fb-home-stroke-l) var(--fb-home-stroke-c) var(--fb-home-stroke-h));

  --fb-guide-h: 225;
  --fb-guide-fill-l: 0.93;   --fb-guide-fill-c: 0.035;
  --fb-guide-fill: oklch(var(--fb-guide-fill-l) var(--fb-guide-fill-c) var(--fb-guide-h));
  --fb-guide-stroke-l: 0.555; --fb-guide-stroke-c: 0.088;
  --fb-guide-stroke: oklch(var(--fb-guide-stroke-l) var(--fb-guide-stroke-c) var(--fb-guide-h));

  --fb-neutral-h: 80;
  --fb-neutral-fill-l: 0.895;  --fb-neutral-fill-c: 0.008;
  --fb-neutral-fill: oklch(var(--fb-neutral-fill-l) var(--fb-neutral-fill-c) var(--fb-neutral-h));
  --fb-neutral-stroke-l: 0.39; --fb-neutral-stroke-c: 0.018;
  --fb-neutral-stroke: oklch(var(--fb-neutral-stroke-l) var(--fb-neutral-stroke-c) var(--fb-neutral-h));

  --fb-region-tint: oklch(0.52 0.012 70 / 0.20);
  --fb-connector-accent: var(--chord-connector-color-2); /* vermillion — Okabe-Ito identity, not L-derived */
  --fb-connector-halo: rgb(255 255 255 / 0.7); /* light wood: pale halo lifts the line */
```

- [ ] **Step 4: Rewrite the dark-mode `--fb-*` block**

In `src/styles/themes.css`, replace the dark block at lines 362-371. Override only `-l` (and `-c` for guide); reuse the shared `-h`. Use exact Task 2 triplets:
```css
  /* Chord-overlay semantic colors (2026-06 redesign): dark overrides lightness/chroma only;
     hue inherited from the light block's shared -h tokens. Neutral hue re-pointed cool for
     rosewood (warm neutral disappears on dark wood). */
  --fb-home-l: 0.60;          /* amber identical to light by design */
  --fb-home-fill: oklch(var(--fb-home-l) var(--fb-home-c) var(--fb-home-h));
  --fb-home-stroke: oklch(var(--fb-home-stroke-l) var(--fb-home-stroke-c) var(--fb-home-stroke-h));

  --fb-guide-fill-l: 0.42;   --fb-guide-fill-c: 0.07;
  --fb-guide-fill: oklch(var(--fb-guide-fill-l) var(--fb-guide-fill-c) var(--fb-guide-h));
  --fb-guide-stroke-l: 0.86; --fb-guide-stroke-c: 0.088;
  --fb-guide-stroke: oklch(var(--fb-guide-stroke-l) var(--fb-guide-stroke-c) var(--fb-guide-h));

  --fb-neutral-h: 250;        /* cool gray for rosewood */
  --fb-neutral-fill-l: 0.24;  --fb-neutral-fill-c: 0.018;
  --fb-neutral-fill: oklch(var(--fb-neutral-fill-l) var(--fb-neutral-fill-c) var(--fb-neutral-h));
  --fb-neutral-stroke-l: 0.68; --fb-neutral-stroke-c: 0.012;
  --fb-neutral-stroke: oklch(var(--fb-neutral-stroke-l) var(--fb-neutral-stroke-c) var(--fb-neutral-h));

  --fb-region-tint: oklch(0.68 0.012 250 / 0.14);
  --fb-connector-accent: var(--chord-connector-color-1); /* orange — Okabe-Ito identity */
  --fb-connector-halo: rgb(0 0 0 / 0.5); /* dark wood: shadow halo carves the line */
```
Note: the shared `-h`/`-c`/`-stroke` anchors are declared in the light block; dark inherits them via the cascade (both blocks set the same element). To guarantee inheritance regardless of theme-block order, the dark block re-declares `--fb-home-stroke-l/-c/-h`, `--fb-guide-stroke-c`, and `--fb-home-c/-h` if Step 3's tokens are not in `:root`. **Verify with the test in Step 5** — if a dark token resolves to `oklch()` with an empty var, move the shared `-h`/`-c` anchors into the `[data-theme]`-agnostic `:root` rule in `tokens.css` instead.

- [ ] **Step 5: Run the equivalence test to verify it passes**

Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts`
Expected: PASS (11 tests). If any ΔE assertion fails, adjust that token's `-l`/`-c` to the precise Task 2 triplet and re-run. Do not loosen the tolerance.

- [ ] **Step 6: Confirm the app still builds and renders the same**

Run: `pnpm run build`
Expected: build succeeds (validates `oklch()`/`var()` parse in production CSS).

- [ ] **Step 7: Commit**

```bash
git add src/styles/themes.css src/styles/__tests__/fbColorTokens.test.ts
git commit -m "refactor(styles): migrate --fb-* overlay tokens to single-source oklch"
```

---

### Task 4: APCA contrast audit + lightness tuning

**Files:**
- Modify: `src/styles/__tests__/fbColorTokens.test.ts` (add the audit `describe`)
- Modify: `src/styles/themes.css` (only if a pair fails)

- [ ] **Step 1: Add the failing APCA audit test**

Append to `src/styles/__tests__/fbColorTokens.test.ts`:
```ts
import { contrastAPCA } from "./cssTokens";

// Marker/label legibility pairs. Threshold: |Lc| ≥ 45 for the bold ~14px note
// glyphs and marker rings against wood (APCA "non-body large/bold text" tier).
const APCA_MIN = 45;
const WOOD = {
  "modern-light": { top: "#fbe6c6", mid: "#f1c38e", bottom: "#e0ab68" },
  "modern-dark": { top: "#160d07", mid: "#0d0805", bottom: "#080403" },
};
// Resolve an oklch()/hex token to a hex string the APCA helper accepts.
import { formatHex, parse } from "culori";
const hexOf = (v: string) => formatHex(parse(v)) ?? v;

describe("APCA: marker fills legible on both woods", () => {
  for (const theme of ["modern-light", "modern-dark"] as const) {
    const b = readThemeBlock(theme);
    const fills = ["--fb-home-fill", "--fb-guide-fill", "--fb-neutral-fill"];
    for (const token of fills) {
      for (const [pos, wood] of Object.entries(WOOD[theme])) {
        it(`${theme} ${token} vs wood-${pos} |Lc|≥${APCA_MIN}`, () => {
          const lc = Math.abs(contrastAPCA(hexOf(resolveVar(b[token], b)), wood));
          expect(lc).toBeGreaterThanOrEqual(APCA_MIN);
        });
      }
    }
  }
});
```

- [ ] **Step 2: Run the audit**

Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts`
Expected: most pass. **Record any failures** — likely candidates: `--fb-home-fill` (amber) vs the warm maple `wood-bottom #e0ab68` (low contrast warm-on-warm), and `--fb-neutral-fill` light cream vs `wood-top #fbe6c6` (cream-on-cream).

- [ ] **Step 3: Tune lightness for any failing pair**

For each failing pair, adjust **only the `-l`** of that token (push it away from the wood's lightness) in `themes.css`, re-running Step 2 until `|Lc| ≥ 45`. Then re-run the Task 3 equivalence test:
Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts`
Expected: if a tuned token now exceeds ΔE 0.02 from its original hex, that is an **intentional, documented APCA fix** — relax that single token's `EXPECTED` hex in the equivalence test to the new value with an inline `// APCA-tuned` comment, rather than reverting the contrast fix. (Equivalence guards the *unchanged* tokens; it must not block a deliberate contrast improvement.)

- [ ] **Step 4: Verify the full token test passes**

Run: `pnpm exec vitest run src/styles/__tests__/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles/themes.css src/styles/__tests__/fbColorTokens.test.ts
git commit -m "fix(styles): tune --fb-* lightness for APCA legibility on both woods"
```
(If no pair failed, commit just the test addition: `test(styles): add APCA audit for overlay marker fills`.)

---

### Task 5: Neutralize leftover note-role hue tokens (§6)

The markers already render neutral; this removes the now-dangling hue tokens **only when grep proves zero consumers**.

**Files:**
- Modify: `src/styles/themes.css`
- Test: `src/styles/__tests__/fbColorTokens.test.ts` (add a no-orphan-hue guard)

- [ ] **Step 1: Confirm consumer counts for each candidate**

Run:
```bash
cd /Users/isaaccocar/repos/fretboard-app/.claude/worktrees/inspiring-sinoussi-022b52
for t in note-blue note-blue-glow note-ring; do
  echo "=== var(--$t) consumers ==="; grep -rn "var(--$t)" src packages || echo "  (none)";
done
echo "=== --note-ring-color-tone consumers ==="; grep -rn "var(--note-ring-color-tone)" src packages
```
Expected: `--note-blue`, `--note-blue-glow` → **no consumers** (role rule at `FretboardSVG.module.css:107-110` uses `--fb-neutral-*`). `--note-ring` → confirm whether anything outside the overlay still uses it. `--note-ring-color-tone` → **HAS consumers** (`--fretboard-guide-tones-color-tone-*`, `--fretboard-tension-color-tone-*` lens tokens) → **KEEP it.**

- [ ] **Step 2: Write the guard test**

Append to `src/styles/__tests__/fbColorTokens.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("no orphaned overlay hue tokens remain", () => {
  const srcRoot = fileURLToPath(new URL("../../..", import.meta.url));
  const allCss = ["src/styles/themes.css", "src/styles/semantic.css", "src/styles/tokens.css"]
    .map((p) => readFileSync(srcRoot + p, "utf8")).join("\n");
  for (const token of ["--note-blue", "--note-blue-glow"]) {
    it(`${token} is fully removed (definition + consumers)`, () => {
      expect(allCss.includes(`var(${token})`), `${token} still consumed`).toBe(false);
      expect(new RegExp(`\\${token}\\s*:`).test(allCss), `${token} still defined`).toBe(false);
    });
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run src/styles/__tests__/fbColorTokens.test.ts`
Expected: FAIL — `--note-blue` / `--note-blue-glow` still defined in `themes.css:228-229`.

- [ ] **Step 4: Remove the confirmed-orphan tokens**

In `src/styles/themes.css`, delete lines 227-229 (the `/* Note colors */` block: `--note-blue` and `--note-blue-glow`). If Step 1 showed `--note-ring` has zero consumers, also delete line 220; otherwise leave it and remove `--note-blue*` only. Do **not** remove `--note-ring-color-tone` (lens consumers). Remove the now-stale dead-token comment lines 305-309 references to `--note-blue`/`--note-blue-glow`.

- [ ] **Step 5: Run the guard + full suite**

Run: `pnpm exec vitest run src/styles/__tests__/ && pnpm run build`
Expected: PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/styles/themes.css src/styles/__tests__/fbColorTokens.test.ts
git commit -m "refactor(styles): remove orphaned note-role hue tokens"
```

---

### Task 6: Dead-token cleanup (§8)

**Files:**
- Modify: `src/styles/themes.css`

- [ ] **Step 1: Verify each dead-token candidate has zero consumers**

Run:
```bash
cd /Users/isaaccocar/repos/fretboard-app/.claude/worktrees/inspiring-sinoussi-022b52
for t in text-on-highlight text-soft-white accent-glow shadow-note-root shadow-note-active \
         shadow-ping-start shadow-ping-end fretboard-note-fill-tension-emph \
         fretboard-note-fill-tension-strong neon-orange-dim; do
  n=$(grep -rn "var(--$t)" src packages | wc -l | tr -d ' ');
  echo "--$t : $n consumer(s)";
done
```
Expected: a count per token. **Only remove tokens reporting `0`.** Anything `> 0` stays. (Per the explore pass, expect `text-on-highlight`, `text-soft-white`, `accent-glow`, `shadow-ping-*`, `fretboard-note-fill-tension-emph`, `neon-orange-dim` at 0; double-check `shadow-note-*` and `fretboard-note-fill-tension-strong`.)

- [ ] **Step 2: Remove the zero-consumer tokens**

In `src/styles/themes.css`, delete each token line confirmed `0` in Step 1, and update the "Dead-token candidates" comment block (lines 305-309) to reflect what was removed (or delete the comment if all listed are now gone). Make the same removal in the dark block and `tokens.css`/`semantic.css` **only if** Step 1 found the definition there too.

- [ ] **Step 3: Verify lint + build (CSS-only change)**

Run: `pnpm run lint && pnpm run build`
Expected: stylelint passes (no undefined-var references introduced); build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/styles/themes.css
git commit -m "chore(styles): prune dead overlay color tokens"
```

---

### Task 7: Full verification + visual-regression refresh

**Files:**
- Modify: `e2e/**/__snapshots__` (regenerated) — only where the migration intentionally changed pixels.

- [ ] **Step 1: Run the MANDATORY local gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass (CLAUDE.md mandatory pre-PR gate).

- [ ] **Step 2: Run visual regression to see the diff**

Run: `pnpm run test:visual`
Expected: For the equivalence-preserving migration (Tasks 1-3), **near-zero pixel diffs**. The only legitimate diffs are tokens deliberately changed by the APCA tuning in Task 4. Review every reported diff image: confirm each corresponds to an intended Task-4 change. **If a diff appears on a token that was NOT APCA-tuned, STOP** — the OKLCH value drifted from its hex source; return to Task 3 Step 5 and fix the triplet. Do not blindly update snapshots.

- [ ] **Step 3: Update snapshots once diffs are confirmed intentional**

Run: `pnpm run test:visual:update`
Expected: darwin snapshots refreshed. (Linux snapshots regenerate in CI per CLAUDE.md, or run `pnpm run test:visual:update:linux` if cross-platform refresh is needed locally.)

- [ ] **Step 4: Re-run the gate to confirm green**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all pass.

- [ ] **Step 5: Commit the snapshot refresh**

```bash
git add e2e
git commit -m "test(visual): refresh snapshots for oklch overlay token migration"
```

- [ ] **Step 6: Hand off for visual review**

The migration is value-equivalent by construction; the APCA tuning is the only intended visual change. Surface the Task-2 OKLCH table and any Task-4 tuned pairs to the user for a final light/dark eyeball before merge. (Visual sign-off is the user's — do not self-certify "looks right.")

---

## Self-Review

**1. Spec coverage (§6–§8 + §7 token strategy):**
- §7 OKLCH single-source migration → Tasks 2-3 (derive + wire shared `-h`/`-c`, per-theme `-l`). ✔
- §7 `color-mix()`/derivation, APCA verification → Task 4 (APCA audit + tuning); region-tint uses `oklch(... / alpha)`. ✔
- §6 "neutralize note-role hues" → markers already neutral (current state); orphaned hue tokens removed in Task 5. ✔
- §6 "remove dead `[data-practice-lens]` CSS" → already done (current state); noted, not re-planned. ✔
- §8 dead-token cleanup → Task 6 (grep-guarded). ✔
- §8 backlog (CAGED overview, Hooktheory, marker geometry) → explicitly out of scope. ✔
- Light/dark parity via single hue/chroma + derived L → Task 3 structure. ✔

**2. Placeholder scan:** OKLCH numbers are derived by the Task 2 script (deterministic), with hand-estimated anchors only as a sanity check; Task 3 instructs pasting the script's exact output. Grep counts gate every deletion (Tasks 5-6) rather than assuming. APCA threshold (|Lc|≥45) and ΔE tolerance (0.02) are concrete. No "TBD"/"handle edge cases" left. ✔

**3. Type/name consistency:** Helper exports `readThemeBlock`, `resolveVar`, `contrastAPCA` — same names used in `cssTokens.test.ts`, `fbColorTokens.test.ts`, and the Task 4/5 additions. Token names (`--fb-home-fill`, `--fb-guide-fill`, `--fb-neutral-fill`, `--fb-home-stroke`, `--fb-guide-stroke`, `--fb-neutral-stroke`, `--fb-region-tint`, `--fb-connector-accent`, `--fb-connector-halo`) match `themes.css` exactly. Shared anchors `--fb-*-h`/`-c`/`-l` are defined in Task 3 and consumed only within Task 3. ✔

**Known risk flagged inline:** Task 3 Step 4 — shared `-h`/`-c` anchors live in the light block; if theme-block cascade order leaves a dark token with an unresolved var, the fix (move anchors to `:root` in `tokens.css`) is specified. The Step 5 test catches it.
