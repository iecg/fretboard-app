# Scored Single Close-Voicing Fallback

**Date:** 2026-06-01

## Problem

When the chord overlay is in `full` voicing mode and a CAGED polygon (or 3NPS box)
has no full chord shape, the app falls back to rendering **close voicings** (compact
3–5 note grips). The current fallback selectors
(`selectCloseFallbacksForCagedPosition` / `selectCloseFallbacksForThreeNpsPosition`
in `src/hooks/voicingSelection.ts`) are pure *membership filters*: they return
**every** close voicing that fits strictly inside the polygon. `fallbackVoicingMatchesAtom`
then renders all of them, each with its own connector polyline.

The result, in a single fret region, is 2–3 overlapping grips whose dashed connector
lines cross one another. It is hard to tell what the actual voicings are or which note
belongs to which grip.

## Research summary

No mainstream guitar tool overlays multiple voicings on one neck. Chord Atlas, Chord!,
Oolimo, JGuitar, and ChordBank all either render **one grip at a time with prev/next
navigation** or use **small multiples** (separate mini-diagrams). Information-visualization
practice agrees: never paint every element at full salience at once (focus+context).
Edge bundling — the one technique that might merge crossing lines — makes individual line
endpoints harder to read, so it is the wrong tool here.

Playability ranking of guitar voicings has a well-established factor set in the
GA-tablature and A* fingering literature: fret span, number of fretted notes, compactness
(distance from the mean fret), a penalty for high-neck positions, and a reward for open
strings.

## Goal

Render **at most one** close voicing per polygon — the best-scored — instead of every
fitting grip. This mirrors how `full` mode already shows a single shape per polygon and
removes the overlapping-connector clutter at its source.

The existing string-set picker (`ChordStringSetToggleBar`, backed by `voicingStringSetAtom`
/ `effectiveStringSetAtom`) remains the user's "browse alternatives" axis: best grip is
chosen *within* the selected string set, and changing the string set is how the user
cycles to a different grip. No new picker UI is introduced.

## Design

### 1. Scoring (new, pure, in `@fretflow/core`)

Add a pure scorer in the shapes package (e.g. `packages/core/src/shapes/voicings.ts`
or a small co-located helper module):

```ts
scoreCloseVoicing(voicing: Voicing): number   // lower = better
```

Cost model (lower wins):

```
cost =  W_SPAN     * fretSpan
      + W_FRETTED  * frettedNoteCount
      + W_COMPACT  * sumAbsDistanceFromMeanFret
      + W_HIGHNECK * max(0, topFret - HIGH_NECK_THRESHOLD)
      - W_OPEN     * openStringCount
```

Where, derived entirely from `voicing.notes` (each note has `stringIndex`, `fretIndex`):

- `fretSpan` = `maxFret - minFret` over fretted notes (open strings, `fretIndex === 0`,
  excluded from span).
- `frettedNoteCount` = count of notes with `fretIndex > 0`.
- `sumAbsDistanceFromMeanFret` = `Σ |fretIndex - meanFret|` over fretted notes
  (compactness / hand-position coherence).
- `topFret` = highest `fretIndex`.
- `openStringCount` = count of notes with `fretIndex === 0`.
- `HIGH_NECK_THRESHOLD` = `7`.

Weights live as **named, documented constants** alongside the scorer (e.g.
`CLOSE_VOICING_SCORE_WEIGHTS`). They start as sensible hand-tuned defaults and are marked
adjustable. Initial defaults:

| Constant | Value | Rationale |
|---|---|---|
| `W_SPAN` | `3` | Wide stretches are the most painful; weight highest. |
| `W_FRETTED` | `1` | Fewer fretted notes = easier. |
| `W_COMPACT` | `1` | Reward grips clustered near one hand position. |
| `W_HIGHNECK` | `0.5` | Mild preference for the lower neck. |
| `W_OPEN` | `1.5` | Reward open strings (no lateral hand movement). |

These are starting values; they will be eyeballed against real output and tuned.

**Deterministic tie-break** (when costs are equal): lower `topFret`, then lower
string-set start index (lowest `stringIndex` present). This guarantees stable, repeatable
selection.

### 2. Selection change (`src/hooks/voicingSelection.ts`)

`selectCloseFallbacksForCagedPosition` and `selectCloseFallbacksForThreeNpsPosition`
keep their existing strict containment filter (`distanceOutsidePolygon === 0` for every
note), then **sort the survivors best-first** by `scoreCloseVoicing` with the
deterministic tie-break.

They return the **full ranked list** (not truncated). Keeping them pure and returning the
ordered list preserves testability and leaves room for a future cycle picker without
re-touching the scorer.

### 3. Render reduction (`src/store/voicingFallbackAtoms.ts`)

In `fallbackVoicingMatchesAtom`, the per-polygon loop (around line 189 for CAGED, and the
3NPS branch) takes only `ranked[0]` — a single `isFallback` grip per polygon — instead of
pushing every fitting grip.

No new atoms. No change to `visibleVoicingMatchesAtom`, the connector polyline hook
(`useChordConnectorPolylines`), or the SVG connector layer. The `isFallback` dashed-stroke
treatment is unchanged.

### 4. Out of scope (YAGNI)

- No dedicated next/prev cycle picker (the string-set toggle already serves this role).
- No per-voicing color, dimming, or hover-isolate.
- No change to full-chord matching logic.
- No change to the close/full/off mode toggle.

## Data flow (after change)

```
closeCandidatesAllStringSetsAtom        (all close voicings, all string sets)
        v
effectiveStringSetAtom                   (filter to user's picked string set)
        v
fallbackVoicingMatchesAtom               (per polygon: select fitting -> rank -> take [0])
        v   selectCloseFallbacksForCagedPosition / ...ForThreeNpsPosition (now ranked)
        v
visibleVoicingMatchesAtom                (unchanged merge with full matches)
        v
useChordConnectorPolylines -> FretboardConnectorLayer   (unchanged; one grip => no overlap)
```

## Testing (TDD)

**Core (`@fretflow/core`)**

- `scoreCloseVoicing`: a compact low-neck grip scores lower (better) than a wide
  high-neck stretch of the same chord; an open-string grip beats an equivalent fully
  fretted one.
- Deterministic tie-break: two equal-cost grips resolve to a stable, documented order.

**Selection (`voicingSelection.ts`)**

- `selectCloseFallbacksForCagedPosition` / `...ForThreeNpsPosition`: output is ordered
  best-first; strict containment is still enforced (no note outside the polygon/box).

**Atom (`voicingFallbackAtoms.ts`)**

- `fallbackVoicingMatchesAtom` returns exactly one fallback grip per qualifying polygon.

**Visual regression**

- The previously-overlapping scenario now renders a single clean grip. Refresh the
  `fretboard-svg` darwin snapshot (`pnpm run test:visual:update`).

## Verification

Run `pnpm run lint`, `pnpm run test`, and `pnpm run build` before opening the PR
(mandatory per project guide). Visually confirm in the dev server that a previously
cluttered position now shows one legible grip and that the string-set toggle still swaps
grips as expected.
