# Full-Mode Voicing Fallback — Design

**Date:** 2026-06-03
**Status:** Draft
**Supersedes:** `2026-06-01-close-voicing-fallback-design.md` (retired). That spec
covered only the de-clutter problem (Phase 1 below). This spec keeps that work and
extends the same mechanism to two failure modes it never addressed: chords that show
no connector at all in Full mode when no scale pattern is active (Phase 2), and power
chords, which today have no voicing path in any mode (Phase 3).

## Problem

In `full` voicing mode the connector source is `fullVoicingsAtom`, which only knows the
CAGED `FULL_CHORD_TEMPLATES`. Templates exist for ~10 of the 15 chord qualities. For the
rest (`aug`, `6`, `m6`, `mMaj7`, `5`), `fullVoicingsAtom` returns `[]`. The only bridge
from "no full template" to "borrow a close grip instead" is `fallbackVoicingMatchesAtom`.

Three distinct defects live on that bridge:

1. **Clutter (when the fallback fires).** Inside a CAGED polygon / 3NPS box that has no
   full shape, the fallback selectors
   (`selectCloseFallbacksForCagedPosition` / `selectCloseFallbacksForThreeNpsPosition`)
   are pure *membership filters* — they return **every** close voicing that fits, and
   `fallbackVoicingMatchesAtom` renders all of them. The result is 2–3 overlapping grips
   with crossing dashed connector lines.

2. **No fallback in Scale Pattern None (the user-reported bug).** The fallback is gated by
   `fallbackContextActiveAtom`, which requires `pattern === "caged" | "3nps"` **and** an
   active position. With Scale Pattern None there is no active position, so the gate is
   false and the fallback never runs. Close-voicing data for these chords *exists* (the
   same data Close mode renders fine across the neck) — Full mode simply has no path to
   reach it. So `aug`, `6`, `m6`, `mMaj7` render **zero** connectors in Full + Scale None.

3. **Power chords have no voicing path at all.** `closeVoicings` rejects any chord with
   fewer than 3 voices (`voicings.ts:136`). A power chord (`5`) is a 2-note dyad, so it
   produces zero close voicings — and it has no full template either. It shows no connector
   in *any* mode or scale pattern.

### Why these belong in one spec

All three are the same machinery (the Full-mode close-voicing fallback) and share one
foundation: a pure, position-agnostic grip scorer. Building the scorer for only the
polygon case (Phase 1) and bolting on the no-polygon case (Phase 2) later would force a
rework, because Phase 2 has no polygon to constrain candidates and leans entirely on the
score. Power chords (Phase 3) are a data-layer prerequisite: once `closeVoicings` emits
2-note grips, they flow through both Close mode and the widened Full-mode fallback with no
extra plumbing. Co-designing avoids building the scorer too narrow and lets one set of
tests cover the unified behavior.

## Research summary (carried from the retired spec)

No mainstream guitar tool overlays multiple full-salience voicings on one neck. Chord
Atlas, Chord!, Oolimo, JGuitar, and ChordBank all render **one grip at a time** (prev/next
navigation) or use **small multiples**. Information-visualization practice agrees: never
paint every element at full salience at once (focus+context). Edge bundling — the only
technique that might merge crossing lines — makes individual endpoints harder to read, so
it is the wrong tool here.

Playability ranking of guitar voicings has a well-established factor set in the
GA-tablature and A\* fingering literature: fret span, number of fretted notes, compactness
(distance from the mean fret), a high-neck penalty, and an open-string reward.

## Goal

Make the Full-mode fallback render **clean, legible close grips wherever a full template
is absent** — including Scale Pattern None — and bring power chords into the voicing system
as first-class 2-note grips. "Clean" means: one best grip per CAGED/3NPS position, and a
non-overlapping spread of best grips across the neck when no position is active (mirroring
how Full mode already spreads multiple full shapes across the neck in Scale None).

The string-set picker remains the user's "browse alternatives" axis inside a scale
position; it is unchanged. No new picker UI is introduced.

---

## Phase 1 — Scored single grip per position (the retired spec's content)

### 1a. Scoring (new, pure, position-agnostic, in `@fretflow/core`)

Add a pure scorer in `packages/core/src/shapes/voicings.ts` (or a co-located helper):

```ts
scoreCloseVoicing(voicing: Voicing): number   // lower = better
```

Cost model, derived entirely from `voicing.notes` (each note carries `stringIndex`,
`fretIndex`):

```
cost =  W_SPAN     * fretSpan
      + W_FRETTED  * frettedNoteCount
      + W_COMPACT  * sumAbsDistanceFromMeanFret
      + W_HIGHNECK * max(0, topFret - HIGH_NECK_THRESHOLD)
      - W_OPEN     * openStringCount
```

- `fretSpan` = `maxFret - minFret` over **fretted** notes (open strings excluded).
- `frettedNoteCount` = count of notes with `fretIndex > 0`.
- `sumAbsDistanceFromMeanFret` = `Σ |fretIndex - meanFret|` over fretted notes.
- `topFret` = highest `fretIndex`.
- `openStringCount` = count of notes with `fretIndex === 0`.
- `HIGH_NECK_THRESHOLD` = `7`.

