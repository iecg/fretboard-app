# Extended Chord Qualities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nine extended chord qualities (`add9`, `9`, `maj9`, `m9`, `6/9`, `9sus4`, `13`, `maj13`, `m13`) to FretFlow — core definitions, close voicings, and the quality picker — without touching the CAGED full-chord system.

**Architecture:** Three layers. (1) Core data: extend the `ChordMemberName` union and `ChordQuality` category, add nine `CHORD_DEFINITIONS` entries via `buildChordDef`, and add a `VOICING_OMISSIONS` table. (2) Voicings: `closeVoicings` consults `VOICING_OMISSIONS` to drop the 5th from the three 6-note 13th chords before the 2–5-note range gate. (3) UI: add labels + display-order entries to the shared source of truth, then add an "Extensions" group to the **live** grouped quality picker, wired through i18n.

**Tech Stack:** TypeScript, Tonal.js (via `getChordSemitonesFromTonal`), Vitest, Testing Library, Playwright (visual regression).

**Source spec:** [`docs/superpowers/specs/2026-06-01-extended-chord-qualities-design.md`](../specs/2026-06-01-extended-chord-qualities-design.md)

> **Supersedes** `docs/superpowers/plans/2026-06-03-extended-chord-qualities.md`. That draft cited the close-voicing gate as `voiceCount < 3` (it is `< 2`), used a `mode:` param for `generateVoicings` (the real field is `voicingType:`), and referenced stale `voicings.ts` line numbers. All corrected below and verified against the current tree.

---

## Codebase grounding (verified against the current tree)

- **Core types & definitions** live in `packages/core/src/theory.ts`:
  - `ChordMemberName` union — `theory.ts:68`. Currently `"root" | "2" | "b3" | "3" | "4" | "b5" | "#5" | "5" | "6" | "b7" | "7" | "bb7"`. (`"6"` already present; `"9"`/`"11"`/`"13"` are new.)
  - `ChordQuality` category union — `theory.ts:69`. Currently `"triad" | "seventh" | "power" | "sixth" | "suspended"`.
  - `CHORD_DEFINITIONS` (`Record<string, ChordDefinition>`) — `theory.ts:203–219`, built by `buildChordDef(tonalSymbol, quality, memberNames)` (`theory.ts:186`). The last entry is `"5": buildChordDef("5", "power", ["root", "5"])` at `theory.ts:218`, closing `};` at `theory.ts:219`.
- **`buildChordDef` throws at module load** (`theory.ts:192–196`) if `memberNames.length !== getChordSemitonesFromTonal(tonalSymbol).length`. This is a free correctness check: a wrong Tonal alias or member count fails the very first `pnpm test`.
- **`getChordSemitonesFromTonal`** (`packages/core/src/lib/tonal.ts:87`) does `Chord.get("C"+symbol)`, maps intervals to semitones, and reduces them `((s % 12) + 12) % 12`. So a `"9"` member stores semitone `2`, a `"13"` stores `9`. Member **count** is what `buildChordDef` validates; the **names** are the chord-tone-overlay contract.
- **`getChordNotes(rootNote, chordName): string[]`** (`theory.ts:358`) returns notes in member order. Verified examples from `theory.test.ts`: `getChordNotes("C", "M") === ["C","E","G"]`; `getChordNotes("C", "6") === ["C","E","G","A"]`; unknown root/chord returns `[]`.
- **Close voicings** — `closeVoicings` is a module-private function in `packages/core/src/shapes/voicings.ts:234`, reached via the public `generateVoicings(params)` entry point (`voicings.ts:151`) when `params.voicingType === "close"`. `GenerateVoicingsParams` (`voicings.ts:140`) is `{ chordRoot: string; chordType: string; tuning: string[]; maxFret: number; voicingType: VoicingType }` where `VoicingType = "off" | "full" | "close"` (`voicings.ts:6`).
  - The range gate is **`if (voiceCount < 2 || voiceCount > 5) return [];`** at `voicings.ts:241` (power-chord dyads = 2 are allowed). `voiceCount = def.members.length` at `voicings.ts:240`.
  - `def.members` is read in exactly two places inside `closeVoicings`: the count at `voicings.ts:240` and the pitch-class map `const chordPCs = def.members.map((m) => (rootIndex + m.semitone) % 12);` at `voicings.ts:243`. No other `def.members` reference exists in the function.
  - Each returned `Voicing` (`voicings.ts:15`) has `notes: VoicingNote[]`; `notes.length === voiceCount`.
