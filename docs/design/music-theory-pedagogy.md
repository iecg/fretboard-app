# Music Theory & Pedagogy — Research & Rationale Reference

**Status:** Living reference. **Durable** — lives in `docs/design/`, *outside*
`docs/superpowers/`, so it survives the periodic pruning of specs and plans. This
document is the permanent home for the **theory** grounding behind FretFlow: *what
notes mean* — which intervals make a chord quality, why guide tones carry the
changes, what a mode's characteristic tone is, and why the improvisation lenses
climb the pedagogy ladder they do.

It is the deliberate counterpart to [`fretboard-visual-language.md`](./fretboard-visual-language.md),
which owns the **rendering** decisions — *how* notes are drawn (marker shape, color,
size, motion). The two domains stay separate: theory grounding lives here; the
visual channels that express it live there. When a future spec needs to know *why*
a note matters, it should cite this document; when it needs to know *how* to draw
the cue, it should cite the visual-language doc. (This mirrors the codebase rule
that scale and chord rendering are independent domains — see `CLAUDE.md` "Note
Roles".)

> **Sourcing honesty.** Entries are tagged with provenance:
> **[web]** = verified via web search while writing this doc (URL given);
> **[spec]** = asserted in a prior FretFlow design spec (attribution as written
> there, not independently re-verified here);
> **[convention]** = standard music-theory practice stated without external
> attribution; **[internal]** = a FretFlow engineering/product principle,
> self-derived.

---

## 1. Extended chord qualities (9ths, 11ths, 13ths, 6/9)

FretFlow's chord vocabulary extends past the 7th into the common pop/jazz tension
set. Nine extended qualities are supported; their member sets follow Tonal.js
output (notes stored sharps-form internally, flats resolved at render).

| Symbol  | Label | Members (sharps-form)          | Count |
| ------- | ----- | ------------------------------ | ----- |
| `add9`  | add9  | root, 3, 5, 9                  | 4     |
| `9`     | 9     | root, 3, 5, b7, 9              | 5     |
| `maj9`  | M9    | root, 3, 5, 7, 9               | 5     |
| `m9`    | m9    | root, b3, 5, b7, 9             | 5     |
| `6/9`   | 6/9   | root, 3, 5, 6, 9               | 5     |
| `9sus4` | 9sus4 | root, 4, 5, b7, 9              | 5     |
| `13`    | 13    | root, 3, 5, b7, 9, 13          | 6     |
| `maj13` | M13   | root, 3, 5, 7, 9, 13           | 6     |
| `m13`   | m13   | root, b3, 5, b7, 9, 13         | 6     |

**Enharmonic / spelling.** Member sets follow Tonal.js's resolved intervals; the
9th is the 2nd up an octave, the 13th the 6th up an octave. By jazz convention
**Tonal omits the 11th from 13th chords**, so a 13th chord is six notes
(root, 3/b3, 5, b7/7, 9, 13), not seven. **[spec]** (extended-chord-qualities
design; Tonal.js member output).

**Voicing implications.** Six-note extended chords have no playable single-hand
grip and no CAGED full-chord template; they live on **close voicings + the
fretboard overlay only**. To bring the three 13th chords down to a standard
five-note jazz grip, the **5th is dropped** before voicing generation (the 5th is
harmonically inert — it does not distinguish chord quality — so it is the safe tone
to omit). The ≤5-note extensions need no omission. The 3–5-note voicing range gate
is unchanged; no new shape algorithm was introduced. **[spec]** (omission table;
extended chords as an accepted overlay-only boundary).

### Extensions vs. alterations

The distinction governs which tones are *diatonic* and which are *chromatic* — and
therefore (over in the visual-language doc) which render as in-key circles vs.
outside-key diamonds.

- **Natural extensions (9 / 11 / 13)** are the diatonic **2 / 4 / 6 degrees raised
  an octave** — "available tensions." They belong to the key and are *not*
  chromatic. **[web]** jazz harmony: natural 9/11/13 are diatonic; only altered
  tensions are chromatic.
  <https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/chord-extensions-alterations/>
  · <https://en.wikipedia.org/wiki/Jazz_harmony>
- **Altered tensions (b9 / #9 / #11 / b13)** are **chromatic** — outside the
  diatonic frame, the upper-structure color of altered dominants. These are
  **deferred** in FretFlow (not yet in the quality list), but the data/voicing
  plumbing — a per-quality tone-omission hook and an `"extended"` category — was
  designed so they can be added without rework. **[spec]** (deferred altered
  dominants; forward-compatible `"11"` token and omission table).

---

## 2. Guide-tone lines (the 3rd & 7th)

*Relocated from the visual-language doc (§3C / §7) — this is its theory home; the
rendering of guide tones (teal hue, the two-phase preview ring) stays there.*

The **3rd and 7th are the primary voice-leading tones**. They are the
quality-defining "money notes": the **3rd carries major vs. minor**, the **7th
carries dominant vs. major-7th**. The root and 5th are deliberately excluded —
they are harmonically inert and do not distinguish chord quality, which is exactly
why guide-tone lines are built from 3rds and 7ths only. Across a change the 3rds
and 7ths voice-lead by the smallest interval (the 7th of one chord resolves a half-
or whole-step to the 3rd of the next), with many common tones — the backbone of how
the literature teaches navigating changes. The **3rd is the strongest** of the two
guide tones. **[spec]** Larsen (the 3rd as strongest guide tone); Levine, Coker,
Larsen (guide-tone lines).

This grounding is why the internal `GUIDE_TONE_RAW` member set is exactly
`{b3, 3, b7, 7}` and why a note's guide-tone status is computed only from those
members (`practiceLensAtoms.ts`). **[spec]**

---

## 3. Improvisation lenses (Root / Guide / Common practice)

Shipped in #550, the lens selector swaps which *predictive / voice-leading* notes
the fretboard emphasizes **during progression playback**. The three lenses are not
arbitrary — they track the canonical sequence for learning to "play the changes"
(Aebersold's progressive ladder: roots → scale → triad → chord tones → guide tones
→ common/pivot → chromatic approach). A lens only earns its place if it shows
something the **static chord overlay cannot** — and the overlay's blind spot is
**time** (it only ever renders the *current* chord). **[spec]** (improvisation-
lenses design).

- **Root lens.** Emphasizes the **root of the next chord** (one target). This is
  the first rung: Aebersold starts every student on the roots — "play the root of
  each chord" — so they *hear* the progression go by before they decorate it. Root
  always exists (unlike guide tones, which are empty for power chords), so the aim
  cue always has exactly one target. **[spec]** Aebersold *Volume 1*.

- **Guide-tone lens** *(default)*. Emphasizes the **next chord's 3rds & 7ths**
  (`{b3, 3, b7, 7}`) — the quality-defining tones that voice-lead smoothly (see §2).
  This is today's default and is unchanged when selected. **[spec]** Levine, Coker,
  Galper.

- **Common / pivot lens.** Emphasizes the tones **shared between the active chord
  and the next** (`active ∩ next`) — what *survives* the change and can be leaned on
  or pivoted through, including notes that **re-function** across the change (in
  ii→V, Dm7 and G7 share D and F; the held b3 of the ii becomes the b7 of the V).
  The overlay shows one chord at a time and so can never show this intersection,
  which is precisely why it justifies a lens. **[spec]** voice-leading pedagogy
  (common-tone retention / re-functioning).

The three lenses split into two paradigms: **Target** lenses (Root, Guide) "aim
ahead" at a small next-chord target set via the planning→landing ring; the
**Field** lens (Common) emphasizes tones *across* the change with a steady hold.
A fourth **approach-note / enclosure lens** (chromatic neighbors into the next guide
tone — Galper's forward-motion targets, bebop enclosure) is the natural top rung but
is **deferred**. **[spec]**

---

## 4. Modal characteristic tones

The note that **defines a mode** is the one players are taught to emphasize to evoke
that mode's color:

- **Dorian** — natural 6 (♮6)
- **Lydian** — raised 4 (♯4)
- **Mixolydian** — flat 7 (♭7)
- **Phrygian** — flat 2 (♭2)

These are the "characteristic" or "color" notes — the single degree that separates
the mode from its nearest major/minor parent. **[web]** modal characteristic notes.
<https://viva.pressbooks.pub/openmusictheory/chapter/diatonic-modes/> ·
<https://online.berklee.edu/takenote/music-modes-major-and-minor/> ·
<https://www.musical-u.com/learn/the-many-moods-of-musical-modes/>

A characteristic tone is **diatonic** to its mode, so it must not be drawn as a
chromatic diamond, and marker shape is already committed to encoding insideness. It
therefore needs its own subtle, *non-shape* accent. The choice of that **accent
rendering channel** (thin ring / notch / halo) and how to detect the characteristic
degree remain an **open sub-design tracked in `fretboard-visual-language.md` §6** —
this document is the theory home only and does not decide the rendering.

---

## 5. Annotated citation index (theory & pedagogy)

**Guide-tone lines & voice leading**
- **Levine, *The Jazz Theory Book* (Sher Music, 1995); Jerry Coker; Jeff Larsen.**
  3rd & 7th are the primary voice-leading tones; the 3rd is the strongest (Larsen).
  [spec]
- **Hal Galper, *Forward Motion: From Bach to Bebop*.** Target notes resolving to
  chord tones on downbeats; lines pointing toward future targets. [web]
  <https://halgalper.com/articles/understandingforwardmotion/>
- **Jamey Aebersold, *Volume 1: How To Play Jazz & Improvise*.** The progressive
  ladder: roots → scale → triad → chord tones. [web]
  <https://www.alfred.com/jamey-aebersold-jazz-volume-1-how-to-play-jazz-and-improvise/p/24-V01DS/>
- **LearnJazzStandards, "Use Guide-Tones to Navigate Chord Changes."** [web]
  <https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/use-guide-tones-navigate-chord-changes/>
- **Fundamental Changes, "Using Guide Tones in the Blues (3rds and 7ths)."** [web]
  <https://www.fundamental-changes.com/using-guide-tones-blues-3rds-7ths/>
- **The Jazz Piano Site, "Voice Leading"** (common tones / re-functioning; Dm7↔G7).
  [web] <https://www.thejazzpianosite.com/jazz-piano-lessons/jazz-chord-progressions/voice-leading/>
- **Anton Schwartz, "Approaches & Enclosures"** (deferred approach-note lens). [web]
  <https://antonjazz.com/2019/07/approaches-enclosures/>

**Jazz harmony — extensions & alterations**
- **Extensions vs. alterations.** Natural 9/11/13 are diatonic (2/4/6 up an octave;
  "available tensions"); altered tensions (♭9/♯9/♯11/♭13) are chromatic. [web]
  <https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/chord-extensions-alterations/>
  · <https://en.wikipedia.org/wiki/Jazz_harmony>

**Modal theory**
- **Modal characteristic ("color") notes.** Dorian ♮6, Lydian ♯4, Mixolydian ♭7,
  Phrygian ♭2; emphasized to evoke the mode. [web]
  <https://viva.pressbooks.pub/openmusictheory/chapter/diatonic-modes/> ·
  <https://online.berklee.edu/takenote/music-modes-major-and-minor/> ·
  <https://www.musical-u.com/learn/the-many-moods-of-musical-modes/>

**Scale-degree pedagogy (cross-tool reference)**
- **Hooktheory / Hookpad scale-degree colors.** 1=red, 2=orange, 3=yellow, 4=green,
  5=blue, 6=purple, 7=pink; cycle by interval across scales. The degree-color *lens*
  adopting this mapping is a rendering decision documented in the visual-language
  doc; the mapping itself is the cross-tool theory reference. [web]
  <https://www.hooktheory.com/support/musicreference?concept=music-concepts-scale-degree>
  · <https://www.hooktheory.com/support/hookpad>

---

## 6. Open questions / deferred

None currently — theory-side deferred items, if any, will land here. (The
consolidation spot-check found no un-shipped theory ideas; the deferred *rendering*
question for modal characteristic tones lives in `fretboard-visual-language.md` §6,
and the deferred *altered-dominant* qualities are a product-scope decision tracked
by the extended-chord work, not an open theory question.)

---

## 7. Provenance

This document consolidates the theory/pedagogy grounding from the following sources.
Specs are ephemeral (deleted once shipped); SHAs let them be re-read from history
with `git show <sha>:<path>`.

**Source specs:**
- `docs/superpowers/specs/2026-06-01-extended-chord-qualities-design.md` — SHA
  `8d7b5da6`. The nine extended qualities, their member sets, the 5th-omission
  voicing rule, and the extensions-vs-alterations distinction (§1).
- `docs/superpowers/specs/2026-06-07-improvisation-lenses-design.md` — SHA
  `5566bde9`. The Root / Guide / Common lens ladder and its pedagogy citations (§3),
  shipped in #550.

**Relocated grounding:**
- The guide-tone-line and modal-characteristic-tone theory (§2, §4) is **relocated
  from `fretboard-visual-language.md` §3C / §7 / §8**, which keeps the
  corresponding *rendering* decisions (teal guide-tone hue, the modal-tone accent
  channel as an open sub-design). The theory now lives here; the visual doc cites it.
