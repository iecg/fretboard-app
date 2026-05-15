# Theme-Adaptive DAW Faceplate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the DAW faceplate (the `Inspector` and `TopBandSummary` panels) theme-adaptive — navy/cyan in dark mode, a pale cool-tinted equivalent in light mode — via shared theme-aware tokens and one shared CSS class, fixing the light-theme legibility bug and unblocking the Phase 4 branch.

**Architecture:** A `--faceplate-*` token set is added to `src/styles/semantic.css`, defined per theme. A shared `.faceplate` class in `src/components/shared/shared.module.css` composes the surface recipe from those tokens. `Inspector.module.css` and `TopBandSummary.module.css` drop their hardcoded navy and `composes:` the shared class. Because the substrate now follows `data-theme`, faceplate children keep using normal theme tokens and stay legible in both themes. The two red Phase 4 test files are fixed as part of this work.

**Tech Stack:** CSS Modules (with `composes:`), CSS custom properties / `data-theme` theming, React 19 + TypeScript. Vitest + Testing Library for unit tests. Playwright for e2e (`theme-contract.spec.ts`) and visual regression (darwin + linux baselines).

**Spec:** `docs/superpowers/specs/2026-05-15-daw-faceplate-theme-design.md`.

---

## Context the engineer needs

- The app sets `data-theme="modern-light"` or `data-theme="modern-dark"` on `document.documentElement` (`src/App.tsx`). The token CSS in `src/styles/semantic.css` uses **bare attribute selectors** — `[data-theme="modern-dark"] { … }` — not `:root[data-theme=…]`. Tokens are themed by overriding them inside those two blocks.
- This branch (`claude/daw-shell-phases-4-7`) already has 6 Phase 4 commits. Phase 4 hardcoded a navy faceplate into `TopBandSummary.module.css`; Phases 2/3 hardcoded the same navy into `Inspector.module.css`. Both are replaced here.
- CSS theming is not unit-testable. It is verified by `e2e/theme-contract.spec.ts` (the authoritative token/contract guard) and by Playwright visual regression. Tasks 1–4 below therefore verify with `npm run lint` only; Tasks 6–7 provide the real verification.
- `composes:` is used across the codebase (e.g. `FretRangeControl.module.css`). In CSS Modules, a `composes:` declaration **must be the first declaration in its rule**.
- Existing accent tokens: `--neon-cyan` = `#4DE4FF`, `--neon-cyan-dim` = `#2EB5CC`, `--glow-cyan-sm` is a predefined neon text-shadow. The faceplate accent tokens reference these.
- `e2e/theme-contract.spec.ts` already defines a `colorToHex(...)` helper (used around line 732) that canonicalizes color strings for comparison.

## Concrete token values (used by every task — do not deviate)

**Dark** (`:root` defaults and `[data-theme="modern-dark"]`):

```
--faceplate-bg: #0a121d;
--faceplate-bg-elevated: #0d1726;
--faceplate-wash: rgb(77 228 255 / 0.04);
--faceplate-border: rgb(77 228 255 / 0.12);
--faceplate-divider: rgb(255 255 255 / 0.06);
--faceplate-shadow: 0 1px 0 rgb(255 255 255 / 0.02) inset, 0 18px 40px -28px rgb(0 0 0 / 0.7);
--faceplate-accent: var(--neon-cyan);
--faceplate-accent-glow: var(--glow-cyan-sm);
```

**Light** (`[data-theme="modern-light"]`):

```
--faceplate-bg: #eef2f5;
--faceplate-bg-elevated: #f5f8fa;
--faceplate-wash: rgb(46 181 204 / 0.05);
--faceplate-border: rgb(46 181 204 / 0.35);
--faceplate-divider: rgb(0 0 0 / 0.08);
--faceplate-shadow: 0 1px 0 rgb(255 255 255 / 0.6) inset, 0 12px 28px -22px rgb(0 0 0 / 0.25);
--faceplate-accent: var(--neon-cyan-dim);
--faceplate-accent-glow: 0 0 4px rgb(46 181 204 / 0.30);
```

---

## File Structure

