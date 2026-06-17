# FretFlow Roadmap — Parked Features

Forward-looking ideas that are **deliberately deferred**, not yet specced or built. This is
distinct from [`docs/design/`](./design/README.md) (durable rationale for *shipped*
decisions) and [`docs/superpowers/specs/`](./superpowers/) (approved designs in flight).

When a parked item is picked up, brainstorm it into its own spec under
`docs/superpowers/specs/`, then remove or update its entry here.

## Progression editor

These surfaced while designing the chord-audition enhancement
([spec](./superpowers/specs/2026-06-16-progression-chord-audition-design.md)) and were
scoped out of it.

### Smart / function-aware "add chord"

Replace the fixed "+1 next diatonic degree" default with a suggestion driven by cadence
and chord-function theory (e.g. propose a plausible next chord given what precedes the
slot). Could grow into an explicit "suggestions" surface that proposes 2–3 candidates the
user can audition before committing.

- **Why parked:** materially larger than the audition work; needs its own theory grounding
  (would cite [`music-theory-pedagogy.md`](./design/music-theory-pedagogy.md)).
- **Related:** pairs naturally with the audition control — audition each suggested
  candidate in place before committing.

### Slash chords / inversions / octave

Let the user manually pin a bass note (slash chords) and/or register (octave) on top of
the automatic voicing engine, which currently chooses voicings for them.

- **Why parked:** touches the voicing/audio engine
  ([`audio-voicing-engine.md`](./design/audio-voicing-engine.md)) and the chord data model,
  not just the progression UI.

### Auto-audio on edit

Auto-play the cadence into a slot whenever its root / quality / duration changes, for
instant feedback without a manual trigger.

- **Why parked:** the audition enhancement ships manual-only first; revisit after real use
  to judge whether auto-audio is welcome or annoying.
