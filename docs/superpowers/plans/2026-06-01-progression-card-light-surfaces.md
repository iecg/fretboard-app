# Progression Card Light-Mode Surface Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Song-tab Progression card's harsh near-white light-mode surfaces (degree chip, notes strip, nav pip) and differentiate the editor panel from the active step row, in both themes.

**Architecture:** CSS-only. Add three per-theme semantic tokens (`--faceplate-inset`, `--faceplate-key`, `--faceplate-surface`) whose dark values reproduce the current hardcoded `color-mix` expressions verbatim (so dark mode is byte-identical) and whose light values route through the existing warm surface ladder. Three component CSS modules then reference the tokens instead of hardcoded expressions.

**Tech Stack:** CSS Modules, CSS custom properties (theme data-attribute overrides), Vite, Vitest, Playwright visual regression.

**Spec:** `docs/superpowers/specs/2026-06-01-progression-card-light-surfaces-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/styles/semantic.css` | Theme token definitions | Add 3 tokens to the light and dark faceplate blocks |
| `src/components/SongControls/ProgressionStepList.module.css` | Step-list row + chip styling | `.chip` background → token |
| `src/components/SongControls/SongControls.module.css` | Editor panel + pager styling | `.editor-pager` + `.editor-panel` backgrounds → token |
| `src/components/SongControls/ChordTonesReadout.module.css` | Notes strip styling | `.readout` + `.tone` backgrounds → tokens |

No TypeScript, component, or markup changes.

---

## Reference: token values

Add identical token *names* to both theme blocks; values differ per theme.

| Token | Dark value (must equal current expression) | Light value |
|---|---|---|
| `--faceplate-inset` | `color-mix(in srgb, var(--faceplate-bg) 60%, transparent)` | `var(--surface-well)` |
| `--faceplate-key` | `color-mix(in srgb, var(--text-main) 3%, transparent)` | `var(--surface-card-nested)` |
| `--faceplate-surface` | `var(--faceplate-bg-elevated)` | `var(--surface-card-top)` |

Token blocks in `src/styles/semantic.css`:
- Dark `:root` faceplate block — `--faceplate-bg: #0a121d;` near **line 214**.
- Light `[data-theme="modern-light"]` faceplate block — `--faceplate-bg: #f6f2e9;` near **line 275**.
- Dark `[data-theme="modern-dark"]` faceplate block — `--faceplate-bg: #0a121d;` near **line 333**.

The dark `:root` block and the explicit `[data-theme="modern-dark"]` block carry identical faceplate values today; add the three tokens to **both** so an explicit dark selection and the default both resolve them.

---

## Task 1: Add the three tokens to the dark faceplate blocks

**Files:**
- Modify: `src/styles/semantic.css` (dark `:root` block ~line 214–221; dark `[data-theme="modern-dark"]` block ~line 333–340)

- [ ] **Step 1: Read the current dark faceplate blocks**

Run: open `src/styles/semantic.css` and confirm both dark blocks contain:
```css
  --faceplate-bg: #0a121d;
  --faceplate-bg-elevated: #0d1726;
  ...
  --faceplate-divider: rgb(255 255 255 / 0.06);
  ...
  --faceplate-accent: var(--neon-cyan);
```
Confirm `--text-main` resolves to a light value in dark mode (so `--faceplate-key` stays subtle).

- [ ] **Step 2: Add the tokens after `--faceplate-accent-glow` in the dark `:root` block (~line 221)**

Insert:
```css
  /* Progression-card sunken surfaces — dark values reproduce the historical
     inline expressions so dark mode is unchanged. Light values (in the
     modern-light block) route through the warm surface ladder instead. */
  --faceplate-inset: color-mix(in srgb, var(--faceplate-bg) 60%, transparent);
  --faceplate-key: color-mix(in srgb, var(--text-main) 3%, transparent);
  --faceplate-surface: var(--faceplate-bg-elevated);
```

