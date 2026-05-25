# Tonal Catalog & Degrees Migration — Design

**Date:** 2026-05-24
**Status:** Approved
**Branch target:** `claude/elated-nobel-dd4e76` (or follow-up branch after Phase A merges)

## Context

Phase A (commits `2c50f74` → `02127433`) adopted `@tonaljs/note`'s `freq()` and `@tonaljs/pcset`. This follow-up consolidates the three deferred phases — A.5 (`scale-type` / `chord-type`), B (`roman-numeral` + `progression`), B.2 (`mode`) — into one coordinated migration. Coverage probe confirmed:

- All 28 FretFlow scales resolve via `Scale.get("C <name>")` (zero misses).
- All 15 FretFlow chord qualities resolve via `Chord.get("C<symbol>")`.
- `@tonaljs/mode` covers the 7 diatonic modes only; FretFlow's other 21 scales (harmonic-minor family, melodic-minor family, pentatonics, blues) stay FretFlow-owned.

These three phases touch the same 3 files (`packages/core/src/theoryCatalog.ts`, `packages/core/src/theory.ts`, `packages/core/src/degrees.ts`) and overlap heavily. Splitting them into separate PRs would leave the catalog in awkward half-migrated states. They ship together.

## Goals

- Make Tonal the **source of truth for music-theory intervals** (scale + chord), so FretFlow stops carrying parallel hand-coded tables that can drift.
- Make `@tonaljs/mode` the source of triad-quality data for the 7 diatonic modes, retiring FretFlow's redundant `MODE_DEGREES` table.
- Use `@tonaljs/roman-numeral` to parse degree IDs in `degrees.ts` instead of search-by-value over a map.
- Preserve every public export shape: `SCALES`, `CHORDS`, `CHORD_DEFINITIONS`, `SCALE_FAMILIES`, and every `degrees.ts` function must remain behaviorally identical, verified by snapshot tests seeded before the refactor.

## Non-goals

- **Do not** retire `SCALE_FAMILY_DEFINITIONS` or `CHORD_DEFINITIONS`. They carry FretFlow-specific UI metadata (selector labels, default-scale names, family grouping, chord-quality groupings, member display names) that Tonal does not model. Only the **interval data** moves to Tonal-derivation.
- **Do not** replace `members[].name` in `CHORD_DEFINITIONS` (the chord-tone overlay depends on exact strings like `"root"`, `"b3"`, `"#5"`, `"bb7"`). Only `members[].semitone` is derived from Tonal.
- **Do not** add `@tonaljs/progression`. Examined and found no current consumer — FretFlow stores progressions as `{ degree, quality, duration }` records, not as roman-numeral strings, so `Progression.fromRomanNumerals` has nothing to plug into. Revisit if a future "import progression from text" feature lands.
- **Do not** touch `Tone.js` audio integration, `src/shapes/` (CAGED/3NPS), or `src/store/` atoms. Out of scope.

## Tasks

### T1 — Snapshot lock

Before touching production code, capture current behavior of every public API that will move. Pre-refactor safety net (proven invaluable in Phase A).

Files: `packages/core/src/theory.test.ts`, `packages/core/src/theoryCatalog.test.ts`, `packages/core/src/degrees.test.ts`, `packages/core/src/__snapshots__/`.

Snapshots:
- `SCALES` — full record (28 entries, each an interval array). One snapshot.
- `CHORDS` — full record (15 entries). One snapshot.
- `CHORD_DEFINITIONS` — full record including `members` arrays with names + semitones. One snapshot.
- `getDegreesForScale(name)` for every scale in `SCALES`. One snapshot record.
- `getQualityForDegree(degree, scale)` for every (degree, scale) pair the catalog produces. One snapshot record.
- `getDegreeSequence(scale)` for every scale. One snapshot record.

These are the load-bearing surfaces. If any snapshot diffs after the refactor, behavior changed — STOP and investigate.

### T2 — `theoryCatalog.ts` scale intervals from Tonal

Replace the inline `intervals: [...]` arrays inside `SCALE_FAMILY_DEFINITIONS` with derivation from `Scale.get(...)`.

**Approach:**
1. Add a new helper to `packages/core/src/lib/tonal.ts`:
   ```ts
   /**
    * Returns the semitone offsets (0-11) of a scale, derived from Tonal.
    * The FretFlow catalog uses these as the source of truth for scale notes.
    */
   export function getScaleSemitonesFromTonal(scaleName: string): number[] {
     const tonalName = scaleNameToTonal(scaleName) ?? scaleName;
     const tonalScale = Scale.get(`C ${tonalName}`);
     if (tonalScale.empty) return [];
     return tonalScale.notes
       .map((n) => Note.chroma(n))
       .filter((c): c is number => typeof c === "number" && !isNaN(c));
   }
   ```
