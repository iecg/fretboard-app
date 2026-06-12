# Fretboard Visual Language — Research & Rationale Reference

**Status:** Living reference. **Durable** — lives in `docs/design/`, *outside* `docs/superpowers/`
so it survives the periodic pruning of specs and plans. Specs and plans are ephemeral
(they describe a unit of work and get deleted once shipped); this document is where the
*why* lives permanently.

**Purpose.** A single home for the research, guitar conventions, and engineering
principles behind FretFlow's fretboard *rendering* visual language — markers, color,
and chord-transition motion. When a future spec makes a visual/interaction decision, it
should **cite this document** rather than re-deriving the grounding, and add any new
sources here.

> **Companion docs.** This doc owns *rendering* rationale (how notes are drawn). The
> *theory* grounding (chord qualities, guide tones, improvisation lenses, modal
> characteristic tones) lives in [`music-theory-pedagogy.md`](./music-theory-pedagogy.md);
> the *voicing/strum/audio* engine rationale lives in
> [`audio-voicing-engine.md`](./audio-voicing-engine.md). The two domains stay separate —
> theory decides which notes mean what; this doc decides how they look.

**How to use.**
- Decisions are organized by domain (§3). Each entry states the decision, the rationale,
  and the sources.
- §7 is the annotated citation index (external sources, verified where possible).
- §8 is the guitar-convention / pedagogy index.
- §9 is the recurring internal engineering principles.
- §10 records provenance: which specs this consolidates, including ones already pruned
  from `main` (recovered from git history, with SHAs, so they can be re-read if needed).

> **Sourcing honesty.** Entries are tagged with provenance:
> **[web]** = verified via web search while writing this doc (URL given);
> **[spec]** = asserted in a prior FretFlow design spec (attribution as written there,
> not independently re-verified here);
> **[convention]** = standard guitar/music-theory practice stated without external
> attribution; **[internal]** = a FretFlow engineering principle, self-derived.

---

## 1. The encoding model (the channels)

The fretboard overlay encodes note meaning across a small set of **orthogonal visual
channels**, each carrying *one* kind of information. Keeping channels orthogonal is the
core discipline — it is what keeps a dense board legible.

| Channel | Encodes | Values |
|---|---|---|
| **Shape** | harmonic *insideness* (nominal, one axis) | smooth **circle** = in-key · angular **diamond** = chromatic / outside-key |
| **Size** | *salience* (ordinal) | root largest → chord tone → outside tone → scale tone smallest |
| **Fill** | *active vs. available* | filled = chord/active · hollow = scale/context (recedes) |
| **Color (hue)** | the *two harmonic anchors* | **amber** = home (tonal center) · **teal** = chord identity (guide tones 3rd/7th) · **neutral** = everything else |
| **Motion / glow** | *voice leading* only (during transitions) | reserved for change: incoming / held / departing |

Three meta-principles govern the model:

- **One channel, one meaning.** No hue, shape, or motion does double duty. *(Bertin: shape
  is a nominal channel and should carry a single categorical distinction — §7.)*
- **Spend scarce, strong channels on what the player actually tracks.** Hue is scarce
  (small marks can't carry many hues — §7) and is reserved for the two signals an
  improviser tracks: where home is, and what the current chord's defining tones are.
- **Salience is figure-relative.** Hollow/recede means "ground *behind the current
  figure*," so it only applies when something else is the figure. A chord overlay makes
  the chord the figure and the scale the ground (scale tones recede, hollow + small); with
  **no** overlay the scale *is* the figure and its tones are **present** (filled, medium),
  not recessed. The root/tonic stays the salient anchor in both modes. *(Gestalt
  figure–ground; scale-diagram convention — all scale tones solid, root highlighted — §7.
  The `Size` and `Fill` rows above describe the figure tones; ground tones recede.)*

---

## 2. Why these channels (the short version)

- **Hue is rationed** because small dots can't discriminate many hues (Szafir; Ware's
  ~5–7 cap — §7), so only the two-anchor amber/teal survive; everything else is neutral.
- **Shape carries insideness** because smooth-vs-angular is a strong *pre-attentive*
  contrast (circles are detected at least as fast as angular shapes; curvature is a basic
  search feature — §7), and shape is the right channel for a *nominal* category (Bertin).
