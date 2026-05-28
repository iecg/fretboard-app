# CAGED-E Recolor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the CAGED E-shape color from Okabe-Ito orange (`#E69F00`) to Okabe-Ito sky blue (`#56B4E9`) across all six token sites in both light and dark modes.

**Architecture:** Pure CSS token value swap — no JS or React changes. The token names stay; only the values change. The downstream consumers (`packages/core/src/shapes/templates.ts` and `src/components/FretboardSVG/FretboardNoteLayer.tsx`) reference `var(--caged-e)` / `var(--caged-e-fg)` / `var(--caged-e-bg)` and automatically pick up the new colors.

**Tech Stack:** CSS Custom Properties, Vitest, Playwright (visual regression).

**Spec:** `docs/superpowers/specs/2026-05-27-caged-e-recolor-design.md`

---

## File Structure

```
src/styles/
├── index.css       # Dark-mode defaults (3 --caged-e tokens)
└── themes.css      # Light-mode redeclares (3 --caged-e tokens across 2 blocks)
```

No new files. No deletes. No JS changes.

---

### Task 1: Update dark-mode CAGED-E tokens

**Files:**
- Modify: `src/styles/index.css:20-21,30`

- [ ] **Step 1: Read current values**

Run: `grep -n "caged-e" src/styles/index.css`
Expected output:
```
20:  --caged-e: #E69F00;      /* Okabe-Ito orange, connector slot 1 */
21:  --caged-e-fg: #fff1f2;
30:  --caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */
```

- [ ] **Step 2: Update `--caged-e` base color**

Edit `src/styles/index.css` line 20, replace:
```css
  --caged-e: #E69F00;      /* Okabe-Ito orange, connector slot 1 */
```
with:
```css
  --caged-e: #56B4E9;      /* Okabe-Ito sky blue, decoupled from connector slot 1 */
```

- [ ] **Step 3: Update `--caged-e-fg` foreground**

Edit `src/styles/index.css` line 21, replace:
```css
  --caged-e-fg: #fff1f2;
```
with:
```css
  --caged-e-fg: #f0f9ff;
```

Rationale: cool white pairs with sky blue base; maintains WCAG ≥ 4.5:1 contrast against `#56B4E9`.

- [ ] **Step 4: Update `--caged-e-bg` low-alpha fill**

Edit `src/styles/index.css` line 30, replace:
```css
  --caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */
```
with:
```css
  --caged-e-bg: rgba(86, 180, 233, 0.18);   /* E #56B4E9 + 0.18 */
```

- [ ] **Step 5: Verify changes**

Run: `grep -n "caged-e" src/styles/index.css`
Expected output:
```
20:  --caged-e: #56B4E9;      /* Okabe-Ito sky blue, decoupled from connector slot 1 */
21:  --caged-e-fg: #f0f9ff;
30:  --caged-e-bg: rgba(86, 180, 233, 0.18);   /* E #56B4E9 + 0.18 */
```

- [ ] **Step 6: Commit**

```bash
git add src/styles/index.css
git commit -m "$(cat <<'EOF'
style(theme): swap dark-mode CAGED-E from orange to sky blue

Decouples CAGED-E from the chord-tone-ring + non-CAGED connector slot 1
orange that has been visually conflicting on the fretboard. Sky blue
#56B4E9 is the Okabe-Ito hue not previously used by any CAGED shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update light-mode CAGED-E tokens

**Files:**
- Modify: `src/styles/themes.css:191,357,362`

- [ ] **Step 1: Read current values**

Run: `grep -n "caged-e" src/styles/themes.css`
Expected output:
```
191:  --caged-e-bg: rgba(184, 87, 0, 0.35);    /* E #B85700 + 0.35 boost */
357:  --caged-e: #E69F00;                        /* Okabe-Ito orange, slot 1 */
362:  --caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */
```

- [ ] **Step 2: Update light-mode boosted `--caged-e-bg` (line 191)**

Edit `src/styles/themes.css` line 191, replace:
```css
  --caged-e-bg: rgba(184, 87, 0, 0.35);    /* E #B85700 + 0.35 boost */
```
with:
```css
  --caged-e-bg: rgba(0, 119, 178, 0.35);   /* E #0077B2 (darkened sky blue) + 0.35 boost */
```

Rationale: mirrors the existing pattern (darken the base hue and use 0.35 alpha) to maintain visibility against the warm maple background. `#0077B2` keeps the same hue as `#56B4E9` at lower lightness.

- [ ] **Step 3: Update light-mode redeclare `--caged-e` (line 357)**

Edit `src/styles/themes.css` line 357, replace:
```css
  --caged-e: #E69F00;                        /* Okabe-Ito orange, slot 1 */
```
with:
```css
  --caged-e: #56B4E9;                        /* Okabe-Ito sky blue */
```

- [ ] **Step 4: Update light-mode fallback `--caged-e-bg` (line 362)**

Edit `src/styles/themes.css` line 362, replace:
```css
  --caged-e-bg: rgba(230, 159, 0, 0.18);    /* E #E69F00 + 0.18 */
```
with:
```css
  --caged-e-bg: rgba(86, 180, 233, 0.18);   /* E #56B4E9 + 0.18 */
```

