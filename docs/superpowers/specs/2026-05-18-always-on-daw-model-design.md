# Always-On DAW Model — Design

**Status:** Brainstorm spec. Produced 2026-05-18, deferred out of
`2026-05-18-daw-voicing-engine-and-parity-design.md` §7.

**Date:** 2026-05-18

**Scope:** Restructure the top-of-app to the `FretFlow DAW.html` mockup's *always-on DAW
model* — a unified header with inline transport, a permanently visible chord track, and the
scale/chord lens as an inline pill strip inside the fretboard container. This reverses the
phases-8-13 spec's recorded decision to keep the progression mode-swap.

This is the largest remaining gap between the shipped app and the mockup. It is its own
spec because it is high-blast-radius (removes `progressionEnabledAtom` as a gate, touches
~12 files) and reverses a prior decision.

---

## 1. Background

The DAW shell redesign (phases 1-13) implemented the `FretFlow DAW.html` mockup but kept
one structural divergence: the mockup treats transport, the chord track, and the lens as
**permanent chrome**, while the shipped app gates the whole progression workflow behind
`progressionEnabledAtom` and swaps the top band between a scale summary and the progression
track. The phases-4-7 and phases-8-13 specs recorded keeping that mode-swap as a deliberate
decision. A re-handoff of the mockup and a fresh audit reopened it; the user decided to
adopt the always-on model.

### Mockup model (`FretFlow DAW.html`)

`app.jsx` renders, top to bottom:

1. **Unified header** (`app.jsx:76-99`) — one flex row: `BrandLogo` · divider ·
   `PlayIndicator` · `Transport` (transport buttons + instrument toggles) · `Position` ·
   spacer · `TempoChip` · `ScaleChip` · divider · `UtilityCluster`.
2. **Chord track** (`app.jsx:101-112`) — `ChordTrack`, a bar ruler + chord clips +
   playhead, always present.
3. **Fretboard stage** (`app.jsx:114-138`) — the fretboard, with `LensPanel`
   (`lens.jsx`) as a slim inline strip at the top of the fretboard container.
4. **Inspector tabs** and **status bar**.

There is no progression on/off control. The mockup's `progressionMode` state is only a
*loop* flag, not a visibility gate.

### Shipped state (the gap)

Per the 2026-05-18 re-audit:

- **Header split.** `AppHeader` (`src/components/AppHeader/AppHeader.tsx`) renders only
  brand + utility actions. `TransportBar`
  (`src/components/TransportBar/TransportBar.tsx`) is a separate component nested inside
  `ProgressionTrack` (`src/components/ProgressionTrack/ProgressionTrack.tsx`). The position
  readout, tempo, and scale readouts also live in `ProgressionTrack`. All of it is only
  visible when progression mode is on.
- **Progression gate.** `progressionEnabledAtom` (`src/store/progressionAtoms.ts`, default
  `false`) drives a `TopBandSummary ↔ ProgressionTrack` mode-swap. Files that read it:
  `progressionAtoms.ts` (definition, auto-set, RESET, playback guard), `store/atoms.ts`
  (barrel), `ProgressionSummarySlot.tsx` (renders `ProgressionTrack` if on),
  `FretboardLensOverlay.tsx` (renders `TopBandSummary` if off), `useProgressionState.ts`,
  `ProgressionControls.tsx` (the on/off toggle UI), `chordOverlayAtoms.ts` and
  `practiceLensAtoms.ts` (derivations gated on it), `MainLayoutWrapper.module.css`
  (`.summary-shell:empty` collapse).
- **Lens.** `FretboardLensOverlay` floats `TopBandSummary` (= `DegreeChipStrip` +
  `ChordPracticeBar`) absolutely over `.main-fretboard`, and only when progression mode is
  *off*. `DegreeChipStrip` renders *circular* chips on a connecting line, not pills.

### Decisions taken during the brainstorm