2. In `theoryCatalog.ts`, change `SCALE_FAMILY_DEFINITIONS` member shape: drop the inline `intervals: number[]` field. After the `SCALE_FAMILY_DEFINITIONS` const, derive intervals from `getScaleSemitonesFromTonal(scaleName)` when building `SCALES` (around line 313).
3. The existing `SCALES` export keeps its shape — `Record<string, number[]>` — but is now Tonal-projected.

**Test:** T1 snapshots must stay byte-identical.

**Risk:** Tonal's scale notes are spelled (e.g. `["C", "D", "Eb"]`) and `Note.chroma` returns 0-11. The current FretFlow intervals are also 0-11 semitone offsets. Same domain — should be equivalent.

### T3 — `theory.ts` chord intervals from Tonal

Replace `members[].semitone` literals inside `CHORD_DEFINITIONS` with derivation from `Chord.get(symbol).intervals`.

**Approach:**
1. Add a helper to `packages/core/src/lib/tonal.ts`:
   ```ts
   /**
    * Returns the semitone offsets (0-11) of a chord, derived from Tonal.
    * Chord symbol example: "M" (major), "m7" (minor 7th), "dim7", etc.
    */
   export function getChordSemitonesFromTonal(chordSymbol: string): number[] {
     const tonalChord = Chord.get(`C${chordSymbol}`);
     if (tonalChord.empty) return [];
     return tonalChord.intervals
       .map((iv) => Interval.semitones(iv))
       .filter((s): s is number => typeof s === "number" && !isNaN(s))
       .map((s) => ((s % 12) + 12) % 12);
   }
   ```
2. In `theory.ts`, refactor `CHORD_DEFINITIONS` construction: keep the hand-coded `members[].name` (UI contract), but derive the `semitone` from `getChordSemitonesFromTonal(symbol)`. Validate at construction time that `members.length === tonalSemitones.length` — if mismatch, throw a clear error.
3. Add a `tonalSymbol: string` field to each entry (using the existing `QUALITY_TO_TONAL` map in `lib/tonal.ts`).

**Risk:** Order of intervals returned by Tonal may differ from FretFlow's hand-coded order. The chord-tone overlay maps `members[i].name` to `members[i].semitone` positionally, so order must match. Mitigation: after derivation, **sort `members` by semitone ascending**, and verify (in T1's snapshot) the order matches the current hand-coded order. If they differ, the snapshot will flag it and we adjust by keeping the hand-coded `members[].name` order and using Tonal to fill semitones positionally (assuming Tonal's interval order matches FretFlow's intent for each chord). For example, `Major Triad` members are `[root, 3, 5]` (semitones `[0, 4, 7]`); Tonal's `M` returns intervals `["1P", "3M", "5P"]` (semitones `[0, 4, 7]`) — order matches.

**Decision:** Keep `members[].name` array ordering hand-coded. Map `members[i].semitone = tonalSemitones[i]` positionally. If any chord fails the order check, fix that specific chord's name list (or leave it hand-coded as a documented exception).

### T4 — `degrees.ts` adopt `@tonaljs/mode` + `@tonaljs/roman-numeral`

Replace the diatonic-mode portions of `MODE_DEGREES` and `DEGREE_DIATONIC_QUALITY` with Tonal derivation. The non-diatonic entries (Harmonic Minor + 6 modes, Melodic Minor + 6 modes, Pentatonics, Blues) stay FretFlow-owned because Tonal doesn't model them.

**Approach:**

1. Add a helper to `packages/core/src/lib/tonal.ts`:
   ```ts
   /**
    * Returns the diatonic triad qualities of a mode as Roman-numeral strings,
    * e.g. ["i", "ii°", "III+", ...]. Tonal supports the 7 standard diatonic
    * modes (ionian/major, dorian, phrygian, lydian, mixolydian, aeolian/minor,
    * locrian) plus harmonic-minor modes. Returns null for modes Tonal can't
    * model (pentatonics, blues, melodic-minor variants).
    */
   export function getModeTriads(modeName: string): readonly string[] | null {
     const tonalName = scaleNameToTonal(modeName);
     if (!tonalName) return null;
     const mode = Mode.get(tonalName);
     if (mode.empty) return null;
     return mode.triads;
   }
   ```

2. In `degrees.ts`, `MODE_DEGREES` currently has 8 hand-coded entries (the 7 diatonic modes + Harmonic Minor). Replace the 7 diatonic entries with Tonal-derived values; keep `Harmonic Minor` hand-coded (Tonal does cover it but mixing derived + hand-coded for one outlier reduces blast radius). Build the diatonic entries at module load via `getModeTriads(modeName)` and convert to FretFlow's `Record<semitone, roman>` shape using `SCALES` (now Tonal-projected from T2).

