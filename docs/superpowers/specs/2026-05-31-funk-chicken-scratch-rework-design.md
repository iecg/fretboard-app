# Funk Genre Rework — James Brown Chicken-Scratch

**Status:** Design — approved in brainstorming, ready for implementation plan.
**Date:** 2026-05-31

---

## 1. Goal

Replace the current generic funk backing track with an authentic **James Brown
chicken-scratch** groove: sparse, hypnotic, "on the one," driven by a tight,
muted, single-coil rhythm guitar. The funk genre has been tuned twice before
(added `funk-16th` comp, reworked the kick) and still "doesn't sound funky."

## 2. Root cause of the prior failures

The earlier passes tuned rhythm **patterns** but never the instrument
**timbres**. The funk guitar uses `chord-steel-strum` — a warm, long-ringing
(~1.8 s) acoustic patch that physically cannot scratch. Chicken scratch is the
opposite: short, dry, muted, percussive. Additionally:

- The strum voice has no per-stroke note-length control, so muted scratch
  strokes can't choke independently of ringing stabs.
- The funk comp is a busy 10-hit 16th pattern; James Brown funk is sparse and
  emphasizes beat 1 ("the one").
- Selecting a genre does **not** apply its `suggestedTempo` (confirmed: `applyGenreStyleAtom` sets instrument/patterns/swing but never the tempo atom), so the funk pocket tempo is unreachable by default — `suggestedTempo`/`tempoRange` are currently dead config for every genre.

## 3. Reference feel

**James Brown / chicken-scratch funk:** sparse one-chord vamp, tight muted
single-coil "chicken scratch" guitar, hard accent on beat 1, locked rhythm
section, straight 16ths (no swing). Hypnotic, lots of muted space between hits.

## 4. Scope

Six coordinated changes, all isolated to funk + one additive engine feature.
**No other genre's sound changes** (every new interface field is optional and
defaults to today's behavior; the tempo auto-apply uses each genre's existing
`suggestedTempo`).

### 4.1 Engine: per-stroke note length in the strum voice (additive)

Mirrors the proven bass-articulation pattern already in the codebase.

- Add optional `articulation?: "muted" | "accent"` to the `ChordHit` interface
  (`patterns.ts`). This is a distinct axis from the existing
  `style?: "staccato" | "sustained"` field — `style` is read by the poly/organ
  voices and is left untouched; `articulation` drives strum note length only.
- Add a pure function `articulationToStrumDurationSec(articulation, patchNoteDurationSec)`
  (next to the chord-strum threading in `buildAllLayers.ts`, alongside the
  existing bass `articulationToDurationSec`):
  - `"muted"` → `0.06` (hard choke — the scratch)
  - `"accent"` or `undefined` → `patchNoteDurationSec` (rings normally — the stab)
- `ChordStrumEvent` (in `buildAllLayers.ts`) gains optional `durationSec?: number`;
  the chord loop sets it from the mapper, exactly as the bass loop sets its
  `durationSec` today.
- `ChordVoiceOptions` (`instruments/types.ts`) gains optional `durationSec?: number`.
- The **strum voice** (`instruments/strumVoice.ts`) passes `options.durationSec`
  through to `pluckString` as a per-note duration override. `pluckString`
  (`string.ts`) gains an optional `durationSec` in `PluckStringOptions` that
  overrides `spec.noteDurationSec` when present.
- The **piano/organ voices ignore `durationSec`** — no behavior change.
- `useProgressionAudioPlayback.ts` forwards `value.durationSec` into the
  `scheduleChord` options (the chord strum part), mirroring how it already
  forwards `value.style`/`value.direction`.

### 4.2 New guitar patch: `chord-funk-scratch` (strum family, funk-exclusive)

Bright single-coil chicken-scratch character in `CHORD_PATCHES`
(`instrumentPatches.ts`):
- `family: "strum"`.
- Bright partials (energy weighted to upper harmonics so the scratch cuts).
- Short `noteDurationSec` (~0.18 s base) and short `releaseTailSec` so even
  voiced stabs stay tight rather than blooming like the acoustic steel-strum.
- Percussive envelope: fast attack, quick decay.
- Exact partials/envelope/duration values are by-ear starting points, tuned in
  the audition.

### 4.3 New chord comp: `funk-scratch` (sparse, on-the-one)

New entry in `CHORD_PATTERNS`. Hard accented stab on beat 1, then mostly muted
scratch ghosts with deliberate space. Starting shape (finalized in the plan):

| beat | velocity | direction | articulation |
|------|----------|-----------|--------------|
| 0    | 0.95     | down      | accent       |
| 0.5  | 0.28     | up        | muted        |
| 0.75 | 0.3      | up        | muted        |
| 1.5  | 0.4      | up        | muted        |
| 2.5  | 0.28     | up        | muted        |
| 2.75 | 0.3      | up        | muted        |
| 3.5  | 0.35     | up        | muted        |

