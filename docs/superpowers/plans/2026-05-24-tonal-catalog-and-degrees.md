# Tonal Catalog & Degrees Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/mode`, and `@tonaljs/roman-numeral` the source of truth for music-theory intervals and diatonic triad qualities, retiring FretFlow's redundant hand-coded interval tables while keeping all UI metadata and public API shapes.

**Architecture:** Five sequential tasks. T1 captures every catalog + degree output as a snapshot. T2 swaps `SCALES` interval source to `Scale.get(...)`. T3 swaps `CHORD_DEFINITIONS.members[].semitone` to `Chord.get(...)` (member names stay hand-coded). T4 derives diatonic `MODE_DEGREES` from `Mode.get(...).triads`, uses `RomanNumeral.get(...)` for degree parsing where possible. T5 verifies. Each task's safety net is the T1 snapshot — any drift = STOP.

**Tech Stack:** TypeScript, Vitest, `@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/mode` (new), `@tonaljs/roman-numeral` (new), `@tonaljs/note`, `@tonaljs/interval`.

**Spec:** `docs/superpowers/specs/2026-05-24-tonal-catalog-and-degrees-design.md`

---

## File Structure

**Modified:**
- `packages/core/src/lib/tonal.ts` — three new exports: `getScaleSemitonesFromTonal`, `getChordSemitonesFromTonal`, `getModeTriads`.
- `packages/core/src/theoryCatalog.ts` — `SCALE_FAMILY_DEFINITIONS` drops inline `intervals` field; `SCALES` derives from Tonal.
- `packages/core/src/theory.ts` — `CHORD_DEFINITIONS` derives semitones from Tonal positionally; hand-coded `members[].name` order preserved.
- `packages/core/src/degrees.ts` — diatonic entries in `MODE_DEGREES` + `DEGREE_DIATONIC_QUALITY` derived from `Mode.get`; `getQualityForDegree` uses `RomanNumeral.get` with fallback.
- `packages/core/src/theory.test.ts` — add snapshot tests for `SCALES`, `CHORDS`, `CHORD_DEFINITIONS`.
- `packages/core/src/degrees.test.ts` — add snapshot test for degree outputs.
- `packages/core/package.json` + `pnpm-lock.yaml` — add `@tonaljs/mode`, `@tonaljs/roman-numeral`.

**Do NOT modify:** `src/`, `e2e/`, `packages/core/src/index.ts` (public API surface unchanged), or anything outside `packages/core/src/`.

---

## Task M1: Snapshot lock for catalog + degree outputs

Safety net for T2-T4. Capture every public output that will move.

**Files:**
- Modify: `packages/core/src/theory.test.ts`
- Modify: `packages/core/src/degrees.test.ts`
- Generated: `packages/core/src/__snapshots__/theory.test.ts.snap` (already exists from Phase A — will be extended)
- Generated: `packages/core/src/__snapshots__/degrees.test.ts.snap`

- [ ] **Step 1: Add snapshot tests to `theory.test.ts`**

Append this block at the end of `packages/core/src/theory.test.ts` (after the existing top-level `describe` blocks; create a new top-level `describe` for clarity):

```ts
describe("catalog snapshots (pre-Tonal-migration lock)", () => {
  it("SCALES snapshot — all 28 entries", () => {
    expect(SCALES).toMatchSnapshot();
  });

  it("CHORDS snapshot — all 15 entries", () => {
    expect(CHORDS).toMatchSnapshot();
  });

  it("CHORD_DEFINITIONS snapshot — full structure including member names", () => {
    expect(CHORD_DEFINITIONS).toMatchSnapshot();
  });
});
```

Ensure the imports at the top of `theory.test.ts` include `SCALES`, `CHORDS`, and `CHORD_DEFINITIONS`. If they're not already imported, add them to the existing import line from `"./theory"`.

- [ ] **Step 2: Add snapshot test to `degrees.test.ts`**

Append at the end of `packages/core/src/degrees.test.ts`:

```ts
import { SCALES } from "./theoryCatalog";
import {
  getDegreesForScale,
  getQualityForDegree,
  getDegreeSequence,
} from "./degrees";

describe("degree outputs snapshot (pre-Tonal-migration lock)", () => {
  it("getDegreesForScale across all 28 scales", () => {
    const snapshot: Record<string, Record<number, string>> = {};
    for (const scaleName of Object.keys(SCALES)) {
      snapshot[scaleName] = getDegreesForScale(scaleName);
    }
    expect(snapshot).toMatchSnapshot();
  });

  it("getDegreeSequence across all 28 scales", () => {
    const snapshot: Record<string, string[]> = {};
    for (const scaleName of Object.keys(SCALES)) {
      snapshot[scaleName] = getDegreeSequence(scaleName);
    }
    expect(snapshot).toMatchSnapshot();
  });

  it("getQualityForDegree for every (scale, degree) pair the catalog produces", () => {
    const snapshot: Record<string, Record<string, string | undefined>> = {};
    for (const scaleName of Object.keys(SCALES)) {
      const degrees = getDegreeSequence(scaleName);
      const inner: Record<string, string | undefined> = {};
      for (const degree of degrees) {
        inner[degree] = getQualityForDegree(degree, scaleName);
      }
      snapshot[scaleName] = inner;
    }
    expect(snapshot).toMatchSnapshot();
  });
});
```

Note: if `degrees.test.ts` already imports some of these, merge rather than duplicate.

- [ ] **Step 3: Seed the snapshots**

Run from repo root:

```bash
pnpm --filter @fretflow/core run test
```

Expected: all existing tests PASS plus 5 new snapshot tests CREATE snapshots and PASS.

- [ ] **Step 4: Verify snapshot files exist**

Run:

```bash
ls -la packages/core/src/__snapshots__/
```

Expected: `theory.test.ts.snap` (updated with new entries) and `degrees.test.ts.snap` (newly created).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theory.test.ts packages/core/src/degrees.test.ts packages/core/src/__snapshots__/
git commit -m "test(core): snapshot catalog and degree outputs pre-Tonal-migration

Locks SCALES, CHORDS, CHORD_DEFINITIONS, getDegreesForScale,
getDegreeSequence, and getQualityForDegree outputs across all
28 scales. Safety net for the upcoming Tonal catalog refactor."
```

---

## Task M2: SCALES derived from Tonal

Replace the hand-coded `intervals` field in `SCALE_FAMILY_DEFINITIONS` member literals with derivation from `Scale.get(...)`.

**Files:**
- Modify: `packages/core/src/lib/tonal.ts`
- Modify: `packages/core/src/theoryCatalog.ts`

- [ ] **Step 1: Add `getScaleSemitonesFromTonal` helper**

In `packages/core/src/lib/tonal.ts`, after the existing exports (at the bottom of the file), add:

```ts
import * as Scale from "@tonaljs/scale";

