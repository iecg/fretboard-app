# Chord Overlay Redesign — Color Consistency Pass

**Date:** 2026-06-03
**Status:** Design approved (decisions confirmed in brainstorm). Ready for implementation plan.
**Depends on:** `2026-06-03-chord-overlay-grouping-markers-design.md` (the marker redesign
that frees color from carrying note-role). This spec assumes shape = harmonic
insideness and size = salience are already in place.
**Scope:** Every color in the fretboard overlay, across all pattern modes
(CAGED / 3NPS / no-pattern), all voicing modes (off / close / full), and both
themes (light / dark). Goal: one coherent color language with no hue meaning two
things.

---

## 1. Problem

Three color systems coexist and collide: note-role marker colors (cyan/orange/
violet), the CAGED 5-shape palette (sky-blue/gray/green/blue/purple), and the
connector palette (orange/vermillion) — plus a separate 8-hue scale-degree mode.
The same hue means different things in different places (orange = tonic ring *and*
connector *and* degree I; blue = chord/scale note *and* E-shape *and* A-shape *and*
degree II; purple = color-tone *and* G-shape *and* degree V). Full-chord mode
recolors note fills by CAGED shape, fighting the role-based markers. Light and dark
have drifted through per-element patching.

## 2. Research grounding (decisive findings)

- **Small marks can't carry many hues (Szafir 2018; Ware ~5–7 cap).** Fretboard
  dots are the worst case for hue discrimination. A 7-hue degree palette on dots is
  over the limit and duplicates what shape+size already say.
- **Note→color is arbitrary (Scriabin vs Rimsky-Korsakov disagreed; Newton padded
  "indigo").** Don't color by absolute pitch — and it fights a transposing tool.
