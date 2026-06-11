# Blues Shuffle Strum Realism

Make the Blues backing track sound like an idiomatic blues shuffle by (a) rewriting the
sparse `shuffle-comp` chord pattern into a full swung eighth-note shuffle strum, (b)
defaulting the Blues genre to a strummed guitar so that feel is heard out of the box, and
(c) adding a small per-genre secondary-patch mechanism so the existing Jazz Organ tone
stays reachable from the instrument dropdown.

This is a follow-on to #594 (`2026-06-09-strum-pattern-directions-design.md`), which added
`direction` annotations to three patterns. That work left `shuffle-comp` at two hits per
bar — too sparse to read as a shuffle. This spec finishes the job for Blues.

Voicing/audio rationale lives in `docs/design/audio-voicing-engine.md`; cite it for any
follow-on voicing decision.

## Motivation

A blues shuffle is a **triplet feel**: each beat divides into three, the middle note is
dropped, leaving a long–short "lopsided" pulse. The idiomatic rhythm-guitar realization
maps directly onto that — a **downstroke on the beat** (the long note) and a **light
up-brush on the swung "&"** (the short note), repeated across the bar as a swung
eighth-note strum (`D u D u D u D u`), downbeats accented and off-beat ups soft/muted. The
other classic form is the all-downstroke palm-muted "chunk" (Texas shuffle); we chose the
eighth-note strum.

The current `shuffle-comp` (down on beat 1, up on the "& of 2" — two hits) is far too
sparse to read as a shuffle, and the Blues genre defaults to the `organ` instrument, which
ignores strum `direction` entirely. So today the blues comp sounds neither like a shuffle
nor like a guitar.

### Research sources