**Modified:**
- `src/styles/semantic.css` — add the `--faceplate-*` token set to `:root`, `[data-theme="modern-light"]`, and `[data-theme="modern-dark"]`.
- `src/components/shared/shared.module.css` — add the shared `.faceplate` class.
- `src/components/Inspector/Inspector.module.css` — `.root` composes `.faceplate` and drops its navy recipe; `.tab` / `.tabList` switch to `--faceplate-*` accent tokens.
- `src/components/TopBandSummary/TopBandSummary.module.css` — `.top-band-summary` composes `.faceplate` and drops its navy recipe.
- `src/components/ChordOverlayDock/ChordOverlayDock.test.tsx` — delete the four obsolete progression-status tests.
- `e2e/theme-contract.spec.ts` — rewrite the faceplate-substrate assertions to the theme-adaptive contract.

**Auto-regenerated (visual baselines):** darwin + linux PNGs under `e2e/*.visual.spec.ts-snapshots/` for suites that capture the Inspector or TopBandSummary (`inspector`, `app-layout`, `app-mobile`, `app-overlays`, `progression`, and light-mode variants).

**Not touched:** `Inspector.tsx`, `TopBandSummary.tsx` (the `composes:` approach means the TSX never changes), every faceplate child component, every Jotai atom.

---

### Task 1: Add the faceplate token set to semantic.css

**Files:**
- Modify: `src/styles/semantic.css`

Add the `--faceplate-*` tokens in three places: the base `:root` block (defaults = dark values), the `[data-theme="modern-light"]` block (light values), and the `[data-theme="modern-dark"]` block (dark values).

- [ ] **Step 1: Add dark defaults to the `:root` block**

In `src/styles/semantic.css`, inside the opening `:root { … }` block (starts at line 8), add the following before its closing `}`:

```css
  /* DAW faceplate surface — theme-adaptive panel chrome shared by the
     Inspector and TopBandSummary. :root carries the dark-mode values as a
     safe default; the [data-theme] blocks below override per theme. */
  --faceplate-bg: #0a121d;
  --faceplate-bg-elevated: #0d1726;
  --faceplate-wash: rgb(77 228 255 / 0.04);
  --faceplate-border: rgb(77 228 255 / 0.12);
  --faceplate-divider: rgb(255 255 255 / 0.06);
  --faceplate-shadow: 0 1px 0 rgb(255 255 255 / 0.02) inset, 0 18px 40px -28px rgb(0 0 0 / 0.7);
  --faceplate-accent: var(--neon-cyan);
  --faceplate-accent-glow: var(--glow-cyan-sm);
```

- [ ] **Step 2: Add light-mode values to the `[data-theme="modern-light"]` block**

In the `[data-theme="modern-light"] { … }` block (starts at line 206), add before its closing `}`:

```css
  /* DAW faceplate — light mode: a pale cool-tinted substrate with a dimmer
     cyan accent and a softer (but still present) glow. */
  --faceplate-bg: #eef2f5;
  --faceplate-bg-elevated: #f5f8fa;
  --faceplate-wash: rgb(46 181 204 / 0.05);
  --faceplate-border: rgb(46 181 204 / 0.35);
  --faceplate-divider: rgb(0 0 0 / 0.08);
  --faceplate-shadow: 0 1px 0 rgb(255 255 255 / 0.6) inset, 0 12px 28px -22px rgb(0 0 0 / 0.25);
  --faceplate-accent: var(--neon-cyan-dim);
  --faceplate-accent-glow: 0 0 4px rgb(46 181 204 / 0.30);
```

- [ ] **Step 3: Add dark-mode values to the `[data-theme="modern-dark"]` block**

In the `[data-theme="modern-dark"] { … }` block (starts at line 234), add before its closing `}`:

```css
  /* DAW faceplate — dark mode: navy substrate, bright cyan accent, neon glow. */
  --faceplate-bg: #0a121d;
  --faceplate-bg-elevated: #0d1726;
  --faceplate-wash: rgb(77 228 255 / 0.04);
  --faceplate-border: rgb(77 228 255 / 0.12);
  --faceplate-divider: rgb(255 255 255 / 0.06);
  --faceplate-shadow: 0 1px 0 rgb(255 255 255 / 0.02) inset, 0 18px 40px -28px rgb(0 0 0 / 0.7);
  --faceplate-accent: var(--neon-cyan);
  --faceplate-accent-glow: var(--glow-cyan-sm);
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/styles/semantic.css
git commit -m "feat(theme): add theme-adaptive DAW faceplate tokens"
```

