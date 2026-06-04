# Fretboard Marker Vocabulary v2 + Color Follow-ups — Design

**Date:** 2026-06-03 (revised 2026-06-04 to v2 after design discussion)
**Status:** Design approved (decisions confirmed in brainstorm). Ready for implementation plan.
**Depends on:** the marker redesign + OKLCH color pass (both merged). 
**Research basis:** `docs/design/fretboard-visual-language.md` (durable reference — all
citations and rationale live there; this spec cites it rather than re-deriving).
**Scope:** A v2 simplification of the marker encoding vocabulary plus a batch of
follow-up fixes, all in the `FretboardSVG` domain.

---

## 1. Background

The marker + color redesign shipped, but live use + review surfaced two structural gaps
and several smaller fixes:

1. **Shape was overloaded.** The system used *three* shapes — squircle (diatonic chord
   tone), circle (diatonic non-chord), diamond (chromatic) — so shape encoded both "is a
   chord tone" *and* "is in-key." That violates one-channel-one-meaning, and squircle-vs-
   circle is a weak cue anyway (both smooth). See the reference doc §B.
2. **Salience wasn't figure-relative.** "Hollow + small = recede" was tuned for the
   chord-overlay case (scale = context behind the chord). With the overlay **off**, the
   scale *is* the subject, yet its tones still rendered ghosted — backwards.

Plus: diamonds didn't appear in full voicing or for blue notes under an overlay; the
root's concentric ring only read in dark mode; a heavy light-mode scale stroke; illegible
chromatic-diamond labels; leftover violet/cyan glow filters from the pre-neutralization
palette; the degree lens used a non-standard palette; and a marker-position jitter on
chord transitions.

## 2. The v2 encoding model

Channels stay orthogonal; the v2 change is **shape collapses to two values** and
**salience becomes figure-relative**. (Full model + rationale: reference doc §1–§2.)

| Channel | Encodes | Values |
|---|---|---|
| **Shape** | insideness (one axis) | **circle** = in-key · **diamond** = chromatic-to-key |
| **Size** | salience (figure-relative) | root largest → figure tones → ground tones smallest |
| **Fill** | active vs. available | filled = active/figure · hollow = ground (recedes) |
| **Color** | two anchors | amber = home · teal = guide tones (3rd/7th) · neutral = rest |
| **Motion/glow** | voice leading only | reserved for transitions |

**Figure-relative salience (new meta-principle):** what recedes depends on what is the
*figure*. A chord overlay makes the chord the figure and the scale the ground; with no
overlay, the scale is the figure. Hollow/small therefore applies to the *ground*, which
only exists when something else is the figure.

## 3. Decisions

### 3.1 Drop the squircle — shape = circle / diamond only

`getNoteVisuals` maps all in-key roles (chord-root, chord-tone-in-scale,
note-diatonic-chord, scale tones, key-tonic) to **circle**; chromatic/outside roles
(chord-root-outside, chord-tone-outside-scale, note-blue) to **diamond**. Chord-vs-scale
is carried by size + fill + color, not shape. `FretboardNote.tsx` renders only circle or
diamond (squircle branch removed); `squirclePath` / `reduceSquircleRadius` retire if
unused. *Basis: reference doc §B (Bertin; curvature/pre-attentive).*

### 3.2 Figure-relative salience (incl. no-overlay scale presentation)

Salience flips with mode. The two scale-tone classes already differ:
- **`note-active` (overlay OFF — scale is the figure):** neutral **filled** circle,
  **medium** size — present and legible (scale-diagram convention). No teal (no chord ⇒
  no guide tones).
- **`scale-only` / `color-tone` (overlay ON — scale is ground):** neutral **hollow**,
  small — recedes behind the chord. (Unchanged from today.)

The root stays the salient anchor in both modes (amber, largest). Split `note-active` out
of the shared hollow CSS group; give it a filled fill and a medium radius (bump from the
`RADIUS_SCALE` 0.66 ground size toward a present/medium size). *Basis: reference doc §1
(figure-relative salience), scale-diagram convention, tonic emphasis.*

### 3.3 Guide tones by hue; drop the static glow

Guide tones (3rd/7th) read via **teal hue** alone. Remove the static guide-tone glow /
size boost from the emphasis layer (`getEmphasis` / `applyTonesBase`); the contracting
ring stays exclusive to the transition lead-in. *Basis: reference doc §C (single-feature
pop-out).*

### 3.4 Drop the root/key-tonic concentric ring

