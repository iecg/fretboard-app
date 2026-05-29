# Backing-Track Musical Composition (Slice C) — DRAFT

**Status:** DRAFT outline — not implementation-ready. Needs its own brainstorming pass before a plan.
**Date:** 2026-05-28
**Predecessors:** audit `2026-05-21-backing-track-tonal-audit.md`; sound/mix slice `2026-05-28-backing-track-sound-and-mix-design.md`.
**Theme:** The *musical composition* half of "replace a YouTube backing track." Slice A+B makes it sound good; slice C makes it play musically. Tackle after A+B.

---

## Goal

Kill the "drum-machine / loop-pedal stiffness" and make the backing band sound like players reacting to a chord chart, not a grid.

## Candidate scope (to be refined in brainstorming)

1. **Voice-leading / nearest-inversion picker** (audit Win #2, biggest Tonal-side win).
   - Track the previous chord voicing; choose the next chord's inversion to minimize total semitone motion (via `Tonal.Note.midi` distance). New small module + state thread-through in `progressionAudio.ts` / scheduler.

2. **Register-aware bass** (audit Tonal #6).
   - Keep bass in a coherent register across keys instead of the hardcoded octave 2 (`PROGRESSION_BASS_ROOT_OCTAVE`). Range clamp (e.g. E1–E3) with nearest-pitch selection. Smarter chromatic approach with look-ahead to the next chord's root (currently a static semitone below).

3. **Humanization** (audit Win honorable mention).
   - Per-hit timing jitter (±~5 ms) and velocity wobble (±~0.05), applied at build/schedule time in `buildAllLayers.ts`. Optionally per-genre "tightness" amount. Swing stays as-is (already solid).

4. **Richer / more authentic patterns.**
   - Expand pattern catalogs: genre-idiomatic comping rhythms, walking-bass construction (jazz), syncopation, ghost notes. Possibly generate walking lines from chord tones + approach notes rather than fixed hit lists.

5. **Song structure & dynamics.**
   - Intro / turnaround / ending bars; fills at phrase boundaries; bar-to-bar dynamic variation (drop the kit in a verse, build a chorus). Velocity arcs across the loop.

6. **Tonal structural consolidation** (audit Tonal #1–5, optional cleanup).
   - `Tonal.RomanNumeral`, `Tonal.Progression`, `Tonal.Key.chords`/`secondaryDominants`, `Tonal.Mode` — unlock mode-appropriate chord pools and secondary-dominant suggestions; consolidate hand-rolled Roman-numeral parsing.

## Open questions

- How much variation before a *loop* stops feeling loopable? (Backing tracks need predictability too.)
- Should humanization be deterministic-seeded (so a loop repeats identically) or freshly random each pass?
- Is song-structure (intro/turnaround) in scope here, or a further slice?
- Walking-bass: rule-based generation vs expanded fixed patterns?
- Voice-leading interaction with the per-genre chord patches from A+B (inversions change which notes inserts/EQ hit).

## Dependencies

- Builds on A+B (patches/mix in place). Voice-leading changes which pitches sound, so tune A+B mix first.
