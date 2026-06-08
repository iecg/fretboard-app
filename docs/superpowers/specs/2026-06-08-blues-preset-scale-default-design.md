# Blues presets default to blues scales

## Problem

The blues progression presets load a major or natural-minor scale as the
fretboard overlay. That overlay is the scale a player solos with, so a blues
progression should default to a blues scale — the minor blues "box" is the
idiomatic soloing scale over a dominant 12-bar blues, not the major scale.

Currently:

| Preset | `scale` field |
| --- | --- |
| 12-bar blues | `"major"` |
| 8-bar blues | `"major"` |
| Minor blues | `"minor"` |

## Goal

Each blues preset loads a blues scale as the overlay, while chord resolution for
the progression is unchanged.

| Preset | New `scale` field |
| --- | --- |
| 12-bar blues | `"minor blues"` |
| 8-bar blues | `"minor blues"` |
| Minor blues | `"minor blues"` |

(The two dominant blues presets default to **minor blues**, the classic blues
box. Major blues maps to `major` for harmony if ever used as a preset overlay.)

## Why this is safe

`loadProgressionPresetAtom` (`src/store/progressionAtoms.ts`) writes
`preset.scale` to `scaleNameAtom` (the overlay) and loads the degree steps
verbatim.

Chord resolution in `resolveProgressionStep`
(`src/progressions/progressionDomain.ts`) does **not** use the overlay scale
directly for harmony. It routes through
`getProgressionHarmonyScaleName` → `getHarmonyParentScale`
(`packages/core/src/keyHarmony.ts`), which already maps:

```text
"minor blues"  → "minor"
"major blues"  → "major"
```

So a `"minor blues"` overlay resolves chords against the same `minor` parent
that drives every other minor-flavored scale. Blues scales get the same harmonic
treatment as their parent scale — this mapping already exists; the only change
is which preset selects it.

### Root stability for the dominant presets

The 12-bar and 8-bar specs use uppercase `I/IV/V` degrees with explicit `:7`
quality overrides. Switching their parent from `major` to `minor` does not move
the roots:

- In C, the `minor` parent scale degrees are `C D Eb F G Ab Bb`.
- Pinned-root-by-ordinal yields `I = C` (ord 0), `IV = F` (ord 3), `V = G`
  (ord 4) — identical to the major parent.
- The `:7` overrides force dominant quality regardless of parent, so the
  resolved chords (`C7`, `F7`, `G7`) are unchanged and no step becomes
  "unavailable".

The existing **Minor blues** preset already resolves against `minor`, so
changing its overlay from `"minor"` to `"minor blues"` produces identical
harmony with a blues overlay.

## Changes

1. `src/progressions/progressionDomain.ts` — `PRESET_SPECS`: set `scale` to
   `"minor blues"` for `twelve-bar-blues`, `eight-bar-blues`, and `minor-blues`.

No changes to `keyHarmony.ts`, `progressionAtoms.ts`, or chord-resolution logic.

## Testing

- Run `pnpm test` for the progression domain. Update
  `src/progressions/progressionDomain.test.ts` and any affected snapshots that
  assert on the blues presets' `scale` field or resolved overlay.
- Manual check: load each blues preset and confirm
  - the fretboard overlay renders the minor blues scale, and
  - every progression step resolves to a chord (none greyed-out / unavailable).

## Out of scope

- Adding new blues presets or a major-blues-overlay preset.
- Changing chord qualities, genre styling, or the `:7` override grammar.
