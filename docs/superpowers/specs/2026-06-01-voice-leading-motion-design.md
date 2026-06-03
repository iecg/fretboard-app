# Voice-Leading Motion for Chord Transitions — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)
**Builds on:** `2026-06-01-chord-transition-rework-design.md` (lead-in ghost-ring preview, transition-role emphasis, two-clock playback sync). Implementation lands **after PR #511 merges**, on updated `main`.

## Problem

The chord-transition rework added a static next-chord preview: incoming tones fade in as a hollow green ghost ring, departing tones cross-dissolve out, common tones hold with a cyan glow. It conveys *what* the next chord is, but not *how the hand gets there*. The recurring user feedback is that the hint "doesn't work well" and there's "a lot going on but still not good enough" — the preview reads as several simultaneous static effects rather than a legible movement.

## Goal

Make a chord transition read as **voice movement**: visualize each *moving* voice traveling from its current fret to the nearest tone of the next chord, so the eye tracks the motion of the hand. Do this **without** introducing performance regressions and **without** adding visual clutter.

### Non-negotiable constraint: no performance regressions

- **≤ 2 React re-renders per step** (the existing budget).
- **No per-frame React work** — nothing new may subscribe to `progressionVisualFrameAtom`.
- **Continuous motion is CSS/compositor-driven only** — `transform` and `opacity`, never animated SVG `d`/path morphing, never per-frame layout or paint.

## Chosen direction

**Voice-leading motion for the moving voices only, expressed as the existing incoming ghost ring sliding into place** — orchestrated as a hand-off over the lead-in window.

### Alternatives considered and rejected

- **Connector vertex/path morphing** — rejected on the performance constraint. Animating the SVG `d` attribute is main-thread paint every frame, exactly the cost the two-clock architecture exists to avoid.
- **Traveling dot/comet** (separate moving element per voice) — legible but adds a new element type and more on-screen motion; rejected for clutter.
- **Fading directional trail/streak** — risks reading like the existing chord-connector polylines; rejected for confusion.
- **Subtler "directional pull"** (short nudge instead of full path) and **timing/easing-only cohesion pass** — folded in as polish (easing + hand-off sequencing) rather than chosen as the whole feature.