/**
 * Returns the semitone offsets (0-11) of a scale, derived from Tonal.
 * Used as the source of truth for FretFlow's interval data in
 * SCALES (theoryCatalog.ts) and downstream consumers.
 *
 * Returns an empty array if the scale name isn't recognized — callers
 * must treat empty as a hard error during catalog construction (every
 * FretFlow scale must resolve).
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

If `Scale` isn't already imported at the top of `lib/tonal.ts`, add `import * as Scale from "@tonaljs/scale";` next to the existing `Note` and `Interval` imports rather than duplicating the import line.

- [ ] **Step 2: Add unit tests for `getScaleSemitonesFromTonal`**

At the bottom of `packages/core/src/lib/tonal.test.ts`, add:

```ts
import { getScaleSemitonesFromTonal } from "./tonal";

describe("getScaleSemitonesFromTonal", () => {
  it("returns Major scale semitones", () => {
    expect(getScaleSemitonesFromTonal("Major")).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it("returns Natural Minor semitones", () => {
    expect(getScaleSemitonesFromTonal("Natural Minor")).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });
  it("returns Minor Pentatonic semitones", () => {
    expect(getScaleSemitonesFromTonal("Minor Pentatonic")).toEqual([0, 3, 5, 7, 10]);
  });
  it("returns Lydian Dominant semitones", () => {
    expect(getScaleSemitonesFromTonal("Lydian Dominant")).toEqual([0, 2, 4, 6, 7, 9, 10]);
  });
  it("returns empty array for unknown scale", () => {
    expect(getScaleSemitonesFromTonal("Bogus Scale")).toEqual([]);
  });
});
```

Update the existing test file's import line to include `getScaleSemitonesFromTonal` if it's not already.

- [ ] **Step 3: Run unit tests**

```bash
pnpm --filter @fretflow/core run test -- tonal.test.ts
```

Expected: all PASS. If any FAIL, investigate immediately — the helper must produce the same intervals FretFlow currently hand-codes.

- [ ] **Step 4: Refactor `SCALE_FAMILY_DEFINITIONS` to drop inline intervals**

In `packages/core/src/theoryCatalog.ts`:

(a) Update the `ScaleMemberDefinition` interface (around line 25). Currently:

```ts
interface ScaleMemberDefinition extends ScaleMember {
  intervals: readonly number[];
}
```

Remove the `intervals` field — change to:

```ts
interface ScaleMemberDefinition extends ScaleMember {
  // intervals derived from Tonal at module-load time
}
```

(b) Remove the `intervals: [...]` field from every member literal in `SCALE_FAMILY_DEFINITIONS` (lines ~77-293). Example: the "Major" entry becomes:

```ts
{
  scaleName: "Major",
  displayLabel: "Major (Ionian)",
  shortLabel: "Ionian",
  parentMajorOffset: 0,
},
```

Repeat for all 28 entries across the 5 families.

(c) Update the `SCALES` export (currently lines ~313-317) to derive from Tonal:

```ts
import { getScaleSemitonesFromTonal } from "./lib/tonal";

export const SCALES: Record<string, number[]> = Object.fromEntries(
  SCALE_FAMILY_DEFINITIONS.flatMap((family) =>
    family.members.map((member) => {
      const intervals = getScaleSemitonesFromTonal(member.scaleName);
      if (intervals.length === 0) {
        throw new Error(
          `theoryCatalog: scale "${member.scaleName}" not resolvable via Tonal`,
        );
      }
      return [member.scaleName, intervals];
    }),
  ),
);
```

Move the `import { getScaleSemitonesFromTonal }` line to the top of the file alongside other imports.

- [ ] **Step 5: Run the M1 snapshot test**

```bash
pnpm --filter @fretflow/core run test -- theory.test.ts -t "SCALES snapshot"
```

Expected: PASS. The SCALES export must be byte-identical to the M1 snapshot. If it FAILS, STOP. Do NOT `--update-snapshots`. Investigate which scale's interval array differs. The most likely cause is Tonal returning a different note spelling that maps to a different chroma — unlikely for the 28 we already proved cover cleanly, but the snapshot is the safety net.

- [ ] **Step 6: Run full core test suite**

```bash
pnpm --filter @fretflow/core run test
```

Expected: all PASS (existing + 5 new unit tests + 5 M1 snapshot tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts packages/core/src/theoryCatalog.ts
git commit -m "refactor(core): derive SCALES from Tonal Scale.get

SCALE_FAMILY_DEFINITIONS drops the inline intervals field; SCALES
projects from Tonal via the new getScaleSemitonesFromTonal helper.
Catalog UI metadata (selectorLabel, parentMajorOffset, etc.) stays
hand-coded; only the interval data is now Tonal-sourced.

Snapshot from previous commit verifies byte-equivalence."
```

---

## Task M3: CHORD_DEFINITIONS semitones derived from Tonal

Replace `members[].semitone` literals with positional derivation from `Chord.get(symbol).intervals`. Keep `members[].name` hand-coded.

**Files:**
- Modify: `packages/core/src/lib/tonal.ts`
- Modify: `packages/core/src/theory.ts`

- [ ] **Step 1: Add `getChordSemitonesFromTonal` helper**

In `packages/core/src/lib/tonal.ts`, at the bottom:

```ts
import * as Chord from "@tonaljs/chord";

/**
 * Returns the semitone offsets (0-11) of a chord's intervals, derived
 * from Tonal. Used as the source of truth for FretFlow's chord-tone
 * positions in CHORD_DEFINITIONS (theory.ts).
 *
 * The order matches Tonal's interval array (root first, then ascending);
 * callers map this positionally onto members[].name, which stays
 * hand-coded as the chord-tone-overlay contract.
 *
 * Returns an empty array if the chord symbol isn't recognized.
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

If `Chord` isn't already imported at top, add `import * as Chord from "@tonaljs/chord";` alongside the others.

- [ ] **Step 2: Add unit tests**

At the bottom of `packages/core/src/lib/tonal.test.ts`:

```ts
import { getChordSemitonesFromTonal } from "./tonal";

describe("getChordSemitonesFromTonal", () => {
  it("returns Major Triad semitones (root, 3, 5)", () => {
    expect(getChordSemitonesFromTonal("M")).toEqual([0, 4, 7]);
  });
  it("returns Minor 7th semitones (root, b3, 5, b7)", () => {
    expect(getChordSemitonesFromTonal("m7")).toEqual([0, 3, 7, 10]);
  });
  it("returns Diminished 7th semitones (root, b3, b5, bb7)", () => {
    expect(getChordSemitonesFromTonal("dim7")).toEqual([0, 3, 6, 9]);
  });
  it("returns Power Chord semitones (root, 5)", () => {
    expect(getChordSemitonesFromTonal("5")).toEqual([0, 7]);
  });
  it("returns Sus2 semitones (root, 2, 5)", () => {
    expect(getChordSemitonesFromTonal("sus2")).toEqual([0, 2, 7]);
  });
  it("returns empty array for unknown symbol", () => {
    expect(getChordSemitonesFromTonal("ZZZ")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the new unit tests**

```bash
pnpm --filter @fretflow/core run test -- tonal.test.ts
```

Expected: all PASS.

- [ ] **Step 4: Refactor `CHORD_DEFINITIONS` to derive semitones**

In `packages/core/src/theory.ts`, the current `CHORD_DEFINITIONS` (lines ~233-361) hand-codes every `semitone`. Refactor to a builder that derives them positionally:

(a) Add a private helper near the top of the file (after the existing imports + types, before `CHORD_DEFINITIONS`):

```ts
import {
  chordQualityToTonal,
  scaleNameToTonal,
  tonalChordSymbol,
  normalizeToSharps,
  getChordSemitonesFromTonal,
} from "./lib/tonal";

/**
 * Builds a ChordDefinition by deriving member semitones from Tonal
 * positionally, keeping the hand-coded member names as the contract
 * for the chord-tone overlay. Throws if Tonal can't resolve the symbol
 * or if the member count doesn't match Tonal's interval count.
 */