---

### Task 2: Add the shared `.faceplate` class

**Files:**
- Modify: `src/components/shared/shared.module.css`

Add a `.faceplate` class that composes the surface recipe from the Task 1 tokens. It carries surface treatment only — no layout.

- [ ] **Step 1: Append the `.faceplate` class**

At the end of `src/components/shared/shared.module.css`, add:

```css
/* ===== Shared DAW faceplate surface ===== */
/* Theme-adaptive panel chrome shared by the Inspector and TopBandSummary.
   Surface treatment only — consumers add their own layout. Driven entirely by
   the --faceplate-* tokens in semantic.css, so it follows the active theme. */
.faceplate {
  border: 1px solid var(--faceplate-border);
  border-radius: 12px;
  background:
    radial-gradient(120% 200% at 0% 0%, var(--faceplate-wash), transparent 55%),
    linear-gradient(180deg, var(--faceplate-bg-elevated), var(--faceplate-bg));
  box-shadow: var(--faceplate-shadow);
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/shared.module.css
git commit -m "feat(shared): add shared theme-adaptive .faceplate class"
```

---

### Task 3: Retrofit the Inspector to the shared faceplate

**Files:**
- Modify: `src/components/Inspector/Inspector.module.css`

`.root` drops its hardcoded navy recipe and composes `.faceplate`. The `.tab` active/focus styling and the `.tabList` divider switch to the theme-aware `--faceplate-*` tokens. `Inspector.tsx` is not touched — `composes:` keeps the class name `styles.root` working unchanged.

- [ ] **Step 1: Rewrite Inspector.module.css**

Replace the entire contents of `src/components/Inspector/Inspector.module.css` with:

```css
/* The Inspector panel is a DAW faceplate — a theme-adaptive hardware-style
 * surface shared with TopBandSummary via the .faceplate class. */
.root {
  composes: faceplate from "../shared/shared.module.css";

  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.75rem);
}

.tabList {
  display: flex;
  gap: var(--space-1, 0.25rem);
  border-bottom: 1px solid var(--faceplate-divider);
}

.tab {
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-family: var(--font-sans, "IBM Plex Sans", sans-serif);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, text-shadow 120ms ease;
}

.tab:hover {
  color: var(--text-main);
}

.tab:focus-visible {
  outline: 2px solid var(--faceplate-accent);
  outline-offset: 2px;
}

.tab[data-state="active"] {
  color: var(--faceplate-accent);
  border-bottom-color: var(--faceplate-accent);
  text-shadow: var(--faceplate-accent-glow);
}

.tabPanel {
  min-height: 80px;
  padding: var(--space-3, 0.75rem) 0;
}

@media (prefers-reduced-motion: reduce) {
  .tab {
    transition: none;
  }
}
```

Changes from the previous file: the `--inspector-*` local custom properties and the inline navy `background` / `border` / `border-radius` / `box-shadow` are gone (now supplied by the composed `.faceplate`); the `.tabList` divider now uses `--faceplate-divider`, and the `.tab:focus-visible` outline and `.tab[data-state="active"]` color/border/glow now use `--faceplate-accent` and `--faceplate-accent-glow`. In dark mode these tokens resolve to the exact previous values, so dark-mode rendering is unchanged.

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Verify the Inspector unit tests still pass**

Run: `npx vitest run src/components/Inspector/`
Expected: PASS — this is a CSS-only change; no DOM/behavior changed, so every Inspector / ViewTab / ScaleTab / ChordTab test still passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/Inspector/Inspector.module.css
git commit -m "refactor(inspector): use the shared theme-adaptive faceplate"
```

---

### Task 4: Retrofit TopBandSummary to the shared faceplate

**Files:**
- Modify: `src/components/TopBandSummary/TopBandSummary.module.css`

`.top-band-summary` drops the Phase 4 hardcoded navy recipe and composes `.faceplate`, keeping its layout and the `--strip-*-override` custom properties.

- [ ] **Step 1: Rewrite TopBandSummary.module.css**

Replace the entire contents of `src/components/TopBandSummary/TopBandSummary.module.css` with:

```css
/* The top band is a DAW faceplate — the upper half of the same theme-adaptive
 * hardware unit as the Inspector, via the shared .faceplate class. */
