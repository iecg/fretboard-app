# Backing Track Variation Design

## Overview
The backing tracks (drums, bass, chords) currently rely on 1-bar or 2-bar static loops. This creates a predictable and monotone feel over longer progressions. This design introduces a two-tiered system to break this monotony while preserving the strict genre-specific groove coupling (e.g., locking the bass and chords in funk or bossa nova).

## Current State (what already exists — do not rebuild)

This spec extends an existing system. Before authoring anything, read these and reuse them:

* **The humanizer already exists.** `src/progressions/audio/humanize.ts` exports `applyJitter`, a **deterministic, seeded** (Mulberry32) per-hit jitter that already applies:
  * **Velocity jitter** — default `velocityAmount = 0.1` (±10%); drums override to `0.05`.
  * **Micro-timing jitter** — default `timeAmountSec = 0.015` (±15ms); drums override to `0.005`.
  * It is already called inline in `buildAllLayers.ts` for chord strums, bass, and drums (lines ~299, ~392, ~423). It is **not** a single post-processing pass over the assembled arrays — it runs per-hit inside the bar loop.
  * It already supports per-hit grid-locking (`timeAmountSec: 0`) — used today to lock the bossa LH bass to the grid so it doesn't flam against the upright.
  * **Gaps in the existing humanizer (this is the actual new work):** there is **no groove-lock by beat position** (anchor beats are not de-jittered today) and **no probabilistic ghost dropping** (`applyJitter` always returns exactly one hit).
* **The `DrumVariation` model already exists.** `patterns.ts` defines `DrumVariation { id, label, barInterval, barPhase?, pattern }`, the `DRUM_VARIATIONS` catalog (6 variations), `getDrumVariation`, and the pure gating predicate `variationFiresOnBar(variation, absoluteBar)`. **`variationFiresOnBar` is already generic** — it reads only `barInterval`/`barPhase`, so it can gate chord and bass variations without duplication.
* **Drum variations are ADDITIVE, not substitutive.** In `buildAllLayers.ts` (line ~418) firing variation hits are *layered on top* of the base bar: `[...baseForBar, ...firingVariationHits]`. This contradicts the original draft's "substitute the base pattern" language — see §1 for the resolved semantics.
* **Genre coupling already has a home: `GenreStyle` in `src/progressions/audio/genres.ts`.** Each genre bundles `chordPattern`, `bassPattern`, `drumPattern`, **`drumVariations: string[]`**, tempo, and swing. `applyGenreStyleAtom` (in `progressionAtoms.ts`) fans these into the per-instrument atoms. **This is the mechanism that guarantees genre lock** — see §3.
* **Extended (4/8-bar) base patterns already work for bar-unit steps.** `sliceCellToBar(hits, absoluteBar % bars, beatsPerBar)` (used when `isBarUnit && cellBars > 1`) already selects the correct bar of a multi-bar cell. The 2-bar `bossa-comp` / `bossa` patterns prove the path. **Caveat:** for *beat-unit* steps (duration measured in beats, not bars) the code falls back to `repeatPatternToBeats`, which only emits bar 0 of the cell — extended patterns silently collapse there. Acceptable for now; call it out in tests.

## Architecture & Components

The solution has two tiers: **Structural Variation** (macro-phrasing) and the **Safe Humanizer** (micro-variation). They are independent and can ship separately.

### 1. Structural Variation & Phrasing
This layer handles macro-phrasing, ensuring patterns evolve naturally over 4-bar or 8-bar cycles.

* **Extended Base Patterns:** Authored directly in the catalog as 4-bar or 8-bar `bars: N` cells. **No renderer change required** — the existing `sliceCellToBar` / `absoluteBar % bars` path supports them (see Current State caveat for beat-unit steps). This is purely catalog authoring + tests.

* **Variation Events:** Introduce `ChordVariation` and `BassVariation` models mirroring `DrumVariation`. Each specifies a `barInterval` and optional `barPhase` (e.g. `barInterval: 4, barPhase: 3` for a turnaround bar). Reuse `variationFiresOnBar` for gating — do **not** duplicate the predicate.

  * **Substitution semantics (must be decided, not left implicit):**
    * **Drums** stay **additive** (unchanged) — a fill *adds* a crash/snare-roll over the base groove.
    * **Chords and bass** are **substitutive** — when a chord/bass variation fires, its hits **replace** the base pattern's hits for that bar (a turnaround re-voices the whole bar; layering two harmonic patterns would collide). When **no** variation fires, the base pattern plays unchanged.
    * **Multiple variations on the same bar:** at most one substitutive (chord/bass) variation may fire per bar. If two are configured to fire on the same `absoluteBar`, the **first in catalog order wins** (document this; tests must cover it). Additive drum variations may still stack (current behavior).
  * This enables tightly authored, genre-locked fills (e.g. a funk turnaround that pushes bass and chords in sync — see §3 for how sync is guaranteed).

