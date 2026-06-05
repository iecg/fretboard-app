# Taper-aware Note-bubble Sizing — Design

Date: 2026-06-05
Status: Approved (brainstorm complete)
Supersedes: `2026-06-05-connector-improvements-draft.md`
Builds on: PR #535 (line-only connector spine + color/dash disambiguation)

## Purpose

Improve how vertically-stacked chord voicings read near the start of the neck.
Where the neck taper converges the strings toward the nut, fixed-size note
bubbles crowd one another and the connector spine has no clean room to run
through them. The fix sizes bubbles to the **local** vertical string spacing so
the crowded nut region relaxes while the rest of the neck stays untouched.

This brainstorm started from a four-concern draft. After scoping, three of the
four resolved to "no dedicated code change":

- **§1 Taper-aware bubble sizing** — the one real deliverable.
- **§2 Spine ↔ bubble routing** — folds into §1; deferred to a post-§1 visual
  check with an acceptance criterion, no code planned.
- **§3 Color/dash tuning** — deferred to a post-§1 visual pass with acceptance
  criteria, no numbers locked now.
- **§4 Crossing-heavy focus** — dropped entirely.

## Background

- Connectors render as **line-only spines** through voicing note centers, drawn
  under the markers. Overlapping voicings are disambiguated by per-voicing
  **color + dash** (PR #535). The ribbon fill and radius-offset machinery are
  retired.
- The neck is drawn with a **taper**: strings converge toward the nut. In
  `fretboardGeometry.ts#getStringY` the vertical string span at a given `x` is:

  ```text
  xFrac      = clamp(x / neckWidthPx, 0, 1)
  localSpread = (STRING_SPREAD_LEFT_FRAC + (1 - STRING_SPREAD_LEFT_FRAC) * xFrac)
                * neckHeight * STRING_OCCUPY_FRAC
  ```

  So string-to-string spacing is `localSpread / (numStrings - 1)`, scaling
  linearly from `STRING_SPREAD_LEFT_FRAC` of full spacing at the nut (`xFrac=0`)
  up to full spacing at the bridge end (`xFrac=1`).

- Bubble radius today (`utils/noteSizing.ts`, `FretboardNote.tsx`) is derived
  from the **global** `stringRowPx`:
  `radius = stringRowPx * NOTE_BUBBLE_RATIO * 0.5 * radiusScale - reduction`.
  It has no knowledge of `x`, so a fret-1 bubble is drawn at full mid-neck size
  even though its vertical neighbors have converged. Worked example (live, C+
  chord): spine `M 20.5 37 L 84.5 65 L 84.5 94` — two fret-1 bubbles ~29px apart
  vertically, each ~30px in diameter, so they effectively touch and the spine
  threads the jam.

## §1 — Taper-aware, shrink-only bubble radius

### Behavior

Introduce a pure scalar `taperAwareRadiusScale(x) ∈ [minScale, 1]` that
multiplies the existing per-role `radiusScale`. Definition:

```text
spacingRatio(x)   = STRING_SPREAD_LEFT_FRAC + (1 - STRING_SPREAD_LEFT_FRAC)
                    * clamp(x / neckWidthPx, 0, 1)
localSpacing(x)   = spacingRatio(x) * maxSpacing          // maxSpacing = spacing at xFrac = 1
referenceSpacing  = fullBubbleDiameter + GAP             // self-calibrating from the bubble's own size
taperAwareRadiusScale(x) = clamp(localSpacing(x) / referenceSpacing, minScale, 1)
```

Properties this gives us:

- **Mid/high neck is pixel-identical.** Wherever local spacing already exceeds a
  comfortable bubble (`referenceSpacing`), the ratio is ≥ 1 and the clamp pins
  scale to exactly 1. Only the nut region — the only place strings are closer
  than one bubble-plus-gap — dips below 1.
- **Self-calibrating.** `referenceSpacing` is derived from the bubble's own full
  diameter, so there is no magic fret threshold and no hard-coded breakpoint.
  The shrink region is exactly the set of `x` where a full bubble wouldn't fit.
- **Column-consistent.** Scale is purely `f(x)` — every note in a fret column
  shrinks by the same factor; no per-string jitter, no size mismatch between
  adjacent strings at the same fret.
- **`minScale` floor** (≈ 0.72, confirm visually) keeps labels legible at the
  very tightest spacing.

### Module boundary

- New pure helper alongside `chordRootVisualRadiusPx` in
  `src/components/FretboardSVG/utils/noteSizing.ts`:
  `taperAwareRadiusScale(x, geometry) → number`. Side-effect-free, unit-testable
  with no DOM. Fed the same geometry constants the board already computes
  (`neckWidthPx`, the spread/occupy fractions, the full bubble diameter).
- Applied where `baseRadius` / `radiusScale` resolve into a pixel radius
  (`FretboardNote.tsx` / `FretboardNoteLayer`), multiplying the role
  `radiusScale` before the reduction step.
- **Note-marker change only.** Post-#535 the connector spine is a line through
  note centers, so it inherits the relief for free — no connector-side edit.
- **Open item for the plan:** whether the hit-target layer
  (`FretboardHitTargetLayer`) should track the same scale for touch accuracy.
  Lean: yes, apply the same scalar so the touch area matches the visible bubble.

### Constants to confirm visually (mechanism is fixed, values are tuning)

- `minScale` — radius floor (start ≈ 0.72).
- `GAP` — desired clear gap inside `referenceSpacing` (small px or a fraction of
  the diameter).

## §2 — Spine ↔ bubble routing (deferred)

No code in this spec. After §1 lands, visually inspect cramped nut voicings.

**Acceptance criterion:** no voicing's spine is fully occluded by its own bubbles
at minimum supported zoom. Only if a specific case still fails do we revisit
trimming spine segments to bubble rims (a self-contained change in the spine
builder, `useChordConnectorPolylines.ts`).

## §3 — Color/dash legibility (deferred)

No locked numbers. Re-evaluate on the post-§1 board because §1 changes connector
density near the nut.

**Acceptance criteria** (both wood themes):

- Every concurrently-rendered voicing is visually distinguishable.
- The dash pattern is legible at minimum supported zoom.
- No palette entry falls below the contrast threshold on wood.

If any criterion fails, tune `CONNECTOR_PALETTE_ROTATION`, the dash pattern, or
add zoom-scaled dashes in a follow-up — out of scope for this spec's
implementation unless a criterion fails during the §1 visual pass.

## Non-goals

- CAGED shape **boundary** delineation (separate scale-domain problem).
- Re-introducing the ribbon/tube fill or radius-offset machinery.
- A crossing-focus / hover-selection interaction layer (§4, dropped).
- Changing the taper geometry itself (it stays; bubbles adapt to it).

## Testing

- **Unit** (`noteSizing` test): `taperAwareRadiusScale` returns exactly 1 for
  wide `x`, shrinks monotonically as `x → 0`, never exceeds 1, never drops below
  `minScale`.
- **Component**: update existing `FretboardNoteLayer` / `FretboardNote` radius
  expectations to fold in the scale (= 1 at their test positions, or adjusted so
  the asserted radius accounts for the scalar).
- **Visual regression**: refresh darwin + linux snapshots for the nut-region
  suites (`fretboard-svg`, `app-components`). Confirm mid/high-neck bubbles are
  pixel-unchanged and only the nut region shrinks.

## Sequencing

1. §1 implementation + unit/component tests.
2. §1 visual pass (refresh snapshots) — during which §2 and §3 acceptance
   criteria are checked against the real post-§1 board.
3. Only if a §2/§3 criterion fails: a small scoped follow-up (own change).
