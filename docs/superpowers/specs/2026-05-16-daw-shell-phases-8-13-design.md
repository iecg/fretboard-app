# DAW Shell Redesign — Phases 8-13 Design

**Status:** Brainstorm spec. Produced 2026-05-16 from the `FretFlow DAW.html` design
handoff bundle (a Claude Design export) and a fresh region-by-region gap analysis against
the current codebase.

**Date:** 2026-05-16

**Scope:** Phases 8-13 of the DAW shell redesign — closing the remaining gap between the
shipped app and the `FretFlow DAW.html` design. Phases 1-7 are shipped.

---

## 1. Background

The DAW shell redesign reshapes FretFlow's UI into a "digital audio workstation" visual
language: a navy faceplate substrate, a cyan accent (`--neon-cyan #4DE4FF`), an orange
"active" accent (`--neon-orange #FF9A4D`), cyan glow shadows, and a tabbed `Inspector`.

This spec continues that sequence. It is driven by a design handoff — `FretFlow DAW.html`
plus its `src/daw/*` modules — exported from Claude Design. The handoff is a holistic
mockup of the whole app; phases 1-7 already implemented most of its structure. A
region-by-region gap analysis of the mockup against the codebase identified the remaining
deltas, which this spec turns into phases 8-13.

### Shipped (Phases 1-7 — do not redo)

- **Phases 1-3** — the `Inspector` (`src/components/Inspector/`), a Radix Tabs panel with
  View / Scale / Chord / Progression tabs and DAW faceplate chrome.
- **Phase 4** — `TopBandSummary` reskinned to the faceplate; the Accidentals / Enharmonic /
  Scale-degree-color switches moved from `SettingsOverlay` into the View tab.
- **Phase 6** — `TransportBar` extracted from `ProgressionTrack`.
- **Phase 5** — progression integration: the Progression tab populated with
  `ProgressionControls`; the Chord tab edits the selected progression chord; the cyan/orange
  accent system + the selected-progression-chord selection atom.
- **Phase 7** — mobile and `tablet-split` unified on the `Inspector` with a bottom-docked
  icon+label tab bar (`placement="bottom"`).

### Current state relevant to Phases 8-13

- The four Inspector tab bodies (`ViewTab`, `ScaleTab`, `ChordTab`, `ProgressionTab` in
  `src/components/Inspector/`) are thin wrappers that stack their leaf controls
  (`FingeringPatternControls`, `FretRangeControl`, `ToggleBar`s, `ScaleSelector`,
  `ChordOverlayControls`, `ProgressionControls`) as vertical `shared["control-section"]`
  lists. There is no grid layout and no group-header structure.
- `ProgressionSummarySlot` renders `ProgressionTrack` when `progressionEnabledAtom` is true,
  otherwise `TopBandSummary`. The two are mutually exclusive. `App.tsx` mounts the slot via
  `summary={<ProgressionSummarySlot />}`; `MainLayoutWrapper` places it in the
  `summary-shell`, a stacked band between the header and the fretboard.
- `TopBandSummary` renders `DegreeChipStrip` (the scale strip) plus an animated
  `ChordPracticeBar` (gated by `showChordPracticeBarAtom`).
- `ProgressionTrack` hosts the DAW timeline, playhead, position readout, the extracted
  `TransportBar`, **and** an `.accompanimentControls` block (genre / chord instrument /
  chord pattern / bass pattern / drum pattern / swing — `ProgressionTrack.tsx` lines
  ~131-196).
- There is **no bottom status bar** anywhere in the app.
- `AppHeader` has a transparent background (deliberate, per a code comment in
  `AppHeader.module.css`), the brand glyph is a bare SVG, the subtitle copy is
  "Interactive Fretboard & Music Theory", and the utility buttons use the shared
  `icon-button` class.
- Every control surface this spec touches binds to an atom that **already exists**. The
  full atom inventory was confirmed during the brainstorm; see each phase's "Data flow".

### Decisions carried into this spec

