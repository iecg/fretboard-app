# Extended Chord Qualities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nine extended chord qualities (`add9`, `9`, `maj9`, `m9`, `6/9`, `9sus4`, `13`, `maj13`, `m13`) to FretFlow — definitions, close voicings, and the quality picker — without touching the CAGED full-chord system.

**Architecture:** Three layers. (1) Core data: extend the `ChordMemberName` union and `ChordQuality` category, add nine `CHORD_DEFINITIONS` entries via `buildChordDef`, and add a `VOICING_OMISSIONS` table. (2) Voicings: `closeVoicings` consults `VOICING_OMISSIONS` to drop the 5th from 6-note 13th chords before the 3–5-note gate. (3) UI: add labels and an "Extensions" group to the **live** grouped quality picker.

**Tech Stack:** TypeScript, Tonal.js (via `getChordSemitonesFromTonal`), Vitest, Testing Library, Playwright (visual regression).

**Source spec:** [`docs/superpowers/specs/2026-06-01-extended-chord-qualities-design.md`](../specs/2026-06-01-extended-chord-qualities-design.md)

---

## Codebase grounding (verified against the current tree)

- `ChordMemberName` union: `packages/core/src/theory.ts:68`. `ChordQuality` category: `theory.ts:69`. `CHORD_DEFINITIONS`: `theory.ts:203–219`, built by `buildChordDef(tonalSymbol, category, memberNames)` (`theory.ts:186`).
- **`buildChordDef` throws at module load** if `memberNames.length !== getChordSemitonesFromTonal(symbol).length`. This is our free correctness check: a wrong symbol or member count fails the very first `pnpm test`.
- **Pitch-class members:** `getChordSemitonesFromTonal` (`packages/core/src/lib/tonal.ts:93`) reduces intervals `((s % 12) + 12) % 12`, so a `"9"` member stores semitone `2`, a `"13"` stores `9`. Member **count** is what matters for `buildChordDef`; the names are the overlay contract.
- `closeVoicings`: `packages/core/src/shapes/voicings.ts:129`. The 3–5-note gate is at `voicings.ts:135–136` (`voiceCount < 3 || voiceCount > 5 → return []`). It reads `def.members` for count and pitch classes.
- **UI discrepancy — important.** The spec names `src/components/Inspector/ChordTypeGrid.tsx` and `buildQualityToggleOptions()` (`src/components/shared/chordControlOptions.ts`) as the picker. **In the current tree those are vestigial** — `ChordTypeGrid` is imported only by its own test, and `buildQualityToggleOptions` only by its own test. The **live, rendered** grouped quality picker is `src/components/SongControls/qualityGroups.ts` (`buildQualitySelectGroups` / `buildQualityGroupsWithDiatonic`), consumed by `src/components/SongControls/SongControls.tsx` via Radix `LabeledSelectGroup`. This plan wires the new group into the **live** picker and updates the **shared source of truth** (`CHORD_TYPE_SHORT_LABELS`, `CHORD_TYPE_DISPLAY_ORDER` in `src/components/ChordOverlayControls/chordTypeOptions.ts`) so any consumer benefits. The vestigial files are left alone (a separate cleanup, not this work).
- `CHORD_TYPE_SHORT_LABELS` + `CHORD_TYPE_DISPLAY_ORDER`: `src/components/ChordOverlayControls/chordTypeOptions.ts`. `qualityGroups.ts` filters its group keys through `CHORD_TYPE_DISPLAY_ORDER.includes(k)` (`qualityGroups.ts:45`), so a new key **must** be added to `CHORD_TYPE_DISPLAY_ORDER` or it will be silently dropped from the picker.

---

## File Structure

