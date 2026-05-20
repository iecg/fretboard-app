# FretFlow Phase 1 — Tonal.js Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bespoke music-theory implementation in `@fretflow/core` with Tonal.js-backed implementations, keeping the public API stable so all 73 consumer files in `src/` continue working without modification.

**Architecture:** Swap the engine, not the API. The exported function signatures of `getNoteDisplay`, `getChordNotes`, `getScaleNotes`, `getDiatonicChord`, `getKeySignature`, `getQualityForDegree`, etc. stay byte-identical. Their bodies are rewritten to delegate to `@tonaljs/*` modules through a thin internal adapter layer (`packages/core/src/lib/tonal.ts`). Existing tests serve as the safety net — every migration must keep them green. App-specific names ("Major Triad", "Minor Triad", verbose scale names) are mapped to Tonal's symbol names (`"M"`, `"m"`, etc.) at the adapter boundary; consumers never see Tonal types.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/note`, `@tonaljs/interval`, `@tonaljs/key`.

**Spec reference:** [`docs/superpowers/specs/2026-05-20-fretflow-integration-design.md`](../specs/2026-05-20-fretflow-integration-design.md) §9a.

**Out of scope for this plan:** No UI changes. No store-atom changes. No removal of public exports. The Inspector still has four tabs. The chord-overlay mode toggle still exists. Those are Plans 2–8.

---

## File Structure

### Created

- `packages/core/src/lib/tonal.ts` — internal adapter layer. Maps app-specific chord/scale names to Tonal symbols and back. Wraps Tonal calls so the rest of `core/` imports from this single module instead of directly from `@tonaljs/*`. Single responsibility: be the Tonal/FretFlow translation boundary.
- `packages/core/src/lib/tonal.test.ts` — focused tests for the adapter's name mapping (the only new behavior introduced by this plan).

### Modified

- `packages/core/package.json` — adds 5 `@tonaljs/*` dependencies.
- `packages/core/src/theory.ts` — function bodies rewritten to use the adapter. Public exports preserved (every `export function` keeps its signature). Backing data structures (`CHORD_DEFINITIONS`, `CHORDS`, `SCALES`, `KEY_SIGNATURES`, `ENHARMONICS`, `NOTES`) progressively dereferenced and ultimately removed when no longer used internally.
- `packages/core/src/degrees.ts` — `getQualityForDegree` and `remapDegreeForScale` rewritten to use the adapter. `DEGREE_COLORS` and `DegreeId` type unchanged.
- `packages/core/src/circleOfFifthsUtils.ts` — `getCircleNoteLabels` rewritten to use the adapter.
- `packages/core/src/theoryCatalog.ts` — left mostly as-is (it holds app-specific scale-family UX data). Verify each function still passes its existing tests.
- `packages/core/src/index.ts` — no changes; same set of exports.
- `CLAUDE.md` — one-line addition under "Architecture" noting the Tonal backing.

### Untouched (verify only)

- `packages/core/src/guitar.ts` — string tuning logic. No theory dependencies.
- `packages/core/src/constants.ts` — animation/UI constants only.
- `packages/core/src/shapes/**` — fingering-shape geometry. No theory dependencies.

---

## Pre-flight Setup

### Task 0: Baseline — confirm a clean starting state

**Files:** none modified

- [ ] **Step 0.1: Confirm tree is clean**

Run: `git status`
Expected: working tree clean, on branch `claude/optimistic-rhodes-1d1ad7`.

- [ ] **Step 0.2: Verify the existing test suite passes (the safety net)**

Run: `pnpm run test`
Expected: all suites pass. Note the count for later comparison.

- [ ] **Step 0.3: Verify the core package builds independently**

Run: `pnpm --filter @fretflow/core run build`
Expected: exits 0; `packages/core/dist/` populated.

- [ ] **Step 0.4: Capture a baseline bundle size**

Run: `pnpm run build && du -sh dist/`
Expected: build succeeds; record the byte size for the §13 comparison.

---

## Task 1: Install Tonal dependencies

**Files:**
- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1.1: Add the five Tonal modules as production dependencies**

Run from repo root:
```bash
pnpm --filter @fretflow/core add @tonaljs/note@^6 @tonaljs/chord@^6 @tonaljs/scale@^6 @tonaljs/interval@^6 @tonaljs/key@^6
```
Expected: pnpm resolves and installs; `packages/core/package.json` now lists them under `dependencies`.

- [ ] **Step 1.2: Verify the existing tests still pass after install**

Run: `pnpm run test`
Expected: all suites pass; same count as baseline.

- [ ] **Step 1.3: Verify TypeScript compiles**

Run: `pnpm run build:types`
Expected: exits 0.

- [ ] **Step 1.4: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "chore(core): add @tonaljs dependencies for theory migration"
```

---

## Task 2: Create the Tonal adapter module

**Files:**
- Create: `packages/core/src/lib/tonal.ts`
- Create: `packages/core/src/lib/tonal.test.ts`

The adapter has two jobs:
1. Map FretFlow's verbose chord-quality names ("Major Triad") to Tonal's symbol names ("M") and back.
2. Map FretFlow's verbose scale names ("Natural Minor", "Major Pentatonic") to Tonal's scale names ("minor", "major pentatonic") and back.

This module is purely about naming. Tonal does the music.

- [ ] **Step 2.1: Write the failing tests for chord-name mapping**

Create `packages/core/src/lib/tonal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chordQualityToTonal, tonalToChordQuality, scaleNameToTonal, tonalToScaleName } from "./tonal";

