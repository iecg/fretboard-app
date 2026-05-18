# DAW Voicing Engine + Chord-tab Parity — Design

**Status:** Brainstorm spec. Produced 2026-05-18 from a re-handoff of the `FretFlow DAW.html`
Claude Design bundle plus a fresh region-by-region parity audit against the shipped app.

**Date:** 2026-05-18

**Scope:** Two sub-projects in one spec.

1. **Parity fixes** — three drift items found auditing the shipped DAW shell against the
   `FretFlow DAW.html` mockup.
2. **Voicing engine** — the chord-voicing controls (Type / Inversion / String Set) the
   phases-8-13 spec deliberately descoped, now built as a full functional engine.

The DAW shell redesign (phases 1-13) is shipped. This spec closes the remaining real gap.

---

## 1. Background

The `FretFlow DAW.html` design was implemented across 13 phases (see
`docs/superpowers/specs/2026-05-16-daw-shell-phases-8-13-design.md`). A re-handoff of the
same bundle prompted a fresh audit. The audit found the shipped app is a faithful
implementation; drift is small and concentrated. Three items are genuine, unintended drift.
Ten further deviations are recorded decisions and are **not** in scope.

Separately, the phases-8-13 spec descoped the Chord tab's voicing controls (then called
"CAGED Span / String Set") because they had no atoms and were inert even in the mockup. The
current mockup's `ChordPanel` (`panels.jsx` lines 419-452) shows a VOICING group with three
controls — **Type** (Full CAGED / Drop 2 / Triad), **Inversion** (Root / 1st / 2nd / 3rd),
and **String Set** (All / Bass / Lower-mid / Upper-mid / Treble). This spec builds them as a
real, functional voicing engine.

### Current state relevant to this spec

- **Chord tab** (`src/components/ChordOverlayControls/ChordOverlayControls.tsx`) renders two
  group headers (`groupSource`, `groupDisplay`). The chord-type grid sits inside SOURCE with
  no "Chord Type" header; the Lens / Full Chords / Show-on-Board controls sit under a header
  labelled "DISPLAY". The i18n keys `inspector.groupChordType` and `inspector.groupVoicing`
  exist (`src/i18n/en.ts`, `es.ts`, `types.ts`) but are referenced by no component — added
  for the Phase 10 layout, then orphaned.
- **View tab** (`src/components/Inspector/ViewTab.tsx`) renders three `ToggleProp` rows in
  the DISPLAY group with no `status` prop; the `ToggleProp` primitive
  (`src/components/Inspector/InspectorGrid.tsx`) fully supports `status`.
- **Progression tab** (`src/components/ProgressionControls/ProgressionControls.tsx`) renders
  the selected-chord Quality as a horizontally scrolling `ToggleBar` (`overflow="scroll"`).
- **Full Chords** — `fullChordsEnabledAtom` (`src/store/chordOverlayAtoms.ts`) is the master
  enable toggle. `fullChordMatchesAtom` calls `getFullChordShapeMatches`
  (`packages/core/src/shapes/fullChordShapes.ts`), a CAGED-template finder covering only
  Major Triad / Minor Triad / Dominant 7th. `fullChordPositionsAtom` flattens the matches'
  `positionKeys`; `FretboardSVG` highlights those positions.
- **Tuning** carries octaves: `STANDARD_TUNING = ['E4','B3','G3','D3','A2','E2']`
  (`packages/core/src/guitar.ts`); `parseNote` yields `{ noteName, octave }`. Pitch-aware
  computation — required for inversions and drop-2 — is therefore available without new
  tuning data.

### Decisions taken during the brainstorm

- **Parity fixes — items 1, 2, 3 only.** Item 4 (status-bar version copy) and item 5
  (active-pill solid fill) are deliberate codebase improvements and are kept as-is.
- **Voicing engine — full functional engine**, not UI-only and not a filter over the
  existing finder.
- **Approach B — coexist; keep CAGED templates.** The new engine does **not** replace
  `getFullChordShapeMatches`. The curated CAGED templates are guitarist-vetted and lock the
  committed visual baselines; regenerating them algorithmically would risk both. Type
  `caged` routes to the existing finder; `drop2` and `triad` route to the new algorithmic
  engine.
- **Generation — algorithmic search.** The `drop2` / `triad` engine searches fret
  assignments under playability constraints; it covers all 15 chord types and every
  inversion, rather than relying on hand-authored templates.
- **Inversions — disable invalid options.** Triads have no 3rd inversion; the `3rd` control
  option is disabled (greyed, non-selectable) when the active chord is a triad.
- **Rendering — all matches up the neck.** Every voicing satisfying the active
  Type / Inversion / String-Set constraints is highlighted across the fretboard, matching
  how the current Full Chords finder behaves.

---

## 2. Goals and Non-Goals

### Goals

- Fix the three audited Chord-tab / View-tab / Progression-tab parity drift items.
- Add a functional chord-voicing engine: Type, Inversion, and String-Set controls that
  drive real, pitch-correct voicings rendered on the fretboard.

### Non-Goals

- No changes to music theory beyond the new voicing module, no audio-synthesis changes, no
  fretboard SVG geometry changes.
