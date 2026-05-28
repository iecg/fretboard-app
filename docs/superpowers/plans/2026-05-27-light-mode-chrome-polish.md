# Light-Mode Chrome Polish — Reference-Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the light-mode chrome (header readouts, dividers, tab cards, status bar, connector labels) with the reference design, removing extraneous dividers and giving the cluster the missing surfaces.

**Architecture:** Surgical CSS-only edits across 7 module CSS files plus one JSX cleanup in `MainLayoutWrapper.tsx`. Reference palette tokens (PANEL `#f6f2e9`, PANEL-SOFT `#e3ddd0`, BG `#ebebdc`, MUTE `#857c6c`, INK `#2a251d`, CYAN `#147088`, ORANGE `#b1431b`) already exist in `themes.css`; this plan adds one new soft-surface token and otherwise reuses what's there. Dark-mode is untouched except for one addition: an explicit header bottom-border that matches light-mode's, so both themes share the same single header divider.

**Tech Stack:** CSS Modules + `:global([data-theme="modern-light"])` overrides; React JSX edit in `MainLayoutWrapper.tsx`; Playwright visual regression for verification.

---

## Reference vs current — quick diff

| Element | Reference (target) | Current (problem) |
|---|---|---|
| POSITION readout | PANEL fill + warm hairline border (chip) | `background: transparent`, `border-color: transparent` |
| TEMPO / SCALE readouts | PANEL fill + warm hairline border | `background: transparent` (border OK) |
| Header bottom divider | Single warm hairline, both themes | Light only |
| Divider after summary (above main) | None | Full-bleed `.section-divider` in light |
| Divider before controlsPanel (below main) | None | Full-bleed `.section-divider` in light |
| Divider between header & summary | None | Full-bleed `.section-divider` in light |
| Tabs underline / divider | Full-bleed warm hairline | Stops at the app-container's 1rem padding |
| Tab card surface | PANEL-SOFT (recessed, darker than chips) | `--surface-card-top` (PANEL) — same as chips |
| Connector chord-shape note labels | White fill + dark stroke (as in dark mode) | INK fill + cream halo (washed out) |
| Status bar | Distinct PANEL-SOFT band + top & bottom hairlines | Translucent BG (~60% opacity) — blends in, no bottom hairline |

## File map

