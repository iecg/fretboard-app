# Tonal-Native Vocabulary Implementation Plan (Phase N)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire FretFlow's verbose chord/scale vocabulary in favor of Tonal's native symbols and names everywhere — internal APIs, defaults, persisted storage, and user-facing labels (English only, derived at render time).

**Architecture:** Seven sequential tasks. N1 adds display helpers (additive). N2/N3/N4 perform domain-by-domain rename sweeps with snapshot regeneration. N5 removes the now-unused adapters and bumps storage versions. N6 strips hardcoded i18n strings and wires the display helpers. N7 verifies. Each rename task is a single big-bang commit because consumers must switch atomically (the renamed Record key has no fallback).

**Tech Stack:** TypeScript, Vitest, `@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/note`, `@tonaljs/mode`.

**Spec:** `docs/superpowers/specs/2026-05-24-tonal-native-vocabulary-design.md`

---

## Vocabulary mapping tables (authoritative — referenced by all tasks)

### Scale name rename (28 entries)

| Old (verbose) | New (Tonal) |
|---|---|
| `"Major"` | `"major"` |
| `"Natural Minor"` | `"minor"` |
| `"Harmonic Minor"` | `"harmonic minor"` |
| `"Melodic Minor"` | `"melodic minor"` |
| `"Major Pentatonic"` | `"major pentatonic"` |
| `"Minor Pentatonic"` | `"minor pentatonic"` |
| `"Blues"` | `"blues"` |
| `"Ionian"` | `"ionian"` |
| `"Dorian"` | `"dorian"` |
| `"Phrygian"` | `"phrygian"` |
| `"Lydian"` | `"lydian"` |
| `"Mixolydian"` | `"mixolydian"` |
| `"Aeolian"` | `"aeolian"` |
| `"Locrian"` | `"locrian"` |
| `"Locrian Natural 6"` | `"locrian 6"` |
| `"Ionian Augmented"` | `"ionian augmented"` |
| `"Dorian Sharp 4"` | `"dorian #4"` |
| `"Phrygian Dominant"` | `"phrygian dominant"` |
| `"Lydian Sharp 2"` | `"lydian #9"` |
| `"Altered Diminished"` | `"ultralocrian"` |
| `"Dorian Flat 2"` | `"dorian b2"` |
| `"Lydian Augmented"` | `"lydian augmented"` |
| `"Lydian Dominant"` | `"lydian dominant"` |
| `"Mixolydian Flat 6"` | `"mixolydian b6"` |
| `"Locrian Natural 2"` | `"locrian #2"` |
| `"Altered"` | `"altered"` |
| `"Minor Blues"` | `"minor blues"` |
| `"Major Blues"` | `"major blues"` |

### Chord quality rename (15 entries)

| Old (verbose) | New (Tonal) |
|---|---|
| `"Major Triad"` | `"M"` |
| `"Minor Triad"` | `"m"` |
| `"Diminished Triad"` | `"dim"` |
| `"Augmented Triad"` | `"aug"` |
| `"Sus2"` | `"sus2"` |
| `"Sus4"` | `"sus4"` |
| `"Major 6th"` | `"6"` |
| `"Minor 6th"` | `"m6"` |
| `"Major 7th"` | `"maj7"` |
| `"Minor 7th"` | `"m7"` |
| `"Dominant 7th"` | `"7"` |
| `"Diminished 7th"` | `"dim7"` |
| `"Half-Diminished 7th"` | `"m7b5"` |
| `"Minor-Major 7th"` | `"mMaj7"` |
| `"Power Chord (5)"` | `"5"` |

These tables are derived from `QUALITY_TO_TONAL` and `SCALE_TO_TONAL` in `packages/core/src/lib/tonal.ts:19-70`.

### Display labels at render time (English only)

User-facing UI gets the display string from Tonal:
- Chord: `Chord.get(\`C${symbol}\`).name.replace(/^C\s*/, "")` — e.g. `"M"` → `"major"`, `"m7"` → `"minor seventh"`, `"dim7"` → `"diminished seventh"`.
- Scale: `Scale.get(\`C ${name}\`).name.replace(/^C\s*/, "")` — e.g. `"major"` → `"major"`, `"phrygian dominant"` → `"phrygian dominant"`.

---

## File scope (high-level)

**Files referencing verbose chord names** (per `git grep`): ~40, split between `packages/core/` and `src/`. Includes catalogs, tests, components, atoms, and the i18n strings in `en.ts`/`es.ts`.

**Files referencing verbose scale names** (per `git grep`): ~25, overlap with the chord list.

**Snapshot files affected:**
- `packages/core/src/__snapshots__/theory.test.ts.snap` (SCALES, CHORDS, CHORD_DEFINITIONS entries)
- `packages/core/src/__snapshots__/degrees.test.ts.snap` (3 degree-output entries)

**Storage keys to bump:**
- `progressionStepsAtom` — `k("progressionSteps")` → `k("progressionSteps.v2")`
- `baseScaleNameAtom` — `k("scaleName")` → `k("scaleName.v2")` (default also changes from `"Major"` to `"major"`)
- Audit pass during N5 catches any others.

---

## Task N1: Display helpers (additive)

**Files:**
- Modify: `packages/core/src/lib/tonal.ts`
- Modify: `packages/core/src/lib/tonal.test.ts`

Additive change — doesn't touch any consumer yet. Helpers exist for N6 to wire up.

- [ ] **Step 1: Add `getChordDisplayLabel` and `getScaleDisplayLabel` to `lib/tonal.ts`**

In `packages/core/src/lib/tonal.ts`, at the bottom of the file:

```ts
/**
 * Returns the English display label for a Tonal chord symbol, suitable
 * for rendering in user-facing UI. Examples:
 *   getChordDisplayLabel("M")    -> "major"
 *   getChordDisplayLabel("m7")   -> "minor seventh"
 *   getChordDisplayLabel("dim7") -> "diminished seventh"
 *   getChordDisplayLabel("5")    -> "power"
 *
 * Returns the input unchanged if Tonal can't resolve it (defensive
 * fallback so the UI never shows blank).
 */
export function getChordDisplayLabel(chordSymbol: string): string {
  const c = Chord.get(`C${chordSymbol}`);
  if (c.empty) return chordSymbol;
  // Tonal returns names like "C major" or "C minor seventh"; strip the tonic.
  return c.name.replace(/^C\s*/, "").trim() || chordSymbol;
}

/**
 * Returns the English display label for a Tonal scale name, suitable
 * for rendering in user-facing UI. Examples:
 *   getScaleDisplayLabel("major")              -> "major"
 *   getScaleDisplayLabel("phrygian dominant")  -> "phrygian dominant"
 *   getScaleDisplayLabel("locrian 6")          -> "locrian 6"
 *
 * Returns the input unchanged if Tonal can't resolve it.
 */
export function getScaleDisplayLabel(scaleName: string): string {
  const s = Scale.get(`C ${scaleName}`);
  if (s.empty) return scaleName;
  return s.name.replace(/^C\s*/, "").trim() || scaleName;
}
```

