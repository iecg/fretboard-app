# Progression UI Polish Design

## Goal

Polish the chord progression UI by separating read-only musical status from editing controls. The fretboard top band should stay focused on what the player is practicing now, while the controls panel should expose one editing context at a time.

## Scope

This design applies to the existing chord progression feature on `codex/chord-progressions`.

In scope:

- Make the `Scale`, `Chords`, and `Progression` disclosures in `TheoryControls` mutually exclusive.
- Remove interactive progression transport controls from `TopBandSummary`.
- Add a compact read-only progression status row to `TopBandSummary` when progression mode is enabled.
- Move progression playback controls into the `Progression` disclosure.
- Improve progression control grouping without merging `Chords` and `Progression` into one `Chord Source` section.

Out of scope:

- A merged `Chord Source` section.
- More advanced song sketching beyond the current progression step list and timed loop.
- Any change to progression persistence, preset semantics, or chord resolution rules.

## Interaction Design

`TheoryControls` becomes an accordion. `Scale`, `Chords`, and `Progression` share one controlled open section state:

- Opening `Scale` closes `Chords` and `Progression`.
- Opening `Chords` closes `Scale` and `Progression`.
- Opening `Progression` closes `Scale` and `Chords`.
- Clicking the currently open section closes it.
- When `Chords` is disabled by the active fingering pattern, it remains collapsed and non-interactive.

The initial open section should preserve the current intent:

- Open `Chords` initially when a single chord is active and the Chords section is enabled.
- Otherwise open `Scale`.
- Do not automatically open `Progression` just because a saved progression exists; the top band and disclosure summary already surface that state.

## Top Band

`TopBandSummary` remains the over-fretboard musical status card.

When progression mode is off, it continues to show scale degree chips and the existing chord practice row when applicable.

When progression mode is on, it should show a compact, read-only progression row instead of transport controls. The row should expose:

- Current step degree and resolved chord label.
- Current step duration, using the same duration labels as the editor.
- Next playable step degree and resolved chord label.
- Step position such as `Step 1 of 4`.

If playback is blocked or the active step cannot resolve, the row should show the same musical status shape with a short disabled/unavailable message rather than controls.

The top band must not include play, pause, previous, next, loop, or tempo controls.

## Progression Controls

The `Progression` disclosure owns editing and transport:

- Progression mode toggle.
- Preset buttons.
- Step list.
- Previous, play/pause, next, loop, and tempo controls.
- Add, remove, and reorder controls.
- Active step degree, duration, and quality controls.

Playback controls should sit near the top of the Progression content, after the mode toggle and before the preset/step editor, so the user sees the active transport state before editing details.

The existing `ProgressionPlaybackBar` can be reused, but it should be styled as an in-panel control rather than as part of the top band.

## Component Boundaries

`TheorySection` should support controlled open state while preserving its current uncontrolled behavior for isolated tests and reuse:

- Existing `defaultOpen` behavior remains available.
- Optional `open` and `onOpenChange` props allow `TheoryControls` to coordinate the accordion state.
- Disabled sections report closed and ignore toggles.

`TopBandSummary` should not know how to edit progression state. It may read progression state to render current/next status, but write actions should remain in `ProgressionControls` and `ProgressionPlaybackBar`.

## Testing

Unit/component coverage should verify:

- `TheoryControls` opens only one of `Scale`, `Chords`, or `Progression` at a time.
- A disabled Chords section stays collapsed and cannot steal accordion state.
- `TopBandSummary` renders progression current/next/duration/step status when progression mode is enabled.
- `TopBandSummary` does not render progression transport controls.
- `ProgressionControls` renders playback controls in the Progression disclosure.

Visual coverage should update the affected desktop/mobile snapshots after the UI settles.

## Acceptance Criteria

- Chords and Progression can no longer be open at the same time.
- Scale, Chords, and Progression behave as a single accordion group.
- The top band shows current and next progression context, including duration or bar information.
- All progression transport controls live inside the Progression disclosure.
- Existing progression state behavior and persistence remain unchanged.
