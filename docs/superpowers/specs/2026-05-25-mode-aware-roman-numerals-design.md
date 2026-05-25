# Mode-Aware Roman Numerals — Design

**Date:** 2026-05-25
**Status:** Approved, ready for plan

## Problem

Tonal's `@tonaljs/progression` and `@tonaljs/roman-numeral` packages are major-key-only. `RomanNumeral.get("VI")` returns the major-key interval `M6` regardless of context, so `Progression.fromRomanNumerals("C", ["VI"])` returns `["A"]` — the major-key VI — even when the caller meant the minor-key VI (Ab/G#). This is hard-coded in Tonal's source (a `NAMES = ["I","II","III","IV","V","VI","VII"]` table feeding `pitch-interval`) and there is no mode parameter.

The session-prior Phase O attempted to swap FretFlow's `getDiatonicChord` to use `Progression.fromRomanNumerals` and reverted when this surfaced as a snapshot failure in C minor pentatonic (resolution chain reduces pentatonic to natural minor; the bug is on the minor leg). Today FretFlow resolves degrees via its own semitone-table transposition, which is correct but bypasses Tonal entirely for the most central piece of progression logic.

## Goal

Ship a thin downstream wrapper in `@fretflow/core` that extends Tonal's existing parsing surface to honor any scale's interval profile, then refactor `getDiatonicChord` to use the wrapper. The wrapper must support all 28 FretFlow scales (modes + harmonic/melodic minor + pentatonic + blues + phrygian dominant + ultralocrian), without duplicating FretFlow's `SCALES` table.

Non-goal: upstream PR to tonaljs (deferred — prove the API in production first).

## Approach: numeral preprocessor

Rewrite Roman numerals to use accidentals that Tonal's existing parser already understands, then delegate everything else to `Progression.fromRomanNumerals`. In C minor:

| FretFlow numeral | After preprocess | Tonal resolves to |
| --- | --- | --- |
| `i`   | `i`    | `Cm`  |
| `ii°` | `ii°`  | `Ddim` |
| `III` | `bIII` | `Eb`  |
| `iv`  | `iv`   | `Fm`  |
| `v`   | `v`    | `Gm`  |
| `VI`  | `bVI`  | `Ab`  |
| `VII` | `bVII` | `Bb`  |

The prefix is computed as `scaleSemitones[step] - majorIntervals[step]` and serialized as `b…` or `#…`. Zero data duplication — the preprocessor reads FretFlow's `SCALES[scaleName]` semitone profile (already source of truth) and emits a string Tonal can natively parse.

Explicit accidentals on the input (e.g., `bVI`, `#IV`) pass through unchanged so callers can always override the mode-derived default.

## File structure

**New**

- `packages/core/src/lib/progression.ts` — wrapper module.
  - `applyModeAccidentals(numeral: string, scaleSemitones: readonly number[]): string` — pure preprocessor.
  - `fromRomanNumeralsInScale(tonic: string, numerals: readonly string[], scaleSemitones: readonly number[]): string[]` — composition over `Progression.fromRomanNumerals`.
- `packages/core/src/lib/progression.test.ts` — unit + integration tests.

**Modified**

- `packages/core/src/theory.ts` — refactor `getDiatonicChord` to use `fromRomanNumeralsInScale` for root resolution. `getQualityForDegree` stays the quality source.
- `packages/core/src/index.ts` — re-export `fromRomanNumeralsInScale` (and `applyModeAccidentals` for testability + future consumers).
- `packages/core/src/theory.test.ts` — extend the existing Tonal-agreement test to cover minor, dorian, harmonic minor.

**Untouched**

- `packages/core/src/degrees.ts` — degree tables, `getQualityForDegree`. Quality logic stays.
- `src/progressions/progressionDomain.ts` — caller chain. `resolveProgressionStep` still calls `getDiatonicChord` with the same signature.
- All snapshot tests in `progressionDomain.test.ts` — the refactor must preserve byte-identical output.

## Quality preservation

`fromRomanNumeralsInScale` resolves only the **root pitch**. Tonal's `Progression.fromRomanNumerals` returns chord symbols whose chord-type portion comes from the *suffix* on the original numeral (e.g., `"VI"` → `""` major, `"vi°"` → `"dim"`). FretFlow's `getQualityForDegree` is the authoritative quality source — it knows that minor's "VI" yields an "M" (major) triad even though the numeral itself has no suffix. The refactor keeps that lookup intact and only uses the wrapper to compute the root note.

Decision recorded: any divergence between Tonal's suffix-derived chord type and FretFlow's `getQualityForDegree` table is resolved in FretFlow's favor.

## Data flow (post-refactor)

```
resolveProgressionStep(step, "minor", "C")
  → getDiatonicChord("VI", "minor", "C")
    1. semitoneEntry lookup in getDegreesForScale("minor") → validates degree
    2. quality = getQualityForDegree("VI", "minor")        → "M"
    3. fromRomanNumeralsInScale("C", ["VI"], SCALES["minor"])
       a. applyModeAccidentals("VI", [0,2,3,5,7,8,10])     → "bVI"
       b. Progression.fromRomanNumerals("C", ["bVI"])      → ["Ab"]
    4. Chord.get("Ab").tonic                                → "Ab"
    5. Normalize to sharps via Note.enharmonic              → "G#"
    6. Return { root: "G#", quality: "M" }
```