(`Chord` and `Scale` are already imported in this file from prior tasks. Verify with `grep '^import.*Chord\|^import.*Scale' packages/core/src/lib/tonal.ts` before adding duplicates.)

- [ ] **Step 2: Add unit tests**

In `packages/core/src/lib/tonal.test.ts`, add `getChordDisplayLabel` and `getScaleDisplayLabel` to the import line from `"./tonal"`. At the bottom of the file:

```ts
describe("getChordDisplayLabel", () => {
  it("major triad", () => {
    expect(getChordDisplayLabel("M")).toBe("major");
  });
  it("minor seventh", () => {
    expect(getChordDisplayLabel("m7")).toBe("minor seventh");
  });
  it("dominant seventh", () => {
    expect(getChordDisplayLabel("7")).toBe("dominant seventh");
  });
  it("diminished seventh", () => {
    expect(getChordDisplayLabel("dim7")).toBe("diminished seventh");
  });
  it("half-diminished", () => {
    expect(getChordDisplayLabel("m7b5")).toBe("half-diminished");
  });
  it("power chord", () => {
    expect(getChordDisplayLabel("5")).toBe("power");
  });
  it("falls back to input on unknown symbol", () => {
    expect(getChordDisplayLabel("ZZZ")).toBe("ZZZ");
  });
});

describe("getScaleDisplayLabel", () => {
  it("major", () => {
    expect(getScaleDisplayLabel("major")).toBe("major");
  });
  it("phrygian dominant", () => {
    expect(getScaleDisplayLabel("phrygian dominant")).toBe("phrygian dominant");
  });
  it("ultralocrian", () => {
    expect(getScaleDisplayLabel("ultralocrian")).toBe("ultralocrian");
  });
  it("falls back to input on unknown scale", () => {
    expect(getScaleDisplayLabel("bogus scale")).toBe("bogus scale");
  });
});
```

The expected values come from Tonal's own `Chord.get(\`C${symbol}\`).name` outputs (Tonal owns the vocabulary). If any test expectation differs from actual Tonal output, **adjust the expectation to match Tonal** and document in the commit message — Tonal is the source of truth.

- [ ] **Step 3: Run unit tests**

```bash
pnpm --filter @fretflow/core run test -- tonal.test.ts
```

Expected: all PASS (existing + 11 new tests). If any FAIL because Tonal's actual output differs from the test expectations, update expectations to match.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts
git commit -m "feat(core): add Tonal-derived display label helpers

getChordDisplayLabel(symbol) and getScaleDisplayLabel(name) return
English display strings derived from Tonal (Chord.get/Scale.get).
Additive only — consumers wired in N6."
```

---

## Task N2: Rename SCALES keys to Tonal vocabulary + cascade

This is a big-bang multi-file rename. Every `SCALES["Major"]` / `scaleName === "Natural Minor"` / `"Phrygian Dominant"` literal becomes the Tonal equivalent. Read the scale-name table at the top of this plan.

**Files:** (touched by this task; complete list discovered via `git grep`)
- Modify: `packages/core/src/theoryCatalog.ts` — `SCALE_FAMILY_DEFINITIONS.members[].scaleName` literals; `SCALE_NAME_ALIASES` (drop the `Minor → Natural Minor` alias entry — it's no longer meaningful).
- Modify: `packages/core/src/theory.ts` — any literal scale-name references.
- Modify: `packages/core/src/degrees.ts` — table keys (left for N4) AND any literal scale-name references.
- Modify: `packages/core/src/diatonicNotes.ts` — verify; replace if any.
- Modify: `packages/core/src/lib/tonal.ts` — the helpers `getScaleSemitonesFromTonal`, `getModeTriads` currently use `scaleNameToTonal(name) ?? name`; simplify to `name` since input IS Tonal now.
- Modify: All `packages/core/src/**/*.test.ts` files that reference verbose scale names.
- Modify: `src/store/scaleAtoms.ts` — `colorNotesAtom` `if (scaleName === "Minor Blues")` literals; default value `"Major"` for `baseScaleNameAtom` becomes `"major"`.
- Modify: All `src/**/*.{ts,tsx}` files (production + tests) that reference verbose scale names.
- Regenerate: `packages/core/src/__snapshots__/theory.test.ts.snap` SCALES entry.

The new keys (per the table above): `major`, `minor`, `harmonic minor`, `melodic minor`, `major pentatonic`, `minor pentatonic`, `blues`, `ionian`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `aeolian`, `locrian`, `locrian 6`, `ionian augmented`, `dorian #4`, `phrygian dominant`, `lydian #9`, `ultralocrian`, `dorian b2`, `lydian augmented`, `lydian dominant`, `mixolydian b6`, `locrian #2`, `altered`, `minor blues`, `major blues`.

- [ ] **Step 1: Enumerate every file touching verbose scale names**

```bash
git grep -l '"Major"\|"Natural Minor"\|"Harmonic Minor"\|"Melodic Minor"\|"Major Pentatonic"\|"Minor Pentatonic"\|"Blues"\|"Ionian"\|"Dorian"\|"Phrygian"\|"Lydian"\|"Mixolydian"\|"Aeolian"\|"Locrian"\|"Locrian Natural 6"\|"Ionian Augmented"\|"Dorian Sharp 4"\|"Phrygian Dominant"\|"Lydian Sharp 2"\|"Altered Diminished"\|"Dorian Flat 2"\|"Lydian Augmented"\|"Lydian Dominant"\|"Mixolydian Flat 6"\|"Locrian Natural 2"\|"Altered"\|"Minor Blues"\|"Major Blues"' -- src/ packages/core/src/ 2>/dev/null
```

This produces the worklist. Save the count for the commit message.

- [ ] **Step 2: Update `packages/core/src/theoryCatalog.ts`**

