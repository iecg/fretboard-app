# Chord Progressions Design

Date: 2026-05-12
Status: Revised for user review

## Summary

Add degree-first chord progression support to FretFlow. V1 focuses on practice through changes and key-based harmony study: users load a common progression preset, edit the degree sequence, set per-step durations, optionally override a step's chord quality, and practice with manual or timed loop advancement.

Free-form song sketching is intentionally deferred. V1 does not parse chord-symbol text such as `Am7 D7 Gmaj7`, does not support song sections, and does not introduce non-degree-rooted progression steps.

## User Decisions

- Progressions are degree-first and remap when the active key or scale changes.
- V1 combines presets with an editable builder.
- V1 includes optional timed auto-advance looping.
- Each step can have its own duration.
- Quality overrides are in scope, but the root stays degree-derived.
- The UI uses a hybrid layout: a full Progression section for editing and compact playback controls in the over-fretboard summary card.
- The progression playback surface extends the merged `TopBandSummary` card that combines scale degrees and chord practice cues.
- When progression mode is enabled, the active progression step takes over the chord overlay.

## Current Project Context

The app already has strong chord overlay foundations:

- Jotai atoms resolve chord root/type through manual and degree modes.
- Existing fretboard, chord connector, note semantics, and practice bar consumers read resolved chord state.
- Circle-of-fifths and degree helpers already derive diatonic chords from key, scale, and Roman numeral degree.
- Desktop controls are grouped in the Theory card; mobile uses bottom tabs.
- `TopBandSummary` now consolidates `DegreeChipStrip` and `ChordPracticeBar` into one card over the fretboard. The progression design should extend that card for compact playback controls.

The progression implementation should reuse that pipeline. The fretboard and practice bar should keep reading the resolved active chord without needing progression-specific rendering branches.

## Goals

- Let users practice common chord progressions through the existing fretboard chord overlay.
- Let users study harmonic function by keeping progression steps as scale degrees.
- Make progressions editable without becoming a full song editor.
- Keep the practice loop visible in the over-fretboard summary card while keeping detailed editing in the controls.
- Preserve existing single-chord workflows when progression mode is off.

## Non-Goals

- Free-form chord text parsing.
- Song sections, repeats beyond a simple loop, arrangement forms, or imported songs.
- Slash chords, bass notes, borrowed chords with non-degree roots, or modulation.
- Metronome audio, count-in, or backing tracks.
- User-saved named progression libraries beyond the currently edited persisted progression.

## Data Model

Introduce a progression domain with a persisted editable sequence and separate transient playback state.

```ts
type ProgressionStepDuration =
  | "1-beat"
  | "2-beats"
  | "1-bar"
  | "2-bars";

interface ProgressionStep {
  id: string;
  degree: DegreeId;
  duration: ProgressionStepDuration;
  qualityOverride: string | null;
}

interface ProgressionPreset {
  id: string;
  label: string;
  steps: Array<Omit<ProgressionStep, "id">>;
}
```

Persisted state:

- `progressionEnabled`
- `progressionSteps`
- `progressionTempoBpm`
- `progressionLoopEnabled`

Transient state:

- active step index
- playing/paused
- timer deadline and elapsed playback bookkeeping

The playback cursor is not persisted. Reloading starts paused on the first resolvable step.

Bars assume 4 beats in v1. Future meter support can extend the duration conversion without changing the step model.

## Presets

Presets load into the editable step list. They are not separate modes. Initial presets should be small and data-driven:

- `I-V-vi-IV`
- `ii-V-I`
- `I-vi-IV-V`
- `I-IV-V`
- `12-bar blues` as degree steps with dominant seventh quality overrides where appropriate

Each preset step can include a default duration and optional quality override.

## Chord Resolution

Each step resolves from the active scale context:

1. `getDiatonicChord(step.degree, scaleName, rootNote)` resolves the root and default quality.
2. `step.qualityOverride` replaces only the quality when set.
3. Invalid or missing overrides fall back to the diatonic quality.