- **Size + fill carry chord-vs-scale** because that separation is already strong on those
  channels, leaving shape free to mean *only* insideness.
- **Motion is quarantined to voice leading** so that when something moves, it always means
  "this voice is changing" — never decoration.

---

## 3. Decisions & rationale

### A. Color

- **Amber = home; warm = stable/advancing; red avoided.** The single warm anchor marks the
  tonal center. **[spec]** (chord-overlay color-consistency design; warm/advancing color
  framing). Red specifically avoided for the tonic because of its tension connotation.
- **Teal = guide tones (3rd & 7th), as a stable *hue*, not a brightness lift.** Guide tones
  are the pedagogically primary tones to track (guide-tone lines), so they get the one
  remaining categorical hue. A hue is theme-stable; the earlier "luminance lift" was
  fragile and competed with size. **[spec]** Levine, Coker, Larsen (guide-tone lines; the
  3rd as the strongest guide tone — Larsen).
- **Note→color is arbitrary; do not color by absolute pitch.** Synesthetes disagreed
  (Scriabin vs. Rimsky-Korsakov; Newton padded the spectrum to fit "indigo"), and a
  transposing tool fights any fixed pitch→hue map. **[spec]**
- **CAGED rainbow is the weakest option; region shading is a single neutral tint.**
  Respected pedagogy teaches one CAGED shape at a time with the root accented; all five
  colored at once "leads to shallow memorization." **[spec]** D'Addario/Marshall;
  JustinGuitar (monochrome + root accent). The 5-hue palette is demoted to an optional
  future "show all positions" overview (§6 of the color spec; deferred).
- **Connector accent = one Okabe-Ito color** (orange dark / vermillion light). Lines
  tolerate hue far better than dots, and Okabe-Ito is colorblind-safe. **[spec]**
  (Okabe & Ito colorblind-safe palette.)