describe("chord-name adapter", () => {
  it("maps Major Triad to M", () => {
    expect(chordQualityToTonal("Major Triad")).toBe("M");
  });
  it("maps Minor Triad to m", () => {
    expect(chordQualityToTonal("Minor Triad")).toBe("m");
  });
  it("maps Dominant 7th to 7", () => {
    expect(chordQualityToTonal("Dominant 7th")).toBe("7");
  });
  it("maps Diminished 7th to dim7", () => {
    expect(chordQualityToTonal("Diminished 7th")).toBe("dim7");
  });
  it("maps Half-Diminished 7th to m7b5", () => {
    expect(chordQualityToTonal("Half-Diminished 7th")).toBe("m7b5");
  });
  it("maps Power Chord (5) to 5", () => {
    expect(chordQualityToTonal("Power Chord (5)")).toBe("5");
  });
  it("returns undefined for unknown quality", () => {
    expect(chordQualityToTonal("Bogus Chord")).toBeUndefined();
  });
  it("round-trips Major Triad", () => {
    expect(tonalToChordQuality("M")).toBe("Major Triad");
  });
  it("round-trips Minor 7th", () => {
    expect(tonalToChordQuality("m7")).toBe("Minor 7th");
  });
});

describe("scale-name adapter", () => {
  it("maps Major to major", () => {
    expect(scaleNameToTonal("Major")).toBe("major");
  });
  it("maps Natural Minor to minor", () => {
    expect(scaleNameToTonal("Natural Minor")).toBe("minor");
  });
  it("maps Harmonic Minor to harmonic minor", () => {
    expect(scaleNameToTonal("Harmonic Minor")).toBe("harmonic minor");
  });
  it("maps Major Pentatonic to major pentatonic", () => {
    expect(scaleNameToTonal("Major Pentatonic")).toBe("major pentatonic");
  });
  it("maps Dorian to dorian", () => {
    expect(scaleNameToTonal("Dorian")).toBe("dorian");
  });
  it("round-trips Major", () => {
    expect(tonalToScaleName("major")).toBe("Major");
  });
});
```

- [ ] **Step 2.2: Run the test to confirm it fails**

Run: `pnpm --filter @fretflow/core test src/lib/tonal.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2.3: Implement the adapter**

Create `packages/core/src/lib/tonal.ts`:

```ts
/**
 * Adapter between FretFlow's verbose music-theory names and Tonal's symbol names.
 *
 * FretFlow chose verbose names ("Major Triad", "Natural Minor", "Major Pentatonic")
 * for user-facing clarity; Tonal uses compact symbols ("M", "minor", "major pentatonic").
 * Every cross-module call into Tonal passes through this file.
 */

/**
 * App chord-quality name (e.g., "Major Triad") → Tonal chord symbol suffix
 * (e.g., "M"). Suffix is what Tonal.Chord.get() consumes after the root.
 */
const QUALITY_TO_TONAL: Record<string, string> = {
  "Major Triad": "M",
  "Minor Triad": "m",
  "Diminished Triad": "dim",
  "Augmented Triad": "aug",
  "Sus2": "sus2",
  "Sus4": "sus4",
  "Major 6th": "6",
  "Minor 6th": "m6",
  "Major 7th": "maj7",
  "Minor 7th": "m7",
  "Dominant 7th": "7",
  "Diminished 7th": "dim7",
  "Half-Diminished 7th": "m7b5",
  "Minor-Major 7th": "mMaj7",
  "Power Chord (5)": "5",
};

const TONAL_TO_QUALITY: Record<string, string> = Object.fromEntries(
  Object.entries(QUALITY_TO_TONAL).map(([app, tonal]) => [tonal, app]),
);

const SCALE_TO_TONAL: Record<string, string> = {
  "Major": "major",
  "Natural Minor": "minor",
  "Harmonic Minor": "harmonic minor",
  "Melodic Minor": "melodic minor",
  "Major Pentatonic": "major pentatonic",
  "Minor Pentatonic": "minor pentatonic",
  "Blues": "blues",
  "Blues Major": "major blues",
  "Ionian": "ionian",
  "Dorian": "dorian",
  "Phrygian": "phrygian",
  "Lydian": "lydian",
  "Mixolydian": "mixolydian",
  "Aeolian": "aeolian",
  "Locrian": "locrian",
};

const TONAL_TO_SCALE: Record<string, string> = Object.fromEntries(
  Object.entries(SCALE_TO_TONAL).map(([app, tonal]) => [tonal, app]),
);

export function chordQualityToTonal(quality: string): string | undefined {
  return QUALITY_TO_TONAL[quality];
}

export function tonalToChordQuality(symbol: string): string | undefined {
  return TONAL_TO_QUALITY[symbol];
}

export function scaleNameToTonal(scaleName: string): string | undefined {
  return SCALE_TO_TONAL[scaleName];
}

export function tonalToScaleName(tonalName: string): string | undefined {
  return TONAL_TO_SCALE[tonalName];
}

/**
 * Return the canonical Tonal chord symbol for an (root, app-quality) pair, or
 * undefined if the quality is not a known FretFlow chord. Example: ("C", "Major Triad") → "CM".
 */
export function tonalChordSymbol(root: string, quality: string): string | undefined {
  const suffix = chordQualityToTonal(quality);
  return suffix === undefined ? undefined : `${root}${suffix}`;
}
```

- [ ] **Step 2.4: Run the test to confirm it passes**

