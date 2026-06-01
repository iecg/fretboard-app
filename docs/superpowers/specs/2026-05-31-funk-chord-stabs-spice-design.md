# Funk Chord Rework — Stabs & Spicy Voicing

**Date:** 2026-05-31
**Status:** Approved (design)
**Supersedes / extends:** `2026-05-31-funk-chicken-scratch-rework-design.md`

## Problem

The first chicken-scratch pass (PR #486) landed the muted ghost-note feel, which
the user likes. But on audition three gaps remain:

1. **The accented downbeat doesn't read as a strummed chord.** It sounds neither
   like a clean ringing strum nor a muted scratch — an ambiguous middle.
2. **No stabs.** Funk lives on accented chord stabs that ring briefly but
   clearly; the comp currently has exactly one accent + muted ghosts.
3. **Not enough syncopation, and the chords aren't spicy.** Funk harmony leans
   on extensions (9 / 13, dominant color); the comp voices plain triads/7ths.

### Root cause of (1)

The `chord-funk-scratch` patch envelope is `attack 0.004, decay 0.18,
sustain 0, release 0.08`. With `sustain: 0`, **every note decays to silence in
~0.18 s regardless of how long it is held.** The "accent" hit therefore cannot
ring — it is just a marginally longer scratch. A ringing stab requires the
envelope to *sustain while the note is held*, so that note-hold duration (which
the engine already plumbs via `durationSec`) decides ring vs. choke.

## Decisions (from brainstorming)

- **Spice = auto-extend per chord quality, but not on every hit.** Color tones
  ride the ringing *stabs*; muted ghost scratches stay on the plain voicing
  (pitch barely reads on a choked stroke, and this keeps the spice from
  smearing across the whole bar).
- **Stab character = "one + syncopated stabs."** A hard ringing stab on the one
  plus two syncopated ring-stabs, with muted ghosts weaving between.

## Design

### 1. Articulation model (rhythm layer)

Repurpose `ChordArticulation` in `patterns.ts` from `"muted" | "accent"` to
**`"muted" | "stab"`**. Two clear contracts:

| articulation | ring        | voicing  | role                       |
|--------------|-------------|----------|----------------------------|
| `muted`      | ~0.06 s choke | plain    | ghost scratch (percussive) |
| `stab`       | ~0.4 s ring   | **spicy** | accented chord stab        |

`"accent"` is removed (it never rang; `stab` replaces its intent). All call
sites and tests referencing `"accent"` update to `"stab"`.

### 2. Patch envelope (timbre layer)

Rework `chord-funk-scratch` so held duration governs ring:

- Envelope ≈ `attack 0.004, decay 0.12, sustain 0.22, release 0.09`.
  `sustain > 0` lets a held note ring; the short release still chokes ghosts
  cleanly (0.06 s hold + 0.09 s release ≈ dies by ~0.15 s).
- Default `noteDurationSec` stays short (**≤ 0.3**, preserves the existing
  recurrence guard — the *default* stroke must stay tight).
- Add `STAB_STRUM_DURATION_SEC ≈ 0.4` alongside the existing
  `MUTED_STRUM_DURATION_SEC = 0.06` in `buildAllLayers.ts`.
- Per-hit `durationSec` mapping at emission:
  - `muted` → `MUTED_STRUM_DURATION_SEC`
  - `stab`  → `STAB_STRUM_DURATION_SEC`
  - omitted → `undefined` (patch default)

Choke vs. ring now comes from how long the note is held — exactly like a
guitarist's fretting hand muting vs. letting the chord sustain. Keep the bright
single-coil partials and EQ from the prior pass.

### 3. Spicy voicing (harmony layer)

New pure helper in `progressionAudio.ts`:

```ts
extendFunkVoicing(voicing: string[], root: string, quality: string): string[]
```

Adds color tones **an octave above** the existing voicing (so they sit on top,
never muddy the bottom), per quality:

| quality            | added tones        | resulting flavor      |
|--------------------|--------------------|-----------------------|
| `M`                | b7 (+10), 9 (+14)  | dominant-9 (JB "E9")  |
| `m`, `m7`          | 9 (+14), b7 if absent | m9                 |
| `7`                | 9 (+14), 13 (+21)  | 9 / 13                |
| `maj7`             | 9 (+14)            | maj9 (stays major)    |
| `dim`, `aug`, `m7b5`, `sus2`, `sus4`, `6`, `m6`, `5` | none (leave as-is) | avoid clashes |

Applied **only to `stab` hits** in `buildAllLayers`. Compute the extended
voicing once per chord step (alongside the plain `resolveChordVoicing` output)
and select per-hit by articulation: `stab` → extended, everything else → plain.

Helper is pure (note-name + interval math, no Tone.js) and unit-tested in
isolation. Duplicate notes are de-duplicated; tones already present are not
re-added.

### 4. New `funk-scratch` rhythm — "one + syncopated stabs"

| beat | 0 | 0.5 | 0.75 | 1.25 | 1.5 | 1.75 | 2.5 | 2.75 | 3.5 | 3.75 |
|------|---|-----|------|------|-----|------|-----|------|-----|------|
| type | **STAB ↓** | ghost ↑ | ghost ↑ | ghost ↓ | **STAB ↑** | ghost ↑ | ghost ↑ | **STAB ↑** | ghost ↑ | ghost ↑ |
| vel  | .98 | .25 | .30 | .22 | .80 | .25 | .28 | .82 | .30 | .26 |

- The one: hard down-stab (rings, spicy).
- Two syncopated ring-stabs on the "and of 2" (1.5) and "and of 3" (2.75).
- Muted ghost scratches weave between; alternating strum direction emulates the
  funk wrist motion.

### 5. Data flow (unchanged plumbing)

`patterns.ts` (hit.articulation) → `buildAllLayers` (selects voicing + maps
`durationSec`) → `ChordStrumEvent` → `strumVoice` → `pluckString` (honors
`durationSec`). All of this is already wired from PR #486; this pass adds the
`stab` branch and the voicing selection.

## Testing / recurrence guards

- **Ring contract:** `STAB_STRUM_DURATION_SEC` meaningfully greater than
  `MUTED_STRUM_DURATION_SEC` (margin guard, not a frozen value).
- **Envelope root-cause guard:** `chord-funk-scratch` must have `sustain > 0`
  (so stabs can ring) **and** `noteDurationSec ≤ 0.3` (so the default stays
  tight). Encodes the exact bug class from §Root cause.
- **`extendFunkVoicing` unit tests:** one per quality rule (M→+b7+9, m→+9 (+b7),
  7→+9+13, maj7→+9 and *not* b7, dim/aug/sus left untouched); de-dup behavior;
  no mutation of input.
- **Voicing selection guard:** in a funk render, `stab` hits carry the extended
  voicing and `muted` hits carry the plain voicing ("not on every beat").
- **Comp shape guard:** `funk-scratch` contains both `stab` and `muted` hits and
  the beat-0 hit is a down-stab.

## Out of scope

- Bass / drum changes (the prior pass tuned these; revisit only by ear).
- Genre mix levels (revisit only if the new stabs change perceived balance).
- Bossa, and any non-funk genre.