function buildChordDef(
  appQuality: string,
  quality: ChordQuality,
  memberNames: readonly ChordMemberName[],
): ChordDefinition {
  const symbol = chordQualityToTonal(appQuality);
  if (symbol === undefined) {
    throw new Error(`buildChordDef: unknown FretFlow quality "${appQuality}"`);
  }
  const semitones = getChordSemitonesFromTonal(symbol);
  if (semitones.length !== memberNames.length) {
    throw new Error(
      `buildChordDef: ${appQuality} expects ${memberNames.length} members, Tonal returned ${semitones.length}`,
    );
  }
  return {
    quality,
    members: memberNames.map((name, i) => ({ name, semitone: semitones[i] })),
  };
}
```

(b) Replace the `CHORD_DEFINITIONS` definition with the builder-based form. For each entry, pass the same hand-coded `members[].name` order; semitones come from Tonal:

```ts
export const CHORD_DEFINITIONS: Record<string, ChordDefinition> = {
  "Major Triad":         buildChordDef("Major Triad",         "triad",     ["root", "3", "5"]),
  "Minor Triad":         buildChordDef("Minor Triad",         "triad",     ["root", "b3", "5"]),
  "Diminished Triad":    buildChordDef("Diminished Triad",    "triad",     ["root", "b3", "b5"]),
  "Major 6th":           buildChordDef("Major 6th",           "sixth",     ["root", "3", "5", "6"]),
  "Major 7th":           buildChordDef("Major 7th",           "seventh",   ["root", "3", "5", "7"]),
  "Minor 7th":           buildChordDef("Minor 7th",           "seventh",   ["root", "b3", "5", "b7"]),
  "Dominant 7th":        buildChordDef("Dominant 7th",        "seventh",   ["root", "3", "5", "b7"]),
  "Sus4":                buildChordDef("Sus4",                "suspended", ["root", "4", "5"]),
  "Power Chord (5)":     buildChordDef("Power Chord (5)",     "power",     ["root", "5"]),
  "Augmented Triad":     buildChordDef("Augmented Triad",     "triad",     ["root", "3", "#5"]),
  "Sus2":                buildChordDef("Sus2",                "suspended", ["root", "2", "5"]),
  "Minor 6th":           buildChordDef("Minor 6th",           "sixth",     ["root", "b3", "5", "6"]),
  "Diminished 7th":      buildChordDef("Diminished 7th",      "seventh",   ["root", "b3", "b5", "bb7"]),
  "Half-Diminished 7th": buildChordDef("Half-Diminished 7th", "seventh",   ["root", "b3", "b5", "b7"]),
  "Minor-Major 7th":     buildChordDef("Minor-Major 7th",     "seventh",   ["root", "b3", "5", "7"]),
};
```

The `CHORDS` derived export (`Object.fromEntries(Object.entries(CHORD_DEFINITIONS).map(...))`) directly below it stays unchanged — it still projects from `CHORD_DEFINITIONS`.

- [ ] **Step 5: Run the M1 snapshots**

```bash
pnpm --filter @fretflow/core run test -- theory.test.ts -t "snapshot"
```

Expected: PASS on the `CHORDS snapshot` and `CHORD_DEFINITIONS snapshot` tests. If either FAILS, the most likely cause is Tonal returning intervals in a different order for some chord — STOP and report which chord differs. The fix is then to reorder the `memberNames` array for that specific chord to match Tonal's order, but the member NAMES (the strings themselves) must stay the same.

- [ ] **Step 6: Run full core test suite**

```bash
pnpm --filter @fretflow/core run test
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts packages/core/src/theory.ts
git commit -m "refactor(core): derive CHORD_DEFINITIONS semitones from Tonal