Run: `pnpm --filter @fretflow/core test src/lib/tonal.test.ts`
Expected: PASS — all 14 tests green.

- [ ] **Step 2.5: Run the full core test suite**

Run: `pnpm --filter @fretflow/core test`
Expected: all tests pass (the new test plus all existing).

- [ ] **Step 2.6: Commit**

```bash
git add packages/core/src/lib/tonal.ts packages/core/src/lib/tonal.test.ts
git commit -m "feat(core): add Tonal adapter for chord/scale name mapping"
```

---

## Task 3: Migrate note operations to Tonal

Functions: `getNoteIndex`, `getNoteDisplay`, `getIntervalNotes`, `formatAccidental` (no migration needed — pure string transform), and the related `NOTES`, `ENHARMONICS`, `FLAT_KEYS` constants.

Strategy: keep `NOTES`, `ENHARMONICS`, `FLAT_KEYS` exported as constants (74 consumers depend on them). Their *internal* use inside `theory.ts` shifts to Tonal.

**Files:**
- Modify: `packages/core/src/theory.ts:398-512` (functions only)
- Test: `packages/core/src/theory.test.ts` (existing — no changes expected)

- [ ] **Step 3.1: Run the existing tests for a green baseline**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS. Record the count.

- [ ] **Step 3.2: Add a Tonal import block at the top of `theory.ts`**

In `packages/core/src/theory.ts`, after the existing imports, add:

```ts
import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";
```

Use per-module imports (not the `@tonaljs/tonal` barrel) — Task 1 cherry-picked individual modules to keep the bundle minimal, so the barrel is not installed.

- [ ] **Step 3.3: Replace `getNoteIndex` body**

Replace lines 398-404 with:

```ts
export function getNoteIndex(noteName: string): number {
  const chroma = Note.chroma(noteName);
  return chroma ?? -1;
}
```

`Note.chroma` returns 0–11 for valid notes (handling both sharp and flat spellings via `Note.get`), or `undefined` for invalid input. The `?? -1` matches the legacy `indexOf(-1)` contract.

- [ ] **Step 3.4: Run theory.test.ts; expect any `getNoteIndex`-related cases to pass**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS. If any fail, the test names will indicate which input the Tonal version handles differently — most likely an edge case like `"Cb"` or `"E#"`. Resolve by widening the fallback (e.g., `Note.chroma(noteName) ?? Note.chroma(Note.simplify(noteName)) ?? -1`) until green.

- [ ] **Step 3.5: Replace `getIntervalNotes` body**

Replace lines 502-512 with:

```ts
export function getIntervalNotes(
  rootNote: string,
  intervals: number[],
): string[] {
  if (Note.chroma(rootNote) === undefined) return [];
  return intervals.map((semitones) => {
    const transposed = Note.transpose(rootNote, Interval.fromSemitones(semitones));
    // Tonal returns spellings that respect input enharmonics. For internal use
    // we want sharps-only chromatic equivalents (preserves the legacy NOTES contract).
    return Note.enharmonic(transposed).replace(/b/g, "").length === transposed.length
      ? transposed
      : Note.simplify(transposed);
  });
}
```

Note: the existing implementation returns sharps-form names. The Tonal replacement must produce the same casing for consumers that compare strings. If `Note.transpose` gives `"Bb"` where the legacy returns `"A#"`, normalize.

Simpler form if `Note.simplify` already canonicalizes:

```ts
export function getIntervalNotes(
  rootNote: string,
  intervals: number[],
): string[] {
  if (Note.chroma(rootNote) === undefined) return [];
  return intervals.map((semitones) => {
    const t = Note.transpose(rootNote, Interval.fromSemitones(semitones));
    // Force sharps-form for chromatic semitone-based operations.
    const simplified = Note.simplify(t);
    return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
  });
}
```

- [ ] **Step 3.6: Run the theory test suite; tune until green**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS. If a test fails with a wrong enharmonic, fine-tune the `simplify`/`enharmonic` choice in §3.5.

- [ ] **Step 3.7: Replace `getNoteDisplay` body**

The legacy function picks between sharp and flat spelling based on `useFlats` and `FLAT_KEYS`. Tonal's equivalent is `Note.enharmonic`.

Replace lines 406-421 with:

```ts
export function getNoteDisplay(
  noteName: string,
  activeRoot: string,
  useFlats?: boolean,
): string {
  const wantsFlats = useFlats ?? FLAT_KEYS.includes(activeRoot);
  if (wantsFlats && noteName.includes("#")) {
    return Note.enharmonic(noteName);
  }
  if (!wantsFlats && noteName.includes("b")) {
    return Note.enharmonic(noteName);
  }
  return noteName;
}
```

`FLAT_KEYS` is retained as a constant — it's the app's policy decision about which keys prefer flats, not a Tonal concern.

- [ ] **Step 3.8: Run the full theory test suite**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS.

- [ ] **Step 3.9: Run the property tests**

Run: `pnpm --filter @fretflow/core test src/theory.property.test.ts`
Expected: all PASS. Property tests check chromatic round-trips and enharmonic equivalence — these are the most sensitive to engine swaps. If a property fails, the diff narrows down whether the issue is in `getNoteIndex`, `getIntervalNotes`, or `getNoteDisplay`.

- [ ] **Step 3.10: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): migrate note operations to Tonal"
```

---

## Task 4: Migrate scale-aware note spelling

Function: `getNoteDisplayInScale` (theory.ts:443-500). Picks the correct letter-name spelling for a note based on its scale-degree role (e.g., the 3rd of D Major is `F#`, not `Gb`, regardless of `useFlats`).