- [ ] **Step 3: Add the identical block to the explicit `[data-theme="modern-dark"]` block (~line 340)**

Insert the same three `--faceplate-inset` / `--faceplate-key` / `--faceplate-surface` declarations (with the same comment) after that block's `--faceplate-accent-glow`.

- [ ] **Step 4: Verify the build compiles the CSS**

Run: `pnpm run build`
Expected: build succeeds (`tsc -b && vite build`), no CSS parse errors.

- [ ] **Step 5: Commit**

```bash
git add src/styles/semantic.css
git commit -m "style(theme): add faceplate inset/key/surface tokens (dark = current behavior)"
```

---

## Task 2: Add the light-mode token values

**Files:**
- Modify: `src/styles/semantic.css` (light `[data-theme="modern-light"]` faceplate block ~line 275–294)

- [ ] **Step 1: Confirm the ladder tokens exist in scope**

Run: `grep -n "surface-well\|surface-card-nested\|surface-card-top" src/styles/themes.css`
Expected: all three are defined in the `[data-theme="modern-light"]` block of `themes.css` (`--surface-well: #ddd8cf`, `--surface-card-nested: #f1ede3`, `--surface-card-top: #f6f2e9`). They cascade, so `semantic.css` can reference them.

- [ ] **Step 2: Add the light token values after `--faceplate-accent-glow` in the modern-light block (~line 282)**

Insert:
```css
  /* Progression-card sunken surfaces — route through the warm light ladder
     (well < card-soft < card-nested < card-top) so these read as genuine
     recessed wells / raised keys instead of harsh near-white. */
  --faceplate-inset: var(--surface-well);
  --faceplate-key: var(--surface-card-nested);
  --faceplate-surface: var(--surface-card-top);
```

- [ ] **Step 3: Verify the build compiles the CSS**

Run: `pnpm run build`
Expected: build succeeds, no CSS parse errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles/semantic.css
git commit -m "style(theme): light-mode faceplate inset/key/surface route through warm ladder"
```

---

## Task 3: Re-map the inactive degree chip

**Files:**
- Modify: `src/components/SongControls/ProgressionStepList.module.css` (`.chip` ~line 219)

- [ ] **Step 1: Replace the `.chip` background**

Find:
```css
  background-color: color-mix(in srgb, var(--faceplate-bg) 60%, transparent);
```
in the `.chip` rule and replace with:
```css
  background-color: var(--faceplate-inset);
```
Leave `.active .chip` (the teal override) untouched.

- [ ] **Step 2: Verify in the running app (light + dark)**

Start the preview server if not running, open the Song tab, and confirm the Progression step list. In **light** mode the inactive numeral chips (`V`, `vi`, `IV`) read as warm sunken wells (`#ddd8cf`), not near-white. In **dark** mode they look identical to before. The active chip stays teal.

- [ ] **Step 3: Commit**

```bash
git add src/components/SongControls/ProgressionStepList.module.css
git commit -m "style(progression): inactive degree chip uses sunken inset surface"
```

---

## Task 4: Re-map the nav pip and the editor panel

**Files:**
- Modify: `src/components/SongControls/SongControls.module.css` (`.editor-panel` ~line 246, `.editor-pager` ~line 314)

- [ ] **Step 1: Replace the `.editor-pager` background**

Find (in `.editor-pager`):
```css
  background-color: color-mix(in srgb, var(--faceplate-bg) 60%, transparent);
```
Replace with:
```css
  background-color: var(--faceplate-inset);
```

- [ ] **Step 2: Replace the `.editor-panel` background**

Find (in `.editor-panel`):
```css
  background-color: color-mix(in srgb, var(--faceplate-accent) 5%, transparent);
```
Replace with:
```css
  background-color: color-mix(in srgb, var(--faceplate-accent) 5%, var(--faceplate-surface));
```
Leave the `.editor-panel` border (`color-mix(... var(--faceplate-accent) 28% ...)`) and `box-shadow` untouched.