.top-band-summary {
  composes: faceplate from "../shared/shared.module.css";

  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 30rem);
  margin: 0 auto;
  overflow: visible;
  transition:
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);

  /* Suppress child strip surfaces — the faceplate owns the fill. */
  --strip-bg-override: transparent;
  --strip-border-override: none;
  --strip-shadow-override: none;

  /* Faceplate owns the rounded corners — flatten nested strip corners. */
  --strip-radius: 0;
}

/* stylelint-disable selector-pseudo-class-no-unknown */
:global(.app-container[data-layout-tier="desktop"][data-layout-variant^="desktop-"]) .top-band-summary {
  width: min(100%, 32rem);
}
/* stylelint-enable selector-pseudo-class-no-unknown */

.chord-section {
  width: 100%;
}

/* Inset hairline divider between the chip strip and the chord-practice bar.
   Rendered inside the animated motion container so it appears/disappears in
   lockstep with the content — no orphaned lines. */
.chord-section::before {
  content: "";
  display: block;
  height: 1px;
  margin: 0 0;
  background: var(--chrome-border);
  opacity: 0.6;
}
```

Changes from the previous (Phase 4) file: the `--topband-*` local custom properties and the inline navy `background` / `border` / `border-radius` / `box-shadow` are gone (now supplied by the composed `.faceplate`). The layout, the desktop width override, `.chord-section`, and the `--strip-*` overrides are unchanged.

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Verify the TopBandSummary unit tests still pass**

Run: `npx vitest run src/components/TopBandSummary/TopBandSummary.test.tsx`
Expected: PASS — CSS-only change, no DOM/behavior change.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBandSummary/TopBandSummary.module.css
git commit -m "refactor(top-band): use the shared theme-adaptive faceplate"
```

---

### Task 5: Delete the obsolete progression-status tests

**Files:**
- Modify: `src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`

`ChordOverlayDock.test.tsx` (which tests `TopBandSummary`) has four tests asserting a `Progression status` group that Phase 4 deleted from `TopBandSummary` (it was unreachable dead code). They fail and must be removed. The remaining tests (practice bar, degree strip, a11y, "does not render transport controls") stay.

- [ ] **Step 1: Confirm the four tests currently fail**

Run: `npx vitest run src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`
Expected: FAIL — the tests `shows read-only current and next progression status in the top band`, `wraps next progression status to the current step when it is the only playable step`, `shows a sane blocked status for an empty enabled progression`, and `shows the active step unavailable reason when another progression step can resolve` fail (they query `getByRole("group", { name: "Progression status" })`, which no longer renders).

- [ ] **Step 2: Delete the four obsolete tests**

In `src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`, delete these four complete `it(...)` blocks:
- `it("shows read-only current and next progression status in the top band", … )`
- `it("wraps next progression status to the current step when it is the only playable step", … )`
- `it("shows a sane blocked status for an empty enabled progression", … )`
- `it("shows the active step unavailable reason when another progression step can resolve", … )`

Keep these tests, untouched: `renders the practice bar when a chord is active`, `renders the scale degree strip alongside the chord bar`, `collapses to a single Land on group when the chord is fully in-scale (targets lens)`, `has no accessibility violations on the unified surface`, and `does not render progression transport controls in the top band`.

- [ ] **Step 3: Remove the now-unused import**

After deleting the four tests, `activeProgressionStepIndexAtom` is no longer referenced. In the import block at the top of the file, remove the `activeProgressionStepIndexAtom,` line. Keep `progressionEnabledAtom` and `progressionStepsAtom` — they are still used by the kept `does not render progression transport controls in the top band` test. Keep all other imports (`rootNoteAtom`, `scaleNameAtom`, `chordTypeAtom`, `chordRootAtom`, `practiceLensAtom`).

