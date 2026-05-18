# Inspector Tab Refinements — Design

**Date:** 2026-05-18
**Status:** Approved (design phase)
**Scope:** View, Scale, and Progression inspector tabs. The Chord tab is unchanged — it is the reference pattern the Progression tab adopts.

## Context

The DAW inspector exposes four tabs (`View`, `Scale`, `Chord`, `Progression`) built on the
`PropGrid` / `Prop` / `GroupHeader` / `ToggleProp` primitives in
`src/components/Inspector/InspectorGrid.tsx`. Design mockups for the View, Scale, and
Progression tabs surfaced a set of layout and consistency issues. This spec captures the
agreed changes. It describes the desired end state; implementation reconciles against the
code live at build time.

## Cross-cutting: shared control height

All three tabs report that stepper controls do not align with the `ToggleBar` controls
beside them. `ToggleBar` resolves to a taller row (`min-height: 2.85rem`) than
`StepperControl` (`min-height: 1.85rem`) and `StepperShell`.

**Change:** introduce a single shared control-height token consumed by `ToggleBar`,
`StepperShell`, `StepperControl`, and `StepperSelect` so every control in a `PropGrid`
row resolves to the same height.

- View tab: the fret-range stepper grows *up* to that height.
- Scale and Progression: their steppers shrink *down* to it.

This is one token change plus the four components referencing it. No behavioral change.

## 1. View tab

File: `src/components/Inspector/ViewTab.tsx`

Current groups: `FINGERING` (Pattern, Shape, Fret Range) · `LABELS` (Notes, Accidentals,
Enharmonic) · `DISPLAY` (Degree Colors, Full Chords, Tap to Play).

**Changes:**

1. Move the **Fret Range** `Prop` from the `FINGERING` group into the `DISPLAY` group.
2. Remove the **Full Chords** `ToggleProp` from `DISPLAY`. The `fullChordsEnabledAtom`
   atom remains; it is no longer surfaced in this tab.
3. Remove the **Tap to Play** `ToggleProp` from `DISPLAY`. It duplicates the header mute
   button (`isMutedAtom`), which stays the single control for that state.
4. Size the inline `FretRangeControl` to the shared control height so it aligns with the
   `ToggleBar` controls.

**Resulting groups:**

- `FINGERING`: Pattern, Shape
- `LABELS`: Notes, Accidentals, Enharmonic
- `DISPLAY`: Degree Colors, Fret Range

## 2. Scale tab

Files: `src/components/Inspector/ScaleTab.tsx`, `ScaleTheoryFacts.tsx`,
`ScaleTab.module.css`, `src/components/ScaleSelector/ScaleSelector.tsx`,
`src/components/CircleOfFifths/CircleOfFifths.tsx`.

Current 3-column layout: `KEY` · `THEORY` · `WHEEL`.

**Changes:**

1. **Reorder columns** to `KEY` · `CIRCLE OF FIFTHS` · `THEORY`. Key stays in the left
   column; the circle moves to the center; Theory moves to the right. Update the
   `grid-template-columns` track sizing in `ScaleTab.module.css` accordingly.
2. **Rename** the `WHEEL` group header to `CIRCLE OF FIFTHS`, rendered through the same
   `GroupHeader` styling as the `KEY` and `THEORY` headers (consistent type, rule, and
   spacing — no bespoke treatment).
3. **Compact circle** — reduce the `CircleOfFifths` SVG footprint so the column reads as
   a denser, secondary element rather than dominating the tab.
4. **Relocate Key Signature + Relative/Parent.** These belong under the Circle of Fifths,
   not under Theory. The `CircleOfFifths` component already renders a footer with
   `Key Signature` and the relative/parent readout — that footer stays. The Theory column
   stops surfacing key-signature and parent facts.
5. **Replace the "Tones" row** in Theory with a **diatonic chord list**. Use the existing
   `DegreeChordList` component (`src/components/CircleOfFifths/DegreeChordList/`), which
   already lists every diatonic chord of the active scale (degree numeral · root ·
   quality). The raw tone count is dropped.
6. **Compact `StepperSelect`** — the Scale Family and Variant steppers shrink to the
   shared control height.