- Down on the long note, light up-brush on the swung "&":
  [Tomas Michaud — Shuffle Rhythm on Guitar](https://tomasmichaud.com/blues-guitar-lessons-shuffle-rhythm/),
  [Andy Guitar — Blues Shuffle & Triplets](https://www.andyguitar.co.uk/videos/strumming-pattern-10-blues-shuffle)
- Triplet feel, long–short, and the all-down "chunk" alternative:
  [Happy Bluesman — Basic forms of the blues shuffle](https://happybluesman.com/basic-forms-blues-shuffle/),
  [Guitar Player — Blues Comping 101](https://www.guitarplayer.com/lessons/blues-comping-101-essential-rhythm-approaches-for-blues-guitar)
- Swing-eighths over an eighth-note-triplet undercurrent; palm-mute/clipped touch:
  [GuitarHabits — 12 Bar Blues Strumming](https://www.guitarhabits.com/12-bar-blues-basic-strumming-triplet-turnarounds/)

## How the engine constrains the design (verified facts)

- **`direction` is honored only by the strum voice** (`instruments/strumVoice.ts` reverses
  voicing order for `"up"`). Piano and organ are polyphonic and ignore it.
- **`articulation: "muted"` sets a short choke `durationSec`** (`MUTED_STRUM_DURATION_SEC`,
  0.06 s) that **all** voices honor (`buildAllLayers.ts`), so a muted off-beat reads as a
  ghost on organ and a muted up-brush on the strum voice. `articulation` keeps the normal
  comp voicing (only `color-stab`/`root` change which notes sound).
- **`style: "staccato"` is a no-op on poly voices** — `createReusableChordVoice` already
  defaults to the patch's `shortDurationSec` unless `style === "sustained"`. The clipped
  feel therefore comes from `articulation`/velocity, not `style`.
- **The swing engine auto-delays `.5` off-beats** to the late triplet (`swingBeat` shifts
  by `swing · ⅓`; Blues swing = 0.33). The pattern is written in straight eighths and
  plays swung.
- **Instrument and chord pattern are independently user-selectable** in the Backing Track
  controls; the genre only sets defaults (`applyGenreStyleAtom`). So strum work pays off
  whenever a user selects a strum instrument with any pattern.
- **The instrument dropdown's "Piano" and "Organ" both map to family `poly`** and resolve
  to the genre's single poly patch — they are not distinct timbres today. The only real
  switch is **Strum (guitar) vs. keys**.
- **A genre's mix chord-patch family must match its `chordInstrument` family**
  (`genreMixPresets.test.ts` invariant). So defaulting Blues to strum requires changing the
  Blues mix chord patch to a strum-family patch.
- **`buildSignalGraph` reads the genre's default chord patch** for the chord channel's EQ/
  saturation insert. The secondary patch (below) swaps the synth but routes through the
  default channel insert — a known, accepted limitation.

## Design

### 1. `shuffle-comp` → eighth-note shuffle strum

Replace the two hits with a full swung eighth-note strum: a downstroke on every beat and a
soft muted up-brush on every "&". Front-weighted accents (the "1" strongest, beat 3 the
secondary accent); the off-beats are ghost strokes; the final "&" is a slightly louder
pickup into the next bar.

| beat | direction | velocity | articulation | role |
|------|-----------|----------|--------------|------|
| 0    | down      | 0.90     | —            | the "1" — strongest anchor |
| 0.5  | up        | 0.40     | muted        | ghost up-brush (swung) |
| 1    | down      | 0.72     | —            | backbeat downstroke |
| 1.5  | up        | 0.40     | muted        | ghost up-brush (swung) |
| 2    | down      | 0.80     | —            | the "3" — secondary accent |
| 2.5  | up        | 0.40     | muted        | ghost up-brush (swung) |
| 3    | down      | 0.72     | —            | backbeat downstroke |
| 3.5  | up        | 0.50     | muted        | pickup up-brush into next bar |

Notes:
- Downbeats omit `articulation` (full comp chord, natural patch ring); the swung off-beats
  are `muted` (short choke + low velocity).
- On the organ alt timbre, the muted off-beats read as short ghost blips and the downbeats
  as the patch's stab — the rhythmic shuffle life is heard even without direction.
- Velocities are a tuned-by-ear starting point. Low-velocity off-beats may be
  probabilistically dropped by the existing humanize layer (`shouldDropHit`); that is the
  desired human feel, consistent with the funk patterns.

### 2. Blues defaults to a strummed guitar

`src/progressions/audio/genres.ts` — change the Blues genre `chordInstrument` from
`"organ"` to `"strum"`. Blues already defaults to `shuffle` bass and `blues-shuffle` drums;
this completes a coherent guitar-blues default.

### 3. Preserve the Jazz Organ via a secondary per-genre chord patch

Add an **optional** secondary chord patch that a genre provides for the family that is
*not* its default, consulted when the user switches the instrument family.

- **Type:** `GenreMix.patches` gains `chordAlt?: string` (in
  `src/progressions/audio/sound/genreMixPresets.ts`).
- **Blues mix:** `patches.chord: "chord-jazz-organ" → "chord-steel-strum"` (the strum-family
  default — satisfies the family-match invariant) and add
  `patches.chordAlt: "chord-jazz-organ"`.
- **Resolution** (`src/progressions/audio/instruments/index.ts`): change
  `getChordVoiceForInstrument(instrument, primaryPatchId, altPatchId?)` to pick whichever of
  the primary/alt patches matches the selected instrument family, else fall back to
  `DEFAULT_CHORD_PATCH_BY_FAMILY[family]`. Behavior is unchanged when `altPatchId` is
  omitted (all other genres).
- **Call site** (`src/hooks/useProgressionAudioPlayback.ts`): pass `mix.patches.chordAlt`
  as the new third argument alongside the existing `mix.patches.chord`.

Result: Blues default = steel strum; selecting **Organ** or **Piano** yields the Jazz Organ
(preserved). No other genre changes behavior.

## Files changed

- `src/progressions/audio/patterns.ts` — rewrite `shuffle-comp` hits.
- `src/progressions/audio/genres.ts` — Blues `chordInstrument` → `"strum"`.
- `src/progressions/audio/sound/genreMixPresets.ts` — add `chordAlt?` to the `GenreMix`
  patches type; update the Blues preset's `chord` + `chordAlt`.
- `src/progressions/audio/instruments/index.ts` — extend `getChordVoiceForInstrument` with
  the optional alt patch and family-match selection.
- `src/hooks/useProgressionAudioPlayback.ts` — thread `mix.patches.chordAlt` to the voice
  resolver.

## Testing

- `src/progressions/audio/patterns.test.ts` — assert the new `shuffle-comp` shape: eight
  hits, downstrokes on integer beats, muted up-strokes on the `.5` off-beats, and the
  front-weighted accent ordering.
- `src/progressions/audio/instruments/index.test.ts` — assert the resolver picks the alt
  patch when the selected family differs from the primary, picks the primary when it
  matches, and falls back to the family default when neither matches (the existing
  no-alt cases must stay green).
- `src/progressions/audio/sound/genreMixPresets.test.ts` — keep the existing family-match
  invariant (Blues `chord` is now strum-family, matching `chordInstrument: "strum"`); add an
  assertion that when `chordAlt` is present it resolves to the *opposite* family of `chord`.
- Manual listen (most important — the change is audible-by-ear):
  - Blues plays a strummed guitar shuffle by default; the off-beats are soft swung
    up-brushes, not even eighth notes.
  - Switching the instrument to Organ on Blues restores the Jazz Organ tone.
  - The downstroke ring is not too long at the Blues tempo range (70–110 BPM); tune
    velocities/duration by ear if needed.
- `pnpm run lint`, `pnpm run test`, `pnpm run build` before opening the PR.

## Out of scope

- Making "Piano" and "Organ" distinct timbres in general (today both map to the genre's one
  poly patch; this spec preserves that behavior, only swapping which poly patch Blues
  provides).
- Per-patch channel inserts on instrument switch (the chord channel insert continues to
  follow the genre's default patch).
- An all-down "chunk" blues pattern, a Freddie Green four-to-the-bar jazz guitar comp, and
  `pop-8ths` velocity polish — considered and deferred; the audit found every other pattern
  already idiomatic after #594.