Rewrite the 28 member literals in `SCALE_FAMILY_DEFINITIONS` (lines ~77-293) so each `scaleName` field uses the Tonal-vocabulary value from the table. The other fields (`displayLabel`, `shortLabel`, `parentMajorOffset`) are NOT renamed — they're user-facing English text and stay as-is for now (N6 may or may not re-derive them).

Examples:
- `scaleName: "Major"` → `scaleName: "major"` (Major Modes family, entry 1)
- `scaleName: "Phrygian Dominant"` → `scaleName: "phrygian dominant"` (Harmonic Minor family, entry 5)
- `scaleName: "Major Blues"` → `scaleName: "major blues"` (Blues family, entry 2)

Repeat for all 28 entries. Use the rename table.

Then update related catalog code:
- `SCALE_NAME_ALIASES` (line 40-42): the existing entry `{ Minor: "Natural Minor" }` no longer matches anything since "Natural Minor" no longer exists. Replace with `{}` (or remove the const entirely if no other consumer references it; check with `git grep SCALE_NAME_ALIASES`).
- `normalizeScaleName` (find via `git grep normalizeScaleName`): the alias map is empty; the function may degenerate to identity. Verify behavior, simplify if safe.
- `getDefaultScaleEntry` (line ~346): `scaleEntryByName.get("Major")` → `scaleEntryByName.get("major")`.

- [ ] **Step 3: Update `packages/core/src/theory.ts`**

Find string literals: `git grep -nE '"(Major|Minor|Natural Minor|...)"' packages/core/src/theory.ts` and replace every occurrence with the Tonal equivalent. Particularly `getDivergentNotes` (around line 510-553) which has literal checks:
- `if (resolvedScaleName.includes("Blues"))` → `if (resolvedScaleName.includes("blues"))`
- `if (resolvedScaleName === "Major Pentatonic" || resolvedScaleName === "Minor Pentatonic")` → `if (resolvedScaleName === "major pentatonic" || resolvedScaleName === "minor pentatonic")`
- `if (resolvedScaleName === "Major" || resolvedScaleName === "Natural Minor")` → `if (resolvedScaleName === "major" || resolvedScaleName === "minor")`
- `const refName = isMajorQuality ? "Major" : "Natural Minor"` → `const refName = isMajorQuality ? "major" : "minor"`

- [ ] **Step 4: Update `packages/core/src/degrees.ts`**

`MODE_DEGREES`, `PENTATONIC_DEGREES`, `BLUES_DEGREES`, `DEGREE_DIATONIC_QUALITY` keys are renamed in N4, NOT here. In this task, only update LITERAL references that pass scale names INTO these tables. Specifically:

- `getDegreesForScale` (line ~265-278): `return MODE_DEGREES["Natural Minor"]` → `return MODE_DEGREES["minor"]`. **But wait** — the table key is renamed in N4. To keep the codebase compiling between N2 and N4, defer this literal change to N4 OR temporarily use `MODE_DEGREES["Natural Minor"]` knowing it'll work because the keys aren't renamed yet. For clean ordering, **skip degrees.ts internal literal changes in N2**; they happen in N4 atomically with the table rename.

- However, `buildModeDegrees(scaleName)` (line ~80-95) calls `getModeTriads(scaleName)` and reads `SCALES[scaleName]`. Both of these now expect Tonal-vocabulary input. Update the entries in the `MODE_DEGREES` object literal (line ~98-110):
  - `Major: buildModeDegrees("Major")` → `major: buildModeDegrees("major")`
  - `Lydian: buildModeDegrees("Lydian")` → `lydian: buildModeDegrees("lydian")`
  - etc. (this is a partial rename — the KEY (`Major:` → `major:`) is left to N4, but the ARGUMENT (`buildModeDegrees("Major")` → `buildModeDegrees("major")`) is updated NOW because SCALES is being renamed).

Actually this is getting tangled. **Revised approach: in N2, also rename the `MODE_DEGREES` keys AND `buildModeDegrees` arguments to Tonal vocabulary.** N4 then handles only the pentatonic/blues/diatonic-quality tables (smaller, independent). This keeps each task self-consistent and tests green after each commit.

So in N2 Step 4:

```ts
const MODE_DEGREES: Record<string, Record<number, string>> = {
  major:            buildModeDegrees("major"),
  lydian:           buildModeDegrees("lydian"),
  mixolydian:       buildModeDegrees("mixolydian"),
  minor:            buildModeDegrees("minor"),
  dorian:           buildModeDegrees("dorian"),
  phrygian:         buildModeDegrees("phrygian"),
  locrian:          buildModeDegrees("locrian"),
  "harmonic minor": { 0: "i",  2: "ii°", 3: "III+", 5: "iv", 7: "V", 8: "VI", 11: "vii°" },
};
```

And in `getDegreesForScale`:
- Fallback `return MODE_DEGREES["Natural Minor"]` → `return MODE_DEGREES["minor"]` (both happen here).

- [ ] **Step 5: Update `packages/core/src/lib/tonal.ts` helpers**

`getScaleSemitonesFromTonal` and `getModeTriads` currently call `scaleNameToTonal(name) ?? name`. Since input is now Tonal-vocabulary, simplify:

```ts
export function getScaleSemitonesFromTonal(scaleName: string): number[] {
  const tonalScale = Scale.get(`C ${scaleName}`);
  if (tonalScale.empty) return [];
  return tonalScale.notes
    .map((n) => Note.chroma(n))
    .filter((c): c is number => typeof c === "number" && !isNaN(c));
}

export function getModeTriads(modeName: string): readonly string[] | null {
  const mode = Mode.get(modeName);
  if (mode.empty) return null;
  let suffixes: string[];
  try {
    suffixes = Mode.triads(modeName, "");
  } catch {
    return null;
  }
  if (!suffixes || suffixes.length !== 7) return null;
  try {
    return suffixes.map((s, i) => triadSuffixToRoman(s, i));
  } catch {
    return null;
  }
}
```

(`scaleNameToTonal` is still defined — N5 removes it. The helpers no longer USE it.)

- [ ] **Step 6: Update `src/store/scaleAtoms.ts`**

```ts
// Line 84-89 in current file:
export const baseScaleNameAtom = atomWithStorage(
  k("scaleName.v2"),  // bump key
  "major",            // default changes from "Major"
  scaleNameStorage,
  GET_ON_INIT,
);
```

Also: `colorNotesAtom` literal checks:
- `if (scaleName === "Minor Blues")` → `if (scaleName === "minor blues")`
- `if (scaleName === "Major Blues")` → `if (scaleName === "major blues")`

