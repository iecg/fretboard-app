# Fretboard Follow-ups — Exploration DRAFT (not scoped)

**Status:** 🟡 **DRAFT / exploration only.** Not approved, not planned. Captures two
deferred ideas so they aren't lost when the approved work ships. Each needs its own
brainstorm → spec → plan before implementation. Durable intent for #1 also lives in
`docs/design/fretboard-visual-language.md` §D/§6.

**Deferred from:** `2026-06-03-marker-color-followups-design.md` (v2) §7.

---

## 1. Modal characteristic-tone accent

### Problem
A mode is defined by its **characteristic tone** — the single degree that distinguishes it
from its parent major/minor (Dorian ♮6, Lydian ♯4, Mixolydian ♭7, Phrygian ♭2, Locrian
♭5/♭2). Players are taught to *emphasize* that tone to evoke the mode, yet today it renders
as an ordinary scale tone with no distinction. Showing it would make the board teach the
mode's color.

### Why it's a follow-up (not in v2)
- It's a **new semantic category**, not a restyle — needs per-mode detection of *which*
  degree is characteristic (judged against the parent major/minor, and there can be more
  than one, e.g. Phrygian ♭2 *and* ♭6 vs. Dorian).
- It needs a **free sub-channel** that doesn't collide with shape (insideness), color
  (amber/teal/neutral), or the transition ring. Shape and the two anchor hues are all
  committed.

### Research grounding (have)
- Characteristic ("color") notes per mode and the pedagogy of emphasizing them:
  Open Music Theory (Diatonic Modes), Berklee, Musical-U. *(See reference doc §7.)*
- It is **diatonic** (in the mode) ⇒ must stay a **circle**, never a diamond.

### Options to explore (accent sub-channel)
| Option | Sketch | Pros | Cons |
|---|---|---|---|
| **A. Salience elevation** | characteristic tone slightly larger/bolder than other scale tones → hierarchy root > characteristic > rest | no new channel; semantically honest (it *is* more important) | uses size, which already encodes salience — could blur with root |
| **B. Thin accent ring** | a distinct subtle outline/halo on the marker | clearly "different"; reads at a glance | new sub-channel; must not look like the transition guide-target ring |
| **C. Small pip / notch** | a tiny secondary mark on the dot | unambiguous, compact | adds a glyph element → clutter risk on a dense board |
| **D. Subtle texture/weight** | heavier stroke or a fill texture | cheap | weak; hard to read at dot size |

Leaning A or B; resolve in the follow-up's brainstorm.

### Open questions
- Detection: where does "parent major/minor" come from for an arbitrary scale? Does the
  theory layer (`@fretflow/core`) already expose the mode/parent, or is a new helper needed?
- Multiple characteristic tones (some modes have two) — accent all, or the primary one?
- Interaction with the overlay-OFF "present scale" treatment (the accent only matters in
  scale view; with a chord overlay the chord is the figure).
- Does the accent also apply when the characteristic tone is a chord tone? (Probably
  chord-tone treatment wins, like the blue-note rule.)

### Research to gather
- Whether any reference tool visually distinguishes modal characteristic tones (precedent).
- Pedagogy on whether highlighting *one* characteristic tone vs. all mode-defining tones
  aids learning.

---

## 2. Pattern-shading & new pattern overlays (incl. diagonal boxes)

### Problem / intent
The CAGED/3NPS region shading was simplified to a **single neutral tint** (good — dropped
the 5-hue rainbow). Two open ideas:
1. Add a defined **neutral shade** option (and possibly a small set of restrained shades)
   for the active region, rather than only the one tint.
2. Explore **other pattern systems / overlays** beyond CAGED boxes and 3NPS — notably
   **diagonal boxes** (diagonal position-shifting patterns that traverse the neck), and
   possibly scale-sequence / "one-position-per-string-pair" overlays.

*(User framing: "I don't want to expand on that now but a draft to explore other patterns
and possibly add new ones like diagonal boxes.")*

### Why it's a follow-up
- It's a **feature-space exploration**, not a fix — needs its own brainstorm on which
  pattern systems are pedagogically worth adding and how they compose with the existing
  CAGED/3NPS polygon machinery (`packages/core/src/shapes/`).
- Region *coloring* must stay within the color discipline (neutral tints; the 5-hue
  rainbow is reserved for an opt-in "show all positions" overview only).

### Options to explore
- **Neutral shade(s):** a single tint (today) vs. a small ladder of neutral tints to
  distinguish overlapping/adjacent regions without reintroducing hue meaning.
- **Diagonal boxes:** generate diagonal traversal polygons (shift up a position every
  string or two) — a well-known practice device for connecting CAGED positions.
- **Other systems:** 3NPS (exists), pentatonic boxes, "horizontal"/single-string scales,
  scale-sequence overlays.
- Composition: how a new pattern type plugs into `SHAPE_CONFIGS` / polygon generation and
  the region-shading layer.

### Open questions
- Which pattern systems earn their place (pedagogy + demand) vs. clutter?
- Does a new pattern type need new polygon math, or can it reuse the existing generator?
- How do region shades read when patterns overlap?

### Research to gather
- Guitar-pedagogy sources on diagonal/positional scale practice and how teachers present
  neck-connection patterns.
- Whether a neutral *shade ladder* (vs. one tint) helps or hurts region legibility
  (perception of low-saturation tints on wood).

---

## Next step
When ready, brainstorm each section into its own design spec (they're independent). #1 is
the more concrete (a scoped marker accent); #2 is a broader feature exploration.
