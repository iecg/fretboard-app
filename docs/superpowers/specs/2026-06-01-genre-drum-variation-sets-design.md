# Genre Default Drum Variation Sets

**Status:** Design — approved in brainstorming 2026-06-01.
**Date:** 2026-06-01
**Parent slice:** `2026-05-29-phrase-aware-multibar-variation-design.md` (Slice 2).
This spec implements the **§3.2 "genre-appropriate default variation sets"
fast-follow-up** that the scheduler spec
(`2026-05-31-phrase-aware-scheduler-design.md`) explicitly deferred. The
scheduler spec shipped the *mechanism* — `variationFiresOnBar` + a monotonic
absolute-bar index in `buildAllLayersAsync` (PR #491). This spec ships the
*content*: turnaround fills / accents wired to genres, plus three new
genre-tailored variations.

---

## 1. Goal

Make each genre's backing track develop over a 4-bar phrase by assigning
genre-appropriate drum variations (turnaround fills and phrase-start accents)
to the genres that musically call for one — and author three new variations so
those turnarounds sound idiomatic (a funk ghost-snare flurry, a jazz brush
turnaround, a blues shuffle fill) rather than reusing a single rock-style snare
buildup everywhere.

## 2. Scope

**In scope**

- Three new entries in `DRUM_VARIATIONS` (`patterns.ts`): `funk-fill-4`,
  `jazz-turnaround-4`, `blues-fill-4`.
- Genre assignment changes in `GENRE_STYLES` (`genres.ts`) for pop, rock, funk,
  jazz, blues.
- Unit tests for the new variations' gating and the genre assignments.
- A manual ear audition pass per genre (the parent spec's required step).

**Out of scope**

- No new drum voices — every new variation uses existing kit voices (kick,
  snare, ride). `drumKit.ts` / `instrumentPatches.ts` are untouched.
- No bossa-nova work. The bossa drum identity is a 2-bar clave overhaul (§3.5);
  a generic fill now would only get rewritten. Bossa's `drumVariations` stays
  empty.
- No ballad fill. Ballad is intentionally sparse; a turnaround fill fights the
  mood. Its `drumVariations` stays empty.
- No phrase-aware chord rhythm (§3.3), end-of-phrase bass walk (§3.4), or
  `phraseLengthBars` input param. The fills key off each variation's own
  `barInterval`, exactly as the scheduler spec's interval+phase model intends.

## 3. Current state

The mechanism is live but underused. `DRUM_VARIATIONS` defines three
variations:

- `open-hat-and-of-4` — `barInterval: 1` (fires every bar). Assigned to pop,
  rock, funk.
- `fill-every-4` — `barInterval: 4, barPhase: 3` (snare buildup on the 4th bar).
  **Defined but assigned to no genre.**
- `crash-bar-1` — `barInterval: 4, barPhase: 0` (ride accent on the 1st bar of
  each 4-bar group). **Defined but assigned to no genre.**

Genre assignments today (`genres.ts`):

| Genre | drumVariations |
|---|---|
| pop, rock, funk | `["open-hat-and-of-4"]` |
| blues, jazz, ballad, bossa-nova | `[]` |

## 4. Engine conventions (constraints the new tables must obey)

Confirmed by reading `DRUM_PATTERNS` and `DRUM_VARIATIONS` in `patterns.ts`:

- Beats are **0-indexed quarter-note positions** in a 4/4 bar: `0, 1, 2, 3`.
- Subdivisions use decimals: `.5` = eighth, `.25` / `.75` = sixteenths.
- **No triplet subdivisions** (`.33` / `.67`) appear anywhere. Shuffle / swing
  feel is produced by the genre `swing` param applied to off-beat eighths, not
  by authoring triplet beat positions. New blues/jazz fills must therefore use
  `.5` eighths and rely on the genre swing, not hand-written triplets.
- A `DrumHit` is `{ beat, velocity }`; velocity is `0..1`.
- A variation's `pattern` is a `CatalogDrumPattern` with optional `kicks`,
  `snares`, `hats`, `openHats`, `ride` arrays.

## 5. Firing & merge model (from the scheduler spec — unchanged)

- A variation fires on absolute bar `N` when
  `N % barInterval === (barPhase ?? 0)`, via `variationFiresOnBar`.
- `absoluteBar` is monotonic across the whole progression (never reset per
  step), and only feeds the gating decision — never jitter seeds.
- On a bar where a variation fires, its hits are **merged on top of** the base
  drum pattern's hits for that bar (base + variation, both play). A busier
  turnaround bar is the intended "fill" effect.

## 6. New variations (`DRUM_VARIATIONS` in `patterns.ts`)

All three are `barInterval: 4, barPhase: 3` — they fire on the **4th bar of each
4-bar phrase** (absolute bars 3, 7, 11, …), the turnaround position. Beat tables
below are tuned-by-eye starting points and are expected to be nudged during the
ear audition (§9).

### 6.1 `funk-fill-4` — 16th-note ghost-snare flurry into the one

```ts
{
  id: "funk-fill-4",
  label: "Funk Turnaround Fill",
  barInterval: 4,
  barPhase: 3,
  pattern: {
    id: "funk-fill-4-pattern",
    label: "Funk Fill",
    kicks: [{ beat: 0, velocity: 0.9 }],
    snares: [
      { beat: 2, velocity: 0.4 },
      { beat: 2.5, velocity: 0.5 },
      { beat: 2.75, velocity: 0.4 },
      { beat: 3, velocity: 0.6 },
      { beat: 3.25, velocity: 0.6 },
      { beat: 3.5, velocity: 0.8 },
      { beat: 3.75, velocity: 0.9 },
    ],
    hats: [],
  },
}
```

### 6.2 `jazz-turnaround-4` — soft brush buildup + ride accent

Low velocities to match the jazz base pattern's brushy dynamics (snares ~0.3,
kicks ~0.15). A ride accent on beat 3 leads into the next phrase.

```ts
{
  id: "jazz-turnaround-4",
  label: "Jazz Turnaround",
  barInterval: 4,
  barPhase: 3,
  pattern: {
    id: "jazz-turnaround-4-pattern",
    label: "Jazz Turnaround",
    kicks: [],
    snares: [
      { beat: 2, velocity: 0.35 },
      { beat: 2.5, velocity: 0.4 },
      { beat: 3, velocity: 0.45 },
      { beat: 3.5, velocity: 0.55 },
    ],
    hats: [],
    ride: [{ beat: 3, velocity: 0.6 }],
  },
}
```

### 6.3 `blues-fill-4` — eighth-note shuffle fill

Eighth-note snare buildup; the blues genre's `swing: 0.33` turns the off-beats
into a triplet shuffle fill.

```ts
{
  id: "blues-fill-4",
  label: "Blues Shuffle Fill",
  barInterval: 4,
  barPhase: 3,
  pattern: {
    id: "blues-fill-4-pattern",
    label: "Blues Fill",
    kicks: [{ beat: 0, velocity: 0.9 }],
    snares: [
      { beat: 2, velocity: 0.5 },
      { beat: 2.5, velocity: 0.6 },
      { beat: 3, velocity: 0.7 },
      { beat: 3.5, velocity: 0.9 },
    ],
    hats: [],
  },
}
```

## 7. Genre assignments (`GENRE_STYLES` in `genres.ts`)

| Genre | drumVariations (new) | Rationale |
|---|---|---|
| pop | `["open-hat-and-of-4", "fill-every-4"]` | keep groove embellishment, add a turnaround fill on bar 4 |
| rock | `["open-hat-and-of-4", "crash-bar-1", "fill-every-4"]` | crash on phrase-start (bar 1), snare fill on phrase-end (bar 4) — a full 4-bar arc |
| funk | `["open-hat-and-of-4", "funk-fill-4"]` | keep groove embellishment, add the funk ghost-snare fill |
| jazz | `["jazz-turnaround-4"]` | brush turnaround (the parent spec's canonical `bar % 4 === 3` example) |
| blues | `["blues-fill-4"]` | shuffle turnaround fill |
| ballad | `[]` | unchanged — intentionally sparse |
| bossa-nova | `[]` | unchanged — defer to §3.5 clave overhaul |

`fill-every-4` and `crash-bar-1` already exist with the correct
`barInterval`/`barPhase`; assigning them is pure wiring. The phrase arc for
rock/pop is: crash on absolute bars 0/4/8…, fill on absolute bars 3/7/11….

## 8. Backwards-compat & determinism

- pop/rock/funk keep `open-hat-and-of-4` (fires every bar) — their existing
  groove is preserved; the new variations only add hits on phrase boundaries.
- ballad and bossa-nova are byte-identical to today (still empty
  `drumVariations`).
- All gating is a pure function of `absoluteBar` + each variation's
  interval/phase — no `Date.now` / `Math.random`. Same input → identical event
  stream across runs (the scheduler spec's determinism guarantee is preserved).

## 9. Testing strategy

**Unit (`patterns.test.ts` / `genres.test.ts`):**

1. `variationFiresOnBar(funk-fill-4, N)` is true exactly for `N % 4 === 3`
   (bars 3, 7, 11) and false for bars 0–2, 4–6; same for `jazz-turnaround-4`
   and `blues-fill-4`.
2. Each new variation resolves via `getDrumVariation(id)` and has a non-empty
   `pattern` (at least one hit array with entries).
3. Every id listed in each genre's `drumVariations` resolves to a real
   `DrumVariation` via `getDrumVariation` (no dangling ids) — covers all
   genres, guarding the new assignments.
4. ballad and bossa-nova have empty `drumVariations`.
5. A `buildAllLayers` determinism check: a genre with a new fill (e.g. blues
   or funk) built twice over a ≥4-bar progression yields identical drum event
   streams.

**Manual ear audition (required by the parent spec §3.2):**

For each of pop, rock, funk, jazz, blues — play a ≥4-bar progression and
confirm the turnaround bar reads as an idiomatic fill/accent and does not
clash with the base groove. Tune the beat tables in §6 by ear; apply tweaks as
small follow-up commits.

## 10. Files touched

- `src/progressions/audio/patterns.ts` — add 3 `DRUM_VARIATIONS` entries.
- `src/progressions/audio/genres.ts` — update `drumVariations` for pop, rock,
  funk, jazz, blues.
- `src/progressions/audio/patterns.test.ts` — gating + resolution tests.
- `src/progressions/audio/genres.test.ts` — assignment / no-dangling-id tests.
- (possibly) `src/progressions/audio/buildAllLayers.test.ts` — determinism check.
