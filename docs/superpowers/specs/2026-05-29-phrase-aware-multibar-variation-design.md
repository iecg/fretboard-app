# Phrase-Aware Rhythm & Multi-Bar Variation (Slice 2)

**Status:** Design — drafted, NOT yet brainstormed to approval. Successor to Slice 1.
**Date:** 2026-05-29
**Supersedes:** `2026-05-29-idiomatic-patterns-and-variation-DRAFT.md` (this is the refined version of that DRAFT).
**Depends on:** `2026-05-29-pattern-catalog-targeted-pass-design.md` (Slice 1) landing first.

> **Note:** This spec is the next-slice plan. It captures the deferred items so
> they aren't lost, but the concrete beat tables and engine signatures here
> should be re-confirmed in a dedicated brainstorming pass before a plan is cut.

---

## 1. Goal

Evolve the backing-track engine from infinite 1-bar loops into a phrase-aware
machine: chord rhythms that respect bar position, and drum/bass variation that
develops over 2- and 4-bar phrases (turnarounds, fills, end-of-phrase walks).
Plus the one genre overhaul Slice 1 deferred: an authentic bossa-nova beat.

## 2. Why this is a separate slice

Slice 1 improves *static* pattern content within the existing per-bar scheduler.
This slice changes the **scheduler's notion of time** — it must know "which bar
of the phrase am I in" to vary output. That's a structural change to
`buildAllLayersAsync` and the pattern-resolution contract, with broader blast
radius (every genre, every playback path). Keeping it separate keeps Slice 1
shippable and low-risk.

## 3. Objectives

### 3.1 Phrase length in the scheduler

`buildAllLayersAsync` currently iterates bars within a step but has no concept of
a repeating *phrase*. Add a `phraseLengthBars` (default 4) to `BuildAllLayersInput`
and compute a running absolute bar index across the whole progression (not reset
per step), so variation logic can key off `absoluteBar % phraseLengthBars`.

### 3.2 Multi-bar drum variation

Today `DRUM_VARIATIONS` fire on a fixed `barInterval` relative to bar 0 of each
*step*, not the phrase. Re-key variations to the absolute phrase position so a
`fill-every-4` actually lands on the 4th bar of each phrase regardless of how the
progression's steps are chopped. Add genre-appropriate default variation sets
(e.g. jazz turnaround fill on `bar % 4 === 3`).

### 3.3 Phrase-aware chord rhythm

Allow a chord pattern to declare position-conditional hits — e.g. a pop pattern
that "waits for beat 1" on phrase-start bars but pushes (anticipates) into the
downbeat on the bar *before* a chord change. Proposed: an optional
`phraseVariants` map on `ChordPattern` keyed by bar-in-phrase, with the base
`hits` as fallback. Must not break the loop feel when a single chord spans a
whole phrase.

### 3.4 End-of-phrase bass walk

When a phrase's last bar precedes a chord change, let the bass play a
walking/approach figure into the next root even if the active bass pattern isn't
"walking" — a turnaround tail. Reuse the existing `chromatic-approach` role and
the `isLastBar` signal already present in `buildAllLayers.ts`.

### 3.5 Bossa-nova overhaul

Rewrite the `bossa` drum pattern around the authentic 2-bar clave:
cross-stick/rim clave rhythm, syncopated "heartbeat" kick, straight-8th hats.
Requires a **cross-stick / rim voice** in the drum kit (new voice in
`drumKit.ts` + `instrumentPatches.ts`), since clave is the defining timbre.
This is inherently a 2-bar pattern, so it depends on §3.1.

## 4. Open design questions (resolve in brainstorming)

- **Pattern data model for phrase variants:** inline `phraseVariants` on each
  pattern vs. a separate "phrase template" layer that composes 1-bar patterns.
  Trade-off: data locality vs. combinatorial bloat.
- **Determinism:** variation must stay deterministic (the engine seeds jitter by
  step/bar/beat today). Phrase variation must be a pure function of absolute bar
  index, not RNG, to keep playback reproducible.
- **Backwards compatibility:** a pattern with no phrase data must behave exactly
  as it does today (pure 1-bar loop).
- **Cross-stick voice synthesis:** MetalSynth vs. a filtered noise burst for the
  rim/clave timbre — needs an audition.
- **UI exposure:** do phrase length and per-genre variation sets stay
  engine-internal (genre-driven) or get surfaced? (Slice 1 kept variations
  hidden; revisit here.)

## 5. Out of scope

- Generative beat/progression generation (Slices E/F) — this slice keeps content
  static but phrase-structured.
- Any change to the Slice 1 pattern content beyond what phrase-awareness requires.

## 6. Testing Strategy (preliminary)

- Unit-test the absolute-bar-index computation across multi-step, mixed-duration
  progressions.
- Unit-test that `absoluteBar % phraseLengthBars` selects the right variant and
  that a no-phrase-data pattern is byte-identical to today's output.
- Bossa clave: assert the 2-bar hit layout matches the reference rhythm.
- Determinism: same input → identical event stream across runs.
```
