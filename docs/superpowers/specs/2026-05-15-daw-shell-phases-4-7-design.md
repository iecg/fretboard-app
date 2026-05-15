# DAW Shell Redesign — Phases 4-7 Design

**Status:** Reconstructed spec. The original `2026-05-14-daw-shell-redesign-design.md` was
never committed (it lived only in the deleted `claude/agitated-merkle-f73737` worktree).
This document re-derives the remaining work from the Phase 3 implementation plan
(`docs/superpowers/plans/2026-05-15-daw-shell-phase-3-tab-contents.md`), the current
codebase, and decisions captured during a fresh brainstorming pass on 2026-05-15.

**Date:** 2026-05-15

**Scope:** Phases 4-7 of the DAW shell redesign. Phases 1-3 are shipped.

---

## 1. Background

The DAW shell redesign reshapes FretFlow's controls into a "digital audio workstation"
visual language: a navy faceplate substrate, a cyan accent (`--neon-cyan #4DE4FF`), cyan
glow shadows, and cyan-underlined active tabs.

### Shipped (Phases 1-3 — do not redo)

- **Phase 1-2** — the `Inspector` component: a Radix Tabs panel
  (`src/components/Inspector/`) with View / Scale / Chord tabs, plus a Progression tab
  that appears only when progression mode is on. `Inspector.module.css` carries the DAW
  faceplate chrome (navy substrate `#0a121d`, cyan radial wash, cyan border,
  cyan-underline active tab).
- **Phase 3** — the View / Scale / Chord tab bodies were populated by rehosting the
  existing leaf controls (`FingeringPatternControls`, `FretRangeControl`, `ScaleSelector`,
  `CircleOfFifths`, `ChordOverlayControls`). The Inspector became the default controls
  panel for desktop/tablet; `ExpandedControlsPanel` and the `?inspector=tabs` dev flag
  were deleted.

### Current state relevant to Phases 4-7

- `src/components/ProgressionSummarySlot/ProgressionSummarySlot.tsx` renders
  `ProgressionTrack` when `progressionEnabledAtom` is true, otherwise `TopBandSummary`.
  **The two are mutually exclusive** — they never render together. `App.tsx` mounts this
  slot as `summary={<ProgressionSummarySlot />}`.
- `TopBandSummary` (`src/components/TopBandSummary/TopBandSummary.tsx`, ~178 lines)
  renders the scale `DegreeChipStrip` plus an animated section. Because the slot already
  gates on `progressionEnabledAtom`, the `progressionEnabled` branch inside
  `TopBandSummary` (lines ~96-155) is **dead code** — it can never render.
- `ProgressionTrack` (`src/components/ProgressionTrack/`) is the "DAW track": a timeline
  of chord blocks, a playhead, a position readout, and an embedded transport row
  (play / pause / stop / loop + strum / bass / drums / metronome toggles, using the
  `transportButton` / `transportCluster` CSS classes).
- The Inspector's Progression tab body is currently a `progression: () => null`
  placeholder in the `TAB_BODIES` map in `Inspector.tsx`.
- `ProgressionControls` (`src/components/ProgressionControls/`) is the progression editor
  (mode toggle, beats-per-bar, chord list with add/move/remove, degree/duration/quality
  controls). It is currently reachable only via the mobile `MobileTabPanel`.
- The Accidentals / Enharmonic-display / Scale-degree-colors switches live in
  `SettingsOverlay` — `src/components/SettingsOverlay/sections/NotationSettingsSection.tsx`
  and `ViewSettingsSection.tsx`.
- `TheoryControls` was already deleted (commit `1b293bbd`). `ToggleBar` is **shared** by
  `FingeringPatternControls`, `ChordOverlayControls`, `ProgressionControls`, and
  `ScaleSelector` — it is not mobile-only and must survive Phase 7.

---

## 2. Goals and Non-Goals

### Goals

- Bring the remaining surfaces (top band, transport, progression integration, mobile)
  in line with the DAW visual language and the Inspector tab architecture.
- Eliminate the desktop/mobile controls duplication so there is one controls code path.
- Make the progression workflow first-class: edit a progression chord directly from the
  DAW track via the Chord tab.

### Non-Goals

