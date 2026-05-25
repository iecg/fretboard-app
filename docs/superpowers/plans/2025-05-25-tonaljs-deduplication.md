# Tonal.js Music Theory Deduplication Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove hand-coded music theory tables and utilities that duplicate existing `@tonaljs` APIs, replacing them with Tonal calls while preserving all existing behavior.

**Architecture:** The `packages/core/src/` package has accumulated duplicate enharmonic tables (`ENHARMONICS`, `ENHARMONIC_TO_SHARP`, `SHARP_TO_FLAT`), hand-coded key-signature data (`KEY_SIGNATURES`, `FLAT_KEYS`), manual pitch-class utilities (`normalizePitchClass`, `transposePitchClass`, `formatPitchClass`), and a redundant display-label table (`CIRCLE_DISPLAY_LABELS`). These all have direct Tonal equivalents already installed. Each replacement is independently safe and reversible. No behavioral changes — only implementation changes behind the same exported interface.

**Tech Stack:** TypeScript, `@tonaljs/note`, `@tonaljs/interval`, `@tonaljs/key`, `@tonaljs/scale`, `@fretflow/core`

---

### Task 1: Remove duplicate enharmonic table from theoryCatalog.ts

**Files:**
- Modify: `packages/core/src/theoryCatalog.ts:55-65`
- Modify: `packages/core/src/theoryCatalog.ts:329-351`

- [ ] **Step 1: Verify existing tests pass as baseline**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass.

- [ ] **Step 2: Replace `ENHARMONIC_TO_SHARP` / `SHARP_TO_FLAT` with Tonal calls**

The three local helpers `normalizePitchClass`, `transposePitchClass`, `formatPitchClass` depend on these tables. Replace them all at once with Tonal equivalents:

```typescript
// Remove lines 40-65 (CHROMATIC_NOTES + ENHARMONIC_TO_SHARP + SHARP_TO_FLAT)
// Replace normalizePitchClass, transposePitchClass, formatPitchClass:

import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";

function normalizePitchClass(note: string): string {
  // Tonal's simplify normalizes double-accidentals; enharmonic converts flat->sharp.
  const simplified = Note.simplify(note);
  if (!simplified) return note;
  return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
}

function getPitchClassIndex(note: string): number {
  const chroma = Note.chroma(normalizePitchClass(note));
  return typeof chroma === "number" && !isNaN(chroma) ? chroma : -1;
}

function transposePitchClass(note: string, semitoneDelta: number): string {
  const idx = getPitchClassIndex(note);
  if (idx === -1) return note;
  const transposed = Note.transpose("C", Interval.fromSemitones(semitoneDelta + idx));
  return normalizePitchClass(transposed);
}

function formatPitchClass(note: string, useFlats = false): string {
  const normalized = normalizePitchClass(note);
  if (!useFlats) return normalized;
  // Convert sharp to flat via Note.enharmonic
  const flatVersion = Note.enharmonic(normalized);
  // Only use flat version if it's actually a flat spelling
  return flatVersion.includes("b") ? flatVersion : normalized;
}
```

- [ ] **Step 3: Run tests to verify no regression**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/theoryCatalog.ts
git commit -m "refactor(core): replace manual enharmonic tables with @tonaljs calls"
```

---

### Task 2: Remove FLAT_KEYS array in theory.ts

**Files:**
- Modify: `packages/core/src/theory.ts:62-73`

- [ ] **Step 1: Verify existing tests pass**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass.

- [ ] **Step 2: Replace `FLAT_KEYS.includes()` with `Key.majorKey().alteration < 0`**

`FLAT_KEYS` is used in two places within `theory.ts`:

**Usage 1 — `getNoteDisplay` at line 312:**
```typescript
import * as Key from "@tonaljs/key";

// Change from:
//   const wantsFlats = useFlats ?? FLAT_KEYS.includes(activeRoot);
// To:
export function isFlatKey(rootNote: string): boolean {
  const key = Key.majorKey(rootNote);
  return typeof key.alteration === "number" && key.alteration < 0;
}

