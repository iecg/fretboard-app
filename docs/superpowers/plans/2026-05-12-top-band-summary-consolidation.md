# TopBandSummary Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the unified top-band card so `DegreeChipStrip` and `ChordPracticeBar` read as two seamless regions: shared compact header, lucide eye icons, inset divider that animates with the chord section, and smooth height transitions for every collapse.

**Architecture:** Pure CSS + small JSX edits. Introduce one shared header class in `shared.module.css`, swap inline eye SVGs for `lucide-react` `Eye`/`EyeOff` (preserving `data-icon` for existing test selectors), wrap each section's collapsible content in `AnimatePresence` + `motion` (recipe already used by `TopBandSummary` for the chord-section mount), and add a `::before` divider on `.chord-section` so it co-animates with the chord bar.

**Tech Stack:** React 19, TypeScript, Jotai, `motion/react` (Framer Motion), `lucide-react`, CSS Modules, Vitest, Playwright (visual regression).

**Spec:** `docs/superpowers/specs/2026-05-12-top-band-summary-consolidation-design.md`

---

## File Map

| File | Role |
|---|---|
| `src/components/shared/shared.module.css` | Add `.card-section-header` shared class |
| `src/components/TopBandSummary/TopBandSummary.tsx` | Swap inline eye SVGs → `lucide-react` |
| `src/components/TopBandSummary/TopBandSummary.module.css` | Add `.chord-section::before` divider; smooth card transition |
| `src/components/DegreeChipStrip/DegreeChipStrip.tsx` | Wrap chip list in `AnimatePresence` + `motion.ul` |
| `src/components/DegreeChipStrip/DegreeChipStrip.module.css` | Compose shared header; trim local header rules |
| `src/components/ChordPracticeBar/ChordPracticeBar.tsx` | Lucide icons (with `data-icon`); wrap groups in `AnimatePresence` + `motion.div` |
| `src/components/ChordPracticeBar/ChordPracticeBar.module.css` | Compose shared header; trim local header rules |
| `src/components/ChordPracticeBar/ChordPracticeBar.test.tsx` | (Verify) `data-icon` selectors still pass after lucide swap |

---

## Task 1: Add shared `.card-section-header` class

**Files:**
- Modify: `src/components/shared/shared.module.css`

- [ ] **Step 1: Add `.card-section-header` after the `.eye-toggle` block**

Append after line 33 (`.eye-toggle[aria-pressed="true"] { opacity: 0.4; }`):

```css
/* ===== Shared Card Section Header ===== */
/* Compact header pattern used by sections nested inside a unified card
   (e.g., DegreeChipStrip + ChordPracticeBar inside TopBandSummary). */
.card-section-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.4rem;
  width: 100%;
  font-family: var(--font-sans);
  font-size: var(--strip-header-size, 0.82rem);
  font-weight: var(--font-weight-medium);
  color: var(--text-main);
  line-height: 1.15;
  letter-spacing: 0.01em;
  flex-wrap: wrap;
}
```

- [ ] **Step 2: Run lint to verify CSS parses**