3. In `getQualityForDegree`, replace the `Object.entries(degreesMap).find(...)` linear search with `RomanNumeral.get(degreeId)` to extract `{ step, chordType }` directly. This is cleaner but BEHAVIORALLY OPTIONAL — keep the old search as a fallback for degrees Tonal doesn't recognize (e.g., `"i°"`, `"III+"` with FretFlow-specific suffix conventions).

   **Decision:** Use Tonal's parser for the simple cases (uppercase/lowercase, no suffix or `7`) and fall back to the linear search for FretFlow's `°` and `+` suffixes if Tonal mishandles them. Verified during implementation, not now.

4. `DEGREE_DIATONIC_QUALITY` for the 7 diatonic modes can be derived from `Mode.get(name).triads` + a simple `triadStringToQuality` mapper (`"I" → "Major Triad"`, `"i" → "Minor Triad"`, `"i°" → "Diminished Triad"`, `"I+" → "Augmented Triad"`). Keep Harmonic Minor + Pentatonics + Blues entries hand-coded.

**Test:** T1 snapshots must stay green. `degrees.test.ts` (772 lines, exhaustive) is the regression safety net.

### T5 — Verification

- `pnpm lint` (zero new warnings)
- `pnpm test` (all 1944 tests green, including T1 snapshots)
- `pnpm build`
- `pnpm test:e2e:production`
- `pnpm test:visual` — must pass with zero baseline diffs. If any baseline diffs, investigate — refactor shouldn't change rendered text or layout.

## File map

**Modified:**
- `packages/core/src/lib/tonal.ts` — add 3 new exports: `getScaleSemitonesFromTonal`, `getChordSemitonesFromTonal`, `getModeTriads`.
- `packages/core/src/theoryCatalog.ts` — drop `intervals` field from member literals; `SCALES` derives from Tonal.
- `packages/core/src/theory.ts` — `CHORD_DEFINITIONS` derives semitones from Tonal; add `tonalSymbol` field per entry.
- `packages/core/src/degrees.ts` — diatonic `MODE_DEGREES` + `DEGREE_DIATONIC_QUALITY` entries derived from `Mode.get`; `getQualityForDegree` uses `RomanNumeral.get` where applicable.
- `packages/core/src/theory.test.ts` — add `CHORDS` + `CHORD_DEFINITIONS` snapshots.
- `packages/core/src/theoryCatalog.test.ts` — add `SCALES` snapshot.
- `packages/core/src/degrees.test.ts` — add `getDegreesForScale` × `getQualityForDegree` × `getDegreeSequence` snapshot.
- `packages/core/package.json` — add deps `@tonaljs/mode` and `@tonaljs/roman-numeral` (already pulled in transitively, declare explicitly).

**Not modified:** `src/`, `e2e/`, anything outside `packages/core/src/`.

## Risk

| Task | Risk | Mitigation |
|------|------|------------|
| T2 | Tonal scale intervals differ from FretFlow's for some scale | T1 snapshot lock — caught immediately |
| T3 | Chord member order differs between Tonal and FretFlow | T1 snapshot pins current order; sort + verify in T3 |
| T4 | RomanNumeral can't parse `"i°"` or `"III+"` | Fallback to linear search; documented in code |
| T4 | Mode.triads output spelling differs from FretFlow expectation | T1 snapshot catches it |
| All | Hidden coupling: some downstream consumer relies on a specific export ordering | Full test suite + e2e gate; visual regression as the last paranoid check |

## Deferred (not in this PR)

- `@tonaljs/progression` — no consumer today; ship if a "paste in `ii V I` text" feature lands.
- `@tonaljs/voicing` / `voice-leading` / `voicing-dictionary` — produce pitch voicings, not fretboard positions. Only useful for a "voice-leading suggestions" feature.
- `@tonaljs/time-signature` / `duration-value` / `rhythm-pattern` — current bpm math in `progressionAtoms.ts` is trivial; cosmetic swap, defer.
- `@tonaljs/chord-detect` — no consumer.
- `@tonaljs/abc-notation` — no consumer.
- Retiring `SCALE_FAMILY_DEFINITIONS` or `CHORD_DEFINITIONS` themselves — these own FretFlow UI metadata Tonal does not model. They stay.

## Verification

`pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production && pnpm test:visual` — all green. No `--update-snapshots` allowed for snapshot tests (any diff = behavioral regression). Visual baselines should not diff; if they do, investigate (refactor is supposed to be byte-equivalent at the public-API surface).