- **Modify** `packages/core/src/theory.ts` — union + category + nine definitions.
- **Modify** `packages/core/src/shapes/voicings.ts` — `VOICING_OMISSIONS` table + omission step in `closeVoicings`.
- **Modify** `src/components/ChordOverlayControls/chordTypeOptions.ts` — nine labels + nine display-order entries.
- **Modify** `src/components/SongControls/qualityGroups.ts` — `EXTENSION_KEYS`, `extensions` label field, new group.
- **Modify** `src/components/SongControls/SongControls.tsx` — pass the `extensions` group label.
- **Modify** `src/i18n/` — add the "Extensions" group-label string.
- **Test** files co-located per convention.

---

### Task 1: Core — extend union, category, and add nine definitions

**Files:**
- Modify: `packages/core/src/theory.ts:68` (union), `:69` (category), `:203–219` (definitions)
- Test: `packages/core/src/theory.test.ts` (append; create if absent)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/theory.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CHORD_DEFINITIONS, getChordNotes } from "./theory";

describe("extended chord qualities", () => {
  const cases: Array<[string, string[]]> = [
    // quality, expected member NAMES in definition order
    ["add9", ["root", "3", "5", "9"]],
    ["9", ["root", "3", "5", "b7", "9"]],
    ["maj9", ["root", "3", "5", "7", "9"]],
    ["m9", ["root", "b3", "5", "b7", "9"]],
    ["6/9", ["root", "3", "5", "6", "9"]],
    ["9sus4", ["root", "4", "5", "b7", "9"]],
    ["13", ["root", "3", "5", "b7", "9", "13"]],
    ["maj13", ["root", "3", "5", "7", "9", "13"]],
    ["m13", ["root", "b3", "5", "b7", "9", "13"]],
  ];

  it.each(cases)("%s is defined with the expected members", (quality, names) => {
    const def = CHORD_DEFINITIONS[quality];
    expect(def).toBeDefined();
    expect(def.members.map((m) => m.name)).toEqual(names);
    expect(def.quality).toBe("extended");
  });

  it("resolves notes for a sharp root and a flat-key root", () => {
    // Cmaj9 = C E G B D
    expect(getChordNotes("C", "maj9")).toEqual(
      expect.arrayContaining(["C", "E", "G", "B", "D"]),
    );
    // Fm9 in a flat key — confirm it resolves (sharps-form internal names)
    expect(getChordNotes("F", "m9").length).toBe(5);
  });
});
```

> If `getChordNotes`'s exact return shape differs (e.g. objects vs strings), adjust the assertion to its real shape — check an existing `getChordNotes` test first and mirror it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fretflow/core vitest run src/theory.test.ts`
Expected: FAIL — the new qualities are `undefined`.

- [ ] **Step 3: Extend the union and category**

In `packages/core/src/theory.ts`, change line 68 from:

```ts
export type ChordMemberName = "root" | "2" | "b3" | "3" | "4" | "b5" | "#5" | "5" | "6" | "b7" | "7" | "bb7";
```

to:

```ts
export type ChordMemberName = "root" | "2" | "b3" | "3" | "4" | "b5" | "#5" | "5" | "6" | "b7" | "7" | "bb7" | "9" | "11" | "13";
```

And line 69 from:

```ts
export type ChordQuality = "triad" | "seventh" | "power" | "sixth" | "suspended";
```

to:

```ts
export type ChordQuality = "triad" | "seventh" | "power" | "sixth" | "suspended" | "extended";
```

(`"11"` is added for forward-compat with deferred altered chords; no in-scope quality uses it.)

- [ ] **Step 4: Add the nine definitions**

In `CHORD_DEFINITIONS` (`theory.ts:218`), immediately before the closing `};` and after the `"5"` power-chord entry, add:

```ts
  add9:  buildChordDef("add9",  "extended",  ["root", "3", "5", "9"]),
  "9":   buildChordDef("9",     "extended",  ["root", "3", "5", "b7", "9"]),
  maj9:  buildChordDef("maj9",  "extended",  ["root", "3", "5", "7", "9"]),
  m9:    buildChordDef("m9",    "extended",  ["root", "b3", "5", "b7", "9"]),
  "6/9": buildChordDef("6/9",   "extended",  ["root", "3", "5", "6", "9"]),
  "9sus4": buildChordDef("9sus4", "extended", ["root", "4", "5", "b7", "9"]),
  "13":  buildChordDef("13",    "extended",  ["root", "3", "5", "b7", "9", "13"]),
  maj13: buildChordDef("maj13", "extended",  ["root", "3", "5", "7", "9", "13"]),
  m13:   buildChordDef("m13",   "extended",  ["root", "b3", "5", "b7", "9", "13"]),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core vitest run src/theory.test.ts`
Expected: PASS.

**If `buildChordDef` throws at load** (e.g. `6/9 expects 5 members, Tonal returned N`), the Tonal alias differs. Diagnose with a one-off:

```bash
node -e "const {Chord}=require('@tonaljs/chord'); for (const s of ['add9','9','maj9','m9','6/9','9sus4','13','maj13','m13']) console.log(s, Chord.get('C'+s).intervals)"
```

Adjust the offending member array to match Tonal's interval count (e.g. if `6/9` resolves under the alias `69`, change the `buildChordDef` **symbol** to `"69"` while keeping the `CHORD_DEFINITIONS` key `"6/9"`).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/theory.ts packages/core/src/theory.test.ts
git commit -m "feat(core): add nine extended chord quality definitions"
```

---

### Task 2: Core — `VOICING_OMISSIONS` and close-voicing omission step

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts` (add table; modify `closeVoicings` at `:129`)
- Test: `packages/core/src/shapes/voicings.test.ts` (append; create if absent)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/shapes/voicings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateVoicings } from "./voicings"; // confirm the actual export name first
import { STANDARD_TUNING } from "@fretflow/core"; // or wherever the standard tuning lives

describe("VOICING_OMISSIONS for 13th chords", () => {
  it("a 13th chord generates close voicings after the 5th is dropped", () => {
    const voicings = generateVoicings({
      chordRoot: "C",
      chordType: "13",
      tuning: STANDARD_TUNING,
      maxFret: 15,
      mode: "close", // match the real param shape
    });
    expect(voicings.length).toBeGreaterThan(0);
    // each close voicing has 5 notes (root,3,b7,9,13 — 5th omitted)
    for (const v of voicings) {
      expect(v.notes.length).toBe(5);
    }
  });
});
```

> **First read `voicings.ts` for the real public entry point and `GenerateVoicingsParams` shape** (the close path may be reached via a `mode`/`voicingType` field, not a separate export). Mirror an existing voicings test exactly — adjust the call above to match. The assertion that matters is "13 produces non-empty 5-note close voicings."

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fretflow/core vitest run src/shapes/voicings.test.ts`
Expected: FAIL — `13` has 6 members, so `voiceCount > 5` returns `[]` (empty array, length 0).

- [ ] **Step 3: Add the omission table**

In `packages/core/src/shapes/voicings.ts`, near the top (after imports, alongside `CLOSE_VOICING_SPAN_LIMIT`), add. Ensure `ChordMemberName` is imported from `@fretflow/core` / the theory module (add to the existing import if missing):

```ts
/**
 * Tones dropped before close-voicing generation, to reduce 6-note extended
 * chords to a playable grip. Tonal already omits the 11th on 13th chords;
 * dropping the 5th brings them to the standard 5-note jazz voicing
 * (root, 3/b3, b7/7, 9, 13). This is the extension hook altered-dominant
 * voicings will reuse.
 */
export const VOICING_OMISSIONS: Record<string, ChordMemberName[]> = {
  "13": ["5"],
  maj13: ["5"],
  m13: ["5"],
};
```

- [ ] **Step 4: Apply the omission inside `closeVoicings`**