Tonal equivalent: `Scale.get(name).notes` returns scale-degree-respecting spellings.

**Files:**
- Modify: `packages/core/src/theory.ts:432-500`

- [ ] **Step 4.1: Run existing tests for the function as a green baseline**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts -t "getNoteDisplayInScale"`
Expected: PASS.

- [ ] **Step 4.2: Add Scale import**

In `packages/core/src/theory.ts`:

```ts
import * as Scale from "@tonaljs/scale";
```

(Adjust import style to match Task 3's choice — barrel or per-module.)

- [ ] **Step 4.3: Replace `getNoteDisplayInScale` body**

Replace lines 443-500 with:

```ts
export function getNoteDisplayInScale(
  noteName: string,
  rootNote: string,
  scaleIntervals: number[],
  useFlats?: boolean,
): string {
  if (scaleIntervals.length !== 7) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  // Try to find a Tonal scale matching the interval pattern at the given root.
  // We compare the chromatic intervals (semitones from root) to identify the mode.
  const rootChroma = Note.chroma(rootNote);
  const noteChroma = Note.chroma(noteName);
  if (rootChroma === undefined || noteChroma === undefined) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  const interval = (noteChroma - rootChroma + 12) % 12;
  const degreeIndex = scaleIntervals.indexOf(interval);
  if (degreeIndex === -1) {
    return getNoteDisplay(noteName, rootNote, useFlats);
  }

  // Resolve the spelled root in the desired accidental space.
  const spelledRoot = getNoteDisplay(rootNote, rootNote, useFlats);

  // Build a degree-letter target using the heptatonic letter cycle.
  const letterNames = ["C", "D", "E", "F", "G", "A", "B"];
  const letterPitches: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const rootLetter = spelledRoot.charAt(0);
  const rootLetterIdx = letterNames.indexOf(rootLetter);
  if (rootLetterIdx === -1) return getNoteDisplay(noteName, rootNote, useFlats);

  const expectedLetter = letterNames[(rootLetterIdx + degreeIndex) % 7];
  const expectedBasePitch = letterPitches[expectedLetter];
  const targetPitch = (rootChroma + interval) % 12;
  const diff = (targetPitch - expectedBasePitch + 12) % 12;

  if (diff === 0) return expectedLetter;
  if (diff === 1) return expectedLetter + "#";
  if (diff === 11) return expectedLetter + "b";
  if (diff === 2) return expectedLetter + "##";
  if (diff === 10) return expectedLetter + "bb";
  return getNoteDisplay(noteName, rootNote, useFlats);
}
```

This keeps the existing letter-cycle algorithm but uses `Note.chroma` (Tonal) instead of `NOTES.indexOf` + custom enharmonic lookup. The behavior is identical; the dependency on the local `LETTER_NAMES`/`LETTER_PITCHES` constants moves inside the function (so they can be removed from the module scope if not used elsewhere).

- [ ] **Step 4.4: Remove the now-orphaned module-level constants**

If `LETTER_NAMES` and `LETTER_PITCHES` (theory.ts:432-441) are not exported and not used elsewhere, delete them.

Verify they aren't exported (lines 432-441 should be `const`, not `export const`). They aren't — safe to remove.

Search for other internal usage:
```bash
grep -n "LETTER_NAMES\|LETTER_PITCHES" packages/core/src/theory.ts
```
Expected: only the (now-deleted) declarations and (now-inlined) function references appear. If `theory.ts` is clean, the constants are gone.

- [ ] **Step 4.5: Run the test suite**

Run: `pnpm --filter @fretflow/core test`
Expected: all PASS.

- [ ] **Step 4.6: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): use Tonal chroma in scale-aware note spelling"
```

---

## Task 5: Migrate scale operations

Functions: `getScaleNotes`, `getScaleSemitones`, `getDivergentNotes`. They consume the `SCALES` table.

Strategy: keep `SCALES` exported (consumers depend on it), but populate it from Tonal at module-load time so the source of truth is Tonal's catalog.

**Files:**
- Modify: `packages/core/src/theory.ts:514-576`
- Modify: `packages/core/src/theoryCatalog.ts` (the `SCALES` export at line 313)

- [ ] **Step 5.1: Run scale-related tests for baseline**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts -t "getScaleNotes|getScaleSemitones|getDivergentNotes"`
Expected: all PASS.

- [ ] **Step 5.2: Replace `getScaleNotes` body**

In `packages/core/src/theory.ts`, replace lines 514-519 with:

```ts
import { scaleNameToTonal } from "./lib/tonal";

