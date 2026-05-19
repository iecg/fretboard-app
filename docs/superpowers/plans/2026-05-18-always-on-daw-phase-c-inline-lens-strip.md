# Always-On DAW — Phase C: Inline Lens Pill Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the scale/chord lens from a floating overlay into an inline strip at the top of the fretboard container, and restyle `DegreeChipStrip` chips from circles to pills.

**Architecture:** Placement + CSS only — no atom changes. `TopBandSummary` (= `DegreeChipStrip` + `ChordPracticeBar`) moves from the absolutely-positioned `FretboardLensOverlay` into an inline strip rendered as the first child inside the fretboard container, above the SVG. `DegreeChipStrip` chips change from circular to rounded pills; the connecting-line track is removed. The lens renders always — no tab-gating. **Prerequisite: Phase B is merged** (the mode-swap that owned lens visibility is gone). Spec: `docs/superpowers/specs/2026-05-18-always-on-daw-model-design.md` §6; mockup reference `FretFlow DAW.html` `lens.jsx`.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, Vitest + Testing Library, Playwright (visual regression). Package manager is **pnpm**.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx` | Lens host | Repurpose into an inline strip wrapper, or remove and mount `TopBandSummary` directly |
| `src/components/FretboardLensOverlay/FretboardLensOverlay.module.css` | Overlay styling | Remove `position: absolute` / `backdrop-filter`; restyle as a slim inline row with a hairline bottom border |
| `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css` | Layout | Remove `.main-fretboard` `position: relative`; remove the now-empty standalone summary shell if applicable |
| `src/App.tsx` | Orchestrator | Mount the lens strip inside the fretboard region, above the SVG |
| `src/components/DegreeChipStrip/DegreeChipStrip.tsx` | Degree chips | No behavior change; confirm chip markup supports inline name + interval |
| `src/components/DegreeChipStrip/DegreeChipStrip.module.css` | Chip styling | Circular → pill (`border-radius: 999px`, ~20px tall, horizontal padding); remove the connecting-line `::before` track |
| `src/components/ChordPracticeBar/ChordPracticeBar.module.css` | Chord tone pill | Resize `.practice-bar-pill` to the ~20px tone-pill scale |
| `src/components/TopBandSummary/TopBandSummary.module.css` | Strip layout | Gap-spaced row; mobile wrap behavior |
| Test files | — | See Task 5 |

---

## Task 1: Relocate the lens into the fretboard container

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx`
- Modify: `src/components/FretboardLensOverlay/FretboardLensOverlay.module.css`
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css`

- [ ] **Step 1: Decide overlay component fate**

`FretboardLensOverlay` currently wraps `TopBandSummary` in an absolutely-positioned div carrying `data-layout-tier` / `data-layout-variant`. Repurpose it into a slim inline strip wrapper (keep the component name or rename to `FretboardLensStrip` — keep `FretboardLensOverlay` for a smaller diff, but update the doc comment). It keeps the layout-attribute wiring (mobile needs it for wrap behavior) and renders `TopBandSummary` inline.

- [ ] **Step 2: Mount the strip inside the fretboard region**

In `App.tsx`, move the lens element so it is the first child inside the fretboard container, above `FretboardSVG`. Remove the standalone mount point at line ~242. If the standalone summary shell is now empty, remove it.

- [ ] **Step 3: Restyle the wrapper CSS**

In `FretboardLensOverlay.module.css`, remove `position: absolute`, `backdrop-filter`, and any z-index/inset rules. Replace with a slim inline row: full container width, a hairline `border-bottom`, modest vertical padding — "a quiet legend, not a popover" (mockup `lens.jsx`).

- [ ] **Step 4: Drop the positioning context**

In `MainLayoutWrapper.module.css`, remove `position: relative` from `.main-fretboard` (line ~1-8) and the comment about the lens overlay positioning context. Remove the desktop/tablet `.summary-shell` rules if the shell is now unused.

- [ ] **Step 4 verification:** The lens renders inline above the SVG on desktop, tablet, and mobile; it never floats over or occludes the board.

---

## Task 2: Restyle `DegreeChipStrip` chips as pills

**Files:**
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.module.css`
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.tsx` (only if markup needs the interval inline)

- [ ] **Step 1: Pill geometry**

Change the chip from circular (`border-radius: 50%`, fixed square `--chip-size`) to a rounded pill: `border-radius: 999px`, ~20px tall, horizontal padding, auto width. The note name + interval show inline (mockup `ScaleNoteRow` pills, `lens.jsx:43-63`). If the current markup only renders the note glyph, add the interval label span in `DegreeChipStrip.tsx`.

- [ ] **Step 2: Remove the connecting line**

Delete the `::before` connecting-line track. Pills sit in a simple gap-spaced row. Keep the per-note eye toggle and all other `DegreeChipStrip` behavior — only shape and the track change.

- [ ] **Step 2 verification:** Eye toggles still hide/show notes; chips render as pills with no connecting line.

---

## Task 3: Resize the chord tone pill

**Files:**
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.module.css`

