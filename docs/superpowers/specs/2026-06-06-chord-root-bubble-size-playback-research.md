# Chord-root Bubble Size During Playback — Research

Date: 2026-06-06
Status: Research (unresolved, deferred)
Scope: Investigation only — no implementation decisions made.

## Purpose

Investigate why the chord root note bubble appears larger than other chord tone bubbles during progression playback, and document the rendering chain so a fix can be designed later.

## Finding: Root and non-root chord tones share the same `radiusScale`

In `src/components/FretboardSVG/utils/semantics.ts:180-207`, `getNoteVisuals()` maps all chord-tone note classes to the same `RADIUS_CHORD = 0.95`:

| noteClass | radiusScale | Source |
|---|---|---|
| `chord-root` | 0.95 | semantics.ts:185 |
| `chord-tone-in-scale` | 0.95 | semantics.ts:186 |
| `note-diatonic-chord` | 0.95 | semantics.ts:186 |

The static base size is identical. The visual size difference during playback must come from another layer.

## Root Cause: Common-tone `radiusBoost` in the emphasis layer

The emphasis system (`getEmphasis()`, semantics.ts:73-115) adds a per-note `radiusBoost` multiplier during progression playback:

```ts
const resting: LensEmphasis =
  CHORD_TONE_CLASSES.has(noteClass) && commonWithNext.has(notePc)
    ? { radiusBoost: 1.15, opacityBoost: 1 }
    : applyTonesBase(noteClass);
```

- Notes that are **chord tones AND common tones** (shared with the next chord) get `radiusBoost: 1.15`
- Other chord tones get `radiusBoost: 1`
- Scale-only / color-tone notes get `radiusBoost: 0.85`

Chord roots are often common tones across chord changes, so they disproportionately receive the 1.15× boost.

### How `radiusBoost` reaches the DOM

In `src/components/FretboardSVG/FretboardNote.tsx:146-159`:

```tsx
style={{
  "--emph-scale": applyLensEmphasis.radiusBoost,
  transformOrigin: `${cx}px ${cy}px`,
  transform: "scale(var(--emph-scale, 1))",
} as React.CSSProperties}
```

The `radiusBoost` is applied as a CSS `transform: scale(N)` on the `<g>` element wrapping each note. This scales the entire note bubble (circle, text, ring) about its center. A `1.15` boost makes the bubble 15% larger in both dimensions.

### The `baseRadius` → `r` path (unaffected by emphasis)

The SVG `r` attribute is computed geometrically (no CSS scale involved):

```
baseRadius = noteBubblePx / 2               // FretboardNote.tsx:78
radiusScale = getNoteVisuals(noteClass)      // semantics.ts:180
taperScale = taperAwareRadiusScale(...)      // noteSizing.ts:51
rawRadius = baseRadius * radiusScale * taperScale
r = reduceCircleRadius(rawRadius)            // r - 2px stroke compensation
```

The CSS `scale()` transform is applied *on top* of this geometry. The emphasis system does not modify the base `r` value — it's purely a visual post-transform.

## Rendering Chain Summary

```
constants.ts
  NOTE_BUBBLE_RATIO = 0.8                  // bubble diameter = 0.8 × string row height

FretboardSVG.tsx:348
  noteBubblePx = stringRowPx * NOTE_BUBBLE_RATIO

FretboardNote.tsx:78
  baseRadius = noteBubblePx / 2

semantics.ts:180
  radiusScale = getNoteVisuals(noteClass)  // 0.95 for all chord tones

noteSizing.ts:51
  taperScale = taperAwareRadiusScale(...)  // 0.72–1.0 near nut

FretboardNote.tsx:87-88
  rawRadius = baseRadius × radiusScale × taperScale
  r = reduceCircleRadius(rawRadius)        // subtracts 2px

semantics.ts:92                            // ← only during playback
  radiusBoost = commonTone ? 1.15 : 1

FretboardNote.tsx:158
  transform: scale(var(--emph-scale, 1))   // CSS post-transform
```

## Additional Size Cues

The root note also gets a thicker stroke (`2.4px` vs `2.2px` for other chord tones in `FretboardSVG.module.css:76-97`), which may contribute to the perceived size difference during static viewing. During playback, the CSS scale dominates.

## File Inventory

| File | Lines | Role |
|---|---|---|
| `packages/core/src/constants.ts` | 14 | `NOTE_BUBBLE_RATIO = 0.8` |
| `src/components/FretboardSVG/FretboardSVG.tsx` | 348 | `noteBubblePx` computation |
| `src/components/FretboardSVG/FretboardNote.tsx` | 78-88, 146-159 | Radius computation + emphasis CSS transform |
| `src/components/FretboardSVG/utils/semantics.ts` | 73-115, 180-207 | `getEmphasis()` radius boost + `getNoteVisuals()` radius scale |
| `src/components/FretboardSVG/utils/noteSizing.ts` | 16, 51-79 | `reduceCircleRadius` + `taperAwareRadiusScale` |
| `src/components/FretboardSVG/FretboardSVG.module.css` | 76-97 | Stroke widths per note class |

## Approaches (not yet evaluated)

Recorded here for when work resumes:

- **A:** Remove common-tone radius boost — set `radiusBoost: 1` for all common tones. Losses the size-as-connection signal entirely.
- **B:** Uniform chord-tone boost — give all chord tones the `1.15` boost during playback, not just common tones.
- **C:** Repurpose the held-note cue to color/stroke instead of size — keep common-tone identity without size asymmetry.
- **D:** Selective root exclusion — exclude `chord-root` from the boost, allowing other common tones to keep it.

No recommendation was reached before the task was deferred.

## Next Steps

1. Choose an approach.
2. Update `getEmphasis()` in `semantics.ts`.
3. Update tests in `semantics.test.ts` if they assert specific `radiusBoost` values.
4. Run visual regression tests (`pnpm run test:visual:update`) to capture the new appearance.