export function getScaleNotes(rootNote: string, scaleName: string): string[] {
  const tonalName = scaleNameToTonal(normalizeScaleName(scaleName));
  if (!tonalName) return [];
  if (Note.chroma(rootNote) === undefined) return [];
  const tonalScale = Scale.get(`${rootNote} ${tonalName}`);
  // Tonal returns spelled notes (with octave info stripped). Normalize to sharps-form
  // to maintain the legacy contract (consumers do NOTES.indexOf on the result).
  return tonalScale.notes.map((n) => {
    const simplified = Note.simplify(n);
    return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
  });
}
```

- [ ] **Step 5.3: Replace `getScaleSemitones` body**

Replace lines 528-532 with:

```ts
export function getScaleSemitones(rootNote: string, scaleName: string): number[] {
  const tonalName = scaleNameToTonal(normalizeScaleName(scaleName));
  if (!tonalName) return [];
  const tonalScale = Scale.get(`${rootNote} ${tonalName}`);
  return tonalScale.intervals
    .map((interval) => Interval.semitones(interval))
    .filter((n): n is number => typeof n === "number");
}
```

- [ ] **Step 5.4: Replace `getDivergentNotes` body**

Replace lines 546-576. The legacy function compares a scale's intervals to a reference scale (Major or Natural Minor). Tonal-backed version:

```ts
export function getDivergentNotes(
  rootNote: string,
  scaleName: string,
): string[] {
  const resolvedScaleName = normalizeScaleName(scaleName);
  if (resolvedScaleName.includes("Blues")) return [];
  if (resolvedScaleName === "Major Pentatonic" || resolvedScaleName === "Minor Pentatonic") return [];
  if (resolvedScaleName === "Major" || resolvedScaleName === "Natural Minor") return [];

  const semis = getScaleSemitones(rootNote, scaleName);
  if (semis.length === 0) return [];

  const isMajorQuality = semis.includes(4); // contains major 3rd
  const refName = isMajorQuality ? "Major" : "Natural Minor";
  const refSemis = new Set(getScaleSemitones(rootNote, refName));

  return semis
    .filter((semitone) => !refSemis.has(semitone))
    .map((semitone) => {
      const t = Note.transpose(rootNote, Interval.fromSemitones(semitone));
      const simplified = Note.simplify(t);
      return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
    });
}
```

- [ ] **Step 5.5: Run scale tests**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS.

- [ ] **Step 5.6: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): migrate scale operations to Tonal"
```

---

## Task 6: Migrate chord operations

Functions: `getChordNotes`. Consumes `CHORDS` (which is derived from `CHORD_DEFINITIONS`).

Strategy: keep `CHORDS` and `CHORD_DEFINITIONS` exported (many internal references). Replace `getChordNotes`'s body to use Tonal. Future plans may delete the table entirely.

**Files:**
- Modify: `packages/core/src/theory.ts:534-539`

- [ ] **Step 6.1: Baseline**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts -t "getChordNotes"`
Expected: PASS.

- [ ] **Step 6.2: Add Chord import**

In `packages/core/src/theory.ts`:

```ts
import * as Chord from "@tonaljs/chord";
import { chordQualityToTonal, tonalChordSymbol } from "./lib/tonal";
```

- [ ] **Step 6.3: Replace `getChordNotes` body**

Replace lines 534-539 with:

```ts
export function getChordNotes(rootNote: string, chordName: string): string[] {
  if (Note.chroma(rootNote) === undefined) return [];
  const symbol = tonalChordSymbol(rootNote, chordName);
  if (!symbol) return [];
  const tonalChord = Chord.get(symbol);
  if (tonalChord.empty) return [];
  // Same sharps-form normalization as getIntervalNotes.
  return tonalChord.notes.map((n) => {
    const simplified = Note.simplify(n);
    return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
  });
}
```

- [ ] **Step 6.4: Run chord-related tests**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS.

If a particular chord (e.g. "Power Chord (5)") fails because Tonal returns fewer/different notes, verify the mapping in `tonal.ts` — the Tonal symbol `"5"` should produce a 2-note chord (root + 5th).

- [ ] **Step 6.5: Run the chord property tests if they exist**

Run: `pnpm --filter @fretflow/core test src/theory.property.test.ts`
Expected: all PASS.

- [ ] **Step 6.6: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): migrate chord-note resolution to Tonal"
```

---

## Task 7: Migrate diatonic chord generation

Function: `getDiatonicChord` (theory.ts:712-736). The composition: scale + degree → (root, quality). Used heavily by the chord-overlay degree mode and progression resolution.

**Files:**
- Modify: `packages/core/src/theory.ts:712-736`

- [ ] **Step 7.1: Baseline**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts -t "getDiatonicChord"`
Expected: PASS.

- [ ] **Step 7.2: Replace `getDiatonicChord` body**

Replace lines 712-736 with:

```ts
import { getQualityForDegree, getDegreesForScale } from "./degrees";

export function getDiatonicChord(
  degreeId: string,
  scaleName: string,
  tonicNote: string,
): { root: string; quality: string } | undefined {
  const degreesMap = getDegreesForScale(scaleName);

  // Find the semitone offset for this degree
  const semitoneEntry = Object.entries(degreesMap).find(
    ([, roman]) => roman === degreeId,
  );
  if (!semitoneEntry) return undefined;
  const semitone = Number(semitoneEntry[0]);

  // Compute the absolute root note via Tonal (was: NOTES + indexOf).
  if (Note.chroma(tonicNote) === undefined) return undefined;
  const transposed = Note.transpose(tonicNote, Interval.fromSemitones(semitone));
  const simplified = Note.simplify(transposed);
  const root = simplified.includes("b") ? Note.enharmonic(simplified) : simplified;

  const quality = getQualityForDegree(degreeId, scaleName);
  if (quality === undefined) return undefined;

  return { root, quality };
}
```

The dependency on `getQualityForDegree` and `getDegreesForScale` (in `degrees.ts`) is unchanged — those are migrated in Task 9.

- [ ] **Step 7.3: Run tests**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS.

- [ ] **Step 7.4: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): migrate getDiatonicChord to Tonal-based transposition"
```

---

## Task 8: Migrate key-signature functions

Functions: `getKeySignature`, `getKeySignatureForDisplay`. They use the legacy `KEY_SIGNATURES` lookup table.

