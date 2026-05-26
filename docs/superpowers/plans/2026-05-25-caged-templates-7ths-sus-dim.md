# CAGED Full-Voicing Templates — 7ths, Suspended, Diminished

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full 5-shape CAGED templates for seven new chord qualities — `maj7`, `m7`, `sus2`, `sus4`, `dim`, `dim7`, `m7b5` — taking CAGED full-voicing coverage from 15 templates (M / m / 7) to 50 (10 qualities × 5 shapes).

**Architecture:** Extend the existing data table in `packages/core/src/shapes/templates.ts` and the `FullChordQuality` union to include the new quality strings. Update the chord-type→quality mapping in `getFullChordShapeMatches` so progression chords like `Cmaj7` or `Gsus4` resolve to the new templates. Each quality is shipped as one self-contained task with a per-quality pitch-class test that catches fingering typos.

**Tech Stack:** TypeScript, vitest, Tonal.js (only for verification chord-note lookups in tests).

---

## Background

Currently the system has only 15 CAGED full-voicing templates (3 qualities × 5 shapes). Any progression step whose chord type is outside `{M, m, 7}` falls back to close-voicing (algorithmic on-the-fly generation), which produces compact 3-string shapes rather than full CAGED-style 5/6-string voicings. The 7th, suspended, and diminished families are common enough (especially `maj7` and `m7` in jazz/pop/R&B) that ship-quality CAGED voicings significantly extend the app's usefulness.

The existing template shape (`packages/core/src/shapes/templates.ts:22-28`):

```ts
export interface FullChordTemplate {
  shape: CagedShape;
  quality: FullChordQuality;
  anchorString: number;          // 0-indexed from high string (e=0, B=1, G=2, D=3, A=4, E=5)
  anchorFretOffset: number;      // absolute fret of the root in this voicing's canonical position
  fretsHighToLow: Array<number | null>; // 6 entries: e, B, G, D, A, E (null = muted)
}
export type CagedShape = "C" | "A" | "G" | "E" | "D";
export type FullChordQuality = "M" | "m" | "7";
```

Anchor info is identical across qualities for a given shape (it just locates the root); only `fretsHighToLow` and `quality` change per template:

| Shape | anchorString | anchorFretOffset |
|-------|--------------|------------------|
| C     | 4            | 3                |
| A     | 4            | 0                |
| G     | 5            | 3                |
| E     | 5            | 0                |
| D     | 3            | 0                |

---

## File map

**Modify**

- `packages/core/src/shapes/templates.ts` — extend `FullChordQuality` union (Task 1), then append new template entries per quality (Tasks 2–8). Final file holds 50 templates.

- `packages/core/src/shapes/fullChordShapes.ts` — extend the `chordType` → `quality` normalization in `getFullChordShapeMatches` so progression `chordType` strings (`"maj7"`, `"m7"`, `"sus2"`, `"sus4"`, `"dim"`, `"dim7"`, `"m7b5"`) map to the matching new `FullChordQuality` enum values. Task 1 owns this change.

- `packages/core/src/shapes/fullChordShapes.test.ts` — append per-quality tests (one per task 2–8) that verify (a) all 5 shapes resolve for the canonical root and (b) the resolved pitch-class set equals the expected chord tones (uses `Chord.get(...).notes` from `@tonaljs/chord` for the source of truth, then converts via the existing `normalizeToSharps` helper — see how the existing tests do it).

**Verify (no edits — just check pass)**

- `src/store/chordOverlayAtoms.test.ts` — uses the resolver via `chordHighlightPositionsAtom`; should keep passing as new qualities now return non-empty position sets.
- `e2e/fretboard-svg.visual.spec.ts:63` — CAGED visual snapshot still pinned to `M` quality; should not regress.

**Untouched**

- Close-voicing pathway (`packages/core/src/shapes/voicings.ts` `voicingType: "close"`) — unchanged. New qualities now have BOTH full and close voicings available; the user picks via the existing toggle.
- The chord overlay UI (`src/components/Inspector/`, `src/components/ChordOverlayControls/`) — unchanged. The "voicing" select already exposes full/close; nothing new to render.

