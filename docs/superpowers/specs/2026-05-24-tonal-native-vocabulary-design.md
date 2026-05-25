# Phase N — Tonal-Native Vocabulary (Drop Adapters)

**Date:** 2026-05-24
**Status:** Approved
**Branch target:** `claude/elated-nobel-dd4e76` (or follow-up branch after M-series merges)

## Context

The M-series (commits `e981f0d7` → `80a13c53`) made Tonal the **source of truth for music-theory data** while FretFlow kept its verbose vocabulary (`"Major Triad"`, `"Phrygian Dominant"`) as the **internal API surface**. The two were bridged by adapter tables in `packages/core/src/lib/tonal.ts`:

- `QUALITY_TO_TONAL` — 15 entries (e.g. `"Major Triad" → "M"`, `"Minor 7th" → "m7"`)
- `SCALE_TO_TONAL` — 28 entries (e.g. `"Natural Minor" → "minor"`, `"Phrygian Dominant" → "phrygian dominant"`)

Plus the bidirectional `chordQualityToTonal`, `tonalToChordQuality`, `scaleNameToTonal`, `tonalToScaleName`, and the `tonalChordSymbol(root, quality)` helper.

This phase **retires the adapters entirely**. After Phase N:
- `CHORD_DEFINITIONS` keys = Tonal chord-symbol suffixes (`"M"`, `"m"`, `"dim"`, `"aug"`, `"sus2"`, `"sus4"`, `"6"`, `"m6"`, `"maj7"`, `"m7"`, `"7"`, `"dim7"`, `"m7b5"`, `"mMaj7"`, `"5"`).
- `SCALES` keys = Tonal scale names (`"major"`, `"minor"`, `"harmonic minor"`, `"melodic minor"`, `"major pentatonic"`, `"minor pentatonic"`, `"blues"`, `"ionian"`, `"dorian"`, `"phrygian"`, `"lydian"`, `"mixolydian"`, `"aeolian"`, `"locrian"`, `"locrian 6"`, `"ionian augmented"`, `"dorian #4"`, `"phrygian dominant"`, `"lydian #9"`, `"ultralocrian"`, `"dorian b2"`, `"lydian augmented"`, `"lydian dominant"`, `"mixolydian b6"`, `"locrian #2"`, `"altered"`, `"minor blues"`, `"major blues"`).
- All atoms, tests, defaults, and persisted storage use Tonal names.
- User-facing UI labels are **derived at render time** from `Chord.get(symbol).name` and `Scale.get(name).name`, not from i18n string tables.
- LocalStorage version bump on the affected atoms drops existing user data and resets to defaults. No migrator code.

This phase is **prerequisite** for Phases O (progression) and Q (time/rhythm); they would otherwise inherit the verbose vocabulary.

## Goals

- Delete `QUALITY_TO_TONAL`, `SCALE_TO_TONAL`, and the 5 adapter functions from `lib/tonal.ts`.
- Rename `CHORD_DEFINITIONS`, `CHORDS`, `SCALES`, `SCALE_FAMILY_DEFINITIONS.members[].scaleName`, `MODE_DEGREES`, `PENTATONIC_DEGREES`, `BLUES_DEGREES`, `DEGREE_DIATONIC_QUALITY` keys to Tonal vocabulary.
- Replace hardcoded display-label strings in `src/i18n/en.ts` and `src/i18n/es.ts` with Tonal-derived display helpers.
- Bump `progressionStepsAtom`'s storage version key so existing user data falls back to defaults. Same for any other atom that persists verbose names.
- Regenerate the M1 snapshots under the new key set (values stay numerically identical; only keys change).
- Update all production and test sites that reference the old verbose strings.

## Non-goals

- No new features. This is a pure vocabulary refactor.
- Do not touch `Tone.js` audio, `src/shapes/` (CAGED/3NPS), or rendering — the underlying music-theory data (interval arrays, chord member semitones, triad qualities) is byte-identical; only the *keys* change.
- Do not change the public API of `degrees.ts` exports (e.g. `getDegreesForScale`, `getQualityForDegree`) — their signatures stay the same; the strings they accept and return change to Tonal vocabulary.
- Do not delete `SCALE_FAMILY_DEFINITIONS` or `CHORD_DEFINITIONS` themselves — they still carry FretFlow UI metadata (family grouping, quality grouping). Only their string keys change.
- Do not add `@tonaljs/progression`, `voicing`, or `time-signature`. Those land in Phases O, P, Q.

## Migration policy

