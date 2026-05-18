# DAW Voicing Engine + Parity Fixes — Design

**Status:** Brainstorm spec. Produced 2026-05-18 from a re-handoff of the `FretFlow DAW.html`
Claude Design bundle plus two region-by-region parity audits against the shipped app.

**Date:** 2026-05-18

**Scope:** Two sub-projects in one spec.

1. **Parity fixes** — eight drift items found auditing the shipped DAW shell against the
   `FretFlow DAW.html` mockup.
2. **Voicing engine** — the chord-voicing controls (Type / Inversion / String Set) the
   phases-8-13 spec deliberately descoped, now built as a full functional engine.

A third group of items — the mockup's *always-on DAW model* — is acknowledged and
**deferred to its own forthcoming spec** (see §7).

The DAW shell redesign (phases 1-13) is shipped. This spec closes the remaining real gap
short of the always-on restructure.

---

## 1. Background

The `FretFlow DAW.html` design was implemented across 13 phases (see
`docs/superpowers/specs/2026-05-16-daw-shell-phases-8-13-design.md`). A re-handoff of the
same bundle prompted two fresh audits. The first audit was too deferential to the prior
specs' "recorded deliberate deviation" labels; a second audit, prompted by user review,
re-examined nine specific divergences without that deference. The combined result:

- **Eight items are genuine parity drift** this spec fixes (§4).
- **Four items** (unified header with inline transport, permanent chord track / no
  progression on-off gate, lens as an inline pill strip, selected-chord editing location)
  describe the mockup's *always-on DAW model*. They reverse a recorded prior decision and
  restructure the top-of-app; per a brainstorm decision they are **deferred to a separate
  brainstorm → spec → plan cycle** and are not built here (§7).
- **One item** (selected progression chord edited on the Progression tab) was found to
  **already match** the mockup — no change.

Separately, the phases-8-13 spec descoped the Chord tab's voicing controls (then called
"CAGED Span / String Set") because they had no atoms and were inert in the mockup. The
current mockup's `ChordPanel` (`panels.jsx` lines 419-452) shows a VOICING group with three
controls — **Type** (Full CAGED / Drop 2 / Triad), **Inversion** (Root / 1st / 2nd / 3rd),
and **String Set** (All / Bass / Lower-mid / Upper-mid / Treble). This spec builds them as a
real, functional voicing engine.

### Current state relevant to this spec

- **Chord tab** (`src/components/ChordOverlayControls/ChordOverlayControls.tsx`) renders two
  group headers (`groupSource`, `groupDisplay`). The chord-type grid sits inside SOURCE with
  no "Chord Type" header; the Lens / Full Chords / Show-on-Board controls sit under a header
  labelled "DISPLAY". The i18n keys `inspector.groupChordType` and `inspector.groupVoicing`
  exist (`src/i18n/en.ts`, `es.ts`, `types.ts`) but are referenced by no component.
- **View tab** (`src/components/Inspector/ViewTab.tsx`) renders three `ToggleProp` rows in
  the DISPLAY group with no `status` prop; the `ToggleProp` primitive
  (`src/components/Inspector/InspectorGrid.tsx`) fully supports `status`.
- **Progression tab** (`src/components/ProgressionControls/ProgressionControls.tsx`) renders
  the selected-chord Quality as a horizontally scrolling `ToggleBar` (`overflow="scroll"`).
- **Control density** — shipped segmented buttons (`.toggle-btn` in
  `src/components/shared/shared.module.css`), note buttons (`.note-btn`), the fret-range
  buttons (`src/components/FretRangeControl/FretRangeControl.module.css` `.fret-btn`), and
  steppers all use `min-height: 1.85rem` (~29.6px). The mockup runs a denser
  DAW-inspector tier (Segmented 26px, SegmentedDense 22px, Stepper/Select 26px, FretRange
  container 28px, tab triggers 24px, Pill 22px).