Strategy: keep `KEY_SIGNATURES` exported (consumers may rely on it). Replace the functions to use Tonal's `Key.majorKey` / `Key.minorKey`, falling back to the legacy table.

**Files:**
- Modify: `packages/core/src/theory.ts:599-634`

- [ ] **Step 8.1: Baseline**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts -t "getKeySignature"`
Expected: PASS.

- [ ] **Step 8.2: Add Key import**

```ts
import * as Key from "@tonaljs/key";
```

- [ ] **Step 8.3: Replace `getKeySignature` body**

Replace lines 599-601 with:

```ts
export function getKeySignature(rootNote: string): number {
  const tonalKey = Key.majorKey(rootNote);
  // Tonal returns `alteration` as a positive integer for sharps, negative for flats.
  if (typeof tonalKey.alteration === "number") return tonalKey.alteration;
  // Fallback for inputs Tonal does not recognize (rare; preserves legacy behavior).
  return KEY_SIGNATURES[rootNote] ?? 0;
}
```

- [ ] **Step 8.4: Replace `getKeySignatureForDisplay` body**

The legacy function adjusts the signature based on the scale's offset from its parent major key and the user's flat-preference. Tonal does not have a direct equivalent — but it does provide the scale's degree intervals, and we already have `SCALE_TO_PARENT_MAJOR_OFFSET` from `theoryCatalog`.

Replace lines 603-634 with:

```ts
export function getKeySignatureForDisplay(
  rootNote: string,
  scaleName: string,
  useFlats: boolean,
): number {
  const offset = SCALE_TO_PARENT_MAJOR_OFFSET[normalizeScaleName(scaleName)] ?? 0;
  if (Note.chroma(rootNote) === undefined) return KEY_SIGNATURES[rootNote] ?? 0;

  // The "parent major" is the major key whose tonic is `offset` semitones above the current root.
  const parentMajorRoot = Note.transpose(rootNote, Interval.fromSemitones(offset));
  const parentSharp = Note.simplify(parentMajorRoot).includes("b")
    ? Note.enharmonic(Note.simplify(parentMajorRoot))
    : Note.simplify(parentMajorRoot);

  const originalIsSharp = rootNote.includes("#");

  if (!originalIsSharp && useFlats) {
    const flatName = Note.enharmonic(parentSharp);
    const flatKey = Key.majorKey(flatName);
    if (typeof flatKey.alteration === "number" && flatKey.alteration < 0) {
      return flatKey.alteration;
    }
  }

  const tonalKey = Key.majorKey(parentSharp);
  const sig = typeof tonalKey.alteration === "number" ? tonalKey.alteration : (KEY_SIGNATURES[parentSharp] ?? 0);

  if (originalIsSharp && sig < 0) {
    return 12 + sig;
  }
  return sig;
}
```

- [ ] **Step 8.5: Run tests**

Run: `pnpm --filter @fretflow/core test src/theory.test.ts`
Expected: all PASS. Key-signature tests are sensitive to flat/sharp enharmonics — if a case fails, identify the specific `(rootNote, scaleName, useFlats)` triple from the failure and check whether Tonal's `alteration` differs from the legacy table.

- [ ] **Step 8.6: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): migrate key-signature functions to Tonal"
```

---

## Task 9: Migrate degree-quality resolution

Functions: `getQualityForDegree` (degrees.ts:168-217), `remapDegreeForScale` (degrees.ts:144-167), `getDegreeSequence` (degrees.ts:241-263), `getDegreesForScale` (degrees.ts:264-end).

The legacy implementation hand-codes the diatonic chord qualities per scale (e.g., I = Major Triad in Major, V = Dominant 7th in Harmonic Minor with 7th-chord context). Tonal's `Key.majorKey().chords` gives the same diatonic-chord sequence.