Weights as named, documented constants (`CLOSE_VOICING_SCORE_WEIGHTS`), hand-tuned and
adjustable:

| Constant | Value | Rationale |
|---|---|---|
| `W_SPAN` | `3` | Wide stretches hurt most. |
| `W_FRETTED` | `1` | Fewer fretted notes = easier. |
| `W_COMPACT` | `1` | Reward grips clustered near one hand position. |
| `W_HIGHNECK` | `0.5` | Mild lower-neck preference. |
| `W_OPEN` | `1.5` | Reward open strings. |

**Critical constraint for Phase 2:** the scorer must depend on nothing but `voicing.notes`
— no polygon, no position, no string set. This is what lets Phase 2 reuse it with no
polygon present.

**Deterministic tie-break** (equal cost): lower `topFret`, then lower lowest-`stringIndex`.

### 1b. Selection (`src/hooks/voicingSelection.ts`)

`selectCloseFallbacksForCagedPosition` and `selectCloseFallbacksForThreeNpsPosition` keep
their strict containment filter (`distanceOutsidePolygon === 0` for every note), then
**sort survivors best-first** by `scoreCloseVoicing` with the tie-break. They return the
full ranked list (not truncated) — keeps them pure and reusable.

### 1c. Render reduction (`src/store/voicingFallbackAtoms.ts`)

In `fallbackVoicingMatchesAtom`, the per-polygon CAGED loop and the 3NPS branch take only
`ranked[0]` — one `isFallback` grip per position — instead of pushing every fit.

---

## Phase 2 — Fallback in Scale Pattern None (and other position-less patterns)

The patterns `none`, `one-string`, and `two-strings` define no positional window
(`activeScalePatternPositionsAtom` returns an empty set for them). Today the fallback is
dark for all three. Phase 2 lights it up.

### 2a. Widen the gate (`src/store/voicingFallbackAtoms.ts`)

`fallbackContextActiveAtom` currently returns false unless `pattern` is `caged`/`3nps`
with an active position. Introduce a **second, position-less fallback path** rather than
loosening the existing one (the polygon/box atoms stay polygon-shaped and untouched):

- Add `neckSpreadFallbackAtom` (name TBD), active when:
  `voicing === "full"` AND not `chordOverlayHidden` AND `voicingMatchesAtom` is empty
  (no full template) AND there is **no** active CAGED/3NPS position.
- This deliberately fires for `none`/`one-string`/`two-strings`, and also for `caged`/
  `3nps` when no single position is selected.

### 2b. Neck-spread selection (new pure helper in `@fretflow/core` or `voicingSelection.ts`)

With no polygon to bound candidates, select a clean spread across the whole neck:

```
selectNeckSpread(candidates: Voicing[]): Voicing[]
  1. sort candidates best-first by scoreCloseVoicing (+ tie-break)
  2. greedily accept a grip iff its fretted-fret window does not overlap an
     already-accepted grip's window by more than NECK_SPREAD_OVERLAP_TOLERANCE frets
  3. return the accepted set (already non-overlapping, best-first)
```

- Greedy non-overlap guarantees no crossing connector lines while still showing several
  positions up the neck — matching the multi-position experience Full mode already gives
  CAGED-able chords in Scale None.
- `NECK_SPREAD_OVERLAP_TOLERANCE` is a named constant (start at `1` fret).
- Deterministic: pure function of the scored, tie-broken ordering.

### 2c. Wire into the render list

`fallbackVoicingMatchesAtom` gains a branch: when the new position-less path is active,
feed `closeCandidatesAllStringSetsAtom` (string-set filtered via `effectiveStringSetAtom`,
which already returns all six strings in Full mode) through `selectNeckSpread`, tag each
`isFallback: true`, and return them. `visibleVoicingMatchesAtom`'s existing
`scoped = matches` else-branch already passes fallbacks straight through when no position
is active, so no change is needed there.

### 2d. Picker visibility

`hasFallbackPositionsAtom` stays position-scoped (drives the in-position string-set
picker). The neck-spread path does **not** surface the string-set picker — in Full mode
`effectiveStringSetAtom` is all-six regardless, so the picker would be inert. The browse
experience in Scale None is the neck spread itself. No picker change.

---

## Phase 3 — Power chords as 2-note grips

### 3a. Allow dyads in `closeVoicings` (`packages/core/src/shapes/voicings.ts`)

Change the voice-count gate from `if (voiceCount < 3 || voiceCount > 5)` to
`if (voiceCount < 2 || voiceCount > 5)`. Only `5` has two members, so this affects power
chords alone. The rest of `closeVoicings` is already note-count-agnostic: 2-string adjacent
windows, 2-PC permutations, span/octave logic all work unchanged. Update the doc comment
(line 122-127) to say "dyads = 2, triads = 3 …".