- **Adopt the always-on model** — confirmed by the user.
- **Keep the rich lens behavior, restyle to pills.** The user's request — "the degree chip
  strip and the chord practice bar are integrated neatly over the fretboard using pill
  chips" — keeps both components and their behavior (per-note eye toggles, the animated
  practice bar). Only their *placement* (inline strip in the fretboard container) and the
  `DegreeChipStrip` chip *shape* (circular → pill) change.
- **Lens stays always visible.** The mockup gates the lens on the Chord/Progression
  inspector tabs (`app.jsx:69` `showLens`). The phases-8-13 spec already flagged tab-gating
  as a usability regression (it would hide the scale strip on the View/Scale tabs). With
  the scale-mode fallback gone, the lens simply renders always. Tab-gating is **not**
  adopted.
- **`progressionEnabledAtom` removed as a gate, not repurposed.** The progression workflow
  becomes unconditionally active. The atom is removed; consumers are updated to behave as
  if always-on. The mockup's loop flag maps to the existing `progressionLoopEnabledAtom`,
  which already exists and is unaffected.

---

## 2. Goals and Non-Goals

### Goals

- A single unified header row: brand · transport · position · tempo · scale · utility.
- A permanently visible chord track; no progression on/off control.
- The scale/chord lens as an inline pill strip inside the fretboard container.

### Non-Goals

- No music-theory, audio-synthesis, or fretboard SVG geometry changes.
- No new persisted domain state. This spec relocates rendering and removes a gate; it adds
  no atoms.
- No change to instrument/backing-track controls beyond their header/tab placement
  (already rehosted to the Progression tab in phase 11).