* **Density Selection — DEFERRED (out of scope for this slice).** Sparse/Normal/Busy tiers, "intro" vs "end-of-progression" detection, and per-density pattern variants are a separate subsystem with no data model today (the catalog has no section/density tags, and nothing detects progression sections). Folding it in here would balloon scope and violate YAGNI. **Recommendation:** ship Extended Patterns + Variation Events + the Humanizer first; spec Density Selection separately once those land. If it must stay, it needs its own design covering: the density data model, how sections are detected, and how density maps to pattern selection.

### 2. The Safe Humanizer Pass
Extends the existing `applyJitter` (do not replace it) with the two missing behaviors. The "no two loops sound identical" guarantee already holds *across bars* because the seed incorporates `stepIndex`/`bar`/`beat`; the new work prevents identical-sounding *repeats of the same pattern* and the machine-gun effect on repeated low-velocity samples.

* **Velocity Jitter:** Already implemented (±10% chords/bass, ±5% drums). **No change** unless tuning is desired — if so, state the new values explicitly rather than the draft's vague "±5-10%."
* **Micro-timing Jitter:** Already implemented (±15ms chords/bass, ±5ms drums). The original draft's "±10ms" conflicts with the shipped defaults — **keep the existing values** unless a deliberate retune is intended, in which case name them.
  * **Groove Lock (NEW):** Integer beats (`beat % 1 === 0` — meter-agnostic) receive **reduced** timing jitter (~40% of full, i.e. ~6ms when full is 15ms) to hold the structural pulse; off-beats (`.5`, `.25`, `.75` subdivisions) receive full jitter. **Not zero** on integers — zero-on-all-integers reads as machine-quantized and defeats humanization; reduced keeps the track alive while holding the pulse, and composes with the existing swing logic (which already offsets off-beats). Implement as a beat-position test feeding `timeAmountSec` (reuse the existing grid-lock plumbing). Velocity jitter is unaffected by groove lock — only timing.
