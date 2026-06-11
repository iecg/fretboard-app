# Genre Mix Balance Pass

A mix-engine pass across all genres to fix loudness-balance problems surfaced by audit:
(1) chord patches differ in intrinsic loudness, so the per-genre chord bus level is only
right for the default instrument; (2) several genres have bass staged too hot; (3) there is
no way to nudge the chord level per-genre when the user switches to the non-default
instrument family.

Follows the strum-realism work (`2026-06-10-blues-shuffle-strum-realism-design.md`) and the
steel-strum +4 dB boost. Mix rationale lives in `docs/design/audio-voicing-engine.md` §3.

## Motivation

The progression mix sets level in two stages: each patch's **intrinsic volume**
(`poly.volume` for keys, per-voice `voiceVolumeDb` for strum), and the **per-genre bus**
level (`GenreMix.perInstrument.<layer>.volumeDb`). The bus level is tuned for each genre's
*default* chord instrument, but the chord patches differ by up to ~8 dB intrinsically
(grand-piano −6, epiano −7, jazz-organ −10, rock-organ −11). Consequences:

- **Switching the chord instrument breaks balance.** The fixed chord bus is only correct for
  the default patch. Most visibly, **Blues → Organ** (the `chordAlt` path just shipped) lands
  ~8 dB below the strum default, so the organ sounds weak.
- **Bass is staged too hot on several genres.** Bass sits at bus `0` on Pop, Blues, and Jazz;
  Rock's sawtooth `bass-pick` (mid-EQ +2, dense staccato pedal pattern) reads too prominent
  even at its current −2 (user-confirmed).

## Audit summary (predicted issues — validate by ear)

| Genre | Chord (patch · bus) | Bass (patch · bus) | Flagged |
|---|---|---|---|
| Pop | grand-piano · −2 | finger · **0** | bass slightly hot |
| Rock | steel-strum · −3 | **pick · −2** (sawtooth, dense pedal, mid +2) | **bass too prominent (confirmed)** |
| Blues | steel-strum · −3 (alt organ) | **upright · 0** | bass hot; **organ alt ~8 dB low** |
| Jazz | epiano · −2 | **upright · 0** | bass too forward under soft kit |
| Ballad | grand-piano · −2 | upright · −1 | likely OK |
| Funk | funk-scratch · −4 | finger · 0 | scratch possibly buried (maybe intentional) |
| Bossa | grand-piano · −3 | synth · −1 | fatsquare low end — check |

## Design

Three coordinated parts. **Every dB value below is a by-ear starting point** — the author
cannot judge loudness. The durable deliverable is the *mechanism*; the numbers are seeds the
user tunes in a listening pass afterward.

### Part 1 — Per-patch chord makeup gain (instrument-agnostic baseline)

Retune each chord patch's intrinsic volume so all **keys** patches share a common reference
and the **strum** patch sits a deliberate **+4 dB above** that reference (preserving the
strum-on-top decision). After this, the chord bus level means the same thing for any selected
instrument, and Blues → Organ is no longer undermixed.

| Chord patch | Field | Current | → Target | Note |
|---|---|---|---|---|
| `chord-grand-piano` | `poly.volume` | −6 | −6 | reference anchor (unchanged) |
| `chord-epiano` | `poly.volume` | −7 | −6 | match anchor |
| `chord-jazz-organ` | `poly.volume` | −10 | −6 | +4 — fixes Blues → Organ |
| `chord-rock-organ` | `poly.volume` | −11 | −6 | normalize (dormant, future-proof) |
| `chord-steel-strum` | `voiceVolumeDb` | −14 | −14 | already ≈ anchor +4 (unchanged) |
| `chord-funk-scratch` | — | — | unchanged | excluded (separate percussive patch) |

Reference choice: `grand-piano` (−6) is the anchor because it's the most-used poly patch and
sounds balanced in Pop/Ballad/Bossa today. Equal `volume` is an approximation of equal
perceived loudness (organ sustains vs piano decays), so these are starting points.

### Part 2 — Per-genre bus retune (within-genre balance)

| Genre | Field | Current | → Target |
|---|---|---|---|
| Rock | `bass.volumeDb` | −2 | **−5** |
| Rock | `bass-pick` patch `insert.eq3.mid` | +2 | **+1** |
| Blues | `bass.volumeDb` | 0 | **−2** |
| Jazz | `bass.volumeDb` | 0 | **−2** |
| Pop | `bass.volumeDb` | 0 | **−1** |

`bass-pick` is used only by Rock, so trimming its mid EQ affects no other genre. Ballad, Funk,
and Bossa are left unchanged in this pass (revisit by ear).

### Part 3 — Per-genre chord-family override (taste knob)

Add an optional alternate chord-bus block used when the user selects the **non-default** chord
family, so a genre can nudge (e.g.) the organ level independently of its strum default.

- **Schema:** `GenreMix` gains optional `chordAltMix?: InstrumentMix`
  (`src/progressions/audio/sound/genreMixPresets.ts`). Left **unset on every genre** initially
  → no behavior change; it is wiring for later by-ear nudges.
- **Pure resolver:** add `resolveMixForInstrument(mix, instrument): GenreMix` in
  `genreMixPresets.ts`. It returns `mix` unchanged unless `mix.chordAltMix` is set **and** the
  selected family differs from the default chord family — in which case it returns a copy with
  `perInstrument.chord` replaced by `chordAltMix`. Default family is
  `getChordPatch(mix.patches.chord)?.family`; selected family is
  `instrument === "strum" ? "strum" : "poly"` (inlined to avoid an import cycle).
- **Wiring:** in `useProgressionAudioPlayback.ts`, wrap the mix with
  `resolveMixForInstrument(mix, chordInstrument)` before both `planSignalGraph(...)` calls
  (the initial build and the genre/quality rebuild effect), and add `chordInstrument` to that
  rebuild effect's dependency array so the chord bus re-stages when the instrument changes.

`planSignalGraph(tier, mix)` is unchanged — it still reads `mix.perInstrument.chord`; the
resolver simply hands it the right chord block.

## Files changed

- `src/progressions/audio/sound/instrumentPatches.ts` — Part 1 patch volumes; Part 2 `bass-pick` mid EQ.
- `src/progressions/audio/sound/genreMixPresets.ts` — Part 2 bus levels; Part 3 `chordAltMix?` type + `resolveMixForInstrument`.
- `src/hooks/useProgressionAudioPlayback.ts` — Part 3 wiring (wrap mix at both build sites; add `chordInstrument` to rebuild deps).

## Testing

- `instrumentPatches.test.ts` — assert the keys patches share the reference volume
  (grand-piano/epiano/jazz-organ/rock-organ all −6) and steel-strum stays −14; assert
  `bass-pick` mid EQ is +1. Funk-scratch unchanged.
- `genreMixPresets.test.ts` — bus-retune regression guards (Rock bass = −5, Blues/Jazz bass =
  −2, Pop bass = −1); `resolveMixForInstrument` returns the same mix when `chordAltMix` is
  unset (all current genres) and when the selected family matches the default; returns the alt
  chord block only when `chordAltMix` is set and the family differs. Existing loudness-ceiling
  invariant stays green.
- Build + a live no-error playback smoke test (selecting each genre and toggling the chord
  instrument).
- Manual listen (the real bar): per-genre balance, and Blues ⇄ Organ parity after Part 1.

## Out of scope

- Tuning the final dB values to taste (done by ear after wiring).
- Bass/drum rebalancing on Ballad/Funk/Bossa beyond the flagged items.
- Reworking drum-kit internal voice levels.
- Populating `chordAltMix` for any genre (the field ships unset; values come later).
