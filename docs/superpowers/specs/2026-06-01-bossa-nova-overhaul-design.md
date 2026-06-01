# Bossa-Nova Overhaul (Slice 2 §3.5)

**Status:** Design — approved in brainstorming 2026-06-01.
**Date:** 2026-06-01
**Parent slice:** `2026-05-29-phrase-aware-multibar-variation-design.md` (Slice 2 §3.5).

This spec implements the bossa-nova overhaul that Slice 2 deferred: an authentic
2-bar clave drum identity (with a new cross-stick / rim voice), a bossa bassline,
and a syncopated partido-alto chord comp — phrased together against the same
clave. It resolves the parent spec's open question on the cross-stick voice
(MembraneSynth click) and introduces a general 2-bar **pattern cell** mechanism
rather than pulling the deferred §3.3 `phraseVariants` model forward.

A user flagged the current bossa as "doesn't remind me of bossa" (2026-05-31).
The current `bossa-nova` genre uses a generic 1-bar drum beat, the generic
`arpeggiated` bass (a 4-note up-arpeggio), and `straight-quarters` chord comp —
none of which evoke bossa.

---

## 1. Goal

Make the `bossa-nova` genre's backing track sound idiomatically bossa:

- A **2-bar son-clave** played on a new **cross-stick / rim voice**, over a soft
  surdo "heartbeat" kick and straight-8th hats (no backbeat snare).
- A **root–fifth surdo bassline** replacing the generic arpeggio.
- A **syncopated partido-alto chord comp** replacing the four-even-quarters comp.

All three lock to the same clave cell. The enabling structural change is a
general, opt-in **2-bar pattern cell** mechanism (`bars` field), which leaves
1-bar patterns byte-identical and leaves the deferred §3.3 chord-rhythm model
free to be designed on its own terms later.

## 2. Scope

**In scope**

- A `bars?: number` field (default `1`) on `ChordPattern`, `CatalogBassPattern`,
  and `CatalogDrumPattern`, plus a pure `sliceCellToBar` helper and its wiring
  into `buildAllLayersAsync`.
- A new `crossStick` drum voice: `DrumVoice` type, `CatalogDrumPattern.crossStick`
  array, `collectDrumHits` case, `scheduleCrossStick` (MembraneSynth click) in
  `drumKit.ts`, engine re-export, playback dispatch case, and a
  `DrumVoiceParams.crossStick` optional override.
- A rewritten 2-bar `bossa` drum pattern, a new `bossa` bass pattern, a new
  `bossa-comp` 2-bar chord pattern.
- `bossa-nova` genre re-wiring in `genres.ts`.
- An optional `crossStick` override on the `kit-bossa` drum kit patch.
- Unit tests for all of the above + a manual ear audition.

**Out of scope**

- The deferred §3.3 phrase-aware chord rhythm (`phraseVariants`), §3.4
  end-of-phrase bass walk, and the `phraseLengthBars` input param. The comp's
  anticipations here are baked into a fixed 2-bar cell, not derived from
  chord-change lookahead.
- Any change to other genres. Every non-bossa pattern keeps `bars: 1` and is
  byte-identical to today.
- New drum voices beyond `crossStick`.
- UI exposure of phrase length / cell length. The mechanism stays
  engine-internal (genre-driven), consistent with Slice 1 and §3.2.

## 3. Architecture: the 2-bar pattern cell

### 3.1 Current constraint