- No token recolor (covered separately by the parity spec's light-theme retune).

---

## 3. Execution Order

Build in order **A → B → C**. Each phase ships as its own PR with its own implementation
plan and visual-regression baseline refresh, and each leaves the app working and
releasable.

- **A** is additive — it rehomes chrome into the header while the mode-swap still exists
  underneath; the app stays correct in an intermediate state.
- **B** removes the gate once the header no longer depends on `ProgressionTrack` being the
  transport host.
- **C** reshapes the lens last, once the mode-swap (which currently owns lens visibility)
  is gone.

Phases A and B both modify `App.tsx` and `MainLayoutWrapper`; B and C both touch the lens
machinery. Sequential phases avoid concurrent file contention.

---

## 4. Phase A — Unified header

**Goal:** Move transport, position, tempo, and scale readouts into `AppHeader` so the
header is the single chrome row from the mockup.

### Changes

- `AppHeader` absorbs, in order: the existing brand, then `TransportBar`, then a position
  readout, then tempo and scale readout chips, then the existing utility actions. The
  mockup's `PlayIndicator` (play/loop status dots) is included with the transport cluster.
- `TransportBar` is rehomed: it is rendered by `AppHeader` instead of by `ProgressionTrack`.
  Its props/atom wiring are unchanged — only its mount point moves.
- The position / tempo / scale readouts currently inside `ProgressionTrack` are extracted
  into small presentational components (or moved as-is) and mounted in `AppHeader`. They
  read their existing atoms (`progressionTempoBpmAtom`, the position/playhead atoms,
  `rootNoteAtom` + `scaleNameAtom`); the sourcing is unchanged, only the mount point.
- `ProgressionTrack` keeps the timeline, bar ruler, playhead, and chord clips; it loses the
  transport bar and the readouts and their CSS.
- The header layout follows the mockup: a wrapping flex row, hairline dividers, a flexible
  spacer between the position readout and the tempo chip.

### Data flow

All readouts bind to existing atoms. No new atoms. No behavior change — purely a relocation
of rendering.

### Testing

- `AppHeader.test.tsx` — the header renders brand, transport, position, tempo, scale, and
  utility; transport controls still drive playback atoms.
- `ProgressionTrack.test.tsx` — the transport bar and readouts are gone; the timeline,
  ruler, playhead, and chord clips are unaffected.
- `TransportBar.test.tsx` — unchanged behavior under the new mount point.
- Visual regression — refresh `app-layout`, `app-components`, `app-overlays`, darwin +
  linux.

### Acceptance criteria

- The header is one row: brand · transport · position · tempo · scale · utility.
- `ProgressionTrack` no longer hosts the transport bar or the readouts.
- Playback, tempo, and scale readouts behave exactly as before.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 5. Phase B — Permanent chord track, remove the progression gate

**Goal:** Make the chord track always visible and remove `progressionEnabledAtom` as a
gate.

### Changes

- **`progressionEnabledAtom` removed.** Every consumer is updated to behave as if
  progression is always active:
  - `ProgressionSummarySlot` — collapses to always render `ProgressionTrack` (the chord
    track). If the component becomes a trivial pass-through, it is removed and `App.tsx`
    mounts `ProgressionTrack` directly.
  - `chordOverlayAtoms.ts` / `practiceLensAtoms.ts` — derivations gated on
    `progressionEnabledAtom` take the always-on branch unconditionally; the gate reads are
    deleted.
  - `progressionAtoms.ts` — the atom definition, its auto-set writes, its RESET entry, and
    the playback-blocked guard that references it are removed or simplified. The
    playback-blocked-reason logic keeps any reason **not** tied to the gate.
  - `useProgressionState.ts` — drops `progressionEnabled` / `setProgressionEnabled` from
    its surface.
  - `store/atoms.ts` — drops the barrel re-export.
  - `MainLayoutWrapper.module.css` — the `.summary-shell:empty` collapse rule is removed;
    the summary shell always has content now.
- **`ProgressionControls`** — the progression on/off toggle UI is removed. The rest of the
  Progression tab (meter row, chord list, selected-chord editor, backing track) is
  unchanged.
- **`FretboardLensOverlay`** — it currently renders `TopBandSummary` only when the gate is
  *off*. With the gate gone the lens must render unconditionally; this component is reworked
  in Phase C (which owns the lens). Phase B leaves the lens rendering via the existing
  overlay path (now ungated) so the app stays correct between B and C.

### Persistence note

`progressionEnabledAtom` is a persisted atom. Removing it orphans its `localStorage` key;
that is harmless (a stale key, ignored). No migration is needed. The plan notes the key
name for the record.

### Data flow

This phase removes state; it adds none. The progression workflow is unconditionally active.

### Testing

- `ProgressionControls.test.tsx` — the on/off toggle is gone; chord editing and backing
  track are unaffected.
- `progressionAtoms.test.ts` / `chordOverlayAtoms.test.ts` / `practiceLensAtoms.test.ts` —
  update for the removed gate; the always-on branch is the only branch.
- App / layout tests — the chord track is always visible; there is no scale-mode fallback.
- `ProgressionSummarySlot.test.tsx` — updated or removed with the component.
- Visual regression — refresh `app-layout`, `app-overlays`, `app-mobile`, darwin + linux.

### Acceptance criteria

- The chord track (`ProgressionTrack`) is always visible.
- No progression on/off control exists anywhere.
- `progressionEnabledAtom` is gone; no consumer references it; the app behaves as
  progression-always-on.
- All progression editing, playback, and accompaniment behavior is unchanged.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 6. Phase C — Inline lens pill strip

**Goal:** Move the scale/chord lens from a floating overlay into an inline strip at the top
of the fretboard container, and restyle `DegreeChipStrip` chips from circles to pills.

### Changes

- **Placement.** `TopBandSummary` moves from the absolutely-positioned
  `FretboardLensOverlay` into an inline strip rendered as the first child *inside* the
  fretboard container, above the SVG — matching the mockup `LensPanel` (`lens.jsx`, mounted
  at `app.jsx:120-126`): a slim row with a hairline bottom border, reading "like a quiet
  legend, not a popover."
  - `FretboardLensOverlay` is removed or repurposed into the inline strip wrapper.
  - The `.main-fretboard` `position: relative` context and the overlay's
    `position: absolute` / `backdrop-filter` styling are removed.
  - `App.tsx` / `MainLayoutWrapper` mount the strip inside the fretboard region; the
    standalone summary shell, if now empty, is removed.
- **Chip shape.** `DegreeChipStrip` chips change from circular (`border-radius: 50%`, fixed
  square `--chip-size`) to rounded **pills** matching the mockup `ScaleNoteRow` pills
  (`lens.jsx:43-63`): `border-radius: 999px`, ~20px tall, horizontal padding, the note name
  + interval shown inline. The connecting-line `::before` track is removed (pills sit in a
  simple gap-spaced row). The per-note eye toggle and all `DegreeChipStrip` behavior are
  kept.
- **Chord row.** `ChordPracticeBar` already renders a pill (`.practice-bar-pill`); it is
  resized to the mockup's tone-pill scale (~20px) and kept otherwise as-is, sitting beside
  the scale pills as the mockup `ChordToneRow` does.
- **Visibility.** The lens renders always (see §1 decisions — no tab-gating).
- **Mobile.** On the `mobile` tier the inline strip must not crowd the fretboard; the plan
  settles whether it wraps, scrolls horizontally, or collapses. The mockup strip already
  wraps (`flexWrap: 'wrap'`).

### Data flow

No atom changes. `DegreeChipStrip` and `ChordPracticeBar` keep their atom wiring; only
placement and chip CSS change.

### Testing

- `TopBandSummary.test.tsx` — renders inline within the fretboard container; the strip is
  not absolutely positioned.
- `DegreeChipStrip.test.tsx` — chips render as pills; the per-note eye toggle still works;
  the connecting-line element is gone.
- `ChordPracticeBar.test.tsx` — unaffected behaviorally; resized.
- App / layout tests — the lens strip renders inside the fretboard region on every tab; the
  floating overlay is gone.
- Visual regression — refresh `app-layout`, `app-components`, `app-overlays`,
  `fretboard-svg`, `app-mobile`, darwin + linux.

### Acceptance criteria

- The scale/chord lens is an inline pill strip at the top of the fretboard container, not a
  floating overlay.
- `DegreeChipStrip` chips are pills; the connecting line is gone; eye toggles still work.
- The lens renders on every inspector tab.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 7. Cross-Cutting Notes

- Each phase is its own PR with its own implementation plan and visual-regression baseline
  refresh (darwin + linux). Suites likely touched: `app-layout`, `app-components`,
  `app-overlays`, `app-mobile`, `fretboard-svg`.
- Mandatory before each PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- No new UI strings are expected; any that arise go through `useTranslation`.
- This spec is committed to git under `docs/superpowers/specs/`.

## 8. Relationship to the parity spec

This spec is the deferred §7 of `2026-05-18-daw-voicing-engine-and-parity-design.md`. The
parity spec's Part 1 (eight drift fixes incl. the light-theme retune, control density, and
status-bar unpin) and Part 2 (voicing engine) are independent of this restructure and may
be built before, after, or interleaved with phases A-C. The one shared region is the
status bar (parity §4f unpins it; this spec does not touch it) and the lens (parity does
not touch it; Phase C here does) — no contention.

## 9. Phase D — Faceplate framing (deferred from the Chord-tab parity review)

A side-by-side review of the Chord tab against the updated design surfaced three app-shell
framing differences. They are recorded here for a future phase; they are not Chord-tab
content and are out of scope for `2026-05-18-chord-tab-design-parity-design.md`.

- **Inspector is a full-width section, not a card.** The design renders the Inspector as a
  full-bleed band, not inside a bordered/rounded card. Drop the Inspector's card chrome
  (border, radius, inset background) so it reads as a flush section.
- **Fretboard sits inside a card.** Conversely, the fretboard region gains card chrome — a
  bordered, rounded container — making it the visually framed "stage."
- **Status bar is full-width.** The bottom status bar spans the full viewport width with no
  side gutters or card inset.

These three are a coherent "faceplate framing" pass: the framed element moves from the
Inspector to the fretboard, and the chrome bands (status bar, Inspector) go full-bleed.
Sequence after phases A-C, or as an independent phase — none of A-C depend on it.
