# Funk color-stab voicing redesign — compact rootless funk grip

**Date:** 2026-05-31
**Branch:** `funk-chicken-scratch` (PR #489)
**Status:** Design approved, pending spec review

## Problem

With the new clean MonoSynth guitar exposing the harmony, the funk **color-stabs**
(beats 2.5 and 3.5) sound wrong in four ways at once — they jump register, sound
muddy/thick, clash harmonically, and spike in volume. All four trace to a single
cause: the color voicing is built by

```ts
spicyVoicing = extendFunkVoicing(resolveChordVoicing(root, quality), root, quality)
```

i.e. a **non-voice-led, root-position, octave-3 triad** with every extension
(♭7 + 9 + 13) **stacked on top** → up to 6 notes, low root, at velocity 0.8.

- **Register jump:** it is the only hit not voice-led to its neighbours (every other
  hit uses the voice-led `voicing`).
- **Muddy / thick:** 6 notes with a low octave-3 root vs the 3-note triad stabs.
- **Clash:** `extendFunkVoicing` force-adds a ♭7 to *major* chords (turning a tonic
  into a bluesy dominant) and piles a 9/13 into a low register.
- **Too loud:** more notes = more summed energy, plus velocity 0.8 and brighter highs.

## Decision

Replace the "stack every extension on a root-position triad" approach with a
**compact, rootless, voice-led funk grip** — what funk rhythm guitarists actually
play. One builder fixes all four faults at the source. (Chosen over a minimal
triad+9th, and over dropping color entirely — the user wants real spice, voiced
correctly.)

## Architecture

### New color-voicing builder (`progressionAudio.ts`)

Remove `FUNK_EXTENSION_SEMITONES` and `extendFunkVoicing`. Add:

- **`FUNK_COLOR_TONES: Record<string, readonly number[]>`** — *rootless* guide-tone +
  color offsets (semitones above the chord root), one compact grip per quality:
  - `"7"` (dominant) → `[4, 10, 14]` = 3 / ♭7 / 9 (the classic "E9" grip)
  - `M` (major) → `[4, 9, 14]` = 3 / 6 / 9 (6-9 color; **no ♭7** — removes the clash)
  - `m` → `[3, 10, 14]` = ♭3 / ♭7 / 9 (m9)
  - `m7` → `[3, 10, 14]` = ♭3 / ♭7 / 9 (m9)
  - `maj7` → `[4, 11, 14]` = 3 / 7 / 9 (maj9)

  The root (offset 0) is intentionally absent from every grip — the funk bass covers
  it, and omitting it removes the low-register mud.

- **`buildFunkColorVoicing(root, quality, prevVoicing?): string[]`** — pure. Maps the
  quality's offsets to note **names** (`NOTES[(rootIndex + offset) % 12]`), then
  realizes them **voice-led** through the existing
  `getNearestInversion(prevVoicing ?? [], noteNames, PROGRESSION_CHORD_ROOT_OCTAVE)`
  so the grip lands in the same register as the surrounding comp. Returns `[]` when
  the root is unknown. Falls back to the plain voice-led triad
  (`resolveChordVoicing(root, quality, undefined, prevVoicing)`) when the quality has
  no grip (dim / aug / sus / 6), so a color-stab on those still produces a sane chord.

`getNearestInversion(prevNotes, baseNotes, rootOctave=3)` is the same voice-leading
helper `resolveChordVoicing` already uses; `baseNotes` are pitch-class names and it
returns pitched strings near `prevNotes`.

### `buildAllLayers.ts` wiring

Split today's single `needsPlainVoicing` flag (currently true when a `root` OR
`color-stab` hit exists) into two intents:

- `needsRootAnchor = hits.some(h => h.articulation === "root")` — gates `plainVoicing`
  (still `resolveChordVoicing(root, quality)`), used only for the single-note
  `rootNoteVoicing = [plainVoicing[0]]`.
- `needsColor = hits.some(h => h.articulation === "color-stab")` — gates
  `colorVoicing = buildFunkColorVoicing(root, quality, lastVoicing)`.

`lastVoicing` is set to the current chord's voice-led triad just before the hits loop,
so passing it voice-leads the color grip into the current chord's register (no jump).

Per-hit voicing selection becomes: `color-stab → colorVoicing`, `root →
rootNoteVoicing`, else `voicing`. When `needsColor`/`needsRootAnchor` is false the
corresponding voicing falls back to `voicing` (non-funk patterns unaffected — they
have neither hit type). Durations and the rest of the loop are unchanged.

### `patterns.ts` — direction + level

The two `funk-scratch` color-stabs (beat 2.5, beat 3.5):
- `direction: "up"` → **`"down"`** (the user's explicit ask).
- velocity `0.8` → **`0.6`** and `0.82` → **`0.62`** (the lower note count already
  reduces energy; the velocity drop stops the dynamic spike so they sit in the groove).

## Testing + recurrence guards

- **`progressionAudio.test.ts`** (replace the `extendFunkVoicing` tests):
  - `buildFunkColorVoicing` returns a compact grip (≤ 4 notes) for each defined
    quality, containing the expected color tones.
  - **Clash guard:** for a major chord the grip's pitch classes must **not** include
    the ♭7 (root + 10), while for a dominant `"7"` they **must** — encodes "no
    ♭7-on-major" so the clash can't regress.
  - **Rootless guard:** the grip does not contain the chord root's pitch class —
    encodes "bass covers the root, no low mud".
  - **Voice-leading guard:** given a `prevVoicing` (e.g. `["G3","B3","D4"]`), the
    grip's lowest note is within ~12 semitones of the prev voicing's lowest — encodes
    "no register jump" as a relational bound, not a frozen pitch.
  - Unknown root → `[]`; quality without a grip → falls back to a non-empty triad.
- **`buildAllLayers.test.ts`:** a `color-stab` hit emits the voice-led color voicing
  (assert it differs from the old root-position stack and sits near `voicing`); the
  `root` anchor still emits a single root note; muted/stab still emit `voicing`.
- **`patterns.test.ts`:** the funk color-stabs are `direction: "down"` and their
  velocity is below the regular `stab` accent (0.85).
- Full gate (`pnpm run lint && pnpm run test && pnpm run build`; trust the shell exit
  code, not IDE diagnostics).
- **Final acceptance is the user's by-ear audition** of the Funk genre.

## Out of scope

- The chord-funk-scratch synth patch (MonoSynth), the comp rhythm/articulation model,
  the strum voice, the voice pool — all untouched.
- Bass / drums / other genres.
- Changing the `"root"` anchor or `"stab"`/`"muted"` voicings.