Run: `npm run lint`
Expected: PASS (no stylelint errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/shared.module.css
git commit -m "feat(top-band): add shared card-section-header class"
```

---

## Task 2: Swap eye icons in `TopBandSummary.tsx` to lucide

**Files:**
- Modify: `src/components/TopBandSummary/TopBandSummary.tsx`

- [ ] **Step 1: Replace inline SVG components with lucide imports**

Replace lines 1–28 of `src/components/TopBandSummary/TopBandSummary.tsx`:

```tsx
import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { showChordPracticeBarAtom } from "../../store/atoms";
import { useScaleState } from "../../hooks/useScaleState";
import { usePracticeBarState } from "../../hooks/usePracticeBarState";
import { DegreeChipStrip } from "../DegreeChipStrip/DegreeChipStrip";
import { ChordPracticeBar } from "../ChordPracticeBar/ChordPracticeBar";
import shared from "../shared/shared.module.css";
import styles from "./TopBandSummary.module.css";
```

(Removes the two inline `EyeOpenIcon` / `EyeClosedIcon` function components — they are gone entirely.)

- [ ] **Step 2: Use lucide icons in the `headerAction` button**

Replace the `<span>` block inside the `headerAction` button (currently lines 70–72) with:

```tsx
<span className={shared["flex-center"]}>
  {scaleVisible
    ? <Eye size={16} aria-hidden="true" />
    : <EyeOff size={16} aria-hidden="true" />}
</span>
```

- [ ] **Step 3: Run the integration test to verify nothing broke**

Run: `npm run test -- src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`
Expected: PASS (the test only asserts group roles, not icon markup).

- [ ] **Step 4: Run lint and typecheck via the build**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopBandSummary/TopBandSummary.tsx
git commit -m "refactor(top-band): use lucide Eye/EyeOff in TopBandSummary"
```

---

## Task 3: Swap eye icons in `ChordPracticeBar.tsx` to lucide (preserve `data-icon`)

**Files:**
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.tsx`
- Verify: `src/components/ChordPracticeBar/ChordPracticeBar.test.tsx` (no edits expected; existing `data-icon="eye-open"` / `"eye-closed"` selectors must keep working)

**Why `data-icon` is preserved:** Tests at lines 500–528 of `ChordPracticeBar.test.tsx` query `[data-icon="eye-open"]` / `[data-icon="eye-closed"]`. `lucide-react` icons forward arbitrary props to the rendered `<svg>`, so passing `data-icon` keeps the contract.

- [ ] **Step 1: Replace inline SVG components with lucide imports**

Replace lines 1–31 of `src/components/ChordPracticeBar/ChordPracticeBar.tsx`:

```tsx
import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { Eye, EyeOff } from "lucide-react";
import type { PracticeBarGroup, PracticeBarNote } from "@fretflow/core";
import {
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  scaleDegreeColorsEnabledAtom,
  toggleChordHiddenNoteAtom,
  toggleChordOverlayHiddenAtom,
} from "../../store/atoms";
import shared from "../shared/shared.module.css";
import styles from "./ChordPracticeBar.module.css";
```

(Removes `EyeOpenIcon` / `EyeClosedIcon` function components entirely.)

- [ ] **Step 2: Use lucide icons inside the eye-toggle button**

Replace lines 168–170 of `ChordPracticeBar.tsx` (the `<span className={shared["flex-center"]}>…</span>` block inside the eye-toggle `<button>`):

```tsx
<span className={shared["flex-center"]}>
  {collapsed
    ? <EyeOff size={16} data-icon="eye-closed" aria-hidden="true" />
    : <Eye size={16} data-icon="eye-open" aria-hidden="true" />}
</span>
```

- [ ] **Step 3: Run ChordPracticeBar tests to verify `data-icon` selectors still match**

Run: `npm run test -- src/components/ChordPracticeBar/ChordPracticeBar.test.tsx`
Expected: PASS — in particular the two tests at "renders eye-open icon (data-icon) when overlay is visible" and "renders eye-closed icon (data-icon) when overlay is hidden".

If those tests fail because lucide does not forward `data-icon`, fix by switching the selector strategy in the test file: replace `eyeBtn?.querySelector('[data-icon="eye-open"]')` with `eyeBtn?.querySelector('.lucide-eye')` (and `'.lucide-eye-off'` for closed). Re-run.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordPracticeBar/ChordPracticeBar.tsx src/components/ChordPracticeBar/ChordPracticeBar.test.tsx
git commit -m "refactor(chord-practice-bar): use lucide Eye/EyeOff icons"
```

(Note: include the test file only if Step 3 required a selector swap.)

---

## Task 4: DegreeChipStrip — compose shared header, animate chip list

**Files:**
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.tsx`
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.module.css`

- [ ] **Step 1: Update `DegreeChipStrip.tsx` to import motion primitives**

At the top of `src/components/DegreeChipStrip/DegreeChipStrip.tsx`, after the existing `clsx` import, add:

```tsx
import { AnimatePresence, motion } from 'motion/react';
```

- [ ] **Step 2: Wrap the chip list in `AnimatePresence` + `motion.ul`**

Replace lines 68–99 (the entire `{visible && ( <ul …> … </ul> )}` block) with:

```tsx
<AnimatePresence initial={false}>
  {visible && (
    <motion.ul
      key="chip-list"
      className={styles['degree-chip-strip-list']}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      {chips.map((chip, i) => {
        const isHidden = hiddenNotes?.has(chip.internalNote) ?? false;
        const isColorNote = colorNotes?.has(chip.internalNote) ?? false;
        return (
          <li
            key={`${chip.note}-${i}`}
            className={styles['degree-chip-item']}
            data-in-scale={chip.inScale ? 'true' : undefined}
            data-is-tonic={chip.isTonic ? 'true' : undefined}
            data-hidden={isHidden ? 'true' : undefined}
            data-is-color-note={isColorNote ? 'true' : undefined}
            data-scale-degree={degreeColorsEnabled ? chip.scaleDegree : undefined}
            style={degreeColorsEnabled && chip.degreeColor ? { '--degree-color': chip.degreeColor } as React.CSSProperties : undefined}
          >
            <button
              type="button"
              className={styles['degree-chip']}
              aria-pressed={isHidden}
              aria-label={`${isHidden ? 'Show' : 'Hide'} ${chip.note}`}
              onClick={() => onChipToggle?.(chip.internalNote)}
              disabled={!onChipToggle}
            >
              <span className={styles['degree-chip-note']}>{chip.note}</span>
            </button>
            <span className={styles['degree-chip-interval']}>{chip.interval}</span>
          </li>
        );
      })}
    </motion.ul>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Compose the shared header class in `DegreeChipStrip.module.css`**

Replace the existing `.degree-chip-strip-header` block (lines 28–45) with:

```css
.degree-chip-strip-header {
  composes: card-section-header from "../shared/shared.module.css";
}
```

(Removes the local `font-family`, `font-size`, `font-weight`, `color`, `line-height`, `letter-spacing` declarations and the separate `[data-has-action]` flex layout — the shared class now provides all of that uniformly.)

Note: the existing `.degree-chip-strip-header[data-has-action]` selector still works on the composed class because `composes:` produces a multi-class element; the `data-has-action` attribute is still set in JSX, but the styling is no longer conditional on it (the shared class always uses flex). The selector becomes dead code — remove it.

- [ ] **Step 4: Run the DegreeChipStrip tests**

Run: `npm run test -- src/components/DegreeChipStrip/DegreeChipStrip.test.tsx`
Expected: PASS. Tests like "visible=false hides chip list" (line 197) check `container.querySelector('.degree-chip-strip-list')` is `null` — this still holds because `AnimatePresence` unmounts the `motion.ul` after exit animation, but jsdom resolves the exit synchronously so the assertion is reached after unmount.

If "visible=false hides chip list" fails because the motion element is still in the DOM during exit, add `mode="wait"` to `AnimatePresence` OR adjust the test to use `await waitFor(() => expect(container.querySelector('.degree-chip-strip-list')).toBeNull())`. Prefer the `waitFor` change to keep the visible-state animation intact.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DegreeChipStrip/DegreeChipStrip.tsx \
        src/components/DegreeChipStrip/DegreeChipStrip.module.css \
        src/components/DegreeChipStrip/DegreeChipStrip.test.tsx
git commit -m "feat(degree-chip-strip): animate chip list collapse + compose shared header"
```

(Only include `.test.tsx` if Step 4 required a `waitFor` change.)

---

## Task 5: ChordPracticeBar — compose shared header, animate groups container

**Files:**
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.tsx`
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.module.css`

- [ ] **Step 1: Import motion primitives**

At the top of `src/components/ChordPracticeBar/ChordPracticeBar.tsx`, after the `lucide-react` import added in Task 3, add:

```tsx
import { AnimatePresence, motion } from 'motion/react';
```

- [ ] **Step 2: Wrap the groups container in `AnimatePresence` + `motion.div`**

Replace lines 178–197 of `ChordPracticeBar.tsx` (the `{!collapsed && ( <div className={styles["chord-practice-bar-groups-container"]}> … </div> )}` block) with:

```tsx
<AnimatePresence initial={false}>
  {!collapsed && (
    <motion.div
      key="groups"
      className={styles["chord-practice-bar-groups-container"]}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      <div className={styles["chord-practice-bar-groups"]}>
        {!dedupGroups && (
          <Group
            variant="chord"
            group={chordGroup}
            hiddenNotes={hiddenNotes}
            onToggleNote={toggleNote}
          />
        )}
        <Group
          variant="land-on"
          group={landOnGroup}
          hiddenNotes={hiddenNotes}
          onToggleNote={toggleNote}
        />
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Compose the shared header class in `ChordPracticeBar.module.css`**

Replace lines 24–37 of `ChordPracticeBar.module.css` (the existing `.chord-practice-bar-header` block) with:

```css
.chord-practice-bar-header {
  composes: card-section-header from "../shared/shared.module.css";
}
```

Also delete the now-redundant `.chord-practice-bar-title` font/color declarations on lines 43–50 — the title is just a `<span>` child of the composed header; let it inherit. Replace that block with:

```css
.chord-practice-bar-title {
  /* Inherits font, color, weight from .card-section-header parent. */
  white-space: nowrap;
}
```

- [ ] **Step 4: Run the ChordPracticeBar tests**

Run: `npm run test -- src/components/ChordPracticeBar/ChordPracticeBar.test.tsx`
Expected: PASS. The test "collapsing hides the chord-practice-bar-groups section" (line 556) queries `container.querySelector(".chord-practice-bar-groups")` — must remain `null` when `chordOverlayHiddenAtom=true`. Since `AnimatePresence` unmounts the child after exit (synchronously enough in jsdom for the initial-render assertion), this should still pass. If it fails, apply the same `waitFor` pattern from Task 4 Step 4.

Similarly, "pills are not rendered when overlay is collapsed" (line 660) checks `container.querySelectorAll(".practice-bar-pill").length` equals `0`.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordPracticeBar/ChordPracticeBar.tsx \
        src/components/ChordPracticeBar/ChordPracticeBar.module.css \
        src/components/ChordPracticeBar/ChordPracticeBar.test.tsx
git commit -m "feat(chord-practice-bar): animate groups collapse + compose shared header"
```

(Test file only if Step 4 required adjustments.)

---

## Task 6: Add inset divider on `.chord-section` + card-level smoothing

**Files:**
- Modify: `src/components/TopBandSummary/TopBandSummary.module.css`

- [ ] **Step 1: Add divider rules and smooth transition to card**

Replace the entire contents of `src/components/TopBandSummary/TopBandSummary.module.css` with:

```css
.top-band-summary {
  background: var(--surface-card-top);
  border: 1px solid var(--surface-card-border);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 30rem);
  margin: 0 auto;
  overflow: visible;
  transition:
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);

  /* Suppress child strip surfaces — the card owns the fill. */
  --strip-bg-override: transparent;
  --strip-border-override: none;
  --strip-shadow-override: none;

  /* Compact overrides cascading to children */
  --strip-padding: 0.32rem 0.85rem 0.34rem;
  --strip-radius: 0;
  --strip-gap: 0.3rem;
  --strip-header-size: 0.82rem;
  --strip-eye-icon-size: 1rem;
  --strip-eye-toggle-padding: 0.1rem;
}

/* stylelint-disable selector-pseudo-class-no-unknown */
:global(.app-container[data-layout-tier="desktop"]) .top-band-summary {
  width: min(100%, 32rem);
}
/* stylelint-enable selector-pseudo-class-no-unknown */

.chord-section {
  width: 100%;
}

/* Inset hairline divider between the chip strip and the chord section.
   Rendered inside the animated motion container so it appears/disappears
   in lockstep with the chord bar — no orphaned line. */
.chord-section::before {
  content: "";
  display: block;
  height: 1px;
  margin: 0 0.85rem;
  background: var(--chrome-border);
  opacity: 0.6;
}
```

Changes from current file:
- Added `transition: box-shadow …, border-color …` to `.top-band-summary`.
- Dropped `--strip-header-size` from `0.85rem` to `0.82rem` to match the shared header.
- Added `.chord-section::before` divider.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Run all top-band-related tests**

Run: `npm run test -- src/components/TopBandSummary src/components/DegreeChipStrip src/components/ChordPracticeBar src/components/ChordOverlayDock`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBandSummary/TopBandSummary.module.css
git commit -m "feat(top-band): add inset divider + smooth card transitions"
```

---

## Task 7: Final verification

**Files:** (verification only)

- [ ] **Step 1: Full unit test suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS (no TS errors, clean Vite build).

- [ ] **Step 3: Visual sanity check in dev server**

Run: `npm run dev` and open the local URL. Verify in the preview:
1. With no chord active, the card shows only the chip strip + its compact header with a lucide eye icon.
2. Selecting a chord causes the chord bar to slide in below an inset hairline divider; both the divider and the chord bar animate together.
3. Clicking the eye on the chip strip smoothly collapses the chip list; the header stays put.
4. Clicking the eye on the chord bar smoothly collapses the groups; the header stays put.
5. Deselecting the chord makes the chord bar + divider slide out together.
6. Both eye icons swap between `Eye` and `EyeOff` (lucide).
7. Toggle the theme (light/dark) — card border/shadow transition is smooth (no flash).

- [ ] **Step 4: Refresh visual regression snapshots (darwin)**

Run: `npm run test:visual:update`
Expected: snapshot files under `e2e/app-components.spec.ts-snapshots/`, `e2e/app-overlays.spec.ts-snapshots/`, and `e2e/app-layout.spec.ts-snapshots/` will update for the affected views. Inspect the diffs visually — they should show the smaller header text, the lucide icon swap, and the new divider. No unrelated changes.

- [ ] **Step 5: Refresh linux snapshots (cross-platform)**

Run: `npm run test:visual:update:linux`
Expected: linux snapshots regenerated to match.

- [ ] **Step 6: Run the full visual suite to confirm everything is green**

Run: `npm run test:visual`
Expected: PASS.

- [ ] **Step 7: Commit refreshed snapshots**

```bash
git add e2e/
git commit -m "test(visual): refresh snapshots for top-band consolidation"
```

- [ ] **Step 8: Final sanity — lint, test, build**

Run (in parallel where possible): `npm run lint && npm run test && npm run build`
Expected: all PASS. The branch is now ready for PR.

---

## Notes for the implementer

- **Motion exit timing in tests:** `motion/react` may not synchronously unmount during exit in jsdom. The plan assumes existing test assertions (`querySelector(...)` returning `null` after `visible={false}` or `collapsed=true`) keep passing because the test renders the component once with the final state. If a test renders the component, then *changes* state, an `await waitFor(...)` may be needed. Tasks 4 and 5 call this out and provide the fix.
- **`composes:` semantics:** CSS Modules `composes:` produces a multi-class element — the original `.degree-chip-strip-header` / `.chord-practice-bar-header` class names remain on the DOM, so existing CSS selectors (`.degree-chip-strip-header` in light-mode overrides, etc.) keep matching.
- **`data-icon` on lucide:** `lucide-react` forwards arbitrary props to the underlying `<svg>`. If a future version stops doing this, fall back to the `.lucide-eye` / `.lucide-eye-off` class selectors that lucide always emits.
- **No `prefers-reduced-motion` override:** `motion/react` honors the OS setting by default.
- **DRY checkpoint:** there's only one inset value used in the divider (`0.85rem`), matching the strip horizontal padding token in `.top-band-summary`. If that padding changes later, the divider should follow — consider extracting to a CSS custom property in a future polish.
