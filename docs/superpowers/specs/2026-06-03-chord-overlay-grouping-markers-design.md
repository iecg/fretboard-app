# Chord Overlay Redesign — Grouping & Markers

**Date:** 2026-06-03
**Status:** Design approved (validated via live prototype). Ready for implementation plan.
**Scope:** The static chord-overlay rendering — how a voicing reads as "one chord"
(the connector) and how individual note markers encode role. **Out of scope:** the
color-system consistency pass (CAGED / 3NPS / full / close / themes), which is a
separate follow-on sub-project (see §7), and transition/animation cueing (already
shipped and "in a good spot").

---

## 1. Goal

Improve how the chord overlay communicates, grounded in music pedagogy, attention
psychology, and data-visualization research — without performance regressions.
Two dimensions were redesigned: the **connector grouping model** and the **note
marker system**.

## 2. Research grounding (the load-bearing findings)

- **Common region vs. connectedness (Montoro 2017; Palmer 1992/1994).** A closed
  enclosing region groups more strongly than a connecting line *in the abstract* —
  but only when it tightly bounds the group. On a guitar voicing the convex hull
  encloses dead space and overlaps neighbors, and **the CAGED shading already
  provides the region cue**, so the connector's job is the *complementary*
  connectedness cue (which exact notes, what path). → favors a line, not a region.
- **Separable channels (Smart, Wu & Szafir, CHI 2019).** Color × shape is the most
  separable pair; each should carry a *different* dimension. The connector encodes
  chord membership, so **shape is free to encode key membership.**
- **Pop-out for the exception (Treisman).** A unique silhouette pops pre-attentively;
  give it to the rare, important case (the chromatic note).
- **Semantic congruence (Bouba/Kiki).** Angular = tension/edge, round = consonance.
  Diamond↔chromatic, round↔diatonic is a congruent, fluently-read mapping.
- **Pre-attentive > reading (Healey; Treisman).** A luminance/brightness step lets
  the eye find guide tones without reading labels.
- **Attention capture is onset, not form (Yantis & Jonides 1984; Folk 1992).** A
  ring captures because it *appears/moves*; a static ring is just persistent ink.
  → reserve the ring for the transition onset; use brightness for resting emphasis.
- **Clutter & data-ink (Rosenholtz 2007; Tufte 1983).** Minimize added contours;
  recede context; don't add an object when a single channel will do.
- **Depth-halos for crossings (Everts 2009).** The cited fix for overlapping
  translucent connectors — deferred (see §5).

## 3. Decision A — Connector grouping model: "Ribbon" (A′)

A voicing renders as a **soft translucent band with a single solid center line**
threading the note centers — **no boundary edges**.

- **Geometry.** Band = `offsetOpenPolylinePath(vertices, r)` (existing tube fill).
  Center line = open polyline through the voicing's note centers in string order
  (a new `spinePath`).
- **Layering.** Band fill + center line render in the **below pass** (beneath the
  note markers) so the opaque markers occlude the line — it reads as connective
  tissue *between* notes, never scribbled across them.
- **No edges.** The old tube drew its two parallel boundary outlines; with a center
  line present those edges are redundant ink and read as a tangle when voicings
  self-cross. Dropped.
- **No halo.** The light theme's white halo washed the band to pale gray; removed
  for this style in both themes (dark already had 0-width). Overlap legibility
  (depth-halos) is explicitly deferred — single-voicing-at-a-time is the common case.