| File | Responsibility |
|---|---|
| `src/styles/themes.css` | Add `--surface-card-soft` token (#e3ddd0) for use by tab cards & status bar. |
| `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css` | Restore PANEL fill on the position / tempo / scale readouts in light mode. |
| `src/components/AppHeader/AppHeader.module.css` | Move header bottom-border out of light-only — apply in both themes. |
| `src/components/MainLayoutWrapper/MainLayoutWrapper.tsx` | Remove the three `<hr className="section-divider">` instances. |
| `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css` | Delete the now-unused `.section-divider` rule block. |
| `src/components/Inspector/Inspector.module.css` | Extend the existing `.tabHeader` border-bottom full-bleed via negative margins + matching padding. |
| `src/components/Inspector/InspectorCard.module.css` | Switch light-mode card surface from PANEL to PANEL-SOFT (`--surface-card-soft`). |
| `src/components/StatusBar/StatusBar.module.css` | Light-mode bg → solid PANEL-SOFT + add bottom warm hairline. |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Revert light-mode full-chord-mode text override — keep dark-stroke + white-fill. |

No test files change behavior (these are visual-only edits). Existing unit tests should pass untouched; visual baselines need refresh in the final verification step.

---

## Task 1: Add `--surface-card-soft` token to `themes.css`

**Files:**
- Modify: `src/styles/themes.css` (light-mode block, around lines 38–45)

Both the tab card surface (Task 5) and the status bar (Task 8) need PANEL-SOFT `#e3ddd0`. Add a named token so both consumers reference the same value.

- [ ] **Step 1: Add the token to the light-mode surface ladder block**

In the `[data-theme="modern-light"]` block, just after `--surface-card-nested`, insert a new token:

```css
  --surface-card-nested: #f1ede3; /* inset card: visibly recessed from card-top (reference palette) */
  --surface-card-soft:   #e3ddd0; /* PANEL-SOFT — recessed surface for tab cards / status bar (reference palette) */
  --surface-well:        #ddd8cf; /* control well: distinctly sunken below PANEL-SOFT (reference palette) */
```

- [ ] **Step 2: Verify ordering & syntax**

Run: `pnpm lint`
Expected: no stylelint errors related to themes.css.

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes.css
git commit -m "feat(themes): add --surface-card-soft PANEL-SOFT token for recessed surfaces"
```

---

## Task 2: Restore Position / Tempo / Scale chip surfaces in `HeaderTransportCluster`

**Files:**
- Modify: `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css:54–65`

The reference shows all three readouts (POSITION, TEMPO, SCALE) as PANEL-cream chips with a warm hairline border. The current light-mode override forces `background: transparent` on both `.positionReadout` and `.contextBox`, and additionally erases the border on `.positionReadout` — so the position floats with no chrome at all. Restore the chip treatment.

- [ ] **Step 1: Replace the light-mode position + context override blocks**

Locate the existing two blocks in `HeaderTransportCluster.module.css`:

```css
/* Position readout: no box chrome — inline label above value on cream bg */
:global([data-theme="modern-light"]) .positionReadout {
  border-color: transparent;
  background: transparent;
}

/* Tempo + Scale readouts: minimal thin border, cream background */
:global([data-theme="modern-light"]) .contextBox {
  background: transparent;
  border-color: var(--track-border);
}
```

Replace with:

```css
/* Position readout: PANEL chip + warm hairline (matches Tempo/Scale) */
:global([data-theme="modern-light"]) .positionReadout {
  background: var(--surface-card-top);
  border-color: var(--track-border);
}

/* Tempo + Scale readouts: PANEL chip + warm hairline */
:global([data-theme="modern-light"]) .contextBox {
  background: var(--surface-card-top);
  border-color: var(--track-border);
}
```

(The `--track-border` already resolves to `rgb(133 124 108 / 0.22)` via the existing light-mode `.cluster` token block at line 37 — no extra plumbing.)

- [ ] **Step 2: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Then `pnpm run dev`, open in browser, switch to light mode. POSITION, TEMPO, and SCALE readouts should each sit inside a cream-filled rounded rect with a soft warm hairline.

- [ ] **Step 3: Commit**

```bash
git add src/components/HeaderTransportCluster/HeaderTransportCluster.module.css
git commit -m "fix(header): restore PANEL chip surface on position/tempo/scale readouts in light mode"
```

---

## Task 3: Unify header bottom divider across both themes

**Files:**
- Modify: `src/components/AppHeader/AppHeader.module.css:200–204` (move the rule out of light-only)

Currently the header bottom border exists only inside the `:global([data-theme="modern-light"]) .app-header` block. The user wants the same divider in dark mode too.

- [ ] **Step 1: Promote the rule to the base `.app-header` declaration**

Find the base `.app-header` block (lines 1–23). Append a `border-bottom` line:

```css
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* Wrap so the transport cluster drops below the brand on narrow widths
     rather than clipping (Always-On DAW Phase A). */
  flex-wrap: wrap;
  gap: clamp(0.5rem, 1.2vw, 0.95rem);
  padding: clamp(0.8rem, 1.4vw, 1.1rem) clamp(0.75rem, 2vw, 1.25rem);
  /* Escape the app-container horizontal + top padding so the header goes
     edge-to-edge. The negative margins match the container padding rules
     in App.css (default and mobile breakpoint). */
  margin-top: calc(-1 * clamp(0.75rem, 1.5vw, 1rem));
  margin-inline: calc(-1 * clamp(0.75rem, 1.5vw, 1rem));
  /* Header blends into the app background — no panel treatment (no
     gradient, border, shadow, or backdrop blur) so the wordmark and
     brand mark sit directly on the gradient app background instead of
     reading as a boxed-in container. */
  background: transparent;
  /* Single hairline divider below header — same in both themes; the light
     theme retones via the override below. */
  border-bottom: 1px solid rgb(255 255 255 / 0.06);
  position: sticky;
  top: 0;
  z-index: var(--z-header);
}
```

- [ ] **Step 2: Retain the light-mode color override (warm tone)**

Find the existing light-mode rule (around lines 200–204):

```css
/* Full-bleed warm hairline divider below the header */
:global([data-theme="modern-light"]) .app-header {
  border-bottom: 1px solid rgb(133 124 108 / 0.22);
}
```

No change — leave this as-is. It now overrides the base `rgb(255 255 255 / 0.06)` only on light mode (warm hairline instead of cool faceplate hairline).

- [ ] **Step 3: Verify**

Run: `pnpm lint`
Expected: no stylelint errors.

Then `pnpm run dev`, toggle dark mode. A subtle white-translucent hairline should appear under the header. Toggle light mode — warm hairline `rgb(133 124 108 / 0.22)` appears instead.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppHeader/AppHeader.module.css
git commit -m "fix(header): apply hairline bottom divider in both themes (warm in light, faceplate in dark)"
```

