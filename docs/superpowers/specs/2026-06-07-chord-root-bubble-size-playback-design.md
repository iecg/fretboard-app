# Chord-root Bubble Size During Playback — Design

Date: 2026-06-07
Status: Design (approach approved — Approach A)
Supersedes the open question in: `2026-06-06-chord-root-bubble-size-playback-research.md`

## Problem

During progression playback the chord **root** note bubble reads as disproportionately
larger than other chord tones, and the effect worsens when that root is also a guide
tone for the next chord. The size asymmetry is unintended and reads as visual noise
rather than as meaningful information.

## Root cause (confirmed)

All chord-tone classes share the same static `radiusScale` (`RADIUS_CHORD = 0.95`,
`semantics.ts:185`). The size difference comes entirely from the **emphasis layer**.

`getEmphasis()` (`semantics.ts:90-93`) gives a `radiusBoost: 1.15` to any note that is
both a chord tone **and** a common tone with the next chord:

```ts
const resting: LensEmphasis =
  CHORD_TONE_CLASSES.has(noteClass) && commonWithNext.has(notePc)
    ? { radiusBoost: 1.15, opacityBoost: 1 }
    : applyTonesBase(noteClass);
```

Five factors compound on a current-chord root during playback:

| Factor | Source | Effect on root |
|---|---|---|
| Chord-tier radius `0.95` | `semantics.ts:185` | Same as all chord tones (fair) |
| Common-tone boost `1.15×` | `semantics.ts:92` | Roots are frequently common tones → boosted |
| Match is by **pitch class**, not voicing | `commonWithNext.has(notePc)` | **Every** root position on the neck boosts, not one |
| Thicker stroke `2.4` vs `2.2` | `FretboardSVG.module.css:79` | Static heaviness |
| Guide-target ring + label + flash, all `×1.15` | `FretboardNote.tsx:158` scales the whole `<g>` | Footprint balloons when root = next chord's guide tone |

### Correction to the research doc

The research doc stated that guide-tone status "does not stack" because the
`guide-target` / `guide-preview` branches return `resting.radiusBoost` with no extra
multiply. That is true of the **radius number**, but misses the real mechanism: the
`--emph-scale` (= `radiusBoost`) CSS transform is set on the entire `<g>`
(`FretboardNote.tsx:148,158`), which wraps the guide decoration — backing disc, halo
ring at `r + standoff`, label, and on-beat flash (`FretboardNote.tsx:167-247`). So the
`1.15×` scales the whole decorated cluster, ring and all — not just the bubble. That is
why a root that is also the next chord's guide target looks especially large.

### Why the held-tone cue "doesn't carry through"

The `1.15×` is applied uniformly to **all** common tones across **all** of their neck
positions. It inflates a whole cloud of notes slightly rather than marking one held
voice, so it does not communicate "this specific note sustains into the next chord."
Because the root is almost always in that cloud, the size boost and root identity become
conflated — size cannot mean "held" when it always coincides with "root." The voice-
leading story is already told, more clearly, by the guide-ring lead-in countdown. The
size boost is a weak, conflicting second telling.

## Chosen approach: A — remove the common-tone size boost

Stop boosting common tones. During playback, bubble size then encodes only the existing
chord-tier vs scale-tier distinction; roots are no longer singled out by size.

Approaches B (uniform boost), C (move the held cue to color/stroke), and D (exclude the
root from the boost) were considered and recorded in the research doc. A was chosen
because the research shows the held-tone size cue is both ineffective and overloaded, and
because removing it is the smallest, highest-confidence, fully reversible change. If a
held-tone cue is later judged valuable, **Approach C should be pursued as its own scoped
visual-design task**, not folded into this fix (YAGNI).

## The change

### 1. `getEmphasis()` — `semantics.ts`

Remove the common-tone special case. With the boost gone, the `resting` ternary
collapses to the base model (for a chord tone, `applyTonesBase` already returns
`{ radiusBoost: 1, opacityBoost: 1 }`):