- [ ] **Step 7: Update all remaining files from Step 1's worklist**

For each file in the worklist:
- Open the file.
- Find every verbose scale-name string literal.
- Replace with the Tonal equivalent from the table.
- Save.

Use `git grep` to verify zero remaining matches after the sweep:

```bash
git grep '"Natural Minor"\|"Harmonic Minor"\|"Melodic Minor"\|"Phrygian Dominant"\|"Major Pentatonic"\|"Minor Pentatonic"\|"Major Blues"\|"Minor Blues"\|"Locrian Natural 6"\|"Ionian Augmented"\|"Dorian Sharp 4"\|"Lydian Sharp 2"\|"Altered Diminished"\|"Dorian Flat 2"\|"Lydian Augmented"\|"Lydian Dominant"\|"Mixolydian Flat 6"\|"Locrian Natural 2"' -- src/ packages/core/src/
```

This should return ZERO matches (the i18n hardcoded display labels in en.ts/es.ts are out of scope for N2 — they're user-facing display strings, not internal vocabulary; N6 handles them).

Be careful with the unqualified words `"Major"`, `"Minor"`, `"Blues"`, `"Ionian"`, `"Dorian"`, etc. — these are common English words that may appear in unrelated string contexts (e.g. user-facing labels in en.ts like `"Major Modes"` for a SECTION HEADER, or `"Blues"` as a family display label). Use surrounding context (e.g. `scaleName: "Major"` or `=== "Major"`) to decide whether each match needs replacement.

The simplest heuristic: a verbose name needs renaming when it appears in code that compares it to or uses it as a key for `SCALES`, `MODE_DEGREES`, or `scaleNameAtom`. Display labels (in i18n strings, CSS, button text) stay.

- [ ] **Step 8: Regenerate the SCALES snapshot**

```bash
pnpm --filter @fretflow/core run test -- theory.test.ts -t "SCALES snapshot" -u
```

This rewrites the SCALES entry in `packages/core/src/__snapshots__/theory.test.ts.snap`. **Inspect the diff before committing:**

```bash
git diff packages/core/src/__snapshots__/theory.test.ts.snap | head -80
```

Expected: every old verbose key gets renamed to its Tonal equivalent. Every value array (interval list) is byte-identical. If any value differs, the rename introduced a bug — STOP and investigate.

- [ ] **Step 9: Run full core suite**

```bash
pnpm --filter @fretflow/core run test
```

Expected: all PASS (some snapshot tests may regen but only for KEY rename). If any test FAILS on a value comparison, fix the bug.

- [ ] **Step 10: Run app suite**

```bash
pnpm test
```

Expected: all PASS. Some component snapshots may need updating if they captured scale display labels — defer that to N6.

If any component test FAILS on a literal `"Phrygian Dominant"` etc. string that wasn't renamed, add it to the worklist and re-sweep.

- [ ] **Step 11: Verify tsc clean**

```bash
pnpm exec tsc -b
```

Expected: zero errors. Any error here means a type-narrowed string union (like `ScaleName` if such a type exists) still references old names.

- [ ] **Step 12: Commit**

```bash
git add packages/core src/store/scaleAtoms.ts src/
git commit -m "refactor(core): rename SCALES keys to Tonal vocabulary

All 28 scale-name keys migrated from FretFlow verbose names
(\"Major\", \"Phrygian Dominant\") to Tonal native vocabulary
(\"major\", \"phrygian dominant\"). Cascades through SCALES,
SCALE_FAMILY_DEFINITIONS.members[].scaleName, MODE_DEGREES keys,
scaleNameAtom (storage version bumped), and all consumers.

Snapshot regenerated: keys renamed, values byte-identical."
```

---

## Task N3: Rename CHORD_DEFINITIONS keys to Tonal symbols + cascade

Same pattern as N2 but for the 15 chord qualities. Read the chord-quality table at the top of this plan.

**Files:**
- Modify: `packages/core/src/theory.ts` — `CHORD_DEFINITIONS` keys (currently `"Major Triad"`, `"Minor 7th"`, etc. as the outer object keys); the `buildChordDef` calls' first argument (the `appQuality` parameter); any other literal chord-name references.
- Modify: `packages/core/src/theory.test.ts` — literal chord-name references in test cases.
- Modify: `packages/core/src/lib/tonal.ts::buildChordDef` consumers — the function takes `appQuality: string`; in N3 the first arg becomes Tonal symbol directly. Rename parameter to `tonalSymbol` for clarity.
- Modify: `packages/core/src/degrees.ts` — `DEGREE_DIATONIC_QUALITY` values like `"Major Triad"` become `"M"` (left to N4, but heads-up).
- Modify: `src/store/progressionAtoms.ts` — `qualityOverride` defaults and any literals.
- Modify: `src/store/songStateAtoms.ts` — same.
- Modify: `src/progressions/progressionDomain.ts` — `qualityOverride === "7" ? "Dominant 7th" : null` line becomes `qualityOverride === "7" ? "7" : null` (i.e. the result is already Tonal-symbol).
- Modify: `src/progressions/progressionGeneration.ts`
- Modify: `src/components/ChordOverlayControls/chordTypeOptions.ts` — likely maps verbose name to UI option.
- Modify: `src/components/SongControls/qualityGroups.ts` — likely groups verbose names.
- Modify: `src/components/Fretboard/Fretboard.wiring.test.tsx`
- Modify: all test files that reference verbose chord names (per Step 1 grep).
- Regenerate: `packages/core/src/__snapshots__/theory.test.ts.snap` (CHORDS and CHORD_DEFINITIONS entries).

- [ ] **Step 1: Enumerate every file touching verbose chord names**

```bash
git grep -l '"Major Triad"\|"Minor Triad"\|"Diminished Triad"\|"Augmented Triad"\|"Sus2"\|"Sus4"\|"Major 6th"\|"Minor 6th"\|"Major 7th"\|"Minor 7th"\|"Dominant 7th"\|"Diminished 7th"\|"Half-Diminished 7th"\|"Minor-Major 7th"\|"Power Chord (5)"' -- src/ packages/core/src/ 2>/dev/null
```

Save the worklist.

- [ ] **Step 2: Rewrite `CHORD_DEFINITIONS` in `packages/core/src/theory.ts`**

Replace the current declaration (lines ~283-300 in current file) with:

```ts
export const CHORD_DEFINITIONS: Record<string, ChordDefinition> = {
  M:     buildChordDef("M",     "triad",     ["root", "3", "5"]),
  m:     buildChordDef("m",     "triad",     ["root", "b3", "5"]),
  dim:   buildChordDef("dim",   "triad",     ["root", "b3", "b5"]),
  aug:   buildChordDef("aug",   "triad",     ["root", "3", "#5"]),
  sus2:  buildChordDef("sus2",  "suspended", ["root", "2", "5"]),
  sus4:  buildChordDef("sus4",  "suspended", ["root", "4", "5"]),
  "6":   buildChordDef("6",     "sixth",     ["root", "3", "5", "6"]),
  m6:    buildChordDef("m6",    "sixth",     ["root", "b3", "5", "6"]),
  maj7:  buildChordDef("maj7",  "seventh",   ["root", "3", "5", "7"]),
  m7:    buildChordDef("m7",    "seventh",   ["root", "b3", "5", "b7"]),
  "7":   buildChordDef("7",     "seventh",   ["root", "3", "5", "b7"]),
  dim7:  buildChordDef("dim7",  "seventh",   ["root", "b3", "b5", "bb7"]),
  m7b5:  buildChordDef("m7b5",  "seventh",   ["root", "b3", "b5", "b7"]),
  mMaj7: buildChordDef("mMaj7", "seventh",   ["root", "b3", "5", "7"]),
  "5":   buildChordDef("5",     "power",     ["root", "5"]),
};
```

Note: `"6"`, `"7"`, `"5"` need quoting because they're numeric-looking strings. `M`, `m`, `dim`, `aug`, `sus2`, `sus4`, `m6`, `maj7`, `m7`, `dim7`, `m7b5`, `mMaj7` are valid JS identifiers and don't need quotes (Prettier may format either way).

- [ ] **Step 3: Update `buildChordDef` in `packages/core/src/theory.ts`**

Currently `buildChordDef(appQuality, quality, memberNames)` calls `chordQualityToTonal(appQuality)`. Since `appQuality` IS the Tonal symbol now, simplify:

```ts
function buildChordDef(
  tonalSymbol: string,
  quality: ChordQuality,
  memberNames: readonly ChordMemberName[],
): ChordDefinition {
  const semitones = getChordSemitonesFromTonal(tonalSymbol);
  if (semitones.length !== memberNames.length) {
    throw new Error(
      `buildChordDef: ${tonalSymbol} expects ${memberNames.length} members, Tonal returned ${semitones.length}`,
    );
  }
  return {
    quality,
    members: memberNames.map((name, i) => ({ name, semitone: semitones[i] })),
  };
}
```

Drop the `chordQualityToTonal` call (it's deleted in N5 anyway; reusing it here would be circular since input is already Tonal).

Also remove the import of `chordQualityToTonal` and `tonalChordSymbol` from `theory.ts` if they're no longer used. Run tsc to verify.

- [ ] **Step 4: Update `getChordNotes` in `packages/core/src/theory.ts`**

Currently uses `tonalChordSymbol(rootNote, chordName)` which prepends the root. Replace with direct `Chord.get(\`${rootNote}${chordName}\`)`:

```ts
export function getChordNotes(rootNote: string, chordName: string): string[] {
  const chroma = Note.chroma(rootNote);
  if (typeof chroma !== "number" || isNaN(chroma)) return [];
  const tonalChord = Chord.get(`${rootNote}${chordName}`);
  if (tonalChord.empty) return [];
  return tonalChord.notes.map((n) => normalizeToSharps(n));
}
```

(Note: `chordName` here is the Tonal SYMBOL like `"m7"`, NOT a root-prefixed name. The function concatenates root + symbol to get a chord NAME like `"Cm7"`.)

- [ ] **Step 5: Update all other files from Step 1's worklist**

Per file, replace verbose chord names with Tonal symbols using the table:
- `"Major Triad"` → `"M"`
- `"Minor Triad"` → `"m"`
- `"Diminished Triad"` → `"dim"`
- `"Augmented Triad"` → `"aug"`
- `"Sus2"` → `"sus2"`
- `"Sus4"` → `"sus4"`
- `"Major 6th"` → `"6"`
- `"Minor 6th"` → `"m6"`
- `"Major 7th"` → `"maj7"`
- `"Minor 7th"` → `"m7"`
- `"Dominant 7th"` → `"7"`
- `"Diminished 7th"` → `"dim7"`
- `"Half-Diminished 7th"` → `"m7b5"`
- `"Minor-Major 7th"` → `"mMaj7"`
- `"Power Chord (5)"` → `"5"`

Default progression steps in `src/store/progressionAtoms.ts:56-61`:
- `qualityOverride: null` stays null. No change needed unless a default has a non-null override (currently they don't).

`progressionDomain.ts:219`: `qualityOverride: q === "7" ? "Dominant 7th" : null` becomes `qualityOverride: q === "7" ? "7" : null`. This is the diatonic-default detection.

`progressionDomain.ts:545`: `step.qualityOverride !== null && CHORD_DEFINITIONS[step.qualityOverride] !== undefined` — works as-is once both sides use Tonal symbols.

`chordTypeOptions.ts` and `qualityGroups.ts`: rewrite the option/group definitions to use Tonal symbols.

`src/utils/abbreviateMusicName.ts`: this helper probably maps verbose names to short forms — its lookup tables likely need rewriting. Audit.

- [ ] **Step 6: Verify zero remaining verbose chord names**

```bash
git grep '"Major Triad"\|"Minor Triad"\|"Diminished Triad"\|"Augmented Triad"\|"Sus2"\|"Sus4"\|"Major 6th"\|"Minor 6th"\|"Major 7th"\|"Minor 7th"\|"Dominant 7th"\|"Diminished 7th"\|"Half-Diminished 7th"\|"Minor-Major 7th"\|"Power Chord"' -- src/ packages/core/src/ 2>/dev/null
```

Expected: zero matches (except possibly in i18n display strings — those stay until N6).

- [ ] **Step 7: Regenerate chord snapshots**

```bash
pnpm --filter @fretflow/core run test -- theory.test.ts -t "snapshot" -u
```

This rewrites both `CHORDS snapshot` and `CHORD_DEFINITIONS snapshot` entries. Inspect the diff:

```bash
git diff packages/core/src/__snapshots__/theory.test.ts.snap
```

Expected: outer keys (`"Major Triad" →"M"`, etc.) renamed; value contents byte-identical. If any value array differs, STOP and investigate.

- [ ] **Step 8: Run full test suites**

```bash
pnpm --filter @fretflow/core run test && pnpm test
```

Expected: all PASS. If any test FAILS due to leftover verbose names, add to worklist and re-sweep.

- [ ] **Step 9: Verify tsc clean**

```bash
pnpm exec tsc -b
```

Expected: zero errors.

- [ ] **Step 10: Commit**

```bash
git add packages/core src/
git commit -m "refactor(core): rename CHORD_DEFINITIONS keys to Tonal symbols

All 15 chord-quality keys migrated from FretFlow verbose names
(\"Major Triad\", \"Minor 7th\", \"Power Chord (5)\") to Tonal
native symbols (\"M\", \"m7\", \"5\"). Cascades through CHORDS,
qualityOverride values, default progression steps, and all
consumers. buildChordDef simplified to take Tonal symbol directly.

Snapshots regenerated: keys renamed, values byte-identical."
```

---

## Task N4: Rename degree-table keys + cascade

`degrees.ts` has 4 tables keyed by scale name. N2 already renamed `MODE_DEGREES`. This task handles the remaining three.

**Files:**
- Modify: `packages/core/src/degrees.ts` — `PENTATONIC_DEGREES`, `BLUES_DEGREES`, `DEGREE_DIATONIC_QUALITY` keys; the diatonic-quality value strings (e.g. `"Major Triad"` → `"M"` was already done in N3, but check).
- Modify: `packages/core/src/degrees.test.ts` — literal references.
- Regenerate: `packages/core/src/__snapshots__/degrees.test.ts.snap` (3 entries).

- [ ] **Step 1: Update `PENTATONIC_DEGREES` (line ~117-120)**

```ts
const PENTATONIC_DEGREES: Record<string, Record<number, string>> = {
  "major pentatonic": { 0: "I", 2: "ii", 4: "iii", 7: "V", 9: "vi" },
  "minor pentatonic": { 0: "i", 3: "III", 5: "iv", 7: "v", 10: "VII" },
};
```

- [ ] **Step 2: Update `BLUES_DEGREES` (line ~122-125)**

```ts
const BLUES_DEGREES: Record<string, Record<number, string>> = {
  "major blues": PENTATONIC_DEGREES["major pentatonic"],
  "minor blues": PENTATONIC_DEGREES["minor pentatonic"],
};
```

- [ ] **Step 3: Update `DEGREE_DIATONIC_QUALITY` (line ~164-177)**

Both the outer keys (scale names) AND the values (chord qualities) get renamed. Use the Tonal chord-quality table from N3:

```ts
const DEGREE_DIATONIC_QUALITY: Record<string, Record<number, string>> = {
  major:            { 0: "M", 2: "m", 4: "m", 5: "M", 7: "M", 9: "m", 11: "dim" },
  minor:            { 0: "m", 2: "dim", 3: "M", 5: "m", 7: "m", 8: "M", 10: "M" },
  dorian:           { 0: "m", 2: "m", 3: "M", 5: "M", 7: "m", 9: "dim", 10: "M" },
  phrygian:         { 0: "m", 1: "M", 3: "M", 5: "m", 7: "dim", 8: "M", 10: "m" },
  lydian:           { 0: "M", 2: "M", 4: "m", 6: "dim", 7: "M", 9: "m", 11: "m" },
  mixolydian:       { 0: "M", 2: "m", 4: "dim", 5: "M", 7: "m", 9: "m", 10: "M" },
  locrian:          { 0: "dim", 1: "M", 3: "m", 5: "m", 6: "M", 8: "M", 10: "m" },
  "harmonic minor": { 0: "m", 2: "dim", 3: "M", 5: "m", 7: "M", 8: "M", 11: "dim" },
  "major pentatonic": { 0: "M", 2: "m", 4: "m", 7: "M", 9: "m" },
  "minor pentatonic": { 0: "m", 3: "M", 5: "m", 7: "m", 10: "M" },
  "major blues":      { 0: "M", 2: "m", 4: "m", 7: "M", 9: "m" },
  "minor blues":      { 0: "m", 3: "M", 5: "m", 7: "m", 10: "M" },
};
```

- [ ] **Step 4: Update algorithmic fallback in `getQualityForDegree`**

Currently around line ~217-220:

```ts
if (thirdInterval === 3 && fifthInterval === 6) return "Diminished Triad";
if (thirdInterval === 3) return "Minor Triad";
if (thirdInterval === 4) return "Major Triad";
return undefined;
```

Becomes:

```ts
if (thirdInterval === 3 && fifthInterval === 6) return "dim";
if (thirdInterval === 3) return "m";
if (thirdInterval === 4) return "M";
return undefined;
```

- [ ] **Step 5: Update `degrees.test.ts`**

Any test referencing verbose chord names in expectations becomes Tonal symbol:
- `expect(getQualityForDegree("I", "Major")).toBe("Major Triad")` → `expect(getQualityForDegree("I", "major")).toBe("M")`

Use the rename tables to translate every assertion. The test file is 772+ lines — use `git diff` after each batch to verify clean edits.

- [ ] **Step 6: Regenerate degree snapshots**

```bash
pnpm --filter @fretflow/core run test -- degrees.test.ts -t "snapshot" -u
```

Inspect:

```bash
git diff packages/core/src/__snapshots__/degrees.test.ts.snap | head -50
```

Expected: scale-name keys at the outermost level renamed to Tonal vocabulary. Quality values in `getQualityForDegree` snapshot renamed to Tonal symbols. Values byte-identical otherwise (same triad assignments, same diatonic logic).

- [ ] **Step 7: Run full test suites**

```bash
pnpm --filter @fretflow/core run test && pnpm test
```

Expected: all PASS.

- [ ] **Step 8: Verify tsc clean**

```bash
pnpm exec tsc -b
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/degrees.ts packages/core/src/degrees.test.ts packages/core/src/__snapshots__/degrees.test.ts.snap
git commit -m "refactor(core): rename degrees.ts tables to Tonal vocabulary

PENTATONIC_DEGREES, BLUES_DEGREES, DEGREE_DIATONIC_QUALITY keys
renamed to Tonal scale names. DEGREE_DIATONIC_QUALITY values
renamed to Tonal chord symbols. Algorithmic fallback in
getQualityForDegree returns Tonal symbols.

Snapshots regenerated."
```

---

## Task N5: Delete adapters + bump storage versions

Now that no internal consumer needs the adapters, delete them. Bump storage keys.

**Files:**
- Modify: `packages/core/src/lib/tonal.ts` — delete `QUALITY_TO_TONAL`, `TONAL_TO_QUALITY`, `SCALE_TO_TONAL`, `TONAL_TO_SCALE`, `chordQualityToTonal`, `tonalToChordQuality`, `scaleNameToTonal`, `tonalToScaleName`, `tonalChordSymbol`.
- Modify: `packages/core/src/lib/tonal.test.ts` — drop tests for the deleted functions (`describe("chord-name adapter", ...)`, `describe("scale-name adapter", ...)`).
- Modify: `src/store/progressionAtoms.ts` — `progressionStepsAtom` storage key bump (already done in N3 if defaults changed, otherwise do it here).
- Modify: `src/store/scaleAtoms.ts` — `baseScaleNameAtom` storage key bump (done in N2).
- Audit: any other atom that persists verbose vocabulary. Use:

```bash
git grep -nE 'k\(' src/store/ | grep -v test | head -30
```

- [ ] **Step 1: Delete adapter functions and tables in `packages/core/src/lib/tonal.ts`**

Remove these definitions (lines ~16-100):
- `QUALITY_TO_TONAL` const
- `TONAL_TO_QUALITY` const
- `SCALE_TO_TONAL` const
- `TONAL_TO_SCALE` const
- `chordQualityToTonal` function
- `tonalToChordQuality` function
- `scaleNameToTonal` function
- `tonalToScaleName` function
- `tonalChordSymbol` function

Also remove from `transposeNoteToSharps` if it uses any of these (it doesn't currently per code review, but verify).

- [ ] **Step 2: Delete adapter tests in `packages/core/src/lib/tonal.test.ts`**

Remove these `describe` blocks:
- `describe("chord-name adapter", () => { ... })` (around lines 4-32)
- `describe("scale-name adapter", () => { ... })` (around lines 34-53)

Update the import line to remove `chordQualityToTonal`, `tonalToChordQuality`, `scaleNameToTonal`, `tonalToScaleName`.

- [ ] **Step 3: Verify no consumer remains**

```bash
git grep -n 'chordQualityToTonal\|tonalToChordQuality\|scaleNameToTonal\|tonalToScaleName\|tonalChordSymbol\|QUALITY_TO_TONAL\|SCALE_TO_TONAL' -- src/ packages/core/src/
```

Expected: zero matches. If any consumer remains, update it to call Tonal directly (`Chord.get`, `Scale.get`, etc.) or remove the call.

- [ ] **Step 4: Audit atoms for verbose-name storage**

```bash
grep -n "k(" src/store/*.ts | grep -v test
```

For each atom that calls `atomWithStorage(k("..."), defaultValue, ...)`, check:
- Does `defaultValue` use verbose names? (e.g. `"Major Triad"`)
- Does the persisted shape contain verbose name strings (e.g. inside a `ProgressionStep`)?

If yes, bump the version: `k("foo")` → `k("foo.v2")`. Update the default.

Already done:
- `baseScaleNameAtom` — `k("scaleName")` → `k("scaleName.v2")` in N2.

Likely targets:
- `progressionStepsAtom` — already bumped in N3 if defaults changed. Otherwise: `k("progressionSteps")` → `k("progressionSteps.v2")`.

For `progressionStepsAtom`, the `qualityOverride` field of persisted steps used to be verbose chord names. Bumping the key drops old data and resets to N3's Tonal-symbol defaults. **Document in the commit message that existing user data is dropped by design.**

```ts
// src/store/progressionAtoms.ts:94
export const progressionStepsAtom = atomWithStorage<ProgressionStep[]>(
  k("progressionSteps.v2"),  // bumped
  DEFAULT_STEPS,
  progressionStepsStorage,
  GET_ON_INIT,
);
```

- [ ] **Step 5: Run full test suites**

```bash
pnpm --filter @fretflow/core run test && pnpm test
```

Expected: all PASS. The deletion in Step 1-2 should not cause any test failure if Steps 3-4 are clean.

- [ ] **Step 6: Verify tsc clean**

```bash
pnpm exec tsc -b
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts src/store/progressionAtoms.ts src/store/scaleAtoms.ts
git commit -m "refactor(core): delete adapter tables and bump storage versions

Removes QUALITY_TO_TONAL, SCALE_TO_TONAL, and the 5 bidirectional
adapter functions (chordQualityToTonal, scaleNameToTonal,
tonalToChordQuality, tonalToScaleName, tonalChordSymbol). All
consumers now use Tonal vocabulary natively.

Storage versions bumped on progressionStepsAtom and scaleNameAtom
(if not already bumped in prior tasks). Existing user data drops
to defaults — intentional, per design."
```

---

## Task N6: Strip hardcoded i18n verbose names + wire display helpers

UI text in `en.ts` and `es.ts` currently hardcodes verbose chord names. Replace with Tonal-derived helpers.

**Files:**
- Modify: `src/i18n/en.ts` — drop `fullChordsHintUnsupportedType` literal chord list; rewrite as generic.
- Modify: `src/i18n/es.ts` — same.
- Modify: `src/i18n/types.ts` — keep `fullChordsHintUnsupportedType` key but with updated string content; don't remove key.
- Modify: any component that previously hardcoded chord display labels — switch to `getChordDisplayLabel(symbol)` / `getScaleDisplayLabel(name)`.
- Audit: `LabeledSelect` consumers in `ChordOverlayControls`, `SongControls`, etc. — if they showed verbose names as option labels, wire through display helpers.

- [ ] **Step 1: Identify all UI sites that displayed verbose chord/scale names**

```bash
git grep -nE 'chordType|chordName|scaleName|quality' src/components/ 2>/dev/null | grep -v test | grep -v '.module.css' | head -30
```

Look for places where a raw chord-quality string or scale-name string was rendered into the DOM. These need wiring to display helpers.

- [ ] **Step 2: Rewrite `fullChordsHintUnsupportedType` strings**

`src/i18n/en.ts`:

```ts
// Old:
fullChordsHintUnsupportedType: "Full Chords currently supports Major Triad, Minor Triad, and Dominant 7th.",
// New:
fullChordsHintUnsupportedType: "Full Chords currently supports major and minor triads and dominant seventh chords.",
```

`src/i18n/es.ts`:

```ts
// Old:
fullChordsHintUnsupportedType: "Acordes completos solo admite Tríada Mayor, Tríada Menor y Séptima Dominante.",
// New (Spanish — keep original-spirit translation):
fullChordsHintUnsupportedType: "Acordes completos solo admite tríadas mayores y menores y acordes de séptima dominante.",
```

The change removes the verbose-name list but keeps the user-friendly phrasing.

- [ ] **Step 3: Wire display helpers into chord-quality dropdowns**

Find every `<LabeledSelect>` or `<select>` that renders chord-quality options. Each option currently displays the raw key (now a Tonal symbol — looks ugly). Wrap with the display helper.

Example pattern — in `src/components/SongControls/SongControls.tsx` or wherever the chord-quality dropdown renders options:

```tsx
import { getChordDisplayLabel } from "@fretflow/core";

// Inside the options.map:
options.map(({ value, ... }) => ({
  value,
  label: getChordDisplayLabel(value),  // was: label: value
}));
```

If the component uses `chordTypeOptions.ts` or `qualityGroups.ts` (from `src/components/...`), update those to either store the display label alongside the value OR compute it on render via the helper.

- [ ] **Step 4: Wire display helpers into scale-name dropdowns**

Same pattern. The catalog already provides `displayLabel` / `shortLabel` in `SCALE_FAMILY_DEFINITIONS.members[]` — these are the existing user-facing English strings (e.g. `"Major (Ionian)"`, `"Phrygian Dominant"`). They stay as-is and are still the source for dropdowns. Only ensure no code is rendering the raw `scaleName` (now lowercase `"major"`, `"phrygian dominant"`) directly into the UI.

If any code does, swap it to use the catalog's `displayLabel` / `shortLabel`, OR wrap with `getScaleDisplayLabel`.

- [ ] **Step 5: Run full test suites**

```bash
pnpm test
```

Expected: all PASS. Some component snapshot tests may need updating if they captured chord/scale labels. Update via `-u` ONLY if the diff shows the expected change ("Minor 7th" → "minor seventh" in label text). If the diff shows anything unexpected, STOP and investigate.

- [ ] **Step 6: Verify tsc clean**

```bash
pnpm exec tsc -b
```

- [ ] **Step 7: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts src/i18n/types.ts src/components/
git commit -m "refactor(i18n): wire Tonal-derived display labels into UI

Strips hardcoded chord/scale display labels from en.ts/es.ts and
component dropdowns. UI now renders user-friendly labels via
getChordDisplayLabel/getScaleDisplayLabel (English-only per spec).

fullChordsHintUnsupportedType reworded to drop the verbose chord
list. Spanish translation kept in spirit; chord/scale labels in
dropdowns now render in English regardless of locale (intentional,
per design)."
```

---

## Task N7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

Expected: PASS, zero new warnings.

- [ ] **Step 2: Unit + integration tests**

```bash
pnpm test
```

Expected: all PASS (test count similar to ~1965 from M-series).

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: tsc compiles, Vite builds.

- [ ] **Step 4: E2E**

```bash
pnpm test:e2e:production
```

Expected: 50/50 PASS.

- [ ] **Step 5: Visual regression**

```bash
pnpm test:visual
```

Expected: likely 1-3 baselines diff because dropdown labels changed from "Minor 7th" to "minor seventh" etc. **This is expected and acceptable** — the vocabulary change is user-visible by design.

If baselines diff:
1. Inspect the diff images. Confirm they show ONLY the expected label changes.
2. If yes, run `pnpm test:visual:update` to refresh and commit:

```bash
git add e2e
git commit -m "test(visual): refresh baselines for Phase N vocabulary change

Dropdown labels now render Tonal-derived English names
(\"minor seventh\" instead of \"Minor 7th\") per Phase N design."
```

3. If diffs show unexpected layout shifts or text in wrong places, STOP — the i18n wiring in N6 has a bug.

- [ ] **Step 6: Final state check**

```bash
git log --oneline -10 && git status
```

Expected: 6 task commits + (optionally) visual baseline refresh on top of the spec commit. Working tree clean.

---

## Self-Review

**Spec coverage:**
- N1 display helpers → Task N1 ✓
- N2 scale-name rename + SCALES projection ✓
- N3 chord-symbol rename + CHORD_DEFINITIONS projection ✓
- N4 degree table rename ✓
- N5 adapter removal + storage version bump ✓
- N6 i18n strip + display wiring ✓
- N7 verification ✓
- Spec note "Spanish chord/scale labels render in English regardless of locale" → N6 Step 4 documentation ✓
- Spec note "Storage version bump, no migrator" → N2 Step 6 + N5 Step 4 ✓
- Spec note "M-series snapshots regenerated under new keys, manually verified" → N2 Step 8, N3 Step 7, N4 Step 6 ✓

**Placeholder scan:** Several steps say "audit" or "find" — these are real grep instructions with specific commands and explicit acceptance criteria (zero matches), not placeholders.

**Type consistency:**
- `getChordDisplayLabel(chordSymbol: string): string` — defined N1, consumed N6.
- `getScaleDisplayLabel(scaleName: string): string` — defined N1, consumed N6.
- `buildChordDef(tonalSymbol, quality, memberNames)` — renamed parameter in N3 Step 3.
- `CHORD_DEFINITIONS` and `SCALES` keys consistent across N2/N3/N4 via the authoritative tables at the top.

**Issues found:** None.

---

## Notes for the executing agent

1. **N2 and N3 are large multi-file sweeps.** Expect 30-60 file edits each. Use `git grep -l '...'` to enumerate the worklist exhaustively before starting, then work file-by-file. Commit only after the full sweep + snapshot regen + full test pass.

2. **The two snapshot regen operations (N2 Step 8, N3 Step 7, N4 Step 6) are the ONLY acceptable uses of `-u` in this plan.** All other test runs MUST pass without snapshot updates. If a test fails on a non-targeted snapshot, that's a bug — investigate, don't update.

3. **Verbose words like `"Major"`, `"Minor"`, `"Blues"` are common English words.** Use grep CONTEXT to decide whether each match is a code-level scale/quality reference (needs renaming) vs. a user-facing label (stays as English text in i18n or display strings). When in doubt, the rule: anything compared to `SCALES`, `MODE_DEGREES`, `CHORD_DEFINITIONS`, or used as a key/value for those = rename; anything in a user-facing string = leave.

4. **Storage version bump drops user data by design.** Existing PR #451 users with custom progressions will lose them on next load. Documented and accepted.

5. **Spanish UI now shows English chord/scale labels.** This is the explicit scope decision. Localization of music-theory terms is a future PR.

6. **Visual baseline refresh in N7 Step 5 is EXPECTED.** The dropdown labels visibly change. Inspect diffs carefully but refresh if they only show expected text changes.
