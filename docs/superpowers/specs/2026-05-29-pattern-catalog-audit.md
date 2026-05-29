# Backing-Track Pattern Catalog Audit

**Status:** Design — initial proposal.
**Date:** 2026-05-29
**Scope:** Review and audit the existing chord, bass, and drum patterns (typically found in `src/progressions/audio/patterns.ts`). 

---

## 1. Goal

Before fully moving to generative beat and progression generation (Slices E and F), we need to ensure the existing static pattern catalogs (`chord`, `bass`, `drums`) are musically authentic, idiomatically correct for their genres, and optimized for the engine. This audit will identify stiffness, inaccuracies, or missing variations in the current hard-coded patterns.

## 2. Audit Criteria

The audit will evaluate the catalogs across three domains:

### 2.1 Drum Patterns (`getDrumPattern`)
- **Idiomatic Accuracy:** Does the "funk" pattern actually groove like funk (e.g., syncopated ghost notes on the snare, 16th note hi-hats), or is it just a basic rock beat? Does the "bossa" pattern use the correct clave rhythm?
- **Velocity Dynamics:** Are hits using dynamic velocities (e.g., accenting the downbeat on the ride, softer ghost notes on the snare) or are all hits at `velocity: 1`?
- **Fills & Turnarounds:** Are there any variations at the end of a 4-bar phrase, or is it a strict 1-bar loop?

### 2.2 Bass Patterns (`getBassPattern`)
- **Rhythmic Interlocking:** Does the bass rhythm accurately lock in with the kick drum for each genre? 
- **Note Selection (Role):** Are we over-relying on the root note? e.g., Does the jazz walking bass pattern properly utilize approach notes, 3rds, and 5ths, or is it just playing root quarter notes?
- **Duration/Articulation:** Are bass notes bleeding into each other (too long of a release) or cutting off too abruptly (staccato) for the genre?

### 2.3 Chord/Comping Patterns (`getChordPattern`)
- **Syncopation:** Are chords only playing on the downbeat, or are we using syncopated "pushes" (e.g., playing a chord an 8th note early, common in jazz and pop)?
- **Strum Directions:** For acoustic/rock genres, are the patterns mapping upstrokes and downstrokes correctly to simulate realistic guitar strumming?
- **Density:** Are the chord patterns leaving enough space for the bass and drums, or are they overly dense?

## 3. Action Plan (Output of the Audit)

Once the audit is conducted, it should produce a structured checklist of fixes, which may include:
1. **Refactoring the Pattern Data Structure:** Changing how velocities or articulations are stored to allow for more expression.
2. **Expanding the Catalog:** Adding `-variation` or `-fill` pattern IDs for the engine to alternate between.
3. **Genre Overhauls:** Rewriting specific weak genres (e.g., completely replacing the Bossa Nova beat).

## 4. Relationship to Other Slices
- This audit serves as a stop-gap quality pass. Even if Slices E and F (Generative content) are implemented, having high-quality static patterns remains essential for the "Eco" tier and as reliable fallback seeds.
- This audit should be executed alongside or immediately after **Slice C (Voice-Leading/Humanization)** to maximize the musical output.