- No changes to music theory, audio synthesis, or the fretboard SVG renderer.
- No new Jotai atoms for existing behavior — phases relocate rendering, not domain logic.
  The only additions are in Phase 5: one selection atom and an orange accent token set.
- The exact mobile tab placement in Phase 7 is explicitly deferred to a dedicated
  sub-brainstorm (see Phase 7).

---

## 3. Execution Order

Phases 5 and 6 both modify `ProgressionTrack.tsx`. To avoid two phases competing for the
same file, the transport extraction (Phase 6) runs **before** the progression
integration (Phase 5). Phase numbers keep their original identity; only the build order
is resequenced:

**Build order: Phase 4 → Phase 6 → Phase 5 → Phase 7.**

Each phase ships independently as its own PR and its own implementation plan, and each
leaves the app in a working, releasable state.

---

## 4. Phase 4 — TopBandSummary reskin + View/Scale tab leaf refactors

**Goal:** Reskin `TopBandSummary` into the DAW faceplate language, and finalize the View
and Scale tab content by migrating the remaining notation/view switches into the
Inspector.

### 4a. TopBandSummary reskin

This is a **reskin, not a restructure**. The component keeps its content
(`DegreeChipStrip` + optional `ChordPracticeBar`) and DOM structure; only the styling
changes.

- Apply DAW faceplate chrome to `TopBandSummary.module.css` to match `Inspector.module.css`:
  navy substrate, cyan border (`rgb(77 228 255 / 0.12)`), cyan radial wash, uppercase
  micro-labels with letter-spacing, glow tokens (`--glow-cyan-sm`).
- Remove the dead `progressionEnabled` branch (lines ~96-155 of `TopBandSummary.tsx`) and
  its now-unused imports/hooks (`useProgressionState`, `useProgressionPlaybackLoop`,
  `findNextResolvableStepIndex`, `formatProgressionDurationLabel`, and the
  progression-status CSS rules). The slot already guarantees this component only renders
  when progression is off.
- No change to `DegreeChipStrip` or `ChordPracticeBar` internals beyond styling tokens.

### 4b. View tab leaf refactor

- Move the **Accidentals**, **Enharmonic display**, and **Scale-degree-colors** switches
  out of `SettingsOverlay` (`NotationSettingsSection.tsx`, `ViewSettingsSection.tsx`) and
  into `ViewTab` (`src/components/Inspector/ViewTab.tsx`).
- These switches bind to existing atoms (e.g. `enharmonicDisplayAtom`, accidental and
  scale-degree-color atoms). **Atoms are unchanged** — only the rendering location moves.
- The corresponding rows are removed from the SettingsOverlay sections. If a section
  becomes empty, remove the section; otherwise leave the remaining rows.

### 4c. Scale tab leaf refactor

- Add the **chord-type-for-scale chip row** to `ScaleTab`
  (`src/components/Inspector/ScaleTab.tsx`) — the control that picks which chord type the
  scale degrees are evaluated against. It binds to its existing atom; this is a relocation
  /addition of the control into the tab, not new domain logic.

### Data flow

All controls in 4b/4c subscribe directly to their existing Jotai atoms, exactly as they
do in `SettingsOverlay` today. No prop drilling, no new atoms.

### Testing

- `TopBandSummary.test.tsx` — assert the degree chip strip still renders and the
  `ChordPracticeBar` still appears when chord practice is on; assert the dead progression
  branch is gone (no `progression-status` test id).
- `ViewTab.test.tsx` — extend to assert the Accidentals / Enharmonic / Scale-degree-color
  switches render and toggle their atoms.
- `ScaleTab.test.tsx` — extend to assert the chord-type chip row renders and updates its
  atom.
- `SettingsOverlay` tests — update to reflect the removed rows.
- Visual regression — refresh darwin + linux baselines for `app-layout`, `app-components`,
  and any `TopBandSummary` snapshot.

### Acceptance criteria

- `TopBandSummary` visually matches the Inspector faceplate; no progression-status code
  path remains in it.
- The View tab shows the notation/view switches; the Scale tab shows the chord-type chip
  row; both no longer appear in `SettingsOverlay`.
- `npm run lint`, `npm run test`, `npm run build` pass.