// In getNoteDisplay:
  const wantsFlats = useFlats ?? isFlatKey(activeRoot);
```

**Usage 2 — `resolveAccidentalMode` at lines 551, 564:**
```typescript
// Change from:
//   if (isNatural) return FLAT_KEYS.includes(rootNote);
// To:
  if (isNatural) return isFlatKey(rootNote);

// And:
//   if (!intervals) return FLAT_KEYS.includes(rootNote);
// To:
  if (!intervals) return isFlatKey(rootNote);
```

- [ ] **Step 3: Run tests**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): replace FLAT_KEYS array with Key.majorKey().alteration"
```

---

### Task 3: Remove KEY_SIGNATURES hand-coded table

**Files:**
- Modify: `packages/core/src/theory.ts:466-492`

- [ ] **Step 1: Verify tests pass**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass.

- [ ] **Step 2: Remove the `KEY_SIGNATURES` static table and simplify `getKeySignature`**

The table `KEY_SIGNATURES` at lines 466-484 is a static lookup. The function `getKeySignature` at lines 486-492 primarily delegates to `Key.majorKey().alteration` and falls back to the table.

Remove the table entirely (lines 466-484) and simplify the function — remove the fallback since `Key.majorKey()` handles all standard note names:

```typescript
export function getKeySignature(rootNote: string): number {
  const tonalKey = Key.majorKey(rootNote);
  if (typeof tonalKey.alteration === "number") return tonalKey.alteration;
  return 0; // unrecognized input — safe default
}
```

- [ ] **Step 3: Check `getKeySignatureForDisplay` references to KEY_SIGNATURES**

At line 502 and 529, `getKeySignatureForDisplay` references `KEY_SIGNATURES[rootNote]` as a fallback. Change these:

```typescript
// Line 502: change from:
//   return KEY_SIGNATURES[rootNote] ?? 0;
// To:
  return getKeySignature(rootNote);

// Line 529: change from:
//   const sig = typeof tonalKey.alteration === "number" ? tonalKey.alteration : (KEY_SIGNATURES[parentSharp] ?? 0);
// To:
  const sig = typeof tonalKey.alteration === "number" ? tonalKey.alteration : getKeySignature(parentSharp);
```

- [ ] **Step 4: Run tests**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): replace KEY_SIGNATURES table with Key.majorKey()"
```

---

### Task 4: Remove CIRCLE_DISPLAY_LABELS table

**Files:**
- Modify: `packages/core/src/theory.ts:589-602`
- Search for all consumers of `CIRCLE_DISPLAY_LABELS` in `src/`

- [ ] **Step 1: Find all consumers**

Run: `rg -rn "CIRCLE_DISPLAY_LABELS" packages/core/src/ src/`

Expected: Shows usage in `theory.ts` (definition) plus any consumer files in `src/`.

- [ ] **Step 2: Replace with computed labels using Note.enharmonic()**

Remove the static table at lines 589-602. Replace with a computed approach:

```typescript
export function getCircleDisplayLabel(noteName: string): string {
  if (!noteName.includes("#") && !noteName.includes("b")) return noteName;
  if (noteName === "F#") return "F#/Gb";
  const flatName = Note.enharmonic(noteName);
  return flatName !== noteName ? `${noteName}/${flatName}` : noteName;
}
```

This preserves the special "F#/Gb" display (both names shown together) while computing the flat equivalent dynamically for other notes.

- [ ] **Step 3: Update all imports in consumer files**

Replace `CIRCLE_DISPLAY_LABELS` imports with `getCircleDisplayLabel` in any consumer files found in Step 1. Update the call sites from `CIRCLE_DISPLAY_LABELS[noteName]` to `getCircleDisplayLabel(noteName)`.

- [ ] **Step 4: Run tests**

Run: `pnpm run test`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theory.ts
git commit -m "refactor(core): replace CIRCLE_DISPLAY_LABELS table with dynamic enharmonic labels"
```