**Persisted data:** Existing users with custom progressions in localStorage will see their progressions **reset to defaults** on next load. Acceptable per user decision — no migrator code. Mechanism: bump the storage version suffix on:
- `progressionStepsAtom` — currently `k("progressionSteps")`, becomes `k("progressionSteps.v2")`.
- Any other atom that persists FretFlow vocabulary strings — audit during T6 and version-bump each.

**Display labels:** Three new helpers replace i18n strings:

```ts
// packages/core/src/lib/tonal.ts
export function getChordDisplayLabel(chordSymbol: string): string {
  const c = Chord.get(`C${chordSymbol}`);
  return c.empty ? chordSymbol : c.name.replace(/^C\s*/, "");
}

export function getScaleDisplayLabel(scaleName: string): string {
  const s = Scale.get(`C ${scaleName}`);
  return s.empty ? scaleName : s.name.replace(/^C\s*/, "");
}
```

These return strings like `"minor seventh"`, `"major pentatonic"`, `"phrygian dominant"`. They're consumed by `LabeledSelect` / dropdown components and by the chord-pill rendering. The i18n keys that previously hardcoded these strings are removed; only language-specific text (button labels, section headings, error messages) stays in `en.ts`/`es.ts`.

**Spanish localization:** Tonal returns English. For Phase N, **all chord/scale display labels render in English regardless of locale**. Localizing music-theory terms is deferred (would need a custom translation layer that we explicitly decided against).

## Tasks

(Detailed in the implementation plan; spec lists task identity + dependencies.)

- **N1** — Add `getChordDisplayLabel` + `getScaleDisplayLabel` helpers to `lib/tonal.ts`. Unit tests. Doesn't touch any consumer yet.
- **N2** — Rename `SCALES` keys to Tonal vocabulary. Update `SCALE_FAMILY_DEFINITIONS.members[].scaleName`. Update all `SCALES[...]` consumers (search-and-replace verbose names). Regenerate the `SCALES snapshot` from M1.
- **N3** — Rename `CHORD_DEFINITIONS` and `CHORDS` keys to Tonal vocabulary. Update all consumers. Regenerate `CHORDS snapshot` and `CHORD_DEFINITIONS snapshot`.
- **N4** — Rename `MODE_DEGREES`, `PENTATONIC_DEGREES`, `BLUES_DEGREES`, `DEGREE_DIATONIC_QUALITY` keys in `degrees.ts`. Update consumers. Regenerate the three degree snapshots.
- **N5** — Delete `QUALITY_TO_TONAL`, `SCALE_TO_TONAL`, `chordQualityToTonal`, `tonalToChordQuality`, `scaleNameToTonal`, `tonalToScaleName`, `tonalChordSymbol` from `lib/tonal.ts`. Update the 3 M-series helpers (`getScaleSemitonesFromTonal`, `getChordSemitonesFromTonal`, `getModeTriads`) to take Tonal names directly. Drop adapter unit tests; keep helper unit tests.
- **N6** — Bump storage version on `progressionStepsAtom` and any other atom that persists FretFlow-vocabulary strings (audit during this task). Update default progression steps to use Tonal quality symbols.
- **N7** — Strip hardcoded chord/scale display strings from `en.ts` / `es.ts`. Wire `LabeledSelect` / dropdown consumers to call the new display helpers from N1.
- **N8** — Update `src/i18n/types.ts` if removed keys had typed entries. Update component tests that referenced removed i18n keys.
- **N9** — Full verification: lint + test + build + e2e + visual.

## File map