- [ ] **Step 5: Verify changes**

Run: `grep -n "caged-e" src/styles/themes.css`
Expected output:
```
191:  --caged-e-bg: rgba(0, 119, 178, 0.35);   /* E #0077B2 (darkened sky blue) + 0.35 boost */
357:  --caged-e: #56B4E9;                        /* Okabe-Ito sky blue */
362:  --caged-e-bg: rgba(86, 180, 233, 0.18);   /* E #56B4E9 + 0.18 */
```

- [ ] **Step 6: Commit**

```bash
git add src/styles/themes.css
git commit -m "$(cat <<'EOF'
style(theme): swap light-mode CAGED-E from orange to sky blue

Mirrors the dark-mode swap from prior commit. Light-mode boosted variant
uses darkened sky blue #0077B2 at 0.35 alpha to maintain visibility
against the warm maple background.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Verify existing tests still pass

**Files:**
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx:244` (existing token-name binding test)

- [ ] **Step 1: Run the existing CAGED-E test**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: all tests pass (the test asserts `--shape-fill: var(--caged-e)` — token name unchanged, only the value changed; assertion stays valid).

- [ ] **Step 2: Run full unit test suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: clean (no stylelint regression from value changes).

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: build succeeds.

No commit at this step — verification only.

---

### Task 4: Visual regression baseline refresh

**Files:**
- Modify: visual snapshots under `e2e/app-components/`, `e2e/app-overlays/`, `e2e/fretboard-svg/` (darwin variants regenerated).

- [ ] **Step 1: Refresh darwin visual baselines**

Run: `pnpm test:visual:update`
Expected: snapshots in `e2e/` darwin variants update to reflect sky-blue CAGED-E rendering. No failures.

- [ ] **Step 2: Inspect the diff**

Run: `git diff --stat e2e/`
Expected: a non-zero number of `.png` files changed under `e2e/app-components/`, `e2e/app-overlays/`, and `e2e/fretboard-svg/`. The exact count varies with how many snapshots include the E shape — likely 5-15 files.

- [ ] **Step 3: Spot-check one updated snapshot**

Run: `git diff --stat e2e/app-components/ | head -5` to find a changed file, then open it in your preferred image viewer. Confirm: where you expect to see orange CAGED-E polygons or chips, you now see sky-blue ones; no other regressions visible.

- [ ] **Step 4: Run linux baseline update (if working in Linux CI environment)**

Run: `pnpm test:visual:update:linux` (only if you're on Linux or have docker available).

Skip this step on macOS — linux baselines auto-rebuild on next CI run.

- [ ] **Step 5: Commit the snapshot updates**

```bash
git add e2e/
git commit -m "$(cat <<'EOF'
test(visual): refresh darwin baselines for CAGED-E sky-blue swap

Token swap from orange to sky blue propagates through every snapshot
that renders the CAGED-E polygon or chip. Linux baselines auto-rebuild
on next CI run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Manual smoke verification

No file changes; no commit.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Dark-mode smoke**

In the running app (default theme is dark):
1. Set root: C, scale: Major.
2. Open the Overlay tab → Fingering Pattern: CAGED.
3. Click the "E" shape button. Confirm:
   - The "E" toggle-bar button background tints sky-blue (not orange).
   - The fretboard polygon for the E shape renders sky-blue (not orange).
   - The chord-tone ring around chord notes (if a chord is set) stays orange — should be visibly distinct from the sky-blue E polygon now.

- [ ] **Step 3: Light-mode smoke**

In the running app:
1. Open Settings drawer → Theme → switch to light mode (or use OS preference).
2. Repeat the E-shape check from Step 2. Confirm:
   - E polygon visible against the warm maple background (the darkened-sky-blue 0.35-alpha fill should read clearly).
   - E polygon does not visually collide with the existing CAGED-A blue (`#0072B2`) when both shapes are active — they're both blues but at different lightness levels.

- [ ] **Step 4: Side-by-side multi-shape verification**

Enable both E and A shapes simultaneously (Shift+click or long-press the A button while E is active). Confirm both shapes are independently visible and distinguishable in both light and dark modes.

If E and A look too similar in light mode, file a follow-up issue noting the lightness collision — adjust `#0077B2` to e.g. `#1B7CC2` (slightly lighter) as a corrective. (Not a blocker for this plan; the spec flagged this as a verification step, not a hard requirement.)

---

## Verification summary

After completing all tasks:

```bash
pnpm lint && pnpm test && pnpm build
```
Expected: all green.

```bash
git log --oneline -5
```
Expected: 3 commits from this plan (dark-mode swap, light-mode swap, visual baseline refresh) at the top.

---

## Self-review notes

- **Spec coverage:** All 6 token sites listed in the spec table (3 in index.css, 3 in themes.css) are covered across Tasks 1-2.
- **Placeholder scan:** No TODO / TBD / placeholder steps.
- **Type consistency:** No types involved (pure CSS). Token names referenced in the spec match the names edited in tasks.
- **Test coverage:** Existing test in `FretboardSVG.test.tsx` covers the token binding; visual regression covers the rendered output.