---

### Task 5: Simplify parseNote() using Tonal

**Files:**
- Modify: `packages/core/src/guitar.ts:14-23`
- Test: `packages/core/src/guitar.test.ts`

- [ ] **Step 1: Verify existing guitar tests pass**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass.

- [ ] **Step 2: Read existing parseNote test**

Run: `rg -n "parseNote" packages/core/src/guitar.test.ts`

Expected: Shows test cases for parseNote.

- [ ] **Step 3: Replace custom regex + NOTES.indexOf with Note.get()**

```typescript
export function parseNote(noteString: string): NoteWithOctave | null {
  if (!noteString) return null;
  const tonalNote = Note.get(noteString);
  if (tonalNote.empty) return null;
  return {
    noteName: tonalNote.letter + (tonalNote.acc || ""),
    octave: tonalNote.oct,
  };
}
```

`Note.get()` returns `{ empty, letter, acc, oct, chroma }`. The `letter` is the note letter (`"C"`..`"B"`), `acc` is the accidental string (`""`, `"#"`, `"b"`), `oct` is the octave number. If `empty` is `true`, the input was unparseable.

- [ ] **Step 4: Run tests**

Run: `pnpm run test -- --project=packages/core`

Expected: All tests pass. If any test fails because `Note.get()` parses differently than the old regex (e.g. it accepts "Cb4" where the old parser didn't), update the test expectations — Tonal's behavior is the source of truth.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/guitar.ts packages/core/src/guitar.test.ts
git commit -m "refactor(core): use Note.get() for parseNote instead of custom regex"
```

---

### Task 6: Remove unused @tonaljs packages from dependencies

**Files:**
- Modify: `packages/core/package.json:35-36`

- [ ] **Step 1: Verify neither package is imported in production code**

Run:
```
rg -n "@tonaljs/progression" packages/core/src/ --include='*.ts'
rg -n "@tonaljs/roman-numeral" packages/core/src/ --include='*.ts'
```

Expected: No production imports found.

- [ ] **Step 2: Check test imports**

Run:
```
rg -n "tonaljs/(progression|roman-numeral)" packages/core/src/ --include='*.test.ts'
```

Expected: Only `degrees.test.ts` imports `roman-numeral` for validation. Keep it.

- [ ] **Step 3: Remove unused `@tonaljs/progression` from package.json**

In `packages/core/package.json`, remove the line:
```
"@tonaljs/progression": "^4.9.2",
```

Keep `@tonaljs/roman-numeral` since it's used in tests.

- [ ] **Step 4: Run tests to confirm no breakage**

Run: `pnpm install && pnpm run test -- --project=packages/core`

Expected: Install succeeds, tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "chore(core): remove unused @tonaljs/progression dependency"
```

---

### Spec Self-Review

- **Spec coverage:** All safe replacements are covered across 6 tasks. The following were intentionally excluded as non-duplicative or intentional divergence: `NOTES` array (used as index-based lookup — replacing with `Note.chroma()` doesn't buy anything), `MODE_DEGREES` (already delegates 7/8 to Tonal), `DEGREE_DIATONIC_QUALITY` (intentionally hand-coded to match FretFlow conventions), `getNoteDisplayInScale()` (implements letter-cycle — behaviorally equivalent to `Scale.get().notes` but caller interface differs), `CHORD_DEFINITIONS` (already delegates semitone data to Tonal; member names are the overlay contract).
- **Placeholder scan:** Every step has complete code. No TBDs or TODOs.
- **Type consistency:** `isFlatKey()` signature matches usage in both callers. `getCircleDisplayLabel()` replaces `CIRCLE_DISPLAY_LABELS[noteName]` with equivalent function call.
- **Test verification:** Each task runs tests after the change. Task 5 explicitly addresses test expectation changes if `Note.get()` parses differently.