The handoff design and the codebase diverge in three places where the codebase reflects
*later* product decisions than the mockup. These were resolved with the user before this
spec was written:

- **Transport / chord-track presence — keep the current mode-swap.** The mockup shows the
  transport bar and chord track as permanent chrome. The codebase swaps the top band
  (`TopBandSummary` ↔ `ProgressionTrack` via `ProgressionSummarySlot`) on
  `progressionEnabledAtom`, per decisions made in earlier design chats. **This spec keeps
  the mode-swap.** The "always-on transport" gap is *not* in scope.
- **Lens panel — match the design (floating overlay).** The scale/chord lens content moves
  from the stacked band to a panel floating over the fretboard (Phase 13a).
- **Token palette — keep the current tokens.** The mockup uses cyan `#5cd9f5` /
  orange `#ff9d56`; the codebase uses `#4DE4FF` / `#FF9A4D`, which feed the
  `modern-light` theme and the committed visual-regression baselines. **No global token
  recolor.** Phases match the design's *layout and structure*, not its exact hexes.

### Descoped — CAGED Span / String Set

The mockup's Chord tab shows **CAGED Span** and **String Set** voicing controls. They have
no atoms, no fretboard support, and are inert even in the mockup (the mockup's fretboard
never reads that state). Per the precedent in
`2026-05-15-daw-shell-phases-4-7-design.md` §4c — undefined new functionality gets its own
brainstorm, not a parity pass — **both controls are descoped.** Phase 10 gives the Chord
tab the full grid layout and every control that maps to real state, minus those two. If
voicing-by-string-set is wanted, it needs its own spec.

---

## 2. Goals and Non-Goals

### Goals

- Restructure the four Inspector tab bodies from stacked `control-section` lists into
  dense DAW property-grids with group headers — closing the "oversized control tabs" gap.
- Add the bottom status bar.
- Relocate the scale/chord lens into a panel floating over the fretboard.
- Polish the remaining chrome to the design: brand tile, "Fretboard Studio" kicker, round
  utility buttons, Inspector label + pill tabs, chord-clip styling.

### Non-Goals

- No changes to music theory, audio synthesis, or the fretboard SVG renderer.
- No global design-token recolor (see Decisions).
- No always-on transport / chord-track (see Decisions).
- No CAGED Span / String Set voicing controls (see Descoped).
- **No new persisted atoms.** Every interactive control in phases 8-13 binds to an atom
  that already exists. The Scale-tab Theory facts (Phase 9) are derived read-only from
  existing atoms and the `@fretflow/core` theory API. The status bar (Phase 12) is a pure
  read-out. Phases relocate and re-lay-out rendering; they do not add domain state.

---

## 3. Execution Order

Build phases in numeric order, **8 → 9 → 10 → 11 → 12 → 13**. Each phase ships as its own
PR with its own implementation plan and its own visual-regression baseline refresh, and
each leaves the app working and releasable.

- Phase 8 must precede 9-11 — it introduces the shared grid primitives the other tab
  phases consume.
- Phases 12 and 13 both modify `MainLayoutWrapper`; phases 11 and 13 both modify
  `ProgressionTrack`. Because each phase ships before the next begins, there is no
  concurrent file contention.

---

## 4. Phase 8 — Inspector property-grid primitives + View tab

**Goal:** Introduce the property-grid layout primitives, then convert the View tab into a
dense 6-column property grid.

### 8a. Grid primitives (new)

New layout-only primitives, co-located with the Inspector. Proposed module:
`src/components/Inspector/InspectorGrid.tsx` (+ `.module.css`, `.test.tsx`) — the exact
file split is a plan decision.

- **`PropGrid`** — a CSS-grid container. Prop `columns` (default `6`). Renders
  `display: grid; grid-template-columns: repeat(columns, minmax(0, 1fr))` with a consistent
  gap.
- **`Prop`** — a labeled grid cell. Props `label`, `span` (default `1`), `hint`. Renders an
  uppercase mono micro-label, the control (`children`), and an optional terse hint.