- **Root grid** — `NoteGrid` (`src/components/NoteGrid/NoteGrid.tsx`) uses `GRID_COLS = 6`,
  rendering the 12 chromatic notes as a 6×2 grid. The mockup `RootGrid` (`panels.jsx:268`)
  is a single 12-column row of 30px buttons.
- **Status bar** — `StatusBar` has no `position` rule, but
  `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css` `.status-bar-shell` uses
  `margin-top: auto` inside a `min-height: 100dvh` flex column, so on short pages it is
  pushed to the viewport bottom. The mockup status bar is the last element in normal flow,
  directly after the inspector panel.
- **Toggle switch** — `Switch` (`src/components/Switch/Switch.module.css`) is a 30×13 track
  with a 9×9 knob and a 17px thumb travel. The mockup `Toggle` (`atoms.jsx:112`) is 30×17
  with a 13×13 knob and 13px travel.
- **Light theme** — the app already ships a full `modern-light` theme; its tokens live in
  `src/styles/themes.css` under `[data-theme="modern-light"]` with a structured
  "Surface Ladder" palette (cyan `#0891b2`, orange `#ea580c`, …). The mockup `tokens.jsx`
  light palette uses different values (cyan `#0e7a93`, orange `#c44a1f`, bg `#e4eaef`, …).
- **Full Chords** — `fullChordsEnabledAtom` (`src/store/chordOverlayAtoms.ts`) is the master
  enable. `fullChordMatchesAtom` calls `getFullChordShapeMatches`
  (`packages/core/src/shapes/fullChordShapes.ts`), a CAGED-template finder covering only
  Major Triad / Minor Triad / Dominant 7th. `fullChordPositionsAtom` flattens the matches'
  `positionKeys`; `FretboardSVG` highlights those positions.
- **Tuning** carries octaves: `STANDARD_TUNING = ['E4','B3','G3','D3','A2','E2']`
  (`packages/core/src/guitar.ts`); `parseNote` yields `{ noteName, octave }`. Pitch-aware
  computation — required for inversions and drop-2 — is available without new tuning data.

### Decisions taken during the brainstorm

- **Parity — eight items in, always-on model out.** Audit items confirmed as clear drift
  are fixed here. The always-on DAW model is deferred to its own spec (§7). The status-bar
  version-copy and active-pill solid-fill items from the first audit remain deliberate
  codebase improvements and are kept as-is.
- **Light theme — adopt the mockup's light palette.** The `modern-light` token *values* are
  retuned toward the mockup `tokens.jsx` light palette (§4h).
- **Voicing engine — full functional engine**, algorithmic, all 15 chord types.
- **Approach B — coexist; keep CAGED templates.** The new engine does **not** replace
  `getFullChordShapeMatches`; type `caged` routes to the existing finder, `drop2` / `triad`
  route to the new algorithmic engine.
- **Inversions — disable invalid options.** Triads have no 3rd inversion; the `3rd` option
  is disabled when the active chord is a triad.
- **Rendering — all matches up the neck.**

---

## 2. Goals and Non-Goals

### Goals

- Fix the eight audited parity-drift items (§4).
- Retune the light theme to the mockup's light palette.
- Add a functional chord-voicing engine: Type, Inversion, and String-Set controls driving
  real, pitch-correct voicings rendered on the fretboard.

### Non-Goals

- No always-on DAW restructure — deferred to its own spec (§7).
- No changes to music theory beyond the new voicing module; no audio-synthesis changes; no
  fretboard SVG geometry changes.
- No replacement of `getFullChordShapeMatches` / the CAGED templates (Approach B).
- No global dark-theme token recolor; the light retune is values-only inside `themes.css`.

---

## 3. Execution Order

Build in order: **Part 1 (parity fixes) → Part 2 (voicing engine).** Part 1 §4a introduces
the `VOICING` `GroupHeader` the engine's UI fills, so it precedes Part 2. Within Part 1 the
items are independent and may ship in any sub-order. Parts may ship as one PR or several;
each step leaves the app releasable.