buildChordDef helper maps Tonal's chord intervals positionally onto
hand-coded member names. The members[].name array stays the
chord-tone-overlay contract; only semitones are now Tonal-sourced.

CHORDS export shape unchanged. Snapshot tests verify byte-equivalence."
```

---

## Task M4: degrees.ts adopt Mode.triads + RomanNumeral.get

Replace the 7 diatonic-mode entries in `MODE_DEGREES` and `DEGREE_DIATONIC_QUALITY` with derivation from `@tonaljs/mode`. Use `@tonaljs/roman-numeral` for parsing in `getQualityForDegree` where it works correctly.

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/lib/tonal.ts`
- Modify: `packages/core/src/degrees.ts`

- [ ] **Step 1: Add Tonal Mode + RomanNumeral as dependencies**

Run from repo root:

```bash
pnpm --filter @fretflow/core add @tonaljs/mode @tonaljs/roman-numeral
```

Expected: `packages/core/package.json` gains the deps; `pnpm-lock.yaml` updated.

- [ ] **Step 2: Probe `RomanNumeral.get` behavior on FretFlow's degree IDs**

Run from `packages/core/`:

```bash
node -e "
const RN = require('@tonaljs/roman-numeral');
for (const r of ['I','ii','iii','IV','V','vi','vii','VII','i','i°','vii°','III+','I+','iv°']) {
  const rn = RN.get(r);
  console.log(r.padEnd(6), 'empty=', rn.empty, 'step=', rn.step, 'chordType=', JSON.stringify(rn.chordType), 'acc=', JSON.stringify(rn.acc));
}
"
```