- **`GroupHeader`** — a full-width grid row (spans all columns): a cyan uppercase mono
  label + a hairline rule, with optional right-aligned content (e.g. action buttons).
- **`ToggleProp`** — an inline label-left / `Switch`-right row for boolean toggles, with an
  optional state word (e.g. "CAGED" / "Scattered"). Used by the DISPLAY group.

These carry no domain state. The CSS module uses the existing `--faceplate-*`, `--dc-*`,
and `--font-mono` tokens. The mockup's `Segmented` control maps to the existing `ToggleBar`
(it already renders a segmented button group) — **no new segmented primitive is needed.**

### 8b. View tab → 6-column property grid

`ViewTab` becomes a `PropGrid columns={6}` with three `GroupHeader` groups:

- **FINGERING** — Pattern (`ToggleBar` → `fingeringPatternAtom`), Shape + the per-pattern
  conditional sub-controls (3NPS Position/Octave, one-string String/Connectors, two-string
  Strings/Interval), Fret Range (`FretRangeControl` → `fretStartAtom`/`fretEndAtom`).
- **LABELS** — Note Labels (`ToggleBar` → `displayFormatAtom`), Accidentals (`ToggleBar` →
  `accidentalModeAtom`), Enharmonic (`ToggleBar` → `enharmonicDisplayAtom`).
- **DISPLAY** — three `ToggleProp` rows: Degree Colors (`scaleDegreeColorsEnabledAtom`),
  Full Chords (`fullChordsEnabledAtom`), Tap to Play (`isMutedAtom`, inverted, written via
  `toggleMuteAtom`).

`FingeringPatternControls` is refactored so its sub-controls render as `Prop` cells inside
the View tab's grid; it currently renders its own `control-section` wrappers. **Its
conditional per-pattern sub-controls are kept** — the View tab is deliberately denser and
more functional than the mockup's static `ViewPanel`. The Note-Labels control moves out of
`FingeringPatternControls` into the LABELS group. Verbose `field-hint` paragraphs are
replaced by terse `Prop` `hint` strings.

**Full Chords appears on two surfaces.** The mockup places Full Chords in both the View
tab DISPLAY group and the Chord tab VOICING group. This is intentional and harmless — both
bind the single `fullChordsEnabledAtom`. Full Chords is added to the View tab DISPLAY group
here and **remains** in the Chord tab (Phase 10).

### Data flow

All controls subscribe directly to their existing Jotai atoms, exactly as they do today.
No prop drilling, no new atoms.

### Testing

- `InspectorGrid.test.tsx` (new) — `PropGrid` applies the column count; `Prop` renders
  label/hint and honors `span`; `GroupHeader` spans all columns; `ToggleProp` toggles its
  bound value and shows the state word.
- `ViewTab.test.tsx` — extend: the three groups render; every control still toggles its
  atom; the DISPLAY group's Full Chords and Tap-to-Play rows are present and bound.
- `FingeringPatternControls.test.tsx` — update for the grid-cell render shape; conditional
  sub-controls still appear per pattern.
- Visual regression — refresh darwin + linux baselines for `app-components` and
  `app-layout`.

### Acceptance criteria

- The View tab renders as a 6-column property grid with FINGERING / LABELS / DISPLAY group
  headers.
- All View-tab controls behave identically to before; the DISPLAY group's three toggles
  drive `scaleDegreeColorsEnabledAtom`, `fullChordsEnabledAtom`, and the mute atom.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 5. Phase 9 — Scale tab → 3-column property grid

**Goal:** Convert the Scale tab to the mockup's 3-column layout: Key picker, Theory facts,
key wheel.

### 9a. Layout

`ScaleTab` becomes a 3-column grid (the mockup uses a `5fr / 4fr / 3fr` split):

- **Column 1 — Key.** The root picker (`NoteGrid` → `rootNoteAtom`) and the Family /
  Variant steppers (`StepperSelect` → `scaleNameAtom`). The existing Parallel/Relative
  `ToggleBar` (`scaleBrowseModeAtom`) is **kept** — it is a real codebase feature not in
  the mockup — and placed in this column.
