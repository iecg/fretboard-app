# Funk guitar voice rebuild — MonoSynth single-coil + amp channel strip

**Date:** 2026-05-31
**Branch:** `funk-chicken-scratch` (PR #489)
**Status:** Design approved, pending spec review

## Problem

The funk chord voice has been through three rounds of tuning on a `Tone.PluckSynth`
(resonance, then dampening/attackNoise/eq) and still does not sound like a guitar.
Systematic debugging (Phase 4.5) established this is an **architecture** problem, not a
parameter problem:

- It is **not** a routing/level bug — the user hears it.
- It is **not** a chord-rendering bug — `scheduleChord` allocates a distinct voice per
  note via the pool, so a full chord renders correctly.
- The root cause: `Tone.PluckSynth` is a Karplus-Strong model of **the string alone**.
  An electric funk guitar's recognizable tone is mostly the chain *after* the string —
  the magnetic pickup, body, and especially the amp/cab (a midrange formant with the
  lows and highs rolled off). We were tuning the wrong layer.

## Decision

Rebuild the voice as a pure-synthesis **single-coil-through-a-clean-amp** channel
strip (no audio-sample assets — user constraint). Target tone: clean & sparkly
chicken-scratch (Nile Rodgers); the bite comes from the pick transient and mid
presence, not overdrive.

Chosen over (a) keeping PluckSynth + only adding a channel strip (user wants it gone;
the comb character would survive), and (b) a layered noise-transient + body source
(YAGNI for a first rebuild). Both rejected.

Every primitive used is already proven in this codebase: `Tone.MonoSynth` (the bass),
`EQ3` + saturation inserts (`buildSignalGraph.ts`).

## Architecture

Two halves: a better **source** (per-note) and an **amp/cab channel strip** (per bus).

### Source voice — `Tone.MonoSynth` per note

A bright, percussive single-coil:

- **Oscillator:** `sawtooth` — harmonically dense raw material.
- **Lowpass filter + filter envelope:** the crux. A snappy filter envelope (instant
  attack, ~80 ms decay, low sustain; `baseFrequency ~800`, `octaves ~2.8` → sweeps to
  ~5–6 kHz on attack then settles) produces the pick "spank", and the lowpass doubles
  as the cab/tone rolloff that caps synthetic fizz per-voice.
- **Amp envelope:** percussive (attack ~4 ms, decay ~0.2 s, low-ish sustain,
  release ~0.1 s).

Two structural wins over PluckSynth, each fixing a prior bug class:

1. **`durationSec` controls choke-vs-ring natively.** A subtractive amp envelope honors
   note-on→note-off: a 0.06 s ghost chokes, a 0.4 s stab rings. This is the articulation
   model already threaded through `buildAllLayers`. (PluckSynth's decay was governed by
   `resonance`, not duration — the source of the "only ghost notes" and "loose strings"
   rounds.)
2. **Velocity works natively.** MonoSynth respects `triggerAttackRelease` velocity, so
   the per-voice `Gain` velocity hack from the pluck path is deleted, not ported.

The exact param values are by-ear starting points and may be nudged during audition;
the *invariants* (below) are what the tests freeze, not the literals.

### Amp/cab channel strip — chord-bus `insert`

Applied once to the summed chord (an amp colors the whole signal; also efficient),
using the existing `EQ3` + saturation insert chain in `buildSignalGraph.ts`:

- **`EQ3`:** cut lows (`low ≈ -6`) for tightness, gentle mid presence (`mid ≈ +2`) for
  single-coil honk, keep highs (`high ≈ +2`) for sparkle.
- **Saturation:** none. The sawtooth + EQ carry the clean-and-sparkly target. A light
  Chebyshev can be added later if it reads sterile (YAGNI now).

Note: inserts are gated by `tier.perInstrumentInserts`, so the lowest quality tier
bypasses the channel strip and hears the bare MonoSynth. That is acceptable — the
MonoSynth's own lowpass already tames the worst fizz, so the bare source is usable.

### Data flow — unchanged

The comp pattern, `extendFunkVoicing`, `scheduleChord`, the voice pool, and the
articulation/duration selection in `buildAllLayers` are all untouched. We swap the
instrument, not the part.

## Changes

**Four files modified, one test file deleted:**

- `src/progressions/audio/sound/patchTypes.ts`: add `MonoSynthVoiceSpec`
  (`oscillator` / `filter: { type: "lowpass"; Q }` / `filterEnvelope` / `envelope`,
  mirroring the bass shape) and a `mono?: MonoSynthVoiceSpec` field on `StrumSpec`.
  **Remove** the now-dead `PluckSpec` interface and the `pluck?` field.
- `src/progressions/audio/string.ts`: add `createMonoSynthVoice`; routing precedence
  `mono ? createMonoSynthVoice : createSynthVoice`. **Remove** `createPluckVoice` and
  its per-voice gain stage (dead once funk no longer uses pluck).
- `src/progressions/audio/sound/instrumentPatches.ts`: rewrite `chord-funk-scratch` to
  a `mono` source + the clean amp insert. Rewrite the patch comment.
- `src/progressions/audio/sound/instrumentPatches.test.ts`: replace the PluckSynth
  guard (see Testing).
- Delete `src/progressions/audio/string.pluck.test.ts` (its subject is removed).

## Testing

- **New `src/progressions/audio/string.mono.test.ts`:** a `mono` spec constructs a
  `Tone.MonoSynth` (not `Synth`, not `PluckSynth`); velocity is passed natively to
  `triggerAttackRelease` (no gain stage). Mirror the existing mock structure.
- **Rework the funk guard in `instrumentPatches.test.ts`** as relational invariants
  (encode the lessons; do NOT freeze magic numbers):
  - source `mono` spec present (not `pluck`),
  - **live filter envelope** — `mono.filterEnvelope.octaves > 0` (the spank),
  - **harmonic oscillator** — `mono.oscillator.type` not in the sine family (a guitar
    needs overtones; mirrors the bass harmonics guard),
  - **amp formant** — `insert.eq3.low < 0` and `insert.eq3.mid >= 0` (the channel strip
    cannot be flattened back to a full-range synthetic tone),
  - **tight strum** — `strumLagSec <= 0.01` (kept).
  - Drop the obsolete `resonance` guard.
- Full gate: `pnpm run lint && pnpm run test && pnpm run build` (trust the shell exit
  code, not IDE diagnostics).
- **Final acceptance is the user's by-ear audition** of the Funk genre — audio timbre
  cannot be unit-tested.

## Out of scope

- The comp rhythm, voicing, `extendFunkVoicing`, articulation model, voice pool.
- Adding audio-sample assets (a `Tone.Sampler`) — explicitly rejected this round.
- Bass / drum / other-genre patches.
- Extending the insert chain with new filter primitives (the MonoSynth lowpass is the
  cab rolloff; `EQ3` is the formant).