---

## Task 4: Remove the three extraneous `.section-divider`s

**Files:**
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.tsx:49–81` (remove 3 `<hr>` lines)
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css:7–33` (delete the `.section-divider` block + its responsive + light-mode rules)

User: "on light mode there's a divider between fretboard and tabs, between fretboard and progression track, and between the timeline and the header divider. remove all three". These are the three `<hr className={styles["section-divider"]}>` instances. The header divider (Task 3) is now the only horizontal hairline.

- [ ] **Step 1: Remove the three `<hr>` lines from `MainLayoutWrapper.tsx`**

Locate the JSX (lines 47–93). Replace the three blocks that contain `<hr className={styles["section-divider"]} ... />`.

**Before:**

```tsx
      {header}

      {showSummary && !!summary && (
        <>
          <hr className={styles["section-divider"]} aria-hidden="true" />
          <div
            className={styles["summary-shell"]}
            data-testid="summary-shell"
            data-layout-tier={layoutTier}
            data-layout-variant={layoutVariant}
          >
            {summary}
          </div>
        </>
      )}

      {helpModal}

      <hr className={styles["section-divider"]} aria-hidden="true" />

      <main
        className={styles["main-fretboard"]}
        data-layout-tier={layoutTier}
        data-layout-variant={layoutVariant}
        data-testid="main-fretboard"
      >
        {children}
      </main>

      {showControlsPanel && (
        <>
          <hr className={styles["section-divider"]} aria-hidden="true" />
          {controlsPanel}
        </>
      )}
```

**After:**

```tsx
      {header}

      {showSummary && !!summary && (
        <div
          className={styles["summary-shell"]}
          data-testid="summary-shell"
          data-layout-tier={layoutTier}
          data-layout-variant={layoutVariant}
        >
          {summary}
        </div>
      )}

      {helpModal}

      <main
        className={styles["main-fretboard"]}
        data-layout-tier={layoutTier}
        data-layout-variant={layoutVariant}
        data-testid="main-fretboard"
      >
        {children}
      </main>

      {showControlsPanel && controlsPanel}
```

(Three `<hr>` lines removed; the `<>...</>` fragments collapse to direct children since they no longer wrap multiple nodes.)

- [ ] **Step 2: Delete the now-orphan CSS rules from `MainLayoutWrapper.module.css`**

Locate lines 7–33 and delete the entire `.section-divider` rule, the responsive override, and the light-mode override:

**Delete:**

```css
/* Full-bleed horizontal dividers for light mode.
   Escape the app-container 1rem padding so the line reaches viewport edges.
   Reference palette: MUTE #857c6c at 30% opacity. */
.section-divider {
  display: none; /* hidden in dark mode */
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  height: 1px;
  border: 0;
  background: color-mix(in srgb, #857c6c 30%, transparent);
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .section-divider {
    width: calc(100% + 1.3rem);
    margin-left: -0.65rem;
    margin-right: -0.65rem;
  }
}

/* stylelint-disable selector-pseudo-class-no-unknown */
:global([data-theme="modern-light"]) .section-divider {
  display: block;
}
/* stylelint-enable selector-pseudo-class-no-unknown */
```

The remaining contents of the file (`.main-fretboard`, `.summary-shell`, `.status-bar-shell`, etc.) stay.

