# Generative Drum Beats (Slice F)

**Status:** Design — initial proposal.
**Date:** 2026-05-29
**Predecessors:** Drum Samples (Slice D)
**Theme:** Replacing static drum patterns with dynamically generated, evolving grooves.

---

## 1. Goal

Currently, the backing track relies on hard-coded drum arrays for each genre (e.g., `[kick, null, snare, null]`). We want to introduce a library to dynamically generate beats that fit the genre, adding subtle variations over time (fills, ghost notes) to completely eliminate the "drum machine" stiffness.

## 2. Library Options

### 2.1 Magenta.js (DrumsRNN)
**Google's Magenta.js** uses pre-trained recurrent neural networks (RNNs) to generate continuations of drum patterns.
- **Pros:** Highly realistic, non-deterministic phrasing. It inherently understands groove, fills, and syncopation.
- **Cons:** High bundle size and memory cost. The models must be downloaded and run via TensorFlow.js.
- **Use Case:** Perfect for an "AI Drummer" feature where the user hits "Generate Groove" and gets an evolving 16-bar pattern.

### 2.2 Scribbletune or Strudel
**Scribbletune** provides a string-based parsing engine for beats (`x-x_`). **Strudel** is based on TidalCycles.
- **Pros:** Lightweight. Great for algorithmic/procedural beats (e.g., Euclidean rhythms).
- **Cons:** Still fundamentally grid-based unless complex rules are written. Doesn't inherently "know" what a funk drum fill sounds like without explicit programming.

## 3. Proposed Approach: Hybrid Generative Engine

To balance bundle size and musicality, we should build a **Procedural + AI approach**:

1. **Procedural Base (Default):** Use a lightweight algorithm based on Euclidean rhythms and genre-specific probability matrices. 
   - E.g., for Funk: Kick has 100% probability on beat 1, 60% on the "a" of beat 2. Snare has 100% on 2 and 4, and 20% ghost notes on 16th off-beats.
   - This requires no heavy libraries and runs instantly.
2. **AI Drummer (Opt-in High Tier):** Integrate `Magenta.js DrumsRNN`.
   - The user selects a 1-bar "seed" groove (from the procedural base).
   - The AI generates the next 3 bars, naturally introducing fills and variations.
   - Model weights are lazy-loaded only when the user requests an AI generation.

## 4. Architecture

### 4.1 Generative Beat Store (`src/progressions/generative/beatGenerator.ts`)
- `generateBeat(genre, seedPattern, complexity): DrumHit[]`
- Handles routing between the procedural probability matrix and the `Magenta.js` worker (if enabled).
- **Complexity Parameter:** Controls the density of hits and likelihood of syncopation.

### 4.2 Seamless Looping
- Generative beats must still loop seamlessly. 
- The generator will output a fixed buffer (e.g., 4 or 8 bars) which is then scheduled by the existing Tone.js `Tone.Part` logic (from Slice A/B/C). 
- Every N bars, a background task can generate the *next* block of N bars to keep the track evolving indefinitely.

## 5. Risks
- **TensorFlow.js overhead:** Magenta can block the main thread. It must be run inside a Web Worker.
- **Genre Constraints:** Magenta models are generalized; achieving a specific stylistic pocket (e.g., Bossa Nova) might be hard with a pure RNN without specific fine-tuning. The procedural probability matrices might actually sound better for strict genres.