- **Column 2 — Theory facts.** A new read-only readout (see 9b).
- **Column 3 — Wheel.** The existing `CircleOfFifths`, fitted into the column. The mockup's
  `KeyWheel` is a read-only mini-wheel; the codebase's `CircleOfFifths` is interactive and
  richer, so it is **kept** rather than replaced.

`ScaleSelector` is refactored to render its controls as grid cells; its atom wiring is
unchanged.

### 9b. Theory facts column (new read-only display)

A read-only facts panel showing, for the active root + scale:

- **Notes** — the scale's note names, from `scaleNotesAtom` (root highlighted).
- **Intervals** — interval names, from `degreeChipsAtom` (already derives per-note interval
  via `@fretflow/core` `INTERVAL_NAMES`).
- **Degrees** — diatonic roman-numeral labels, from `degreeChipsAtom` (already derives them
  via `getDegreesForScale`).
- **Tones** — the tone count, `scaleNotesAtom.length`.
- **Key Sig** and **Parent** — derived best-effort from the existing
  `src/core/circleOfFifthsUtils.ts` data and `@fretflow/core`'s `getActiveScaleBrowseOption`
  (the relative-key resolver `ScaleSelector` already uses). If a clean derivation is not
  available from existing utilities, **these two facts are omitted** — no new core theory
  logic is written. (The mockup hardcodes both as placeholders.) This is the one
  resolve-during-implementation item; the Phase 9 plan makes the call.

This panel is pure derived display: it adds **no atoms**. New label strings ("Notes",
"Intervals", "Degrees", "Key Sig", "Parent", "Tones") go through `useTranslation`.

### Data flow

`scaleNotesAtom`, `degreeChipsAtom`, `scaleLabelAtom`, `rootNoteAtom`, `scaleNameAtom`,
`scaleBrowseModeAtom` — all existing. No new atoms.

### Testing

- `ScaleTab.test.tsx` — the 3 columns render; the root picker and Family/Variant steppers
  drive their atoms; the Theory facts column shows the correct Notes/Intervals/Degrees for
  a known root+scale; the Circle of Fifths still renders.
- `ScaleSelector.test.tsx` — update for the grid-cell render shape.
- Visual regression — refresh `app-components`, `app-layout` baselines.

### Acceptance criteria

- The Scale tab is a 3-column grid: Key picker, Theory facts, Circle of Fifths.
- The Theory facts column shows accurate Notes / Intervals / Degrees / Tones; Key Sig and
  Parent appear if cleanly derivable, else are omitted.
- Root, Family, Variant, and Parallel/Relative still drive their atoms.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 6. Phase 10 — Chord tab → 6-column property grid

**Goal:** Convert the Chord tab to the mockup's 6-column grid with SOURCE / CHORD TYPE /
VOICING groups.

### 10a. Layout

`ChordTab` / `ChordOverlayControls` becomes a `PropGrid columns={6}`:

- **SOURCE** — Mode (`ToggleBar` Degree/Manual → `chordOverlayModeAtom`), Degree
  (`ToggleBar` → `chordDegreeAtom`), Lens (`ToggleBar` → `practiceLensAtom`). Manual mode
  keeps its chord-root `NoteGrid` (`chordRootOverrideAtom`).
- **CHORD TYPE** — the 15-cell chord-quality grid (see 10b), bound to
  `chordQualityOverrideAtom`.
- **VOICING** — two `ToggleProp` rows: Full Chords (`fullChordsEnabledAtom`) and Show on
  Board (`chordOverlayHiddenAtom`, inverted). CAGED Span / String Set are **not** added
  (descoped).

### 10b. 15-cell chord-type grid

The chord-quality selector currently renders as a horizontally scrolling `ToggleBar`
(`overflow="scroll"`). It becomes a fixed wrapping grid of all 15 chord types. Implement
either as a new `grid` layout option on `ToggleBar` or a thin grid wrapper around the
existing buttons — a plan decision. No change to the chord-type option set or atom.