- **Color.** Orange `#E69F00` (dark) / vermillion `#D55E00` (light), i.e.
  `--chord-connector-color-1` / `-2`. Higher contrast than the per-CAGED-shape
  colors, which it overrides for this style. (Final palette is the §7 pass's call.)
- **Close-voicing normalization.** Close (fallback) voicings previously rendered
  dashed + faded; they now render at full band strength, equal to full voicings.

Rationale: the CAGED shading already carries common-region grouping, so the
connector does the complementary connectedness/path job; the line is the cleaner,
crossing-tolerant cue. (Region and hybrid variants were prototyped and rejected —
the hull added a loose, redundant second region.)

## 4. Decision B — Marker system: "Tiered"

### 4.1 Governing principle (reversed from the initial assumption)

> **Shape encodes harmonic insideness, not chord membership.**
> Round = diatonic; **diamond = chromatic / outside-key.** The connector band
> carries "part of the chord"; the diamond carries "borrowed from outside the key."
> Two orthogonal facts, two channels.

(The earlier "a chord tone is always a squircle" rule was discarded — it spent the
discriminable shape channel redundantly with the connector and camouflaged the
musically important chromatic note. See §2: separability, pop-out, congruence.)

### 4.2 Encoding channels

- **Shape = insideness:** squircle (diatonic chord tone) · circle (scale tone) ·
  diamond (chromatic / outside-key). Hexagon and the circle-vs-squircle *role*
  distinction are dropped (sub-threshold at marker size).
- **Size = salience:** chord tones large, scale tones small. (Size does the
  chord/scale separation that shape can't at this scale.)
- **Color = identity/sub-role:** amber root; cyan chord/scale; brighter cyan for
  guide tones; violet for color tones. (Subject to the §7 consolidation.)
- **Fill = active vs. available:** chord tones filled; in-scale context hollow.

### 4.3 Per-role treatment

| Role | Shape | Size scale | Fill / color |
|---|---|---|---|
| Chord root | squircle | 0.95 | deep amber `#b5670a`, ring `var(--note-ring-tonic)`, **white** label (light + dark) |
| Guide tones (3rd/7th) | squircle | 0.95 | **brightness lift** — dark `#1f5876`/`#7cecff`, light `#cfeefb`/`#1583a6` |
| Other chord tones (5th, …) | squircle | 0.95 | standard chord-tone fill |
| Scale tones | circle | 0.66 | **hollow**, cyan — recedes |
| Color tones / extensions (diatonic) | circle | 0.80 | **hollow**, violet — "flavor" |
| Chromatic / outside-key (incl. blue notes) | **diamond** | 0.80 | filled, pops out |
| Key tonic | circle | 0.82 | tonic ring |

Resulting hierarchy, loudest → quietest: **amber root → bright guide tones →
plain chord tones → chromatic diamonds → violet color circles → hollow cyan scale.**

### 4.4 Guide tones inside connectors

The 3rd & 7th get a **subtle pre-attentive brightness lift** (not a static ring):
single luminance channel, no added ink, no dimming of other notes. The
**contracting ring stays exclusive to the transition (lead-in) onset**, where its
abrupt appearance actually captures attention — preserving its "something's
changing" meaning rather than diluting it into permanent clutter.

## 5. Explicitly deferred

- **Overlap legibility / depth-halos (Everts 2009).** Only needed if multiple
  voicing connectors overlap, which is rare in practice. Revisit if it bites.
- **Transition cueing.** Already shipped; unchanged here.

## 6. Implementation notes

The live exploration was built as **throwaway prototype scaffolding** behind a
`import.meta.env.DEV` toggle. Implementation must replace it with clean code:

- **Remove:** `src/store/connectorPrototypeAtoms.ts`,
  `src/store/markerPrototypeAtoms.ts`,
  `src/components/ConnectorModeDevProbe/`, the `data-connector-mode` /
  `data-marker-system` toggle plumbing, and the "THROWAWAY PROTOTYPE"-marked CSS
  branches.
- **Bake in:** A′ (ribbon) as *the* connector render (drop tube/region/hybrid
  variants); tiered markers as *the* marker system (fold `getTieredNoteVisuals`
  into `getNoteVisuals`, retire the old shape map). `spinePath` becomes a
  first-class field on `ChordConnectorVoicing`.
- **Tokenize colors** rather than hard-coding per element — define
  light/dark token pairs for: connector, root, guide-tone, scale, color-tone,
  chromatic. (This is where §7 lands.)

### Implementation backlog (fixes surfaced during prototyping)

1. **Diamonds not rendering.** Chromatic / blue-note positions still render round —
   `chord-tone-outside-scale` / `note-blue` classification or shape dispatch isn't
   reaching the diamond branch. Investigate during implementation.
2. **Vertical-voicing band visibility.** For tight vertical voicings near the nut,
   the band + center line hide behind the (close-spaced) markers. Floor the band
   half-width above the marker radius so a translucent column always shows.
3. **♭6 outside-root blob.** A chord root outside the scale renders as a muddy
   dashed-orange + glow blob, worst on light wood — give it a proper treatment
   (interacts with the tension-root + guide-target glow path).
4. **Dead CSS cleanup.** The `[data-practice-lens="guide-tones"]` / `"tension"`
   emphasis blocks (~70 lines) are no longer wired to anything live (the
   `practiceLens` mode atom was consolidated away in the v2 redesign).
5. **Color value fine-tuning** across both themes (rolled into §7).

## 7. Follow-on sub-project — Color consistency pass

A separate brainstorm → spec. Problem: three color systems coexist and now clash:
(a) note-role palette (amber/cyan/violet), (b) CAGED shape palette (5 hues), (c)
connector palette (orange/vermillion). Concrete conflicts: **violet means both
color-tones and the CAGED-G shape**; cyan markers sit on blue CAGED shading; full
vs. alt connectors use two different color logics; 3NPS / no-pattern have their own
treatments; dark/light have drifted.

**Key lever:** with shape now carrying insideness and size carrying salience, color
is *freed* from note-role duty — it can be reserved largely for **pattern/voicing
identity** (which CAGED shape / position), letting markers run on a minimal
neutral + amber-root palette. That single decision likely dissolves most of the
redundancy. The pass must define one coherent color language across full/close,
CAGED/3NPS/no-pattern, and dark/light, expressed as token pairs.