The chosen treatment adds **zero new visual vocabulary**: it makes the ghost already on screen meaningful by giving it an origin and a direction. It is also the lightest option (no new SVG nodes — one extra `translate` term on the ghost's existing keyframe).

## Architecture

The motion rides on the existing incoming ghost (which lives in `FretboardNote`), so **no new overlay layer/component is needed**. Three small units:

1. **`computeVoiceLeadingMoves(renderedNotes)`** — a pure, testable helper (new file, e.g. `src/components/FretboardSVG/utils/voiceLeading.ts`). Returns the capped, region-gated source→target pairings.
2. **Annotation pass** — inside `useAnimatedFretboardView`'s existing memoized build: after `renderedNotes` are built (roles + `cx`/`cy` available), compute the moves and stamp each paired target note with `voiceLeadOffset: { dx, dy }` (= source − target).
3. **`FretboardNote` render** — writes the offset as inline CSS custom properties `--vl-dx` / `--vl-dy`; the existing `note-incoming-ramp` keyframe gains a `translate(var(--vl-dx,0), var(--vl-dy,0)) → translate(0,0)` term that eases out into place.

### Why the render layer, not an atom

Pixel geometry (`cx`/`cy`) exists only in the render layer (`useAnimatedFretboardView` via `fretCenterX`/`stringYAt`). The lead-lens atoms (`incomingTonesAtom`, `departingTonesAtom`, `commonTonesWithNextAtom`) are pitch-class sets with no positions. Position resolution must therefore happen where `renderedNotes` lives.

### The pairing (once per step, memoized)

1. **Targets** = in-region notes whose transition role is `incoming` (arriving positions).
2. **Sources** = in-region notes whose role is `departing` or `held` (where a finger currently is). Held notes are allowed as sources so a new voice can read as "arriving from near a sustained note" — the goal is directional origin, not strict voice accounting.
3. **Greedy nearest-distance assignment** — each target claims its closest unused source (one source per target). Output `{ id, fromX, fromY, toX, toY }` per move; `voiceLeadOffset` for the target = `(fromX − toX, fromY − toY)`.

### Restraint rules (what keeps it from being "a lot going on")

- Only *moving* voices get a cue — held/common tones that stay put produce no offset (fade in place as today).
- Drop pairings whose travel distance is below a small threshold (no near-zero jitter).
- Cap at a small **K ≈ 4** clearest moves; if a transition has more candidates, keep the longest-travel ones and **`log()`/console the drop — no silent truncation**.
- Strictly **region-gated** — the same gate the incoming ghost already uses, so we never cue across the whole neck for 7-note scales.

Unpaired incoming ghosts (beyond the cap, sub-threshold, or with no distinct source) keep today's fade-in-place behavior, so the feature degrades gracefully.

### Coupling decision

Source positions come from `renderedNotes` (region-filtered by transition role), **not** from computing a second full connector voicing for the next chord. This reuses existing data, works whether or not chord connectors are toggled on, and avoids coupling to the connector feature. Pairing against the actual next *voicing* shape is noted as a possible later refinement, out of scope here.

## Data flow

Each step, the inputs change exactly once, at the boundary:

1. `visualClock` advances the step-index atoms at the boundary (unchanged).
2. `incoming/departing/commonTones` atoms recompute (pitch-class sets).
3. `useAnimatedFretboardView` builds `renderedNotes` with roles + `cx`/`cy` (unchanged), then runs `computeVoiceLeadingMoves` and stamps `voiceLeadOffset` on paired targets — inside the existing `useMemo`, so it recomputes only when notes change (step boundary / resize), **never per frame**.
4. `FretboardNote` writes `--vl-dx` / `--vl-dy`. When `leadInActive` flips true at the threshold, the incoming ghost's keyframe plays once over `--lead-in-duration`.

## Sequencing (one lead-in window)

- **t = 0 (lead-in onset):** departing notes begin their fade/desaturate (existing); each paired incoming ghost appears at its *source* position — `opacity 0`, `scale 0.8`, `translate(dx, dy)`.
- **t = 0 → 1:** departing fades out; ghost slides **ease-out** toward target, opacity 0 → 0.7, scale 0.8 → 1.
- **t = 1 (chord change):** ghost has arrived exactly where the real note materializes; the role clears and the note renders normally.

This overlap — dimming source, settling destination, same `--lead-in-duration` clock — is the hand-off. It reuses the highlight-gap-hold from the prior rework, so there is no dead gap before the swap. Arrival-at-boundary vs. settling slightly early is a single tunable; default to arrival-at-boundary unless it reads rushed.

### Reduced motion

`prefers-reduced-motion` falls back to fade-in-place via the existing `[data-motion="css"]` gate and reduced-motion rules — no translate.

## Performance budget

- **≤ 2 React re-renders / step** — unchanged. The only added React work is the pairing pass inside an already-memoized build; it adds **no new subscriptions**.
- **No per-frame React** — nothing in this feature subscribes to `progressionVisualFrameAtom`.
- **Compositor-only motion** — `transform`/`opacity` on the existing ghost underlay; no `d`/layout/paint per frame; **no new SVG nodes**.
- **Pairing cost** — O(targets × sources) ≤ ~36 comparisons, once per step, over data already in memory.

## Testing

- **Unit (pure)** — `computeVoiceLeadingMoves`: nearest assignment; one-source-per-target; sub-threshold drop; cap-at-K keeping longest travel + logged drop; region gating; empty/edge cases (no incoming, no sources, coincident positions).
- **Component** — `FretboardNote` emits `--vl-dx` / `--vl-dy` only when an offset is present, omits them otherwise; reduced-motion path produces no translate.
- **Integration** — `useAnimatedFretboardView` stamps the correct target notes for a seeded I→V lead-in frame (mirrors the existing incoming-emphasis test in `FretboardSVG.test.tsx`).
- **Perf guard** — extend the existing ≤ 2-renders/step budget test to cover the annotation path.
- **Visual regression** — new darwin + linux snapshot at a lead-in frame showing slid ghosts; refresh affected snapshots.

## Out of scope

- Pairing against the actual next connector voicing shape (possible later refinement).
- Any change to the per-frame visual clock, the connector morphing approach, or the scale/chord domain separation.
- New colors or hues (the cue reuses `--note-incoming`).