- No replacement of `getFullChordShapeMatches` / the CAGED templates (Approach B).
- No global design-token recolor; no always-on transport — both remain descoped per the
  phases-8-13 spec.
- No revert of audit items 4 and 5.

---

## 3. Execution Order

Build in order: **Part 1 (parity fixes) → Part 2 (voicing engine).** Part 1 item #1
introduces the `VOICING` `GroupHeader` that the engine's UI then fills, so it must precede
Part 2. Parts may ship as one PR or several; each step leaves the app releasable.

---

## 4. Part 1 — Parity fixes

### 4a. Chord tab group structure (item #1)

`ChordOverlayControls` gains the missing group structure to match the mockup `ChordPanel`
and the Phase 10 acceptance criteria:

- Add a `GroupHeader` using `inspector.groupChordType` immediately before the chord-type
  grid `Prop`.
- Rename the third group header from `inspector.groupDisplay` to `inspector.groupVoicing`.
- Move the **Lens** control from the third group into the **SOURCE** group, so SOURCE reads
  Mode · Degree · Lens — matching `panels.jsx:407`.

No atom wiring changes; this is a re-grouping of existing controls. The `groupDisplay` i18n
key, if no longer referenced anywhere, is removed; `groupChordType` / `groupVoicing` become
referenced.

### 4b. View tab status words (item #2)

`ViewTab` passes the `status` prop to its three DISPLAY `ToggleProp` rows, with both state
words each (mockup `panels.jsx:103-111`):

- Degree Colors — `By degree` / `Uniform`
- Full Chords — `Visible` / `Hidden`
- Tap to Play — `Audio on` / `Muted`

The strings go through `useTranslation` (new `inspector.*` keys). No behavior change.

### 4c. Progression tab Quality grid (item #3)

In `ProgressionControls`' selected-chord editor, the scrolling Quality `ToggleBar` is
replaced by the existing `ChordTypeGrid` component (already used by the Chord tab), keeping
the adjacent "Diatonic" button. Atom wiring (`updateProgressionStepQualityAtom` path) is
unchanged.

### Testing — Part 1

- `ChordOverlayControls.test.tsx` — the three group headers (SOURCE / CHORD TYPE / VOICING)
  render; Lens is within the SOURCE group.
- `ViewTab.test.tsx` — each DISPLAY toggle shows the correct state word for both values.
- `ProgressionControls.test.tsx` — the selected-chord Quality renders as a grid; selecting
  a quality still drives the progression step.
- Visual regression — refresh `app-components` (Chord, View, Progression tabs), darwin +
  linux.

### Acceptance criteria — Part 1

- The Chord tab shows SOURCE / CHORD TYPE / VOICING group headers; Lens is under SOURCE.
- The View tab DISPLAY toggles show their state words.
- The Progression tab selected-chord Quality is a grid, not a scrolling bar.
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
  all four for 7th/extended chords, `root`/`1st`/`2nd` only for triads (and dyads → `root`
  only). Drives the UI's disabled-option set. If `voicingInversionAtom` holds a value no
  longer valid after a chord-type change, the engine treats it as `root` (the UI may also
  reset it — a plan decision).
- `voicingMatchesAtom` — **replaces** `fullChordMatchesAtom` as the renderer's source. It
  reads `fullChordsEnabledAtom`, `chordOverlayHiddenAtom`, `chordRootAtom`, `chordTypeAtom`,
  `currentTuningAtom`, and the three new atoms, and returns `generateVoicings(...)` output.
  `fullChordPositionsAtom` is re-pointed to flatten `voicingMatchesAtom`.

No other atoms change. The engine is gated by the existing `fullChordsEnabledAtom` master
toggle and hidden by `chordOverlayHiddenAtom`, exactly as Full Chords is today.

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
where `VoicingNote = { stringIndex, fretIndex, noteName, midi }` — so the renderer consumes
it identically.

**Routing:**

- `voicingType === 'caged'` → delegate to `getFullChordShapeMatches`, then post-filter:
  drop matches whose strings fall outside the active string-set mask, and (for inversion ≠
  `root`) whose lowest-pitch note is not the inversion's bass tone. The curated CAGED
  shapes are unchanged; only the visible subset narrows.
- `voicingType === 'drop2' | 'triad'` → the algorithmic search below.

**Algorithmic search (`drop2` / `triad`):**

1. **Chord tones.** Resolve the chord's pitch classes from `CHORD_DEFINITIONS[chordType]`
   `.members` (semitone offsets from `chordRoot`).
2. **String-set mask.** Map `stringSet` to a 6-bit allowed-strings mask. Convention from
   the mockup `StringSetPicker`: `all` = all six; `low` = strings 4-5-6 (bass); `mid` =
   3-4-5; `mid-hi` = 2-3-4; `top` = 1-2-3 (treble). Strings are indexed high (0) to low (5)
   per the codebase convention. **Note:** the mockup's `StringSetPicker` `mask` arrays are
   internally inconsistent with their own `sub` labels (e.g. the `Bass` card is labelled
   "4–5–6" but its mask flags strings 1-2-3). Follow the string-number labels above — the
   musically sensible reading — not the mockup's mask arrays.
