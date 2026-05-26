# Fretboard Transition Performance Design

## Summary

Improve progression-playback smoothness by restructuring the fretboard render pipeline around a single playback-synced visual snapshot instead of letting playback-time Jotai updates fan out through `FretboardSVG`, `useNoteData`, lens atoms, and connector/voicing derivation independently.

The design keeps the current domain model intact, but splits fretboard work into three layers:

1. **Static geometry** — fretboard layout, string/fret coordinates, SVG defs.
2. **Musical topology** — note coordinates, shape membership, voicing candidates, connector topology.
3. **Frame-local visual state** — playback-timed emphasis, opacity, active/next-step highlighting, and other transition-only visuals.

This should reduce transition jank during progression playback, especially when connectors, full chord voicings, and lead-lens visuals are all active.

## Problem Statement

Recent connector work reduced one major source of transition cost, but the fretboard still has broader playback-time invalidation pressure:

- `FretboardSVG` subscribes directly to playback-sensitive lens atoms (`commonTonesWithNextAtom`, `nextChordGuideTonesAtom`, `beatPositionAtom`, `activeStepDurationBeatsAtom`).
- `useNoteData` still recomputes a full visible-note model, including per-note shape scans and semantic classification, inside one large memo.
- Playback-synced visual consumers already need special handling around displayed/audio-synced progression state (`displayedProgressionStepIndexAtom`) versus logical progression state.
- Some render-layer work remains inline in map loops during hot updates, especially in the note layer and any path/voicing work that is still coupled to render-time derivation.

The result is that chord transitions can still feel late or uneven under heavier playback scenarios, even when the audio and timeline are behaving correctly.

## Goals

- Make progression chord transitions feel closer to a native desktop app under real playback conditions.
- Reduce the amount of fretboard work triggered on each playback-time update.
- Narrow Jotai subscription fan-out during playback.
- Separate topology recomputation from frame-local styling and timing.
- Add a concrete profiling loop so further optimization work can be prioritized by measurement instead of guesswork.

## Non-Goals

- Replacing Jotai as the state model.
- Rewriting the entire fretboard rendering system in Canvas/WebGL.
- Changing music-theory behavior, chord semantics, or progression playback rules.
- Refactoring unrelated UI outside the fretboard/playback surfaces.

## Current Hotspots

### 1. Playback-time fan-out through `FretboardSVG`

`FretboardSVG` currently reads multiple playback-sensitive atoms directly. That is convenient, but it means playback ticks can invalidate the whole SVG orchestration layer even when only a small amount of visual state actually changed.

### 2. Full-grid note derivation in `useNoteData`

`useNoteData` walks the visible grid and performs multiple checks per note:

- hidden/highlight/chord/color membership checks,
- enharmonic checks,
- shape-membership scans,
- playable-context derivation,
- semantic classification,
- lens-emphasis derivation.

Much of that is musical topology or shape context, not true frame-local animation state.

### 3. Remaining coupling between voicing selection and render-time work

Connector topology is now better split from geometry, but the surrounding voicing/chord-selection pipeline still appears coupled to broader fretboard derivation. That makes it harder to isolate what should change on a chord change versus what should change on a playback tick.

### 4. Render-layer work inside hot maps

`FretboardNoteLayer` still computes note geometry, SVG primitives, and some shape-specific render details inside per-note render loops. That is fine for occasional state changes, but it becomes expensive when playback cadence repeatedly invalidates the subtree.

### 5. Display-synced playback state is still a cross-cutting concern

The codebase already distinguishes displayed progression state from logical progression state to keep the timeline/readout aligned with audio. The fretboard should consume the same display-synced playback view through one boundary, rather than recreating timing-sensitive derivations in multiple places.

## Proposed Architecture

### Introduce a fretboard playback snapshot

Create a single progression-synced read model for fretboard visuals, produced by a new orchestration hook above `FretboardSVG`.

Working name:

- `useFretboardPlaybackSnapshot`

Its job is to read the playback-sensitive store state once and produce a compact immutable snapshot shaped for rendering, not for general domain composition.

The snapshot should contain only the fields the fretboard needs during playback, for example:

- displayed active step identity,
- next-step preview identity,
- playback fraction / beat position,
- resolved emphasis groups,
- active connector/voicing identity,
- any transition flags needed by the fretboard layers.

The important part is not the exact field list; it is the boundary. Playback-sensitive data should enter the fretboard pipeline once, in a render-shaped form.

### Split fretboard work into three layers

#### 1. Static geometry

This layer contains data that changes only when layout/viewport geometry changes:

- fret/string geometry,
- SVG defs,
- base neck layout,
- static sizing constants.

#### 2. Musical topology

This layer contains geometry-independent or low-frequency musical structure:

- visible note coordinates,
- active-shape membership,
- chord-eligible coordinates,
- voicing candidates,
- connector topology,
- stable note identifiers.

This should update on chord/scale/shape/viewport-topology changes, not on every playback tick.

