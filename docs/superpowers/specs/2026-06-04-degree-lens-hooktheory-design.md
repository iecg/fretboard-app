# Degree-Lens Hooktheory Pass — Design

**Status:** ✅ Approved (brainstorm complete). Ready for implementation plan.

**Source:** Deferred from `2026-06-03-marker-color-followups-design.md` §3.10 ("Degree-color
lens → Hooktheory mapping", flagged as the most separable task group). Durable rationale
lives in `docs/design/fretboard-visual-language.md` §A.

**Scope owner:** the opt-in degree-color lens only (`data-degree-colors="true"`).

---

## 1. Goal

Re-skin the opt-in degree-color lens so its note fills adopt the **Hooktheory/Hookpad
scale-degree palette** (1=red, 2=orange, 3=yellow, 4=green, 5=blue, 6=purple, 7=pink),
realized as contrast-disciplined OKLCH tokens tuned for the maple-wood fretboard, with
uniform white labels + dark contour and a distinct neutral treatment for chromatic
(blue) notes.

## 2. Scope

**In scope:** note **fill** color and **label** rendering for degree-colored notes, in both
themes (`modern-light`, `modern-dark`).

**Out of scope (unchanged):**
- Marker **shape** (still circle = in-key / diamond = chromatic, by insideness) and **size**.
- Connector polylines, region/CAGED shading.
- The default lens-OFF board (amber-home palette). The lens continues to deliberately
  override amber-home **while active** — this is the one intentional palette override.
- Toggling/enabling the lens (the `degreeColorsEnabled` atom and its settings control are
  unchanged).

## 3. Decisions

### 3.1 Hue mapping by degree number
Map to Hooktheory identity **by degree number**. All quality/flat variants of a number share
that number's hue (`I`, `i`, `i°`, `I+` → degree-1 red; likewise for 2–7). `data-scale-degree`
is already key-relative, so coloring is interval-relative across keys/modes (the tonic is
always red, etc.). This preserves the existing variant-expansion structure of `DEGREE_COLORS`.

### 3.2 Uniform white labels + dark contour
Every degree note's label renders **white fill + dark contour** via `paint-order: stroke`,
in both themes — the same treatment the home/root markers already use. The current
light-mode degree-text override (dark-ink glyph + faint cream halo) is **removed** so the
base rule applies uniformly. This supersedes §3.10's "white-vs-dark glyph by luminance" idea:
the contour, not a per-degree glyph color, guarantees legibility (including on the paler
yellow and the slate).

### 3.3 Chromatic / blue-note tones → neutral slate
A note whose degree resolves to a **Roman numeral** gets its number's hue (§3.1). A note that
falls back to an **interval name** (`b2`, `b3`, `b5`, `b6`, `b7`) is chromatic and gets a
**neutral slate** fill. The diamond shape (set independently by insideness) carries the
"chromatic" meaning; the slate is a deliberate non-hue so it cannot be mistaken for any of
the seven degree hues. In practice the token that renders today is `b5` (the passing blue
note in the blues scales); `b3`/`b7` map to their Roman degrees (III/VII) and take those hues.
Slate must be visually distinct from **degree-5 blue** and **degree-6 purple**.

### 3.4 Dark-mode muting via existing color-mix
Dark mode keeps the existing mechanism: `--note-degree-fill = color-mix(in srgb,
var(--degree-color) N%, #0f172a)`, re-pointed at the new base hues, with `N` tuned per hue so
white-on-fill clears the APCA gate (yellow/green need a lower `N`). Slate gets the same
treatment.

## 4. Palette tokens

Hue order is fixed (Hooktheory). Lightness/chroma are tuned for wood + the white-glyph-on-fill
APCA gate. The values below are **starting points**; the implementer locks final hex by running
`fbColorTokens.test.ts` and adjusting **only L/C, never hue**.

| Deg | Hue | Base `DEGREE_COLORS` | `--degree-light-fill-*` |
|----|--------|------------|------------|
| 1 | red    | `#e23b34` | `#c0271f` |
| 2 | orange | `#e07b2e` | `#bd5a12` |
| 3 | yellow | `#e0b13a` | `#9a7400` |
| 4 | green  | `#4caf4a` | `#2f8a3d` |
| 5 | blue   | `#3f7fd0` | `#1f5f95` |
| 6 | purple | `#8a52cf` | `#6b2bb0` |
| 7 | pink   | `#e06ba6` | `#b03e7e` |
| ♭ (blue note) | slate | `#6b7884` | `#56646e` |

- **Base `DEGREE_COLORS`** is consumed as the dark-mode `color-mix` base and as the SVG fill
  fallback / `--degree-color`.
- **`--degree-light-fill-*`** are the light-mode fills (darker, so white labels read on warm
  wood).
- **Dark fills** are derived from the base via `color-mix` (§3.4) — no separate dark token set.

## 5. Implementation surface

### 5.1 `packages/core/src/degrees.ts`
- Re-point `DEGREE_COLORS` to the §4 base hues, preserving the existing per-number variant
  expansion (`I`/`i`/`i°`/`I+`, etc.).
- Replace `BLUE_NOTE_COLOR = "#0047ff"` with the slate base `#6b7884`.
- Keep `b3`/`b5` → slate, and ensure the interval-name fallbacks `b2`/`b6`/`b7` also resolve
  to slate (explicit entries or a small lookup helper, whichever keeps the map readable).

### 5.2 `packages/core/src/degrees.test.ts`
- Update palette assertions to the new values: per-number hue identity (variants equal),
  `oklabDistance` separations between adjacent degrees, and **blue-note ≠ degree-V** (new
  collision guard) alongside the existing blue-note ≠ II/VII guards.

### 5.3 `src/styles/themes.css`
- Re-point the eight `--degree-light-fill-*` tokens (incl. `--degree-light-fill-blue` → slate).
- Re-tune the dark-mode `color-mix` percentages per degree + slate so white-on-fill passes APCA.

### 5.4 `src/components/FretboardSVG/FretboardSVG.module.css`
- **Remove** the light-mode degree-text override
  (`…[data-degree-colors="true"] …[data-scale-degree] text { fill: var(--note-label-on-color);
  stroke: var(--note-label-on-color-stroke); }`) so the base white-fill + dark-contour text
  rule applies uniformly to degree notes.
- Verify the contour keeps the label legible on the paler fills (yellow, slate).

### 5.5 `src/styles/__tests__/fbColorTokens.test.ts`
- Extend the glyph-on-fill APCA gate to cover all eight degree fills × {light, dark},
  asserting white-on-fill `|Lc| ≥ 45`. This gate **locks** the final hex.

### 5.6 No logic change to topology
`buildStaticFretboardTopology.ts` already resolves `scaleDegree` → `DEGREE_COLORS[token]`.
Only confirm the interval-name fallback (`INTERVAL_NAMES[...]`) reaches a slate entry.

### 5.7 Durable doc
Update `docs/design/fretboard-visual-language.md`: §A degree-lens entry records the final
palette + slate + white-label-contour rule; move the degree-lens line out of the "open"
provenance note.

## 6. Testing & verification

- **Unit (core):** `degrees.test.ts` palette property assertions (§5.2).
- **Token gate:** `fbColorTokens.test.ts` APCA glyph-on-fill for all degree fills (§5.5).
- **Visual regression:** refresh the degree-lens visual snapshots (the lens-on board) for
  darwin + linux; diffs must be confined to degree-colored note fills and labels.
- **Manual:** toggle the lens on/off in both themes; confirm amber-home returns intact when
  off, and that ♭5 (blues scale) reads as a slate diamond distinct from degree-5 blue.
- **Full gate:** `pnpm run lint`, `pnpm run test`, `pnpm run build` green before PR.

## 7. Non-goals / explicitly deferred

- Literal-Hookpad-hex fidelity (rejected in favor of OKLCH-tuned identities — see §1/§4).
- Any change to lens-off rendering, shape, size, connectors, or region shading.
- The two sibling follow-ups (modal characteristic-tone accent; CAGED pattern shading /
  diagonal boxes) remain in `2026-06-04-fretboard-followups-exploration-draft.md`.