- **Scale-degree *color* lens — tried, then removed.** An opt-in degree-color lens
  (overriding amber-home with Hookpad's 1=red…7=pink mapping) shipped briefly and was
  **removed (#534)**: a full rainbow on small dots fights the rationed-hue discipline (§2),
  and the cross-tool-familiarity benefit didn't justify a second palette mode. It was
  superseded by the **improvisation lenses** (Root / Guide / Common practice, #550), which
  re-emphasize *salience* within the existing two-anchor palette instead of recoloring by
  pitch class. The lens *pedagogy* (what Root/Guide/Common each emphasize, and the
  Hooktheory degree-color reference) now lives in
  [`music-theory-pedagogy.md`](./music-theory-pedagogy.md) §3; this doc keeps only the
  rendering principle: **don't spend a whole rainbow on dots.** **[web]** Hooktheory
  scale-degree colors (retained as a reference, not an active mapping).

### B. Marker shape & size

- **Shape encodes insideness *only*: circle = in-key, diamond = chromatic/outside-key.**
  A third shape (the squircle, formerly = "diatonic chord tone") overloaded shape with a
  second meaning ("is a chord tone") and was a weak cue besides — a squircle and a circle
  are both *smooth*, so they differ only subtly at dot size, whereas smooth-vs-angular
  (circle vs diamond) is a strong pre-attentive contrast. Chord-vs-scale is already carried
  by size + fill. So the squircle is dropped; chord tones are filled circles. **[web]**
  Bertin (shape = one nominal axis); curvature/pre-attentive shape perception (Healey;
  "Seeing circles"; Chuquichambi 2020).
- **Size = salience.** Root largest, then chord tone, then outside (medium), then scale
  tone (smallest, recedes). **[internal]** + size as an ordinal channel (Bertin).
- **Fill = active vs. available.** Chord/active tones filled; scale/context tones hollow so
  they recede into the board. **[spec]/[internal]**
- **Diamond = chromatic relative to the *key*, not the active scale.** A blue note belongs
  to the blues scale yet is chromatic against the key — so "chromatic" must be judged
  against the diatonic/key frame, not `isInScale` of the displayed scale. Diatonic color
  tones / natural extensions stay circles. **[web]** jazz harmony (natural 9/11/13 are
  diatonic = the 2/4/6 up an octave; only altered tensions and blue notes are chromatic);
  Blue note theory.
- **Redundant encoding is acceptable to *reinforce* a class, not to add a second meaning.**
  Combining size+fill+color to separate chord tones is fine; adding a shape difference on
  top would over-encode. **[web]** "Redundant is Not Redundant" (CatPAW).

### C. Guide tones & emphasis

- **Guide tones pop via hue alone; no permanent glow.** Pop-out is most reliable from a
  single distinct feature; teal hue already separates the 3rd/7th. A static glow stacked on
  top is a redundant third channel that reads as clutter and dilutes the *transition* ring
  (whose job is "something is changing"). **[web]** pre-attentive single-feature search
  (Healey). **[internal]** "one hue = one meaning."
- **The contracting ring stays exclusive to the transition lead-in.** Its abrupt onset is
  what captures attention; making it permanent would spend that signal. **[spec]/[internal]**

### D. Root & modal characteristic tones

- **No concentric/double ring on the root.** The root already owns the only warm hue
  (amber) + the largest size + a tonic-ring stroke — the strongest unique cue is already
  spent, so an extra concentric ring is low-value clutter (and only read as "concentric
  circles" in dark mode as a contrast artifact). **[internal]** (redundant encoding has
  diminishing returns once a uniquely strong cue exists — cf. CatPAW, §7).
- **Modal characteristic tones deserve a distinct, *non-shape* accent.** The note that
  defines a mode (Dorian ♮6, Lydian ♯4, Mixolydian ♭7, Phrygian ♭2) is what players are
  taught to emphasize to evoke the mode — but it is *diatonic*, so it must not be a diamond,
  and shape is committed to insideness. It needs its own subtle channel (a thin accent
  ring / notch / halo) that doesn't re-overload shape or break the amber/teal/neutral color
  economy. **[web]** modal characteristic ("color") notes (Open Music Theory; Berklee;
  Musical-U). *(Channel choice is an open sub-design — §6.)*

### E. Connector & voice-leading motion

- **Voicing membership is carried by the connector (Gestalt connectedness), not by a
  second marker change.** The polyline already groups the active voicing via the strongest
  grouping cue; double-encoding membership on the marker would be redundant. **[internal]**
  (connectedness as the dominant grouping cue.)
- **Motion reads as voice leading: each moving voice slides to the nearest next-chord tone**
  so the eye tracks the hand. Held notes may serve as motion *origins* (directional origin
  over strict voice accounting). **[convention]** voice leading = smallest motion to the
  nearest available tone.
- **Bounded, nearest-neighbor, fire-once-per-chord.** A note slides only if it has a
  held/departing target within a *playable span* (~3 frets / 2 strings, measured in
  string/fret units, not pixels); keep the *shortest* moves; cap the count; gate to the
  active region. **[convention]** playable hand spans; nearest-tone voice leading.
- **Preview the next *hand position*.** The most informative lead-in shows the incoming
  notes that are *outside* the current scale (normally hidden) as hollow ghost rings that
  flip solid at the boundary — which also fixes the note "pop." **[convention]** "where the
  fingers go next."
- **`--note-incoming` is a dedicated green-teal hue** chosen to avoid collision with
  amber (home/tension), teal-held, and the old `#fb923c` anticipation hue. **[internal]**
  "one hue = one meaning."

### F. Tokens & contrast

- **Single-source OKLCH tokens.** Each semantic color is defined once in OKLCH; light/dark
  variants derive by adjusting lightness (and slight chroma). Keeps the palette coherent
  across themes without parallel hand-tuned hex. **[web]** OKLCH (perceptual lightness/chroma
  separation).
- **APCA for legibility, applied where it's actually *text*.** Contrast is gated on the
  note **glyph vs. its marker fill** (text-tier |Lc| ≥ 45). Marker-fill-vs-wood is recorded
  *informationally only* — a marker disc is not text and reads via its stroke/edge, so a
  text-tier threshold is the wrong instrument there. **[web]** APCA-W3 (perceptual contrast,
  polarity-aware). **[internal]** (text-tier thresholds apply to text, not shapes.)

---

## 4. The model in two tables (target state, by figure)

Because salience is figure-relative, the presentation differs by mode.

**Chord overlay ON** — the chord is the figure; the scale is ground (recedes):

| Role | Shape | Size | Fill | Color |
|---|---|---|---|---|
| Chord root | circle | largest | filled | amber |
| Chord root, outside key | **diamond** | largest | filled | amber |
| Guide tone (3rd/7th) | circle | large | filled | **teal** |
| Other chord tone | circle | large | filled | neutral |
| Scale tone (ground) | circle | small | **hollow** | neutral |
| Diatonic color tone (ground) | circle | small | **hollow** | neutral |
| Chromatic / outside chord tone | **diamond** | medium | filled | neutral |

**Chord overlay OFF** — the scale is the figure (present, not recessed):

| Role | Shape | Size | Fill | Color |
|---|---|---|---|---|
| Root / key-tonic | circle | largest | filled | amber |
| Scale tone | circle | **medium** | **filled** | neutral |
| Blue / chromatic tone | **diamond** | medium | filled | neutral |
| Modal characteristic tone | circle | medium | filled + **accent (TBD, deferred — §6)** | neutral |

*(v2 simplification: squircle dropped, shape = circle/diamond only. No teal with the
overlay off — guide tones exist only in chord context. See §10 for the spec that lands it.)*

---

## 5. Anti-patterns (things the research tells us NOT to do)

- Don't color by absolute pitch (arbitrary; fights transposition). **[spec]**
- Don't put many hues on small dots (over the ~5–7 discrimination cap). **[web/spec]**
- Don't make shape encode two attributes at once (squircle = "chord tone" *and* round =
  "in key"). **[web]**
- Don't stack redundant channels to *add meaning* (permanent glow on guide tones on top of
  hue). Redundancy may *reinforce*, not *extend*, meaning. **[web]**
- Don't animate anything but `opacity`/`transform`; never `r`, `display`, layout, SVG path
  `d` morphing, or SVG filters (main-thread paint). **[internal]**
- Don't recompute emphasis per animation frame; ≤2 discrete recomputes per chord step.
  **[internal]**
- Don't let motion mean anything but voice leading. **[internal]**
- Don't de-emphasize chord tones not in the active voicing; the connector polyline already
  groups the voicing via Gestalt connectedness, and a second encoding would over-encode.
  **[internal]**

---

## 6. Open questions / deliberately deferred

- **Modal characteristic-tone accent channel** — the note that defines a mode (Dorian ♮6,
  Lydian ♯4, Mixolydian ♭7, Phrygian ♭2) is diatonic, so it can't be a diamond and shape is
  committed to insideness (§D). It needs its own *non-shape* sub-channel. Candidate cues:
  a thin accent **ring**, a small **notch/pip** on the marker, a subtle **salience
  elevation** (slightly larger/brighter within the neutral economy), or a faint **halo** —
  each must avoid re-overloading shape and must not break the amber/teal/neutral color
  economy. Open: which cue, and how to *detect* the characteristic degree (mode-relative,
  not key-relative). The *theory* home for which tones these are is
  [`music-theory-pedagogy.md`](./music-theory-pedagogy.md) §4. *(Open sub-design; migrated
  from the 2026-06-04 fretboard-followups exploration draft.)*
- **New pattern overlays** — beyond CAGED/3NPS, a future exploration may add traversal
  overlays such as **diagonal boxes** (and possibly pentatonic boxes, single-string /
  horizontal scales, or scale-sequence overlays) plugging into `SHAPE_CONFIGS` / polygon
  generation. Has both a rendering facet (this doc) and a pedagogy facet
  (`music-theory-pedagogy.md`). *(Future exploration; not in current scope. Migrated from
  the exploration draft.)*
- **Neutral region-shade ladder** — the CAGED region shading was simplified to a single
  neutral tint. A future option: a small, *restrained* ladder of neutral shades for active
  region(s) vs. inactive, staying within the no-rainbow discipline (§2). *(Deferred;
  migrated from the exploration draft.)*


---

## 7. Annotated citation index (external sources)

**Visualization & perception**
- **Bertin, *Semiology of Graphics* (visual variables).** Shape is a *nominal* channel,
  best mapping one shape per category; it is associative but not ordered/selective →
  encode one categorical distinction with shape. [web]
  https://geography.wisc.edu/cartography/projects/publications/Roth_2015_EG.pdf ·
  https://medium.com/@manishk1095/bertins-visual-encoding-theorem-4fb049678e41
- **Szafir (2018).** Small marks can't carry many hues — fretboard dots are the worst case
  for hue discrimination. [spec]
- **Ware, *Information Visualization*.** ~5–7 hue discrimination cap for categorical color.
  [spec]
- **Healey, "Perception in Visualization" (NC State).** Pre-attentive features, single-
  feature pop-out vs. conjunction search, redundant encoding. [web]
  https://www.csc2.ncsu.edu/faculty/healey/PP/
- **"Seeing circles: what limits shape perception?" (*Vision Research*).** Curvature is a
  basic pre-attentive search feature. [web]
  https://www.sciencedirect.com/science/article/pii/S0042698900000924
- **Chuquichambi et al. (2020), *Perception*.** Circles detected faster than downward
  triangles; smooth contours processed faster than angular. [web]
  https://journals.sagepub.com/doi/abs/10.1177/0301006620957472
- **"Redundant is Not Redundant" (CatPAW, arXiv).** Combining color+shape redundantly can
  enhance class separation. [web] https://arxiv.org/pdf/2602.06792

**Color systems**
- **Okabe & Ito colorblind-safe palette.** Source of the connector accent colors. [spec]
- **OKLCH perceptual color space.** Single-source tokens; derive light/dark by lightness.
  [web]
- **APCA-W3 (Accessible Perceptual Contrast Algorithm).** Polarity-aware perceptual
  contrast; used for the glyph-on-fill legibility gate. [web] https://apcacontrast.com
- **Scriabin vs. Rimsky-Korsakov; Newton's "indigo".** Evidence that note→color is
  arbitrary. [spec]

**Music theory & guitar pedagogy**
- **Guide-tone lines — Levine (*The Jazz Theory Book*), Coker, Larsen.** 3rd & 7th are the
  primary voice-leading tones; the 3rd is the strongest (Larsen). [spec]
- **Blue notes (♭3/♭5/♭7).** Chromatic tension tones, outside the diatonic frame. [web]
  https://en.wikipedia.org/wiki/Blue_note · https://en.wikipedia.org/wiki/Blues_scale
- **Jazz harmony — extensions vs. alterations.** Natural 9/11/13 are diatonic (2/4/6 up an
  octave; "available tensions"); altered tensions (♭9/♯9/♯11/♭13) are chromatic. [web]
  https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/chord-extensions-alterations/ ·
  https://en.wikipedia.org/wiki/Jazz_harmony
- **Modal characteristic ("color") notes.** Dorian ♮6, Lydian ♯4, Mixolydian ♭7, Phrygian
  ♭2; emphasized to evoke the mode. [web]
  https://viva.pressbooks.pub/openmusictheory/chapter/diatonic-modes/ ·
  https://online.berklee.edu/takenote/music-modes-major-and-minor/ ·
  https://www.musical-u.com/learn/the-many-moods-of-musical-modes/
- **Hooktheory / Hookpad scale-degree colors.** 1=red, 2=orange, 3=yellow, 4=green, 5=blue,
  6=purple, 7=pink; cycle by interval across scales. [web]
  https://www.hooktheory.com/support/musicreference?concept=music-concepts-scale-degree ·
  https://www.hooktheory.com/support/hookpad
- **CAGED pedagogy — D'Addario/Marshall; JustinGuitar.** Teach one shape at a time with the
  root accented; monochrome + root accent beats the all-five rainbow. [spec]

---

## 8. Guitar conventions & pedagogy index (used without external attribution)

- **Voice leading** = connect chords by the smallest motion to the nearest available tone.
- **Voice-leading roles:** held / incoming (anticipation) / departing / static.
- **Guide tones** (3rd & 7th) are the salient cross-change tones.
- **"Where the fingers go next"** — the next hand position is the most informative preview.
- **Playable hand span** — motion bounded in string/fret units (~3 frets / 2 strings).
- **CAGED / shape region** — the natural gate for which notes participate in an overlay.
- **Multi-bar vs. single-bar chords** — a chord may span several bars (drives "fire once
  per chord" timing).
- **Notes stored as sharps; flats resolved by key** (FretFlow convention; see CLAUDE.md).

---

## 9. Internal engineering principles (recurring, self-derived)

- **Compositor-only motion.** Animate only `opacity`/`transform`. Never `r`, `display`,
  layout, SVG path `d` morphing, or SVG filters.
- **Discrete-phase emphasis.** Emphasis recomputes ≤2× per chord step, not per frame.
- **One hue = one meaning** (channel separation): identity (shape/size/fill/ring) vs.
  voice-leading (motion/glow); no hue does double duty.
- **Reduced-motion is authoritative.** `prefers-reduced-motion` forces static fallbacks
  (static ghost ring, no translate, no pulse) while preserving the information.
- **Scale and chord rendering are independent domains** — don't cross-wire their visibility
  or color state (see CLAUDE.md "Note Roles").
- **No silent caps.** When a feature bounds coverage (top-K moves, region gating), log what
  was dropped.
- **Board drop shadow is desktop-only.** `.fretboard-board`'s `0 10px 30px` shadow gives the
  neck lift on desktop/tablet-stacked, but in the sheet shell (mobile + tablet-split) — where
  the board is height-derived and centered against the app gradient — the blur reads as a
  smeared band below the neck (recurring owner complaint). Suppressed via tier/variant-gated
  `box-shadow: none` in FretboardSVG.module.css; do not re-add it for those surfaces.

---

## 10. Provenance

This document consolidates the grounding from the following specs. Several are already
**pruned from `main`** and were recovered from git history (read with
`git show <sha>:<path>`); SHAs are the last commit before deletion.

**Pruned in the 2026-06-08 docs cleanup, recovered from history (visual language / color).**
These four specs seeded this document; they were deleted once consolidated here. Recover
with `git show <sha>:<path>` (SHA = last commit before deletion):
- `2026-06-03-chord-overlay-grouping-markers-design.md` (`5ce84af8`) — marker
  shape/size/fill system; the §2 research grounding (Szafir, Ware, Levine/Coker/Larsen,
  D'Addario/Marshall, JustinGuitar, amber=home).
- `2026-06-03-chord-overlay-color-consistency-design.md` (`5ce84af8`) — the
  two-anchor color principle, OKLCH tokens, Okabe-Ito connector, degree-lens framing.
- `2026-06-03-fb-marker-apca-audit.md` (`c973b674`) — APCA glyph-on-fill gate;
  why fill-vs-wood is not gated.
- `2026-06-03-marker-color-followups-design.md` (`432e2651`) — diamonds in all
  voicings, blue-note classification, glow-filter cleanup, degree-lens Hooktheory pass,
  and the v2 marker-vocabulary simplification.
- `2026-06-04-fretboard-followups-exploration-draft.md` (`432e2651`) — the deferred
  exploration ideas now captured in §6 (modal characteristic-tone accent channel, new
  pattern overlays / diagonal boxes, neutral region-shade ladder).

**Cleaned up in the 2026-06-08 open-questions triage.**
- `2026-06-08-visual-language-open-questions-cleanup.md` — closed the non-voicing chord
  tones item as YAGNI (connector already groups the voicing); dropped the "show all CAGED
  positions" overview (no use case; single-shape invariant enforced in storage); §6 reduced
  from five items to three. The modal characteristic-tone accent channel remains the top
  candidate for the next design-resolution pass.

**Pruned from `main`, recovered from history (chord-transition motion):**
- `2026-05-27-connector-transition-playback-research.md` (from `490b46b2^`) — root-cause
  trace of the playback-vs-manual connector animation mismatch.
- `2026-05-28-transition-and-highlight-redesign-design.md` (from `490b46b2^`) — channel
  separation (identity vs. voice-leading), discrete-phase emphasis, next-chord preview.
- `2026-06-01-chord-transition-rework-design.md` (from `90b28ac1^`) — ghost-ring preview as
  pop-fix; `--note-incoming` hue; compositor-only perf guardrails.
- `2026-06-01-voice-leading-motion-design.md` (from `90b28ac1^`) — slide each moving voice
  to its nearest next-chord tone; rejected alternatives (path morph, comet, trail).
- `2026-06-02-voice-leading-motion-pass2-design.md` (from `90b28ac1^`) — bounded
  nearest-neighbor, step-relative lead-in, fire-once-per-chord, playable-span caps.

> Note: the motion specs contained **no external academic citations** — their grounding is
> guitar convention, music pedagogy, and the internal engineering principles in §9. This
> document does not attribute external sources to them.
