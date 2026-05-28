# Transition & Highlight Redesign — Design

**Date:** 2026-05-28
**Status:** Approved (Approach A — channel separation + CSS-driven transitions).

## Summary

Two related problems during progression playback:

1. **Abrupt chord transitions.** Connector polylines snap at chord boundaries during playback, while notes fade on a different (opacity-only) mechanism, so a chord change reads as several mismatched switches instead of one handoff. Root cause: `motionPolicy` is gated on the coarse `playbackActive` boolean and returns `connectorMode: "none"` for the entire session ([motionPolicy.ts:28](../../../src/components/FretboardSVG/motionPolicy.ts)).
2. **Illegible highlights.** Two accent hues (teal + rust) encode ~5 semantic roles across two channels (ring + glow) that bloom alike. Orange means both "root" and "next chord coming"; teal means "chord tone", "holds over", and "guide tone". The user cannot tell guide tones from lead/anticipation tones, and the root glow collides with the chord-tone ring.

This redesign separates the visual channels by meaning, restores smooth boundary transitions, makes the next chord visible before it arrives, and does so **perf-positively** — by replacing the existing per-frame emphasis recompute with discrete-phase-driven CSS animation.

## Goals

1. Smooth, synchronized chord transitions during playback (connectors + notes + glow animate as one handoff).
2. Make the next chord visible before it arrives.
3. Make every highlight role unambiguous.
4. No performance regression — ideally a net win on the playback hot path.

## Non-goals

1. Per-frame JS animation of any visual property.
2. Geometric path-morphing between unrelated voicings.
3. Restructuring the music-theory / classification logic (`classifyNoteFromSemantics` stays as-is).
4. Dark-mode token re-tune beyond what channel separation requires.

## Current-state facts (verified in code)

- `resolveFretboardMotionPolicy` input is `{ prefersReducedMotion, playbackActive? }`; during playback it returns `connectorMode: "none"`, `shapeMode: "none"`, `noteMode: "css"` ([motionPolicy.ts:22-32](../../../src/components/FretboardSVG/motionPolicy.ts)).
- Connector group fade uses `<motion.g>` + `AnimatePresence`, keyed by `motionKey` (chord identity + voicing keys) ([FretboardConnectorLayer.tsx:40-63,110-124](../../../src/components/FretboardSVG/FretboardConnectorLayer.tsx)). When `connectorMode === "none"` it renders a plain static `<g>` → instant swap.
- Note CSS transition is **opacity-only** (`transition: opacity 0.15s ease`) under `[data-motion="css"]` ([FretboardSVG.module.css:38-41](../../../src/components/FretboardSVG/FretboardSVG.module.css)).
- Notes render in **two** `FretboardNoteLayer` instances split by `CHORD_NOTE_CLASSES` for **z-order**: non-chord notes paint before connectors, chord notes after ([FretboardSVG.tsx:665-719](../../../src/components/FretboardSVG/FretboardSVG.tsx)). A note that changes chord-membership unmounts from one layer and mounts in the other → CSS transitions cannot fire across remount ("layer-split pop").
- `getEmphasis` returns discrete roles: anticipation `{glow: var(--note-glow-anticipation), r:1.15}`, hold `{glow: var(--note-glow-hold), r:1.2}`, departing `{r:0.95, op:0.85}`, base ([semantics.ts:67-121](../../../src/components/FretboardSVG/utils/semantics.ts)). Glow already uses tokens (light-mode polish round 2 landed).
- `radiusBoost` is baked into the rendered geometry (`r = base * scale * radiusBoost`), and `opacityBoost` into an inline `opacity` — neither is CSS-transitionable today ([FretboardNoteLayer.tsx:102,157-158,198-199](../../../src/components/FretboardSVG/FretboardNoteLayer.tsx)).
- Glow is an SVG filter URL (`filter: var(--fretboard-svg-glow-cyan-url)`), which does not interpolate or fade ([FretboardSVG.module.css:389-396](../../../src/components/FretboardSVG/FretboardSVG.module.css)).
- **`beatPosition` is derived per RAF frame** from `localFraction` ([useFretboardPlaybackSnapshot.ts:39](../../../src/components/FretboardSVG/hooks/useFretboardPlaybackSnapshot.ts)). `playbackSnapshot` changes every frame → `buildAnimatedFretboardNotes` recomputes `getEmphasis` for **every note every frame** during playback ([useAnimatedFretboardView.ts:120-129](../../../src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts)). This is the existing hot path.
- Tokens exist in both modes: `--note-glow-anticipation`, `--note-glow-hold`, `--note-glow`, `--note-glow-tonic`, `--note-ring`, `--note-ring-tonic` ([semantic.css:132-146](../../../src/styles/semantic.css), `themes.css` light overrides).

## Design

### §1 — Channel separation (legibility)

Make two **orthogonal** visual channels, each owning one kind of meaning:

**Identity channel — static, structural (fill + ring):**
- **Root/tonic** gets a structural marker — a **double ring** (the existing chord-root halo path is extended into a consistent second ring) — and **loses its static glow**. Removing the static root glow is what eliminates the "root glow == chord-tone color" collision the user named.
- **Chord tone** = single colored ring (teal). **Scale-only** = dim, no ring.
- Identity never animates except via the shared boundary transition (§3).

**Voice-leading channel — temporal, playback-only (glow + motion):**
- Glow is now used **exclusively** for voice-leading. A glowing note always means "watch this for the transition," never "this is the root."
- **Anticipation** (next chord's guide tones, last beat) = rust glow (`--note-glow-anticipation`) that **pulses** over the beat.
- **Hold** (carries into next chord) = steady teal glow (`--note-glow-hold`).
- **Departing** (leaving the chord) = glow absent, soft opacity/scale ease-down (unchanged role values).
- **Guide-tone fallback** (no progression active) keeps a steady teal glow and is the *only* glow present when idle, so no collision.

Net: a glowing note = voice-leading; a ringed/double-ringed note = identity. No hue does double duty.

### §2 — Discrete emphasis phase (perf-positive)

Today `getEmphasis` recomputes per frame because `beatPosition` is continuous. But its **output only changes at two discrete moments per step**: step entry, and entry into the last-beat (anticipation) window. Replace the continuous dependency with a discrete phase:

- Add a derived boolean: **`anticipationActiveAtom`** = `playing && localFraction >= (stepDurationBeats - 1) / stepDurationBeats` (i.e. inside the last beat). It reads the per-frame frame atom but only **changes value** at the threshold crossing.
- `getEmphasis` keys its anticipation branch on this boolean phase, not on raw `beatPosition`/`stepDurationBeats`.
- `useAnimatedFretboardView` depends on `{ stepIndex, anticipationActive, commonWithNext, nextGuideTones }` — all discrete — instead of the per-frame `playbackSnapshot`. Emphasis recomputes **~twice per step**, not 60×/sec.

This removes the existing per-frame note recompute (a measurable win) and is what makes CSS-driven animation viable: discrete class/attribute changes trigger CSS transitions; the compositor does the rest.

`beatPosition`/`stepDurationBeats` stay in the snapshot for any other consumer but are no longer inputs to emphasis.

### §3 — Step-boundary signal + transition mechanics

**Boundary signal.** Extend motion-policy input to `{ prefersReducedMotion, playbackActive, transitionKey }`:
- Derive `transitionKey` in `FretboardSVG` from chord identity (chord root + chord tones + voicing keys) — it changes only at boundaries, never on frame ticks.
- Policy returns `connectorMode: "group"` when the key changes (a short-lived active window) **even during playback**; reduced-motion still forces all `"none"`; steady frames keep connectors static.

**Connector fade via CSS, not Motion.** Replace `<motion.g>` with a **keyed plain `<g>` whose opacity transitions in CSS** (`AnimatePresence` retained only for mount/unmount timing of the crossfade). The key changes only at boundaries, so there is zero per-frame Motion work — this restores the fade `b1abff24` removed without reintroducing its cost.

**Single note layer (removes layer-split pop, perf win).** Replace the two membership-split `FretboardNoteLayer` instances with **one** layer of stable-keyed notes (`note-${string}-${fret}`), so no note ever remounts on a role change and CSS transitions always fire. Preserve z-order by splitting the **connector** render instead: halo + fill paint **below** the single note layer, outline paints **above** it. (Minor, acceptable visual change: the thin outline now traces over chord notes too.) This also halves the per-render note mapping (was mapped twice, once per layer).

**Transitionable emphasis properties.** So CSS can animate them:
- `radiusBoost` → applied as `transform: scale(var(--emph-scale))` on the note `<g>` (compositor-cheap), not baked into geometry.
- `opacityBoost` → already inline opacity; keep, now transitioned.
- Glow → moved off the SVG `filter` onto a **dedicated glow underlay element** (a circle/squircle behind the note) whose `opacity` and `fill` transition cheaply. Avoids animating SVG filters.
- Extend the note CSS transition from opacity-only to: `opacity, transform, fill, stroke, stroke-width` over one shared duration (`ANIMATION_DURATION_FAST`), so notes, glow underlay, and the connector crossfade land in the same window.

**Tempo-matched anticipation pulse.** The pulse is a CSS `@keyframes` on the glow underlay (opacity/scale) whose `animation-duration` is read from a single `--beat-duration` CSS variable, written **once** when entering the anticipation window (from `60 / bpm`). Matches any tempo with no per-frame JS.

### §4 — Stronger next-chord preview

- During the anticipation window, render the **incoming voicing's connector polyline as a ghost** — low opacity, dashed — alongside the current connector, so the next shape is visibly forming. The incoming voicing geometry is already computed by the connector engine for the next step's chord; the preview reuses it.
- At the boundary, the ghost resolves to full via the §3 connector crossfade; the outgoing connector fades.
- Paired with the §3 anticipation pulse on the next chord's guide tones, the user both sees and feels what's coming.
- Preview is suppressed under reduced-motion and when not playing.

### §5 — Tokens

- **Remove the static root glow** binding (root no longer carries `--note-glow-tonic` as an always-on glow; the token may remain for other uses but is no longer applied to the root note as a resting glow).
- Glow underlay reads `--note-glow-anticipation` / `--note-glow-hold` (existing). Add `--note-glow-departing` only if departing needs a distinct treatment (default: no glow, opacity/scale only — likely no new token).
- No change to identity ring tokens (`--note-ring`, `--note-ring-tonic`).

## Files to touch

- `src/components/FretboardSVG/motionPolicy.ts` — add `transitionKey` to input; return `connectorMode: "group"` on key change during playback. (+test)
- `src/store/practiceLensAtoms.ts` (or nearest fitting store module) — add `anticipationActiveAtom`. (+test)
- `src/components/FretboardSVG/utils/semantics.ts` — `getEmphasis` keys anticipation on a discrete `anticipationActive` boolean instead of `beatPosition`/`stepDurationBeats`; remove root static-glow assumption. (+test)
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` + `useFretboardPlaybackSnapshot.ts` — feed discrete phase into emphasis; drop per-frame `beatPosition` dependency for emphasis.
- `src/components/FretboardSVG/FretboardNoteLayer.tsx` — single-layer render, stable keys, glow underlay element, `transform: scale` for radius emphasis, double-ring root marker.
- `src/components/FretboardSVG/FretboardConnectorLayer.tsx` — CSS-opacity group fade (drop `motion.g` value animation); halo+fill below / outline above split; ghost incoming-voicing preview.
- `src/components/FretboardSVG/FretboardSVG.tsx` — derive `transitionKey`; collapse two note layers into one positioned between the connector halo/fill and outline groups; pass next-voicing geometry for the ghost.
- `src/components/FretboardSVG/FretboardSVG.module.css` — extend note transition set; glow-underlay rules + pulse `@keyframes` driven by `--beat-duration`; connector group CSS opacity transition; double-ring root rule; remove root static-glow filter.
- `src/styles/semantic.css` / `src/styles/themes.css` — remove root resting-glow application; add `--note-glow-departing` only if needed.
- Visual baselines under `e2e/` — refresh after the above land.

**No new files expected** beyond a possible small store atom. No deletions of public APIs.

## Performance safeguards

- **No per-frame JS for visuals.** All boundary animation is CSS triggered by discrete key/class/attribute changes (`transitionKey`, `anticipationActive`, single `--beat-duration` write).
- **Net reduction** of the existing hot path: emphasis recomputes ~twice per step (was 60×/sec); single note layer halves per-render note mapping; connector fade leaves the JS thread (CSS opacity vs `motion.g`).
- **Reduced-motion authoritative.** `prefersReducedMotion` forces all modes static and suppresses ghost preview + pulse.
- Verify against the live dev server (preview tools) at 60 bpm and 240 bpm — connectors, notes, and glow must transition together (fixes the documented 240bpm desync).

## Testing

- **motionPolicy:** reduced-motion → all `none`; playback + unchanged `transitionKey` → connectors static; playback + changed `transitionKey` → `connectorMode: "group"`.
- **anticipationActiveAtom:** false outside last beat; true inside last beat; false when not playing.
- **getEmphasis:** existing discrete-role assertions stay green; anticipation branch now driven by the boolean (update inputs); departing/base unchanged; root no longer emits a resting glow.
- **Perf contract:** a frame-tick update (same `transitionKey`, same `anticipationActive`) does not change the emphasis output object identity for a note / does not retrigger the connector fade.
- **Visual regression:** refresh darwin baselines; expect diffs in fretboard-svg, chord-overlay, and playback-frame snapshots (both modes).
- **Manual/preview smoke:** both modes; root reads as double-ring (no glow); guide vs anticipation vs hold are distinguishable; ghost preview shows the next voicing in the last beat; transition is smooth at 60 and 240 bpm; reduced-motion is fully static.

## Sequencing

Single coherent subsystem (fretboard transition + highlight rendering), one plan. Suggested commit slices:
1. `perf(fretboard): drive emphasis from discrete phase, not per-frame beat` (§2 + atom).
2. `feat(fretboard): single note layer + transitionable emphasis props` (§3 note side).
3. `fix(transitions): restore connector fade at playback boundaries via CSS` (§3 connector side + motionPolicy).
4. `feat(fretboard): separate identity vs voice-leading channels` (§1 + tokens §5).
5. `feat(transitions): ghost incoming-voicing preview in anticipation window` (§4).
6. `test(visual): refresh baselines for transition + highlight redesign`.

All `feat`/`fix`/`perf` → patch/minor bumps; no `BREAKING CHANGE` footer needed.
