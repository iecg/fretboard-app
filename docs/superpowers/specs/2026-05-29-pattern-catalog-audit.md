# Backing-Track Pattern Catalog Audit

**Status:** Audit complete — findings + prioritized fix checklist below.
**Date:** 2026-05-30 (audit pass); supersedes the 2026-05-29 proposal.
**Scope:** `src/progressions/audio/patterns.ts` (chord/bass/drum catalogs + variations),
`genres.ts` (genre→pattern wiring), with cross-checks against `buildAllLayers.ts`,
`drumKit.ts`, and `humanize.ts`.

---

## 1. Goal

Before moving to generative content (Slices E/F), confirm the static catalogs are
musically authentic, idiomatically correct per genre, and that the engine actually
consumes the expression metadata the catalog declares. High-quality static patterns
remain essential as the "Eco" tier baseline and as generative fallback seeds.

This document is the **output of the audit**: a structured, prioritized checklist.
Each item notes the file/location and is sized for an independent commit.

---

## 2. What Slice 1 already fixed (baseline)

The targeted pass (shipped #483) already addressed the worst offenders, so this
audit excludes them as done:

- `funk-syncopated` bass — ghosts, octave pop, b7, all staccato. ✅
- `pedal` bass — staccato accented eighth pulse. ✅
- `walking` bass — legato. ✅
- `jazz-ride` drums — accented spang-a-lang + feathered four-on-the-floor kick. ✅
- `jazz-comp` chords — staccato Charleston with anticipation. ✅
- Bass `articulation` field + `flat-seventh` role threaded end-to-end. ✅
- Per-genre mix rebalance (jazz ride seated behind front line; funk bass forward). ✅

`applyJitter` humanization (time + velocity) and `swing` are confirmed applied in
`buildAllLayers.ts`, so per-hit stiffness from quantization is already mitigated
engine-wide.

---

## 3. Findings

### 3.1 CRITICAL — Structural / wiring gaps

These are the highest-leverage issues: existing catalog features that the engine
never exercises because nothing is wired to them.

**F1. Drum variations are defined but never fire (no fills anywhere).**
`DRUM_VARIATIONS` defines `fill-every-4`, `open-hat-and-of-4`, and `crash-bar-1`,
and `buildAllLayers.ts:132–138` honors them (folds variation hits into the drum
stream). The selected set comes from `progressionDrumVariationsAtom`, which is
sourced from `genre.drumVariations` (`progressionAtoms.ts:284`). **But every entry
in `GENRE_STYLES` ships `drumVariations: []`** (`genres.ts:16–59`), and there is no
UI to populate it. Net effect: no genre ever plays a fill, crash, or open-hat
accent — every track is a strict 1-bar loop. This is the single biggest "drum
machine stiffness" contributor and the cheapest to fix (data wiring, no engine
change).
- *Caveat:* `barInterval` is declared on `DrumVariation` but **not** read by
  `buildAllLayers.ts` — variation hits currently fold into *every* bar, not every
  Nth bar. So a naive `fill-every-4` assignment would fill *every* bar. Honoring
  `barInterval` needs the absolute-bar-index from Slice 2; until then, only
  per-bar-safe variations (e.g. `crash-bar-1` style accents) wire cleanly. This
  promotes the "real fills" portion of F1 toward Tier C.
- *Fix:* see A1 (per-bar-safe wiring now) + C-tier (true phrase fills in Slice 2).

### 3.2 HIGH — Idiomatic accuracy of specific patterns

**F3. `bossa` drum pattern is not a real bossa (no clave).**
`bossa` (`patterns.ts:286–301`) is a generic kick-on-1-and-3 with snare backbeat
and straight-8th hats — it does not use the 2-bar bossa clave, which is the
defining feature of the style. Authentic bossa needs a cross-stick/rim clave
voice over a syncopated "heartbeat" kick. **This is correctly deferred to Slice 2**
(phrase-aware), because clave is inherently a 2-bar pattern and the current
scheduler loops 1 bar. Flagging here so it is not mistaken for "audited OK."
- *Action:* leave as-is for this slice; tracked by `phrase-aware-multibar-variation`.

**F4. `funk` drum snare lacks 16th-note ghost-note vocabulary.**
`funk` (`patterns.ts:314–345`) has full 16th hats (good) and a single ghost snare
at `beat 1.5`, but real funk leans on a denser ghost-note snare lattice (soft 16th
ghosts around the backbeat). Currently the snare is backbeat + one ghost. Add 2–3
more low-velocity (≤0.25) ghost snares on 16th offbeats to interlock with the hats.

**F5. `bossa-nova` genre bass uses `arpeggiated`, not a bossa bassline.**
`genres.ts:53–58` wires bossa to the generic `arpeggiated` bass. Authentic bossa
bass is a root–fifth (or root–b7) tied to the surdo/clave pulse on beats 1 and the
"and" of 2, not a 4-note up-arpeggio. Lower priority than the drum clave but part
of the same overhaul — fold into the Slice 2 bossa work.

### 3.3 MEDIUM — Dynamics & polish