- **CAGED-rainbow is the weakest option.** Respected pedagogy (D'Addario/Marshall)
  teaches one shape at a time with the root accented; all-five-at-once "leads to
  shallow memorization."
- **Best tools are monochrome + root accent** (JustinGuitar, classic CAGED diagrams).
- **Amber = home is well-supported** (warm = stable/advancing cross-culturally;
  avoids red's tension connotation).
- **Spend the scarce color on guide tones, not chromatic** (focused follow-up):
  chromatic notes are already encoded by the diamond shape *and* rare, so color on
  them is redundant/under-used; guide tones are frequent, pedagogically primary
  (guide-tone lines — Levine, Coker, Larsen), and currently rely only on luminance —
  which is theme-fragile and competes with size. A stable **hue** gives guide tones
  a reliable categorical identity in every chord.
- **OKLCH single-source tokens** (define once, derive light/dark by lightness) is the
  way to keep a palette coherent across themes without per-element patching.

## 3. The principle

> **Color encodes a two-anchor axis — "where's home" and "what's this chord" — and
> almost nothing else.** Shape, size, and fill carry note role. Color is reserved
> for the two signals an improviser actually tracks: the key center (amber) and the
> current chord's defining tones (teal).
>
> Semantic frame: **amber = key home (tonal center); teal = chord identity
> (guide tones).** Two anchors at two structural levels.

## 4. Color assignments (the working view)

| Element | Color | Notes |
|---|---|---|
| Root / tonic (key home) | **Amber** (warm) | The single warm anchor. |
| Guide tones (3rd & 7th) | **Teal** (cool) | Carried by **hue**, not a brightness lift. The 3rd is the strongest guide tone (Larsen) — both colored as one category; weighting the 3rd is a possible later refinement. |
| Other diatonic chord tones (5th, etc.) | **Neutral** foreground | Distinguished from scale tones by size + filled. |
| Scale tones | **Neutral** foreground | Small + **hollow** — recedes. |
| Color tones / extensions | **Neutral** foreground | Round circle; no separate hue (was violet). |
| Chromatic / outside-key (incl. blue notes) | **Neutral** | **Diamond shape** carries it — no color. |
| Connector ribbon | **One Okabe-Ito accent** | Orange (dark) / vermillion (light). Lines tolerate hue far better than dots. |
| Active CAGED / 3NPS region shading | **Neutral low-sat tint** | Single tint, not 5 hues. |

Net: the working view is **amber + teal + neutral** (+ the connector accent and a
neutral region tint). Every collision in §1 dissolves.

## 5. Per-mode coverage

**Voicing modes — note colors are role-based and identical across all three.**
Voicing mode changes *geometry*, not note color:
- **Off (scale only):** amber tonic + neutral scale tones + neutral chromatic
  diamonds. **No teal** (no chord ⇒ no guide tones) and no connector. Correct: the
  board lights teal exactly when chord context defines a 3rd/7th.
- **Close:** chord overlay — connector ribbon (one accent) + role-colored notes
  (amber root, teal guide tones, neutral others) over neutral scale context. Close
  voicings render at full strength (normalized — from the marker spec).
- **Full:** identical note colors to close; the connector draws the full CAGED
  template voicing. **The per-CAGED-shape note recolor (`--shape-fill` /
  `--shape-stroke`) is removed** — full and close now look the same except for the
  connector geometry.

**Pattern modes:**
- **CAGED:** active shape region gets a single **neutral** tint; notes role-colored.
  The 5-hue per-shape palette is **demoted to an optional "show all positions"
  overview**, never the default board.
- **3NPS:** no region shading (as today) — or a neutral box if shading is wanted;
  notes role-colored. Automatically consistent with no-pattern.
- **No pattern:** notes role-colored, no shading. Already consistent.

**Themes:** every semantic color is one OKLCH token with a light and a dark value
derived by lightness/chroma adjustment (§7). No per-element light/dark patching.

**Degree-color mode:** stays a **separate, opt-in lens** (the one place multi-hue
lives, behind a toggle, legend-readable). It overrides the role colors while on, by
design. If revisited, align it to Hooktheory's relative-degree mapping (1=red … )
for cross-tool familiarity — optional, not required.

## 6. What changes from today

- **Neutralize note-role hues:** drop cyan (`--note-ring`) from plain chord/scale
  tones and violet from color-tones. Reserve **teal for guide tones**, **amber for
  home**; everything else neutral foreground.
- **Chromatic = neutral diamond:** no hue (shape carries it). Remove violet.
- **Remove full-chord per-shape recolor** (`--shape-fill`/`--shape-stroke` on note
  fills). Notes are role-colored in all voicing modes.
- **Demote CAGED 5-hue shading** to a single neutral region tint; move the rainbow to
  an optional overview mode.
- **Remove dead `[data-practice-lens]` emphasis CSS** (already unwired).
- **Keep** the connector accent (orange/vermillion) and the degree-color lens.

## 7. Token strategy (light/dark parity)

Define each semantic color **once as an OKLCH hue token**; derive the light and dark
variant by adjusting **L (and slight C)** only; verify each against its background
with **APCA**. `color-mix()` may derive tints from the base token rather than
maintaining parallel hex lists.

Proposed semantic tokens (final values tuned in implementation; starting anchors):

| Token | Meaning | Light (start) | Dark (start) |
|---|---|---|---|
| `--note-home` | root / tonic | amber `#b5670a` (deep) | amber `#b5670a` |
| `--note-guide` | guide tones 3/7 | teal `#1583a6` stroke / `#cfeefb` fill | teal `#7cecff` stroke / `#1f5876` fill |
| `--note-neutral` | diatonic notes | warm-gray ink on cream | light gray on rosewood |
| `--note-chromatic` | chromatic diamonds | = neutral (shape carries) | = neutral |
| `--connector-accent` | ribbon | vermillion `#D55E00` | orange `#E69F00` |
| `--region-tint` | active shape shading | neutral low-sat tint | neutral low-sat tint |

(Exact OKLCH values, neutral foreground hues, and APCA-verified contrasts are an
implementation task. Watch the warm proximity of `--note-home` amber and the
warm connector accent — if they compete, the connector hue can shift.)

## 8. Implementation notes & backlog

- This is largely a `src/styles/themes.css` consolidation + a pass over
  `FretboardSVG.module.css` and the full-chord-mode plumbing in `FretboardNote.tsx`.
- Migrate the relevant tokens to OKLCH; collapse the duplicated light/dark hex pairs
  into single hue tokens + lightness derivation.
- Coordinate with the marker spec's implementation (they touch the same files);
  ideally land them together so the marker shapes and their colors arrive coherent.
- **Backlog / follow-ups:**
  - The optional **"show all CAGED positions" overview** (the only place the 5-hue
    palette survives) is a separate feature — scope later.
  - Degree-color lens → optional Hooktheory-mapping alignment — later.
  - APCA contrast audit of every token pair against both wood backgrounds.
  - Carry over the marker-spec backlog (diamonds not rendering, vertical-voicing
    band visibility, ♭6 outside-root treatment) — those interact with color tuning.