3. **Target voice count.** `triad` → 3 distinct chord tones; `drop2` → 4 (requires a 7th
   chord or an added tone — for plain triads `drop2` falls back to a 3-voice spread, a plan
   decision noted in §5e).
4. **Inversion bass.** The required lowest-pitch note: `root` → 1st, `1st` → 3rd, `2nd` →
   5th, `3rd` → 7th. If the chord lacks the required tone, the voicing yields no match.
5. **Search.** Across the neck, for each allowed-string subset of the target size, assign
   one fret per string such that: every note is a chord tone; all required tones are
   present; the lowest-pitch (by MIDI) note is the inversion bass; the fret span ≤ the
   playability limit (`triad` ≤ 4, `drop2` ≤ 5); no string carries more than one note.
6. **Drop-2 rule.** For `drop2`, voicings are built as the classic drop-2: take a
   close-position 4-note stack in the chosen inversion, drop the second-highest voice an
   octave, then realise the result on an adjacent allowed-string group. Pitch (MIDI)
   computation makes the octave drop exact.
7. Return every satisfying voicing — all matches up the neck.

The engine is pure (no React, no atoms) and pitch-aware via `parseNote` + fret offset
(`midi = openStringMidi + fret`). It covers all 15 chord types; types lacking a required
inversion tone simply return fewer (or no) matches for that inversion.

### 5c. UI — Chord tab VOICING group

Inside the `VOICING` `GroupHeader` from Part 1 item #1, three new `Prop` cells plus the
existing Full Chords and Show-on-Board toggles:

- **Type** — `ToggleBar` bound to `voicingTypeAtom`, options Full CAGED / Drop 2 / Triad.
- **Inversion** — `ToggleBar` bound to `voicingInversionAtom`, options Root / 1st / 2nd /
  3rd, with options outside `availableInversionsAtom` rendered disabled.
- **String Set** — a new `StringSetPicker` component bound to `voicingStringSetAtom`,
  porting the mockup's five `StringDiagram` cards (`panels.jsx:460-531`): each card shows a
  6-line string diagram with the active strings emphasised, a label, and a sub-label.

`ToggleBar` gains a `disabledOptions` capability (a small, additive enhancement — a set of
option values that render non-interactive). This is the only primitive change.

### 5d. Rendering

`FretboardSVG` reads `fullChordPositionsAtom` today; that atom is re-pointed to
`voicingMatchesAtom` (§5a), so `FretboardSVG` needs no change beyond confirming the
position-key format is identical (`"stringIndex-fretIndex"`). The "all matches up the neck"
behavior is already what the renderer does for Full Chords.

### 5e. Resolve-during-implementation items

- **`drop2` on plain triads** — drop-2 strictly needs a 4-voice chord. The plan decides
  whether plain triads under `drop2` fall back to a 3-voice open spread or yield no match.
- **Stale inversion on chord-type change** — when the active chord type loses the inversion
  currently selected, the plan decides whether `voicingInversionAtom` auto-resets to `root`
  or the engine simply coerces it. Both are acceptable; pick one and test it.
- **Playability span limits** — the exact fret-span ceilings (`triad` ≤ 4, `drop2` ≤ 5 are
  the proposed defaults) are tuned during TDD against known voicings.

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
- `ToggleBar.test.tsx` — `disabledOptions` renders options non-interactive and
  non-selectable.
- Visual regression — refresh `app-components` (Chord tab VOICING group) and
  `fretboard-svg` (drop-2 / triad / string-set voicings on the board), darwin + linux.

### Acceptance criteria — Part 2

- The Chord tab VOICING group has working Type, Inversion, and String-Set controls.
- Selecting Drop 2 or Triad renders pitch-correct voicings on the fretboard; the chosen
  inversion's bass tone is the lowest note; the String Set restricts which strings are used.
- `3rd` inversion is disabled for triads.
- Full CAGED is unchanged from today's Full Chords behavior when Inversion = Root and
  String Set = All; the existing `fullChordShapes.test.ts` still passes.
- The engine covers all 15 chord types.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` pass.

---

## 6. Cross-Cutting Notes

- New UI strings (group labels already exist as orphaned keys; status words; voicing
  control labels; string-set card labels) go through `useTranslation`, following the
  `inspector.*` key conventions, added to both `en.ts` and `es.ts`.
- The leaf controls keep their atom wiring; only `ChordOverlayControls` gains the new
  voicing controls and `FretboardSVG`'s data source is re-pointed (not re-shaped).
- Mandatory before each PR: `pnpm run lint`, `pnpm run test`, `pnpm run build` (per
  `CLAUDE.md`).
- This spec is committed to git under `docs/superpowers/specs/`.

## 7. Recorded Descopes (unchanged from prior specs)

- Always-on transport bar + chord track — codebase keeps the progression-mode-swap.
- Token recolor to the mockup's exact hexes — codebase tokens kept.
- Audit items 4 (status-bar version copy) and 5 (active-pill solid fill) — kept as
  deliberate codebase improvements.
