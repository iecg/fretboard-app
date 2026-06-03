# Chord Transition Rework — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)

## Problem

During progression playback the fretboard transitions between chords poorly:

1. **Notes "pop."** At a chord boundary, notes snap in and out instead of
   transitioning. Three mechanical causes:
   - Visibility uses `display:none` (`note-inactive` →
     `.hidden { display:none }` in `FretboardSVG.module.css:30`), which cannot
     animate. Notes vanish/appear instantly.
   - Role changes swap the SVG element and jump the radius. `getNoteVisuals`
     (`utils/semantics.ts:167`) returns a different shape *and* `radiusScale`
     per role (squircle `<path>` 1.2× vs circle 0.85×). The CSS transitions
     (`module.css:39`) only cover `fill/stroke/stroke-width` and the
     `--emph-scale` transform — not the base `r` attribute, not element swaps.
   - The glow underlay (`FretboardNote.tsx:200`) is conditionally rendered only
     when `glowColor` is set, so glows blink in/out on mount/unmount instead of
     fading.

2. **The next-chord hint reads poorly.**
   - The hint only glows next-chord pitch classes on positions **already visible
     in the current scale**. Next-chord tones *outside* the current scale are
     `note-inactive`/hidden right now, so the exact spots the hand moves to
     **do not preview at all** — they pop in at the boundary. The most
     informative hint is the missing one.
   - Anticipation is a **binary flip on the last beat**
     (`isInAnticipationWindow`, `practiceLensAtoms.ts:103`) — snaps on, pulses,
     snaps off. At fast tempo a single beat is too short to read.
   - The anticipation color `#fb923c` (`semantic.css:146`) is nearly identical
     to the tension role and guide-tone lens orange, so the hint has no distinct
     identity.
   - It fires on the **whole** next chord, not just where the hand moves →
     visually noisy ("a lot going on").

## Performance guardrails (non-negotiable)

The recent jank fix (commit 311278) keeps per-frame work off the React tree.
This rework must not regress it:

- The RAF visual clock writes per-frame to atoms with **no React subscribers**.
  The expensive operation is a `FretboardNoteLayer` re-render. Emphasis state
  recomputes **≤2× per step** by design.
- Any new motion must be **CSS/compositor-driven** (`opacity` + `transform`
  only). No per-frame React renders. No animation of the `r` attribute,
  `display`, layout, or SVG filters.
- The note-render cache (`renderedNoteSignature` in `useAnimatedFretboardView.ts`)
  bails re-renders on unchanged notes; new animated state should be
  CSS-attribute-driven rather than new per-note JS fields where possible. Any new
  render-affecting field MUST be added to the signature.

## Decisions (locked)

- **Direction:** Preview the next hand position (Direction B) built on the
  mechanical pop-fixes (Direction A). Reject coexisting full chord layers
  (Direction C) — doubling rendered notes during the transition is the perf risk.
- **Preview scope:** Only what changes. Incoming and departing notes animate;
  held and static notes stay calm.
- **Timing:** Proportional with a readable floor — the lead-in ramps over the
  final portion of each step, clamped to a minimum duration so fast tempi still
  show it.
- **Incoming look:** Hollow ghost ring in its own hue that fills solid as it
  promotes at the boundary.
- **Control:** Always on during playback. No new UI/toggle.

## Design

### 1. The preview is the pop-fix

The pops and the weak hint share a root cause: notes that change between chords
snap via `display:none` and per-role radius/shape jumps. One mechanism fixes
both. A note about to appear is **rendered early as a ghost ring** during the
lead-in, then at the boundary its class flips ghost→solid and a cheap `0.15s`
fill/opacity transition carries it home. Because it is already in the DOM before
the change, there is no `display` snap. The reverse handles departing notes.

Each note gets one **transition role** during the lead-in window:

- **held** — PC in both chords → stays calm (steady, no pulse).
- **incoming** — PC new to the next chord, position in the active region →
  ghost ring (incoming hue) ramps in, promotes to solid at the boundary.
- **departing** — current chord-tone leaving → dims/marks, then settles to
  scale-only or fades out (no `display` snap).
- **static** — other scale notes → unchanged.

"Only what changes" falls out naturally: held and static notes are quiet; only
incoming + departing animate.

### 2. Previewing incoming tension notes (the key trick)

The most useful notes to preview — next-chord tones *outside* the current scale —
are `note-inactive`/`display:none` today, which is why they pop in. They are
already present in the note array (`buildStaticFretboardTopology.ts:307`), just
hidden. During the lead-in we tag in-region positions whose PC is incoming and
override the hidden rule to show them as a ghost ring.

Gating: limited to the active shape/region via the existing `isInActiveShape` /
`isInsideAnyPolygon` fields so the whole fretboard is not ghosted. We reclassify
existing positions by next-chord membership — no need to recompute the next
chord's shape.

### 3. Drive model (perf-safe)

React state stays **coarse: ≤2 changes per step**, exactly like today's
`anticipationActiveAtom`. The continuous ramp is done in **CSS**, not per-frame
React.

New / changed atoms (all change only at step boundary or lead-in start):

- `leadInActiveAtom` — true during the lead-in window (replaces the binary
  last-beat anticipation flip).