Remove the extra `r + CHORD_ROOT_HALO_RADIUS_PX` outline rendered for `chord-root` and
`key-tonic` (`FretboardNote.tsx:82-108`), both themes. Retire `CHORD_ROOT_HALO_RADIUS_PX`
if unused; update `FretboardNoteLayer.test.tsx`. *Basis: reference doc §D (redundant cue;
the root already owns the unique warm hue + largest size + tonic-ring stroke).*

### 3.5 Diamonds in all voicing modes (A1)

Remove the non-root branch of the legacy override at
`buildStaticFretboardTopology.ts:247-252` that forces full-voicing vertices to
`chord-tone-in-scale`. Outside-key chord tones diamond in close *and* full voicing; the
root keeps `chord-root` / `chord-root-outside`. *Basis: reference doc §B (shape =
insideness uniformly).*

### 3.6 Chromatic = key-relative; blue notes diamond, chord-tone wins (A2)

A note is a **diamond** iff it is **chromatic relative to the key** — not merely outside
the active scale (a blues scale *contains* its ♭5, yet that ♭5 is chromatic to the key).
- Add a `note-blue` branch to `classifyNoteFromSemantics` (the live overlay path, which
  lacks it) so a designated chromatic color/blue note → `note-blue` (diamond) even under a
  chord overlay — placed **after** the chord-tone branches so a chord tone wins.
- A **diatonic** color tone (natural extension / characteristic modal tone) stays a
  **circle** — it's in-key.

**Implementation note (nail in the plan):** the classifier needs a *key-relative*
chromaticism signal. Options: a designated `colorNotes`/`isColorTone` that already marks
the chromatic blue notes, or a new `NoteSemantics` field (e.g. `isKeyChromatic`). Pick the
correct signal so a blues-scale ♭5 diamonds while a Dorian ♮6 does not. *Basis: reference
doc §B (jazz extensions vs. alterations; blue-note theory).*

### 3.7 Legible chromatic-diamond labels (B3)

Give chromatic-diamond glyphs (`chord-tone-outside-scale`, `note-blue`) a proper outlined
label — full opacity (remove the `opacity: 0.9` dimming) + a `paint-order: stroke` halo
sized to read on the neutral fill (light: dark ink + light halo; dark: white + dark halo).
Keep the diamond subordinate via **size**, not a muddy glyph. *Basis: reference doc §F
(APCA glyph-on-fill gate).*

### 3.8 Lighten the light-mode scale stroke (B1)

Scope the uniform `stroke-width: 3.6` light-mode rule (`FretboardSVG.module.css:183-185`)
to **filled** roles only; hollow roles (`scale-only`, `color-tone`, `note-inactive`, and
ground-mode scale tones) keep a thin ~1.7 stroke. Re-check the `r` compensation at
`:187-189` so hollow circles aren't shrunk for a stroke they no longer carry.

### 3.9 Remove leftover role glow filters (B4)

Delete the violet glow on `note-blue`/`color-tone` and the cyan glow on
`scale-only`/`note-active` (`FretboardSVG.module.css:199-206`) — leftovers from the
pre-neutralization palette (the reported "purple" diamond). Grep-guard the glow `<filter>`
defs in `FretboardDefs.tsx` / `FretboardSVG.tsx`; remove any now-orphaned ones. *Basis:
completes color-spec neutralization.*

### 3.10 Degree-color lens → Hooktheory mapping (C1)

Re-map the opt-in degree lens to Hookpad's palette — 1=red, 2=orange, 3=yellow, 4=green,
5=blue, 6=purple, 7=pink — mapping by **degree number** (quality/flat variants share the
number's hue; `data-scale-degree` is already key-relative, so coloring is interval-relative
across keys). Define a distinct blue-note-degree hue. Tune per-degree label contrast
(white vs dark glyph by fill luminance, with a halo) and dark-mode muting (existing
`color-mix` pattern). The lens intentionally overrides the amber-home palette while active.
*Basis: reference doc §A (Hooktheory). Most separable task group.*

### 3.11 Fix the marker jitter on chord transition (D1)

*Intended behavior:* a note at a fixed fret never translates during a chord change; only
its size/shape/color may change, animating **about its fixed center**. Root cause to be
found via **systematic-debugging** — suspects: the motion transform / `transform-origin`
in `FretboardNoteLayer.tsx` / `useAnimatedFretboardView`, or a per-chord sub-pixel layout
recompute. Add a regression test asserting center stability across a chord change while
radius changes. *Basis: reference doc §9 (compositor-only motion).*