---

## Anchor reference (same for every quality)

When writing each task's templates, copy the anchor fields from this table:

```ts
// shape: "C" → { anchorString: 4, anchorFretOffset: 3 }
// shape: "A" → { anchorString: 4, anchorFretOffset: 0 }
// shape: "G" → { anchorString: 5, anchorFretOffset: 3 }
// shape: "E" → { anchorString: 5, anchorFretOffset: 0 }
// shape: "D" → { anchorString: 3, anchorFretOffset: 0 }
```

---

## Tasks

### Task 1: Expand FullChordQuality union + chord-type mapping

**Files:**
- Modify: `packages/core/src/shapes/templates.ts:28`
- Modify: `packages/core/src/shapes/fullChordShapes.ts`
- Test: `packages/core/src/shapes/fullChordShapes.test.ts`

- [ ] **Step 1: Read the existing resolver to learn how `chordType` → `quality` is mapped today**

Open `packages/core/src/shapes/fullChordShapes.ts` and find where the input `chordType` string is normalized to one of `"M" | "m" | "7"`. (Either a `switch`, an object literal, or a `Map`.) Confirm the pattern.

- [ ] **Step 2: Write failing tests for new-quality resolution returning empty array (templates not yet added)**

Append to `packages/core/src/shapes/fullChordShapes.test.ts`:

```ts
describe("getFullChordShapeMatches — new qualities (no templates yet)", () => {
  for (const chordType of ["maj7", "m7", "sus2", "sus4", "dim", "dim7", "m7b5"] as const) {
    it(`resolves \`${chordType}\` to the new quality without crashing`, () => {
      const result = getFullChordShapeMatches({
        chordRoot: "C",
        chordType,
        tuning: ["E", "B", "G", "D", "A", "E"],
        maxFret: 15,
      });
      // No templates exist for these qualities yet — Task 1 only adds the
      // type + mapping. Tasks 2–8 add templates. So this initial assertion
      // is that the resolver returns an empty array (not an exception).
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "new qualities"`
Expected: FAIL — either TypeScript rejects the new chordType values, or the resolver throws/returns the wrong shape.

- [ ] **Step 4: Extend the type union**

In `packages/core/src/shapes/templates.ts`, replace the `FullChordQuality` definition:

```ts
export type FullChordQuality =
  | "M" | "m" | "7"
  | "maj7" | "m7"
  | "sus2" | "sus4"
  | "dim" | "dim7" | "m7b5";
```

- [ ] **Step 5: Extend the chord-type→quality mapping**

In `packages/core/src/shapes/fullChordShapes.ts`, add cases (or map entries) so each new chord-type string maps to its same-named quality. Concretely: for whichever switch/map normalizes the input `chordType`, add these seven entries returning the matching quality literal:

```ts
case "maj7": return "maj7";
case "m7": return "m7";
case "sus2": return "sus2";
case "sus4": return "sus4";
case "dim": return "dim";
case "dim7": return "dim7";
case "m7b5": return "m7b5";
```

(Adapt syntax to whatever pattern the file uses — switch, object literal, or Map.)

- [ ] **Step 6: Run test to verify it passes (empty array, not crash)**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "new qualities"`
Expected: PASS — resolver returns `[]` for each new quality (templates still missing).

Also run full file: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts` — confirm existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): extend FullChordQuality + chord-type mapping for 7ths/sus/dim"
```

---

### Task 2: maj7 templates (5 shapes)

**Files:**
- Modify: `packages/core/src/shapes/templates.ts` (append 5 entries)
- Test: `packages/core/src/shapes/fullChordShapes.test.ts`

**Reference voicings** (high-to-low = `[e, B, G, D, A, E]`, `null` = muted string):

| Shape | Canonical example | fretsHighToLow |
|-------|-------------------|----------------|
| C     | Cmaj7 `x32000`    | `[0, 0, 0, 2, 3, null]` |
| A     | Amaj7 `x02120`    | `[0, 2, 1, 2, 0, null]` |
| G     | Gmaj7 `320002`    | `[2, 0, 0, 0, 2, 3]`    |
| E     | Emaj7 `021100`    | `[0, 0, 1, 1, 2, 0]`    |
| D     | Dmaj7 `xx0222`    | `[2, 2, 2, 0, null, null]` |

Expected pitch classes for Cmaj7 (per shape, normalized to sharps): `{C, E, G, B}`.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/shapes/fullChordShapes.test.ts`:

```ts
describe("maj7 CAGED templates", () => {
  for (const shape of ["C", "A", "G", "E", "D"] as const) {
    it(`resolves a Cmaj7 ${shape}-shape voicing whose pitch classes are {C, E, G, B}`, () => {
      const matches = getFullChordShapeMatches({
        chordRoot: "C",
        chordType: "maj7",
        tuning: ["E", "B", "G", "D", "A", "E"],
        maxFret: 15,
      });
      const found = matches.find((m) => m.shape === shape);
      expect(found, `expected a ${shape}-shape match for Cmaj7`).toBeDefined();
      // Reuse the same pitch-class assertion the existing tests use — look
      // in this file for `pitchClassSet` or equivalent helper and follow it.
      const pcs = pitchClassSet(found!, ["E", "B", "G", "D", "A", "E"]);
      expect(pcs).toEqual(new Set(["C", "E", "G", "B"]));
    });
  }
});
```

(If `pitchClassSet` isn't named that, copy the equivalent helper pattern from the existing M / m / 7 tests in the same file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "maj7 CAGED"`
Expected: FAIL — no templates yet, `matches` is empty for all shapes.

- [ ] **Step 3: Add the 5 templates**

Append to the templates array in `packages/core/src/shapes/templates.ts`:

```ts
{ shape: "C", quality: "maj7", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [0, 0, 0, 2, 3, null] },
{ shape: "A", quality: "maj7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 2, 1, 2, 0, null] },
{ shape: "G", quality: "maj7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [2, 0, 0, 0, 2, 3] },
{ shape: "E", quality: "maj7", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 1, 1, 2, 0] },
{ shape: "D", quality: "maj7", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [2, 2, 2, 0, null, null] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "maj7 CAGED"`
Expected: PASS (5 tests).

If any one shape fails the pitch-class assertion, the `fretsHighToLow` array has a typo — recompute the absolute fret at that string and verify the resulting note. Do NOT loosen the assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): add maj7 CAGED templates (C, A, G, E, D)"
```

---

### Task 3: m7 templates (5 shapes)

**Files:**
- Modify: `packages/core/src/shapes/templates.ts` (append 5 entries)
- Test: `packages/core/src/shapes/fullChordShapes.test.ts`

**Reference voicings** for Cm7 (root anchored same as M templates):

| Shape | Canonical (rooted at C, transposed if needed) | fretsHighToLow |
|-------|-----------------------------------------------|----------------|
| C     | Cm7 `x35343` (barre at fret 3)                | `[3, 4, 3, 5, 3, null]` |
| A     | Am7 `x02010`                                  | `[0, 1, 0, 2, 0, null]` |
| G     | Gm7 `353333` (barre at fret 3)                | `[3, 3, 3, 3, 5, 3]`    |
| E     | Em7 `020000`                                  | `[0, 0, 0, 0, 2, 0]`    |
| D     | Dm7 `xx0211`                                  | `[1, 1, 2, 0, null, null]` |

Expected pitch classes for the canonical-root chord per shape: `{root, m3, P5, m7}`.

- [ ] **Step 1: Write the failing test**

Append:

```ts
describe("m7 CAGED templates", () => {
  for (const { shape, root, expected } of [
    { shape: "C", root: "C", expected: new Set(["C", "D#", "G", "A#"]) },
    { shape: "A", root: "A", expected: new Set(["A", "C", "E", "G"]) },
    { shape: "G", root: "G", expected: new Set(["G", "A#", "D", "F"]) },
    { shape: "E", root: "E", expected: new Set(["E", "G", "B", "D"]) },
    { shape: "D", root: "D", expected: new Set(["D", "F", "A", "C"]) },
  ] as const) {
    it(`resolves a ${root}m7 ${shape}-shape voicing`, () => {
      const matches = getFullChordShapeMatches({
        chordRoot: root,
        chordType: "m7",
        tuning: ["E", "B", "G", "D", "A", "E"],
        maxFret: 15,
      });
      const found = matches.find((m) => m.shape === shape);
      expect(found, `expected a ${shape}-shape match for ${root}m7`).toBeDefined();
      const pcs = pitchClassSet(found!, ["E", "B", "G", "D", "A", "E"]);
      expect(pcs).toEqual(expected);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "m7 CAGED"`
Expected: FAIL.

- [ ] **Step 3: Add the 5 templates**

Append:

```ts
{ shape: "C", quality: "m7", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [3, 4, 3, 5, 3, null] },
{ shape: "A", quality: "m7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 1, 0, 2, 0, null] },
{ shape: "G", quality: "m7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 3, 3, 3, 5, 3] },
{ shape: "E", quality: "m7", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 0, 0, 2, 0] },
{ shape: "D", quality: "m7", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [1, 1, 2, 0, null, null] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "m7 CAGED"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): add m7 CAGED templates (C, A, G, E, D)"
```

---

### Task 4: sus2 templates (5 shapes)

**Files:**
- Modify: `packages/core/src/shapes/templates.ts`
- Test: `packages/core/src/shapes/fullChordShapes.test.ts`

**Reference voicings:**

| Shape | Canonical | fretsHighToLow | Expected pcs |
|-------|-----------|----------------|--------------|
| C     | Csus2 `x30033`           | `[3, 3, 0, 0, 3, null]` | `{C, D, G}` |
| A     | Asus2 `x02200`           | `[0, 0, 2, 2, 0, null]` | `{A, B, E}` |
| G     | Gsus2 `300033`           | `[3, 3, 0, 0, 0, 3]`    | `{G, A, D}` |
| E     | Esus2 `024400`           | `[0, 0, 4, 4, 2, 0]`    | `{E, F#, B}` |
| D     | Dsus2 `xx0230`           | `[0, 3, 2, 0, null, null]` | `{D, E, A}` |

- [ ] **Step 1: Write the failing test**

```ts
describe("sus2 CAGED templates", () => {
  for (const { shape, root, expected } of [
    { shape: "C", root: "C", expected: new Set(["C", "D", "G"]) },
    { shape: "A", root: "A", expected: new Set(["A", "B", "E"]) },
    { shape: "G", root: "G", expected: new Set(["G", "A", "D"]) },
    { shape: "E", root: "E", expected: new Set(["E", "F#", "B"]) },
    { shape: "D", root: "D", expected: new Set(["D", "E", "A"]) },
  ] as const) {
    it(`resolves a ${root}sus2 ${shape}-shape voicing`, () => {
      const matches = getFullChordShapeMatches({
        chordRoot: root, chordType: "sus2",
        tuning: ["E", "B", "G", "D", "A", "E"], maxFret: 15,
      });
      const found = matches.find((m) => m.shape === shape);
      expect(found, `expected a ${shape}-shape match for ${root}sus2`).toBeDefined();
      expect(pitchClassSet(found!, ["E", "B", "G", "D", "A", "E"])).toEqual(expected);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "sus2 CAGED"`
Expected: FAIL.

- [ ] **Step 3: Add the 5 templates**

```ts
{ shape: "C", quality: "sus2", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [3, 3, 0, 0, 3, null] },
{ shape: "A", quality: "sus2", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 0, 2, 2, 0, null] },
{ shape: "G", quality: "sus2", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 3, 0, 0, 0, 3] },
{ shape: "E", quality: "sus2", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 4, 4, 2, 0] },
{ shape: "D", quality: "sus2", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [0, 3, 2, 0, null, null] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts -t "sus2 CAGED"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): add sus2 CAGED templates (C, A, G, E, D)"
```

---

### Task 5: sus4 templates (5 shapes)

**Files:** same as Task 4.

**Reference voicings:**

| Shape | Canonical | fretsHighToLow | Expected pcs |
|-------|-----------|----------------|--------------|
| C     | Csus4 `x33011`           | `[1, 1, 0, 3, 3, null]` | `{C, F, G}` |
| A     | Asus4 `x02230`           | `[0, 3, 2, 2, 0, null]` | `{A, D, E}` |
| G     | Gsus4 `330013`           | `[3, 1, 0, 0, 3, 3]`    | `{G, C, D}` |
| E     | Esus4 `022200`           | `[0, 0, 2, 2, 2, 0]`    | `{E, A, B}` |
| D     | Dsus4 `xx0233`           | `[3, 3, 2, 0, null, null]` | `{D, G, A}` |

- [ ] **Step 1: Write failing test** (same pattern as Task 4, swap arrays):

```ts
describe("sus4 CAGED templates", () => {
  for (const { shape, root, expected } of [
    { shape: "C", root: "C", expected: new Set(["C", "F", "G"]) },
    { shape: "A", root: "A", expected: new Set(["A", "D", "E"]) },
    { shape: "G", root: "G", expected: new Set(["G", "C", "D"]) },
    { shape: "E", root: "E", expected: new Set(["E", "A", "B"]) },
    { shape: "D", root: "D", expected: new Set(["D", "G", "A"]) },
  ] as const) {
    it(`resolves a ${root}sus4 ${shape}-shape voicing`, () => {
      const matches = getFullChordShapeMatches({
        chordRoot: root, chordType: "sus4",
        tuning: ["E", "B", "G", "D", "A", "E"], maxFret: 15,
      });
      const found = matches.find((m) => m.shape === shape);
      expect(found).toBeDefined();
      expect(pitchClassSet(found!, ["E", "B", "G", "D", "A", "E"])).toEqual(expected);
    });
  }
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Add templates:**

```ts
{ shape: "C", quality: "sus4", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [1, 1, 0, 3, 3, null] },
{ shape: "A", quality: "sus4", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 3, 2, 2, 0, null] },
{ shape: "G", quality: "sus4", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 1, 0, 0, 3, 3] },
{ shape: "E", quality: "sus4", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 2, 2, 2, 0] },
{ shape: "D", quality: "sus4", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [3, 3, 2, 0, null, null] },
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit:**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): add sus4 CAGED templates (C, A, G, E, D)"
```

---

### Task 6: dim (triad) templates (5 shapes)

**Reference voicings** (pure triad, sharps convention for pitch-classes):

| Shape | Canonical | fretsHighToLow | Expected pcs |
|-------|-----------|----------------|--------------|
| C     | Cdim `x3454x` (partial)  | `[null, 4, 5, 4, 3, null]` | `{C, D#, F#}` |
| A     | Adim `x0121x`            | `[null, 1, 2, 1, 0, null]` | `{A, C, D#}` |
| G     | Gdim `345xxx → 3x54xx`   | `[null, null, 3, 5, 4, 3]` | `{G, A#, C#}` |
| E     | Edim `0120xx → xx012x`   | `[null, null, 0, 2, 1, 0]` | `{E, G, A#}` |
| D     | Ddim `xx0131`            | `[1, 3, 1, 0, null, null]` | `{D, F, G#}` |

(Pitch classes use the codebase's sharps convention; `D#=Eb`, `F#=Gb`, `G#=Ab`, `A#=Bb`, `C#=Db`.)

- [ ] **Step 1: Write failing test:**

```ts
describe("dim CAGED templates", () => {
  for (const { shape, root, expected } of [
    { shape: "C", root: "C", expected: new Set(["C", "D#", "F#"]) },
    { shape: "A", root: "A", expected: new Set(["A", "C", "D#"]) },
    { shape: "G", root: "G", expected: new Set(["G", "A#", "C#"]) },
    { shape: "E", root: "E", expected: new Set(["E", "G", "A#"]) },
    { shape: "D", root: "D", expected: new Set(["D", "F", "G#"]) },
  ] as const) {
    it(`resolves a ${root}dim ${shape}-shape voicing`, () => {
      const matches = getFullChordShapeMatches({
        chordRoot: root, chordType: "dim",
        tuning: ["E", "B", "G", "D", "A", "E"], maxFret: 15,
      });
      const found = matches.find((m) => m.shape === shape);
      expect(found).toBeDefined();
      expect(pitchClassSet(found!, ["E", "B", "G", "D", "A", "E"])).toEqual(expected);
    });
  }
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Add templates:**

```ts
{ shape: "C", quality: "dim", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [null, 4, 5, 4, 3, null] },
{ shape: "A", quality: "dim", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [null, 1, 2, 1, 0, null] },
{ shape: "G", quality: "dim", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [null, null, 3, 5, 4, 3] },
{ shape: "E", quality: "dim", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [null, null, 0, 2, 1, 0] },
{ shape: "D", quality: "dim", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [1, 3, 1, 0, null, null] },
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit:**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): add dim CAGED templates (C, A, G, E, D)"
```

---

### Task 7: dim7 templates (5 shapes)

**Note:** dim7 is symmetric (the same shape repeats every 3 frets), so "CAGED" assignment is artificial — these are the most-canonical fingerings at each shape's home position.

**Reference voicings:**

| Shape | Canonical | fretsHighToLow | Expected pcs |
|-------|-----------|----------------|--------------|
| C     | Cdim7 `x3424x`           | `[null, 4, 2, 4, 3, null]` | `{C, D#, F#, A}` |
| A     | Adim7 `x01212`           | `[2, 1, 2, 1, 0, null]`    | `{A, C, D#, F#}` |
| G     | Gdim7 `x_323x_` (`3x232x`) | `[null, 2, 3, 2, null, 3]` | `{G, A#, C#, E}` |
| E     | Edim7 `012020`           | `[0, 2, 0, 2, 1, 0]`       | `{E, G, A#, C#}` |
| D     | Ddim7 `xx0101`           | `[1, 0, 1, 0, null, null]` | `{D, F, G#, B}` |

- [ ] **Step 1: Write failing test:**

```ts
describe("dim7 CAGED templates", () => {
  for (const { shape, root, expected } of [
    { shape: "C", root: "C", expected: new Set(["C", "D#", "F#", "A"]) },
    { shape: "A", root: "A", expected: new Set(["A", "C", "D#", "F#"]) },
    { shape: "G", root: "G", expected: new Set(["G", "A#", "C#", "E"]) },
    { shape: "E", root: "E", expected: new Set(["E", "G", "A#", "C#"]) },
    { shape: "D", root: "D", expected: new Set(["D", "F", "G#", "B"]) },
  ] as const) {
    it(`resolves a ${root}dim7 ${shape}-shape voicing`, () => {
      const matches = getFullChordShapeMatches({
        chordRoot: root, chordType: "dim7",
        tuning: ["E", "B", "G", "D", "A", "E"], maxFret: 15,
      });
      const found = matches.find((m) => m.shape === shape);
      expect(found).toBeDefined();
      expect(pitchClassSet(found!, ["E", "B", "G", "D", "A", "E"])).toEqual(expected);
    });
  }
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Add templates:**

```ts
{ shape: "C", quality: "dim7", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [null, 4, 2, 4, 3, null] },
{ shape: "A", quality: "dim7", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [2, 1, 2, 1, 0, null] },
{ shape: "G", quality: "dim7", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [null, 2, 3, 2, null, 3] },
{ shape: "E", quality: "dim7", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 2, 0, 2, 1, 0] },
{ shape: "D", quality: "dim7", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [1, 0, 1, 0, null, null] },
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit:**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): add dim7 CAGED templates (C, A, G, E, D)"
```

---

### Task 8: m7b5 (half-diminished) templates (5 shapes)

**Reference voicings:**

| Shape | Canonical | fretsHighToLow | Expected pcs |
|-------|-----------|----------------|--------------|
| C     | Cm7b5 `x3434x`            | `[null, 4, 3, 4, 3, null]` | `{C, D#, F#, A#}` |
| A     | Am7b5 `x0101x`            | `[null, 1, 0, 1, 0, null]` | `{A, C, D#, G}` |
| G     | Gm7b5 `3x3323`            | `[3, 2, 3, 3, null, 3]`    | `{G, A#, C#, F}` |
| E     | Em7b5 `012030`            | `[0, 3, 0, 2, 1, 0]`       | `{E, G, A#, D}` |
| D     | Dm7b5 `xx0111`            | `[1, 1, 1, 0, null, null]` | `{D, F, G#, C}` |

- [ ] **Step 1: Write failing test:**

```ts
describe("m7b5 CAGED templates", () => {
  for (const { shape, root, expected } of [
    { shape: "C", root: "C", expected: new Set(["C", "D#", "F#", "A#"]) },
    { shape: "A", root: "A", expected: new Set(["A", "C", "D#", "G"]) },
    { shape: "G", root: "G", expected: new Set(["G", "A#", "C#", "F"]) },
    { shape: "E", root: "E", expected: new Set(["E", "G", "A#", "D"]) },
    { shape: "D", root: "D", expected: new Set(["D", "F", "G#", "C"]) },
  ] as const) {
    it(`resolves a ${root}m7b5 ${shape}-shape voicing`, () => {
      const matches = getFullChordShapeMatches({
        chordRoot: root, chordType: "m7b5",
        tuning: ["E", "B", "G", "D", "A", "E"], maxFret: 15,
      });
      const found = matches.find((m) => m.shape === shape);
      expect(found).toBeDefined();
      expect(pitchClassSet(found!, ["E", "B", "G", "D", "A", "E"])).toEqual(expected);
    });
  }
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Add templates:**

```ts
{ shape: "C", quality: "m7b5", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [null, 4, 3, 4, 3, null] },
{ shape: "A", quality: "m7b5", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [null, 1, 0, 1, 0, null] },
{ shape: "G", quality: "m7b5", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 2, 3, 3, null, 3] },
{ shape: "E", quality: "m7b5", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 3, 0, 2, 1, 0] },
{ shape: "D", quality: "m7b5", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [1, 1, 1, 0, null, null] },
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit:**

```bash
git add packages/core/src/shapes/templates.ts packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "feat(shapes): add m7b5 CAGED templates (C, A, G, E, D)"
```

---

### Task 9: Drop the Task 1 "returns empty array" expectations

**Files:** `packages/core/src/shapes/fullChordShapes.test.ts`

The Task 1 test (`"resolves \`<type>\` to the new quality without crashing"`) asserts each new quality returns `[]`. After Tasks 2–8 populate templates, that assertion is wrong — each quality now returns 5 matches. Update or delete the obsolete `describe` block.

- [ ] **Step 1: Delete the obsolete describe block**

Remove the `describe("getFullChordShapeMatches — new qualities (no templates yet)", ...)` block from `fullChordShapes.test.ts`. The per-quality coverage in Tasks 2–8 supersedes it.

- [ ] **Step 2: Run the full file**

Run: `pnpm vitest run packages/core/src/shapes/fullChordShapes.test.ts`
Expected: PASS — the obsolete block is gone, all 35 new per-quality tests pass, existing M / m / 7 tests pass.

- [ ] **Step 3: Commit:**

```bash
git add packages/core/src/shapes/fullChordShapes.test.ts
git commit -m "test(shapes): drop obsolete \"no templates yet\" placeholder assertions"
```

---

### Task 10: Full local verification + snapshot refresh

**Files:** none modified directly.

- [ ] **Step 1: Lint + unit + build + e2e**

Run:

```bash
pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production
```

Expected: all four exit 0. The chord-overlay atom tests (`src/store/chordOverlayAtoms.test.ts`) and the playback tests should be unaffected (chord-tone resolution still routes through the same atoms; the new templates only EXTEND the set of resolvable types).

If any test breaks: most likely a snapshot in `chordOverlayAtoms.test.ts` for a chord type that USED to return empty close-voicing positions and now returns full-voicing positions instead. Inspect the diff, confirm the change is semantically correct (new templates resolved), and update the snapshot.

- [ ] **Step 2: Visual baseline refresh**

Run: `pnpm test:visual:update`.

The existing visual snapshot at `e2e/fretboard-svg.visual.spec.ts:63` only pins `M` quality CAGED rendering — should be untouched. If it changes, investigate before committing.

Inspect changes:
```bash
git status -- e2e/
git diff --stat -- e2e/
```

- [ ] **Step 3: Commit snapshots (if any changed)**

```bash
git status -- e2e/
# Only if snapshots changed:
git add 'e2e/**/*-snapshots/**'
git commit -m "test(visual): refresh baselines for new CAGED chord templates"
```

- [ ] **Step 4: Manual smoke**

```bash
pnpm dev
```

In the app: set the scale to C major, choose chord `Cmaj7` (or load a progression containing `IV → ii7 → V7 → IMaj7`). Open the chord overlay. Confirm:
- Each of the 5 CAGED shapes (cycle via the shape selector) renders a full-voicing polygon for `maj7`, not the close-voicing 3-string subset.
- Same check for `Am7`, `Dsus4`, `Bm7b5`, `Bdim7`.
- The polygon notes match the expected chord tones (e.g. `Cmaj7` → C, E, G, B somewhere on the polygon).

---

## Verification

1. **Unit:** `pnpm test` green. The 7 new `describe` blocks (one per quality, 5 tests each = 35 new test cases) all pass. Total project test count rises by ~35.
2. **Lint:** `pnpm lint` clean.
3. **Build:** `pnpm build` succeeds (the `FullChordQuality` union expansion is the only type-system change; all consumers route through it).
4. **E2E:** `pnpm test:e2e:production` passes.
5. **Visual:** `pnpm test:visual` passes against existing baselines (CAGED visual spec only covers M quality).
6. **Manual:** chord-overlay polygons render correctly for each new quality at each CAGED shape position.

---

## Self-review

**1. Spec coverage:**
- (a) maj7 + m7 → Tasks 2, 3.
- (b) sus2 + sus4 → Tasks 4, 5.
- (c) dim + dim7 + m7b5 → Tasks 6, 7, 8.
- (d) Full 5 shapes per quality → every task adds exactly 5 templates.
- (e) Strict (no skipped shapes) → enforced by per-quality test loop.

**2. Placeholder scan:** no "TBD", "implement later", or vague "handle edge cases". Every fingering is specified. Every test body is shown verbatim. Tasks 4-8 follow Task 2-3's pattern explicitly (not "similar to Task N").

**3. Type consistency:**
- `FullChordQuality` literal values used in templates match the strings the resolver maps from (`"maj7"`, `"m7"`, `"sus2"`, `"sus4"`, `"dim"`, `"dim7"`, `"m7b5"`) — Task 1 establishes the union, Tasks 2-8 use the same literals.
- `anchorString` / `anchorFretOffset` follow the table at the top of the plan, consistent across qualities.
- `pitchClassSet(found!, tuning)` helper is referenced in every per-quality test — the implementer is told once (in Task 2 Step 1) to copy the existing helper pattern from M/m/7 tests; later tasks just use the same call.
- Pitch classes use the sharps convention throughout (`D#` not `Eb`, `F#` not `Gb`) — matches the codebase's stored-as-sharps convention and the existing `getChordNotes`/`normalizeToSharps` output.
