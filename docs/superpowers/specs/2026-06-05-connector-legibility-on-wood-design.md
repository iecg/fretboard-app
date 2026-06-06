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

## Mechanism: casing-first (APCA-validated)

A theme-appropriate **contrasting casing** carries legibility; the palette stays
Okabe-Ito.

## Design

### 1. Symmetric contrasting casing (core fix)

In `src/styles/themes.css`, flip `--fb-connector-halo` so each wood gets the
casing that contrasts *it*:

- Light theme: white → **dark**, target `rgb(0 0 0 / 0.55)` (tune alpha to clear
  the floor; solid-black upper bound is Lc 76 vs maple). Raises every spine from
  invisible to clearly outlined.
- Dark theme: black (currently a no-op, Lc ~0 on rosewood) → **light**, target
  `rgb(255 255 255 / 0.35)` (solid-white upper bound is Lc 108 vs rosewood).
  Lifts the one marginal color (blue) and crispens all.

The chord halo is already a fixed `4px` stroke driven by this token, so changing
the token *values* is the entire mechanism — no width change, no new element.

### 2. Palette unchanged

Keep the 8 Okabe-Ito tokens (colorblind-safe) in both themes. Keep the current
rotation `CONNECTOR_PALETTE_ROTATION = [0, 5, 3, 6, 1, 4]` (lead = orange, blue —
maximally distinct hues, both now legible: orange via casing, blue directly). No
wood-tuned palette replacement, no reorder.

### 3. Dash legibility + zoom-awareness

The dash is the colorblind redundancy cue. It is currently fixed `7px 5px`, which
collapses toward dots on small/mobile boards. Drive it from a CSS custom property
scaled from `stringRowPx`:

- `FretboardConnectorLayer.tsx` sets `--fb-connector-dash` on the connector group
  (or the spine paths) from the geometry already available to the layer
  (`stringRowPx`), e.g. `dash = clamp(MIN, round(stringRowPx * K), MAX)` with a
  matching gap, expressed as a single `dasharray` string.
- `FretboardSVG.module.css` dash rule reads the property:
  `stroke-dasharray: var(--fb-connector-dash, 7px 5px);` (fallback preserves
  current behavior if the property is absent — e.g. in isolated tests).

Spine width (`2px`) and halo width (`4px`) stay fixed — limits snapshot churn and
keeps busyness down. Dash is the only geometry-scaled quantity.

### 4. Busyness

No new behavior. The casing provides separation, so thin `2px` spines stay
readable even where many voicings cross — addressed by *not* over-thickening.
There is no opacity/focus/hover layer (that was the dropped §4).

## Module boundary / files

- `src/styles/themes.css` — `--fb-connector-halo` values for both themes (§1).
- `src/components/FretboardSVG/FretboardSVG.module.css` — dash rule reads
  `var(--fb-connector-dash, 7px 5px)` (§3).
- `src/components/FretboardSVG/FretboardConnectorLayer.tsx` — compute and set the
  `--fb-connector-dash` custom property from `stringRowPx` (§3). If `stringRowPx`
  is not already a prop on this component, thread it from `FretboardSVG.tsx`
  (where it is in scope) — a single new prop, no new data flow.
- New pure helper (§ testing) for the contrast floor:
  `src/components/FretboardSVG/utils/connectorContrast.ts` — an APCA Lc function
  plus the wood/casing/palette constants, so the acceptance floor is a unit test,
  not a manual check.

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

- **Unit — contrast floor** (`connectorContrast.test.ts`): a pure APCA Lc helper.
  A cased line reads if it contrasts *either* the wood *or* its casing, and the
  casing must itself outline against the wood. So assert, per theme, with a single
  documented floor `FLOOR = 30`:
  1. **Casing vs wood** `|Lc(casing, woodMid)| ≥ FLOOR` — the outline is visible
     (dark casing on light maple ≈ 76; light casing on dark rosewood ≈ 108).
  2. **Each palette color** `max(|Lc(color, woodMid)|, |Lc(color, casing)|) ≥ FLOOR`
     — every color reads via the wood, the casing, or both. (Worked example, light
     theme dark casing: blue = max(45, 27) = 45 ✓; orange = max(14, 58) = 58 ✓;
     yellow = max(11, 88) = 88 ✓.)
  Codifies "legible" as a regression guard rather than a manual check.
- **Unit — dash scaling** (`FretboardConnectorLayer` or a small pure dash helper):
  the dash string scales with `stringRowPx` and never drops below the minimum
  floor; falls back to `7px 5px` semantics at the default row height.
- **Component**: existing `FretboardConnectorLayer.test.tsx` — assert the dash
  custom property is set on the group/paths and that the halo/spine structure is
  unchanged.
- **Visual regression**: refresh chord-connector snapshots for **both** themes
  (`fretboard-connectors` light + dark; plus any `app-components` /
  `fretboard-svg` frames showing connectors), darwin + linux. Light frames change
  substantially (lines become visible); dark frames change subtly (faint light
  casing).

## Acceptance criteria

- Every concurrently-rendered voicing is visually distinguishable on **both**
  woods (light maple and dark rosewood).
- No palette entry falls below the APCA contrast floor on either wood with the
  casing applied — i.e. `max(|Lc(color, wood)|, |Lc(color, casing)|) ≥ 30` for
  every color, and `|Lc(casing, wood)| ≥ 30` for the casing itself (verified by
  the unit test).
- The dash pattern is legible at minimum supported zoom (does not collapse to
  dots on the smallest board).
- Dark-theme legibility is not regressed (it was already adequate; the light
  casing only lifts the marginal blue and crispens edges).

## Sequencing

1. Casing token flip (§1) + contrast-floor unit test — the high-value core.
2. Dash zoom-scaling (§3) + dash unit/component tests.
3. Visual-regression refresh (both themes, both platforms); confirm acceptance
   criteria against the real rendered board.
