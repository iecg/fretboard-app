# Progression Track Design

## Goal

When progression mode is enabled, replace the current top summary card with a DAW-style progression track. The new track should make playback state, bar position, scale context, tempo, and chord timeline visible in one compact surface above the fretboard.

This is a focused first slice. It does not redesign the full progression editor, and it does not add drag, resize, or reorder behavior to timeline blocks.

## Current State

`TopBandSummary` currently owns the scale strip, progression status summary, and chord practice bar. When progression is enabled, it renders a compact status section with a progression eye button and current/next text. Separately, `ProgressionPlaybackBar` renders transport controls and tempo below the fretboard.

The target design removes that split for progression playback. The summary slot becomes the playback track, while detailed editing remains in `ProgressionControls`.

## User-Facing Behavior

When `progressionEnabled` is false:

- Existing `TopBandSummary` behavior remains unchanged.
- The scale strip and chord practice bar continue to render as they do today.

When `progressionEnabled` is true:

- The existing `TopBandSummary` content is hidden completely.
- A new progression track renders in the same summary slot above the fretboard.
- The track contains a top transport/status row and a proportional timeline row.
- BPM is shown as a readout in the track, not edited there.
- The progression eye button is removed from this path.

The below-fretboard playback bar must not render when progression mode is enabled. The DAW track owns progression playback controls for this slice.

## Track Layout

The track surface follows the DAW reference:

- Left transport cluster: previous step, play/pause, next step, loop.
- Status lights: `Play` reflects `progressionPlaying`; `Loop` reflects `progressionLoopEnabled`.
- Position readout: displays current bar and active chord position in a compact monospaced style.
- Right readouts: tempo BPM and active scale label.
- Timeline ruler: displays bar numbers across the track.
- Chord blocks: one block per resolved progression step, proportional to step duration.
- Playhead: a vertical line aligned to the active step/bar position.
- Active block: visually highlighted and uses the app’s existing selected/accent semantics.

Initial block labels:

- Degree badge, such as `I`, `V`, `vi`, `IV`.
- Resolved chord label in shortened form where space is limited.
- Duration label, such as `1b` or `2b`.

## Interaction

The first implementation supports:

- Previous step.
- Play/pause.
- Next step.
- Loop toggle.
- Click a chord block to select that progression step.

The first implementation does not support:

- Dragging blocks.
- Resizing durations from the timeline.
- Reordering by drag.
- Editing BPM inside the track.

Those are future enhancements and should not be implied by cursor styling or hidden affordances.

## Component Plan

Add a new `ProgressionTrack` component for the progression-enabled summary surface.

`TopBandSummary` should remain responsible for the non-progression summary path. The parent summary slot can choose between:

- `ProgressionTrack` when progression mode is enabled.
- `TopBandSummary` when progression mode is disabled.

This keeps progression playback concerns out of the scale/chord practice summary and makes the replacement behavior explicit.

`ProgressionPlaybackBar` should not render in progression mode after this slice lands. The DAW track owns progression playback controls.

## Data Flow

The track reads existing progression state through `useProgressionState`:

- `progressionEnabled`
- `progressionPlaying`
- `progressionLoopEnabled`
- `progressionTempoBpm`
- `beatsPerBar`
- `currentProgressionBar`
- `totalProgressionBars`
- `activeProgressionStepIndex`
- `resolvedProgressionSteps`
- playback actions and selection actions

It reads active scale label from existing scale state.

No new persistent state is required for this slice.

## Responsive Behavior

Desktop and tablet:

- Render the full transport, status, position, tempo, scale, ruler, and chord blocks.
- Keep the track width aligned with the existing summary slot, but allow it to be wider than the current card if the layout has room.

Mobile:

- Keep all chord blocks visible if possible.
- Compress labels before changing structure: shortened chord names, compact duration labels, and smaller readout groups.
- Avoid horizontal page overflow.
- If space is too tight, make the timeline itself horizontally scrollable inside the track surface rather than allowing the app shell to overflow.

## Accessibility

- The track is a labelled `section` or `group` for progression playback.
- Transport buttons keep clear `aria-label`s and disabled states.
- Chord blocks are buttons with labels that include degree, chord name, duration, and active state when applicable.
- The playhead is decorative unless it becomes interactive in a future slice.
- Status lights use visible text, not color alone.

## Testing

Unit/component tests should cover:

- The progression track renders when progression mode is enabled.
- `TopBandSummary` does not render in progression mode.
- The non-progression summary path remains unchanged.
- Transport buttons call the existing progression actions.
- Chord blocks select the matching progression step.
- Tempo is rendered as a readout, not an editable control.

Visual coverage should include:

- Desktop progression track.
- Mobile progression track.
- Existing non-progression summary path, to confirm no regression.

## Open Non-Goals

These are intentionally outside this slice:

- Full progression controls redesign.
- Chord block drag and resize.
- Inline BPM editing in the track.
- Removing the chord practice bar eye behavior. That remains a separate polish item after the progression track lands.