---

## 4. Part 1 — Parity fixes

### 4a. Chord tab group structure

`ChordOverlayControls` gains the missing group structure to match the mockup `ChordPanel`
and the Phase 10 acceptance criteria:

- Add a `GroupHeader` using `inspector.groupChordType` before the chord-type grid `Prop`.
- Rename the third group header from `inspector.groupDisplay` to `inspector.groupVoicing`.
- Move the **Lens** control from the third group into the **SOURCE** group, so SOURCE reads
  Mode · Degree · Lens — matching `panels.jsx:407`.

No atom wiring changes. The orphaned `groupChordType` / `groupVoicing` keys become
referenced; `groupDisplay` is removed if no longer used.

### 4b. View tab status words

`ViewTab` passes the `status` prop to its three DISPLAY `ToggleProp` rows, both state words
each (mockup `panels.jsx:103-111`): Degree Colors `By degree` / `Uniform`; Full Chords
`Visible` / `Hidden`; Tap to Play `Audio on` / `Muted`. Strings go through `useTranslation`.

### 4c. Progression tab Quality grid

In `ProgressionControls`' selected-chord editor, the scrolling Quality `ToggleBar` is
replaced by the existing `ChordTypeGrid` component, keeping the adjacent "Diatonic" button.
Atom wiring (`updateProgressionStepQualityAtom` path) is unchanged.

### 4d. Control density

Shipped controls run ~4-12px taller than the mockup's DAW-inspector tier. Retune the
shared control CSS to the mockup densities:

- `shared.module.css` `.toggle-btn` — `min-height` from `1.85rem` toward the mockup's
  segmented tier (~26px), with the mockup's tighter padding.
- `shared.module.css` `.note-btn` — same density pass.
- `FretRangeControl.module.css` `.fret-btn` and the row variant — toward the mockup's
  `FretRange` (28px container, 18×18 buttons).
- `StepperShell.module.css` — toward the mockup `Stepper` (26px).

This is a CSS-values pass — no logic changes. Exact pixel values are confirmed against the
mockup tiers during implementation. All affected visual-regression baselines are refreshed.

### 4e. Root grid → 12-column

`NoteGrid` changes `GRID_COLS` from `6` to `12`, and `shared.module.css` `.note-grid`
changes `grid-template-columns` to `repeat(12, 1fr)` — the 12 chromatic notes render as a
single row, matching the mockup `RootGrid`. Arrow-key navigation already derives from
`GRID_COLS` and adapts automatically. The `NoteGrid` consumers (Chord tab root picker,
Scale tab root picker) are checked to confirm their grid columns accommodate a 12-wide row;
if a consumer's column is too narrow, its `Prop` `span` is widened.

### 4f. Status bar — unpinned

`MainLayoutWrapper.module.css` `.status-bar-shell` drops `margin-top: auto` so the status
bar sits directly after the inspector panel in normal flow, as in the mockup, rather than
being pushed to the viewport bottom on short pages. The change is verified not to break the
`min-height: 100dvh` column layout (the column simply no longer force-fills height).

### 4g. Toggle switch dimensions

`Switch.module.css` is retuned to the mockup `Toggle`: track height `13px → 17px`, knob
`9×9 → 13×13`, thumb travel `17px → 13px` (mockup knob travels `left: 1 → 14`). Pure CSS,
single module.

### 4h. Light theme palette retune

The `[data-theme="modern-light"]` token *values* in `src/styles/themes.css` are retuned
toward the mockup `tokens.jsx` light palette — accent cyan toward `#0e7a93`, accent orange
toward `#c44a1f`, surfaces toward the mockup's `#e4eaef` / `#ffffff` / `#eef2f6` ladder, and
the theme-aware wood/string/inlay tones. The retune is **values-only**: the existing
`modern-light` token *names* and the Surface-Ladder structure are preserved, so no
component CSS changes. The dark theme is untouched. Light-theme visual-regression baselines
are refreshed.