- **UI — live vs. vestigial.** The spec names `src/components/Inspector/ChordTypeGrid.tsx` + `buildQualityToggleOptions()`. **In the current tree those are vestigial** (each imported only by its own test). The **live, rendered** grouped picker is `src/components/SongControls/qualityGroups.ts` → `buildQualityGroupsWithDiatonic`, called once from `src/components/SongControls/SongControls.tsx:127` and rendered via Radix `LabeledSelectGroup`. This plan wires the new group into the **live** picker and updates the **shared source of truth** so any future consumer benefits. The vestigial files are left untouched (separate cleanup).
- **Shared label/order source of truth** — `src/components/ChordOverlayControls/chordTypeOptions.ts`:
  - `CHORD_TYPE_SHORT_LABELS` (`:1`) — note the live label style: `M:"Maj"`, `m:"min"`, `"6":"M6"`, `maj7:"M7"`, `m7b5:"m7♭5"`, `mMaj7:"mM7"`. New labels follow this style (`maj9:"M9"`, `maj13:"M13"`).
  - `CHORD_TYPE_DISPLAY_ORDER` (`:19`) — a flat `readonly string[]`, currently 15 keys ending at `"mMaj7"`.
- **`qualityGroups.ts` filters every group key through `CHORD_TYPE_DISPLAY_ORDER.includes(k)`** in `toOptions` (`qualityGroups.ts:43–50`). **A new key absent from `CHORD_TYPE_DISPLAY_ORDER` is silently dropped from the picker** — so Task 3 (display order) must land before Task 4's group renders anything.
- **Live group structure** (`qualityGroups.ts`): `QualityGroupLabels` (`:9`) has four fields — `triads`, `sus`, `sixths`, `sevenths`. There is **no separate "Power" group**: `"5"` lives in `SUS_KEYS` (`:23–27`) under the label "Suspended / Power". `buildQualitySelectGroups` (`:109`) emits the four groups; `buildQualityGroupsWithDiatonic` (`:67`) wraps it with a leading Diatonic group and dedups. `QualityGroupLabelsWithDiatonic extends QualityGroupLabels` (`:59`).
- **i18n** — group labels are keys on the `controls` namespace:
  - Type declarations: `src/i18n/types.ts:171–175` (`qualityGroupTriads`/`Sus`/`Sixths`/`Sevenths`/`Diatonic`).
  - English: `src/i18n/en.ts:174–178`.
  - Spanish: `src/i18n/es.ts:174–178`.
  - Consumed in `SongControls.tsx:131–137` via `t("controls.qualityGroup…")`.
- **Only one construction site** builds the labels object (`SongControls.tsx:127`), so the blast radius of adding a required `extensions` field is one component plus the `qualityGroups.test.ts`.
- **The worktree may have no `node_modules`.** Run `pnpm install` once before executing tasks (the Tonal diagnostic in Task 1 and every `pnpm` command below require it).

---

## File Structure

- **Modify** `packages/core/src/theory.ts` — `ChordMemberName` union (+`"9"`,`"11"`,`"13"`), `ChordQuality` category (+`"extended"`), nine `CHORD_DEFINITIONS` entries.
- **Modify** `packages/core/src/shapes/voicings.ts` — `VOICING_OMISSIONS` table + omission step in `closeVoicings`.
- **Modify** `src/components/ChordOverlayControls/chordTypeOptions.ts` — nine labels + nine display-order entries.
- **Modify** `src/components/SongControls/qualityGroups.ts` — `extensions` label field, `EXTENSION_KEYS`, new emitted group.
- **Modify** `src/components/SongControls/SongControls.tsx` — pass the `extensions` label.
- **Modify** `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — `qualityGroupExtensions` string.
- **Create** `src/components/ChordOverlayControls/chordTypeOptions.test.ts` (does not exist yet).
- **Modify (append)** `packages/core/src/theory.test.ts`, `packages/core/src/shapes/voicings.test.ts`, `src/components/SongControls/qualityGroups.test.ts`.

---

### Task 1: Core — extend union + category, add nine definitions

**Files:**
- Modify: `packages/core/src/theory.ts:68` (union), `:69` (category), `:218` (append definitions)
- Test: `packages/core/src/theory.test.ts` (append — file exists; imports `CHORD_DEFINITIONS`, `getChordNotes` already)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/theory.test.ts` (the file already imports `describe, it, expect` from `vitest` and `CHORD_DEFINITIONS`, `getChordNotes` from `./theory` — do **not** re-import; just add the block):

