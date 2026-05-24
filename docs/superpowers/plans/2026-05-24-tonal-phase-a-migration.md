# Tonal Phase A Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt `@tonaljs/note`'s `freq()` and `@tonaljs/pcset` where FretFlow has equivalent hand-rolled implementations, and extract the duplicated "Tonal output → sharps form" normalization into a single helper.

**Architecture:** Three small changes inside `packages/core/`. No new abstractions, no new files. Behavior must be byte-identical — Tonal uses the same A4=440 formula and pitch-class set semantics. Lock current behavior with a snapshot test BEFORE the `getDivergentNotes` rewrite.

**Tech Stack:** TypeScript, Vitest, `@tonaljs/note`, `@tonaljs/pcset` (new dep).

**Spec:** `docs/superpowers/specs/2026-05-24-tonal-phase-a-migration-design.md`

---

## File Structure

**New files:** none.

**Modified files:**
- `packages/core/package.json` — add `@tonaljs/pcset` dependency.
- `packages/core/src/lib/tonal.ts` — add `normalizeToSharps` export.
- `packages/core/src/lib/tonal.test.ts` — add `normalizeToSharps` unit tests.
- `packages/core/src/theory.ts` — replace 4 inline normalization blocks; rewrite `getDivergentNotes` using `Pcset`.
- `packages/core/src/theory.test.ts` — add pre-refactor snapshot test for `getDivergentNotes`.
- `packages/core/src/guitar.ts` — replace `getNoteFrequency` implementation with `Note.freq()`.

**Do NOT modify:**
- `packages/core/src/constants.ts` — keep `A4_FREQUENCY` and `A4_ABS_DISTANCE`. They're re-exported via `export *` (public API surface). `A4_FREQUENCY` is still used as the fallback in the new `getNoteFrequency`.

---

## Task 1: Lock `getDivergentNotes` behavior with snapshot test