### Testing — Part 1

- `ChordOverlayControls.test.tsx` — SOURCE / CHORD TYPE / VOICING headers render; Lens is
  within SOURCE.
- `ViewTab.test.tsx` — each DISPLAY toggle shows the correct state word for both values.
- `ProgressionControls.test.tsx` — selected-chord Quality renders as a grid and still
  drives the progression step.
- `NoteGrid.test.tsx` — renders 12 columns; arrow-key navigation still wraps correctly.
- `Switch.test.tsx` — unaffected behaviorally; snapshot refreshed for the new dimensions.
- Visual regression — refresh `app-components` (Chord/View/Progression tabs, NoteGrid,
  Switch, control density), `app-layout` (status-bar placement, light theme), `app-mobile`,
  and any light-theme suites, darwin + linux.

### Acceptance criteria — Part 1

- Chord tab shows SOURCE / CHORD TYPE / VOICING headers; Lens under SOURCE.
- View tab DISPLAY toggles show their state words.
- Progression tab selected-chord Quality is a grid.
- Toggle bar, fret range, steppers, note buttons, and the toggle switch match the mockup's
  compact densities.
- The root grid is a single 12-column row.
- The status bar follows the inspector panel in normal flow (no bottom-pin gap).
- The light theme uses the mockup's light palette.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 5. Part 2 — Voicing engine

### 5a. State (new atoms)

Three new persisted atoms in `src/store/chordOverlayAtoms.ts`, using the existing
`atomWithStorage` + `k()` key-prefix pattern:

- `voicingTypeAtom: 'caged' | 'drop2' | 'triad'` — default `'caged'` (preserves current
  Full Chords behavior).
- `voicingInversionAtom: 'root' | '1st' | '2nd' | '3rd'` — default `'root'`.
- `voicingStringSetAtom: 'all' | 'low' | 'mid' | 'mid-hi' | 'top'` — default `'all'`.

Two new derived (non-persisted) atoms:

- `availableInversionsAtom` — the inversion options valid for the active `chordTypeAtom`:
  all four for 7th/extended chords, `root`/`1st`/`2nd` only for triads (dyads → `root`
  only). Drives the UI's disabled-option set. If `voicingInversionAtom` holds a now-invalid
  value after a chord-type change, the engine treats it as `root`.
- `voicingMatchesAtom` — **replaces** `fullChordMatchesAtom` as the renderer's source. It
  reads `fullChordsEnabledAtom`, `chordOverlayHiddenAtom`, `chordRootAtom`, `chordTypeAtom`,
  `currentTuningAtom`, and the three new atoms, and returns `generateVoicings(...)` output.
  `fullChordPositionsAtom` is re-pointed to flatten `voicingMatchesAtom`.

No other atoms change. The engine is gated by `fullChordsEnabledAtom` and hidden by
`chordOverlayHiddenAtom`, exactly as Full Chords is today.

### 5b. Core engine

New module `packages/core/src/shapes/voicings.ts`, exported through
`packages/core/src/shapes/index.ts`.

```
generateVoicings({
  chordRoot, chordType, tuning, maxFret,
  voicingType, inversion, stringSet,
}): Voicing[]
```

`Voicing` mirrors `FullChordMatch` — `{ positionKeys: string[], notes: VoicingNote[] }`,
`VoicingNote = { stringIndex, fretIndex, noteName, midi }` — so the renderer consumes it
identically.

**Routing:**

- `voicingType === 'caged'` → delegate to `getFullChordShapeMatches`, then post-filter:
  drop matches whose strings fall outside the active string-set mask, and (for inversion ≠
  `root`) whose lowest-pitch note is not the inversion's bass tone. The curated CAGED
  shapes are unchanged; only the visible subset narrows.
- `voicingType === 'drop2' | 'triad'` → the algorithmic search below.

**Algorithmic search (`drop2` / `triad`):**

1. **Chord tones.** Resolve pitch classes from `CHORD_DEFINITIONS[chordType].members`
   (semitone offsets from `chordRoot`).