- [ ] **Step 4: Verify the file passes**

Run: `npx vitest run src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`
Expected: PASS — 5 tests.

Then run: `npm run lint`
Expected: 0 errors (no unused-import warning for `activeProgressionStepIndexAtom`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordOverlayDock/ChordOverlayDock.test.tsx
git commit -m "test(top-band): drop obsolete progression-status tests"
```

---

### Task 6: Update the theme-contract e2e assertions

**Files:**
- Modify: `e2e/theme-contract.spec.ts`

Several tests assert that `top-band-summary`'s background is the old light card color `rgb(252,249,245)`. The faceplate now paints a theme-adaptive gradient, so `getComputedStyle(...).backgroundColor` returns `rgba(0, 0, 0, 0)` (the color lives in `background-image`). Replace those element-background assertions with token-based assertions on `--faceplate-bg`, and add one authoritative theme-adaptive faceplate test. Each affected test keeps its genuine strip-transparency assertions.

- [ ] **Step 1: Confirm the failures**

Run: `npm run test:e2e:production -- theme-contract`
Expected: FAIL — the tests touching `top-band-summary` background fail (received `rgba(0, 0, 0, 0)`, expected `rgb(252,249,245)`). Note the exact list of failing test names.

- [ ] **Step 2: Fix the "practice bar is light-readable in light mode" test**

In `e2e/theme-contract.spec.ts`, find the test `practice bar is light-readable in light mode`. Delete its final block — the three lines that read the parent card background:

```ts
    // Verify the parent card provides the expected light-mode card surface.
    const card = page.getByTestId("top-band-summary");
    const cardBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(cardBg.replace(/\s/g, "")).toBe("rgb(252,249,245)");
```

Keep the rest of the test (the practice-bar `backgroundColor` transparent assertion and the `color` = `rgb(15,23,42)` assertion remain valid — dark text on the pale light faceplate is readable). The authoritative substrate check moves to the new test in Step 6.

- [ ] **Step 3: Replace the "top-level Card uses surface-card-top" test**

Find the test `top-level Card uses surface-card-top (not pure white) in light mode` and replace the entire `test(...)` block with two tests:

```ts
    test("faceplate substrate uses the light token in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", width: 1280, height: 900 });
      await expect(page.getByTestId("top-band-summary")).toBeVisible();

      // The faceplate is theme-adaptive: a pale cool substrate in light mode.
      const faceplateBg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--faceplate-bg").trim(),
      );
      expect(colorToHex(faceplateBg)).toBe("#eef2f5");
    });

    test("faceplate substrate uses the navy token in dark mode", async ({ page }) => {
      await loadVisualState(page, { theme: "dark", width: 1280, height: 900 });
      await expect(page.getByTestId("top-band-summary")).toBeVisible();

      const faceplateBg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--faceplate-bg").trim(),
      );
      expect(colorToHex(faceplateBg)).toBe("#0a121d");
    });
```

- [ ] **Step 4: Fix the "chord practice strip aligns with card surface in light mode" test**

Find the test `chord practice strip aligns with card surface in light mode`. Keep the practice-bar transparent-background assertion. Delete the trailing parent-card block — the lines that read `top-band-summary` background and compare against `rgb(252,249,245)` / `rgb(241,245,249)`:

```ts
      // The parent card supplies surface-card-top = #fcf9f5 → rgb(252, 249, 245).
      const cardBg = await page
        .getByTestId("top-band-summary")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(cardBg.replace(/\s/g, "")).toBe("rgb(252,249,245)");
      // Must not be the old f1f5f9 value.
      expect(cardBg.replace(/\s/g, "")).not.toBe("rgb(241,245,249)");
```

After the deletion the test still meaningfully asserts the strip paints no background of its own.

- [ ] **Step 5: Fix the "chord practice and degree strips share the card surface" test**

Find the test `chord practice and degree strips share the card surface in light mode`. Rename it to `chord practice and degree strips share a transparent surface in light mode` (update the `test("…")` string). Keep the two strip assertions (`practiceBg` transparent, `degreeBg` equals `practiceBg`). Delete the trailing parent-card block:

```ts
      // And that shared parent surface is the card-top color.
      const cardBg = await page
        .getByTestId("top-band-summary")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(cardBg.replace(/\s/g, "")).toBe("rgb(252,249,245)");