- [ ] **Step 3: Verify in the running app (light + dark)**

Open the chord editor (right pane of the Progression card). In **light** mode:
- The `‹ 1 / 4 ›` pager reads as a warm sunken control, not near-white.
- The editor panel reads as a raised, teal-framed, shadowed card — distinct from a selected step row (which stays a flat teal tint). 

In **dark** mode confirm the pager is unchanged and the editor panel now sits on an opaque elevated base (`#0d1726`) that separates it from the active row's tint.

- [ ] **Step 4: Commit**

```bash
git add src/components/SongControls/SongControls.module.css
git commit -m "style(progression): sunken pager + raised editor panel surface"
```

---

## Task 5: Re-map the notes strip

**Files:**
- Modify: `src/components/SongControls/ChordTonesReadout.module.css` (`.readout` ~line 11, `.tone` ~line 47)

- [ ] **Step 1: Replace the `.readout` background**

Find (in `.readout`):
```css
  background-color: color-mix(in srgb, var(--faceplate-bg) 60%, transparent);
```
Replace with:
```css
  background-color: var(--faceplate-inset);
```

- [ ] **Step 2: Replace the `.tone` background**

Find (in `.tone`):
```css
  background-color: color-mix(in srgb, var(--text-main) 3%, transparent);
```
Replace with:
```css
  background-color: var(--faceplate-key);
```
Leave `.tone.root` (the teal override) untouched.

- [ ] **Step 3: Verify in the running app (light + dark)**

Open the chord editor and inspect the NOTES strip. In **light** mode the strip reads as a sunken well (`#ddd8cf`) holding raised note keys (`#f1ede3`) — the keys no longer out-white the editor panel. The root note (`C`) keeps its teal tint. In **dark** mode the strip and keys look identical to before.

- [ ] **Step 4: Commit**

```bash
git add src/components/SongControls/ChordTonesReadout.module.css
git commit -m "style(progression): notes strip uses sunken well + raised keys"
```

---

## Task 6: Full verification and snapshot refresh

**Files:**
- Modify (generated): visual-regression snapshots under `e2e/` (`app-components`, `app-overlays`)

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: eslint + stylelint pass with no errors.

- [ ] **Step 2: Unit/component tests**

Run: `pnpm run test`
Expected: all pass. (No assertions target these `color-mix` values, so none should change; if a snapshot test references the old inline expression, update it to the token.)

- [ ] **Step 3: Production build**

Run: `pnpm run build`
Expected: succeeds.

- [ ] **Step 4: Final visual check in both themes**

In the running app, toggle light and dark mode and review the full Progression card one more time: degree chips, pager, notes strip, and editor panel all fit the theme; dark mode shows no regression beyond the intentional editor-panel separation.

- [ ] **Step 5: Refresh darwin visual snapshots**

Run: `pnpm run test:visual:update`
Expected: the `app-components` and `app-overlays` suites regenerate the light-mode Progression-card snapshots. Inspect the diffs to confirm only the intended surfaces changed.

- [ ] **Step 6: Commit the snapshot updates**

```bash
git add e2e
git commit -m "test(visual): refresh snapshots for progression card light surfaces"
```

---

## Self-Review Notes

- **Spec coverage:** §1 tokens → Tasks 1–2; §2 element re-mapping (chip/pager/readout/tones) → Tasks 3, 4 (pager), 5; §3 editor surface → Task 4; §4 verification → Task 6. All spec sections mapped.
- **Type/name consistency:** token names `--faceplate-inset`, `--faceplate-key`, `--faceplate-surface` are used identically across Tasks 1–5.
- **Dark-mode invariance:** dark token values in Task 1 are the verbatim expressions previously inlined in `.chip`, `.editor-pager`, `.readout` (`faceplate-bg 60% transparent`) and `.tone` (`text-main 3% transparent`); `--faceplate-surface` introduces the only intentional dark change (editor-panel base), per spec §3.
