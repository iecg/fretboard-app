# Connector Legibility on Wood — Design

Date: 2026-06-05
Status: Approved (brainstorm complete)
Builds on: PR #535 (line-only connector spine + color/dash disambiguation), PR #536 (taper-aware note-bubble sizing)
Supersedes the §3 portion of: `2026-06-05-connector-improvements-draft.md`

## Purpose

The chord-connector color + dash disambiguation (#535) is effectively invisible
in the **light** theme: the colored spines wash out against the warm maple wood,
so you cannot tell which spine belongs to which voicing — the whole feature is
lost on light wood. This is a full legibility pass for the chord connectors
across **both** themes: contrast, palette, dash, and busyness.

The original four-concern draft tracked this as §3 ("color/dash tuning"),
deferred with acceptance criteria. A live render plus APCA measurement showed the
criteria are **not** met on light wood. §1 (spine routing) was deliberately not
chosen as the next item: its original motivation (nut crowding) was already
resolved by #536, and the remaining curve/bow/rim work is high-risk aesthetic
polish. §4 (crossing focus) is dropped permanently.

## Background

- Connectors render as **line-only spines** through voicing note centers: a halo
  underlay (`path[data-layer="halo"]`) plus an accent center line
  (`path[data-layer="spine"]`), both in the "below" pass so note markers occlude
  them. Per-voicing **color** comes from `data-palette-index` → CSS token
  `--chord-connector-color-N`; overlapping voicings get a redundant **dash**
  (`data-dash="true"` → `stroke-dasharray: 7px 5px`). (PR #535)
- Both themes share the **same** Okabe-Ito 8-color palette
  (`src/styles/themes.css`). Only the halo token differs:
  - light: `--fb-connector-halo: rgb(255 255 255 / 0.7)` ("pale halo lifts the line")
  - dark:  `--fb-connector-halo: rgb(0 0 0 / 0.5)` ("shadow halo carves the line")
- The chord halo stroke is a fixed `4px` in `FretboardSVG.module.css`
  (`.chord-connectors path[data-layer="halo"]`), `stroke: var(--fb-connector-halo)`.
  The spine is a fixed `2px`, `stroke: currentColor`, opacity `0.95`.
- Wood base colors (mid stop, representative):
  - Light maple: `--fretboard-wood-mid: #f1c38e` (range `#fbe6c6` → `#e0ab68`).
  - Dark rosewood: `--fretboard-wood-mid: #0d0805` (range `#160d07` → `#080403`).

## Evidence (APCA Lc)

|APCA Lc| of each palette color directly on the wood mid stop (higher = more
legible; ~45+ comfortable for thin non-text lines, <25 poor):

| Palette color | Light maple `#f1c38e` | Dark rosewood `#0d0805` |
|---|---|---|
| 1 orange `#E69F00`     | **14** | 58 |
| 2 vermillion `#D55E00` | 35     | 36 |
| 3 gray `#999999`       | 25     | 47 |
| 4 green `#009E73`      | 31     | 41 |
| 5 sky `#56B4E9`        | **15** | 57 |
| 6 blue `#0072B2`       | 45     | 27 |
| 7 purple `#CC79A7`     | 27     | 44 |
| 8 yellow `#F0E442`     | **11** | 88 |

Casings: black-on-light-wood = **76**, white-on-dark-wood = **108**. Every
palette color sits at Lc 27–88 against black, so a colored core stays
distinguishable *inside* a casing.

Conclusions:

1. **Dark theme is already adequate** — colors carry directly on rosewood; blue
   (27) is the only marginal entry.
2. **Light theme fails for 6 of 8 colors** — the bright Okabe-Ito palette is too
   light for tan wood, and the current *white* halo (31) makes it worse.
3. **A theme-appropriate casing fixes light wood without touching the palette** —
   a dark casing on light wood (76) carves every line; colorblind-safety and the
   redundant dash stay intact. Palette-first (wood-tuned colors) is unnecessary
   and would sacrifice colorblind-safety for no gain.

## Mechanism: casing-first (APCA-validated), applied where it helps

A theme-appropriate **contrasting casing** carries legibility; the palette stays
Okabe-Ito. The casing is *translucent*, so legibility must be judged on the
**composited** casing-over-wood color, not the raw casing hue. Doing that
composited math (alpha-blend the casing over the wood mid stop, then APCA)
reveals an **asymmetry**: the casing is the right fix for light wood, but is
counter-productive on dark wood. So the fix is applied where it measurably helps —
**light theme only.**

Composited measurement (casing alpha-blended over wood mid, then |APCA Lc|):

- **Light maple, dark casing `rgb(0 0 0 / 0.6)`:** composited casing-vs-wood ≈ 56.
  Above the ≥45 "the outline is clearly visible" floor — every spine becomes a
  dark-outlined colored stroke on tan wood. The colored core rides inside the
  casing; you see the line via its dark outline regardless of the core's own
  (low) contrast with the wood.
- **Dark rosewood, light casing `rgb(255 255 255 / 0.35)`:** composited
  casing-vs-wood ≈ 20 (too weak to carry), **and** a white rim washes out the
  blue core (blue-vs-white ≈ 6). So a light casing neither carries the line nor
  preserves color identity on rosewood. Rejected.

Why this is the honest result, not a compromise: on **dark** wood the bright
Okabe-Ito colors already carry directly (min = blue at 27; everything else 36–88),
which is why #535 shipped dark as "passes WCAG 3:1 on rosewood." A casing there
adds risk (muddier blue) for no contrast gain. On **light** wood the colors are
too pale to carry, so the dark casing does the work. Different woods, different
load-bearing element.

## Design

### 1. Dark casing on light wood (core fix) — light theme only

In `src/styles/themes.css`, flip the light-theme `--fb-connector-halo` from white
to a **dark translucent** casing:

- `modern-light`: `rgb(255 255 255 / 0.7)` → **`rgb(0 0 0 / 0.6)`** (composited
  casing-vs-wood ≈ 56, ≥ 45 floor with margin; solid-black upper bound is Lc 76).
  Raises every spine from invisible to a clearly-outlined colored stroke.
- `modern-dark`: **unchanged** (`rgb(0 0 0 / 0.5)`). Dark theme already reads via
  the colors; a casing there is rejected (see Mechanism).

The chord halo is already a fixed `4px` stroke driven by this token, so changing
the one light-theme token *value* is the entire mechanism — no width change, no
new element, no dark-theme change.

### 2. Palette unchanged

Keep the 8 Okabe-Ito tokens (colorblind-safe) in both themes. Keep the current
rotation `CONNECTOR_PALETTE_ROTATION = [0, 5, 3, 6, 1, 4]` → CSS slots
1,6,4,7,2,5 = orange, blue, green, purple, vermillion, sky. (Lead = orange, blue —
maximally distinct hues; orange now reads via the casing, blue reads directly on
both woods.) The rotation already **excludes** the two weakest-on-wood entries —
slot 3 gray and slot 8 yellow — so they never render and need no guard. No
wood-tuned palette replacement, no reorder.

### 3. Dash legibility + zoom-awareness

The dash is the colorblind redundancy cue. It is currently fixed `7px 5px`, which
collapses toward dots on small/mobile boards. Drive it from a CSS custom property
scaled from `stringRowPx`, using a **pure, unit-testable helper** and setting the
property where `stringRowPx` is *already* in scope — no new prop, no change to
`FretboardConnectorLayer`:

- New pure helper `connectorDashArray(stringRowPx): string` in
  `src/components/FretboardSVG/utils/noteSizing.ts` (the existing sizing-utils
  module — same home as `taperAwareRadiusScale`), returning a CSS `dasharray`
  string. Definition: `dash = clamp(DASH_MIN_PX, round(stringRowPx * DASH_FACTOR),
  DASH_MAX_PX)` and `gap = clamp(GAP_MIN_PX, round(stringRowPx * GAP_FACTOR),
  GAP_MAX_PX)`, returned as `"${dash}px ${gap}px"`. Constants are chosen so the
  default tablet row height (`STRING_ROW_PX_TABLET`) yields the current `7px 5px`
  (`DASH_FACTOR ≈ 0.18`, `GAP_FACTOR ≈ 0.13`, `DASH_MIN_PX = 6`, `GAP_MIN_PX = 4`,
  generous maxima) so the default board is visually unchanged and only smaller
  boards shorten the dash toward the floor.
- `FretboardSVG.tsx` sets `--fb-connector-dash` on the existing `.fretboard-neck`
  inline style object (the same object that already sets `--string-row-px`, where
  `stringRowPx` is in scope), via `connectorDashArray(stringRowPx)`. The property
  inherits down through the SVG to the spine paths (CSS custom properties inherit
  through SVG).
- `FretboardSVG.module.css` dash rule reads it:
  `stroke-dasharray: var(--fb-connector-dash, 7px 5px);` — the `7px 5px` fallback
  preserves current behavior when the property is absent (e.g. isolated component
  tests that render the layer without the neck wrapper).

Spine width (`2px`) and halo width (`4px`) stay fixed — limits snapshot churn and
keeps busyness down. Dash is the only geometry-scaled quantity.

### 4. Busyness

No new behavior. The casing provides separation, so thin `2px` spines stay
readable even where many voicings cross — addressed by *not* over-thickening.
There is no opacity/focus/hover layer (that was the dropped §4).

## Module boundary / files

- `src/styles/themes.css` — flip the `modern-light` `--fb-connector-halo` value
  to `rgb(0 0 0 / 0.6)`; `modern-dark` unchanged (§1).
- `src/components/FretboardSVG/utils/noteSizing.ts` — new pure
  `connectorDashArray(stringRowPx)` helper + its constants (§3).
- `src/components/FretboardSVG/FretboardSVG.tsx` — set `--fb-connector-dash` on
  the existing `.fretboard-neck` style object via `connectorDashArray(stringRowPx)`
  (§3). No change to `FretboardConnectorLayer`.
- `src/components/FretboardSVG/FretboardSVG.module.css` — dash rule reads
  `var(--fb-connector-dash, 7px 5px)` (§3).

The contrast-floor test reuses the **existing** helpers in
`src/styles/__tests__/cssTokens.ts` (`readThemeBlock`, `resolveVar`,
`contrastAPCA`) — no new APCA helper is written. Note `readThemeBlock` reads
`themes.css` only: the **light** wood mid (`--fretboard-wood-mid: #f1c38e`) lives
in the `modern-light` block and is readable; the **dark** wood mid
(`--fretboard-wood-mid: #0d0805`) lives in `tokens.css` `:root` and is referenced
in the test as a documented constant with a source comment.

## Non-goals

- Spine routing geometry — curving/bowing/rim-routing the spine (former §1, not
  chosen; #536 already relieved nut crowding).
- A crossing-focus / hover-selection interaction layer (§4, dropped permanently).
- Replacing the Okabe-Ito palette or its rotation order.
- Changing note-marker rendering, the taper geometry, or the interval connectors
  (the chord-connector halo token change is scoped to `.chord-connectors`; the
  interval connectors use their own `--chord-connector-halo-color` token and are
  out of scope).
- Re-introducing the ribbon/tube fill or radius-offset machinery.

## Testing

- **Unit — contrast floor** (new `src/styles/__tests__/connectorLegibility.test.ts`,
  `// @vitest-environment node`): reuses `readThemeBlock`, `resolveVar`,
  `contrastAPCA` from `./cssTokens`. Because the casing is translucent, the test
  **composites** the casing over the wood mid (alpha-blend → effective casing
  color) before measuring. The legibility model is **per-theme** (different
  load-bearing element per wood):
  - **Light theme — casing carries.** Read `modern-light` `--fb-connector-halo`
    and `--fretboard-wood-mid`; composite casing over wood; assert
    `|Lc(compositedCasing, lightWood)| ≥ 45` (the dark outline is clearly visible;
    designed value ≈ 56).
  - **Dark theme — colors carry.** Using the documented dark wood mid `#0d0805`
    and the 6 **rotation** palette colors (slots 1,6,4,7,2,5 = orange, blue,
    green, purple, vermillion, sky), assert each `|Lc(color, darkWood)| ≥ 25`
    (current min = blue at 27; this guards against a future dark-palette swap
    going too dark). Gray (slot 3) and yellow (slot 8) are excluded from the
    rotation and not asserted.
  Floors (`LIGHT_CASING_FLOOR = 45`, `DARK_COLOR_FLOOR = 25`) are documented
  constants in the test with the rationale above.
- **Unit — dash scaling** (`src/components/FretboardSVG/utils/noteSizing.test.ts`,
  alongside the existing `taperAwareRadiusScale` tests): `connectorDashArray`
  returns `"7px 5px"` at `STRING_ROW_PX_TABLET` (default unchanged); shrinks
  monotonically as `stringRowPx` decreases; never drops below the
  `DASH_MIN_PX`/`GAP_MIN_PX` floor at very small row heights; clamps to the maxima
  at very large row heights.
- **Component**: `src/components/FretboardSVG/FretboardSVG.test.tsx` — assert the
  rendered `.fretboard-neck` element carries a `--fb-connector-dash` inline custom
  property. `FretboardConnectorLayer.test.tsx` is unchanged (the layer's structure
  did not change); its existing dashed-spine assertions still hold via the CSS
  fallback.
- **Visual regression**: refresh chord-connector snapshots for **both** themes
  (`e2e/fretboard-connectors.visual.spec.ts` — light + dark; plus any
  `app-components` / `fretboard-svg` frames showing connectors), darwin + linux.
  **Light** frames change substantially (lines become visible, dark casing);
  **dark** frames change only if the dash geometry differs at the captured row
  height (the dark *casing* is unchanged).

## Acceptance criteria

- Every concurrently-rendered voicing is visually distinguishable on **both**
  woods (light maple and dark rosewood).
- **Light theme:** the composited dark casing clears `|Lc| ≥ 45` against the light
  wood mid, so every spine reads as a clearly-outlined colored stroke (verified by
  the unit test).
- **Dark theme:** every rotation palette color clears `|Lc| ≥ 25` against the dark
  wood mid — i.e. legibility is not regressed from the shipped #535 state
  (verified by the unit test).
- The dash pattern is legible at minimum supported zoom (does not collapse to
  dots on the smallest board) and is pixel-unchanged (`7px 5px`) at the default
  tablet row height.

## Sequencing

1. Light-theme casing token flip (§1) + contrast-floor unit test — the high-value
   core.
2. Dash zoom-scaling helper (§3) + dash unit test + neck custom-property
   component assertion.
3. Visual-regression refresh (both themes, both platforms); confirm acceptance
   criteria against the real rendered board.