**Resulting columns:**

- `KEY`: Root grid, Scale Family, Variant, Relationship
- `CIRCLE OF FIFTHS`: compact circle + Key Signature + Relative/Parent footer
- `THEORY`: Notes, Intervals, Degrees, Chords (diatonic chord list)

## 3. Chord tab

No changes. The Chord tab's quality picker (`ChordTypeGrid` with `includeSentinel: false`,
plus the `*`-on-degree convention) is the reference pattern the Progression tab adopts.

## 4. Progression tab

Files: `src/components/ProgressionControls/ProgressionControls.tsx`,
`BackingTrackControls.tsx`, their CSS modules, and `src/components/Inspector/InspectorGrid.tsx`
(`GroupHeader` already supports a `right` slot).

**Changes:**

1. **Chord-list actions move to the CHORDS header row.** The Add / Move Up / Move Down /
   Duplicate / Delete toolbar moves out of the chord-list cell and into the `CHORDS`
   `GroupHeader` via its existing `right` prop.
2. **Shrink the chord list** — reduce `.step-row` `min-height` and padding so the list
   reads as a denser, compact stack.
3. **Editor "SELECTED" header** — the editor cell gains a header line of the form
   `SELECTED — <degree> · <chord name>` (e.g. `SELECTED — i · A Minor Triad`) so the
   editor explicitly references the chord being edited.
4. **Unified quality picker.** Drop the standalone "Diatonic" button. Render the quality
   options through `ChordTypeGrid` (`buildQualityToggleOptions({ includeSentinel: false })`),
   identical to the Chord tab.
   - No quality selected → diatonic (the chord quality derived from the active scale).
   - Selecting a quality sets `qualityOverride` and appends `*` to the active degree in
     the Degree `ToggleBar` (`buildDegreeToggleOptions` already supports this via
     `qualityOverridden` / `activeDegree`).
   - Clicking the currently-selected quality again clears the override (back to diatonic,
     `*` removed). This is handled in the `onChange` wrapper in `ProgressionControls` —
     `ChordTypeGrid` itself is unchanged.
5. **Compact steppers** — the Beats/Bar and Duration steppers adopt the shared control
   height.
6. **Restyle Swing.** Replace the raw native `<input type="range">` in
   `BackingTrackControls` with a styled DAW slider — filled track plus a `%` readout —
   consistent with the rest of the DAW chrome.
7. **Restyle Backing Track selects.** Replace the six native `<select>` dropdowns (Genre,
   Instrument, Chord/Bass/Drum pattern) with `LabeledSelect` so they match the inspector's
   styled controls.
8. **Remove the Loop toggle** from the meter row. Loop is a transport concern, not an
   inspector setting. It is removed from this tab only; relocating it to a transport
   surface is tracked as a follow-up (see below).
9. **Keep the Mode switch** as the first cell of the meter row.

**Resulting meter row:** Mode · Beats/Bar · Length · Preset.

## Out of scope / follow-ups

- **Loop relocation.** This spec removes the Loop toggle from the Progression tab. Finding
  it a home on a transport/playback surface is a separate task, not covered here.
- The `fullChordsEnabledAtom` and `isMutedAtom` atoms are untouched — only their exposure
  in the View tab changes.

## Testing

- Component tests co-located per project convention (`ViewTab.test.tsx`,
  `ScaleTab.test.tsx`, `ScaleTheoryFacts.test.tsx`, `ProgressionTab.test.tsx`,
  `ProgressionControls` tests). Update assertions for moved/removed controls.
- Verify the View tab no longer renders Full Chords / Tap to Play; Fret Range renders in
  the DISPLAY group.
- Verify the Scale tab renders columns in `KEY · CIRCLE OF FIFTHS · THEORY` order, the
  Theory column renders the diatonic chord list (no Tones row, no key-sig/parent rows).
- Verify the Progression tab: header-row action toolbar, unified quality picker with
  `*`-on-degree behavior, no Loop toggle, `SELECTED` editor header.
- Visual regression suites under `e2e/` (`app-components`, `app-overlays`) will need
  refreshed darwin/linux snapshots for the affected tabs.
- `vitest-axe` checks remain green for each tab.