Progression mode has priority over the existing manual/degree chord source. While enabled, `chordRootAtom` and `chordTypeAtom` should read from the active progression step when it resolves. When disabled, existing chord behavior remains unchanged.

Chord writes while progression mode is enabled should update the active progression step rather than silently switching the global chord source:

- Degree changes update the active step degree.
- Chord type changes set or clear the active step quality override.
- Manual chord root selection is unavailable because progression roots are degree-derived.
- Practice lens controls remain available because they apply to the active resolved chord.

## UI Design

### Progression Section

Add a third Theory section named Progression beside Scale and Chords. It owns editing:

- enable/disable progression mode
- preset buttons
- editable ordered step list
- add step
- remove step
- reorder step
- duration selector per step
- quality selector per step, including a Diatonic option that clears `qualityOverride`
- active step selection for manual practice

The step row should show both function and resolved chord, for example `vi -> A min -> 2 bars` in C major.

### Top-Band Playback Controls

When progression mode is enabled, render compact playback controls in the consolidated top-band summary card over the fretboard. That card should remain the single home for scale degrees, chord practice cues, and progression playback context. The playback controls own practice flow:

- play/pause
- tempo
- loop on/off
- active step
- upcoming steps
- current step duration

The playback controls should compose with the existing chord practice bar rather than replacing its coaching cues. The active progression step should drive the same chord practice data already used today.

### Mobile

Add Progression as a fifth bottom tab. The narrow-width label is `Prog`; the full label is `Progression` where it fits. Keep the existing Key/Circle tab and shorten labels rather than hiding core navigation.

## Playback Behavior

Manual controls:

- selecting a step makes it active and updates the chord overlay
- next/previous moves to the next resolvable step
- play starts from the active step
- pause keeps the current active step visible

Timed loop:

- tempo converts step durations to milliseconds
- `1 bar` is 4 beats in v1
- playback wraps to the first resolvable step when loop is enabled
- when loop is off, playback stops at the final resolvable step

V1 advances visual chord state only. It does not add metronome sound or count-in behavior.

## Error Handling And Edge Cases

- If a step degree cannot resolve for the active scale, show it as unavailable.
- Auto-play skips unavailable steps.
- If every step is unavailable, playback cannot start and the top-band controls explain why.
- If a quality override is no longer present in the chord catalog, reset that step to Diatonic resolution.
- Changing key or scale keeps the degree sequence intact, resets the cursor to the first resolvable step, and recomputes labels.
- Switching to a fingering pattern that disables chord overlay pauses playback and shows the same disabled reason as the Chords panel.
- Per-note hidden chord tones reset when the active progression step changes, matching the existing chord identity behavior.
- If the progression step list becomes empty, progression mode remains enabled but the top-band controls and editor show an empty-state prompt to add or load steps.

## Testing Plan

Core tests:

- preset definitions resolve as expected
- key and scale remapping preserves degree sequence
- unavailable degree handling
- quality override fallback
- duration-to-millisecond conversion

Store tests:

- progression mode takes over resolved chord root/type
- disabling progression restores existing chord source behavior
- cursor resets on key/scale change
- playback skips unavailable steps
- disabled chord-overlay patterns pause playback
- quality writes update the active progression step

Component tests:

- load preset
- add/remove/reorder steps
- edit duration
- set and clear quality override
- manual next/previous step controls
- play/pause/loop controls

Visual tests:

- desktop Progression section in the Theory card
- compact progression playback controls in the top-band summary card
- mobile Progression tab
- disabled and empty progression states

## Implementation Notes

- Keep progression helpers pure and testable before wiring them into atoms.
- Prefer extending the chord source resolution layer over adding progression branches to fretboard rendering.
- Keep the Progression section and top-band playback controls as separate components so editing complexity does not leak into the practice surface.
- Add progression playback through `TopBandSummary` or a child composition boundary owned by it. Do not add a second competing playback surface.
- Use existing ToggleBar, StepperSelect, Card, and shared control-section patterns where they fit.