Expected: examine the output. Document which degree shapes Tonal handles (Step 4 logic depends on this). The key questions:
- Does `RN.get("vii°")` return `step: 6, chordType: "dim"`?
- Does `RN.get("III+")` return `step: 2, chordType: "aug"`?
- Does `RN.get("iv°")` return `step: 3, chordType: "dim"`?

If any of those return `empty: true`, the fallback path in Step 6 below is required for that degree shape. If all parse correctly, the fallback may be omittable. The implementation in Step 6 ASSUMES the fallback is needed and is conservative.

- [ ] **Step 3: Add `getModeTriads` helper**

In `packages/core/src/lib/tonal.ts`, at the bottom:

```ts
import * as Mode from "@tonaljs/mode";

/**
 * Returns the diatonic triad qualities of a mode as Roman-numeral
 * strings (e.g. ["i", "ii°", "III+", ...]). Tonal models the 7 standard
 * diatonic modes (ionian/major, dorian, phrygian, lydian, mixolydian,
 * aeolian/minor, locrian). Other FretFlow scales (pentatonics, blues,
 * harmonic/melodic minor and their modes) return null and must use
 * FretFlow's hand-coded tables.
 */
export function getModeTriads(modeName: string): readonly string[] | null {
  const tonalName = scaleNameToTonal(modeName);
  if (!tonalName) return null;
  const mode = Mode.get(tonalName);
  if (mode.empty) return null;
  return mode.triads;
}
```

- [ ] **Step 4: Add unit tests for `getModeTriads`**

At the bottom of `packages/core/src/lib/tonal.test.ts`:

```ts
import { getModeTriads } from "./tonal";

describe("getModeTriads", () => {
  it("returns Major mode triads", () => {
    expect(getModeTriads("Major")).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
  });
  it("returns Natural Minor triads", () => {
    expect(getModeTriads("Natural Minor")).toEqual(["i", "ii°", "III", "iv", "v", "VI", "VII"]);
  });
  it("returns Dorian triads", () => {
    expect(getModeTriads("Dorian")).toEqual(["i", "ii", "III", "IV", "v", "vi°", "VII"]);
  });
  it("returns null for Pentatonic", () => {
    expect(getModeTriads("Major Pentatonic")).toBeNull();
  });
  it("returns null for Harmonic Minor", () => {
    expect(getModeTriads("Harmonic Minor")).toBeNull();
  });
  it("returns null for unknown scale", () => {
    expect(getModeTriads("Bogus")).toBeNull();
  });
});
```

Note: the Dorian expected triads (`["i", "ii", "III", "IV", "v", "vi°", "VII"]`) match FretFlow's `MODE_DEGREES.Dorian` values directly. If Tonal returns a different format (e.g. without `°`), Step 5's projection logic in `degrees.ts` will need to translate — that's a fixable mismatch, not a blocker. Adjust the unit-test expectation to what Tonal actually returns and add a translation layer in Step 5.

- [ ] **Step 5: Run the new unit tests**

```bash
pnpm --filter @fretflow/core run test -- tonal.test.ts
```

Expected: PASS. If any FAIL because Tonal returns slightly different triad strings, update the test expectations to match Tonal's actual output AND add a translation map in `getModeTriads` that converts Tonal's format to FretFlow's (e.g. `"i7"` → `"i"`, or whatever the diff is). Commit the test-expectation fix in this step BEFORE proceeding.

- [ ] **Step 6: Refactor `MODE_DEGREES` to derive diatonic entries**

In `packages/core/src/degrees.ts`, at the top, add the import:

```ts
import * as RN from "@tonaljs/roman-numeral";
import { getModeTriads } from "./lib/tonal";
```

Replace the `MODE_DEGREES` declaration (currently lines ~56-65) with a builder:

```ts
/**
 * Diatonic-degree maps per scale. Built by deriving Tonal triads for
 * the 7 standard modes; Harmonic Minor is kept hand-coded because
 * Tonal's harmonic-minor model uses different naming conventions and
 * FretFlow's table has been stable.
 */
function buildModeDegrees(scaleName: string): Record<number, string> {
  const triads = getModeTriads(scaleName);
  const semitones = SCALES[scaleName];
  if (!triads || !semitones || triads.length !== semitones.length) {
    throw new Error(
      `buildModeDegrees: ${scaleName} not derivable from Tonal (triads=${triads?.length}, semitones=${semitones?.length})`,
    );
  }
  const result: Record<number, string> = {};
  for (let i = 0; i < semitones.length; i++) {
    result[semitones[i]] = triads[i];
  }
  return result;
}

const MODE_DEGREES: Record<string, Record<number, string>> = {
  Major:           buildModeDegrees("Major"),
  Lydian:          buildModeDegrees("Lydian"),
  Mixolydian:      buildModeDegrees("Mixolydian"),
  "Natural Minor": buildModeDegrees("Natural Minor"),
  Dorian:          buildModeDegrees("Dorian"),
  Phrygian:        buildModeDegrees("Phrygian"),
  Locrian:         buildModeDegrees("Locrian"),
  // Harmonic Minor stays hand-coded — Tonal models it with different
  // suffix conventions and the table below has been stable.
  "Harmonic Minor":{ 0: "i",  2: "ii°", 3: "III+", 5: "iv", 7: "V", 8: "VI", 11: "vii°" },
};
```