- [ ] **Step 3: Verify nothing references `.section-divider` anymore**

Run: `grep -rn "section-divider" src/`
Expected: no matches (only the file you just edited would have shown them).

If `grep` finds any usage, follow up before continuing.

- [ ] **Step 4: Verify build + tests**

Run: `pnpm lint && pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm test`
Expected: all green.

If `MainLayoutWrapper.test.tsx` asserts on `<hr>` count or `section-divider` class, update those assertions to reflect zero dividers in this layer (the test file lives alongside the component).

- [ ] **Step 5: Commit**

```bash
git add src/components/MainLayoutWrapper/MainLayoutWrapper.tsx src/components/MainLayoutWrapper/MainLayoutWrapper.module.css
git commit -m "fix(layout): drop extraneous section dividers; header divider is the only horizontal hairline"
```

---

## Task 5: Tab cards use PANEL-SOFT recessed surface

**Files:**
- Modify: `src/components/Inspector/InspectorCard.module.css:21–25` (light-mode `.card` override)

Reference: chip-bearing tab cards sit on a slightly darker surface than the PANEL chips inside them, giving the card visible enclosure. Current code uses `--surface-card-top` (PANEL) — same as the chips — so the card vanishes into them.

- [ ] **Step 1: Switch background to `--surface-card-soft`**

Find lines 21–25:

```css
:global([data-theme="modern-light"]) .card {
  background: var(--surface-card-top); /* PANEL #f6f2e9 */
  border-color: rgb(133 124 108 / 0.28);
  box-shadow: 0 1px 4px rgb(42 37 29 / 0.06);
}
```

Replace with:

```css
:global([data-theme="modern-light"]) .card {
  background: var(--surface-card-soft); /* PANEL-SOFT #e3ddd0 — recessed below chips */
  border-color: rgb(133 124 108 / 0.28);
  box-shadow: 0 1px 4px rgb(42 37 29 / 0.06);
}
```

Also rebind `.cardHead` (lines 27–30) so the head doesn't lighten back to PANEL:

**Before:**

```css
:global([data-theme="modern-light"]) .cardHead {
  background: rgb(250 248 243 / 0.80);
  border-bottom-color: rgb(133 124 108 / 0.18);
}
```

**After:**

```css
:global([data-theme="modern-light"]) .cardHead {
  background: transparent;
  border-bottom-color: rgb(133 124 108 / 0.18);
}
```

(Transparent lets the PANEL-SOFT card surface show through the head, keeping the whole card uniformly recessed.)

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

Open in dev. The Overlay tab's SCALE / CHORD cards should appear visibly darker than the PANEL chips and toggles inside them.

- [ ] **Step 3: Commit**

```bash
git add src/components/Inspector/InspectorCard.module.css
git commit -m "fix(inspector): use PANEL-SOFT card surface so cards recess below chips"
```

---

## Task 6: Extend the existing tabs divider full-bleed

**Files:**
- Modify: `src/components/Inspector/Inspector.module.css:12–18` (the `.tabHeader` base rule)

Constraint from user: **DO NOT ADD ANOTHER DIVIDER, JUST EXTEND THE EXISTING ONE.** The existing one is `.tabHeader { border-bottom: 1px solid var(--faceplate-divider) }`. Make it reach the viewport edges by escaping the `app-container`'s 1rem horizontal padding (and mobile's 0.65rem) using the same `width: calc(100% + 2rem); margin-inline: -1rem; padding-inline: 1rem` pattern that `.status-bar-shell` uses.

- [ ] **Step 1: Update the `.tabHeader` base rule**

Find lines 12–18:

```css
.tabHeader {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding-bottom: 0;
  border-bottom: 1px solid var(--faceplate-divider);
}
```

Replace with:

```css
.tabHeader {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  /* Full-bleed extension: escape app-container's 1rem horizontal padding so
     the border-bottom hairline reaches the viewport edges. Padding-inline
     restores the inset for the tab pills themselves. */
  width: calc(100% + 2rem);
  margin-inline: -1rem;
  padding-inline: 1rem;
  padding-bottom: 0;
  border-bottom: 1px solid var(--faceplate-divider);
}

/* Mobile tier: app-container uses 0.65rem padding (App.css media query).
   Match the escape on narrow viewports so the bleed still reaches edge. */
@media (max-width: 767px) {
  .tabHeader {
    width: calc(100% + 1.3rem);
    margin-inline: -0.65rem;
    padding-inline: 0.65rem;
  }
}
```