## 4. Per-mode summary

**Overlay ON** (chord is figure; scale is ground)

| Role | Shape | Size | Fill | Color |
|---|---|---|---|---|
| Chord root (in key) | circle | largest | filled | amber |
| Chord root (outside key) | diamond | largest | filled | amber |
| Guide tone (3/7) | circle | large | filled | teal |
| Other chord tone | circle | large | filled | neutral |
| Scale tone (`scale-only`) | circle | small | hollow | neutral |
| Diatonic color tone (`color-tone`) | circle | small | hollow | neutral |
| Chromatic / outside chord tone | diamond | medium | filled | neutral |

**Overlay OFF** (scale is figure)

| Role | Shape | Size | Fill | Color |
|---|---|---|---|---|
| Root / key-tonic | circle | largest | filled | amber |
| Scale tone (`note-active`) | circle | medium | **filled** | neutral |
| Blue / chromatic tone (`note-blue`) | diamond | medium | filled | neutral |

## 5. Files touched

- `src/components/FretboardSVG/utils/semantics.ts` — 3.1 (`getNoteVisuals` shapes), 3.3
  (drop guide-tone glow), 3.6 (`note-blue` branch + key-chromatic signal).
- `src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts` — 3.5 (override).
- `src/components/FretboardSVG/FretboardNote.tsx` — 3.1 (circle/diamond only), 3.4 (drop
  ring), 3.7 (label markup).
- `src/components/FretboardSVG/utils/noteSizing.ts` — 3.1/3.4 (retire squircle + halo
  helpers if unused), 3.2 (medium "present" radius).
- `src/components/FretboardSVG/FretboardSVG.module.css` — 3.2 (note-active filled), 3.7
  (label), 3.8 (stroke), 3.9 (glow filters), 3.10 (degree label contrast).
- `src/styles/themes.css` — 3.10 (degree palette).
- `src/components/FretboardSVG/FretboardDefs.tsx`, `FretboardSVG.tsx` — 3.9 (orphaned
  glow defs, grep-guarded).
- `src/components/FretboardSVG/FretboardNoteLayer.tsx` / `useAnimatedFretboardView` — 3.11.
- Co-located tests + `e2e/` visual snapshots throughout (the squircle→circle change and
  glow removal will refresh many snapshots — expected).

## 6. Testing strategy

- **Shape/classification (3.1, 3.5, 3.6):** Vitest integration tests through `FretboardSVG`
  asserting `data-note-shape` per role (existing pattern, `FretboardSVG.test.tsx:327-366`);
  update squircle→circle expectations.
- **Figure-relative salience (3.2):** integration test — `note-active` is filled +
  medium with no overlay; `scale-only` stays hollow + small with an overlay.
- **Visual (3.2, 3.3, 3.4, 3.7, 3.8, 3.9, 3.10):** Playwright visual regression, both
  themes; refresh snapshots once diffs are confirmed intentional.
- **Contrast (3.7, 3.10):** extend the `fbColorTokens.test.ts` glyph-on-fill APCA gate.
- **Jitter (3.11):** characterization regression test for center stability across a chord
  change, after systematic-debugging finds the cause.
- Mandatory `pnpm run lint && pnpm run test && pnpm run build` before PR.

## 7. Non-goals / deferred

- **Modal characteristic tone** (Dorian ♮6, etc.) — designed-but-deferred to a focused
  follow-up spec (needs per-mode characteristic-degree detection + an accent sub-channel).
  Intent + open channel captured in the reference doc §D/§6.
- **Pattern-shading exploration** — a future draft only: a defined neutral CAGED shade,
  shading other pattern systems, and new overlays such as **diagonal boxes**. Not in scope.
- **"Show all CAGED positions" 5-hue overview** — deferred feature.
- **Non-voicing chord-tone de-emphasis** — likely YAGNI (the connector already groups the
  voicing via connectedness).
- No change to the connector render, region tint, or `--fb-*` tokens beyond the above.

## 8. Scope & sequencing note

Two natural groupings for the implementation plan: **(I)** the marker-vocabulary v2 +
classification/visual fixes (3.1–3.9, 3.11), and **(II)** the degree-lens Hooktheory pass
(3.10), which is independent (touches only the degree tokens + degree CSS) and can be its
own task group or even a separate plan. The squircle→circle change (3.1) is the
widest-reaching and should land early so later visual tasks build on the final shape set.