```ts
// before
const resting: LensEmphasis =
  CHORD_TONE_CLASSES.has(noteClass) && commonWithNext.has(notePc)
    ? { radiusBoost: 1.15, opacityBoost: 1 }
    : applyTonesBase(noteClass);

// after
const resting: LensEmphasis = applyTonesBase(noteClass);
```

`notePc` and `commonWithNext` are no longer read by the resting branch. `notePc` is still
used by the guide-target / guide-preview branches, so it stays. `commonWithNext` becomes
unused inside `getEmphasis`.

### 2. Prune the now-dead `commonWithNext` plumbing

`commonWithNext` is consumed **only** by the resting boost. Remove it from the context
type and the hooks that populate it:

- `semantics.ts` — drop `commonWithNext` from `LeadLensContext` and from the destructure
  at `semantics.ts:85`.
- `hooks/useEmphasisContext.ts` — drop the `commonWithNext` field (`:15`, `:42`) and its
  `useAtomValue(commonTonesWithNextAtom)` read (`:34`), and the now-unused import (`:3`).
- `hooks/useAnimatedFretboardView.ts` — drop the `commonWithNext` pass-through (`:45`).

### 3. Keep `commonTonesWithNextAtom`

`commonTonesWithNextAtom` (`store/practiceLensAtoms.ts:469`) is a small pure derived
selector with its own unit tests asserting intersection semantics. Keep it: it is a
sensible reusable primitive and the natural input for a future Approach-C held-tone cue.
Leaving it in place avoids churn we would otherwise reverse. (Alternative, if the team
prefers zero orphaned exports: delete the atom and its tests in
`store/practiceLensAtoms.test.ts`. Not recommended.)

## Test impact

`src/components/FretboardSVG/utils/semantics.test.ts` has two tests asserting the
`1.15` boost that must be rewritten to assert the new behavior — a held common tone is
now treated identically to any other chord tone (`{ radiusBoost: 1, opacityBoost: 1 }`):

- `:436` "a held common tone keeps its hold glow DURING the lead-in (no flicker)"
- `:454` "outside the lead-in window, a held common tone keeps a static hold glow"

Rewrite both to assert no size boost (renaming them away from "hold glow" since that cue
is removed), so they lock in the fix and prevent regression. The `commonWithNext` keys in
those test contexts (`:439`, `:456`) are removed along with the context field.

`store/practiceLensAtoms.test.ts` is unchanged (the atom stays).

## Out of scope

- Approach C (a color/stroke held-tone cue). If desired, it becomes a separate spec.
- The static stroke-width difference (`2.4` root vs `2.2` chord tone). It is a deliberate
  root-identity cue and is not the playback problem; leave it unchanged.
- Guide-ring behavior. Unchanged — it remains the primary voice-leading signal.

## Verification

1. `pnpm run lint` — confirms no unused imports/fields remain after the prune.
2. `pnpm run test` — semantics tests pass with the rewritten assertions.
3. `pnpm run build`.
4. `pnpm run test:visual:update` — capture the new playback appearance (roots no longer
   enlarged), then review the snapshot diff to confirm the asymmetry is gone and nothing
   else shifted.

## File inventory

| File | Role in change |
|---|---|
| `src/components/FretboardSVG/utils/semantics.ts` | Remove boost; simplify `resting`; drop `commonWithNext` from `LeadLensContext` |
| `src/components/FretboardSVG/hooks/useEmphasisContext.ts` | Drop `commonWithNext` field + atom read + import |
| `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` | Drop `commonWithNext` pass-through |
| `src/components/FretboardSVG/utils/semantics.test.ts` | Rewrite the two "hold glow" tests to assert no boost |
| `src/store/practiceLensAtoms.ts` | Unchanged (`commonTonesWithNextAtom` kept) |