```

- [ ] **Step 6: Fix the "degree chip strip uses surface-strip token" test**

Find the test `degree chip strip uses surface-strip token in light mode`. Keep the degree-strip transparent-background assertion. Delete the trailing parent-card block:

```ts
      const cardBg = await page
        .getByTestId("top-band-summary")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(cardBg.replace(/\s/g, "")).toBe("rgb(252,249,245)");
```

- [ ] **Step 7: Run the theme-contract suite**

Run: `npm run test:e2e:production -- theme-contract`
Expected: PASS — all `theme-contract` tests pass, including the two new faceplate-substrate tests. If any other test in the file still fails on a `top-band-summary` background assertion not covered above, apply the same fix pattern: delete the element-`backgroundColor` comparison (the substrate is now a gradient) — the `faceplate substrate uses the … token` tests are the authoritative substrate guard.

- [ ] **Step 8: Commit**

```bash
git add e2e/theme-contract.spec.ts
git commit -m "test(theme): assert the theme-adaptive faceplate contract"
```

---

### Task 7: Refresh the visual regression baselines

**Files:**
- Modify (auto-generated): darwin + linux PNGs under `e2e/*.visual.spec.ts-snapshots/`.

The faceplate now renders differently in light mode (and the Inspector's appearance changed in both modes via the token retrofit, though dark mode should be visually identical). Refresh both platforms.

- [ ] **Step 1: Run the visual suite and capture the failures**

Run: `npm run test:visual`
Expected: failures in suites that capture the Inspector or TopBandSummary — likely `inspector`, `app-layout`, `app-mobile`, `app-overlays`, `progression`, and their light-mode variants. Dark-mode-only snapshots should NOT diff (dark faceplate values are unchanged). If a dark-only snapshot diffs, stop and investigate before refreshing.

- [ ] **Step 2: Refresh the darwin baselines**

Run: `npm run test:visual:update`
Then re-run: `npm run test:visual`
Expected: the diffed darwin PNGs are regenerated; the suite passes on darwin.

- [ ] **Step 3: Refresh the linux baselines**

Run: `npm run test:visual:update:linux`
Expected: the docker run completes; linux PNGs are regenerated.

- [ ] **Step 4: Eyeball the regenerated PNGs**

List the changed PNGs with `git status --short e2e/`. Confirm: in **light mode** the Inspector and TopBandSummary are a pale cool panel with a dimmer-cyan border and readable (dark) child text; in **dark mode** they are unchanged navy. If any light-mode snapshot shows unreadable text or an unstyled panel, that is a real regression — stop and report it.

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test(visual): refresh baselines for the theme-adaptive faceplate"
```

---

### Final Verification

Run the full quality gate locally — this is the gate that makes the Phase 4 branch mergeable.

- [ ] **Lint** — Run: `npm run lint` — Expected: 0 errors, 0 warnings.
- [ ] **Unit + integration tests** — Run: `npm run test` — Expected: all pass, including the trimmed `ChordOverlayDock.test.tsx`.
- [ ] **Production build** — Run: `npm run build` — Expected: clean (`tsc -b && vite build`).
- [ ] **E2E (production)** — Run: `npm run test:e2e:production` — Expected: all pass, including `theme-contract.spec.ts`.
- [ ] **Visual regression (darwin)** — Run: `npm run test:visual` — Expected: all pass.
- [ ] **Visual regression (linux)** — Run: `npm run test:visual:ci` — Expected: all pass.

If any step fails: stop, return to the task that produced the regression, fix it, recommit, then resume verification.

Once the gate is green, the DAW Shell Phase 4 branch is complete — hand off to `superpowers:finishing-a-development-branch`.

---

## Notes

- `Inspector.tsx` and `TopBandSummary.tsx` are intentionally untouched: `composes:` re-points the existing `styles.root` / `styles["top-band-summary"]` class names at the shared recipe, so the components need no change.
- A future phase (Phase 6's `TransportBar`) can adopt the same `.faceplate` class — the token set and class are already general.