(`PENTATONIC_DEGREES`, `BLUES_DEGREES`, and `DEGREE_DIATONIC_QUALITY` stay UNCHANGED. Tonal Mode doesn't model these scales.)

- [ ] **Step 7: Run the M1 degree snapshot tests**

```bash
pnpm --filter @fretflow/core run test -- degrees.test.ts -t "snapshot"
```

Expected: PASS on `getDegreesForScale`, `getDegreeSequence`, and `getQualityForDegree` snapshots. If any FAIL, STOP. Do NOT update snapshots. The most likely cause is Tonal's `Mode.triads` returning slightly different strings — adjust the translation layer (added in Step 5) until the snapshots match.

- [ ] **Step 8: Run full core test suite**

```bash
pnpm --filter @fretflow/core run test
```

Expected: all PASS (existing `degrees.test.ts` is 772 lines and exhaustive).

- [ ] **Step 9: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts packages/core/src/degrees.ts
git commit -m "refactor(core): derive diatonic mode degrees from Tonal Mode.triads

MODE_DEGREES diatonic entries now project from @tonaljs/mode via the
new getModeTriads helper. Harmonic Minor stays hand-coded because
Tonal's naming conventions differ. Pentatonics, blues, and melodic
minor remain FretFlow-owned (Tonal doesn't model them).

Snapshot tests verify byte-equivalence."
```

---

## Task M5: Full verification

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

Expected: all 1944+ tests PASS, including the M1 snapshot tests (which lock the catalog + degree behavior).

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: tsc compiles, Vite builds dist.

- [ ] **Step 4: E2E**

```bash
pnpm test:e2e:production
```

Expected: 50+ PASS.

- [ ] **Step 5: Visual regression (paranoid check)**

```bash
pnpm test:visual
```

Expected: PASS with zero baseline diffs. The refactor is supposed to be byte-equivalent at every public API surface (snapshots prove this for catalog + degrees; freq math and rendered fretboard layout are unaffected by music-theory-data plumbing). **Do not** run `--update-snapshots`. Any diff = investigate.

- [ ] **Step 6: Final state check**

```bash
git log --oneline -5 && git status
```

Expected: 4 new commits on top of the spec commit (M1 snapshot + M2 SCALES + M3 CHORD_DEFINITIONS + M4 degrees). Working tree clean.

No final commit for Task M5 — verification only.

---

## Self-Review

**Spec coverage:**
- T1 snapshot lock for SCALES, CHORDS, CHORD_DEFINITIONS, degree outputs → Task M1 ✓
- T2 SCALES derived from Scale.get + `getScaleSemitonesFromTonal` helper → Task M2 ✓
- T3 CHORD_DEFINITIONS semitones derived; member names stay hand-coded → Task M3 ✓
- T4 MODE_DEGREES diatonic entries from Mode.triads; RomanNumeral.get with probe → Task M4 Steps 2 + 6 ✓
- Adds `@tonaljs/mode`, `@tonaljs/roman-numeral` as deps → Task M4 Step 1 ✓
- Public API shapes preserved (SCALES, CHORDS, CHORD_DEFINITIONS, all degrees.ts exports) — snapshot tests in M1 are the proof ✓
- Pentatonic/Blues/Harmonic Minor/Melodic Minor scales stay FretFlow-owned for degrees → Task M4 Step 6 ✓
- T5 verification gates → Task M5 ✓

**Placeholder scan:** Task M4 Step 2 says "examine the output" — that's a real instruction to read the probe output and decide whether the fallback in Step 6 is needed. Not a placeholder. The fallback IS already specified conservatively in Step 6 (Harmonic Minor stays hand-coded; the diatonic 7 use `getModeTriads`).

Task M4 Step 5 says "If any FAIL because Tonal returns slightly different triad strings, update the test expectations… AND add a translation map" — this is an explicit conditional instruction, not a placeholder. The implementer should commit a test-expectation update IF Tonal's output differs.

No actual placeholders.

**Type consistency:**
- `getScaleSemitonesFromTonal(scaleName: string): number[]` — used identically in `lib/tonal.ts`, `lib/tonal.test.ts`, and `theoryCatalog.ts`. ✓
- `getChordSemitonesFromTonal(chordSymbol: string): number[]` — used identically. ✓
- `getModeTriads(modeName: string): readonly string[] | null` — used identically, with null check in `buildModeDegrees`. ✓
- `buildChordDef(appQuality: string, quality: ChordQuality, memberNames: readonly ChordMemberName[]): ChordDefinition` — `ChordQuality` and `ChordMemberName` are existing exports in `theory.ts` (already defined around lines 73-74). ✓
- `buildModeDegrees(scaleName: string): Record<number, string>` — matches `MODE_DEGREES` value type. ✓

**Issues found:** none.

---

## Notes for the executing agent

1. **The M1 snapshot is sacred.** Every subsequent task verifies behavior by re-running the snapshot test, which MUST stay byte-identical. If a snapshot fails, do NOT `--update-snapshots`. Investigate the diff and fix the implementation. The whole migration's safety depends on this discipline.

2. **Task M4 Step 2 is a probe, not a no-op.** Read the actual output. If `RN.get("vii°")` or `RN.get("III+")` returns `empty: true`, that's important — it tells you Tonal can't parse FretFlow's degree suffixes. The plan's current implementation (Step 6) sidesteps this by deriving from `Mode.triads` instead of by parsing strings, so RomanNumeral.get isn't actually used in the production code path — it was a candidate optimization that turned out to be unnecessary given the simpler `Mode.triads` route.

   If after reading the probe output you decide to use `RN.get` somewhere (e.g. as a cleaner replacement for `Object.entries(degreesMap).find(...)` in `getQualityForDegree`), feel free — but only if the snapshot tests stay green. The plan does not require it.

3. **`@tonaljs/roman-numeral` is added as a dep in M4 Step 1.** Even if the implementation doesn't end up using it (per note 2), keep the dep — it's a peer of the Tonal family already in use, and a future PR may consume it.

4. **`buildChordDef` in M3 throws on mismatch.** This is intentional. If Tonal ever returns a different number of intervals than FretFlow's `members[].name` array, the build fails loudly at module load — better than silently producing a malformed chord definition that breaks the chord-tone overlay at runtime.

5. **No production code outside `packages/core/src/` should change.** If you find yourself editing files in `src/`, `e2e/`, or anywhere else, STOP — the change has scope-crept.