Every pattern today is 1-bar: `repeatPatternToBeats` repeats a pattern across a
beat window in `beatsPerBar`-sized steps, dropping any `hit.beat >= beatsPerBar`.
`buildAllLayersAsync` already loops one bar at a time and tracks a monotonic
`absoluteBar` (never reset per step — established by the scheduler spec, PR #491).

### 3.2 The `bars` field

Add an optional `bars?: number` (default `1`) to `ChordPattern`,
`CatalogBassPattern`, and `CatalogDrumPattern`. When `bars > 1`, the pattern's
`hits` beats span the whole cell: `0 .. bars * beatsPerBar` (e.g. `0 .. 8` for a
2-bar pattern in 4/4). Beat `0` is bar-1 downbeat; beat `4` is bar-2 downbeat.

### 3.3 The `sliceCellToBar` helper (`patterns.ts`)

A pure helper selects the hits for a single bar of the cell and shifts them back
to local bar-relative beats (`0 .. beatsPerBar`):

```ts
export function sliceCellToBar<T extends { beat: number }>(
  hits: readonly T[],
  cellBarIndex: number, // absoluteBar % cellBars
  beatsPerBar: number,
): T[] {
  const offset = cellBarIndex * beatsPerBar;
  return hits
    .filter((h) => h.beat >= offset && h.beat < offset + beatsPerBar)
    .map((h) => ({ ...h, beat: h.beat - offset }));
}
```

### 3.4 Wiring into `buildAllLayersAsync`

Each of the three layer loops (chord, bass, drums) currently computes its
per-bar hits with `repeatPatternToBeats(pattern.hits, eventBeats, beatsPerBar)`.
Wrap that in a branch:

- If `pattern.bars && pattern.bars > 1`:
  `sliceCellToBar(pattern.hits, absoluteBar % pattern.bars, beatsPerBar)`.
- Else: the existing `repeatPatternToBeats(...)` path, **unchanged**.

For drums, the base pattern is sliced this way; firing drum *variations* stay
1-bar (authored in `0 .. beatsPerBar`) and are merged on top after slicing, as
today. Bossa's `drumVariations` is empty, so there is no base/variation cell
mismatch to reconcile.

Multi-bar cells assume bar-unit steps (bossa progressions are bar-based). A
partial beat-unit step (`duration.unit === "beat"`) falls back to cell index `0`
for a multi-bar pattern — an acceptable edge case the bossa genre never hits in
practice.

### 3.5 Determinism, backwards-compat, known limitation

- Slicing is a pure function of `absoluteBar` + `bars` — no `Date.now` /
  `Math.random`. Same input → identical event stream across runs.
- Sliced beats are shifted into `0 .. beatsPerBar`, so the existing jitter seeds
  (`stepIndex * 10000 + bar * 100 + beat`) stay stable. `bar` is step-local, so
  the two bars of a cell get distinct seeds (distinct content, deterministic).
- Any pattern with `bars: 1` (the default) never enters `sliceCellToBar` and is
  byte-identical to today.
- **Known limitation:** if a looped progression has an **odd** total bar count,
  the clave cell phase-shifts at the loop boundary (bar N → back to
  `absoluteBar 0`). Acceptable — real clave assumes even phrases, and this
  mirrors §3.2's 4-bar-phrase fill assumption.

## 4. The cross-stick / rim voice

The cross-stick (rim-click) is the defining bossa timbre — a dry woody "tok".
Synthesized as a **short, high-pitched `Tone.MembraneSynth` click**: fully
deterministic, no noise generation (sidesteps the synchronous-noise cost that
PR #487 backed out of the bossa snare).

### 4.1 Touchpoints

1. **`sound/patchTypes.ts`** — `DrumVoiceParams` gains an optional override:
   ```ts
   crossStick?: { pitchDecay?: number; octaves?: number; envelope?: Partial<EnvelopeSpec> };
   ```
   Kits use partial overrides, so no existing kit must define it; engine
   defaults apply when omitted.
2. **`patterns.ts`** — `CatalogDrumPattern` gains `crossStick?: readonly DrumHit[]`.
3. **`buildAllLayers.ts`** — `DrumVoice` union gains `"crossStick"`;
   `collectDrumHits` pushes `pattern.crossStick ?? []` with `type: "crossStick"`.
4. **`drumKit.ts`** — new pool + `scheduleCrossStick(dest, time, options)`,
   mirroring `scheduleKick`'s structure:
   ```ts
   const DEFAULT_CROSS_STICK_ENV = {
     attack: 0.001, decay: 0.06, sustain: 0, release: 0.02,
     attackCurve: "exponential" as const,
   };
   const CROSS_STICK_DISPOSE_MS = 120; // decay ~60 ms
   // MembraneSynth: oscillator { type: "triangle" }, pitchDecay ~0.008,
   // octaves ~2, envelope DEFAULT_CROSS_STICK_ENV merged with kit override.
   // triggerAttackRelease("G4", 0.05, time, velocity); busyUntil = start + 0.12.
   ```
   `velocity <= 0` returns `NOOP_HANDLE`, as the other voices do.
5. **`progressionAudioEngine.ts`** — re-export `scheduleCrossStick`.
6. **`hooks/useProgressionAudioPlayback.ts`** — add to the drum dispatch switch:
   ```ts
   case "crossStick":
     eng.scheduleCrossStick(audio.layers.drums, audioTime, { velocity: value.velocity, kit: drumKit });
     break;
   ```
7. **`sound/instrumentPatches.ts`** — `kit-bossa` gains an optional `crossStick`
   override to tune the woody tone (engine default works standalone).

## 5. The three new bossa patterns

All beat tables are eye-tuned starting points, expected to be nudged during the
§7 ear audition (same convention as §3.2). Beats are 0-indexed quarter-note
positions; `.5` = eighth.

### 5.1 Drum clave — rewrite `bossa` in `DRUM_PATTERNS`, `bars: 2`

3-2 son clave on the cross-stick; soft surdo heartbeat kick (beats 1 & 3 each
bar); straight-8th hats both bars; no backbeat snare.

```ts
{
  id: "bossa", label: "Bossa Nova", bars: 2,
  kicks: [
    { beat: 0, velocity: 0.5 }, { beat: 2, velocity: 0.6 },
    { beat: 4, velocity: 0.5 }, { beat: 6, velocity: 0.6 },
  ],
  snares: [],
  hats: [
    { beat: 0, velocity: 0.4 }, { beat: 0.5, velocity: 0.3 }, { beat: 1, velocity: 0.4 }, { beat: 1.5, velocity: 0.3 },
    { beat: 2, velocity: 0.4 }, { beat: 2.5, velocity: 0.3 }, { beat: 3, velocity: 0.4 }, { beat: 3.5, velocity: 0.3 },
    { beat: 4, velocity: 0.4 }, { beat: 4.5, velocity: 0.3 }, { beat: 5, velocity: 0.4 }, { beat: 5.5, velocity: 0.3 },
    { beat: 6, velocity: 0.4 }, { beat: 6.5, velocity: 0.3 }, { beat: 7, velocity: 0.4 }, { beat: 7.5, velocity: 0.3 },
  ],
  crossStick: [
    // 3-side (bar 1): beats 0, 1.5, 3
    { beat: 0, velocity: 0.8 }, { beat: 1.5, velocity: 0.7 }, { beat: 3, velocity: 0.75 },
    // 2-side (bar 2): beats 5 (=bar2 beat 1), 6 (=bar2 beat 2)
    { beat: 5, velocity: 0.7 }, { beat: 6, velocity: 0.8 },
  ],
}
```

### 5.2 Bass — new `bossa` pattern in `BASS_PATTERNS`, 1-bar

Root–fifth surdo (tonic–dominant alternation), the recognizable bossa pulse.
Kept 1-bar; the clave lock comes from drums + comp. The "& of 2" push is an
audition alternative.

```ts
{
  id: "bossa", label: "Bossa Nova",
  hits: [
    { beat: 0, velocity: 1, note: "root", articulation: "legato" },
    { beat: 2, velocity: 0.8, note: "fifth", articulation: "legato" },
  ],
}
```

### 5.3 Chord comp — new `bossa-comp` pattern in `CHORD_PATTERNS`, `bars: 2`

Syncopated partido-alto: clave-locked anticipations that leave space, phrased
across the 2-bar cell.

```ts
{
  id: "bossa-comp", label: "Bossa Comp", bars: 2,
  hits: [
    // bar 1
    { beat: 0, velocity: 0.7 }, { beat: 1.5, velocity: 0.6 }, { beat: 3, velocity: 0.55 },
    // bar 2: anticipated "& of 1" push, mid-bar, and an "& of 4" lead into the next phrase
    { beat: 4.5, velocity: 0.6 }, { beat: 6, velocity: 0.6 }, { beat: 7.5, velocity: 0.7 },
  ],
}
```

## 6. Genre wiring (`GENRE_STYLES` in `genres.ts`)

Only the `bossa-nova` row changes:

| field | from | to |
|---|---|---|
| `chordPattern` | `straight-quarters` | `bossa-comp` |
| `bassPattern` | `arpeggiated` | `bossa` |
| `drumPattern` | `bossa` (1-bar) | `bossa` (2-bar rewrite, same id) |
| `chordInstrument` | `piano` | `piano` (unchanged) |
| `drumVariations` | `[]` | `[]` (unchanged) |
| `swing` | `0` | `0` (unchanged) |
| `tempoRange` / `suggestedTempo` | `[120,140]` / `130` | unchanged |

## 7. Testing strategy

**Unit (`patterns.test.ts`):**

1. `sliceCellToBar` — for a 2-bar set of hits, `cellBarIndex: 0` returns the
   `0..beatsPerBar` hits with original beats; `cellBarIndex: 1` returns the
   `beatsPerBar..2*beatsPerBar` hits shifted back by `beatsPerBar`; out-of-range
   `cellBarIndex` returns `[]`.
2. The new `bossa` drum, `bossa` bass, and `bossa-comp` resolve via their getters
   and carry the expected `bars` (`2`, `undefined`/`1`, `2` respectively).
3. The rewritten `bossa` drum pattern's `crossStick` array matches the exact
   3-2 son-clave beat layout `[0, 1.5, 3, 5, 6]`.

**Unit (`drumKit.test.ts`):**

4. `scheduleCrossStick` returns a handle with a `cancel` function, leases and
   disposes from its own pool, and returns the NOOP handle for `velocity <= 0`
   (mirrors the existing per-voice tests).

**Unit (`buildAllLayers.test.ts`):**

5. A ≥2-bar bossa step emits the bar-1 clave cross-stick hits on absolute bar 0
   and the bar-2 clave hits on absolute bar 1 (verifies cell selection + beat
   shift end-to-end).
6. Determinism: a bossa progression built twice over a ≥4-bar span yields
   identical chord, bass, and drum event streams.
7. Backwards-compat: a 1-bar-pattern genre (e.g. rock) built before and after the
   change yields an identical event stream (guards the `bars: 1` default path).

**Unit (`genres.test.ts`):**

8. `bossa-nova` references `bossa-comp` / `bossa` / `bossa` and every id resolves
   (no dangling pattern ids).

**Manual ear audition (required by parent spec §3.5):**

Play a ≥4-bar bossa progression and confirm the clave, comp, and bass read as
idiomatic bossa and lock together. Tune the §5 tables by ear; apply tweaks as
small follow-up commits.

## 8. Files touched

- `src/progressions/audio/patterns.ts` — `bars` field on three pattern
  interfaces; `sliceCellToBar`; `crossStick` on `CatalogDrumPattern`; rewritten
  `bossa` drum, new `bossa` bass, new `bossa-comp` chord patterns.
- `src/progressions/audio/buildAllLayers.ts` — `DrumVoice` `"crossStick"`;
  `collectDrumHits` case; `bars`-aware slicing in the three layer loops.
- `src/progressions/audio/drumKit.ts` — `scheduleCrossStick` + pool.
- `src/progressions/audio/progressionAudioEngine.ts` — re-export.
- `src/progressions/audio/sound/patchTypes.ts` — `DrumVoiceParams.crossStick`.
- `src/progressions/audio/sound/instrumentPatches.ts` — `kit-bossa` crossStick
  override.
- `src/progressions/audio/genres.ts` — `bossa-nova` row re-wiring.
- `src/hooks/useProgressionAudioPlayback.ts` — `crossStick` dispatch case.
- Co-located test files: `patterns.test.ts`, `drumKit.test.ts`,
  `buildAllLayers.test.ts`, `genres.test.ts`.