**Modified:**
- `packages/core/src/lib/tonal.ts` — delete adapter tables + 5 functions; add 2 display helpers; update 3 M-series helpers.
- `packages/core/src/lib/tonal.test.ts` — drop adapter tests; add display-helper tests.
- `packages/core/src/theory.ts` — rename `CHORD_DEFINITIONS` and `CHORDS` keys; update consumers.
- `packages/core/src/theoryCatalog.ts` — rename `SCALE_FAMILY_DEFINITIONS.members[].scaleName`; cascades to `SCALES`, `SCALE_TO_PARENT_MAJOR_OFFSET`, `SCALE_NAME_ALIASES`, and all the catalog accessor functions (`getScaleFamily`, `getScaleMember`, etc.).
- `packages/core/src/degrees.ts` — rename all 4 degree tables' keys.
- `packages/core/src/circleOfFifthsUtils.ts` — audit for verbose-name references (probably none, but check).
- `packages/core/src/index.ts` — public re-exports unchanged in shape; some adapter exports get removed.
- `packages/core/src/__snapshots__/*.snap` — regenerated under new keys.
- `packages/core/src/*.test.ts` — every test that hard-codes verbose strings gets updated.
- `src/store/progressionAtoms.ts` — default progression steps (`qualityOverride: "Minor Triad"` → `"m"`); storage version bump.
- `src/store/scaleAtoms.ts` — `scaleNameAtom` storage version bump if it stores a verbose name.
- `src/store/chordOverlayAtoms.ts` — audit for verbose-name persistence; version-bump if found.
- `src/store/songStateAtoms.ts` — `qualityOverride` references.
- `src/progressions/progressionDomain.ts` — `qualityOverride === "7" ? "Dominant 7th"` becomes `qualityOverride === "7" ? "7"`; all related logic.
- `src/progressions/progressionGeneration.ts` — chord-quality references.
- `src/components/SongControls/SongControls.tsx` — chord quality selector consumes display helpers.
- `src/components/Inspector/**` — any chord/scale select dropdowns.
- `src/i18n/en.ts` and `src/i18n/es.ts` — drop `fullChordsHintUnsupportedType` literal "Major Triad, Minor Triad, and Dominant 7th" (replace with a dynamic helper call or leave the user-facing message language-agnostic).
- `src/i18n/types.ts` — drop removed i18n keys.
- All component tests that snapshot or assert verbose strings.

**Not modified:**
- `Tone.js` audio paths (`src/core/audio.ts`).
- `src/shapes/` — CAGED/3NPS shape generation. Uses interval arrays, not string names.
- The 28 scale FAMILY identifiers (`"major"`, `"harmonic-minor"`, etc. in `ScaleFamilyId`) — these are already lowercase/kebab and happen to be Tonal-ish; leave alone.

## Risk

| Task | Risk | Mitigation |
|------|------|------------|
| N2/N3/N4 | A rename misses a string literal site | Project-wide grep before commit; `tsc` will catch type-narrowed `keyof` usages; visual regression catches UI fallout |
| N5 | A test still imports the deleted adapter | tsc fails; replace the import |
| N6 | Storage version bump triggers user data loss in production | **Expected** per user decision. Document in release notes. |
| N7 | Display helper returns a confusing string (e.g. Tonal's `"C minor"` for the `C` minor chord — caller must strip `"C "`) | Display helpers handle the strip; unit tests cover it |
| All | Spanish (es.ts) users see English chord names | **Expected** per scope decision. Future PR could add a translation layer if user demand surfaces. |

## Snapshot strategy

The M-series snapshots (`SCALES`, `CHORDS`, `CHORD_DEFINITIONS`, the 3 degree snapshots) get **regenerated once** during Phase N. The VALUE arrays (interval lists, member semitones, triad qualities) stay byte-identical — only the KEY strings change from verbose to Tonal vocabulary. To prove the values themselves don't drift, **manually verify each snapshot diff before committing**: every key rename should produce a corresponding renamed snapshot entry with identical value content.

Specifically: after running `pnpm --filter @fretflow/core run test -- -u` to regenerate snapshots in N2/N3/N4, **diff the snapshot files** and confirm:
- Every old key has a corresponding new key (count matches).
- Every value array is identical except for sort order (which Vitest's serializer normalizes anyway).

This is the only acceptable use of `-u` (snapshot update) in the project's history. Document the regeneration clearly in the commit message.

## Verification

`pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production && pnpm test:visual`

- Lint: zero new warnings.
- Tests: all pass with regenerated snapshots.
- Build: clean.
- E2E: clean.
- Visual: zero baseline diffs. If diffs appear, the most likely cause is the i18n change in N7 (dropdown labels now show "minor seventh" instead of "Minor 7th"). If so, refresh baselines as a separate commit explaining the user-visible vocabulary change.

## Deferred to follow-up phases

- **Phase O** — `@tonaljs/progression` + `@tonaljs/roman-numeral` in `ProgressionTrack`, song-tab editor, and preset construction. Now lands in clean Tonal vocabulary.
- **Phase P** — `@tonaljs/voicing` + `voice-leading` + `voicing-dictionary` — needs separate brainstorming (Tonal voicings are pitch-class arrays, not fretboard positions; concrete user-visible role TBD).
- **Phase Q** — `@tonaljs/time-signature` + `duration-value` (cosmetic) and `@tonaljs/rhythm-pattern` (new drum-pattern feature for backing track).
- **Localized chord/scale names** in Spanish — would require a custom translation layer for Tonal's English vocabulary. Defer until user demand surfaces.