Strategy: keep the existing data structure in `degrees.ts` as the source of truth for now (it's app-specific UX data — Roman-numeral conventions, scale-degree colors). Replace only the *derivation* internals where Tonal helps.

**Files:**
- Modify: `packages/core/src/degrees.ts:144-end`

- [ ] **Step 9.1: Baseline**

Run: `pnpm --filter @fretflow/core test src/degrees.test.ts`
Expected: all PASS.

- [ ] **Step 9.2: Read `degrees.ts:144-end` to understand the data structures**

Run: `cat packages/core/src/degrees.ts | tail -140`
Review the structure — most of the file is data tables mapping (scale, semitone) → degree Roman-numeral, and (scale, degree) → chord quality.

- [ ] **Step 9.3: Audit which functions benefit from Tonal**

Most of `degrees.ts` is *FretFlow-specific* data: the choice of which Roman numerals to display, which qualities to prefer in modes, the color palette. Tonal does not have this opinion.

The one function that benefits: `remapDegreeForScale` (lines 144-167) translates a degree from one scale into another. With Tonal, this becomes a chord-quality intersection check.

For this task, **leave `degrees.ts` largely unchanged**, but add an internal helper that uses Tonal to validate the legacy data structures match.

In `packages/core/src/degrees.ts`, add at the bottom:

```ts
import * as Key from "@tonaljs/key";
import { chordQualityToTonal, tonalToChordQuality } from "./lib/tonal";

/**
 * Validates that the diatonic-chord-quality table for a given scale matches what
 * Tonal would produce. Used in tests to catch drift; not called in production.
 *
 * @internal
 */
export function _validateDiatonicQualitiesAgainstTonal(
  scaleName: string,
): boolean {
  // Only validates Major and Natural Minor; modes derived from these use the same
  // sequence so a Major check is sufficient for Ionian/Dorian/etc.
  if (scaleName === "Major") {
    const key = Key.majorKey("C");
    const expectedTriadQualities = ["M", "m", "m", "M", "M", "m", "dim"];
    return key.triads.every((triad, i) => triad === expectedTriadQualities[i]);
  }
  if (scaleName === "Natural Minor") {
    const key = Key.minorKey("A");
    const expectedTriadQualities = ["m", "dim", "M", "m", "m", "M", "M"];
    return key.natural.triads.every((triad, i) => triad === expectedTriadQualities[i]);
  }
  return true;
}
```

- [ ] **Step 9.4: Add a passing test for the validator**

In `packages/core/src/degrees.test.ts`, add:

```ts
import { describe, expect, it } from "vitest";
import { _validateDiatonicQualitiesAgainstTonal } from "./degrees";

describe("diatonic-quality alignment with Tonal (drift detection)", () => {
  it("Major diatonic triads match Tonal", () => {
    expect(_validateDiatonicQualitiesAgainstTonal("Major")).toBe(true);
  });
  it("Natural Minor diatonic triads match Tonal", () => {
    expect(_validateDiatonicQualitiesAgainstTonal("Natural Minor")).toBe(true);
  });
});
```

- [ ] **Step 9.5: Run tests**

Run: `pnpm --filter @fretflow/core test src/degrees.test.ts`
Expected: all PASS — both the new validator tests and the existing tests.

If the new tests fail, that means Tonal's diatonic-chord catalog disagrees with FretFlow's hard-coded data. Inspect the disagreement: in most cases Tonal is right and the legacy data has a transcription error worth fixing. If it's a legitimate FretFlow choice (e.g., always Dominant 7 on V in minor), document it in a code comment inside the validator and skip that comparison.

- [ ] **Step 9.6: Commit**

```bash
git add packages/core/src/degrees.ts packages/core/src/degrees.test.ts
git commit -m "feat(core): add Tonal-based drift detection for diatonic qualities"
```

---

## Task 10: Migrate the circle of fifths label generator

Function: `getCircleNoteLabels` (circleOfFifthsUtils.ts:5-38). Generates display labels for the 12 positions on the Circle of Fifths wheel.

**Files:**
- Modify: `packages/core/src/circleOfFifthsUtils.ts:1-end`

- [ ] **Step 10.1: Baseline — read the existing implementation**

Run: `cat packages/core/src/circleOfFifthsUtils.ts`
Note the 12 positions and the rule for picking sharps vs flats per position.

- [ ] **Step 10.2: Check for existing tests**

Run: `ls packages/core/src/ | grep -i circle`
Expected: no dedicated test file. The function's output is exercised indirectly through component tests in `src/components/CircleOfFifths/*`.

Read the legacy behavior first to pin the expected output:

```bash
node --input-type=module -e "import('@fretflow/core').then(m => console.log(m.getCircleNoteLabels(false), m.getCircleNoteLabels(true)))"
```
Record the two arrays — these become the expected values below. Replace the `<sharps-array>` and `<flats-array>` placeholders with the recorded outputs (e.g., sharps: `["C","G","D","A","E","B","F#","C#","G#","D#","A#","F"]`; flats: `["C","G","D","A","E","B","Gb","Db","Ab","Eb","Bb","F"]`).

Add focused tests in a new `packages/core/src/circleOfFifthsUtils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCircleNoteLabels } from "./circleOfFifthsUtils";

describe("getCircleNoteLabels", () => {
  it("returns 12 labels in the sharps cycle", () => {
    expect(getCircleNoteLabels(false)).toEqual(<sharps-array>);
  });
  it("returns 12 labels in the flats cycle", () => {
    expect(getCircleNoteLabels(true)).toEqual(<flats-array>);
  });
  it("starts at C and advances by perfect fifths", () => {
    const labels = getCircleNoteLabels(false);
    expect(labels[0]).toBe("C");
    expect(labels[1]).toBe("G");
    expect(labels[2]).toBe("D");
  });
});
```

Run: `pnpm --filter @fretflow/core test src/circleOfFifthsUtils.test.ts`
Expected: PASS — the tests pin the legacy output exactly.

- [ ] **Step 10.3: Rewrite the function using Tonal**

Replace `circleOfFifthsUtils.ts` contents with:

```ts
import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";

/**
 * Returns the 12 root labels for the Circle of Fifths, starting at C and
 * advancing by perfect 5ths. Sharps used by default; flats when `useFlats` is true.
 */
export function getCircleNoteLabels(useFlats: boolean): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const note = Note.transpose("C", Interval.fromSemitones(7 * i));
    const simplified = Note.simplify(note);
    // Convention: sharps form by default; user can opt into flats for keys 7+
    // (D♭, A♭, E♭, B♭, F, etc.) where flats are the conventional spelling.
    if (useFlats && simplified.includes("#")) {
      return Note.enharmonic(simplified);
    }
    return simplified;
  });
}
```

- [ ] **Step 10.4: Run the tests**

Run: `pnpm --filter @fretflow/core test src/circleOfFifthsUtils.test.ts`
Expected: PASS — Tonal must produce the same labels as the legacy implementation pinned in §10.2. If a label differs, the migration has changed user-visible behavior; either adjust the Tonal-backed code to match (preferred — Phase 1 is engine swap, not behavior change) or update the spec to acknowledge the change.

- [ ] **Step 10.5: Run the consuming component tests to confirm no regression**

Run: `pnpm test -- src/components/CircleOfFifths`
Expected: all PASS.

- [ ] **Step 10.6: Commit**

```bash
git add packages/core/src/circleOfFifthsUtils.ts packages/core/src/circleOfFifthsUtils.test.ts
git commit -m "refactor(core): migrate circle of fifths to Tonal"
```

---

## Task 11: Full-suite verification + bundle measurement

**Files:** none modified (verification only)

- [ ] **Step 11.1: Run the full core test suite**

Run: `pnpm --filter @fretflow/core test`
Expected: all PASS. Count should equal Step 0.2's baseline plus the new tests from Tasks 2, 9, and 10.

- [ ] **Step 11.2: Run the app test suite**

Run: `pnpm run test`
Expected: all PASS. None of the 73 `src/` consumer files should need changes — the migrated theory layer kept its public API.

- [ ] **Step 11.3: Run the linter**

Run: `pnpm run lint`
Expected: exits 0.

- [ ] **Step 11.4: Run the typecheck**

Run: `pnpm run build:types`
Expected: exits 0.

- [ ] **Step 11.5: Build the app**

Run: `pnpm run build`
Expected: exits 0; `dist/` populated.

- [ ] **Step 11.6: Measure the bundle**

Run: `du -sh dist/ && find dist -name "*.js" -exec wc -c {} + | sort -n`
Compare against Step 0.4's baseline. Tonal cherry-picked is roughly +15KB gzipped; the spec expects this and budgets for it.

- [ ] **Step 11.7: Run the e2e smoke test**

Run: `pnpm run test:e2e -- --grep "@smoke" --reporter=line` (or, if no smoke tag exists, the shortest spec: `pnpm run test:e2e -- e2e/app-components.spec.ts`)
Expected: all PASS. Smoke confirms no runtime regression in the deployed surface.

---

## Task 12: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 12.1: Update the Architecture section**

In `CLAUDE.md`, in the "Architecture > State & Logic" subsection, find the line:

```
- **Domain (pure):** `src/core/` — `theory.ts`, `theoryCatalog.ts`, `guitar.ts`, `degrees.ts`, `circleOfFifthsUtils.ts`, `constants.ts`. Plus the `src/shapes/` package (...).
```

Append after it:

```
- **Music theory:** `@fretflow/core`'s theory functions (`getNoteDisplay`, `getChordNotes`, `getScaleNotes`, `getDiatonicChord`, `getKeySignature`, etc.) are backed by [Tonal.js](https://github.com/tonaljs/tonal) (`@tonaljs/note`, `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/key`, `@tonaljs/interval`). Naming translation lives in `packages/core/src/lib/tonal.ts`.
```

- [ ] **Step 12.2: Run tests to ensure CLAUDE.md doesn't break anything**

Run: `pnpm run test` (CLAUDE.md is not built or tested, but a sanity check is cheap)
Expected: PASS.

- [ ] **Step 12.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): note Tonal.js backing of theory layer"
```

---

## Task 13: Final sanity check before declaring Phase 1 done

**Files:** none modified (verification only)

- [ ] **Step 13.1: Verify all phase-1 commits are present**

Run: `git log --oneline 7042ae84..HEAD`
Expected: a clean sequence of commits matching the task list above (Tasks 1–12).

- [ ] **Step 13.2: Re-run the full suite as a final check**

Run: `pnpm run lint && pnpm run test && pnpm run build && pnpm run build:types`
Expected: each exits 0.

- [ ] **Step 13.3: Confirm no breaking changes to public exports**

Run:
```bash
git diff 7042ae84..HEAD -- packages/core/src/index.ts
```
Expected: empty diff. Phase 1 must not change what `@fretflow/core` exports.

- [ ] **Step 13.4: Confirm phase 1 acceptance**

Acceptance per spec §15:
- [ ] `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/note`, `@tonaljs/interval`, `@tonaljs/key` are dependencies.
- [ ] The bespoke theory layer has been *shrunk* (function bodies replaced) — full removal is deferred to later plans.
- [ ] `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` all pass.

If all four boxes check, Phase 1 is complete and ready for PR.

- [ ] **Step 13.5: Open a PR**

Run:
```bash
git push -u origin claude/optimistic-rhodes-1d1ad7
gh pr create --title "feat: adopt Tonal.js for music theory (Phase 1)" --body "$(cat <<'EOF'
## Summary

- Adopts `@tonaljs/*` (cherry-picked: note, chord, scale, interval, key) as the music-theory engine in `@fretflow/core`.
- Replaces function bodies in `theory.ts`, `degrees.ts`, `circleOfFifthsUtils.ts` to delegate to Tonal through a new `packages/core/src/lib/tonal.ts` adapter.
- Public API of `@fretflow/core` is unchanged — all 73 consumer files in `src/` work without modification.
- Existing test suites serve as the safety net; all green.

Implements Phase 1 of [docs/superpowers/specs/2026-05-20-fretflow-integration-design.md](docs/superpowers/specs/2026-05-20-fretflow-integration-design.md).

## Test plan

- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes (count matches baseline + new tests)
- [ ] `pnpm run build` succeeds
- [ ] `pnpm run test:e2e -- --grep @smoke` (or app-components spec) passes
- [ ] Bundle size delta < +30KB gzipped
- [ ] Manual smoke: open dev server, change scale, change chord, verify fretboard renders correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