Power chords get no CAGED `FULL_CHORD_TEMPLATES` entry — consistent with the
extended-chords boundary. They render via the close path: directly in Close mode, and via
the Phase 1 / Phase 2 fallback in Full mode.

### 3b. Downstream sanity

- The connector hook's generated-path guard is `N < 2` (`useChordConnectorPolylines.ts`),
  so a 2-tone power chord passes (`N === 2`). The explicit-voicing path (the one the
  fallback uses) has no such guard. `assignConflictOffsets` and the SVG polyline layer are
  N-agnostic — a 2-point connector is a single line.
- `stringSetOptionsAtom` builds from `def.members.length` (2 for power), yielding 2-string
  windows. Verify the picker renders sane options in Close mode.

### 3c. Optional enhancement (out of scope, noted)

A 3-note power chord (root–5–octave-root) would require a doubled-root voicing the current
engine doesn't produce. Deferred; the 2-note grip is the MVP.

---

## Out of scope (YAGNI)

- No next/prev cycle picker (string-set toggle already serves this in-position).
- No per-voicing color, dimming, or hover-isolate.
- No change to full-chord (CAGED) matching logic or to `FULL_CHORD_TEMPLATES`.
- No change to the off/close/full mode toggle.
- No doubled-root (3-note) power chords.

## Data flow (after all phases)

```
                         closeCandidatesAllStringSetsAtom
                                      |
                          effectiveStringSetAtom (string-set filter)
                                      |
        +-----------------------------+-----------------------------+
        |  active CAGED/3NPS position |  no active position         |
        v                             v                             v
  selectCloseFallbacksFor…      selectNeckSpread(candidates)
  (filter -> rank -> [0])        (rank -> greedy non-overlap)
        \                             /
         \                           /
          v                         v
              fallbackVoicingMatchesAtom (isFallback grips)
                                      |
              visibleVoicingMatchesAtom (unchanged merge with full matches)
                                      |
        useChordConnectorPolylines -> FretboardConnectorLayer (unchanged)

closeVoicings now emits 2-note grips for power chords, feeding both Close mode and
the fallback paths above.
```

## Testing (TDD)

**Core (`@fretflow/core`)**

- `scoreCloseVoicing`: a compact low-neck grip scores lower than a wide high-neck stretch
  of the same chord; an open-string grip beats an equivalent fully-fretted one. Pure of
  any polygon/position input.
- Deterministic tie-break: two equal-cost grips resolve to a stable, documented order.
- `selectNeckSpread`: output is best-first and non-overlapping (no two grips' fretted
  windows overlap beyond tolerance); a single dense cluster collapses to one grip; grips an
  octave apart both survive.
- `closeVoicings` for `5`: returns 2-note dyads (root + 5th) on adjacent string sets; span
  limit still honored; `6`/`m6`/`aug`/`mMaj7` close counts unchanged from today.

**Selection (`voicingSelection.ts`)**

- `selectCloseFallbacksFor…`: output ordered best-first; strict containment still enforced.

**Atoms (`voicingFallbackAtoms.ts`)**

- `fallbackVoicingMatchesAtom` returns exactly one grip per qualifying polygon (Phase 1).
- In Full + Scale None with `6`/`m6`/`aug`/`mMaj7`/`5`: returns a non-empty, non-overlapping
  neck spread (Phase 2). Previously empty → this is the regression-locking test for the
  reported bug.
- In Full + Scale None with a CAGED-able chord (e.g. `M`): unchanged (full matches present,
  neck-spread path inactive).

**Component / integration**

- C6 + Scale None + Full renders ≥1 connector polyline (was 0).
- Power chord renders a connector in Close mode and in Full + Scale None.

**Visual regression (`e2e/`)**

- Previously-overlapping in-position scenario now renders one clean grip (Phase 1).
- A Full + Scale None extended/sixth chord now renders a clean neck spread (Phase 2).
- Refresh `fretboard-svg` darwin snapshots (`pnpm run test:visual:update`).

## Verification

Run `pnpm run lint`, `pnpm run test`, and `pnpm run build` before each PR (mandatory per
project guide). In the dev server confirm: (1) a previously cluttered in-position scenario
shows one legible grip; (2) C6 + Scale None + Full now shows clean connectors spread up the
neck; (3) a power chord shows a connector in both Close and Full + Scale None; (4) the
string-set toggle still swaps grips inside a scale position.

## Suggested PR staging

Three reviewable PRs on the shared scorer foundation:

1. **Phase 1** — scorer + per-polygon best grip. Narrow; matches the retired spec's
   blast radius (selectors + one atom loop).
2. **Phase 3** — power-chord dyads (`closeVoicings` gate). Tiny, data-layer only; can land
   before or after Phase 1 since it adds no fallback logic.
3. **Phase 2** — gate widening + neck spread. Largest blast radius (changes *when*
   connectors appear); lands last, on top of the scorer and dyad support.

## Note for implementers

`voicingFallbackAtoms.ts:5` references a stale spec path
(`2026-05-26-close-voicing-fallback-design.md`, which no longer exists). Update that
comment to point at this document when touching the file.
