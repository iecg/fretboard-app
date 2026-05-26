# App Performance Audit Design

## Summary

Improve perceived app performance by extending the recent playback-oriented fretboard refactor into a broader render architecture: raw Jotai domain atoms remain the source of truth, but playback-facing UI surfaces should consume narrow, render-shaped view models instead of broad state aggregators.

The goal is to make playback, editing, and navigation feel closer to a desktop app by reducing subscription fan-out, isolating playback-tick updates from topology recomputation, and introducing explicit caching around the most expensive pure derivations.

## Problem Statement

Recent work improved fretboard playback behavior, but the app still has broader invalidation pressure outside the new fretboard snapshot boundary:

- `useFretboardState()` still aggregates many atom subscriptions into one render path for the fretboard container.
- `useProgressionState()` pulls playback, editing, transport, pattern, and preset state into one hook that powers multiple progression surfaces.
- Heavy pure derivations still live in broad derived atoms across chord, lens, shape, and voicing state.
- Timeline and transport surfaces remain coupled to broader progression updates than they need.
- Some layout and resize paths still update eagerly and can contribute to visible hitching during interaction.

The result is that even after the fretboard-specific improvements, playback smoothness and general responsiveness can still degrade when dense voicing logic, timeline rendering, inspector changes, and resizing interact.

## Goals

- Make playback transitions feel smooth and consistent across the fretboard, timeline, and transport surfaces.
- Reduce the amount of work triggered by playback ticks.
- Reduce Jotai subscription fan-out in hot UI paths.
- Introduce caching where expensive pure computations repeat across equivalent inputs.
- Produce a profiling-guided roadmap so future optimization work is prioritized by measured cost.

## Non-Goals

- Replacing Jotai.
- Rewriting the app in Canvas, WebGL, or a different rendering stack.
- Changing music-theory semantics, progression rules, or chord correctness.
- Refactoring unrelated UI that does not materially affect perceived performance.

## Current Observations

### 1. Aggregator hooks still widen invalidation

`useFretboardState()` currently pulls together scale, shape, layout, voicing, semantics, and overlay state for the fretboard container. `useProgressionState()` does the same for playback, transport, editing, presets, and backing-track controls.

These hooks are convenient, but they widen invalidation: a change in one field re-runs the whole hook and all downstream consumers that depend on its combined result.

### 2. Heavy Jotai selectors remain on the hot path

Several atoms still perform meaningful computation when musical context changes:

- `practiceLensAtoms.ts` builds note semantics, cue groups, and multiple note-role sets.
- `shapeAtoms.ts` builds shape coordinates, bounds, polygons, and interval-pair outputs.
- `chordOverlayAtoms.ts` and `voicingFallbackAtoms.ts` perform voicing selection, filtering, fallback scoring, and chord-highlight derivation.

These are appropriate domain computations, but they need clearer cache and invalidation boundaries so playback-facing UI does not repeatedly pay for them.

### 3. Playback surfaces still have separate render paths

The fretboard now has a playback snapshot boundary, but the timeline and transport surfaces still derive their display state through separate paths:

- `ProgressionTrack` rebuilds block and ruler layout from progression state.
- `ProgressionPositionReadout` already bypasses per-frame React updates, but still relies on its own imperative timeline reads.
- `useProgressionAudioPlayback()` subscribes to many atoms because it owns audio orchestration and playback lifecycle.

The app needs one broader rule for playback-facing state: playback ticks should update thin frame models, not re-run unrelated selector-heavy UI logic.

### 4. Layout churn is still eager

`useLayoutMode()` updates viewport width and height on every resize event. `Fretboard` also tracks container width and overflow eagerly via `ResizeObserver` and render-triggered effects. This is correct behavior, but the app currently lacks a unified strategy for throttling, coalescing, or isolating resize-driven work from other UI updates.

## Proposed Architecture

### Introduce surface-specific render view models

Keep domain atoms as the source of truth, but add a thin performance boundary between domain state and high-frequency UI surfaces. Instead of one broad app-state reader per area, introduce smaller render-oriented readers:

- `useFretboardTopologyModel()` for stable note, shape, and voicing topology.
- `useFretboardFrameModel()` for playback-phase emphasis and animated visual state.
- `useTimelineViewModel()` for progression block layout, active step display, and playhead state.
- `useTransportReadoutModel()` for transport-facing playback digits and display metadata.

The important rule is that these models are shaped for rendering, not for general domain composition.

### Separate four categories of work

### 1. Static topology

Data that changes only when musical or layout identity changes:

- note grids,
- shape polygons,
- connector/voicing candidates,
- timeline block layout,
- ruler tick layout.

### 2. Playback frame state

Data that changes with playback progression:

- displayed step index,
- current and next step identity,
- global and local playback fraction,
- playhead position,
- transition emphasis groups.

### 3. Interaction state

Data that changes because the user is editing or selecting:

- active inspector tab,
- selected progression step,
- active scale shape or position,
- voicing mode and string-set choices,
- overlay visibility and lens choice.

### 4. Async or precomputed caches

Pure derived results that are expensive enough to reuse across equivalent inputs:

- voicing candidate search,
- fallback voicing scoring,
- note semantic maps,
- shape/topology builders,
- timeline block/ruler layout outputs.

Playback ticks may update frame state, but they must not rebuild topology or invalidate caches whose keys did not change.

## Proposed Caching Strategy

### Cache topology and voicing work by musical identity

Cache pure results using compact, explicit keys:

- voicing candidates by chord root, quality, tuning, fingering pattern, and string-set scope,
- shape/topology outputs by root note, scale, tuning, fingering mode, and fret window,
- note semantics by scale identity plus active chord identity,
- timeline layout by resolved step list, durations, and meter.

Where possible, outputs should preserve structural sharing so unchanged branches retain referential equality.

### Prefer cache boundaries over wider subscriptions

Caching should not be a band-aid for broad subscriptions. The design should first narrow who subscribes to what, then cache the remaining expensive pure work behind those boundaries.

That means:

- the fretboard container should not subscribe to timeline-only display state,
- the timeline should not pull editing controls it does not render,
- playback ticks should not cause chord/shape recomputation,
- resize updates should not unnecessarily churn progression or fretboard topology.

## Jotai Strategy

Do not add more wide aggregator hooks or more scattered derived atoms that recombine the same raw state in slightly different ways.

Instead:

- keep domain atoms stable and explicit,
- add thin, render-shaped readers per surface,
- use derived atoms and hooks to preserve stable references for unchanged outputs,
- make equality and cache invalidation part of the design, not an afterthought.

This keeps Jotai useful for state composition while reducing the accidental coupling that currently spreads render work across unrelated UI paths.

## Audit and Profiling Plan

The audit should begin with measurement, then rank work by both cost and invalidation frequency.

### Instrumentation targets

- `useFretboardState()`
- `useProgressionState()`
- `practiceLensAtoms.ts`
- `shapeAtoms.ts`
- `chordOverlayAtoms.ts`
- `voicingFallbackAtoms.ts`
- `ProgressionTrack`
- `Fretboard`
- `FretboardSVG`
- resize-driven layout paths such as `useLayoutMode()`

### Metrics

- render counts per playback step,
- recomputation counts for expensive selectors and topology builders,
- wall-clock time spent in voicing, shape, and semantic derivation,
- which input changes triggered each recomputation,
- whether playback-only updates stayed inside frame models,
- whether displayed playback state remained aligned across fretboard, timeline, and transport.

### Benchmark scenarios

1. Idle editing in the inspector without playback.
2. Normal playback with standard chord overlays.
3. Dense playback with lead lens, connectors, and full voicings enabled.
4. Playback while resizing or changing active shape scope.

## Implementation Shape

The likely execution order is:

1. Add lightweight instrumentation for render and recomputation counts.
2. Identify the broadest invalidation edges in playback-facing UI.
3. Introduce timeline and transport view-model boundaries that match the recent fretboard snapshot pattern.
4. Split remaining aggregator hooks into topology, frame, and interaction readers.
5. Add explicit caches for the most expensive pure derivations that still dominate after the subscription split.
6. Re-profile and use the results to choose the next hotspot.

## Testing Strategy

### Referential stability tests

- prove playback-only changes do not rebuild topology or cached voicing/layout outputs,
- prove chord, shape, and tuning changes do invalidate the correct caches,
- prove unchanged outputs retain stable references across equivalent inputs.

### Integration tests

- fretboard, timeline, and transport stay aligned through play, pause, loop, and boundary transitions,
- inspector edits update the correct surfaces without broad replay of unrelated selectors,
- resize-driven updates do not disturb playback synchronization.

### Performance verification

Compare before and after:

- render counts,
- recomputation counts,
- selector timings,
- perceived hitching under the dense-playback scenario.

## Success Criteria

This design is successful when:

- playback ticks stay inside thin frame models for the major visual surfaces,
- expensive topology and voicing work is reused across equivalent inputs,
- timeline and transport updates stop widening invalidation into unrelated state,
- dense playback feels materially smoother,
- the next optimization step is driven by profiling data rather than guesswork.

## Risks and Trade-Offs

- More view-model boundaries add architecture, so naming and ownership must stay tight.
- Over-caching can increase complexity if profiling does not justify it.
- Some expensive work will still be necessary on real chord, shape, or tuning changes; the goal is to make those changes deliberate and bounded, not to eliminate recomputation entirely.

## Recommendation

Proceed with a design centered on playback-facing render containment plus explicit caching of expensive pure derivations. This is the best next step because it targets both root causes that still affect perceived smoothness:

1. broad subscription fan-out through aggregator hooks and shared selectors,
2. repeated topology and voicing work that should be isolated or reused.
