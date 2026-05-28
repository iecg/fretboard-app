# Chord Transition Sync Design

**Date:** 2026-05-27  
**Topic:** Fretboard chord-tone and connector transition sync  
**Status:** Drafted from code investigation

## Summary

Recent transition work intentionally disables connector and shape group fades whenever playback is active. That change removed the discrete connector transition not only for per-frame playback emphasis updates, but also for chord-step changes that happen while playback is running.

At the same time, note bubbles still update through the cheap CSS path, but that path only transitions opacity. When a chord step changes, note role colors and connector geometry therefore switch on different visual mechanisms: notes snap to their new chord-tone styling, while connectors either fade only when playback is stopped or swap immediately when playback is running.

This design restores smooth step-to-step voicing transitions during playback without reintroducing frame-by-frame animation cost. The key is to scope transition policy to **discrete chord-boundary changes**, not to the coarse `playing` boolean.

## Goals

1. Restore connector transitions for chord-step changes during playback.
2. Keep note and connector updates visually aligned so a new voicing reads as one transition.
3. Preserve the recent performance win that avoided expensive motion on playback frame ticks.
4. Avoid path-morph animation or per-note JS animation on every render.

## Non-goals

1. Reintroducing broad shape/connector remount animation on every playback-driven render.
2. Animating every playback frame of the lead lens.
3. Perfect geometric path morphing between unrelated voicings.

## Root Cause

### 1. Motion policy is gated too broadly

`resolveFretboardMotionPolicy()` now returns `shapeMode: "none"` and `connectorMode: "none"` whenever `playbackActive` is true. In `FretboardSVG.tsx`, `playbackActive` is derived from `!!playbackSnapshot?.playing`, so the policy stays in the no-motion branch for the entire playback session.

That is broader than the actual hot path. Connector groups only remount when the connector `motionKey` changes, and that key is derived from chord identity and voicing geometry, not from per-frame lead-lens emphasis. As a result, the code currently suppresses a cheap step-boundary animation even though steady-state playback frames would not retrigger it.

### 2. Notes and connectors do not share the same transition window

`FretboardNoteLayer` keeps stable per-position keys (`note-${stringIndex}-${fretIndex}`), which is good for performance. But the CSS-mode note layer only transitions `opacity`. Chord-role color, stroke, glow, and dashed-state changes still snap immediately.

`FretboardConnectorLayer`, on the other hand, uses a keyed group fade when `connectorMotionMode === "group"`. That means the note layer and connector layer currently rely on different transition mechanisms, so they fall out of sync on chord changes.

## Approaches

### Option 1 — Re-enable connector group fades during playback step changes only

Keep note rendering as-is and stop disabling connector group fades solely because playback is active.

**Pros**
- Smallest change.
- Likely restores the missing playback transition immediately.
- Keeps the recent playback isolation work intact.

**Cons**
- Connectors would fade, but note color-role changes would still snap.
- Fixes the regression, but not the visual mismatch the user called out.

### Option 2 — Recommended: split frame motion from step-change motion

Introduce a motion-policy input that reflects **transition cause**, not just `playing`.

Use three states:
- reduced motion
- steady playback frame update
- discrete chord-step change

Keep connector fades enabled for discrete chord-step changes, even while playback is running. Keep them disabled for steady playback-frame updates. Add cheap CSS transitions for note visual properties so note bubbles and connector overlays change within the same short window.

**Pros**
- Fixes the regression and the sync problem together.
- Preserves the performance intent of the recent refactor.
- Avoids expensive path morphing or JS-driven animation loops.

**Cons**
- Requires a small amount of new transition-state plumbing.
- Needs tests that distinguish playback frames from chord-step changes.

### Option 3 — Double-buffer previous and next connector layers

Track the previous connector set and crossfade previous/next layers for every chord change, independent of motion policy.

**Pros**
- Most explicit visual control.
- Can support polished overlap timing.

**Cons**
- More state, more render branches, and more retained SVG content.
- Harder to justify unless Option 2 still looks rough.

## Recommended Design

### Architecture

Add a lightweight, discrete transition signal for chord-boundary changes. The fretboard already distinguishes steady playback frames from chord identity changes in practice: playback emphasis depends on `progressionVisualFrameAtom`, while connector geometry depends on chord-tone topology. The missing piece is a small bridge that tells the motion policy when chord identity changed.

