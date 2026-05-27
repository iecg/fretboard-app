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