In `closeVoicings` (`voicings.ts:129`), after `const def = CHORD_DEFINITIONS[chordType];` and the existing `if (!def || rootIndex < 0 || tuning.length !== 6) return [];` guard, derive an effective member list and use it everywhere the function currently reads `def.members`:

```ts
  const omit = VOICING_OMISSIONS[chordType] ?? [];
  const members = def.members.filter((m) => !omit.includes(m.name));

  const voiceCount = members.length;
  if (voiceCount < 3 || voiceCount > 5) return [];

  const chordPCs = members.map((m) => (rootIndex + m.semitone) % 12);
```

Replace the two original lines (`const voiceCount = def.members.length;` and `const chordPCs = def.members.map(...)` at `voicings.ts:135` and `:138`) with the versions above. **Search the rest of `closeVoicings` for any other `def.members` reference and switch it to `members`** so the omitted tone never reappears downstream.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core vitest run src/shapes/voicings.test.ts`
Expected: PASS — `13`/`maj13`/`m13` now produce 5-note close voicings; the dropped tone is the perfect 5th.

- [ ] **Step 6: Confirm ≤5-note extensions still work (no omission needed)**

Add to the same test file:

```ts
it("5-note extensions (9, maj9, m9, 6/9, 9sus4) generate close voicings unchanged", () => {
  for (const q of ["9", "maj9", "m9", "6/9", "9sus4"]) {
    const voicings = generateVoicings({
      chordRoot: "C", chordType: q, tuning: STANDARD_TUNING, maxFret: 15, mode: "close",
    });
    expect(voicings.length).toBeGreaterThan(0);
  }
  // add9 is a 4-note chord
  const add9 = generateVoicings({
    chordRoot: "C", chordType: "add9", tuning: STANDARD_TUNING, maxFret: 15, mode: "close",
  });
  expect(add9.length).toBeGreaterThan(0);
});
```

Run: `pnpm --filter @fretflow/core vitest run src/shapes/voicings.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/voicings.test.ts
git commit -m "feat(core): omit the 5th from 13th-chord close voicings"
```

---

### Task 3: UI — labels and display order (shared source of truth)

**Files:**
- Modify: `src/components/ChordOverlayControls/chordTypeOptions.ts`
- Test: `src/components/ChordOverlayControls/chordTypeOptions.test.ts` (append; create if absent)

- [ ] **Step 1: Write the failing test**

Append to `src/components/ChordOverlayControls/chordTypeOptions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CHORD_TYPE_SHORT_LABELS, CHORD_TYPE_DISPLAY_ORDER } from "./chordTypeOptions";

