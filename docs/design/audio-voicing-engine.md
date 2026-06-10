# Audio & Voicing Engine — Research & Rationale Reference

**Status:** Living reference. **Durable** — lives in `docs/design/`, *outside*
`docs/superpowers/`, so it survives the periodic pruning of specs and plans. Specs and
plans are ephemeral (they describe a unit of work and get deleted once shipped); this
document is where the *why* lives permanently.

**Purpose.** A single home for the rationale behind FretFlow's **audio voicing** — how
the progression playback path chooses which chord tones to sound, how it places them
across registers (the inversion-based strum engine), how the fretboard close-voicing
fallback scores grips when no full shape fits, and the principles behind the audio
playback layer itself. When a future spec makes a voicing/playback decision, it should
**cite this document** rather than re-deriving the grounding, and add any new sources
here.

This doc holds the **WHY behind voicing selection, strum realization, fallback scoring,
and audio playback.** For how voicings are *drawn* on the neck — marker shape/color, the
connector polylines, the visual close-voicing scorer's role in the overlay — see the
companion [Fretboard Visual Language](./fretboard-visual-language.md). Audio voicing
(what you *hear*) and visual voicing (what you *see*) are deliberately separate domains;
where they touch (the close-voicing data, the fallback scorer) is called out explicitly.

**How to use.**
- Decisions are organized by domain (§1–§3). Each entry states the decision, the
  rationale, and the sources.
- §6 records **open questions and deferred work** — including forward-looking proposals
  whose source specs never shipped, preserved here so they survive deletion of those
  drafts.
- §7 records provenance: which specs this consolidates, with SHAs, so they can be
  re-read from git history if needed.

> **Sourcing honesty.** Entries are tagged with provenance:
> **[web]** = verified via web search while writing this doc (URL given);
> **[spec]** = asserted in a prior FretFlow design spec (attribution as written there,
> not independently re-verified here);
> **[convention]** = standard guitar / music-theory practice stated without external
> attribution; **[internal]** = a FretFlow engineering principle, self-derived.
>
> The voicing work is grounded mostly in guitar convention and engineering judgement, so
> most entries here are **[spec] / [convention] / [internal]**. A few placement rules
> trace to named external sources (jazz comping references); those carry **[web]** with
> the URL the originating spec cited.

---

## 1. Voicing selection & the inversion-based strum engine

The progression playback path runs every default-genre strum (Rock, Pop, Blues, Ballad,
and the Funk 16ths bucket) through one pure module, `src/progressions/voicingEngine.ts`,
exposing `buildVoicing(root, quality, prevVoicing, preset)`. The engine is preset-driven
(`VoicingPreset` / `STRUM_PRESET`) and integrated at a single call site in
`src/progressions/audio/buildAllLayers.ts`. Pitches are absolute integers
(`octave * 12 + chroma`; C3 = 36, C4 = 48, C5 = 60). **[spec]/[internal]**

### 1.1 The problem it solves — low clusters and the muddy stack

The original audio path (`resolveChordVoicing`) stacked a chord's members monotonically
upward from octave 3 with **no minimum interval, no tone thinning, and no register
clamp.** Any quality whose members sit a step apart — the 6th next to the 5th, the 9th
next to the root/3rd, the ♭7 next to the root — produced a low major-2nd cluster down
near 196–220 Hz, the audible "mud." The canonical failure was C6 (`C3 E3 G3 A3`): the
6th a whole step above the 5th, in the worst register for it. The voice-leading helper
(`getNearestInversion`) made it worse, not better — it minimized total semitone motion
across freely generated inversions with no spacing constraint, so it could *create* a
tighter low cluster than the plain stack. **[spec]/[internal]**

### 1.2 Tone selection — keep guide and color tones, drop the 5th first

Step 1 of the engine selects which tones to sound. The rule, generalized from the
extended-chords `VOICING_OMISSIONS` intent into a single drop-priority
(`DROP_PRIORITY = ["5", "root"]`): when a chord has more members than the preset's
`maxNotes`, **drop the 5th first, then the root** if still over. Guide tones (3/♭3,
7/♭7) and color tones (6, 9, 13, sus 2/4) are **always kept** — they carry the chord's
identity and its color; the 5th is the most expendable voice. This is also why the
de-clustering move (§1.4) lifts the 5th rather than a color tone. **[spec]/[convention]**