---

## 5. Phase 6 — Extract TransportBar

**Goal:** Pull the transport row out of `ProgressionTrack` into a standalone, DAW-styled
`TransportBar` component.

### Components

- **New:** `src/components/TransportBar/TransportBar.tsx` — the play / pause / stop / loop
  controls plus the strum / bass / drums / metronome feature toggles, moved verbatim from
  `ProgressionTrack.tsx`. It subscribes to the same atoms/hooks the transport row uses
  today (`progressionPlaying`, `progressionPlaybackBlockedReason`, loop, and the
  feature-toggle atoms).
- **New:** `src/components/TransportBar/TransportBar.module.css` — DAW faceplate chrome.
  The `transportButton` / `transportCluster` styles move here from
  `ProgressionTrack.module.css` and are restyled with cyan accent + glow; active feature
  toggles keep their accent treatment.
- **Modified:** `ProgressionTrack.tsx` — renders `<TransportBar />` in place of the inline
  transport row. The timeline, playhead, and position readout stay in `ProgressionTrack`.

### Data flow

`TransportBar` is self-contained: it reads and writes the playback atoms directly. No new
props beyond what the extracted JSX already needed. No new atoms.

### Testing

- `TransportBar.test.tsx` (new) — play/pause toggles state, stop resets, loop toggles, and
  each feature toggle (strum/bass/drums/metronome) flips its atom; blocked-playback reason
  disables play.
- `ProgressionTrack.test.tsx` — update to assert it renders `<TransportBar />` and that the
  timeline/playhead/readout are unaffected.
- Visual regression — refresh baselines for any suite that captures the progression track.

### Acceptance criteria

- Transport controls behave identically to before the extraction.
- `ProgressionTrack` no longer contains transport JSX or transport CSS.
- `TransportBar` carries DAW faceplate chrome.
- `npm run lint`, `npm run test`, `npm run build` pass.

---

## 6. Phase 5 — Progression integration

**Goal:** Make the progression workflow first-class inside the Inspector: host
`ProgressionControls` in the Progression tab, and let the Chord tab edit the selected
progression chord directly from the DAW track.

### 6a. Progression tab body

- Replace the `progression: () => null` placeholder in `Inspector.tsx`'s `TAB_BODIES` map
  with a `ProgressionTab` body that renders `ProgressionControls`.
- **New:** `src/components/Inspector/ProgressionTab.tsx` (+ `.module.css`, `.test.tsx`),
  following the `ViewTab` / `ScaleTab` / `ChordTab` pattern — a thin wrapper tagged
  `data-inspector-tab="progression"`.
- `ProgressionControls` is reused as-is; no changes to its internals.

### 6b. Selected-chord callout on the Chord tab

A new callout sits above `ChordOverlayControls` in `ChordTab`. Its content and accent are
contextual:

- **Progression OFF** — the Chord tab uses the standard **cyan** accent. The callout shows
  a readout of the current standalone chord overlay (root, quality, member notes).
  `ChordOverlayControls` edits the overlay exactly as today.
- **Progression ON** — the user selects a chord by **clicking a chord block on the
  `ProgressionTrack` (DAW timeline)**. That sets the active progression step. The Chord
  tab then:
  - switches its accent from **cyan to orange** (`active` state),
  - shows the callout as a readout of the selected progression step (its degree, resolved
    chord label, duration, bar position),
  - rewires `ChordOverlayControls` to edit **that progression step** instead of the
    standalone overlay,
  - exposes **Duplicate** and **Remove** buttons in the callout that act on the selected
    step (Duplicate inserts a copy after it; Remove deletes it from the progression).

### 6c. Selection state and the orange accent

- **New atom:** `selectedProgressionChordAtom` (in `src/store/chordOverlayAtoms.ts` or
  `progression`-domain atoms) — holds the index of the progression step currently being
  edited, or `null`. Clicking a chord block in `ProgressionTrack` sets it; clearing the
  selection or disabling progression resets it to `null`.
- **New token set:** an orange "active" accent mirroring the cyan glow tokens, added to
  `src/styles/tokens.css` — e.g. `--neon-orange`, `--neon-orange-dim`, `--glow-orange-sm`.
  Reuse the existing cyan glow scale shape so the two accents are visually consistent.
