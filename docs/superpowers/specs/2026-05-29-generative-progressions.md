# Generative Chord Progressions (Slice E)

**Status:** Design — initial proposal.
**Date:** 2026-05-29
**Predecessors:** Composition (Slice C)
**Theme:** Moving from static, hard-coded progression templates to dynamic, context-aware progression generation.

---

## 1. Goal

Currently, the "suggested for <scale>" feature uses static progression templates where only the chord qualities adapt. This feels repetitive. The goal is to dynamically generate musically compelling chord progressions that feel native to the selected scale and genre, utilizing established music theory or lightweight generative algorithms.

## 2. Approach

Instead of relying on an ML model like Magenta.js (which carries a large payload), we can leverage **Tonal.js** (already in the project) or **Scribbletune** to build a procedural progression generator. 

### 2.1 Procedural Generation using Tonal.js
Tonal.js has all the building blocks for a rules-based generator:
- **Diatonic Base:** Use `Tonal.Key.chords(key)` or `Tonal.Mode.triads(mode, root)` to establish the safe pool of native chords.
- **Functional Harmony Rules:** Define Markov-chain-like transition probabilities for chord functions (e.g., Tonic -> Subdominant -> Dominant -> Tonic).
- **Secondary Dominants:** Use `Tonal.Key.secondaryDominants(key)` to dynamically insert tension before a resolution (e.g., inserting V/ii before moving to a ii chord).
- **Modal Interchange:** Borrow chords from parallel modes to add color, governed by genre rules (e.g., common in jazz and rock, rare in folk).

### 2.2 Scribbletune Integration (Alternative)
[Scribbletune](https://scribbletune.com/) offers a higher-level API for algorithmic generation.
- It can parse string-based pattern syntax to generate chords.
- Helpful if we want to also define complex rhythms alongside the chords.
- *Trade-off:* Adds a new dependency for something we can largely achieve with Tonal.js functional rules.

## 3. Architecture

### 3.1 Progression Generator Engine (`src/progressions/generative/progressionGenerator.ts`)
- `generateProgression(scaleName, genre, lengthInBars): string[]`
- **Inputs:** 
  - `scaleName`: Defines the tonal center and available diatonic chords.
  - `genre`: Influences the complexity (e.g., jazz uses 7ths/9ths and frequent secondary dominants; pop uses triads and 4-chord loops).
  - `lengthInBars`: Usually 4, 8, or 16.
- **Output:** An array of chord symbols (e.g., `["Cmaj7", "A7", "Dm7", "G7"]`).

### 3.2 UI Integration
- In the "Progression" dropdown/card, replace the static "Suggested" list with a "Generate New Idea" button or an auto-populated list of 3 generated options.
- Allow the user to "lock" certain chords and regenerate the rest.

## 4. Risks & Considerations
- **Musicality:** Pure random generation sounds disjointed. The generator must enforce strong cadences (resolutions) at the end of phrases.
- **State Management:** Generated progressions need to be saved to the `progressionAtoms` just like custom-built ones, so the user doesn't lose them on reload.