2. **String-set mask.** Map `stringSet` to a 6-bit allowed-strings mask: `all` = all six;
   `low` = strings 4-5-6 (bass); `mid` = 3-4-5; `mid-hi` = 2-3-4; `top` = 1-2-3 (treble).
   Strings are indexed high (0) to low (5) per the codebase convention. **Note:** the
   mockup's `StringSetPicker` `mask` arrays are internally inconsistent with their own
   `sub` labels (e.g. the `Bass` card is labelled "4–5–6" but its mask flags strings
   1-2-3). Follow the string-number labels above — the musically sensible reading — not the
   mockup's mask arrays.
3. **Target voice count.** `triad` → 3 distinct chord tones; `drop2` → 4 (requires a 7th
   chord or added tone — for plain triads `drop2` falls back to a 3-voice spread, §5e).
4. **Inversion bass.** Required lowest-pitch note: `root` → 1st, `1st` → 3rd, `2nd` → 5th,
   `3rd` → 7th. If the chord lacks the required tone, the voicing yields no match.
5. **Search.** Across the neck, for each allowed-string subset of the target size, assign
   one fret per string such that: every note is a chord tone; all required tones are
   present; the lowest-pitch (by MIDI) note is the inversion bass; the fret span ≤ the
   playability limit (`triad` ≤ 4, `drop2` ≤ 5); no string carries more than one note.
6. **Drop-2 rule.** For `drop2`, build the classic drop-2: take a close-position 4-note
   stack in the chosen inversion, drop the second-highest voice an octave, then realise it
   on an adjacent allowed-string group. Pitch (MIDI) computation makes the octave drop
   exact.
7. Return every satisfying voicing — all matches up the neck.

The engine is pure (no React, no atoms) and pitch-aware via `parseNote` + fret offset
(`midi = openStringMidi + fret`). It covers all 15 chord types; types lacking a required
inversion tone simply return fewer (or no) matches for that inversion.

### 5c. UI — Chord tab VOICING group

Inside the `VOICING` `GroupHeader` from §4a, three new `Prop` cells plus the existing Full
Chords and Show-on-Board toggles:

- **Type** — `ToggleBar` bound to `voicingTypeAtom` (Full CAGED / Drop 2 / Triad).
- **Inversion** — `ToggleBar` bound to `voicingInversionAtom` (Root / 1st / 2nd / 3rd),
  options outside `availableInversionsAtom` rendered disabled.
- **String Set** — a new `StringSetPicker` component bound to `voicingStringSetAtom`,
  porting the mockup's five `StringDiagram` cards (`panels.jsx:460-531`): each card shows a
  6-line string diagram with active strings emphasised, a label, and a sub-label.

`ToggleBar` gains a `disabledOptions` capability (a small additive enhancement — option
values that render non-interactive). This is the only primitive change.

### 5d. Rendering

`FretboardSVG` reads `fullChordPositionsAtom`; that atom is re-pointed to
`voicingMatchesAtom` (§5a), so `FretboardSVG` needs no change beyond confirming the
position-key format is identical (`"stringIndex-fretIndex"`). "All matches up the neck" is
already the renderer's Full-Chords behavior.

### 5e. Resolve-during-implementation items

- **`drop2` on plain triads** — drop-2 needs 4 voices. The plan decides whether plain
  triads under `drop2` fall back to a 3-voice open spread or yield no match.
- **Stale inversion on chord-type change** — when the active chord type loses the selected
  inversion, the plan decides whether `voicingInversionAtom` auto-resets to `root` or the
  engine coerces it. Both acceptable; pick one and test it.
- **Playability span limits** — exact fret-span ceilings (`triad` ≤ 4, `drop2` ≤ 5
  proposed) are tuned during TDD against known voicings.

### Testing — Part 2