* **Probabilistic Ghost Dropping (NEW):** The humanizer may drop a hit entirely.
  * Drop chance is computed from the **pre-jitter (authored) velocity**, not the post-jitter value — authored intent is deterministic and a ±10% jitter must not push a 0.45 ghost across the 0.4 threshold and change whether it drops.
  * **Hard threshold (resolved):** velocity **< 0.4** has a flat **~12%** drop chance; velocity **≥ 0.4** is **never** dropped (this subsumes the original >0.7 safety rule). No interpolation — you skip ghost strokes, not real notes. Easy to test, deterministic, and keeps mid-range rhythmic content intact.
  * **Determinism:** the drop decision must use the same seeded RNG keyed on the hit's existing seed, so playback is reproducible and the existing snapshot/unit tests stay stable.
  * **Architecture note:** because dropping changes array length, `applyJitter`'s contract changes — it must be able to signal "drop." Options: (a) return `{ time, velocity } | null` and have each call site skip on `null`; or (b) add a separate `shouldDropHit(velocity, seed)` predicate the call sites check before pushing. Prefer (b) — it keeps `applyJitter`'s return type stable and the drop logic independently testable.
  * **Exclusions (critical):** the humanizer must **never** drop or jitter:
    * `metronome` events — they are the click reference and must stay on the grid.
    * `chordOnsets` events — they drive React state writes (`isFirstBar`/`isLastBar`) and the §3.4 chromatic-approach gating; dropping or shifting them breaks UI sync and bass lead-ins.
    * Only `chordStrums`, `bass`, and `drums` are humanized. (This matches today's behavior — preserve it.)

### 3. Genre Coupling (how "locked in sync" is actually guaranteed)

The original draft asserted genre-locked sync fills as a goal but never said what enforces them. Independent per-instrument variation events do **not** couple on their own. The coupling mechanism is **`GenreStyle`**:

* Extend `GenreStyle` (in `genres.ts`) with **`chordVariations: string[]`** and **`bassVariations: string[]`**, alongside the existing `drumVariations`.
* A genre author guarantees sync by selecting variations with **matching `barInterval` and `barPhase`** across the three instruments (e.g. funk: `funk-fill-4` drums + a `funk-turnaround-chord` + a `funk-turnaround-bass`, all `barInterval: 4, barPhase: 3`). Because the genre bundle ships them together, they always fire on the same bar.
* This makes coupling a **data/authoring guarantee**, not a runtime coupling primitive — consistent with how `drumVariations` already works. No cross-instrument runtime wiring is added.

## Plumbing / Files to touch

The original draft listed only `buildAllLayers.ts`. The actual surface for Variation Events:

1. **`src/progressions/audio/patterns.ts`** — add `ChordVariation` / `BassVariation` interfaces, `CHORD_VARIATIONS` / `BASS_VARIATIONS` catalogs, and `getChordVariation` / `getBassVariation`. Reuse `variationFiresOnBar`.
2. **`src/progressions/audio/genres.ts`** — add `chordVariations` / `bassVariations` to `GenreStyle` and populate per genre (the coupling guarantee, §3).
3. **`src/store/progressionAtoms.ts`** — add `progressionChordVariationsAtom` / `progressionBassVariationsAtom` (`atomWithStorage`, keyed via `k(...)`), wire them into `applyGenreStyleAtom`, and add both to the reset action (RESET).
4. **`src/hooks/useProgressionAudioPlayback.ts`** — read the two new atoms and thread them through **every** `buildAllLayersAsync` input object and its dependency arrays (there are multiple call sites + memo deps — grep for `drumVariations` to find them all).
5. **`src/progressions/audio/buildAllLayers.ts`** — add `chordVariations` / `bassVariations` to `BuildAllLayersInput`, resolve them like `drumVariations`, and apply substitutive selection in the chord and bass bar loops.
6. **`src/progressions/audio/humanize.ts`** — add groove-lock (beat-position → reduced jitter) and `shouldDropHit` (§2).

Density Selection plumbing is intentionally omitted (deferred, §1).

## Data Flow
1. `buildAllLayers.ts` iterates over each progression step and tracks `absoluteBar`.
2. For each instrument, it fetches the base pattern (selecting the correct cell bar via `sliceCellToBar` for multi-bar patterns).
3. It checks applicable variations via `variationFiresOnBar(v, absoluteBar)`:
   * **Drums:** layer firing variation hits over the base (additive — unchanged).
   * **Chords / Bass:** if a variation fires, **replace** the base bar's hits with the variation's; otherwise use the base. At most one substitutive variation per bar (catalog order wins).
4. It slices/repeats to fill the step's beats.
5. Each emitted hit passes through the humanizer per-hit: `shouldDropHit` (skip if dropped, never for velocity > 0.7), then `applyJitter` with groove-lock-adjusted `timeAmountSec`. **Metronome and chordOnsets bypass the humanizer.**
6. The surviving, humanized hits are returned to the playback scheduler.

## Testing
* **Variation firing:** `variationFiresOnBar` already has coverage; add cases proving chord and bass variations gate identically (turnarounds fire on exactly the expected `absoluteBar`).
* **Substitution semantics:** a firing chord/bass variation **replaces** the base bar's hits (not layered); a non-firing bar plays the base unchanged; when two substitutive variations target the same bar, catalog order wins.
* **Genre coupling:** for a genre whose chord/bass/drum variations share `barInterval`/`barPhase`, assert all three fire on the same `absoluteBar` (the sync guarantee).
* **Humanizer bounds:** jitter never moves a hit to negative time or past the step length; jitter stays within the configured `timeAmountSec`/`velocityAmount`.
* **Groove lock:** integer beats receive reduced (~40%) timing jitter; off-beats receive full jitter; velocity jitter is unaffected by beat position.
* **Ghost dropping:** velocity ≥ 0.4 is **never** dropped; velocity < 0.4 drop rate sits near ~12% over a large sample; the drop decision is **deterministic** for a fixed seed (same input → same output across runs).
* **Humanizer exclusions:** metronome and chordOnsets are never dropped or time-shifted.
* **Regression:** with no variations configured and dropping disabled, output matches the pre-change build (guards the additive→substitutive split and the humanizer extension).
* **Extended patterns:** a 4-bar `bars: 4` cell emits the correct bar per `absoluteBar` on bar-unit steps; document the beat-unit collapse caveat in a test.

## Resolved Decisions
1. **Loop variety — per-bar only.** Keep build-once-replay. Per-pass variety is **out of scope**: one pass already varies per bar (seed = `stepIndex`/`bar`/`beat`) and variations fire every 4 bars, which fixes the macro-monotony the project set out to solve. Adding a loop-pass seed would force a rebuild on every loop boundary and threaten gapless Tone.js looping — not worth it. The build stays single-pass and deterministic.
2. **Groove lock — reduced on integers, full off-beats.** Integer beats get ~40% timing jitter (~6ms); off-beats get full (~15ms). Not zero on integers (avoids a robotic feel). Meter-agnostic via `beat % 1 === 0`. See §2 Groove Lock.
3. **Ghost-drop curve — hard threshold, no interpolation.** Velocity < 0.4 → flat ~12% drop; velocity ≥ 0.4 → never dropped. See §2 Probabilistic Ghost Dropping.