**F6. `arpeggiated` and `root-fifth` bass have no `articulation`.**
Post–Slice 1, walking/pedal/funk carry articulation but `root-fifth`,
`arpeggiated`, and `shuffle` still omit it (fall back to patch-default ring).
`arpeggiated` (ballad) wants `legato`; `shuffle` (blues) wants a touch of
`staccato` bounce. Cheap expressiveness win.

**F7. Several drum patterns sit at uniform velocities.**
`blues-shuffle` snare is `velocity: 1` on both 2 and 4 with no ghosting; `pop` and
`rock` are reasonable but the hats are the shared `EIGHTH_HATS` constant across
rock/pop/blues/bossa — i.e. four genres share one identical hi-hat dynamic curve.
Consider per-genre hat accent maps (e.g. blues shuffle wants a triplet-feel hat,
not straight 8ths — though swing partially compensates).

**F8. `EIGHTH_HATS` reuse hides genre identity.**
Rock, pop, blues-shuffle, and bossa all reference the same `EIGHTH_HATS` array.
Not wrong, but it flattens genre distinction. Low priority; revisit if F7 is taken.

### 3.4 LOW / NOTES

- **N1.** `ride.bell` option exists in `drumKit.ts` (`RideOptions.bell`) but is not
  wired into the Tone voice — preserved for call-site compat. Fine to leave; note
  for future ride-bell shading.
- **N2.** `crash-bar-1` variation reuses the `ride` voice for the crash (no
  dedicated crash voice). Acceptable synthesis shortcut; a real crash voice is a
  Slice D (samples) concern.
- **N3.** Chord pattern density looks healthy overall — `jazz-comp`, `shuffle-comp`,
  and `ballad-whole` all leave space; no over-dense offenders found.

---

## 4. Prioritized fix checklist

Ordered by leverage (impact ÷ effort). A–B are this audit's recommended slice;
C–D fold into the Slice 2 bossa/phrase work.

### Tier A — wiring (no engine change, highest impact)
- [ ] **A1 (F1):** Wire **per-bar-safe** variations per genre in `genres.ts`. Only
      `open-hat-and-of-4` and `crash-bar-1` fold cleanly into every bar today
      (they read as a consistent groove accent, not a fill). Suggested:
      funk/pop → `["open-hat-and-of-4"]`; rock → `["crash-bar-1"]` reads as a
      bar-1 ride accent. **Do NOT assign `fill-every-4` yet** — `barInterval` is
      not honored, so it would fill every bar (see F1 caveat → C-tier). Add a
      `genres.test.ts` assertion that every referenced id resolves via
      `getDrumVariation`.
- [ ] **A2 (engine):** Honor `DrumVariation.barInterval` in `buildAllLayers.ts`.
      Currently variation hits fold into every bar regardless of `barInterval`.
      This is the prerequisite for real `fill-every-4` turnarounds. Needs the
      absolute-bar index — **belongs with Slice 2** (phrase-aware scheduler), not
      this slice. Listed here so the gap is tracked, not as Tier-A scope.

### Tier B — cheap dynamics wins
- [ ] **B1 (F6):** Add `articulation` to `arpeggiated` (`legato`) and `shuffle`
      (`staccato`) bass patterns. Unit-test the field is present.
- [ ] **B2 (F4):** Add 2–3 ghost snares (vel ≤0.25) on 16th offbeats to the `funk`
      drum pattern. Audition for interlock with the hats.

### Tier C — genre overhauls (defer to Slice 2, needs 2-bar phrase)
- [ ] **C1 (F3):** Authentic `bossa` drums — cross-stick/rim clave voice +
      syncopated kick. Requires the new drum voice and the phrase-aware scheduler.
- [ ] **C2 (F5):** Bossa bassline — root–fifth/​b7 tied to clave, replacing
      `arpeggiated` for the `bossa-nova` genre.

### Tier D — optional polish
- [ ] **D1 (F7/F8):** Per-genre hi-hat accent maps to break up the shared
      `EIGHTH_HATS` reuse (esp. blues triplet-feel hats).

---

## 5. Recommendation

Take **A1 + Tier B as a single "audit fixes" slice** — all low-risk, data/logic-
only, unit-testable, no scheduler change. A1 gives each genre its first
per-bar groove accent (open-hat / crash), and Tier B adds the missing bass
articulations and funk ghost-snare vocabulary. Most audible improvement per line
changed, zero blast radius.

**A2 + Tiers C–D belong to the Slice 2 phrase-aware work** (`2026-05-29-phrase-
aware-multibar-variation-design.md`): honoring `barInterval` for real turnaround
fills (A2), the bossa clave overhaul (C1/C2), and per-genre hat maps (D1) all
either need the absolute-bar index or the 2-bar scheduler.

**Verified already-wired (no action):** strum `direction` (up/down) reverses
voicing order with a per-note lag in `strumVoice.ts:11`; `swing` and `applyJitter`
humanization are applied in `buildAllLayers.ts`; `openHat`/`ride` voices are
consumed. These were checked against the engine, not assumed.

Generative Slices E/F remain downstream; this audit confirms the static baseline
is close — once Tier A/B land, the only remaining authenticity gap is bossa, which
is structural (Slice 2), not content.