#### 3. Frame-local visual state

This layer contains only playback-time visual outputs:

- active versus upcoming emphasis,
- opacity boosts,
- guide-tone/tension treatment,
- transition phase/fraction,
- any playback-timed visual focus changes.

This layer should be cheap enough to update at playback cadence without rebuilding note topology or re-running expensive candidate selection.

## Proposed Component and Hook Boundaries

### `useFretboardPlaybackSnapshot`

New orchestration hook that consumes playback-synced progression state and exposes one render-oriented snapshot.

### `useStaticFretboardTopology`

New or extracted hook that resolves topology-level note data and chord/shape membership independently of playback fraction. This is the place to move work that currently lives in the large `useNoteData` memo when that work is not truly frame-local.

### `useAnimatedFretboardView`

Hook that combines the playback snapshot with static topology and returns only the per-frame note/connector styling that the view layer needs.

### `FretboardSVG`

Should become thinner again:

- receive playback snapshot outputs rather than reading multiple playback atoms directly,
- keep geometry orchestration,
- pass already-shaped data into note/shape/connector layers,
- avoid being the place where playback-sensitive domain derivation happens.

### Render layers

`FretboardNoteLayer`, `FretboardShapeLayer`, and `FretboardConnectorLayer` should increasingly behave like presentational layers consuming already-shaped data. Their hot-path work should be limited to final SVG output, not domain recomposition.

## Jotai Strategy

Do not add more scattered derived atoms that each reconstruct their own fretboard playback view.

Instead:

- keep existing domain atoms as the source of truth,
- introduce one narrow fretboard playback read model,
- shape selector outputs around rendering needs,
- preserve stable references for unchanged subtrees whenever possible.

That means preferring outputs like:

- `activeVoicingKey`,
- `connectorSet`,
- `emphasisByPosition`,
- `playbackFraction`,
- `activeStepKey`,

instead of forcing multiple consumers to recombine raw progression/lens atoms on their own.

This should also reduce timing drift risks because the fretboard animation path can consistently key off the displayed/audio-synced progression state from one place.

## Audit and Profiling Plan

The work should begin with a short measurement pass before refactoring:

### Instrumentation targets

- `FretboardSVG`
- `useNoteData`
- connector/voicing derivation hooks
- the new playback snapshot hook once introduced

### Benchmark scenarios

1. Simple progression with low connector density.
2. Dense progression with full chord voicings and connectors visible.
3. Lead lens enabled during playback.
4. Zoom/scroll changes during playback.

### Metrics to capture

- number of renders per progression step,
- number of topology recomputations per progression step,
- time spent in note classification,
- time spent in connector/voicing derivation,
- whether playback-time updates invalidate the whole fretboard or only targeted layers,
- whether visible state stays aligned with the displayed progression step.

The output of the audit should rank hotspots by measured cost and invalidation frequency, not just by code complexity.

## Implementation Shape

The likely implementation order is:

1. Add measurement/instrumentation to identify playback-time invalidations and recomputation counts.
2. Introduce the fretboard playback snapshot/read model based on displayed progression state.
3. Move `FretboardSVG` off direct playback-atom subscriptions.
4. Split `useNoteData` responsibilities into topology versus frame-local styling.
5. Re-profile and identify the remaining dominant cost.
6. Apply a second-pass refactor to the biggest remaining hotspot, likely voicing selection, note-layer shaping, or connector follow-through.

## Testing Strategy

### Unit and hook coverage

- tests for the fretboard playback snapshot/read model,
- tests proving topology outputs stay referentially stable across playback-only updates,
- tests proving frame-local visual outputs change without rebuilding topology.

### Integration coverage

- fretboard visuals follow the displayed/audio-synced progression step during playback,
- no regression in stopped-state behavior,
- no mismatch between fretboard visuals and header/timeline display timing.

### Performance verification

Use the new instrumentation to compare:

- before/after render counts,
- before/after recomputation counts,
- before/after hotspot timings under the dense progression scenario.

## Success Criteria

This design is successful when:

- playback transitions no longer trigger broad fretboard recomputation for every visual tick,
- visible chord transitions stay aligned with the displayed progression frame,
- dense connector/voicing playback feels materially smoother,
- the performance roadmap is backed by measurements that clearly identify the next bottleneck.

## Risks and Trade-Offs

- Introducing a new read-model boundary adds architecture, so it needs tight naming and ownership to avoid duplicating the domain layer.
- Over-normalizing too early could make the code harder to reason about if profiling does not justify it.
- Some expensive work may still remain necessary on chord boundaries; the goal is to make playback ticks cheap and predictable, not to eliminate all recomputation.

## Recommendation

Proceed with a plan centered on the fretboard playback snapshot and the topology-versus-frame-state split. This is the best path to meaningful playback smoothness improvements because it addresses both of the likely root causes at once:

1. too much work happening on playback-time updates, and
2. too many consumers deriving their own playback-sensitive view of the same progression state.