### 10c. Accent preservation

Phase 5's cyan/orange accent on the Chord tab — cyan for the standalone overlay, orange
when a progression chord is selected from the DAW track — **must survive the restructure.**
The grid and its `GroupHeader`s inherit the accent via the existing data-attribute/class
mechanism driven by the selected-progression-chord atom + `progressionEnabledAtom`.

### Data flow

`chordOverlayModeAtom`, `chordDegreeAtom`, `chordQualityOverrideAtom`,
`chordRootOverrideAtom`, `fullChordsEnabledAtom`, `practiceLensAtom`,
`chordOverlayHiddenAtom`, plus the Phase 5 selection atom — all existing. No new atoms.

### Testing

- `ChordTab.test.tsx` / `ChordOverlayControls.test.tsx` — the 3 groups render; Mode toggles
  Degree↔Manual and swaps the SOURCE controls; the 15-cell grid selects a chord type; the
  VOICING toggles drive `fullChordsEnabledAtom` and `chordOverlayHiddenAtom`; the cyan↔orange
  accent still switches with progression-chord selection.
- Visual regression — refresh `app-components` (Chord tab cyan and orange states).

### Acceptance criteria

- The Chord tab is a 6-column grid with SOURCE / CHORD TYPE / VOICING groups.
- Chord type renders as a 15-cell grid, not a scrolling bar.
- Show on Board drives `chordOverlayHiddenAtom`; the cyan/orange accent is preserved.
- No CAGED Span / String Set controls exist.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 7. Phase 11 — Progression tab → property grid + backing-track rehost

**Goal:** Convert the Progression tab to the grid, and move the backing-track controls out
of `ProgressionTrack` into the Progression tab.

### 11a. Layout

`ProgressionTab` / `ProgressionControls` becomes a `PropGrid columns={6}`:

- **Meter row** (full-width) — Beats/Bar (`StepperControl` → `beatsPerBarAtom`), Preset
  (`LabeledSelect` → `currentProgressionPresetIdAtom`), Length (read-only —
  `totalProgressionBarsAtom`), Loop (`Switch` → `progressionLoopEnabledAtom`). The
  Progression Mode switch (`progressionEnabledAtom`) is **kept** — it is how the whole
  progression workflow is enabled — placed in or beside the meter row.
- **CHORDS** group — the chord list (`span 3`) beside the selected-chord editor (`span 3`,
  degree / duration / quality). Functionally unchanged from `ProgressionControls`; only
  re-laid into the two-column grouping.
- **BACKING TRACK** group — see 11b.

### 11b. Backing-track rehost

The `.accompanimentControls` block in `ProgressionTrack.tsx` (lines ~131-196) moves into
the Progression tab's BACKING TRACK group: Genre (`progressionGenreStyleAtom` /
`applyGenreStyleAtom`), Chord instrument (`progressionChordInstrumentAtom`), Chord pattern
(`progressionChordPatternAtom`), Bass pattern (`progressionBassPatternAtom`), Drum pattern
(`progressionDrumPatternAtom`), Swing (`progressionSwingAtom`). This matches the design
chat's explicit request to move the backing-track options to the Progression tab.

`ProgressionTrack` keeps the timeline, playhead, position readout, and `TransportBar`; it
loses the accompaniment row and its associated CSS (`.accompanimentControls`,
`.genreSelect`, `.instrumentSelect`, `.patternSelect`, `.swingControl`).

### Data flow

All progression and accompaniment atoms already exist (`progressionAtoms.ts`). No new
atoms; this is a relocation of rendering plus a re-layout.

### Testing

- `ProgressionTab.test.tsx` / `ProgressionControls.test.tsx` — the grid, the meter row, the
  CHORDS group (list + editor), and the BACKING TRACK group all render; each backing-track
  control drives its atom; Length reflects `totalProgressionBarsAtom`.