Use that signal to narrow motion policy:

- **Reduced motion:** notes/connectors/shapes all static.
- **Playback frame update only:** note CSS allowed, connector/shape group fades disabled.
- **Chord-step change:** connector group fades allowed, regardless of whether playback is running.

Shape polygons can remain static unless a real shape-selection change occurs. They are not the primary regression and do not need to animate on every chord step.

### Data flow

1. Derive a stable `transitionKey` in `FretboardSVG.tsx` from the discrete chord state that actually changes voicings, such as chord root, visible chord tones, and connector voicing keys.
2. Compare the current key to the previous key and mark a short-lived `stepTransitionActive` flag only when the key changes.
3. Feed motion policy with something like:
   - `prefersReducedMotion`
   - `playbackActive`
   - `stepTransitionActive`
4. Resolve policy so `connectorMode` returns `"group"` for `stepTransitionActive`, even when `playbackActive` is true.
5. Expand the note-layer CSS transition set from opacity-only to a tightly bounded set:
   - `opacity`
   - `fill`
   - `stroke`
   - `stroke-width`
   - `filter` only if profiling shows it remains cheap enough; otherwise leave glow snapping

### Visual timing

Use one short duration for both note and connector step changes, in the same range as the existing fast motion token. The transition should read as a handoff, not a flourish.

The connector group fade remains the only structural animation. Notes stay on the CSS path with stable element identity, so the change is still cheap and compositor-friendly.

### Error handling and safety

If the derived transition key is incomplete or unchanged, the system falls back to the static/no-remount path. This should fail safe by skipping animation rather than producing stale visuals.

Reduced-motion behavior remains authoritative and must bypass the new step-transition path entirely.

## Testing

Add coverage for:

1. **Motion policy**
   - playback active + no step transition => connectors static
   - playback active + step transition => connectors group-fade
2. **FretboardSVG wiring**
   - per-frame playback snapshot updates do not enable connector fades
   - displayed progression step changes during playback do enable them
3. **Note-layer styling**
   - CSS transition contract includes the chosen visual properties
4. **Performance contract**
   - playback-frame-only updates do not remount connector groups

## Implementation Notes

Start with Option 2 but stage it in two slices:

1. restore connector transitions only for discrete chord-step changes during playback
2. align note CSS transitions to the same visual window

This keeps the fix easy to validate and makes it obvious whether any remaining roughness comes from the connector timing or from note-style snapping.

---

## Addendum 2026-05-27 — Lens-emphasis transitions (folded in from item 6 follow-up)

### What changed since this spec was first drafted

The lens system was consolidated from a two-lens picker (Tones, Lead) into a single always-on emphasis model. Implementation landed in `e5d2f2ea`:

- `getLensEmphasis` → `getEmphasis` (single function, no lens parameter).
- Lead-branch logic is now the default: anticipation (next chord's guide tones, last beat) → hold (current chord tones that carry into next) → departing (current chord tones not in next) → tones-base fallback.
- The two-lens picker UI is gone from `ChordOverlayControls` and `StatusBar`.

A follow-up tweak landed in `6b822e7a`:

- Departing-tone dim softened from `radiusBoost: 0.85, opacityBoost: 0.6` → `0.95, 0.85`. The original values made the active chord nearly invisible during its own step for cadences with no common tones (e.g. F→G in I-vi-IV-V), which the user reported as a perceived bug.

### What's still wrong (carry-over from item 6 brainstorm)

User feedback during smoke-testing the consolidated lens highlighted two qualitative issues that the existing connector/note sync work doesn't address:

1. **Anticipation and chord-tone-ring both use orange.** The anticipation glow (next-chord guide tones in the last beat) is hard to distinguish from the chord-tone ring, which also uses orange. The Theming spec (`docs/superpowers/specs/2026-05-27-theming-design.md`) addresses this by introducing `--note-glow-anticipation` and `--note-glow-hold` tokens and rebinding them to the reference palette (ORANGE rust and CYAN teal). When Theming ships, this concern resolves.

2. **The chord-to-chord change feels abrupt.** Even with note/connector group fades restored (per Option 2 above), the lens-emphasis values switch discretely at the step boundary:
   - At beat N (last beat of step), anticipation fires (orange glow on the *next* chord's guide tones).
   - At beat 0 of the next step, hold/departing flip — common tones go from anticipation-orange to hold-cyan; non-common notes go from anticipation-orange or base to departing-dim.

   This produces a hard color/size switch right at the bar line. The user's stated ideal: the transition should be *smooth* — the user should *see* which chord is coming and feel the handoff, not get a sudden color flip.

### Ideal behavior

For each note that changes role across a chord boundary, the emphasis should interpolate (or cross-fade) between the outgoing and incoming role over a short window (~half a beat, configurable). Specifically:

- A note transitioning from "current chord tone" → "next chord tone (hold)" should smoothly morph cyan ↔ neutral, not flip at the bar line.
- A note transitioning from "anticipation" (last beat) → "hold" (first beat of next step) should slide its glow color from anticipation-orange to hold-cyan during the boundary, not snap.
- A note transitioning from "current chord tone (active)" → "no longer a chord tone" (departing-dim → base) should ease the opacity and radius back to neutral, not snap.

This requires extending the existing motion policy to include lens-emphasis values, not just connector/note structure. The `stepTransitionActive` flag proposed earlier becomes a "smooth-handoff window" the emphasis function can respect.

### Scope expansion for this spec

This spec was originally about connector + note styling sync at chord boundaries. The lens-emphasis transitions extend the same problem to a third visual layer (glow color + radius/opacity boosts). All three should land in the same transition window so the user perceives one smooth step change, not three independent switches at slightly different times.

Add to the **Approaches** section as a new option:

**Option 4 — Extend `stepTransitionActive` window to lens-emphasis interpolation**

- During the `stepTransitionActive` window, `getEmphasis` returns interpolated `radiusBoost`, `opacityBoost`, and a mixed `glowColor` (CSS `color-mix()` between outgoing and incoming roles).
- Outside the window, `getEmphasis` snaps to the discrete role as today.
- Cost: a per-note recompute per frame during the transition window (~150-300 ms). Bounded; not per-frame for the whole playback session.

**Pros**
- Eliminates the perceived abrupt color flip.
- User actually sees the upcoming chord forming before it arrives.
- Composes naturally with Option 2's connector/note CSS transition window.

**Cons**
- More compute during the transition window — needs profiling against the React Compiler's auto-memo guarantees.
- `color-mix()` browser support is modern but worth confirming target compatibility.
- Increases the surface for visual regression snapshot churn.

### Implementation notes (Option 4 specifics)

The interpolation function takes:
- `t`: 0 → 1 progress through the transition window.
- `from`: the `LensEmphasis` for the prior chord (computed with the prior `leadContext`).
- `to`: the `LensEmphasis` for the new chord (computed with the new `leadContext`).

Returns a `LensEmphasis` with each numeric value linearly interpolated and `glowColor` interpolated via `color-mix(in srgb, from-color t%, to-color (1-t)%)`.

The transition window is driven by the same `stepTransitionActive` signal as connector group fades, so all three layers (connectors, note CSS, lens-emphasis) animate over the same time slice.

### What this spec does NOT change

- The always-Lead consolidation stays. The user agreed to it during the brainstorm; the smoothness fix doesn't require a per-progression opt-out.
- The departing-dim baseline values stay at `0.95, 0.85` per `6b822e7a`. Option 4 interpolates from these, not from the original aggressive `0.85, 0.6`.
- The `--note-glow-anticipation` and `--note-glow-hold` tokens introduced by the Theming spec are still the right structural fix for the orange-on-orange collision. Option 4 layers smoothness on top of that fix.

### Sequencing relative to other in-flight specs

- **Theming spec** lands first (provides the differentiated glow colors anticipation/hold needs).
- **This spec (Option 4 extension)** lands after Theming so the interpolated colors are the right values.
- **Chord Voicings Card UX spec** is independent — no dependency.
- **Onboarding tutorial** lands last so transition illustrations are final.

### Carry-over to plan-writing

The existing plan files don't yet include Option 4 as a task. When this spec's plan is written or extended, add tasks for:

1. Capture `from` and `to` `LensEmphasis` values when `stepTransitionActive` flips on.
2. Interpolate during the window using `requestAnimationFrame` or the same motion driver Option 2 uses.
3. Snap to `to` when the window expires.
4. Update unit tests for `getEmphasis` to cover the interpolated path (a 5th branch in the priority order).
5. Visual regression refresh.
