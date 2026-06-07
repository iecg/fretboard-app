# Improvisation Lenses — Design

**Date:** 2026-06-07
**Status:** Draft for review (rev. 2 — arpeggio lens cut; grounded in pedagogy)
**Area:** Fretboard practice emphasis (`practiceLensAtoms`, `FretboardSVG/utils/semantics`, `FretboardNote`, `ChordOverlayControls`)

## Problem

The fretboard has exactly one voice-leading cue: the **two-phase guide-tone
preview** (#537) — a calm dashed *planning* ring → urgent contracting *landing*
ring on the **next** chord's 3rd/7th. It is grounded in the standard
improvisation pedagogy (Galper's *Forward Motion*, Levine, Coker, Aebersold) and
"the hint is now in a really good spot."

But guide tones are one rung on a ladder that the literature lays out explicitly,
and the tool can only teach that one rung. A beginner is not ready for 3rds/7ths;
an advanced player wants more.

FretFlow used to have a `practiceLensAtom` mode selector (retired in the v2
"Lens Consolidation" — `v2RedesignMigration.ts:19`). This brings the lens
concept back, pointed at **improvisation targeting**, not the (also-removed)
scale-degree *coloring* lens (#534).

## What a lens must earn (and what got cut)

A lens only justifies itself if it shows something the **static chord overlay
cannot**. The overlay's blind spot is **time**: it only ever renders the
*current* chord.

This rules out a previously-proposed **"arpeggio / play the changes" lens**.
During playback the overlay *already* tracks the active progression step
(`chordRootAtom`/`chordTypeAtom` resolve to the active step,
`chordOverlayAtoms.ts:93-100`), spotlighting each chord's tones (large/colored)
against the dimmed scale and jumping on every change. And interval/degree labels
already exist as the **Note Labels → Intervals** setting (`displayFormat:
"degrees"`). "Spotlight the active chord's R-3-5-7 with interval labels" is
therefore *overlay + an existing setting* — no new capability. It is cut.

Mapping the pedagogy ladder (Aebersold's progressive method — roots → scale →
triad → chord tones → guide tones/voice-leading → chromatic approach) onto the
tool:

- The **"outline the chord / arpeggio"** rungs (triad, chord tones) are already
  served by the **static overlay** (it isolates chord tones, follows the
  progression, and can label them by interval). No lens needed.
- The rungs the overlay **cannot** serve are the **temporal / voice-leading**
  ones: aim at the *next* target before it lands, hold what's *common* across
  the change, approach the next target chromatically. **That is the lens
  territory.**

## Goal

Add a **lens selector** that swaps which *predictive / voice-leading* notes the
fretboard emphasizes during progression playback — climbing the pedagogy ladder
from root-targeting to guide tones to common-tone voice leading (and, later,
chromatic approach). The existing guide-tone behavior becomes one lens (the
default) and is unchanged when selected.

## Pedagogical grounding

The lens set is not arbitrary — it tracks the canonical sequence for learning to
"play the changes." Citations in **References**.

- **Roots first.** Aebersold's *Volume 1* method starts every student on the
  roots: "play the root of each chord," then the first five scale notes, then
  the triad (1-3-5), then full chord tones. Playing roots with the changes is
  the first step to *hearing* the progression go by. → **Root lens (L1).**

- **Then guide tones (3rd & 7th).** The 3rd and 7th are the quality-defining
  "money notes": the 3rd carries major vs. minor, the 7th carries dominant vs.
  major-7th. They voice-lead by the smallest interval (the 7th of one chord
  resolves a half/whole step to the 3rd of the next), with many common tones —
  the backbone of Levine's, Coker's, and Galper's approach to navigating
  changes. The **root and 5th are deliberately excluded**: they are
  harmonically inert — they do not distinguish chord quality — which is exactly
  why guide-tone lines are built from 3rds and 7ths only. (This is also why a
  standalone "5ths" lens is *not* proposed; altered 5ths, b5/#5, are quality
  tones and live inside the chord-tone overlay, not a lens.) → **Guide-tone
  lens (L2, today's default).**

- **Then common / pivot tones.** Voice-leading pedagogy: retain as many common
  tones as possible across a change, and let a held note **re-function** — e.g.
  in ii→V, Dm7 and G7 share D and F, and the held note's role changes (the b3
  of the ii becomes the b7 of the V). Knowing what *survives* the change tells a
  soloist what they can lean on or pivot through. The overlay shows one chord
  and so can never show this intersection. → **Common/pivot lens (L3).**

- **Then chromatic approach / enclosure** *(future, not in first cut).* Galper's
  *Forward Motion* reframes improvisation as lines that point **toward** a future
  target landing on a strong beat (1 or 3), with the downbeats carrying the
  working chord tones — embellished with chromaticism. Bebop pedagogy (Coker's
  *Elements of the Jazz Language*; approach-note/enclosure method) approaches a
  target note by half-step from above and/or below. A lens that previews the
  chromatic neighbors *into* the next guide tone is the natural top rung. →
  **Approach-note lens (L4, deferred — see Future Work.)**

## Two lens paradigms

The guide-tone ring is an **"aim"** cue: a planning→landing ring on the *next*
chord's targets. It is legible **only because there are 1–2 targets** — a
contracting "land on this on the beat" ring (Galper's downbeat target). That
generalizes to any *small* next-chord target set, but not to a whole chord.
So lenses split into:

| Family | Acts on | Mechanism | Lenses |
|--------|---------|-----------|--------|
| **Target** (aim ahead) | the **next** chord | the existing planning→landing **ring** + runway, verbatim — only the *target member set* changes | **Root**, **Guide tones** |
| **Field** (voice-leading) | **across** the change | size/opacity **hold** emphasis, no contracting ring | **Common/pivot** |

## The lenses (first cut)

| Lens | Family | Targets | What you see during playback | Pedagogy |
|------|--------|---------|------------------------------|----------|
| **Root** | Target | `{1}` of next chord | Planning→landing ring on the **next chord's root** (one target). Label `R`. | **L1** — Aebersold: play the roots; hear the changes before they land. |
| **Guide tones** *(default, today)* | Target | `{b3, 3, b7, 7}` of next chord | Unchanged: ring on next 3rd/7th, labels `3`/`b7`. | **L2** — Levine/Coker/Galper: quality-defining, smooth voice leading. |
| **Common / pivot** | Field | `active ∩ next` | Notes shared with the next chord get a steady **hold** emphasis (size hold + static ring) through the lead-in, so you see what survives the change. | **L3** — voice leading: retain/re-function common tones. |

## Architecture / Data Flow

The pipeline is already generic: `useEmphasisContext` →
`buildAnimatedFretboardNotes` → `getEmphasis` → `FretboardNote` ring/size. It
consumes target Sets/Maps and does not care *why* a note is a target. The work
is **(a)** a mode atom, **(b)** lens-aware target selection (Root), **(c)** one
new emphasis branch (Common hold).

### 1. Mode atom (`src/store/practiceLensAtoms.ts`)

```ts
export type PracticeLens = "guide" | "root" | "common";

// Reintroduces the retired `practiceLens` storage key. Defaults to "guide"
// so existing behavior is preserved on first load.
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "guide",
);
```

(`k` from `src/utils/storage.ts`, mirroring `voicingAtom`,
`chordOverlayAtoms.ts:177`.)

### 2. Lens-aware targets (Target family — Root & Guide)

Generalize the hardcoded `GUIDE_TONE_RAW` (`:195`) selection into a per-lens
member set, consumed by the existing next-chord target atom:

```ts
const TARGET_MEMBERS_BY_LENS: Record<"guide" | "root", Set<string>> = {
  guide: new Set(["b3", "3", "b7", "7"]), // = GUIDE_TONE_RAW (unchanged)
  root:  new Set(["1"]),
};
```

Rename `nextChordGuideToneLabelsAtom` → **`nextTargetToneLabelsAtom`** (keep a
thin `nextChordGuideToneLabelsAtom` alias for external callers/tests). It reads
`practiceLensAtom`; for the **`common`** lens it returns an **empty Map** (no aim
ring), so the ring path goes quiet and the field branch takes over.
`nextChordGuideTonesAtom` → derived keys, as today.

The whole ring path (`leadInActiveAtom`, `planningWindowActiveAtom`,
`getEmphasis` guide branches, the two-phase ring, CSS) needs **no change** for
Root — same code, one-element target set. Root always exists (unlike guide tones
for power chords), so Root always has exactly one target.

### 3. Common/pivot lens (`getEmphasis` + context)

- `TransitionRole` (`semantics.ts:9`) gains `"hold-common"`.
- `LeadLensContext` (`:26`) gains `lens: PracticeLens` and
  `commonTones: Set<string>` (from `commonTonesWithNextAtom:473` — currently
  unused, kept *explicitly* "as the natural input for a future held-tone cue";
  this is that cue).
- New branch in `getEmphasis` (`:59`), after the guide branches:
  - if `lens==="common" && (leadInActive || planningActive) && commonTones.has(notePc)`
    → `transitionRole:"hold-common"`, gentle `radiusBoost` hold, full opacity.

`useEmphasisContext` threads `lens` + `commonTonesWithNextAtom`;
`buildAnimatedFretboardNotes` (`useAnimatedFretboardView.ts:35`) copies them into
`LeadLensContext`. **Stale-render guard:** any new output-affecting field must be
added to `renderedNoteSignature` (`useAnimatedFretboardView.ts:97`).

### 4. Rendering (`FretboardNote.tsx`)

- **Root**: no change — `transitionRole` is still `guide-target`/`guide-preview`;
  only the target set differs. Label shows `R` via `guideTargetLabel`.
- **Common**: `transitionRole==="hold-common"` → a **static** (non-contracting)
  ring, `data-guide-phase="hold"`, reusing the planning-ring dashed style (no new
  color/shape); size hold via `radiusBoost`.
- New `data-guide-phase="hold"` branch in `FretboardSVG.module.css` (static,
  reuses `--note-incoming` hue).

### 5. UI selector (`ChordOverlayControls.tsx`)

Add a `Prop label={t("inspector.lensLabel")}` hosting a `ToggleBar` (3 options)
bound to `practiceLensAtom`, alongside Voicing — where the retired lens control
lived (`ViewTab.tsx:16`). New i18n strings in `src/i18n/{en,es}.ts` + `types.ts`
(`inspector.lensLabel`, `inspector.lens.{root,guide,common}`).

## Non-Goals

- **No new colors or marker shapes.** Lenses ride existing channels (ring, size,
  opacity, label); the only ring hue stays `--note-incoming`.
- **No change to static identity coloring.** The always-on teal 3rd/7th hue
  (`FretboardNote.tsx:142`) is chord-tone *identity*, not a lens — it stays on
  regardless of lens. Scale/chord color domains stay independent (`CLAUDE.md`).
- **Playback only.** A lens changes the view only while a progression is
  *playing* (`useEmphasisContext.ts:37` already returns `null` when not playing);
  static fretboard renders exactly as today.
- **No arpeggio/chord-outline lens** — already covered by the overlay + the
  Intervals label setting (see above).
- No per-lens configurability; fixed constants (matching the guide-tone preview).

## Constants

- `LEAD_IN_PROPORTION = 0.5`, `LEAD_IN_FLOOR_MS = 600`, `PLANNING_RUNWAY_BARS = 2`
  — unchanged; Target lenses reuse them.
- `COMMON_HOLD_RADIUS_BOOST ≈ 1.15` (new) — gentle size hold for pivot tones.

## Edge Cases

- **Root, power chord:** root always exists → exactly one target (cleaner than
  guide tones, which return empty for power chords).
- **Common, no common tones** (fully chromatic change): empty set → no hold that
  step. Truthful — nothing survives.
- **Common, ii→V example:** Dm7→G7 share D and F → both light up as holds in the
  lead-in, demonstrating the re-functioning pivot the pedagogy describes.
- **Last step, loop disabled:** Target/Common already see empty next sets
  (`nextChordTonesAtom:426`).
- **Not playing:** every lens inert (playback-only scope).
- **Lens switch mid-playback:** atoms recompute at the next frame-stable
  boundary; the cue swaps at the next step.

## Testing

- **Pure/atom:** `practiceLensAtom` default + persistence;
  `nextTargetToneLabelsAtom` → `{1}` for `root`, `{b3,3,b7,7}` for `guide`, empty
  for `common`; alias parity for `nextChordGuideToneLabelsAtom`.
- **Emphasis (`semantics.test.ts`):** `getEmphasis` → `guide-*` for root/guide;
  `hold-common` only in lead-in/planning under `common`; resting otherwise.
- **Component (`FretboardNote.test.tsx`):** Root shows ring + `R` label; Common
  shows static hold ring; guide unchanged.
- **Signature guard:** assert new fields in `renderedNoteSignature`.
- **Visual regression:** new `fretboard-svg`/`app-overlays` scenarios per lens
  (darwin + linux). Default `guide` scenarios must be **byte-identical** (proves
  no regression to today).
- **a11y:** rings/labels stay `aria-hidden`; the ToggleBar is keyboard- and
  screen-reader-labeled.

## Rollout / Verification

Mandatory before PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`. Manually
verify each lens at moderate BPM: Root rings the next root; Guide unchanged;
Common holds the shared tones into a ii→V change. Refresh visual snapshots via
`pnpm run test:visual:update` + linux baselines.

## Future Work

- **Approach-note / enclosure lens (L4).** Preview the chromatic neighbor(s)
  leading into the next guide tone (half-step from below/above), per Galper's
  forward-motion target-note framing and bebop enclosure pedagogy. Needs a new
  emphasis treatment for the *approach* note (it is outside the chord, often
  outside the scale) and is the natural extension once the first three lenses
  ship.
- **Leveled auto-advance.** The lenses form a curriculum (L1→L4); a future "level
  up" flow could sequence a learner through them. Out of scope here.

## Open Questions

1. **Selector shape** — `ToggleBar` (3 chips: Root / Guide / Common) vs.
   `LabeledSelect`. Lean: ToggleBar, full names via i18n tooltip.
2. **Default lens** — keep `guide` (zero behavior change; recommended) vs. `root`
   (gentlest on-ramp).
3. **Common-tone timing** — hold across the whole active chord, or only in the
   planning/lead-in window (spec assumes lead-in/planning, mirroring "as the
   change approaches").

## Files Touched

- `src/store/practiceLensAtoms.ts` — `PracticeLens`, `practiceLensAtom`,
  `TARGET_MEMBERS_BY_LENS`, lens-aware `nextTargetToneLabelsAtom` (+ alias), wire
  `commonTonesWithNextAtom` into context inputs.
- `src/components/FretboardSVG/utils/semantics.ts` — `TransitionRole`,
  `LeadLensContext` fields, `getEmphasis` common-hold branch, hold const.
- `src/components/FretboardSVG/hooks/useEmphasisContext.ts` — thread lens +
  common atom.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` — copy new
  context fields; extend `renderedNoteSignature`.
- `src/components/FretboardSVG/FretboardNote.tsx` — common hold ring
  (`data-guide-phase="hold"`).
- `src/components/FretboardSVG/FretboardSVG.module.css` —
  `[data-guide-phase="hold"]` static ring.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — lens ToggleBar.
- `src/i18n/{en,es}.ts` + `types.ts` — lens labels.
- Co-located tests + `e2e/` snapshots.

## References

Pedagogy grounding for the lens ladder (roots → guide tones → common/pivot →
chromatic approach):

- Hal Galper, *Forward Motion: From Bach to Bebop* — target notes resolving to
  chord tones on downbeats; lines pointing toward future targets.
  <https://halgalper.com/articles/understandingforwardmotion/> ·
  <https://www.goodreads.com/book/show/1372844.Forward_Motion>
- Mark Levine, *The Jazz Theory Book* (Sher Music, 1995) — guide tones (3rds &
  7ths) and voice leading through changes.
- Jerry Coker, *Patterns for Jazz*, *Improvising Jazz*, and *Elements of the
  Jazz Language for the Developing Improvisor* — guide-tone lines; approach
  notes / enclosures.
- Jamey Aebersold, *Volume 1: How To Play Jazz & Improvise* — the progressive
  ladder (roots → scale → triad → chord tones).
  <https://www.alfred.com/jamey-aebersold-jazz-volume-1-how-to-play-jazz-and-improvise/p/24-V01DS/>
  · <https://www.midwestclinic.org/user_files_1/pdfs/clinicianmaterials/2008/jamey_aebersold.pdf>
- LearnJazzStandards, "Use Guide-Tones to Navigate Chord Changes" —
  <https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/use-guide-tones-navigate-chord-changes/>
- Fundamental Changes, "Using Guide Tones in the Blues (3rds and 7ths)" —
  <https://www.fundamental-changes.com/using-guide-tones-blues-3rds-7ths/>
- The Jazz Piano Site, "Voice Leading" (common tones / re-functioning; Dm7↔G7
  example) — <https://www.thejazzpianosite.com/jazz-piano-lessons/jazz-chord-progressions/voice-leading/>
- Anton Schwartz, "Approaches & Enclosures" —
  <https://antonjazz.com/2019/07/approaches-enclosures/>
- Jazz Lesson Videos, "15 Approach Note and Enclosure Exercises Every Jazz
  Musician Should Know" —
  <https://www.jazzlessonvideos.com/post/15-approach-note-and-enclosure-exercises-that-every-jazz-musician-should-know>
</content>