The light-mode color override (lines 23–25) is untouched — same border color rebind continues to apply.

- [ ] **Step 2: Verify the inspector layout still aligns**

Run: `pnpm lint && pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm test`
Expected: all green.

If `Inspector.test.tsx` asserts on `.tabHeader` style props (`width` etc.), update accordingly. The visual diff is the important check.

Open dev, switch to light. The hairline between tab pills and the panel content should reach the left and right viewport edges. Tab pill positions must NOT shift left (the `padding-inline: 1rem` restores them).

- [ ] **Step 3: Commit**

```bash
git add src/components/Inspector/Inspector.module.css
git commit -m "fix(inspector): extend tab-header divider full-bleed via negative margin + restored inset"
```

---

## Task 7: Connector note labels — revert to dark stroke

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css:114–117` (the light-mode `data-full-chord-mode` text override)

The user reports the cream halo on connector note labels looks wrong; the original dark-stroke + white-fill (which dark mode still uses) is correct. Drop the light-mode override so the base rule (white fill + 45%-opacity black stroke, lines 53–63 + the `.fretboard-board[data-full-chord-mode="true"] .fretboard-note[data-full-chord-mode] text` rule at lines 108–110) takes effect in light mode too.

- [ ] **Step 1: Delete the light-mode full-chord-mode text override**

Find lines 112–117:

```css
/* Light-theme text on shape colors: the shape colors are already saturated,
   so white labels with dark outline follow the same treatment as chord-root. */
