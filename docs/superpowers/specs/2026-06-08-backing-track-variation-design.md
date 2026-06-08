# Backing Track Variation Design

## Overview
The backing tracks (drums, bass, chords) currently rely on 1-bar or 2-bar static loops. This creates a predictable and monotone feel over longer progressions. This design introduces a two-tiered system to break this monotony while preserving the strict genre-specific groove coupling (e.g., locking the bass and chords in funk or bossa nova).

## Architecture & Components

The solution is divided into two major components: Structural Phrasing and the Safe Humanizer.

### 1. Structural Variation & Phrasing
This layer handles the macro-phrasing of the backing track, ensuring patterns evolve naturally over 4-bar or 8-bar cycles.

* **Extended Base Patterns:** Core static patterns can be authored as longer 4-bar or 8-bar phrases directly in the catalog, allowing the bass or chords to evolve without complex generation logic. The existing `absoluteBar % bars` modulo math in the audio renderer fully supports this.
* **Variation Events:** We will introduce `ChordVariation` and `BassVariation` models, mirroring the existing `DRUM_VARIATIONS` system.
  * These variations specify a `barInterval` (e.g., 4) and a `barPhase` (e.g., 3 for a turnaround bar).
  * When `absoluteBar` aligns with the variation interval, the audio renderer will substitute the base pattern with the variation pattern for that bar.
  * This allows tightly authored, genre-locked fills (e.g., a funk turnaround that pushes the bass and chords in sync).
* **Density Selection:** The engine will accept a density tier (Sparse, Normal, Busy) as an optional parameter, allowing the variation system to swap to busier fills at the end of progressions, or sparse loops during intro sections.

### 2. The Safe Humanizer Pass
A post-processing filter applied within `buildAllLayers.ts` immediately before hits are returned to the scheduler. This pass guarantees no two loops sound identical without risking rhythm collapse.

* **Velocity Jitter:** Every returned hit will have a randomized velocity offset (e.g., +/- 5-10%) to prevent "machine gun" repeating sample triggers.
* **Micro-timing Jitter:** Hits will receive tiny timing offsets (e.g., +/- 10ms).
  * **Groove Lock:** Anchor beats (such as beat 0 and beat 2 in 4/4) will receive zero or significantly less timing jitter to maintain the structural pulse. Off-beats (e.g., 16th note subdivisions) will receive more jitter.
* **Probabilistic Ghost Dropping:** The humanizer calculates a drop chance based on velocity.
  * Low-velocity hits (< 0.4 velocity) have a small probability (e.g., ~10-15%) of being completely removed from the output array.
  * High-velocity structural hits (> 0.7 velocity) have a 0% drop chance.
  * This simulates a player occasionally skipping a scratch or ghost strum naturally.

## Data Flow
1. `buildAllLayers.ts` iterates over the progression step and determines `absoluteBar`.
2. For each instrument, it fetches the base pattern.
3. It checks for applicable Variations (`DrumVariation`, `ChordVariation`, `BassVariation`) for the current `absoluteBar` and substitutes the hits if matched.
4. It slices and repeats the pattern to fill the required beats for the step.
5. It passes the final array of hits through the Safe Humanizer function.
6. The humanized hits are returned to the playback scheduler.

## Testing
* **Variation Firing:** Unit tests will verify `variationFiresOnBar` for chords and bass, ensuring turnarounds trigger exactly when expected.
* **Humanizer Bounds:** Tests will ensure that the humanizer never shifts a beat out of bounds (negative time or beyond the step length), never drops high-velocity notes, and keeps jitter within defined parameters.