```ts
describe("extended chord qualities", () => {
  // [definition key, expected member NAMES in order]
  const cases: Array<[string, string[]]> = [
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

  it.each(cases)("%s is defined as an extended quality with the expected members", (key, names) => {
    const def = CHORD_DEFINITIONS[key];
    expect(def).toBeDefined();
    expect(def.quality).toBe("extended");
    expect(def.members.map((m) => m.name)).toEqual(names);
  });

  it("resolves Cmaj9 to C E G B D (member order)", () => {
    expect(getChordNotes("C", "maj9")).toEqual(["C", "E", "G", "B", "D"]);
  });

  it("resolves a flat-key root to sharps-form internal names with the right count", () => {
    // Fm9 = F Ab C Eb G — internal names are sharps-form, so 5 distinct notes.
    expect(getChordNotes("F", "m9")).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fretflow/core exec vitest run src/theory.test.ts`
Expected: FAIL — `CHORD_DEFINITIONS["add9"]` etc. are `undefined`.

- [ ] **Step 3: Extend the union and the category**

In `packages/core/src/theory.ts`, replace line 68:

```ts
export type ChordMemberName = "root" | "2" | "b3" | "3" | "4" | "b5" | "#5" | "5" | "6" | "b7" | "7" | "bb7";
```

with:

```ts
export type ChordMemberName = "root" | "2" | "b3" | "3" | "4" | "b5" | "#5" | "5" | "6" | "b7" | "7" | "bb7" | "9" | "11" | "13";
```

and replace line 69:

```ts
export type ChordQuality = "triad" | "seventh" | "power" | "sixth" | "suspended";
```

with:

```ts
export type ChordQuality = "triad" | "seventh" | "power" | "sixth" | "suspended" | "extended";
```

(`"11"` is added for forward-compat with deferred altered/extended chords; no in-scope quality uses it. It carries no runtime cost.)

- [ ] **Step 4: Add the nine definitions**

In `CHORD_DEFINITIONS`, insert the following immediately after the `"5"` power-chord line (`theory.ts:218`) and before the closing `};` (`theory.ts:219`):

```ts
  add9:    buildChordDef("add9",  "extended", ["root", "3", "5", "9"]),
  "9":     buildChordDef("9",     "extended", ["root", "3", "5", "b7", "9"]),
  maj9:    buildChordDef("maj9",  "extended", ["root", "3", "5", "7", "9"]),
  m9:      buildChordDef("m9",    "extended", ["root", "b3", "5", "b7", "9"]),
  "6/9":   buildChordDef("6/9",   "extended", ["root", "3", "5", "6", "9"]),
  "9sus4": buildChordDef("9sus4", "extended", ["root", "4", "5", "b7", "9"]),
  "13":    buildChordDef("13",    "extended", ["root", "3", "5", "b7", "9", "13"]),
  maj13:   buildChordDef("maj13", "extended", ["root", "3", "5", "7", "9", "13"]),
  m13:     buildChordDef("m13",   "extended", ["root", "b3", "5", "b7", "9", "13"]),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @fretflow/core exec vitest run src/theory.test.ts`
Expected: PASS.

**If a module-load error appears** (e.g. `buildChordDef: 6/9 expects 5 members, Tonal returned N`), the Tonal alias resolves to a different interval count. Diagnose the exact Tonal output:

```bash
pnpm --filter @fretflow/core exec node --input-type=module -e "import { Chord } from '@tonaljs/chord'; for (const s of ['add9','9','maj9','m9','6/9','9sus4','13','maj13','m13']) { const c = Chord.get('C'+s); console.log(s.padEnd(7), 'empty='+c.empty, 'n='+c.intervals.length, JSON.stringify(c.intervals)); }"
```

Expected reference output (Tonal omits the 11th on 13th chords → six notes): `add9`=4, `9`/`maj9`/`m9`/`6/9`/`9sus4`=5, `13`/`maj13`/`m13`=6. If a symbol shows `empty=true`, switch the `buildChordDef` **first argument** to the alias Tonal recognizes (e.g. `"69"` for six-nine) while keeping the `CHORD_DEFINITIONS` **key** as `"6/9"`. The member-name array stays as written above; only the Tonal symbol alias changes.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/theory.ts packages/core/src/theory.test.ts
git commit -m "feat(core): add nine extended chord quality definitions"
```

---

### Task 2: Core — `VOICING_OMISSIONS` table + close-voicing omission step

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts` (add table near `CLOSE_VOICING_SPAN_LIMIT`; edit `closeVoicings` at `:240` and `:243`)
- Test: `packages/core/src/shapes/voicings.test.ts` (append — file exists; imports `generateVoicings` from `./voicings` and defines `const STD_TUNING = ["E4", "B3", "G3", "D3", "A2", "E2"];` already)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/shapes/voicings.test.ts` (reuse the existing top-level `STD_TUNING` constant and the existing `generateVoicings` import — do not redeclare them):

```ts
describe("extended-chord close voicings", () => {
  it("13th chords drop the 5th and generate 5-note close voicings", () => {
    for (const chordType of ["13", "maj13", "m13"]) {
      const voicings = generateVoicings({
        chordRoot: "C",
        chordType,
        tuning: STD_TUNING,
        maxFret: 15,
        voicingType: "close",
      });
      expect(voicings.length).toBeGreaterThan(0);
      for (const v of voicings) {
        // root, 3/b3, b7/7, 9, 13 — the perfect 5th is omitted
        expect(v.notes).toHaveLength(5);
      }
    }
  });

  it("<=5-note extensions generate close voicings with no omission", () => {
    for (const chordType of ["9", "maj9", "m9", "6/9", "9sus4"]) {
      const voicings = generateVoicings({
        chordRoot: "C",
        chordType,
        tuning: STD_TUNING,
        maxFret: 15,
        voicingType: "close",
      });
      expect(voicings.length).toBeGreaterThan(0);
      for (const v of voicings) expect(v.notes).toHaveLength(5);
    }
    const add9 = generateVoicings({
      chordRoot: "C",
      chordType: "add9",
      tuning: STD_TUNING,
      maxFret: 15,
      voicingType: "close",
    });
    expect(add9.length).toBeGreaterThan(0);
    for (const v of add9) expect(v.notes).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fretflow/core exec vitest run src/shapes/voicings.test.ts`
Expected: FAIL — `13`/`maj13`/`m13` have 6 members, so `voiceCount > 5` returns `[]` (length 0), failing `expect(voicings.length).toBeGreaterThan(0)`. (The `<=5-note` block should already pass once Task 1 is merged, since those qualities are 4–5 notes; it is added here to lock in that omission does not affect them.)

- [ ] **Step 3: Add the omission table**

In `packages/core/src/shapes/voicings.ts`, first extend the existing theory import at the top of the file. Line 1 is currently:

```ts
import { NOTES, CHORD_DEFINITIONS } from "../theory";
```

Replace it with:

```ts
import { NOTES, CHORD_DEFINITIONS, type ChordMemberName } from "../theory";
```

Then add the table immediately after the `CLOSE_VOICING_SPAN_LIMIT` declaration (`voicings.ts:211`):

```ts
/**
 * Member tones dropped before close-voicing generation, to reduce 6-note
 * extended chords to a playable grip. Tonal already omits the 11th on 13th
 * chords; dropping the 5th brings them to the standard 5-note jazz voicing
 * (root, 3/b3, b7/7, 9, 13). This is the extension hook that deferred
 * altered-dominant voicings will reuse — keyed by CHORD_DEFINITIONS key.
 */
export const VOICING_OMISSIONS: Record<string, ChordMemberName[]> = {
  "13": ["5"],
  maj13: ["5"],
  m13: ["5"],
};
```

- [ ] **Step 4: Apply the omission inside `closeVoicings`**

In `closeVoicings`, the current lines are:

```ts
  const voiceCount = def.members.length;
  if (voiceCount < 2 || voiceCount > 5) return [];

  const chordPCs = def.members.map((m) => (rootIndex + m.semitone) % 12);
```

(`voicings.ts:240–243`). Replace those four lines with:

```ts
  const omit = VOICING_OMISSIONS[chordType] ?? [];
  const members = def.members.filter((m) => !omit.includes(m.name));

  const voiceCount = members.length;
  if (voiceCount < 2 || voiceCount > 5) return [];

  const chordPCs = members.map((m) => (rootIndex + m.semitone) % 12);
```

These are the only two `def.members` reads inside the function — both now use the omission-filtered `members`, so the dropped 5th never reappears in `voiceCount`, `chordPCs`, or any downstream grip. (Guard `if (!def || rootIndex < 0 || tuning.length !== 6) return [];` at `voicings.ts:238` stays unchanged, immediately above this block.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @fretflow/core exec vitest run src/shapes/voicings.test.ts`
Expected: PASS — `13`/`maj13`/`m13` now yield 5-note close voicings; the 4–5-note extensions are unaffected.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/voicings.test.ts
git commit -m "feat(core): omit the 5th from 13th-chord close voicings"
```

---

### Task 3: UI — labels + display order (shared source of truth)

**Files:**
- Modify: `src/components/ChordOverlayControls/chordTypeOptions.ts`
- Create: `src/components/ChordOverlayControls/chordTypeOptions.test.ts` (does not exist yet)

- [ ] **Step 1: Write the failing test**

Create `src/components/ChordOverlayControls/chordTypeOptions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CHORD_TYPE_SHORT_LABELS, CHORD_TYPE_DISPLAY_ORDER } from "./chordTypeOptions";

describe("extended quality labels and display order", () => {
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

  it.each(expected)("%s has short label %s", (key, label) => {
    expect(CHORD_TYPE_SHORT_LABELS[key]).toBe(label);
  });

  it("every new key is present in CHORD_TYPE_DISPLAY_ORDER", () => {
    for (const [key] of expected) {
      expect(CHORD_TYPE_DISPLAY_ORDER).toContain(key);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/ChordOverlayControls/chordTypeOptions.test.ts`
Expected: FAIL — labels are `undefined` and the keys are absent from the order array.

- [ ] **Step 3: Add the labels**

In `src/components/ChordOverlayControls/chordTypeOptions.ts`, add the nine entries inside `CHORD_TYPE_SHORT_LABELS` immediately after the `mMaj7: "mM7",` line (`chordTypeOptions.ts:16`):

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

- [ ] **Step 4: Add the display-order entries**

In the same file, append the nine keys to `CHORD_TYPE_DISPLAY_ORDER` immediately after the `"mMaj7",` line (`chordTypeOptions.ts:34`), before the closing `];`:

```ts
  "add9",
  "9",
  "maj9",
  "m9",
  "6/9",
  "9sus4",
  "13",
  "maj13",
  "m13",
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/ChordOverlayControls/chordTypeOptions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/chordTypeOptions.ts src/components/ChordOverlayControls/chordTypeOptions.test.ts
git commit -m "feat(ui): add extended-quality labels and display order"
```

---

### Task 4: UI — "Extensions" group in the live picker + i18n

**Files:**
- Modify: `src/components/SongControls/qualityGroups.ts`
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`
- Test: `src/components/SongControls/qualityGroups.test.ts` (append — file exists)

- [ ] **Step 1: Write the failing test**

Append to `src/components/SongControls/qualityGroups.test.ts`. The file already imports `describe, it, expect` and `buildQualityGroupsWithDiatonic`, and defines a top-level `labels` object — that object will need the new field, so add a local labels object inside this block to keep the new test self-contained:

```ts
describe("Extensions group", () => {
  const labelsWithExt = {
    diatonic: "Diatonic",
    triads: "Triads",
    sus: "Sus",
    sixths: "Sixths",
    sevenths: "Sevenths",
    extensions: "Extensions",
  };

  // Use a root with no diatonic match so the base groups render in full.
  const groups = buildQualityGroupsWithDiatonic("major", "C", "C#", labelsWithExt);

  it("emits an Extensions group with the nine extended qualities in order", () => {
    const ext = groups.find((g) => g.groupLabel === "Extensions");
    expect(ext).toBeDefined();
    expect(ext!.options.map((o) => o.value)).toEqual([
      "add9", "9", "maj9", "m9", "6/9", "9sus4", "13", "maj13", "m13",
    ]);
  });

  it("Extensions options carry their short display labels", () => {
    const ext = groups.find((g) => g.groupLabel === "Extensions")!;
    expect(ext.options.find((o) => o.value === "maj9")?.label).toBe("M9");
    expect(ext.options.find((o) => o.value === "13")?.label).toBe("13");
  });
});
```

> The existing top-level `labels` object in this file (`{ diatonic, triads, sus, sixths, sevenths }`) does **not** yet include `extensions`. After Step 3 makes `extensions` required on `QualityGroupLabels`, TypeScript will error on every call that passes the old `labels`. Add `extensions: "Extensions"` to that existing top-level `labels` object too, so the pre-existing tests keep type-checking.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/SongControls/qualityGroups.test.ts`
Expected: FAIL — no Extensions group is emitted (and TypeScript flags `extensions` as an unknown property until Step 3).

- [ ] **Step 3: Extend the interface and add the key list**

In `src/components/SongControls/qualityGroups.ts`, add `extensions` to `QualityGroupLabels` (`:9`):

```ts
export interface QualityGroupLabels {
  triads: string;
  sus: string;
  sixths: string;
  sevenths: string;
  extensions: string;
}
```

Add the key constant immediately after `SEVENTH_KEYS` (`:41`):

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

- [ ] **Step 4: Emit the group**

In `buildQualitySelectGroups` (`:109`), add the Extensions group after the Sevenths group:

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

`toOptions` filters through `CHORD_TYPE_DISPLAY_ORDER` (Task 3 added the nine keys there) and maps via `CHORD_TYPE_SHORT_LABELS`, so the options flow through with correct labels. `buildQualityGroupsWithDiatonic` calls `buildQualitySelectGroups(labels)` and its dedup logic operates generically on the returned groups, so the new group is handled with no further change there.

- [ ] **Step 5: Run the qualityGroups test to verify it passes**

Run: `pnpm exec vitest run src/components/SongControls/qualityGroups.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the i18n string (type + both locales)**

In `src/i18n/types.ts`, add the key after `qualityGroupSevenths: string;` (`:174`):

```ts
    qualityGroupExtensions: string;
```

In `src/i18n/en.ts`, add after `qualityGroupSevenths: "7th Chords",` (`:177`):

```ts
    qualityGroupExtensions: "Extended Chords",
```

In `src/i18n/es.ts`, add after `qualityGroupSevenths: "Acordes de 7ª",` (`:177`):

```ts
    qualityGroupExtensions: "Acordes Extendidos",
```

- [ ] **Step 7: Wire the label through SongControls**

In `src/components/SongControls/SongControls.tsx`, add the `extensions` field to the labels object passed to `buildQualityGroupsWithDiatonic` (`:131–137`), after the `sevenths` line:

```ts
      sevenths: t("controls.qualityGroupSevenths"),
      extensions: t("controls.qualityGroupExtensions"),
```

Because `QualityGroupLabels` now requires `extensions`, `tsc` will error here until this is added — that is the type system confirming the single construction site is covered.

- [ ] **Step 8: Run the SongControls test suite**

Run: `pnpm exec vitest run src/components/SongControls`
Expected: PASS. If a SongControls test snapshots the dropdown group list, update the snapshot to include the Extensions group (only that group should be added to the diff).

- [ ] **Step 9: Commit**

```bash
git add src/components/SongControls/ src/i18n/
git commit -m "feat(ui): add Extensions group to the quality picker"
```

---

### Task 5: Verification gate + visual regression refresh

**Files:** none beyond snapshot updates.

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: clean (eslint + stylelint).

- [ ] **Step 2: Full unit/component suite**

Run: `pnpm run test`
Expected: green. A wrong Tonal alias (Task 1) surfaces here as a `buildChordDef` module-load throw; a missed label construction site surfaces as a type error in Step 3 below.

- [ ] **Step 3: Build (type check)**

Run: `pnpm run build`
Expected: `tsc -b` passes, then `vite build` succeeds. This proves the `extensions` label is supplied at every construction site and that the union/category extensions introduced no exhaustiveness errors.

- [ ] **Step 4: Refresh visual snapshots for the regrouped picker**

Run: `pnpm run test:visual:update`
Expected: the quality-picker snapshot(s) update to include the new Extensions group. Eyeball the diff — only the new group and its nine options should change; no unrelated layout shifts.

- [ ] **Step 5: Manual smoke check**

Run `pnpm run dev`, open the quality picker, and confirm:
- The Extensions group lists all nine qualities with labels `add9, 9, M9, m9, 6/9, 9sus4, 13, M13, m13`.
- Selecting `maj13` updates the fretboard overlay with the correct chord-tone count highlighted.
- The close-voicing overlay renders for `13`/`maj13`/`m13` (5-note grips). No full/CAGED shape is expected for these 6-note chords — that is the documented boundary from the spec, not a bug.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(ui): refresh visual snapshots for extended qualities"
```

---

## Self-Review (completed during planning)

- **Spec coverage:**
  - "Nine new qualities" + `"extended"` category + `ChordMemberName` union (incl. unused `"11"` for forward-compat) → Task 1.
  - `VOICING_OMISSIONS` table + close-voicing omission dropping the 5th from 13th chords; no change to the range cap; ≤5-note extensions unchanged → Task 2.
  - Labels + display order → Task 3.
  - Grouped picker with an Extensions section → Task 4. **Accessibility requirement** ("section headers must be accessible") is satisfied natively: the live picker renders via Radix `LabeledSelectGroup`, which emits accessible group labels — this is precisely why targeting the live picker (not the vestigial flat `ChordTypeGrid`) is correct.
  - Unit tests (member sets, flat-key resolution, omission yields 5-note voicing), component test (picker renders the new group with correct labels), visual regression refresh → Tasks 1–5.
  - CAGED `FULL_CHORD_TEMPLATES` deliberately untouched (out of scope) — no task modifies it.
- **Deviation from spec, flagged:** the spec targets `ChordTypeGrid.tsx` + `buildQualityToggleOptions` + a restructured flat `CHORD_TYPE_DISPLAY_ORDER` with custom section headers and a separate "Power" group. In the current tree those components are vestigial (test-only importers), and the live picker has no separate Power group (`"5"` lives under "Suspended / Power"). This plan wires the group into the **live** `qualityGroups.ts` picker and keeps `CHORD_TYPE_DISPLAY_ORDER` as the flat source of truth that `toOptions` filters against. Reviving `ChordTypeGrid` is a separate UI task — call it out in the PR description.
- **Type consistency:** `QualityGroupLabels` gains `extensions` (Task 4 Step 3) and is consumed with that field in the test, in `buildQualitySelectGroups`, and in `SongControls.tsx`. `EXTENSION_KEYS` values match the `CHORD_DEFINITIONS` keys (Task 1), the `CHORD_TYPE_SHORT_LABELS`/`CHORD_TYPE_DISPLAY_ORDER` keys (Task 3), and the test expectations exactly: `add9, 9, maj9, m9, 6/9, 9sus4, 13, maj13, m13`. `VOICING_OMISSIONS` keys (`13`, `maj13`, `m13`) are a subset of the definition keys; its values (`["5"]`) are valid `ChordMemberName`s.
- **Placeholder scan:** every code step shows the exact code and exact insertion point with verified line numbers. The one runtime-dependent unknown — Tonal's exact alias resolution for `6/9`/`9sus4` — is handled by the `buildChordDef` load-time assertion plus an explicit diagnostic command and remediation in Task 1 Step 5, not an open TODO. (`node_modules` must be installed first; noted in grounding.)
