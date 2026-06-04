# Fretboard Marker & Color Follow-ups — Design

**Date:** 2026-06-03
**Status:** Design approved (decisions confirmed in brainstorm). Ready for implementation plan.
**Depends on:** the chord-overlay marker redesign (`2026-06-03-chord-overlay-grouping-markers-design.md`)
and the OKLCH color-consistency pass (`2026-06-03-chord-overlay-color-consistency-design.md`,
merged via PR #530). This spec assumes shape = harmonic insideness, size = salience,
amber/teal/neutral color, and single-source `--fb-*` OKLCH tokens are all in place.
**Scope:** Eight follow-up fixes/refinements to the fretboard overlay markers and
colors, surfaced by review and live use. All live in the `FretboardSVG` domain.

---

## 1. Background

The marker + color redesign shipped, but live use surfaced gaps between the specs'
stated intent and the rendered result, plus leftover artifacts from the
pre-neutralization palette. This spec resolves eight items grouped into: marker
classification (A), marker visual polish (B), the degree-color lens (C), and one
animation bug (D).

Three items required design decisions (settled in brainstorm); five were directed
by the user. Research grounding:
- **Blue notes** (♭3/♭5/♭7) are chromatic *tension* tones, outside the diatonic
  frame by definition ([Blue note](https://en.wikipedia.org/wiki/Blue_note),
  [Blues scale](https://en.wikipedia.org/wiki/Blues_scale)).
- **Hooktheory/Hookpad degree colors** (major): 1=red, 2=orange, 3=yellow, 4=green,
  5=blue, 6=purple, 7=pink, cycled by interval across scales — the mapping millions
  of learners already know ([scale-degree ref](https://www.hooktheory.com/support/musicreference?concept=music-concepts-scale-degree),
  [Hookpad guide](https://www.hooktheory.com/support/hookpad)).

## 2. Group A — Marker classification (behavioral)

### A1. Diamonds in all voicing modes

**Decision:** outside-key chord tones render as diamonds in close **and** full voicing.

**Today:** `buildStaticFretboardTopology.ts:247-252` force-reclassifies every matched
full-chord voicing vertex (except roots) to `chord-tone-in-scale` (squircle). So an
out-of-scale chord tone inside a full voicing renders as a squircle, never a diamond.
This override is legacy (since the v2.0 voicing overhaul, PR #451), predating the
marker redesign; its original intent was to make a full voicing read as one cohesive
shape.

**Change:** remove the non-root branch of that override so full-voicing vertices
classify through their natural semantics — an in-scale chord tone → `chord-tone-in-scale`
(squircle), an out-of-scale chord tone → `chord-tone-outside-scale` (diamond). The
root continues to classify as `chord-root` / `chord-root-outside`.

**Basis:** marker spec principle "shape = harmonic insideness," applied uniformly.
Showing which voicing member is borrowed is more instructive than uniform cohesion.

**Test:** integration test (mirrors `FretboardSVG.test.tsx:327-366`) — a full voicing
containing an out-of-scale tone renders that tone as `data-note-shape="diamond"`;
in-scale voicing tones stay squircle; the root is unaffected.

**Risk:** full voicings with a borrowed tone now show a diamond among squircles. This
is the intended behavior. Visual-regression snapshots covering full-voicing scenes
will update.

### A2. Blue / color notes diamond under a chord overlay

**Decision:** a designated color/blue note renders as a chromatic **diamond** whether or
not a chord overlay is active — **unless** it is also a current chord tone, in which
case chord-tone classification wins (squircle/teal).

**Today:** `classifyNoteFromSemantics` (the live path under a chord overlay) has **no
`note-blue` branch** (only the boolean `classifyNote`, used when there are no semantics,
does). So under an overlay a color note falls into the in-scale `color-tone` (circle)
branch or `scale-only`, never `note-blue` (diamond).

**Change:** add a `note-blue` branch to `classifyNoteFromSemantics` in the
`hasChordOverlay` path. Placement is **after** the chord-root / chord-tone branches
(so chord-tone wins) and before `scale-only`: a note with `sem.isColorTone`, in the
active shape, that is **not** a chord tone → `note-blue` (→ diamond via `getNoteVisuals`).

**Consequence (confirm at review):** under a chord overlay, designated color notes that
aren't chord tones now render as `note-blue` diamonds rather than `color-tone` circles —
matching the no-overlay behavior and the decision. The `color-tone` (circle) role is
thus effectively retired for color notes while an overlay is active. This is intended:
the app's `colorNotes` are blues/characteristic chromatic tones, whose identity is
"borrowed." (Roles that are color tones *and* chord tones still classify as chord tones.)

**Basis:** blue notes are chromatic tension tones; the diamond shape carries
chromaticism in this system.

**Test:** integration test — with a chord overlay active and a blues scale, a blue note
that is not a chord tone renders `note-blue` `data-note-shape="diamond"`; a color note
that is also a chord tone renders as a chord tone (squircle), not a diamond.

## 3. Group B — Marker visual polish (CSS)

### B1. Drop the heavy light-mode scale stroke

**Today:** `FretboardSVG.module.css:183-185` forces a uniform `stroke-width: 3.6` on
**every** light-mode marker shape, overriding the per-role 1.7 of the hollow roles. The
radius is compensated at `:187-189` (`r: calc(var(--note-r) * 1px - 0.4px)`) to preserve
the outer edge under the heavy stroke.

**Change:** scope the heavy uniform stroke to **filled** roles only. Hollow roles
(`scale-only`, `note-active`, `color-tone`, `note-inactive`) keep a thin ~1.7 stroke in
light mode so context dots stay light and recessive. Re-check the radius compensation
(`:187-189`) so hollow circles aren't shrunk for a stroke they no longer carry — apply
the compensation only where the heavier stroke remains.

**Basis:** hollow = "available context, recedes" (marker spec §4.2). A heavy ring fights
that.

**Test:** visual regression (light mode, overlay off and on). Optionally assert the
computed `stroke-width` for a hollow vs filled role via the existing CSS-token test
approach if practical; otherwise rely on visual regression.

### B2. Drop the root concentric double-ring (both chord-root and key-tonic)

**Today:** `FretboardNote.tsx:82-92` (chord-root) and `:101-108` (key-tonic) render an
extra outline path/circle at `r + CHORD_ROOT_HALO_RADIUS_PX` (3.5px) stroked with
`--note-ring-tonic`. It only reads as "concentric circles" in dark mode (a contrast
artifact) and is redundant.

**Change:** remove the extra outline element for **both** `chord-root` and `key-tonic`
in both themes. The root still reads via amber fill + squircle + largest size +
tonic-ring stroke; the key-tonic via its tonic-ring stroke + size. Retire
`CHORD_ROOT_HALO_RADIUS_PX` if it becomes unused, and update
`FretboardNoteLayer.test.tsx` (which references it at `:24`/`:143`).

**Test:** update/replace the layer test that asserts the halo path; visual regression
in both themes confirms the root/tonic still read clearly.

### B3. Make chromatic-diamond labels legible

**Today:** the neutral diamond's number (`chord-tone-outside-scale`, and `note-blue`
after A2) uses dark ink at `opacity: 0.9` (`FretboardSVG.module.css:161-163`) with a
faint halo in light mode (`:156-158`). The dimmed, thinly-haloed glyph reads poorly.

**Change:** give chromatic-diamond labels a proper outlined glyph — full opacity plus a
halo (via the existing `paint-order: stroke`) sized to read on the neutral fill (light:
dark ink + light halo; dark: white glyph + dark halo, already at `:151-154`). Keep the
diamond **subordinate via size (0.8)**, not by muddying the number. Apply the same label
treatment to `note-blue` diamonds.

**Test:** visual regression; glyph-on-fill APCA gate (extend the existing
`fbColorTokens.test.ts` gate) for the diamond label vs the neutral diamond fill,
threshold |Lc| ≥ 45.

### B4. Remove leftover role glow filters (the "purple")

**Today:** `FretboardSVG.module.css:199-206` still applies a **violet** glow filter to
`note-blue` / `color-tone` and a **cyan** glow filter to `scale-only` / `note-active` —
leftovers from the pre-neutralization palette, visible in dark mode where
`--neon-violet` / cyan glows are live. This is the reported "diamond looks purple."

**Change:** remove both role→glow-filter rules (`:199-206`). Then grep-guard the glow
filter definitions: if `glow-violet` (and `glow-cyan`, if no other consumer) in
`FretboardDefs.tsx` / the `glowFilterUrls` map in `FretboardSVG.tsx` become orphaned,
remove them too; otherwise leave them. Markers then match the neutralized
amber/teal/neutral palette in both themes.

**Basis:** completes color-spec §6 ("neutralize note-role hues") — the fills/strokes
were neutralized but the glow filters were missed.

**Test:** visual regression (dark mode especially); grep-guard confirms no dangling
filter references; lint/build pass.

## 4. Group C — Degree-color lens pass

### C1. Hooktheory mapping + legibility

**Decision:** re-map the opt-in degree-color lens to the Hookpad palette.

**Today:** the lens (`scaleDegreeColorsEnabledAtom`, toggled in
`DisplaySettingsSection.tsx`; CSS at `FretboardSVG.module.css:287-294`) uses a custom
8-hue palette in `themes.css` (`--degree-light-fill-I..VII` + `-blue`), keyed by
`data-scale-degree`.

**Change:** re-map the degree fills to:

| Degree | Hue |
|---|---|
| 1 (I/i/i°/I+) | red |
| 2 (II/ii/ii°/II+) | orange |
| 3 (III/iii/…) | yellow |
| 4 (IV/iv/…) | green |
| 5 (V/v/…) | blue |
| 6 (VI/vi/…) | purple |
| 7 (VII/vii/…) | pink |
| blue note (chromatic ♭ degree) | a defined distinct hue (tuned in implementation) |

Map by **degree number**, so each quality variant (major/minor/dim/aug) of a degree
shares its number's hue; flatted chromatic degrees share the parent number's hue. Because
`data-scale-degree` is already the roman numeral *relative to the key*, this yields
interval-relative coloring across keys/modes automatically (degree I is the tonic in
every key) — no extra cycling logic needed.

Legibility tuning (the lens is the one place multi-hue lives, so it must stay
legend-readable on small dots):
- Per-degree **label** color (white vs dark glyph) chosen by each fill's luminance, with
  a halo via `paint-order: stroke`.
- **Dark-mode** muting via the existing `color-mix(... , #0f172a)` pattern.
- Verify each fill against both wood backgrounds (informational) and each label vs its
  fill (text-tier APCA).

The lens intentionally **overrides** the amber-home role palette while active, so a
red-tonic is acceptable here — it does not affect the default (lens-off) board.

**Test:** unit test asserting each `data-scale-degree` maps to the expected degree hue;
APCA label-vs-fill gate for the seven hues; visual regression with the lens enabled in
both themes.

**Scope note:** this group is the most separable; it touches only `themes.css` degree
tokens and the degree CSS. It can be its own implementation-plan task group (or even a
separate plan) without affecting Groups A/B/D.

## 5. Group D — Bug: marker jitter on chord transition

### D1. Fix the marker position jitter on chord transition

**Symptom:** on an A-minor-blues board, transitioning F → Dm, the F marker visibly
"moves a little." F is out-of-scale in both chords, so it switches role
(`chord-root-outside`, size 0.95 → `chord-tone-outside-scale`, size 0.80) — a legitimate
size change — but it should not **translate**.

**Intended behavior:** a note at a fixed fret never translates during a chord change;
only its size/shape/color may change, and a size change animates **about the note's fixed
center** with no positional drift.

**Approach:** this is the one item that is a genuine bug, not a deterministic edit — use
**systematic-debugging** during implementation. Prime suspects:
1. The motion transform in `FretboardNoteLayer.tsx` / the animated view
   (`useAnimatedFretboardView`) — a `scale`/`transform-origin` that isn't the note
   center, so resizing shifts the marker.
2. A per-chord layout recompute that nudges `cx`/`cy` sub-pixel.

Fix at the source so the transform scales about the center; add a regression test
mirroring the failure (assert the marker's center coordinate is stable across a chord
change while its radius changes).

**Risk:** animation/layout code is shared; verify no regression to the existing
transition/ghost-preview behavior (PR #511) and the reduced-motion path.

## 6. Non-goals / out of scope

- The optional "show all CAGED positions" 5-hue overview (separate backlog feature).
- Any change to the connector render, region tint, or the `--fb-*` semantic tokens
  (those just shipped in #530).
- Re-opening the fill-vs-wood APCA gating decision (markers read via stroke; settled).
- General refactors beyond the files these eight items touch.

## 7. Files touched (summary)

- `src/components/FretboardSVG/hooks/buildStaticFretboardTopology.ts` — A1
- `src/components/FretboardSVG/utils/semantics.ts` — A2
- `src/components/FretboardSVG/FretboardNote.tsx` — B2 (and B3 if label markup changes)
- `src/components/FretboardSVG/FretboardSVG.module.css` — B1, B3, B4, C1 (label contrast)
- `src/styles/themes.css` — C1 (degree palette)
- `src/components/FretboardSVG/FretboardDefs.tsx`, `FretboardSVG.tsx` — B4 (prune orphaned glow defs, grep-guarded)
- `src/components/FretboardSVG/FretboardNoteLayer.tsx` and/or the animated-view hook — D1
- Co-located tests + `e2e/` visual snapshots throughout.

## 8. Testing strategy

- **Behavioral (A1, A2):** Vitest integration tests through `FretboardSVG`, asserting
  `data-note-shape` per role — the existing pattern at `FretboardSVG.test.tsx:327-366`.
- **Visual (B1–B4, C1):** Playwright visual regression in both themes; refresh snapshots
  once diffs are confirmed intentional.
- **Contrast (B3, C1):** extend `src/styles/__tests__/fbColorTokens.test.ts` glyph-on-fill
  APCA gate.
- **Bug (D1):** characterization regression test for center stability across a chord
  change, plus systematic-debugging to find root cause first.
- Mandatory `pnpm run lint && pnpm run test && pnpm run build` before PR.