### 1.3 Color tones stay internal — never the top or bottom voice

The first shipped placement core (audio-voicing-engine spec) anchored tones ascending
from a floor and octave-bumped any low cluster. For a 6th chord this was *structurally*
wrong: the 6th is the highest tone in root position, so an ascending stack always put it
on top, and de-clustering bumped it higher still — stranding the 6th as the lone melody
voice. A real guitarist voices C6 with the **6th internal**, "like a 7th" (drop-2 / drop-3
inversions put the 6th in an interior voice in three of the four major-6 rotations). Just
as important, putting the 6th *in the bass* collapses the chord toward its Am7 reading
(C6 and Am7 share the same notes — "move that A to the bass and you have an Am7"). So the
durable rule, shipped in **#521 (strum inversion voicing)**, is:

> **Color tones (6, 9, 13) are placed strictly internal — never the highest nor the
> lowest voice — and the engine chooses among real inversions (plus a spread-the-5th
> variant), voice-led to the previous chord, rather than a single root-position stack.**

For C6 with no previous chord this yields a drop-2 first inversion (3rd in bass, 6th
internal, 5th on top) — the grip a player would actually use.
**[web]** (jazz comping references —
[Major 6th voicings](https://www.jazz-guitar-licks.com/pages/chords/major-6th-guitar-chords.html),
[Drop 2 Chords](https://www.jazzguitar.be/blog/drop-2-chords/),
[Sixth chord](https://en.wikipedia.org/wiki/Sixth_chord),
[Major 6th vs Minor 7th](https://hearandplay.com/main/major-sixth-vs-minor-seventh-chords/),
[Spread Triads](https://appliedguitartheory.com/lessons/spread-triads/),
[Open / Spread Voicing](https://www.sweetwater.com/insync/open-voicing-spread-voicing/))
/ **[spec]/[convention]**

### 1.4 The selection algorithm — generate → filter → score

The inversion engine replaced the original ascending-stack placement with three stages,
keeping the `VoicingPreset` shape and the single integration point. **[spec]/[internal]**

- **Generate.** Classify each selected tone by role (`root`, `guide`, `fifth`, `color`,
  `other`). Emit one candidate per tone-as-bass (N tones → N inversions), each remaining
  tone stacked ascending with octave wrap, bass anchored at the lowest pitch ≥ `floorAbs`.
  For any inversion holding a `fifth` not already on top, also emit a **spread-the-5th
  variant** that lifts the 5th just above the current top voice — the open-voicing move
  that de-clusters a `5↔color` pair while leaving the color tone in place. Generate at two
  octave anchors (`floorAbs`, `floorAbs + 12`) to widen the search. Each candidate is
  register-normalized (while the top voice exceeds `ceilAbs`, transpose the whole grip
  down an octave). Bound: ~20 candidates per chord.

- **Filter (hard invariants).** Reject any candidate where (a) two adjacent voices both
  below `lilThresholdAbs` (C4) are closer than `minLowIntervalSemitones` (a minor third) —
  the anti-mud spacing rule; or (b) the highest or lowest voice is a `color` tone, when
  the chord has any non-color tone (the §1.3 rule). If filtering empties the set
  (degenerate chord), fall back to the floor-anchored ascending stack so there is always
  audible sound.

- **Score and select.** Among survivors, minimize a weighted cost combining voice-leading
  distance to the previous chord, distance from a register center, total span, and a mild
  penalty on 5th-in-bass (2nd-inversion) grips. A deterministic tie-break (lower bass
  pitch, then lexicographic note order) guarantees stable, repeatable selection.

The weights live as **named, documented, adjustable constants**
(`STRUM_VOICING_SCORE_WEIGHTS`, plus `REGISTER_CENTER`): `W_LEAD` dominates once a
previous chord exists so the comp glides; `W_CENTER` keeps the grip in a guitar-real
band around C4; `W_SPAN` mildly prefers compact grips; `W_BASS_FIFTH` discourages
5th-in-bass when a root/3rd bass is available; `REGISTER_CENTER` (≈A3) is the single
register dial. These were eyeballed against real output and tuned by ear — the
constraint invariants are property-tested across all qualities, while the *exact* grip
is intentionally **not** pinned (the register emerges from tuning). **[spec]/[internal]**

### 1.5 Why this closes the latent voice-leading gap

Because every scored candidate has already passed the spacing and color-internal filters,
voice leading can never reintroduce a low cluster — it only chooses among already-valid
voicings. This is the structural fix for the `getNearestInversion` crunch: inversion
enumeration is re-adopted *with* spacing/register/color constraints rather than without
them. `getNearestInversion` itself is left unmodified; it remains the funk/bossa fallback
for qualities lacking a hand-tuned grip. A future consolidation could retire it once
`buildVoicing` is the single inversion-and-voice-leading authority. **[spec]/[internal]**

A free win falls out of inverted grips: a 3rd-in-bass voicing stops doubling the
bassline's low root, de-mudding the low end further. **[spec]/[convention]**

---

## 2. Scored close-voicing fallback (the visual overlay's grip picker)

This domain belongs to the **fretboard overlay**, not the audio path — but it shares the
same engineering DNA (a pure, position-agnostic scorer) and is the place where "no full
shape exists, so borrow a close grip" is decided. Shipped in **#524 (full-mode voicing
fallback)**. The audio engine does **not** consume this scorer; they are independent.
**[spec]/[internal]**

### 2.1 The problem — gaps and clutter in Full mode

In `full` voicing mode the connector source only knows the CAGED `FULL_CHORD_TEMPLATES`,
which exist for ~10 of the 15 qualities. For the rest (`aug`, `6`, `m6`, `mMaj7`, `5`) the
only bridge to a grip is the close-voicing fallback, which had three defects: (1) inside a
CAGED/3NPS box it returned **every** close grip that fit, rendering 2–3 overlapping grips
with crossing connectors; (2) in **Scale Pattern None** the fallback was gated on having
an active position, so those chords rendered **zero** connectors (the user-reported bug);
and (3) **power chords** (`5`, a 2-note dyad) had no path in *any* mode because
`closeVoicings` rejected anything under 3 voices. All three are the same machinery and
share one foundation — a pure grip scorer — so they were co-designed to avoid building the
scorer too narrow. **[spec]/[internal]**

### 2.2 The scoring model — playability factors only

`scoreCloseVoicing(voicing)` (lower = better) is computed purely from `voicing.notes`
(each note's `stringIndex` / `fretIndex`) — **no polygon, no position, no string set.**
That purity is what lets the no-position case (§2.3) reuse it. The cost model uses the
well-established playability factor set from the GA-tablature and A\* fingering literature
**[spec]**:

- **`W_SPAN` (3)** × fret span over fretted notes — wide stretches hurt most.
- **`W_FRETTED` (1)** × count of fretted notes — fewer is easier.
- **`W_COMPACT` (1)** × sum of |fret − mean fret| — reward grips clustered at one hand
  position.
- **`W_HIGHNECK` (0.5)** × max(0, topFret − 7) — mild lower-neck preference.
- **`−W_OPEN` (1.5)** × open-string count — reward open strings.

Weights are named, documented, hand-tuned constants (`CLOSE_VOICING_SCORE_WEIGHTS`). The
**deterministic tie-break** on equal cost is: lower `topFret`, then lower lowest
`stringIndex` — guaranteeing stable, repeatable selection (the same contract the audio
scorer follows). **[spec]/[convention]**

### 2.3 String-set selection and neck spread

Two selection paths consume the scorer:

- **In an active CAGED/3NPS position:** the selectors keep their strict containment filter
  (every note inside the polygon), then sort survivors best-first by `scoreCloseVoicing`
  and render only `ranked[0]` — **one best grip per position** instead of every fit. This
  kills the clutter.
- **With no active position (Scale None, one-string, two-strings):** there is no polygon to
  bound candidates, so selection leans entirely on the score. `selectNeckSpread` sorts
  best-first, then **greedily accepts a grip only if its fretted-fret window doesn't
  overlap an already-accepted grip beyond a small tolerance** (`NECK_SPREAD_OVERLAP_TOLERANCE`,
  1 fret). The result is a non-overlapping spread of best grips up the neck — no crossing
  connectors — mirroring how Full mode already spreads multiple full shapes across the neck
  for CAGED-able chords.

The **string-set picker** (the user's "browse alternatives" axis) stays position-scoped
and unchanged; it does not surface in the neck-spread path, where `effectiveStringSetAtom`
is all-six in Full mode anyway and the spread itself is the browse experience. This honors
the information-visualization principle the visual-language doc also follows: **never paint
every element at full salience at once** — no mainstream guitar tool (Chord Atlas, Chord!,
Oolimo, JGuitar, ChordBank) overlays multiple full grips; they render one at a time or use
small multiples. **[spec]/[convention]**

### 2.4 Power chords as first-class 2-note grips

Relaxing the `closeVoicings` voice-count gate from `< 3` to `< 2` brings power chords into
the system as 2-note dyads (root + 5th on adjacent string sets). Only `5` has two members,
so nothing else is affected; the rest of `closeVoicings` (2-string windows, span/octave
logic) was already note-count-agnostic. They flow through both Close mode and the widened
Full-mode fallback with no extra plumbing — the connector layer is N-agnostic, so a 2-point
connector is simply a single line. A doubled-root 3-note power chord was deferred (the
engine doesn't produce doubled-root voicings); the 2-note grip is the MVP. **[spec]/[convention]**

---

## 3. Audio engine principles

FretFlow has two distinct audio paths; keep their roles separate. **[internal]**

- **`GuitarSynth` singleton** (`src/core/audio.ts`, Web Audio API) — the low-latency path
  for direct, interactive note triggering (tapping a fret, picking a chord). It is a single
  shared instance so all sounding notes share one audio graph and one master output; this
  avoids per-note context churn and keeps interactive latency low. **[internal]**

- **Tone.js progression playback** (`src/progressions/` + the engine in
  `src/progressions/audio/`, driven by `src/hooks/useProgressionAudioPlayback.ts`) — the
  scheduled path that realizes a whole progression: strum, bass, drums, and genre-specific
  comp layers, assembled by `buildAllLayers` and played on Tone.js's transport. This is the
  path the voicing engine of §1 feeds. **[internal]**

Durable principles that outlive any single spec:

- **Timing is transport-relative.** Progression layers are scheduled against the Tone.js
  transport (tempo, time signature) rather than wall-clock timers, so tempo changes and
  loop boundaries stay sample-accurate and layers stay in phase. **[internal]**
- **Register and ring-out are bounded.** Voicings are normalized into a comp register
  (≈C3–C5) before they sound (§1.4), and sustain/ring-out is shaped per layer so a strummed
  chord rings while a muted scratch or staccato stab decays quickly — the register clamp and
  the per-layer envelope together keep dense progressions from turning to mud in the low end
  or smearing across chord changes. **[internal]**
- **Voice-leading context threads between steps.** The previous step's voicing
  (`lastVoicing`) is threaded into the next `buildVoicing` call so successive chords glide;
  this is the audio analogue of the visual voice-leading motion documented in the visual-
  language reference. **[internal]/[spec]**

### 3.1 Separate AudioContexts — guitar off Tone, on raw Web Audio

The guitar synth and the progression engine each own **separate, independent
`AudioContext` instances**. This is the foundational audio isolation decision. **[spec]**

| | Guitar | Progression |
|---|---|---|
| Context | own `AudioContext`, created + owned by `audio.ts` | own `AudioContext` (`bus.ts`) |
| Framework | none — raw Web Audio | Tone.js (global context) |
| `Tone.setContext` | never touches it | binds the progression context globally |
| Scheduling | `ctx.currentTime` (zero lookahead) | Tone lookahead (transport-relative) |

**The problem it solves.** The guitar and the progression previously shared Tone's one
global `AudioContext`. The progression binds its own context via `Tone.setContext()` — a
process-wide mutation — which orphans any Tone-based guitar nodes on a stale context.
Observed symptoms: fixed ~100 ms per-tap lookahead delay, post-progression silence, a
clock mismatch between the synth's context and the global one, and a "sticky progression
role" workaround in `audioIdleSuspend.ts` that existed only to paper over the
shared-key collision. **[spec]**

**Why raw Web Audio instead of a second Tone context.** The guitar is a fire-and-forget,
tap-to-play instrument (oscillator → ADSR envelope → lowpass → master gain →
destination). It needs none of Tone's sequencing/transport machinery. Raw Web Audio was
preferred over keeping Tone with a per-node `{ context }` option because: (1) the guitar
does not need Tone — Tone is a sequencing framework and the guitar pays for it only with
global-context coupling; (2) it deletes the bug class rather than containing it — with no
shared global context, the orphaning, lookahead delay, `setContext` hijack,
sticky-role hack, and post-progression silence cannot recur; (3) it is the right tool —
the guitar was hand-rolled Web Audio before the Tone migration and raw Web Audio is the
lower-latency, fewer-moving-parts path for a tap instrument. **[spec]**

**Voice engine recipe.** Shared nodes (built once in `init()`): a `masterGain`
(linear 0.5), a `BiquadFilterNode` (lowpass, 10 kHz, Q 0.1), and a `PeriodicWave` with
sine-harmonic amplitudes `[0, 1, 0.8, 0.45, 0.22, 0.12, 0.05]` (DC term 0; six
partials). Per-note: an `OscillatorNode` at `ctx.currentTime` (zero lookahead), feeding
an ADSR `GainNode` (attack 0.006 s → 1, decay 0.55 s → sustain 0.02, release 0.3 s
after 0.5 s note duration). Max polyphony 12; at the cap, new notes are silently
skipped. **[spec]**

### 3.2 The chord layer is piano-only (synthesized guitar dropped)

The progression chord layer plays **piano poly patches only** (`chord-grand-piano`
everywhere; `chord-epiano` for Jazz). There is no chord-instrument selector and no strum
voice. **[spec]**

**Why.** A synthesized strummed guitar was attempted twice and dropped: an additive
`Tone.Synth` pluck (rich partials + full-spectrum EQ + chebyshev warmth) read as "saturated
and muddled… loose thick strings" — chebyshev waveshaping on a 4–6 note polyphonic chord
produces intermodulation distortion, and a low-band EQ boost booms the stacked chord tones;
a Karplus-Strong rebuild (`Tone.PluckSynth` + per-voice velocity VCA) got closer but
produced a persistent periodic "GSM buzz" artifact and never achieved a convincing body.
After six listening rounds the decision was to stop pursuing guitar **synthesis** entirely:
the piano is the pedagogical baseline for trying progressions and playing over, and a
future guitar would come back as **real samples** (e.g. `Tone.Sampler`), not synthesis.
Hard-won synthesis lessons, recorded so they aren't relearned: never put a wet waveshaper on
a polyphonic chord bus; `PluckSynth` ignores `triggerAttackRelease` velocity (needs a VCA);
KS `attackNoise < 1` partially fills the delay line and the circulating noise-chunk +
silence gap *is* a pulse-train buzz at the note's pitch. **[spec]**

**What was removed.** The Strum/Piano/Organ dropdown, `progressionChordInstrumentAtom`,
`GenreStyle.chordInstrument`, the strum voice (`strumVoice.ts`, `string.ts`), the strum and
organ patches, `ChordFamily`, `chordAlt`/`chordAltMix` + `resolveMixForInstrument`, and the
`direction` field on `ChordHit` (an up/down-stroke concept only the strum voice consumed).
Patterns keep rhythm, velocity, and articulation — `muted`/`root`/`stab` durations are
honored by the poly voice, so ghost strokes read as short piano blips. **[internal]**

**Shuffle backbeat accent (kept).** The Blues `shuffle-comp` pattern is swung eighth-notes
(full chord on each beat, soft short chord on each "&") with the accents on the **2 and 4**
(beats 1 & 3 in the zero-based `beat` field) so the comp locks with the snare backbeat — a
front-weighted accent (loudest on 1 & 3) fought the snare and read as "not feeling like a
shuffle." This applies to piano comping just as it did to the strum. **[spec]**

**Piano-only polish (follow-up pass).** Three durable decisions from the first listening
round after the pivot: **[spec]**

- **No "muted" ghost articulations in piano genre defaults.** The 0.06s muted choke is a
  guitar concept; on piano it reads as a click (and as machine-gun clicks in funk's woven
  ghost 16ths). `shuffle-comp`'s "&" hits became plain soft hits (the patch's short
  duration = real swung eighths) and `funk-scratch` was reduced to its four-stab skeleton
  (root on 1, stab on 2, color-stabs on the & of 3 and & of 4) — drums + bass carry the
  16th-note motion.
- **Jazz comps rootless.** `jazz-comp` sets `voicing: "rootless-jazz"`, reusing the bossa
  Type-B builder (7-9-3-5, mid register) — the walking bass owns the root, so the piano
  comps like a jazz pianist instead of stacking root-position chords. Jazz's buses also sit
  ~2 dB under the other genres (chord/bass −4, drums −5): its gentle master compressor
  (threshold −20, ratio 2.5) passes more dynamics than the other genres' glue, which made
  jazz read as the loudest genre.
- **Backing-track UI exposes only Genre.** Chord/bass/drum pattern pickers and the swing
  slider were removed from the Inspector — patterns and swing are properties a genre
  bundles, not user knobs. The atoms remain (genre application writes them); the transport
  chord toggle's icon is a piano (and the freed guitar icon now marks the bassline).

---

## 4. Backing-track variation & humanizer

Shipped in **#562 (backing-track variation)**. Two independent tiers; either can be tuned without touching the other.

### 4.1 Structural variation (macro-phrasing)

`ChordVariation` / `BassVariation` mirror the existing `DrumVariation` model: each specifies a `barInterval` and optional `barPhase`, gated by the shared `variationFiresOnBar` predicate.

**Substitution semantics — drums additive, chords/bass substitutive:**
- **Drums** — additive: a fill *layers on top* of the base groove (unchanged from pre-variation behavior).
- **Chords and bass** — substitutive: a firing variation *replaces* the base bar's hits for that bar. When no variation fires, the base plays unchanged. When two substitutive variations target the same `absoluteBar`, catalog order wins (first entry fires). **[spec]**

**Genre coupling via `GenreStyle` authoring.** Sync fills are guaranteed by data, not runtime wiring — a genre bundles chord/bass/drum variations with matching `barInterval` / `barPhase` so they fire on the same bar. Consistent with how `drumVariations` already worked; no cross-instrument coupling primitive was added. **[internal]**

**Density selection — deferred.** Sparse/Normal/Busy tiers and intro/end-of-progression section detection are a separate subsystem with no data model in the catalog. **[internal]**

### 4.2 The safe humanizer

Extends `applyJitter` in `src/progressions/audio/humanize.ts` (Mulberry32-seeded, deterministic). The existing velocity jitter (±10% chord/bass, ±5% drums) and micro-timing jitter (±15ms chord/bass, ±5ms drums) are unchanged. Two additions: **[spec]**

**Groove lock.** Integer beats (`beat % 1 === 0`, meter-agnostic) receive **reduced** timing jitter (~40% of full, ≈6ms when full is 15ms); off-beats receive full jitter. Not zero on integers — zero reads as machine-quantized. Reduced holds the structural pulse while keeping the track alive, and composes with the existing swing offset. Velocity jitter is unaffected by beat position.

**Probabilistic ghost dropping.** A hit may be dropped entirely via a separate `shouldDropHit(velocity, seed)` predicate (not bundled into `applyJitter`'s return type, to keep the drop logic independently testable):
- Computed from the **authored (pre-jitter) velocity** so a ±10% jitter can never push a borderline ghost across the threshold.
- Hard threshold: velocity **< 0.4** → flat **~12%** drop chance; velocity **≥ 0.4** → **never** dropped. No interpolation — this skips ghost strokes only, not real notes.

**Exclusions (hard rule).** `metronome` and `chordOnsets` events are **never** dropped or jittered. Metronome events are the click reference; `chordOnsets` drive React state writes and bass lead-in gating. Only `chordStrums`, `bass`, and `drums` are humanized. **[spec]**

---

## 6. Open questions / deferred

This section preserves forward-looking proposals whose source specs are **drafts that
never shipped.** They are recorded here so the ideas — and the open questions that gate
them — survive deletion of those drafts. Neither item below has been built.

### 6.1 Exposed voicing knobs as user controls *(UN-BUILT)*

*Source: `2026-06-03-expose-voicing-knobs-design.md` (draft, not approved).*

The strum engine's most sonically impactful constants are hardcoded module values in
`src/progressions/voicingEngine.ts` — `REGISTER_CENTER` and `STRUM_VOICING_SCORE_WEIGHTS`
(`lead`, `center`, `span`, `bassFifth`). These shape how a progression *sounds* arguably
as much as the chord choices do. The proposal is to surface the high-impact ones as
user-facing controls mapped to **intuitive musical language**, not raw weights:

- **Tier 1 (ship first):** *Voicing register* (Low / Mid / High → `REGISTER_CENTER`) — the
  single most audible knob; and *Voice leading* (Smooth ↔ Anchored → the `lead ÷ center`
  ratio), trading glide for register stability.
- **Tier 2 (advanced, behind a disclosure):** *Voicing spread* (Compact ↔ Open → `span`)
  and *Inversion preference* (allow 5th-in-bass → `bassFifth`).

Architecture sketch: move the constants into config (extend `VoicingPreset` or add a
sibling `VoicingConfig`, threaded through the existing `buildVoicing` preset argument and a
new `voicingConfig` on `BuildAllLayersInput`), back it with a persisted `voicingConfigAtom`
read by `useProgressionAudioPlayback`, and add a "Voicing" subsection to the sound controls
using existing primitives.

**Gating open questions (unresolved):**
- **State scope** — global default, per-progression (travels with a saved progression), or
  per-genre? Likely global default *plus* optional per-progression override.
- **Presets vs. raw sliders** — labelled presets ("Mellow / Bright / Smooth") as the
  primary UX, with raw knobs behind an advanced disclosure (four interacting weights are
  easy to misuse). Recommendation: presets primary.
- **Which knobs are worth exposing at all** — `REGISTER_CENTER` and the lead/center trade
  are clearly audible; `span` and `bassFifth` are subtler and might fold into presets only.
- **Defaults must come from the tuning pass** — the Tier-1 label→value mappings can't be
  fixed until the inversion engine's defaults are tuned by ear.
- **Funk/Bossa annotation** — these controls apply to the **default strum path only** (the
  funk/bossa color builders ignore them). Open question: disable the controls, annotate them
  as "default-strum genres only," or leave them inert when a funk/bossa genre is active?
  Avoid implying they affect funk/bossa when they don't.

**Status:** The dependency — the inversion strum engine (§1) — **shipped (#521)**, but knob
exposure is **entirely un-built**: the constants remain hardcoded module values; there is no
config type, atom, persistence, or UI.

### 6.2 Funk / Bossa voicing migration onto the unified engine *(UN-BUILT)*

*Source: `2026-06-03-funk-bossa-voicing-migration-design.md` (draft, not approved).*

Two bespoke, rootless color builders still live standalone in
`src/progressions/progressionAudio.ts`: `buildFunkColorVoicing` (hand-authored
`FUNK_COLOR_TONES` — e.g. funk major voices 3/6/9 with **no ♭7** so a tonic isn't turned
dominant) and `buildBossaColorVoicing` (fixed Type-B 7-9-3-5 grips from `BOSSA_COLOR_TONES`,
transposed down until the top note ≤ C5). The proposal is to migrate both onto the unified
`buildVoicing` engine by adding an optional **`colorTones` field** to `VoicingPreset` (a
per-quality map of semitone offsets above the root that *replaces* `CHORD_DEFINITIONS`
member selection when present) plus two new presets, `FUNK_PRESET` and `BOSSA_PRESET`. The
payoff is removing three parallel copies of "place tones, dodge mud, normalize register"
logic.

**This is explicitly not a pure refactor** — the bespoke tables encode voicing-specific
tone choices the generic engine doesn't derive from members, so output will likely differ
and migration is a *re-voicing with acceptance criteria*, not a byte-for-byte move.

**Four gating open questions (unresolved):**
- **Parity vs. improvement** — is the goal *bit-identical* output (any diff is a bug) or
  *equivalent-or-better* (accept reviewed diffs)? Likely answer: equivalent-or-better with
  **A/B sign-off from the audio owner**.
- **Voice ordering** — the bossa Type-B shape is a specific inversion (7 on the bottom); the
  engine sorts by pitch class ascending and may not preserve that bottom voice. May need a
  preset flag to pin a given bottom voice.
- **Fallback for absent qualities** — with `colorTones` as an override-only map, qualities
  absent from the table fall through to normal member selection in the engine; is that the
  desired fallback, or should it stay `resolveChordVoicing` as today?
- **Is the consolidation even worth it** — three small, working, well-commented builders vs.
  one engine with a branch. If diffs are accepted, the migration risks re-tuning hand-crafted
  grips for a modest DRY win. The draft does **not** advocate for it — it documents how it
  would be done and what it costs.

**Recommended test strategy if ever pursued:** characterize → migrate → diff → accept —
snapshot today's builder outputs across all qualities × a root spread (incl. a flat-key
root), run the same inputs through the presets, then classify each diff as identical /
acceptable improvement / regression, with carried-over invariant tests (no sub-minor-third
cluster below C4, top voice ≤ C5, rootless) and a manual A/B listen.

**Status:** **Entirely un-built** — there is no `colorTones` field on `VoicingPreset`, no
`FUNK_PRESET` / `BOSSA_PRESET`, and the two builders remain standalone in
`progressionAudio.ts`.

---

## 7. Provenance

This document consolidates the grounding from the following specs, all under
`docs/superpowers/specs/`. SHAs let each be re-read from git history with
`git show <sha>:docs/superpowers/specs/<file>`.

**Shipped:**
- `2026-06-01-audio-voicing-engine-design.md` — SHA `83e8cdee` — the original rule-based
  audio voicing engine: tone selection / drop-priority, the `VoicingPreset` / `STRUM_PRESET`
  shape, the anti-mud spacing rule, register normalization, and the single `buildAllLayers`
  integration point.
- `2026-06-03-strum-inversion-voicing-design.md` — SHA `ef93f7c1` — supersedes the original
  placement core: the color-tones-internal rule and the generate → filter → score inversion
  engine (shipped #521), with the `STRUM_VOICING_SCORE_WEIGHTS` / `REGISTER_CENTER` constants.
- `2026-06-03-full-voicing-fallback-design.md` — SHA `759634c3` — the scored close-voicing
  fallback (shipped #524): `scoreCloseVoicing`, per-position best grip, neck-spread for
  position-less patterns, and power chords as 2-note dyads.
- `2026-06-08-backing-track-variation-design.md` — the variation & humanizer design (shipped
  #562): structural variation semantics (additive drums / substitutive chord+bass), groove
  lock, ghost dropping, genre-coupling via `GenreStyle`, and humanizer exclusions (§4).
- `2026-06-09-separate-audio-contexts-design.md` — SHA `a540c046` — the separate-contexts
  decision: guitar off Tone onto raw Web Audio with its own `AudioContext`, voice engine
  recipe, and rationale for decoupling from Tone's global context (shipped #584) (§3.1).
- `2026-06-10-blues-shuffle-strum-realism-design.md` — the eighth-note Blues shuffle strum
  (`shuffle-comp`), the Blues strum-guitar default, and the per-genre `chordAlt` secondary
  chord patch with family-matched voice resolution (§3.2).

**Draft (never shipped — content preserved in §6):**
- `2026-06-03-funk-bossa-voicing-migration-design.md` — SHA `ef93f7c1` — see §6.2.
- `2026-06-03-expose-voicing-knobs-design.md` — SHA `ef93f7c1` — see §6.1.