- `ProgressionTrack.test.tsx` — assert the accompaniment controls are gone and the
  timeline/playhead/readout/transport are unaffected.
- Visual regression — refresh `app-components`, `app-overlays` (progression track + tab).

### Acceptance criteria

- The Progression tab is a property grid with a meter row, a CHORDS group (list + editor),
  and a BACKING TRACK group.
- The backing-track controls live in the Progression tab and no longer in `ProgressionTrack`.
- All progression editing and accompaniment behavior is unchanged.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 8. Phase 12 — Status bar

**Goal:** Add the bottom mono status strip.

### Components

- **New:** `src/components/StatusBar/StatusBar.tsx` (+ `.module.css`, `.test.tsx`) — a
  single-line mono strip reading: **Key** (`rootNoteAtom` + `scaleNameAtom`), **Chord**
  (the active chord's degree + resolved label), **Lens** (`practiceLensAtom` label),
  **Pattern** (`fingeringPatternAtom` + CAGED shape), **Frets** (`fretStartAtom`–
  `fretEndAtom`), **Tempo** (`progressionTempoBpmAtom`), **Tuning** (`tuningNameAtom`),
  and a "FretFlow Studio" version tag. The existing `VersionBadge` component is reused for
  the version tag.
- **Modified:** `MainLayoutWrapper` gains a `statusBar` slot, rendered as the final child
  of `.app-container`. `App.tsx` passes `<StatusBar />` into it.
- **Modified:** `src/layout/responsive.ts` — a `showStatusBar` flag, true on the `desktop`
  and `tablet` tiers, false on the `mobile` tier and the `tablet-split` variant (where the
  viewport-fixed bottom Inspector tab bar already occupies the bottom edge). Mirrors the
  existing `showControlsPanel` / `showMobileTabs` pattern.

### Data flow

All values are read from existing atoms — the status bar is a pure read-out. No new atoms,
no writes. New label strings go through `useTranslation`.

### Testing

- `StatusBar.test.tsx` (new) — renders each field; reflects atom changes (change the root,
  the fret range, the pattern → the strip updates).
- App / layout tests — the status bar renders on desktop/tablet and is absent on mobile +
  `tablet-split`.
- Visual regression — refresh `app-layout` baselines; confirm `app-mobile` is unaffected.

### Acceptance criteria

- A bottom status bar shows Key · Chord · Lens · Pattern · Frets · Tempo · Tuning + the
  version tag on desktop and tablet.
- It is absent on the mobile tier and `tablet-split` variant.
- Values track their atoms live.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 9. Phase 13 — Lens floating overlay + chrome polish

**Goal:** Relocate the scale/chord lens to a floating overlay, and finish the remaining
chrome polish.

### 13a. Lens floating overlay

`TopBandSummary` moves from the stacked `summary-shell` to a panel that **floats over the
top of the fretboard**: a blurred backdrop (`backdrop-filter: blur(...)`), faceplate
border, centered horizontally near the top of the fretboard region.

- The `.main-fretboard` region becomes the positioning context (`position: relative`); the
  overlay is absolutely positioned within it.
- The `ProgressionSummarySlot` mode-swap is **preserved**: in progression mode
  `ProgressionTrack` renders where it does today; in scale mode `TopBandSummary` renders as
  the floating overlay instead of the stacked band. `MainLayoutWrapper`'s `summary-shell`
  is removed (or repurposed) for the scale-mode path; the progression-mode path is
  unaffected.
- `DegreeChipStrip` and `ChordPracticeBar` internals are unchanged — including the
  per-note eye toggles and the `ChordPracticeBar` visibility gate (`chordOverlayHiddenAtom`,
  which the Phase 10 "Show on Board" toggle also drives). Only `TopBandSummary`'s placement
  and container styling change.
- **Deviation from the mockup, flagged for review:** the mockup gates the lens panel on the
  Chord/Progression *inspector tabs*. This spec keeps the overlay visible whenever
  `TopBandSummary` renders today (i.e. in scale mode, regardless of the active inspector
  tab). Tab-gating would hide the scale strip on the View and Scale tabs — a usability
  regression and a behavior change beyond the "floating overlay" decision the user made.
  If tab-gating is actually wanted, say so at spec review.
- Mobile: the overlay must not occlude the fretboard on small viewports — on the `mobile`
  tier it may fall back to a stacked placement. The Phase 13 plan settles the mobile
  treatment.

### 13b. Chrome polish

- **`AppHeader`** — the brand glyph sits in a rounded tile with an orange-tinted border; the
  subtitle becomes a "Fretboard Studio" uppercase mono kicker (replacing the current
  "Interactive Fretboard & Music Theory" copy); the three utility buttons become round
  (not rounded-square). The header background stays transparent (deliberate per the
  existing code comment) unless review decides otherwise.
- **Inspector `TabBar`** — add an "Inspector" uppercase mono label before the tab triggers;
  the top-placement tabs become rounded pills with a cyan fill when active, replacing the
  current bottom-underline indicator. The bottom-placement (mobile) tab bar from Phase 7 is
  unchanged.
- **`ProgressionTrack`** — chord blocks become discrete rounded clips (currently a
  continuous lane with shared dividers); the playhead marker becomes a diamond (currently a
  triangular arrowhead).

13a and 13b are independent; if Phase 13 proves large it may ship as two PRs (13a, 13b),
consistent with "each phase ships releasable."

### Data flow

No atom changes. Pure placement, styling, and copy changes.

### Testing

- `TopBandSummary.test.tsx` — renders in the floating-overlay container; `DegreeChipStrip`
  and `ChordPracticeBar` still render and toggle.
- App / layout tests — scale mode shows the floating lens overlay; progression mode shows
  `ProgressionTrack` unchanged.
- `AppHeader.test.tsx`, `Inspector.test.tsx`, `ProgressionTrack.test.tsx` — updated for the
  new chrome.
- Visual regression — refresh `app-layout`, `app-components`, `app-overlays`, and
  `fretboard-svg` (lens overlay over the board) baselines, darwin + linux.

### Acceptance criteria

- In scale mode the scale/chord lens renders as a blurred panel floating over the
  fretboard; progression mode is unchanged.
- The header shows the brand tile, the "Fretboard Studio" kicker, and round utility
  buttons; the Inspector shows an "Inspector" label and pill tabs; progression chord blocks
  are rounded clips with a diamond playhead.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 10. Cross-Phase Notes

- Each phase is its own PR with its own implementation plan and its own visual-regression
  baseline refresh (darwin + linux). Suites likely touched: `app-components`, `app-layout`,
  `app-overlays`, `app-mobile`, `fretboard-svg`.
- Mandatory before every PR: `pnpm run lint`, `pnpm run test`, `pnpm run build` (per
  `CLAUDE.md`).
- The leaf controls (`FingeringPatternControls`, `ScaleSelector`, `ChordOverlayControls`,
  `ProgressionControls`) are refactored in place across phases 8-11; their **atom wiring is
  unchanged** — only their render output becomes grid-based.
- New UI strings (group-header labels, status-bar field labels, theory-fact labels) go
  through the `useTranslation` dictionary, following the existing `inspector.*` /
  `settings.*` key conventions.
- `ToggleBar` is reused as the segmented control throughout; it is not replaced.
- This spec is committed to git under `docs/superpowers/specs/`, consistent with the
  phases-4-7 spec.

## 11. Recorded Descopes

For traceability — items present in the `FretFlow DAW.html` mockup that are deliberately
**not** implemented by this spec:

- **Always-on transport bar + chord track** — the codebase's progression-mode-swap is kept
  (user decision). 
- **Token recolor to the mockup's hexes** — the codebase tokens are kept; they feed the
  light theme and visual baselines (user decision).
- **CAGED Span / String Set voicing controls** — undefined new functionality with no atoms
  or fretboard support; deferred to its own brainstorm (phases-4-7 spec §4c precedent).

Each, if wanted later, needs its own brainstorm → spec → plan cycle.