## Error handling

| Input | Wrapper behavior |
| --- | --- |
| Invalid numeral (regex no-match, e.g. `"foo"`) | Pass through to Tonal → Tonal returns empty → output is `[""]`. Caller (`getDiatonicChord`) already guards on `chordSymbol` falsy → returns `undefined`. |
| Step out of range (e.g., numeral for `VIII` when scale has 5 notes) | Pass through unchanged. Tonal returns empty. Same path as above. |
| Empty `numerals` array | Tonal returns `[]`. Wrapper returns `[]`. Caller handles. |
| Mismatched lengths (scale has 5 notes, numeral is `VII`) | Pass through; Tonal returns empty. |
| Explicit accidental on numeral (`"#IV"`, `"bIII"`) | Pass through with accidental preserved — Tonal resolves correctly without mode adjustment. |

## Testing

**Unit tests** (`lib/progression.test.ts`):

1. `applyModeAccidentals` — for each of the 28 scales in `SCALES`, for each of the seven canonical numerals (I–VII, casing preserved per the scale's quality), assert the output prefix matches the hand-computed `diff` against major intervals.
2. `applyModeAccidentals` pass-through — explicit accidental, invalid roman, out-of-bounds step.
3. `applyModeAccidentals` suffix preservation — `vii°` → `vii°` (in major), `vi°` → `bvi°` (in dorian, where vi is a half-step lower? — verify; in dorian the vi is diminished and one semitone below major's vi, so it should rewrite to `bvi°`).

**Integration tests** (`lib/progression.test.ts`):

1. `fromRomanNumeralsInScale("C", ["I","ii","iii","IV","V","vi","vii°"], SCALES["major"])` → `["C","Dm","Em","F","G","Am","Bdim"]` (unchanged from Tonal).
2. `fromRomanNumeralsInScale("C", ["i","ii°","III","iv","v","VI","VII"], SCALES["minor"])` → `["Cm","Ddim","Eb","Fm","Gm","Ab","Bb"]`.
3. `fromRomanNumeralsInScale("D", ["i","ii","III","IV","v","vi°","VII"], SCALES["dorian"])` → `["Dm","Em","F","G","Am","Bdim","C"]`.
4. `fromRomanNumeralsInScale("A", ["i","ii°","III+","iv","V","VI","vii°"], SCALES["harmonic minor"])` → assert each entry.

**Regression** (`theory.test.ts`):

- Extend the existing `describe("getDiatonicChord — Tonal Progression agreement (major mode)")` block into a `describe.each` over `[major, minor, dorian, harmonic minor]`, asserting `getDiatonicChord(degree, scale, "C")` returns the same root as `fromRomanNumeralsInScale("C", [degree], SCALES[scale])`. This is the proof that the refactor preserves behavior.

**Snapshot lock**:

- All 50+ tests in `src/progressions/progressionDomain.test.ts` must keep passing without `-u`. Any drift means the refactor changed observable output and must be fixed before merge.

## Build + ship gates

1. `pnpm lint` — clean.
2. `pnpm test` — 1970+ tests pass (1966 today + ~6 new from progression.test.ts + ~3 new from theory.test.ts mode-extension).
3. `pnpm build` — clean.
4. `pnpm test:e2e:production` — 50/50 pass.
5. `pnpm test:visual` — 44/44 pass, zero baseline drift.

## Out of scope

- Upstream PR to tonaljs (defer; prove API stability in production first).
- Harmonic-minor edge cases beyond what FretFlow ships (`v` augmented major triad inversions, etc.).
- The pentatonic/blues collapse in `getProgressionHarmonyScaleName` — that pre-reduction layer in `progressionDomain.ts` stays untouched.
- Documenting the wrapper as a public package export beyond `index.ts` re-export — README/docs are out of scope.

## Risks

- **Enharmonic drift.** Tonal may return `"Eb"` where FretFlow expects `"D#"`. Existing `Note.enharmonic` normalization in `getDiatonicChord` handles this. Catch case: scales rooted on sharps-form notes (e.g., F# minor) where Tonal might pick flats for the III/VI/VII. The Note.enharmonic post-process keeps FretFlow's sharps contract.
- **Suffix preservation in regex.** The regex `/^([#b]*)([IViv]+)(.*)$/` greedy-matches the roman numeral chunk. Verify against `"vii°"`, `"III+"`, `"V7"`, `"iiø"` (none of these appear in current degree tables, but they could in future).
- **Tonal API change.** `Progression.fromRomanNumerals`'s 3-line implementation (read in brainstorming) is stable as of 4.9.2. Pin the version; document the wrapper assumption in the file header.

## Acceptance

- All 1966 existing tests still pass with no `-u`.
- New `progression.test.ts` adds at least 12 cases (one per FretFlow scale family + edge cases).
- `getDiatonicChord` body is shorter and references `fromRomanNumeralsInScale` instead of bespoke `Interval.fromSemitones` math.
- The "KNOWN DIVERGENCE" code comment in `theory.ts` (added in commit `0d56a971`) is replaced with a comment explaining the wrapper's role.