:global([data-theme="modern-light"]) .fretboard-board[data-full-chord-mode="true"] .fretboard-note[data-full-chord-mode] text {
  fill: var(--text-fill, var(--note-label-on-color));
  stroke: var(--note-label-on-color-stroke);
}
```

The base rule above it (lines 108–110) already sets `fill: var(--text-fill, #ffffff)` — that's white fill, which is correct. Stroke comes from the global `.fretboard-note text` rule (line 60) which is `rgb(0 0 0 / 0.45)` — that's the "black was okay" stroke the user wants.

But — there's the light-mode `:global([data-theme="modern-light"]) .fretboard-note text` rule (lines 65–68) which rebinds stroke to `var(--fretboard-note-text-stroke)` (which is `transparent` per `themes.css:251`) and fill to `var(--fretboard-note-text-fill)` (INK). The full-chord-mode rule needs to override that so connector labels in light mode get the dark stroke back.

**Replace** lines 112–117 with:

```css
/* Light-theme full-chord-mode labels: shape colors are saturated, so revert
   to the dark-mode treatment — white fill + 45%-opacity black stroke — instead
   of the global light-mode INK + cream halo (which washes out against the
   saturated shape fills). */
:global([data-theme="modern-light"]) .fretboard-board[data-full-chord-mode="true"] .fretboard-note[data-full-chord-mode] text {
  fill: var(--text-fill, #ffffff);
  stroke: rgb(0 0 0 / 0.45);
}
```

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

Open dev in light mode. Show a chord overlay with Full voicing — the R / 3 / 5 / 7 labels on the colored CAGED-shape circles should read as white with a soft dark outline (legible on any shape color).

- [ ] **Step 3: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "fix(fretboard): revert light-mode connector note labels to white-on-dark-stroke"
```

---

## Task 8: Status bar — visible band + bottom hairline

**Files:**
- Modify: `src/components/StatusBar/StatusBar.module.css:19–22` (light-mode `.status-bar` override)

User: "looks too flat against the background. and add a border on the bottom of the status bar as well". Replace the current 60%-opacity BG with a solid PANEL-SOFT fill, and add a matching warm hairline on the bottom.

- [ ] **Step 1: Update the light-mode `.status-bar` rule**

Find lines 19–22:

```css
:global([data-theme="modern-light"]) .status-bar {
  background: rgb(235 235 220 / 0.60);
  border-top-color: rgb(133 124 108 / 0.25);
}
```

Replace with:

```css
:global([data-theme="modern-light"]) .status-bar {
  background: var(--surface-card-soft); /* PANEL-SOFT — visible recessed band */
  border-top-color: rgb(133 124 108 / 0.25);
  border-bottom: 1px solid rgb(133 124 108 / 0.25);
}
```

(The base `.status-bar` rule already includes `border-top: 1px solid var(--dc-border)` — the light override retones the color. The new `border-bottom` line adds a matching hairline; dark mode keeps just the top border since there's no light override for bottom — fine since the dark status bar already sits against the app frame edge.)

- [ ] **Step 2: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm test`
Expected: all green.

Open dev in light mode. The status bar should sit as a clearly distinct band — visibly darker than the page BG — with warm hairlines on both its top and bottom edges. Width should still reach the viewport (handled by the existing `.status-bar-shell` wrapper in `MainLayoutWrapper.module.css`).

- [ ] **Step 3: Commit**

```bash
git add src/components/StatusBar/StatusBar.module.css
git commit -m "fix(status-bar): PANEL-SOFT fill + bottom hairline so the band reads as distinct"
```

---

## Task 9: Full verification + visual baseline refresh

**Files:**
- Modify: visual snapshot baselines under `e2e/__snapshots__/` (auto-regenerated)

- [ ] **Step 1: Run the full quality gate**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: all green. Fix any failures before proceeding.

- [ ] **Step 2: Run e2e suite (production config)**

```bash
pnpm run test:e2e:production
```

Expected: all e2e tests pass. If a test asserts on a removed divider or section-divider class, update the assertion to reflect the new structure.

- [ ] **Step 3: Refresh visual baselines (darwin)**

The light-mode chrome has shifted in every suite that captures it. Refresh:

```bash
pnpm run test:visual:update
```

Expected: snapshots refresh, command exits zero.

- [ ] **Step 4: Manually spot-check the diff against the reference**

Open the dev server in both themes and confirm against the reference image (`docs/superpowers/specs/assets/2026-05-27-theming-reference.png`):

- POSITION / TEMPO / SCALE all show as PANEL chips with warm hairline borders.
- Header has a single subtle bottom hairline in both themes (warm in light, white-translucent in dark).
- No horizontal dividers between header → progression timeline, between fretboard → tab bar, or between tab bar → overlay panel.
- Tabs underline reaches viewport edges.
- Tab cards (Overlay panel SCALE / CHORD) sit on a recessed PANEL-SOFT surface, visibly darker than the PANEL chips inside.
- Connector circle labels (R, 3, 5, 7) read as white text with dark outline in both themes.
- Status bar reads as a distinct PANEL-SOFT band with warm hairlines on top AND bottom.

- [ ] **Step 5: Commit the refreshed baselines**

```bash
git add e2e/__snapshots__/
git commit -m "test(visual): refresh darwin baselines after light-mode chrome polish"
```

---

## Self-review checklist

**1. Reference coverage:**
- Position container → Task 2 ✓
- Tempo/Scale backgrounds → Task 2 ✓
- Remove 3 light-mode dividers → Task 4 ✓
- Header divider in dark mode → Task 3 ✓
- Connector label outline → Task 7 ✓
- Tabs cards surface → Task 5 ✓
- Tabs divider full-bleed (no new divider) → Task 6 ✓
- Status bar contrast + bottom border → Task 8 ✓

**2. Placeholder scan:** No TBDs, no "add appropriate handling", every CSS block is shown verbatim.

**3. Type / token consistency:** `--surface-card-soft` is added in Task 1 and consumed by Task 5 (InspectorCard) and Task 8 (StatusBar). `--track-border` reused in Task 2 (already defined at `HeaderTransportCluster.module.css:37`). Padding magic numbers (`1rem` / `0.65rem`) match the values already used by `.status-bar-shell` and the existing `App.css` container padding rules.

**4. Reversibility:** Every change is a single CSS rule swap or JSX deletion; nothing is destructive beyond what the user explicitly asked to remove.