- `incomingTonesAtom` — `nextChordTones − currentChordTones` (PC set).
- `departingTonesAtom` — `currentChordTones − nextChordTones` (PC set).
- Held reuses the existing `commonTonesWithNextAtom`.
- `leadInDurationMsAtom` — proportional (≈ last half of the step) clamped to a
  readable floor (≈600ms). Computed once per step from the step deadline +
  tempo, written to a `--lead-in-duration` CSS var (same pattern as the existing
  `--beat-duration`).

Flow:

- **Lead-in start:** one render sets `data-transition-phase` + the role
  classification. CSS animates the ghost ramp over `--lead-in-duration`.
- **Boundary:** one render swaps the chord. Ghosts → solid, departing → settle.
  CSS handles the crossfade.

Only `opacity` and `transform` animate (compositor). The glow/ring underlay
becomes **always-rendered at opacity 0** so it fades instead of mounting/
unmounting. Per-role radius changes move onto the existing `--emph-scale`
transform path so size glides instead of jumping via the `r` attribute.

### 4. Color & visual tokens

Playback palette today: cyan = held/in-scale chord tone, orange = tension/
guide-tone, violet = color tones. The old `--note-glow-anticipation` (`#fb923c`)
collides with that orange, which is why the hint reads as more of the same.

- **New `--note-incoming` hue** — green-teal ("go here next"), deliberately
  clear of cyan-held, orange-tension, and violet. Light + dark variants in
  `semantic.css` / `themes.css`. Exact values tuned against both wood
  backgrounds in review.
- **Incoming ghost ring** — hollow, low-opacity, dashed stroke in
  `--note-incoming` to read as "not yet." Opacity/scale ramp over
  `--lead-in-duration`, then fills solid on promotion.
- **Held** — steady cyan, pulse removed. Calm is the point.
- **Departing** — dim + slight desaturate, no new strong color.
- Retire the `note-anticipation-pulse` infinite-alternate keyframe
  (`module.css:414`); the ramp replaces it.

### 5. Reduced motion & accessibility

- `prefers-reduced-motion`: no ramps/pulses. Incoming still shows as a **static**
  ghost ring (information preserved, motion removed) and promotes instantly at
  the boundary. Extends the existing guard (`module.css:419`).
- Ghost rings are decorative — the note layer is already `aria-hidden`; the real
  a11y/hit-test layer is untouched, so screen-reader and keyboard behavior are
  unchanged.
- Incoming ghosts are non-interactive (`pointer-events: none`) until promoted.

## Scope

**In scope:**

- New transition-role classification + atoms (`leadInActiveAtom`,
  `incomingTonesAtom`, `departingTonesAtom`, `leadInDurationMsAtom`).
- CSS: `--note-incoming` token, ghost-ring ramp, removal of the pulse keyframe,
  `--lead-in-duration` var wiring.
- Mechanical pop-fixes: opacity-not-`display` for transitioning notes,
  transform-not-`r` for radius, always-rendered glow/ring underlay.

**Out of scope:**

- No new UI/toggle (always-on).
- No audio or timing-engine changes.
- No change to scale/shape selection.
- No change to the connector layer beyond what's needed to avoid regressions.

## Testing

**Unit:**

- `incomingTonesAtom` / `departingTonesAtom` set derivation, including
  progression wrap-around (last step → first step).
- `leadInDurationMsAtom` math — proportional, floor clamp, fast + slow tempo.
- Per-position transition-role classification, including in-region gating for
  hidden tension notes.

**Component:**

- During lead-in: in-region incoming positions get the ghost attribute
  (including positions hidden at rest); held stay calm; departing marked.
- At boundary: ghost → solid promotion with no `display` snap; departing settles.
- Reduced-motion path renders static ghosts.

**Performance:**

- Assert **≤2 `FretboardNoteLayer` renders per step** (render-counter in test) —
  proves no per-frame React.
- Confirm only `opacity`/`transform` animate; no new `r`/`display`/filter
  animation.
- DOM-count bound: ghosts only for in-region incoming positions.
- Existing e2e / long-task perf checks stay green.

**Visual regression:**

- New darwin + linux snapshots for two states: mid-lead-in (ghosts visible) and
  post-boundary (promoted), via the existing `fretboard-svg` / `app-overlays`
  suites.

## Key files

- `src/components/FretboardSVG/utils/semantics.ts` — `getEmphasis`,
  transition-role classification.
- `src/components/FretboardSVG/FretboardNote.tsx` — always-rendered underlay,
  ghost ring, data attributes.
- `src/components/FretboardSVG/FretboardSVG.module.css` — tokens, ramp,
  reduced-motion, removal of pulse, `display`→opacity for transitioning notes.
- `src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts` —
  in-region incoming tagging for hidden tension notes.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` —
  `renderedNoteSignature` update for new fields.
- `src/components/FretboardSVG/hooks/useEmphasisContext.ts` — surface new atoms.
- `src/store/practiceLensAtoms.ts` — `leadInActiveAtom`, `incomingTonesAtom`,
  `departingTonesAtom`, `leadInDurationMsAtom`.
- `src/styles/semantic.css`, `src/styles/themes.css` — `--note-incoming` token.