- `voicings.test.ts` (new, TDD) — inversion bass is the lowest-pitch note for each
  inversion; string-set masking restricts strings correctly; the drop-2 octave-drop is
  pitch-exact; span limits are enforced; all 15 chord types resolve; invalid
  inversion/chord combinations return no match; `caged` routing still matches
  `getFullChordShapeMatches` for the unconstrained case.
- `chordOverlayAtoms.test.ts` — `availableInversionsAtom` excludes `3rd` for triads;
  `voicingMatchesAtom` is empty when `fullChordsEnabledAtom` is off or
  `chordOverlayHiddenAtom` is on.
- `ChordOverlayControls.test.tsx` — the three voicing controls render in the VOICING group
  and drive their atoms; disabled inversion options are non-interactive.
- `StringSetPicker.test.tsx` (new) — the five cards render, the active card reflects
  `voicingStringSetAtom`, clicking a card writes the atom.
- `ToggleBar.test.tsx` — `disabledOptions` renders options non-interactive.
- Visual regression — refresh `app-components` (Chord tab VOICING group) and
  `fretboard-svg` (drop-2 / triad / string-set voicings), darwin + linux.

### Acceptance criteria — Part 2

- The Chord tab VOICING group has working Type, Inversion, and String-Set controls.
- Selecting Drop 2 or Triad renders pitch-correct voicings; the chosen inversion's bass
  tone is the lowest note; the String Set restricts which strings are used.
- `3rd` inversion is disabled for triads.
- Full CAGED is unchanged from today's Full Chords behavior when Inversion = Root and
  String Set = All; `fullChordShapes.test.ts` still passes.
- The engine covers all 15 chord types.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 6. Cross-Cutting Notes

- New UI strings (group labels already exist as orphaned keys; status words; voicing
  control labels; string-set card labels) go through `useTranslation`, following the
  `inspector.*` key conventions, added to both `en.ts` and `es.ts`.
- The leaf controls keep their atom wiring; only `ChordOverlayControls` gains the new
  voicing controls and `FretboardSVG`'s data source is re-pointed (not re-shaped).
- Mandatory before each PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- This spec is committed to git under `docs/superpowers/specs/`.

## 7. Deferred — the always-on DAW model

The mockup is built on an *always-on DAW model* the shipped app does not adopt. Four items
describe it; per a brainstorm decision they are **deferred to their own brainstorm → spec →
plan cycle**, not built here:

- **Unified header with inline transport** — the mockup puts brand, transport, position,
  tempo, scale, and utility in one header row (`app.jsx:76-99`). The shipped app splits
  these across `AppHeader` and a `TransportBar` nested in `ProgressionTrack`.
- **Permanent chord track / no progression on-off gate** — the mockup always shows the
  chord track; it has no `progressionEnabledAtom`-style gate. The shipped app gates the
  whole progression workflow behind `progressionEnabledAtom` and a
  `TopBandSummary ↔ ProgressionTrack` mode-swap (`ProgressionSummarySlot`,
  `FretboardLensOverlay`, and ~9 files).
- **Lens as an inline pill strip** — the mockup `LensPanel` (`lens.jsx`) is a slim inline
  strip *inside* the fretboard container, rendering scale notes and chord tones as rounded
  pill chips. The shipped app floats `TopBandSummary` over the board, and `DegreeChipStrip`
  renders *circular* chips on a connecting line, not pills.
- **Selected-chord editing location** — already matches the mockup (Progression tab); no
  work, listed only for completeness.

This restructure reverses the phases-8-13 spec's recorded decision to keep the
progression mode-swap; it is L-sized and high-blast-radius, which is why it gets its own
spec rather than riding along here.

## 8. Recorded Descopes (unchanged from prior specs)

- Always-on transport / chord track — deferred to its own spec (§7).
- Global dark-theme token recolor — dark tokens kept; only the light theme is retuned
  (§4h), values-only.
- First-audit items: status-bar version copy (`FretFlow Studio · v{version}`) and the
  Inspector active-pill solid fill — kept as deliberate codebase improvements.
