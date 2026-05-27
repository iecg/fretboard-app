# Performance Audit Design

**Date:** 2026-05-27  
**Topic:** FretFlow render/update latency audit  
**Status:** Approved for audit and implementation planning

## Summary

This design defines a hot-path-first performance audit for FretFlow. The goal is to identify the changes best positioned to make scale, chord, voicing, and playback interactions feel closer to a desktop app by reducing render latency, narrowing state invalidation, and simplifying high-frequency transitions.

The audit will produce a prioritized list of findings rather than implementation. Each finding will include the hotspot, suspected root cause, expected payoff, whether it is a **safe win** or **UX trade-off**, and whether it should be addressed with caching, dependency narrowing, or structural refactoring.

## Goals

1. Reduce render/update latency during root, scale, chord, and voicing changes.
2. Identify hot paths across Jotai state, fretboard topology building, and SVG rendering.
3. Surface repeated pure computations that should be cached.
4. Separate behavior-neutral optimizations from recommendations that trade visual fidelity for responsiveness.

## Non-goals

1. Implementing the optimizations in this design.
2. Redesigning unrelated product behavior or UI.
3. Optimizing startup and bundle size beyond findings that clearly affect perceived interaction smoothness.

## Audit Scope

The audit is organized around three connected workstreams.

### 1. State propagation

Trace root note, scale name, chord identity, voicing, fingering pattern, and playback updates through Jotai. The purpose is to find where a single user action widens into too many derived atom recalculations or broad component rerenders.

Primary focus areas:

- `src/hooks/useFretboardTopologyModel.ts`
- `src/store/scaleAtoms.ts`
- `src/store/chordOverlayAtoms.ts`
- `src/store/practiceLensAtoms.ts`
- `src/store/shapeAtoms.ts`

### 2. Topology and render pipeline

Trace those same updates through the fretboard rendering path:

- `src/components/Fretboard/Fretboard.tsx`
- `src/components/FretboardSVG/FretboardSVG.tsx`
- `src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts`
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`

The goal is to identify where note, connector, and shape rendering do more work than the visible change requires.

### 3. Caching opportunities

Identify pure computations with a small, stable input space and clear invalidation boundaries. The audit will explicitly distinguish between caches that simplify the hot path and caches that would be too fragile or broad to justify.

## Finding Classification

Every recommendation will be labeled as one of the following:

### Safe wins

Behavior-neutral improvements such as narrower subscriptions, stable references, reused lookup structures, and removal of repeated pure work.

### Architectural wins

Changes that simplify the hot path by moving expensive work out of broad atoms, large parent hooks, or mixed-responsibility builders.

### Caching candidates

Pure computations rebuilt frequently enough that shared memoization or store-level caching should materially reduce work.

### UX trade-offs

Changes that improve smoothness by reducing motion, transition frequency, or visual richness on high-frequency updates.

## Evidence Model

The audit will treat something as a hotspot only when it sits on the interaction path for one or more of the following:

- root note changes
- scale changes
- chord changes
- voicing changes
- playback frame or lead-lens updates

Each finding will name the observable effect it should improve, such as:

- fewer fretboard rerenders
- less derived atom churn
- less board-wide recomputation
- less playback-driven note rebuilding
- smoother connector and shape transitions

## Initial Priority Stack

The audit is expected to prioritize the following findings first.

### 1. Narrow the fretboard subscription boundary

`useFretboardTopologyModel.ts` aggregates many atom subscriptions into one hook that feeds the fretboard render path. This makes it easy for unrelated state changes to invalidate more of the tree than necessary.

Recommendation direction:

- split the model by render concern
- subscribe closer to consuming layers
- avoid a single broad aggregate object when only one subtree needs to change

Expected benefit:

- fewer parent rerenders
- less derived work on chord and scale changes

### 2. Introduce a shared board-layout cache

`getFretboardNotes(tuning, maxFret)` is recomputed in multiple interaction-sensitive places, including `Fretboard.tsx`, `shapeAtoms.ts`, and `chordOverlayAtoms.ts`.

Recommendation direction:

- shared cache keyed by tuning and max fret
- reuse one board layout in both store and render paths when invalidation boundaries match

Expected benefit:

- less duplicate work during chord, scale, and shape updates

### 3. Precompute polygon and position membership

`buildStaticFretboardTopology.ts` checks polygon membership during the main nested note-building loop, and `chordOverlayAtoms.ts` rescans the board in `addChordTonesWithinPolygon`.

Recommendation direction:

- precompute per-string fret ranges for polygons
- or build a `Set<string>` / lookup map of covered `"string-fret"` positions
- reuse the lookup in both note classification and chord highlight generation

Expected benefit:

- lower computational complexity on every hot-path rebuild
- less duplicated geometry work

### 4. Split topology building from display and animation concerns

`buildStaticFretboardTopology.ts` currently mixes note classification, chord-range checks, polygon membership, display label formatting, degree-color derivation, and octave parsing in one pass.

Recommendation direction:

- preserve one stable structural topology layer
- compute display-only concerns in smaller downstream stages
- isolate playback-only emphasis from static note classification

Expected benefit:

- fewer full-note-model rebuilds from display-only changes
- simpler cache boundaries

### 5. Centralize scale and chord context caches

Several atoms rebuild related pure structures independently, including scale note sets, degrees maps, chord member maps, and highlight sets.

Recommendation direction:

- cached scale context keyed by root note and scale name
- cached chord context keyed by chord root and chord type
- shared set/map reuse across composable selectors and fretboard builders

Expected benefit:

- less repeated pure work
- clearer ownership of invalidation

### 6. Further isolate playback-driven updates

Playback state currently feeds the lead-lens emphasis path and can still force note-view recomputation during active playback.

Recommendation direction:

- restrict playback updates to the minimal note-emphasis surface
- avoid rebuilding static note data when only playback emphasis changes

Expected benefit:

- smoother playback
- less visual stutter under the lead lens

### 7. Simplify transition remount behavior where updates are frequent

Shape and connector layers currently use group-level motion and keyed remount behavior. That is appropriate for low-frequency changes, but not every musical-state update needs a remount-style fade.

Recommendation direction:

- reduce remount-driven transitions on frequent updates
- use simpler CSS transitions or no transition for high-frequency paths
- keep richer transitions only where they are not on the core interaction hot path

Expected benefit:

- smoother rapid state changes
- less transition overhead

## Caching Candidates

The audit should explicitly evaluate the following for caching:

1. `getFretboardNotes(tuning, maxFret)`
2. `generateVoicings({ chordRoot, chordType, tuning, voicingType })`
3. scale-note arrays, sets, and degree maps keyed by root/scale
4. chord-tone arrays, member maps, and visibility-filtered chord sets keyed by chord identity
5. polygon coverage lookups keyed by shape selection and tuning-independent geometry inputs
6. rendered note geometry keyed by fret window and layout geometry, when safe to separate from semantic classification

The audit should explicitly avoid over-caching:

1. ephemeral playback frame state
2. DOM measurements
3. values whose invalidation boundary is broader than the recomputation cost

## Deliverable Shape

The final audit output should be a prioritized table or list where each item includes:

- hotspot
- current path
- suspected root cause
- computational pattern
- recommendation
- cache candidate or not
- safe win vs UX trade-off
- expected effect on perceived responsiveness

## Testing and Verification Guidance

This is an audit design, not an implementation plan, but recommendations should be framed so later work can verify them with concrete signals:

- reduced rerender count for the fretboard subtree
- reduced derived atom recomputation on chord and scale changes
- reduced board-wide scans during highlight and note classification work
- smoother playback and transition behavior under repeated updates

## Open Decisions Already Resolved

1. Prioritize render/update latency before bundle-startup work.
2. Separate safe wins from UX trade-offs in the final recommendations.
3. Use a hot-path-first audit instead of a Jotai-only or motion-only review.
4. Produce a prioritized audit, not implementation yet.