Beat-1 velocity strictly greater than every other hit; majority of hits muted.

### 4.4 Bass rework: `funk-syncopated` tightened to "the one"

Keep the staccato + ghost/octave/flat-seventh vocabulary (already good). Anchor
beat 1 harder and trim a little mid-bar busyness so the bass locks with the
guitar's space rather than competing. Same pattern id, retuned in place. Beat-1
hit remains the velocity-1 anchor.

### 4.5 Drums rework: `funk` toward JB

Harder, unmistakable downbeat (kick + backbeat emphasis on the one), simpler
locked groove, keep the 16th hi-hats (they are the funk engine). Same pattern
id, retuned in place. Backbeat snares (beats 2 & 4 → grid beats 1 & 3) stay at
full velocity; beat-1 kick stays at velocity 1.

### 4.6 Tempo: auto-apply genre `suggestedTempo` + retune funk

- Add `set(progressionTempoBpmAtom, genre.suggestedTempo)` to
  `applyGenreStyleAtom` so selecting any genre applies its suggested tempo
  (fixes the dead-config bug for all genres; the funk pocket becomes reachable
  by default).
- Retune the funk genre's tempo for the JB pocket: `suggestedTempo` ~100 → ~110,
  `tempoRange` → roughly `[96, 120]`. (Tunable in audition.)

### 4.7 Wiring (`genres.ts` funk entry + funk mix preset)

- `chordInstrument: "strum"` (unchanged), `chordPattern: "funk-scratch"`.
- Funk **mix preset** chord patch → `chord-funk-scratch` (replaces
  `chord-steel-strum`).
- `bassPattern: "funk-syncopated"` (retuned), `drumPattern: "funk"` (retuned).
- `swing: 0` stays (chicken scratch is straight 16ths).

### 4.8 Not removed

The now-unused `funk-16th` comp stays in `CHORD_PATTERNS` as a user-selectable
pattern (removing it would break a fixture test and shrink the palette — same
decision as the retired `offbeat-skank`).

## 5. Testing strategy

Unit tests (data/logic — pure, deterministic; TDD red-first):

- `articulationToStrumDurationSec`: `"muted"` → `0.06`; `"accent"`/`undefined` →
  the passed patch duration.
- Strum voice forwards `durationSec` to `pluckString`; omitting it preserves
  today's behavior (regression guard for pop/rock/blues/bossa).
- `funk-scratch` comp: beat-1 velocity strictly greater than all other hits;
  majority of hits carry `articulation: "muted"`; beat 1 carries
  `articulation: "accent"`.
- `chord-funk-scratch` patch: exists, `family === "strum"`, short
  `noteDurationSec` (below a threshold, e.g. `<= 0.3`).
- Funk genre wiring: `chordPattern === "funk-scratch"`; funk mix chord patch
  === `chord-funk-scratch`.
- `applyGenreStyleAtom` sets `progressionTempoBpmAtom` to the genre's
  `suggestedTempo` (assert for funk; the existing genre-apply test gains a
  tempo assertion).
- Bass/drums "on the one" guards: funk bass beat-0 hit is the velocity-1 anchor;
  funk drums beat-0 kick is velocity 1 — so a future edit can't silently flatten
  the downbeat.

**Recurrence guard (meta-lesson from the audio-bug saga):** a contract test that
the **funk genre's chord patch is short-decay** (`noteDurationSec` below a
threshold) — directly encoding "the funk guitar must be able to scratch," the
exact thing two prior passes missed. Mirrors the existing bass-harmonics and
jazz-brush-audibility guards.

**Final verification:** `pnpm run lint && pnpm run test && pnpm run build` green,
then a **manual by-ear audition** of the funk genre. The audition is the real
acceptance test for timbre and feel; unit tests cannot judge whether it sounds
like James Brown.

## 6. Risks & caveats

- The patch voicing (partials, envelope), the `0.06 s` mute choke, the comp
  velocities, and the retuned tempo are **by-ear judgments**. Sensible starting
  values are specified; expect one round of audition tuning.
- This is funk pass #3. The design attacks the timbre + density + tempo root
  causes (not level, which prior passes already adjusted), but final feel is
  subjective — the audition gate is where it's confirmed.
- The tempo auto-apply (§4.6) changes behavior for **every** genre (selecting a
  genre now overwrites the manual tempo with the genre's suggestion). This is
  the intended fix, but it is a cross-genre behavior change to call out — a user
  who set a custom tempo then switches genre will have it replaced by the
  suggestion.

## 7. Out of scope

- Other genres' timbres/patterns (only the shared tempo auto-apply touches them).
- The bossa clave overhaul (tracked separately in the phrase-aware Slice 2 spec).
- Any change to the `style` field semantics or the poly/organ chord voices.