- [ ] **Step 1:** `ChordPracticeBar` already renders `.practice-bar-pill`. Resize it to the mockup's ~20px tone-pill scale so it sits beside the scale pills (mockup `ChordToneRow`). No behavior change.

---

## Task 4: Strip layout + mobile

**Files:**
- Modify: `src/components/TopBandSummary/TopBandSummary.module.css`

- [ ] **Step 1:** Lay the `DegreeChipStrip` pills and the `ChordPracticeBar` pill out as a gap-spaced row. On the `mobile` tier the strip must not crowd the fretboard — make the row `flex-wrap: wrap` (the mockup strip wraps). If wrapping still crowds the board on the smallest widths, fall back to horizontal scroll; settle this during implementation and note the choice in the PR.

- [ ] **Step 1 verification:** On the `mobile` tier the strip wraps cleanly and the fretboard SVG is not pushed off-screen or occluded.

---

## Task 5: Tests

**Files:**
- Modify: `src/components/TopBandSummary/TopBandSummary.test.tsx`
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.test.tsx`
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.test.tsx`
- Modify: `src/components/FretboardLensOverlay/FretboardLensOverlay.test.tsx`
- Modify: App / layout tests covering the fretboard region

- [ ] **Step 1:** `TopBandSummary.test.tsx` — assert *structural placement* rather than CSS: locate the fretboard container, confirm the lens strip is a descendant of it, and confirm it precedes `FretboardSVG` in DOM order (e.g. via `compareDocumentPosition`). Do not assert on `position: absolute` or the absence of an overlay testid — structure, not computed style.
- [ ] **Step 2:** `DegreeChipStrip.test.tsx` — chips render as pills; the per-note eye toggle still works; assert the connecting-line element is gone.
- [ ] **Step 3:** `ChordPracticeBar.test.tsx` — behavior unaffected (resize is CSS only); run to confirm.
- [ ] **Step 4:** `FretboardLensOverlay.test.tsx` — update for the inline strip; the floating overlay is gone.
- [ ] **Step 5:** App / layout tests — the lens strip renders inside the fretboard region on every inspector tab.

---

## Task 6: Visual regression + verification

- [ ] **Step 1:** `pnpm run lint` passes.
- [ ] **Step 2:** `pnpm run test` passes.
- [ ] **Step 3:** `pnpm run build` passes.
- [ ] **Step 4:** Refresh visual snapshots for `app-layout`, `app-components`, `app-overlays`, `fretboard-svg`, `app-mobile` (darwin + linux). Review diffs — the lens placement and chip shape change is expected; the SVG geometry must not.

---

## Acceptance Criteria

- The scale/chord lens is an inline pill strip at the top of the fretboard container, not a floating overlay.
- `DegreeChipStrip` chips are pills; the connecting line is gone; eye toggles still work.
- The lens renders on every inspector tab.
- The mobile-tier strip wraps and never occludes the fretboard.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.
