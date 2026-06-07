# Improvisation Lenses — Design

**Date:** 2026-06-07
**Status:** Draft for review
**Area:** Fretboard practice emphasis (`practiceLensAtoms`, `FretboardSVG/utils/semantics`, `FretboardNote`, `ChordOverlayControls`)

## Problem

The fretboard has exactly one voice-leading cue: the **two-phase guide-tone
preview** (#537). On the *next* chord's 3rd/7th it draws a calm dashed
**planning** ring (from chord onset, capped 2 bars out) that morphs into the
urgent contracting **landing** ring for the final lead-in window. It is
grounded in the canonical improvisation pedagogy (Galper's *Forward Motion*,
Aebersold, Levine) and "the hint is now in a really good spot."

But guide tones are a single rung on a much taller ladder. The 3rd/7th target
is **L2** improvisation practice; a beginner is not ready for it and an
advanced player wants more. The tool can only teach the one rung:

- A beginner needs to first learn to **track the changes** — land on each
  chord's **root** — before the 3rd/7th has any meaning.
- A player learning to **outline the harmony** ("play the changes") wants to
  see each chord's **full arpeggio** light up as the progression moves.
- A player working on **voice leading** wants to know which notes **survive
  the change** (common/pivot tones) so they can hold or pivot on them.

FretFlow used to have a `practiceLensAtom` mode selector (retired in the v2
"Lens Consolidation" — `src/store/v2RedesignMigration.ts:19`). This brings the
lens concept back, but pointed at **improvisation targeting** rather than the
old (also-removed) scale-degree *coloring* lens (#534).

## Goal

Add a **lens selector** that swaps which notes the fretboard emphasizes during
progression playback, so one tool teaches the whole improvisation ladder —
roots → guide tones → arpeggios — plus a voice-leading (common-tone) view. The
existing guide-tone behavior becomes one lens (the default) and is unchanged
when selected.

## Non-Goals

- **No new colors or marker shapes.** The vocabulary stays circle/diamond +
  the existing target-ring hue (`--note-incoming`). Lenses ride the existing
  emphasis channels (ring, size, opacity, label).
- **No change to static identity coloring.** The always-on teal 3rd/7th hue
  (`data-note-guide-tone`, `FretboardNote.tsx:142`) is chord-tone *identity*,
  not a lens — it stays on regardless of the active lens. Scale and chord color
  domains stay independent (per `CLAUDE.md`).
- **Playback only.** A lens only changes the view while a progression is
  *playing*. With nothing playing, the fretboard renders exactly as today,
  whatever the selected lens. (Confirmed scope decision.)
- No per-lens configurability (runway length, etc.) — fixed sensible constants,
  matching the guide-tone preview's approach.
- No leveled/auto-advancing curriculum — just a manual selector. (The ladder is
  the pedagogy; sequencing through it is a future concern.)

## Two lens paradigms

The guide-tone ring is an **"aim"** cue: a planning→landing ring on the *next*
chord's targets. It works **because there are only 1–2 targets** — a contracting
"land on this" ring is legible. That generalizes cleanly to any *small* target
set, but not to a whole arpeggio (R-3-5-7 is up to ~16 lit positions; ringing
them all is noise). So lenses split into two families:

| Family | Acts on | Mechanism | Lenses |
|--------|---------|-----------|--------|
| **Target** (aim) | the **next** chord | the existing planning→landing **ring** + runway, verbatim — only the *target member set* changes | **Root**, **Guide tones** |
| **Field** (reshape) | the **active** chord | recede/anchor via **size + opacity + interval labels**; no contracting ring | **Arpeggio**, **Common/pivot** |

## The lenses

| Lens | Family | Target members | What you see during playback | Pedagogy |
|------|--------|----------------|------------------------------|----------|
| **Root** | Target | `{1}` | Planning→landing ring on the **next chord's root** (one target). Label `R`. | **L1** — track the changes; the beginner rung below guide tones. |
| **Guide tones** *(default, today)* | Target | `{b3, 3, b7, 7}` | Unchanged: ring on the next chord's 3rd/7th, labels `3`/`b7`. | **L2** — voice-leading "money notes." |
| **Arpeggio** ("play the changes") | Field | active chord's R-3-5-7 | The **active** chord's chord-tones brighten across the neck with `1`/`3`/`5`/`7` labels; scale-only notes recede hard. Spotlight jumps each chord change. | **L3** — outline the harmony; see the changes as shapes. |
| **Common / pivot** | Field | `active ∩ next` | Notes shared with the next chord get a steady **hold** emphasis during the lead-in (size hold + static ring), so you know what survives the change. | Voice leading — hold/pivot across changes. |

Why **not** a standalone "5ths" lens (an explicitly raised option): the perfect
5th is harmonically inert — it does not define chord quality, which is exactly
why it is never a guide tone (`practiceLensAtoms.ts:506` rationale). Aiming at
5ths teaches the one tone that carries no quality information. Altered fifths
(b5/#5) *do* matter — and they surface naturally inside the **Arpeggio** lens,
which is the right home for them.

## Architecture / Data Flow

The pipeline is already generic: `useEmphasisContext` →
`buildAnimatedFretboardNotes` → `getEmphasis` → `FretboardNote` ring/size. It
consumes target Sets/Maps and does not care *why* a note is a target. The lens
work is mostly **(a)** a new mode atom, **(b)** making the target set
lens-aware, and **(c)** two new emphasis branches for the field lenses.

### 1. Mode atom (`src/store/practiceLensAtoms.ts`)

```ts
export type PracticeLens = "guide" | "root" | "arpeggio" | "common";

// Reintroduces the retired `practiceLens` storage key. Defaults to "guide"
// so existing behavior is preserved on first load.
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "guide",
);
```

(`k` from `src/utils/storage.ts`, mirroring `voicingAtom` in
`chordOverlayAtoms.ts:177`.)

### 2. Lens-aware targets (Target family)

Generalize the hardcoded `GUIDE_TONE_RAW` (`:195`) selection into a per-lens
member set, consumed by the existing next-chord target atom:

```ts
const TARGET_MEMBERS_BY_LENS: Record<"guide" | "root", Set<string>> = {
  guide: new Set(["b3", "3", "b7", "7"]), // = GUIDE_TONE_RAW (unchanged)
  root:  new Set(["1"]),
};
```

Rename `nextChordGuideToneLabelsAtom` → **`nextTargetToneLabelsAtom`** (keep a
thin `nextChordGuideToneLabelsAtom` alias for any external callers / tests). It
reads `practiceLensAtom`; for a **Field** lens (`arpeggio`/`common`) it returns
an **empty Map** (no aim ring), so the existing ring path naturally goes quiet
and the field branch takes over. `nextChordGuideTonesAtom` → derived keys, as
today.

The whole ring path (`leadInActiveAtom`, `planningWindowActiveAtom`,
`getEmphasis` guide branches, `FretboardNote` two-phase ring, CSS) needs **no
change** for Root — it is the same code with a one-element target set.

### 3. Field lenses (`getEmphasis` + context)

Extend the emphasis layer (`semantics.ts`):

- `TransitionRole` (`:9`) gains `"arpeggio-tone" | "hold-common"`.
- `LeadLensContext` (`:26`) gains:
  - `lens: PracticeLens`
  - `activeChordTones: Set<string>` (for Arpeggio; from `activeChordTonesAtom:443`)
  - `activeMemberLabels: Map<string,string>` (pc → `1`/`3`/`5`/`7` for the active chord)
  - `commonTones: Set<string>` (for Common; from `commonTonesWithNextAtom:473`)
- New branches in `getEmphasis` (`:59`), ordered after the existing guide branches:
  - **Arpeggio:** if `lens==="arpeggio"`:
    - `activeChordTones.has(notePc)` → full opacity, resting size,
      `transitionRole:"arpeggio-tone"`, `guideTargetLabel = activeMemberLabels.get(pc)`.
    - else (scale-only / color-tone) → stronger recede (e.g. `opacityBoost ≈ 0.4`).
  - **Common:** if `lens==="common" && (leadInActive || planningActive) && commonTones.has(notePc)`
    → `transitionRole:"hold-common"`, gentle `radiusBoost` hold, full opacity.

`useEmphasisContext` (`useEmphasisContext.ts`) threads the new atoms;
`buildAnimatedFretboardNotes` (`useAnimatedFretboardView.ts:35`) copies them into
`LeadLensContext`. Remember the **stale-render guard**: add any new
output-affecting field to `renderedNoteSignature` (`useAnimatedFretboardView.ts:97`).

### 4. Rendering (`FretboardNote.tsx`)

- **Root**: no change — `transitionRole` is still `guide-target`/`guide-preview`;
  only the underlying target set differs. Label shows `R`/`1` via `guideTargetLabel`.
- **Arpeggio**: `transitionRole==="arpeggio-tone"` → render the interval label
  (reuse the `guideTargetLabel` text element) but **no ring** (a ring per chord
  tone is the noise we are avoiding). Recede handled by the emphasis opacity.
- **Common**: `transitionRole==="hold-common"` → a **static** (non-contracting)
  ring, `data-guide-phase="hold"`, reusing the planning-ring dashed style so no
  new CSS color/shape is introduced; the size hold comes from `radiusBoost`.
- New `data-guide-phase="hold"` branch in `FretboardSVG.module.css` (static,
  reuses `--note-incoming` hue).

### 5. UI selector (`ChordOverlayControls.tsx`)

Add a `Prop label={t("inspector.lensLabel")}` hosting a `ToggleBar` (4 options)
bound to `practiceLensAtom`, alongside the existing Voicing control. This is
where the retired lens control lived (`ViewTab.tsx:16` references the Chord
inspector hosting "voicing, lens, string set, lock-to-scale"). New i18n strings
in `src/i18n/{en,es}.ts` + `types.ts` (`inspector.lensLabel`,
`inspector.lens.{guide,root,arpeggio,common}`).

## Constants

- `LEAD_IN_PROPORTION = 0.5`, `LEAD_IN_FLOOR_MS = 600`, `PLANNING_RUNWAY_BARS = 2`
  — all unchanged; Target lenses reuse them.
- `ARPEGGIO_RECEDE_OPACITY ≈ 0.4` (new) — how hard non-chord-tones fade in the
  arpeggio spotlight. (Resting recede today is `0.7`.)
- `COMMON_HOLD_RADIUS_BOOST ≈ 1.15` (new) — gentle size hold for pivot tones.

## Edge Cases

- **Root lens, power chord:** root always exists → always exactly one target
  (cleaner than guide tones, which return empty for power chords).
- **Arpeggio lens, scale = None:** chord tones still resolve from the active
  chord; with no scale there are simply no scale-only notes to recede.
- **Common lens, no common tones** (fully chromatic change): empty set → no hold
  emphasis that step. Acceptable (truthfully: nothing survives).
- **Last step, loop disabled:** Target/Common lenses already return empty next
  sets (`nextChordTonesAtom:426`); Arpeggio still spotlights the final chord.
- **Not playing:** every lens is inert (playback-only scope) — `useEmphasisContext`
  already returns `null` when `!playing` (`useEmphasisContext.ts:37`).
- **Lens switch mid-playback:** atoms recompute on the next frame-stable
  boundary; the ring/spotlight swaps at the next step (no mid-step flschange needed).

## Testing

- **Pure / atom:** `practiceLensAtom` default + persistence;
  `nextTargetToneLabelsAtom` returns `{1}`-based targets for `root`, `{b3,3,b7,7}`
  for `guide`, empty for field lenses; alias parity for
  `nextChordGuideToneLabelsAtom`.
- **Emphasis (`semantics.test.ts`):** `getEmphasis` returns `guide-*` for
  root/guide; `arpeggio-tone` + label for active chord tones and hard recede for
  scale-only under `arpeggio`; `hold-common` only in lead-in/planning under
  `common`; resting otherwise.
- **Component (`FretboardNote.test.tsx`):** Root shows ring + `R` label;
  Arpeggio shows interval labels and **no** ring; Common shows static hold ring;
  guide unchanged.
- **Signature guard:** assert new fields are in `renderedNoteSignature` (a stale
  note would otherwise render the wrong lens).
- **Visual regression:** new `fretboard-svg` / `app-overlays` scenarios per lens
  (darwin + linux). The default `guide` scenarios must be **byte-identical**
  (proves no regression to today's behavior).
- **a11y:** rings/labels stay `aria-hidden`; the new ToggleBar is keyboard- and
  screen-reader-labeled.

## Rollout / Verification

Mandatory before PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`. Manually
verify each lens at a moderate BPM: Root rings the next root; Guide is unchanged;
Arpeggio spotlights each chord's R-3-5-7 with labels and recedes the scale;
Common holds the pivot tones into the change. Refresh visual snapshots via
`pnpm run test:visual:update` and regenerate linux baselines.

## Open Questions

1. **Selector home & shape** — `ToggleBar` in `ChordOverlayControls` (4 chips)
   vs. a `LabeledSelect` (more room for names). Lean: ToggleBar with short
   labels (Root / Guide / Arp / Common), full names via tooltip/i18n.
2. **Default lens** — keep `guide` (preserves current behavior; recommended) vs.
   `root` (gentlest on-ramp for new users).
3. **Common-tone timing** — show the hold across the whole active chord, or only
   in the planning/lead-in window (spec assumes lead-in/planning, mirroring the
   "as the change approaches" framing).
4. **Arpeggio + ring combo** — pure spotlight (spec's choice) vs. also keeping a
   single ring on the next root for change-tracking. Spec keeps it pure to avoid
   mixing paradigms; revisit if testing shows users lose the pulse.

## Files Touched

- `src/store/practiceLensAtoms.ts` — `PracticeLens`, `practiceLensAtom`,
  `TARGET_MEMBERS_BY_LENS`, lens-aware `nextTargetToneLabelsAtom` (+ alias),
  active-member-labels atom, wire `commonTonesWithNextAtom` into context inputs.
- `src/components/FretboardSVG/utils/semantics.ts` — `TransitionRole`,
  `LeadLensContext` fields, `getEmphasis` field-lens branches, recede/hold consts.
- `src/components/FretboardSVG/hooks/useEmphasisContext.ts` — thread lens +
  active/common atoms.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` — copy new
  context fields; extend `renderedNoteSignature`.
- `src/components/FretboardSVG/FretboardNote.tsx` — arpeggio label (no ring),
  common hold ring (`data-guide-phase="hold"`).
- `src/components/FretboardSVG/FretboardSVG.module.css` — `[data-guide-phase="hold"]`
  static ring (reuses incoming hue).
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — lens ToggleBar.
- `src/i18n/{en,es}.ts` + `types.ts` — lens labels.
- Co-located tests + `e2e/` snapshots.
</content>
</invoke>