This is the safety net for Task 4. We capture the current output across every scale × {C, F#, Bb} BEFORE touching `getDivergentNotes`. The refactor must produce identical output.

**Files:**
- Modify: `packages/core/src/theory.test.ts`

- [ ] **Step 1: Add snapshot test at the end of the `getDivergentNotes` describe block**

Append this block inside the existing `describe("getDivergentNotes", () => { ... })` in `packages/core/src/theory.test.ts`:

```ts
  it("matches snapshot across all scales × {C, F#, Bb}", () => {
    // Import SCALE_TO_TONAL via the lib/tonal module to enumerate every supported scale.
    // The exact list lives in lib/tonal.ts; we re-derive the scale names here so this
    // snapshot is the canonical truth.
    const SCALES_TO_PROBE = [
      "Major",
      "Natural Minor",
      "Harmonic Minor",
      "Melodic Minor",
      "Major Pentatonic",
      "Minor Pentatonic",
      "Blues",
      "Ionian",
      "Dorian",
      "Phrygian",
      "Lydian",
      "Mixolydian",
      "Aeolian",
      "Locrian",
      "Locrian Natural 6",
      "Ionian Augmented",
      "Dorian Sharp 4",
      "Phrygian Dominant",
      "Lydian Sharp 2",
      "Altered Diminished",
      "Dorian Flat 2",
      "Lydian Augmented",
      "Lydian Dominant",
      "Mixolydian Flat 6",
      "Locrian Natural 2",
      "Altered",
      "Minor Blues",
      "Major Blues",
    ];
    const ROOTS = ["C", "F#", "Bb"];

    const snapshot: Record<string, string[]> = {};
    for (const root of ROOTS) {
      for (const scale of SCALES_TO_PROBE) {
        snapshot[`${root} ${scale}`] = getDivergentNotes(root, scale);
      }
    }
    expect(snapshot).toMatchSnapshot();
  });
```

- [ ] **Step 2: Run the test to seed the snapshot**

Run: `pnpm --filter @fretflow/core run test -- theory.test.ts -t "matches snapshot"`

Expected: PASS (snapshot file is created automatically in `packages/core/src/__snapshots__/theory.test.ts.snap`).

- [ ] **Step 3: Verify the snapshot file was written and committed-worthy**

Run: `ls packages/core/src/__snapshots__/theory.test.ts.snap && wc -l packages/core/src/__snapshots__/theory.test.ts.snap`

Expected: file exists, ~30-90 lines depending on Vitest's serialization.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/theory.test.ts packages/core/src/__snapshots__/theory.test.ts.snap
git commit -m "test(theory): lock getDivergentNotes behavior with snapshot

Pre-refactor safety net for Phase A pcset migration. Captures output
across every supported scale × {C, F#, Bb}. The upcoming pcset rewrite
must produce identical output."
```

---

## Task 2: A1 — Replace `getNoteFrequency` with `Note.freq()`

**Files:**
- Modify: `packages/core/src/guitar.ts`

- [ ] **Step 1: Replace the `getNoteFrequency` function body**

Open `packages/core/src/guitar.ts`. At the top of the file, find the existing import:

```ts
import { DEFAULT_OCTAVE, A4_FREQUENCY, A4_ABS_DISTANCE, MAX_FRET, STANDARD_FRET_MARKERS } from './constants';
```

Replace it with (remove `A4_ABS_DISTANCE`, keep the others; `A4_FREQUENCY` is still the fallback):

```ts
import { DEFAULT_OCTAVE, A4_FREQUENCY, MAX_FRET, STANDARD_FRET_MARKERS } from './constants';
import * as Note from "@tonaljs/note";
```

Then replace the entire `getNoteFrequency` function (currently at `packages/core/src/guitar.ts:65-72`):

```ts
/**
 * Returns the frequency in Hz for a given note string (e.g. "A4").
 * Backed by Tonal's `Note.freq` (A4 = 440 Hz equal temperament). Falls
 * back to A4 when the input cannot be parsed, matching the legacy
 * behavior that used `{ noteName: "A", octave: DEFAULT_OCTAVE }`.
 */
export function getNoteFrequency(noteStringWithOctave: string): number {
  return Note.freq(noteStringWithOctave) ?? A4_FREQUENCY;
}
```

Do NOT remove the `A4_FREQUENCY` or `A4_ABS_DISTANCE` constants from `constants.ts`. They remain on the public surface (`packages/core/src/index.ts` re-exports `* from "./constants"`).

- [ ] **Step 2: Run guitar tests to confirm no drift**

Run: `pnpm --filter @fretflow/core run test -- guitar.test.ts`

Expected: PASS. The existing `getNoteFrequency` tests have concrete A4/E2/etc. expectations that pin Tonal's output. Any drift means Tonal is computing a different frequency (it shouldn't — same A4=440 formula).

If any assertion fails: STOP. Do not proceed. Report which case failed and what value Tonal returned.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/guitar.ts
git commit -m "refactor(core): use Note.freq for getNoteFrequency

Replaces hand-rolled A4 * 2^(halfSteps/12) with Tonal's equivalent.
A4_FREQUENCY kept as fallback for unparseable input."
```

---

## Task 3: A2 — Extract `normalizeToSharps`

**Files:**
- Modify: `packages/core/src/lib/tonal.ts`
- Modify: `packages/core/src/lib/tonal.test.ts`
- Modify: `packages/core/src/theory.ts`

- [ ] **Step 1: Add `normalizeToSharps` to `lib/tonal.ts`**

Open `packages/core/src/lib/tonal.ts`. After the existing `transposeNoteToSharps` function (currently ending at line 121), add this new export:

```ts
/**
 * Normalize a Tonal note name to FretFlow's sharps-form contract.
 * Tonal may return flats (e.g. "Eb"); the rest of the app keys on the
 * sharps array (NOTES). Pass any Tonal-output note name through this
 * before exposing it.
 *
 * Returns the input unchanged when Tonal can't simplify it, preserving
 * the caller's intent on malformed input.
 */
export function normalizeToSharps(note: string): string {
  if (!note) return note;
  const simplified = Note.simplify(note);
  if (!simplified) return note;
  return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
}
```

Then update `transposeNoteToSharps` (lines 109-121 in the current file) to use the new helper:

```ts
export function transposeNoteToSharps(
  note: string,
  oldRoot: string,
  newRoot: string,
): string {
  if (oldRoot === newRoot) return note;
  const interval = Interval.distance(oldRoot, newRoot);
  if (!interval) return note;
  const transposed = Note.transpose(note, interval);
  if (!transposed) return note;
  return normalizeToSharps(transposed);
}
```

- [ ] **Step 2: Write `normalizeToSharps` failing tests**

Open `packages/core/src/lib/tonal.test.ts`. At the top, update the import:

```ts
import {
  chordQualityToTonal,
  tonalToChordQuality,
  scaleNameToTonal,
  tonalToScaleName,
  normalizeToSharps,
} from "./tonal";
```

At the bottom of the file, add:

```ts
describe("normalizeToSharps", () => {
  it("converts Bb to A#", () => {
    expect(normalizeToSharps("Bb")).toBe("A#");
  });
  it("converts Eb to D#", () => {
    expect(normalizeToSharps("Eb")).toBe("D#");
  });
  it("converts Db to C#", () => {
    expect(normalizeToSharps("Db")).toBe("C#");
  });
  it("converts Ab to G#", () => {
    expect(normalizeToSharps("Ab")).toBe("G#");
  });
  it("converts Gb to F#", () => {
    expect(normalizeToSharps("Gb")).toBe("F#");
  });
  it("leaves natural notes unchanged", () => {
    expect(normalizeToSharps("C")).toBe("C");
    expect(normalizeToSharps("F")).toBe("F");
  });
  it("leaves sharps unchanged", () => {
    expect(normalizeToSharps("C#")).toBe("C#");
    expect(normalizeToSharps("F#")).toBe("F#");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeToSharps("")).toBe("");
  });
  it("returns garbage input unchanged", () => {
    expect(normalizeToSharps("garbage")).toBe("garbage");
  });
});
```

- [ ] **Step 3: Run the new unit tests**

Run: `pnpm --filter @fretflow/core run test -- tonal.test.ts`

Expected: PASS. All 9 `normalizeToSharps` cases plus the existing adapter tests.

- [ ] **Step 4: Replace the 4 inline normalization blocks in `theory.ts`**

Open `packages/core/src/theory.ts`. At the top, find the import from `./lib/tonal`:

```ts
import {
  chordQualityToTonal,
  scaleNameToTonal,
  tonalChordSymbol,
} from "./lib/tonal";
```

(The actual import list may differ slightly — preserve all existing imports and add `normalizeToSharps`.)

Add `normalizeToSharps` to the import:

```ts
import {
  chordQualityToTonal,
  scaleNameToTonal,
  tonalChordSymbol,
  normalizeToSharps,
} from "./lib/tonal";
```

Now replace each of the 4 inline blocks. In each case, the current pattern is:

```ts
const simplified = Note.simplify(t);
return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
```

…and it becomes:

```ts
return normalizeToSharps(t);
```

**Site 1 — `getIntervalNotes` (lines ~465-475):**

Replace the `.map` body:

```ts
export function getIntervalNotes(
  rootNote: string,
  intervals: number[],
): string[] {
  if (getNoteIndex(rootNote) === -1) return [];
  return intervals.map((semitones) => {
    const t = Note.transpose(rootNote, Interval.fromSemitones(semitones));
    return normalizeToSharps(t);
  });
}
```

**Site 2 — `getScaleNotes` (lines ~478-490):**

Replace the `.map` body:

```ts
export function getScaleNotes(rootNote: string, scaleName: string): string[] {
  const tonalName = scaleNameToTonal(normalizeScaleName(scaleName));
  if (!tonalName) return [];
  if (getNoteIndex(rootNote) === -1) return [];
  const tonalScale = Scale.get(`${rootNote} ${tonalName}`);
  return tonalScale.notes.map((n) => normalizeToSharps(n));
}
```

**Site 3 — `getChordNotes` (lines ~504-516):**

Replace the `.map` body:

```ts
export function getChordNotes(rootNote: string, chordName: string): string[] {
  const chroma = Note.chroma(rootNote);
  if (typeof chroma !== "number" || isNaN(chroma)) return [];
  const symbol = tonalChordSymbol(rootNote, chordName);
  if (!symbol) return [];
  const tonalChord = Chord.get(symbol);
  if (tonalChord.empty) return [];
  return tonalChord.notes.map((n) => normalizeToSharps(n));
}
```

**Site 4 — `getDivergentNotes` (lines ~523-555):**

Replace the final `.map` body only (the rest of the function will be rewritten in Task 4):

```ts
  return semis
    .filter((semitone) => !refSemis.has(semitone))
    .map((semitone) => {
      const t = Note.transpose(
        rootNote,
        Interval.fromSemitones((semitone - rootChroma + 12) % 12),
      );
      return normalizeToSharps(t);
    });
```

- [ ] **Step 5: Run all core tests**

Run: `pnpm --filter @fretflow/core run test`

Expected: PASS. All existing tests including the new `normalizeToSharps` suite and the Task 1 snapshot.

If the Task 1 snapshot test fails: STOP. The extraction is supposed to be byte-identical to the inline block. Investigate before proceeding.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts packages/core/src/theory.ts
git commit -m "refactor(core): extract normalizeToSharps helper

The 'simplify + enharmonic if flat' pattern was duplicated across
getIntervalNotes, getScaleNotes, getChordNotes, getDivergentNotes,
and transposeNoteToSharps. Consolidate into lib/tonal.ts."
```

---

## Task 4: A3 — Rewrite `getDivergentNotes` using `@tonaljs/pcset`

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/theory.ts`

- [ ] **Step 1: Add `@tonaljs/pcset` dependency**

Run from the repo root:

```bash
pnpm --filter @fretflow/core add @tonaljs/pcset
```

Expected: `pnpm-lock.yaml` updated; `packages/core/package.json` gains the dep under `"dependencies"`.

- [ ] **Step 2: Add the import in `theory.ts`**

Open `packages/core/src/theory.ts`. Near the top with the other Tonal imports:

```ts
import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";
import * as Scale from "@tonaljs/scale";
import * as Key from "@tonaljs/key";
import * as Chord from "@tonaljs/chord";
```

Add:

```ts
import * as Pcset from "@tonaljs/pcset";
```

- [ ] **Step 3: Rewrite `getDivergentNotes`**

Replace the entire `getDivergentNotes` function (currently `packages/core/src/theory.ts:523-555`) with:

```ts
/**
 * Returns notes in the current scale that diverge from the reference scale.
 * Reference: Major for major-quality modes (scale contains a major 3rd),
 * Natural Minor otherwise.
 *
 * Set difference computed via Pcset.chroma() — a 12-bit string where bit i
 * is "1" iff pitch-class i is present. Iterating the current scale and
 * filtering by the reference chroma preserves the original note ordering.
 */
export function getDivergentNotes(
  rootNote: string,
  scaleName: string,
): string[] {
  const resolvedScaleName = normalizeScaleName(scaleName);
  if (resolvedScaleName.includes("Blues")) return [];
  if (resolvedScaleName === "Major Pentatonic" || resolvedScaleName === "Minor Pentatonic") return [];
  if (resolvedScaleName === "Major" || resolvedScaleName === "Natural Minor") return [];

  const rootChroma = Note.chroma(rootNote);
  if (typeof rootChroma !== "number" || isNaN(rootChroma)) return [];

  const scaleNotes = getScaleNotes(rootNote, scaleName);
  if (scaleNotes.length === 0) return [];

  // Determine reference scale: major-quality if scale contains a major 3rd.
  const relativeIntervals = scaleNotes
    .map((n) => Note.chroma(n))
    .filter((c): c is number => typeof c === "number" && !isNaN(c))
    .map((c) => (c - rootChroma + 12) % 12);
  const isMajorQuality = relativeIntervals.includes(4);
  const refName = isMajorQuality ? "Major" : "Natural Minor";

  // 12-bit chroma string: "100010010100" etc. Bit i set iff pitch-class i is present.
  const refChroma = Pcset.get(getScaleNotes(rootNote, refName)).chroma;

  return scaleNotes.filter((note) => {
    const c = Note.chroma(note);
    if (typeof c !== "number" || isNaN(c)) return false;
    return refChroma[c] === "0";
  });
}
```

Key behavioral notes (do not change):
- Early returns for blues/pentatonic/major/natural-minor are unchanged.
- Major-quality detection (contains 4 semitones above root = major 3rd) is unchanged.
- Output order matches `getScaleNotes(rootNote, scaleName)` — same as before.
- Notes already pass through `normalizeToSharps` inside `getScaleNotes`, so the output sharps-form contract is preserved without an extra map.

- [ ] **Step 4: Run the snapshot test from Task 1**

Run: `pnpm --filter @fretflow/core run test -- theory.test.ts -t "matches snapshot"`

Expected: PASS. The snapshot was seeded from the old implementation in Task 1. If the new implementation produces different output, the snapshot will FAIL — that means the refactor is not byte-equivalent.

If it FAILS: STOP. Do not run `--update-snapshots`. Investigate the diff and fix the implementation. The most likely causes:
- Note ordering differs because we now iterate `scaleNotes` (note names) instead of `semis` (chroma indices) — but since both are derived from the same `getScaleNotes` call, the order should match.
- A note got dropped because `Note.chroma` returned null for a malformed scale entry — investigate which scale.

- [ ] **Step 5: Run the full core test suite**

Run: `pnpm --filter @fretflow/core run test`

Expected: PASS. All existing `getDivergentNotes` cases (Dorian/Lydian/Mixolydian divergent thirds/sixths/sevenths, blues/pentatonic returning `[]`, malformed root returning `[]`) plus the snapshot.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/theory.ts
git commit -m "refactor(core): use @tonaljs/pcset for getDivergentNotes

Replaces hand-rolled chroma-set construction with Pcset.chroma().
Behavior is byte-identical — verified by the snapshot test seeded
in the previous commit."
```

---

## Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `pnpm lint`

Expected: PASS. No new warnings.

- [ ] **Step 2: Unit + integration tests**

Run: `pnpm test`

Expected: PASS. 1923+ tests green, including the new Task 1 snapshot and Task 3 `normalizeToSharps` cases.

- [ ] **Step 3: Build**

Run: `pnpm build`

Expected: PASS. TypeScript compiles cleanly, Vite produces a dist.

- [ ] **Step 4: E2E**

Run: `pnpm test:e2e:production`

Expected: PASS. 50/50 (or current count).

- [ ] **Step 5: Visual regression (paranoid check)**

Run: `pnpm test:visual`

Expected: PASS with **zero diffs**. No visual changes are expected. **Do not** run `--update-snapshots`. Any baseline diff = regression — investigate before proceeding.

If a baseline diff appears: STOP. The fretboard click → frequency path is the only user-visible code touched (via `getNoteFrequency`). Audio doesn't affect visuals, so a visual diff would be deeply surprising — investigate root cause.

- [ ] **Step 6: Final state check**

Run: `git log --oneline -5 && git status`

Expected:
- 4 new commits on top of the previous HEAD (snapshot, A1, A2, A3).
- Working tree clean.

No final commit needed for Task 5 — it's verification only.

---

## Self-Review

**Spec coverage:**
- A1 (`Note.freq` for `getNoteFrequency`) → Task 2 ✓
- A2 (`normalizeToSharps` extraction across 5 sites) → Task 3 covers 4 sites in `theory.ts` + 1 site in `lib/tonal.ts::transposeNoteToSharps` (updated in Step 1 of Task 3) ✓
- A3 (`@tonaljs/pcset` in `getDivergentNotes`) → Task 4 ✓
- Pre-refactor snapshot safety net → Task 1 ✓
- Tonal v.s. fallback behavior on bad input preserved → Task 2 Step 1 (fallback to `A4_FREQUENCY`), Task 3 Step 1 (`normalizeToSharps` returns input unchanged) ✓
- `normalizeToSharps` unit tests → Task 3 Step 2 ✓
- Verification gates → Task 5 ✓

**Placeholder scan:** none.

**Type consistency:**
- `normalizeToSharps(note: string): string` — used identically in `lib/tonal.ts`, `lib/tonal.test.ts`, and 4 call sites in `theory.ts`. ✓
- `Note.freq(noteStringWithOctave: string): number | null` — `?? A4_FREQUENCY` collapses null to a number. ✓
- `Pcset.get(notes: string[]).chroma: string` — used as `refChroma[c] === "0"` (string indexing). Pcset's chroma is a 12-character string of "0"/"1". ✓

**Issues found:** none.

---

## Notes for the executing agent

1. **Order matters.** Task 1 MUST run before Task 4. The snapshot is the only guarantee that Task 4 produces byte-identical output. If you run Task 4 first and the test fails, you'll need to revert to the old implementation, capture the snapshot, then re-apply — extra work.

2. **Task 3 Site 4** updates the `.map` body inside `getDivergentNotes` to use `normalizeToSharps`. Task 4 then rewrites the whole function — the Site 4 change gets superseded. That's fine: the snapshot test passes after Task 3 (sites updated, behavior unchanged) AND after Task 4 (function rewritten, behavior still unchanged). Both commits are independently bisectable.

3. **Do not** remove `A4_FREQUENCY` or `A4_ABS_DISTANCE` from `constants.ts`. They're re-exported via `index.ts::export * from "./constants"` — removing them would be a public API break.

4. **Do not** `--update-snapshots` if the Task 1 snapshot test fails after Task 4. That defeats the purpose of the safety net. Investigate the diff instead.
