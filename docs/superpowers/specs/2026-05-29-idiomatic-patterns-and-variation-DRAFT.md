# Idiomatic Patterns and Rhythmic Variation

## Goal
Evolve the backing track pattern engine to play drum and chord patterns idiomatically, respecting genre conventions and multi-bar phrasing rather than repeating static 1-bar loops indefinitely. 

## Objectives
1. **Jazz Ride Realism:** Overhaul the `jazz-ride` pattern so it isn't simply a hi-hat playing the ride rhythm. Incorporate a real ride voice, kick drum comping, and subtle snare ghost notes. Rebalance gain so it sits in the mix.
2. **Bossa Nova Authenticity:** Rewrite the bossa nova drum pattern to feature the authentic clave rhythm (cross-stick/rim-shot), syncopated kick ("heartbeat"), and straight 8th hi-hats. 
3. **Phrase-Aware Progression Rhythms:** Allow genres (like Pop) to delay chord hits appropriately (e.g., waiting for beat 1) without breaking the loop rhythm when repeating. 
4. **Multi-Bar Variation:** Introduce dynamic variation over 2-bar or 4-bar phrases (e.g., turnaround fills, bass walks at the end of a 4-bar phrase) so the engine feels musical and responsive over time.

## Implementation Plan
1. **Catalog Update:** Audit and replace the `jazz-ride` and `bossa` pattern arrays in `patterns.ts`. Ensure new instrument voices (like rimshot or ride) are supported by the drum machine.
2. **Scheduler Enhancement:** Modify `buildAllLayersAsync` to accept or calculate a phrase length (e.g., 4 bars). 
3. **Dynamic Hits:** Update the pattern resolution logic to vary the pattern based on the current bar index modulo the phrase length (e.g., `bar % 4 === 3` for a drum fill).
