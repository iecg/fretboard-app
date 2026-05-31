# Funk pluck "loose strings" buzz fix

**Date:** 2026-05-31
**Branch:** `funk-chicken-scratch` (PR #489)
**Status:** Design approved, pending spec review

## Problem

After raising the funk pluck `resonance` 0.55 → 0.9 (commit `0aeed522`, to make the
stabs actually ring), the funk chords now sound **buzzy / rattly — as if the strings
were loose** (a slack string fretting out, gritty rather than clean). The ring fix
worked, but it over-corrected the timbre.

## Root cause

`Tone.PluckSynth` is Karplus-Strong: a noise burst recirculating through a damped
comb filter. Three params in the `chord-funk-scratch` patch now conspire to make the
*noise*, not just the pitch, ring:

- **`attackNoise: 1.2`** — a noisy pick excitation. This is the grit source.
- **`dampening: 4500`** (above Tone's 4000 default) — the comb filter sheds very
  little high-frequency energy per pass, so the string stays bright and the highs are
  slow to die.
- **`resonance: 0.9`** — high feedback means that noisy, bright attack recirculates
  many times before settling, instead of decaying quickly into a clean pitched tone.

The `eq3 high: +3` shelf then amplifies exactly that residual high-frequency grit.

**Key insight:** the buzz comes from *noise that is ringing*. The fix must reduce the
noise that recirculates — **not** the resonance, since dropping resonance would
reintroduce the prior "nothing rings → uniform ghost clicks" bug.

## Decision

**Damp the string + clean the pick** (chosen over "back off resonance" and "EQ-only"):

- `dampening` is literally the string-loss control — lowering it makes the comb shed
  highs faster, so the rattle settles into a warm pitched tone within a few cycles
  while the fundamental still rings.
- A small `attackNoise` reduction cuts grit at the source.
- An `eq3 high` trim stops boosting the residual buzz.
- **`resonance` stays at 0.9** so the ring / stab-vs-choke articulation from the last
  fix is untouched. This also keeps the `resonance ≥ 0.85` recurrence guard satisfied.

This targets the actual source (noisy excitation sustained by a bright, high-feedback
comb) and fixes buzz on every hit, including the high color-stab extensions where it
is worst.

Rejected alternatives:
- **Back off resonance (0.9 → 0.8):** shorter ring, flirts with the just-fixed bug,
  and leaves the noisy excitation unaddressed.
- **EQ-only (cut high shelf):** masks rather than fixes; buzz is baked into the
  excitation + feedback loop.

## Change

In `src/progressions/audio/sound/instrumentPatches.ts`, `chord-funk-scratch` patch:

| Param          | Before                        | After                         |
| -------------- | ----------------------------- | ----------------------------- |
| `dampening`    | `4500`                        | `2800`                        |
| `attackNoise`  | `1.2`                         | `0.9`                         |
| `eq3`          | `{ low: -2, mid: 1, high: 3 }`| `{ low: -2, mid: 1, high: 1 }`|
| `resonance`    | `0.9`                         | `0.9` (unchanged)             |
| `release`      | `0.12`                        | unchanged                     |
| `noteDurationSec` / `strumLagSec` / `releaseTailSec` | — | unchanged    |

Update the patch comment to explain the dampening / attackNoise → buzz relationship.

## Testing

These are **by-ear timbre dials** — no new frozen-value assertion. The existing
`instrumentPatches.test.ts` guard (`resonance ≥ 0.85`, `< 1`; `strumLagSec ≤ 0.01`;
`noteDurationSec ≤ 0.3`) still holds and is the meaningful invariant. Update the test
comment only if it references the buzz/dampening rationale. Full gate: lint, test,
build. Final verification is the user's audition of the Funk genre.

## Out of scope

- Changing the comp rhythm, voicing, or articulation model.
- Touching `resonance` or the ring/choke duration design.
- Bass / drum / other genre patches.