- The Chord tab's CSS switches the accent via a data attribute or class driven by whether
  `selectedProgressionChordAtom` is non-null and progression is on.

### Data flow

```
ProgressionTrack chord block click
  -> sets selectedProgressionChordAtom (step index)
  -> ChordTab reads selectedProgressionChordAtom + progressionEnabledAtom
       - non-null & enabled  -> orange accent, callout = selected step,
                                 ChordOverlayControls bound to that step
       - null or disabled    -> cyan accent, callout = standalone overlay
  -> Duplicate / Remove dispatch progression-edit actions on the selected index
```

`ChordOverlayControls` gains a mode/target prop (or reads the selection atom) so it can
target either the standalone overlay or the selected progression step. Keep its public
API minimal — prefer reading the atom internally over deep prop drilling, consistent with
the codebase's atomic-reactivity convention.

### Testing

- `ProgressionTab.test.tsx` (new) — renders `ProgressionControls` under
  `data-inspector-tab="progression"`.
- `Inspector.test.tsx` — assert the Progression tab body is populated when progression is
  enabled.
- `ChordTab.test.tsx` — assert: (1) progression off → cyan accent, callout shows the
  standalone overlay; (2) progression on with a selected step → orange accent, callout
  shows that step, Duplicate/Remove present and dispatch the right edits.
- `ProgressionTrack.test.tsx` — assert clicking a chord block sets
  `selectedProgressionChordAtom`.
- Visual regression — refresh baselines for the Inspector (Chord tab cyan vs. orange,
  Progression tab populated).

### Acceptance criteria

- The Progression tab shows the full `ProgressionControls` editor.
- With progression on, clicking a DAW-track chord block turns the Chord tab orange and
  edits that step; Duplicate/Remove work; clearing selection returns it to cyan.
- With progression off, the Chord tab behaves exactly as in Phase 3 (cyan, standalone
  overlay).
- `npm run lint`, `npm run test`, `npm run build` pass.

---

## 7. Phase 7 — Mobile rehost (high-level)

**Goal:** Remove the mobile-specific controls duplication and unify mobile on the
Inspector.

### Scope

- Delete `src/components/MobileTabPanel/`, `src/components/BottomTabBar/`, and
  `src/components/Card/` (Card is used only by `MobileTabPanel`).
- **Keep `ToggleBar`** — it is shared by Inspector leaf controls and is not mobile-only.
  (`TheoryControls` is already deleted; nothing to do there.)
- Mobile renders the Inspector instead of `MobileTabPanel`. `App.tsx`'s `mobileTabs` slot
  wiring is updated accordingly.

### Deferred sub-brainstorm

The **exact mobile tab placement** — whether the Inspector's Radix tab triggers render
inline at the top (as on desktop) or as a bottom-docked, thumb-reachable tab bar — is a
genuine mobile-ergonomics question and is **deferred to a dedicated sub-brainstorm** when
Phase 7 begins. That sub-brainstorm produces its own spec and plan. This spec commits
only to: "remove the mobile-specific components, unify on the Inspector."

### Acceptance criteria (for the high-level phase)

- No `MobileTabPanel`, `BottomTabBar`, or `Card` remain; `ToggleBar` is intact.
- Mobile controls are served by the Inspector.
- `npm run lint`, `npm run test`, `npm run build` pass.
- Detailed mobile-layout acceptance criteria come from the Phase 7 sub-brainstorm spec.

---

## 8. Cross-Phase Notes

- Each phase is its own PR with its own implementation plan and its own visual-regression
  baseline refresh.
- The cyan DAW chrome already exists in `tokens.css`; only Phase 5 adds new tokens (the
  orange accent set).
- After Phase 4 removes switches from `SettingsOverlay`, audit the overlay for empty
  sections and remove them.
- Mandatory before every PR: `npm run lint`, `npm run test`, `npm run build`
  (per `CLAUDE.md`).

## 9. Spec recovery note

This spec is itself now tracked in git (`.gitignore` was narrowed from `docs/` to
`docs/*` with a `!docs/superpowers/` negation, commit `1adfb36b`), so it will not be lost
the way its predecessor was.