describe("extended quality labels and order", () => {
  const expected: Array<[string, string]> = [
    ["add9", "add9"],
    ["9", "9"],
    ["maj9", "M9"],
    ["m9", "m9"],
    ["6/9", "6/9"],
    ["9sus4", "9sus4"],
    ["13", "13"],
    ["maj13", "M13"],
    ["m13", "m13"],
  ];

  it.each(expected)("%s has label %s", (key, label) => {
    expect(CHORD_TYPE_SHORT_LABELS[key]).toBe(label);
  });

  it("every new key is present in CHORD_TYPE_DISPLAY_ORDER", () => {
    for (const [key] of expected) {
      expect(CHORD_TYPE_DISPLAY_ORDER).toContain(key);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ChordOverlayControls/chordTypeOptions.test.ts`
Expected: FAIL — labels `undefined`, keys absent from order.

- [ ] **Step 3: Add labels**

In `src/components/ChordOverlayControls/chordTypeOptions.ts`, add to `CHORD_TYPE_SHORT_LABELS` (after `mMaj7`):

```ts
  add9: "add9",
  "9": "9",
  maj9: "M9",
  m9: "m9",
  "6/9": "6/9",
  "9sus4": "9sus4",
  "13": "13",
  maj13: "M13",
  m13: "m13",
```

- [ ] **Step 4: Add to display order**

Append the nine keys to `CHORD_TYPE_DISPLAY_ORDER` (after `mMaj7`):

```ts
  "sus2",
  "sus4",
  "5",
  "6",
  "m6",
  "maj7",
  "m7",
  "7",
  "dim7",
  "m7b5",
  "mMaj7",
  "add9",
  "9",
  "maj9",
  "m9",
  "6/9",
  "9sus4",
  "13",
  "maj13",
  "m13",
];
```

(Show the full tail so insertion point is unambiguous — only the nine new lines are additions.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/ChordOverlayControls/chordTypeOptions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/chordTypeOptions.ts src/components/ChordOverlayControls/chordTypeOptions.test.ts
git commit -m "feat(ui): add extended-quality labels and display order"
```

---

### Task 4: UI — add the "Extensions" group to the live picker

**Files:**
- Modify: `src/components/SongControls/qualityGroups.ts`
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/i18n/` (the strings module — find with `grep -rn "sixths\|Sixths" src/i18n`)
- Test: `src/components/SongControls/qualityGroups.test.ts` (append; create if absent)

- [ ] **Step 1: Write the failing test**

Append to `src/components/SongControls/qualityGroups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildQualitySelectGroups } from "./qualityGroups";

describe("extensions group", () => {
  const labels = {
    triads: "Triads",
    sus: "Suspended",
    sixths: "Sixths",
    sevenths: "Sevenths",
    extensions: "Extensions",
  };

  it("includes an Extensions group with the nine extended qualities", () => {
    const groups = buildQualitySelectGroups(labels);
    const ext = groups.find((g) => g.groupLabel === "Extensions");
    expect(ext).toBeDefined();
    const values = ext!.options.map((o) => o.value);
    expect(values).toEqual([
      "add9", "9", "maj9", "m9", "6/9", "9sus4", "13", "maj13", "m13",
    ]);
  });

  it("Extensions options carry display labels", () => {
    const groups = buildQualitySelectGroups(labels);
    const ext = groups.find((g) => g.groupLabel === "Extensions")!;
    expect(ext.options.find((o) => o.value === "maj9")?.label).toBe("M9");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/SongControls/qualityGroups.test.ts`
Expected: FAIL — `extensions` is not on the `QualityGroupLabels` type and no Extensions group exists.

- [ ] **Step 3: Add the key list and extend the interface**

In `src/components/SongControls/qualityGroups.ts`:

Add the key constant after `SEVENTH_KEYS` (line 41):

```ts
const EXTENSION_KEYS: readonly string[] = [
  "add9",
  "9",
  "maj9",
  "m9",
  "6/9",
  "9sus4",
  "13",
  "maj13",
  "m13",
];
```

Extend the `QualityGroupLabels` interface (line 9) to add `extensions`:

```ts
export interface QualityGroupLabels {
  triads: string;
  sus: string;
  sixths: string;
  sevenths: string;
  extensions: string;
}
```

- [ ] **Step 4: Emit the group**

In `buildQualitySelectGroups` (line 109), add the Extensions group after Sevenths:

```ts
export function buildQualitySelectGroups(
  labels: QualityGroupLabels,
): LabeledSelectGroup[] {
  return [
    { groupLabel: labels.triads, options: toOptions(TRIAD_KEYS) },
    { groupLabel: labels.sus, options: toOptions(SUS_KEYS) },
    { groupLabel: labels.sixths, options: toOptions(SIXTH_KEYS) },
    { groupLabel: labels.sevenths, options: toOptions(SEVENTH_KEYS) },
    { groupLabel: labels.extensions, options: toOptions(EXTENSION_KEYS) },
  ];
}
```

(`toOptions` already filters through `CHORD_TYPE_DISPLAY_ORDER`, so the new keys flow through because Task 3 added them there. The `buildQualityGroupsWithDiatonic` dedup logic at line 99 operates on the returned `base` groups generically, so it already handles the new group.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/SongControls/qualityGroups.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire the label through SongControls + i18n**

Find the existing group-label strings:

```bash
grep -rn "sixths\|sevenths" src/i18n src/components/SongControls/SongControls.tsx
```

Add an `extensions: "Extensions"` entry to the same i18n object/group where `sixths`/`sevenths` live (mirror their exact key path and any locale files), and pass it through wherever `SongControls.tsx` constructs the `QualityGroupLabels` object (it currently builds an object with `triads`/`sus`/`sixths`/`sevenths` from translation strings — add `extensions`). Because `QualityGroupLabels` now **requires** `extensions`, `tsc` will fail until every construction site is updated — let the build (Task 6) catch any missed site.

- [ ] **Step 7: Run the component test for SongControls**

Run: `pnpm vitest run src/components/SongControls`
Expected: PASS. If a SongControls test snapshots the dropdown groups, update it to include the Extensions group.

- [ ] **Step 8: Commit**

```bash
git add src/components/SongControls/ src/i18n/
git commit -m "feat(ui): add Extensions group to the quality picker"
```

---

### Task 5: Verification gate + visual regression refresh

**Files:** none beyond snapshot updates

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: clean.

- [ ] **Step 2: Full unit/component test suite**

Run: `pnpm run test`
Expected: green. This is where a wrong Tonal symbol (Task 1) or a missed `QualityGroupLabels` construction site surfaces.

- [ ] **Step 3: Build (type check)**

Run: `pnpm run build`
Expected: `tsc -b` passes — proves the `extensions` label is supplied everywhere and the union extension introduced no exhaustiveness errors.

- [ ] **Step 4: Refresh visual snapshots for the regrouped picker**

Run: `pnpm run test:visual:update`
Expected: the quality-picker snapshot(s) update to include the Extensions group. Eyeball the diff — only the new group/options should change.

- [ ] **Step 5: Manual check**

`pnpm run dev`, open the quality picker, confirm the Extensions group lists all nine, and that selecting e.g. `maj13` updates the fretboard overlay (correct chord-tone count highlighted) and that the close-voicing overlay renders (no full/CAGED shape is expected for the 6-note chords — that is the documented boundary).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(ui): refresh visual snapshots for extended qualities"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** union/category/definitions (Task 1), `VOICING_OMISSIONS` + close-voicing omission (Task 2), labels/order (Task 3), grouped picker with Extensions section (Task 4), tests + visual regression (Tasks 1–5). The spec's "section headers must be accessible" requirement is satisfied by the live picker's Radix `LabeledSelectGroup`, which renders accessible group labels natively — no new ARIA wiring needed (this is **why** targeting the live picker is correct, not the vestigial flat `ChordTypeGrid`).
- **Deviations from spec, flagged:** the spec targets `ChordTypeGrid.tsx` + `buildQualityToggleOptions` + a restructured flat `CHORD_TYPE_DISPLAY_ORDER` with custom section headers. Those components are **vestigial** in the current tree (test-only importers). This plan instead (a) keeps `CHORD_TYPE_DISPLAY_ORDER` as the flat source-of-truth that `qualityGroups.ts` filters against, and (b) adds the group to the **live** `qualityGroups.ts` picker. If the team intends to revive `ChordTypeGrid`, that is a separate UI task; flag it in the PR.
- **Type consistency:** `QualityGroupLabels` gains `extensions` in Task 4 and is used with that field in the test and SongControls. `EXTENSION_KEYS` values exactly match the `CHORD_DEFINITIONS` keys from Task 1 and the label keys from Task 3 (`add9`, `9`, `maj9`, `m9`, `6/9`, `9sus4`, `13`, `maj13`, `m13`).
- **Placeholder scan:** the only "find the exact shape" steps are the `voicings.ts` entry-point and the i18n key path — both are explicit "read X first, mirror it" instructions with a concrete grep, not open-ended TODOs, because those signatures must be read from the live code rather than guessed.
