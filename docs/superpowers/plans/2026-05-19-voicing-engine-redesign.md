# Voicing Engine Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Chord-tab Type / Inversion / String Set combination produce a coherent, visible fretboard result (or visibly nothing) — never a misleading connector scatter.

**Architecture:** The core voicing engine stops carrying a fixed `VoicingStringSet` union; it takes a plain `readonly number[]` of allowed string indices. A new app-layer helper, `buildStringSetOptions(toneCount)`, generates the picker's options dynamically from the active chord's tone count. `voicingStringSetAtom` stores a stable id string that self-heals when the chord changes. The `caged` voicing type becomes a self-contained mode whose String Set / Inversion controls are hidden. The connector layer never falls back to the "generated scatter" while a voicing source is active.

**Tech Stack:** TypeScript, React 19, Jotai atoms, Vitest + Testing Library, the `@fretflow/core` workspace package.

---

## Background — the four faults this plan fixes

(From `docs/superpowers/specs/2026-05-18-voicing-engine-redesign-design.md`.)

1. `caged` is incompatible with String Set / Inversion — those controls produce 0 voicings while `caged` is selected.
2. Each voicing type renders a different *kind* of thing.
3. Empty engine output silently degrades to connectors over every loose chord tone.
4. The String Set control is a fixed five-option list that ignores the chord's tone count.

## Key files (read before starting)

- `packages/core/src/shapes/voicings.ts` — the engine. `generateVoicings`, `searchVoicings`, `cagedVoicings`, the `VoicingStringSet` union, `STRING_SET_MASKS`, `stringSetMask`.
- `packages/core/src/shapes/index.ts` — the core package's public barrel.
- `src/store/chordOverlayAtoms.ts` — `voicingTypeAtom`, `voicingInversionAtom`, `voicingStringSetAtom`, `availableInversionsAtom`, `voicingMatchesAtom`, `fullChordMatchesAtom`.
- `src/components/Inspector/StringSetPicker.tsx` — the radio-card picker, currently a hardcoded `CARDS` list.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — the Chord-tab control panel.
- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` — the connector hook; `buildChordConnectorPolylines` is the "generated scatter" path, `buildExplicitChordConnectorPolylines` is the voicing path.
- `src/components/FretboardSVG/FretboardSVG.tsx` — wires `useChordConnectorPolylines` (around line 426) and computes `connectorSource` (line 439).
- `src/i18n/en.ts` / `src/i18n/es.ts` — `inspector.*` string-set keys.

## File structure after this plan

- `packages/core/src/shapes/voicings.ts` — **modified**: `stringSet` is `readonly number[]`; `VoicingStringSet` / `STRING_SET_MASKS` / `stringSetMask` removed.
- `packages/core/src/shapes/index.ts` — **modified**: drops the removed exports.
- `src/store/voicingStringSets.ts` — **new**: `StringSetOption` type + `buildStringSetOptions(toneCount)` pure helper.
- `src/store/voicingStringSets.test.ts` — **new**: helper tests.
- `src/store/chordOverlayAtoms.ts` — **modified**: `voicingStringSetAtom` stores an id string; new `stringSetOptionsAtom` + `effectiveStringSetAtom`; `voicingMatchesAtom` rewritten.
- `src/store/atoms.ts` — **modified**: re-export the two new atoms + the helper.
- `src/components/Inspector/StringSetPicker.tsx` — **modified**: renders an `options` prop.
- `src/components/Inspector/StringSetPicker.test.tsx` — **modified**: new option-driven tests.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — **modified**: hides String Set / Inversion for `caged`; adds the string-set normalizer.
- `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` — **modified**: visibility + dynamic-option tests.
- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` — **modified**: new `voicingSourceActive` param.
- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts` — **modified**: no-scatter test.
- `src/components/FretboardSVG/FretboardSVG.tsx` — **modified**: passes `voicingSourceActive`; `connectorSource` keyed off chord-overlay activity.
- `src/i18n/en.ts` / `src/i18n/es.ts` — **modified**: add `stringSetMiddle`; drop the now-unused per-window `*Sub` keys.

---

## Task 1: Core engine — `stringSet` becomes `readonly number[]`

The engine should not know about a fixed string-set vocabulary. It takes a list of allowed string indices (`0` = high E … `5` = low E) and filters candidate strings by membership.

**Files:**
- Modify: `packages/core/src/shapes/voicings.ts`
- Modify: `packages/core/src/shapes/index.ts:14-18`
- Test: `packages/core/src/shapes/voicings.test.ts`

- [ ] **Step 1: Rewrite the failing tests in `voicings.test.ts`**

The current file imports and tests `stringSetMask`, which this task removes. Replace the top `import` block and the first `describe` block. Open `packages/core/src/shapes/voicings.test.ts` and replace lines 1-33 (the import block and the `describe("voicing helpers", …)` block) with:

```typescript
import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "../guitar";
import {
  inversionBassPitchClass,
  openStringMidi,
  generateVoicings,
} from "./voicings";
import { getFullChordShapeMatches } from "./fullChordShapes";

describe("voicing helpers", () => {
  it("computes the inversion bass pitch class", () => {
    expect(inversionBassPitchClass("C", "Major Triad", "root")).toBe(0);
    expect(inversionBassPitchClass("C", "Major Triad", "1st")).toBe(4);
    expect(inversionBassPitchClass("C", "Major Triad", "2nd")).toBe(7);
    expect(inversionBassPitchClass("C", "Major Triad", "3rd")).toBeNull();
  });

  it("computes open-string MIDI from a tuning entry", () => {
    expect(openStringMidi("E2")).toBe(28);
    expect(openStringMidi(STANDARD_TUNING[5])).toBe(28);
    expect(openStringMidi("not-a-note")).toBeNull();
  });
});

describe("generateVoicings — explicit string set", () => {
  const base = { tuning: STANDARD_TUNING, maxFret: 12 } as const;

  it("confines a triad search to the requested string indices", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      for (const n of v.notes) {
        expect([3, 4, 5]).toContain(n.stringIndex);
      }
    }
  });

  it("returns no voicings for an impossible request", () => {
    // A 4-note chord cannot be voiced inside a 3-string window.
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "root", stringSet: [3, 4, 5],
    });
    expect(voicings).toEqual([]);
  });

  it("searches drop2 voicings on a 4-note chord across a 4-string window", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "root", stringSet: [2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      for (const n of v.notes) {
        expect([2, 3, 4, 5]).toContain(n.stringIndex);
      }
    }
  });
});
```

Note: keep every other `describe` block in the file. Inside those blocks, any object literal that sets `stringSet: "all"` must become `stringSet: [0, 1, 2, 3, 4, 5]`, `stringSet: "low"` → `stringSet: [3, 4, 5]`, `stringSet: "mid"` → `stringSet: [2, 3, 4]`, `stringSet: "mid-hi"` → `stringSet: [1, 2, 3]`, `stringSet: "top"` → `stringSet: [0, 1, 2]`. Run `grep -n 'stringSet:' packages/core/src/shapes/voicings.test.ts` and fix every line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts`
Expected: FAIL — TypeScript / type errors because `GenerateVoicingsParams.stringSet` is still the `VoicingStringSet` union, so `stringSet: [3, 4, 5]` does not type-check; also `stringSetMask` is still exported but no longer imported.

- [ ] **Step 3: Change the engine to accept `readonly number[]`**

In `packages/core/src/shapes/voicings.ts`:

Delete line 8 (`export type VoicingStringSet = …`).

Delete lines 25-32 (the `STRING_SET_MASKS` constant and its doc comment).

Delete lines 41-43 (the `stringSetMask` function).

Change the `GenerateVoicingsParams` interface field (line 79) from:

```typescript
  stringSet: VoicingStringSet;
```

to:

```typescript
  /** Allowed string indices (0 = high E … 5 = low E). */
  stringSet: readonly number[];
```

In `searchVoicings`, replace line 117:

```typescript
  const allowed = stringSetMask(stringSet);
```

with:

```typescript
  const allowed = [...stringSet].sort((a, b) => a - b);
```

In `cagedVoicings`, replace line 194:

```typescript
  const allowed = new Set(stringSetMask(stringSet));
```

with:

```typescript
  const allowed = new Set(stringSet);
```

- [ ] **Step 4: Drop the removed core exports**

In `packages/core/src/shapes/index.ts`, change the voicings export block (lines 14-21) from:

```typescript
export type {
  Voicing, VoicingNote, VoicingType, VoicingInversion, VoicingStringSet,
  GenerateVoicingsParams,
} from "./voicings";
export {
  generateVoicings, stringSetMask, inversionBassPitchClass, openStringMidi,
} from "./voicings";
```

to:

```typescript
export type {
  Voicing, VoicingNote, VoicingType, VoicingInversion,
  GenerateVoicingsParams,
} from "./voicings";
export {
  generateVoicings, inversionBassPitchClass, openStringMidi,
} from "./voicings";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run packages/core/src/shapes/voicings.test.ts`
Expected: PASS — the engine now filters by the explicit index array.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/shapes/voicings.ts packages/core/src/shapes/index.ts packages/core/src/shapes/voicings.test.ts
git commit -m "refactor(core): voicing engine takes explicit string-index set"
```

---

## Task 2: `buildStringSetOptions` helper + i18n keys

A pure helper generates the picker's option list from the active chord's tone count. It lives in the app layer — the core engine knows nothing about labels or ids.

**Files:**
- Create: `src/store/voicingStringSets.ts`
- Create: `src/store/voicingStringSets.test.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/voicingStringSets.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildStringSetOptions } from "./voicingStringSets";

describe("buildStringSetOptions", () => {
  it("offers All plus four windows for a triad (toneCount 3)", () => {
    const options = buildStringSetOptions(3);
    expect(options.map((o) => o.id)).toEqual([
      "all", "4·5·6", "3·4·5", "2·3·4", "1·2·3",
    ]);
    expect(options.map((o) => o.labelKey)).toEqual([
      "inspector.stringSetAll",
      "inspector.stringSetBass",
      "inspector.stringSetLowerMid",
      "inspector.stringSetUpperMid",
      "inspector.stringSetTreble",
    ]);
  });

  it("offers All plus three windows for a seventh chord (toneCount 4)", () => {
    const options = buildStringSetOptions(4);
    expect(options.map((o) => o.id)).toEqual([
      "all", "3·4·5·6", "2·3·4·5", "1·2·3·4",
    ]);
    expect(options.map((o) => o.labelKey)).toEqual([
      "inspector.stringSetAll",
      "inspector.stringSetBass",
      "inspector.stringSetMiddle",
      "inspector.stringSetTreble",
    ]);
  });

  it("maps each window id to the correct string-index array (0=high E … 5=low E)", () => {
    const triad = buildStringSetOptions(3);
    // Bass window "4·5·6" → guitar strings 4,5,6 → indices 3,4,5.
    expect(triad[1].strings).toEqual([3, 4, 5]);
    // Treble window "1·2·3" → guitar strings 1,2,3 → indices 0,1,2.
    expect(triad[4].strings).toEqual([0, 1, 2]);
    expect(triad[0].strings).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("offers only All for a chord with six or more tones", () => {
    expect(buildStringSetOptions(6).map((o) => o.id)).toEqual(["all"]);
    expect(buildStringSetOptions(7).map((o) => o.id)).toEqual(["all"]);
  });

  it("offers only All when the tone count is unknown (0)", () => {
    expect(buildStringSetOptions(0).map((o) => o.id)).toEqual(["all"]);
  });

  it("offers five windows for a dyad (toneCount 2)", () => {
    const options = buildStringSetOptions(2);
    expect(options.map((o) => o.labelKey)).toEqual([
      "inspector.stringSetAll",
      "inspector.stringSetBass",
      "inspector.stringSetLowerMid",
      "inspector.stringSetMiddle",
      "inspector.stringSetUpperMid",
      "inspector.stringSetTreble",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/store/voicingStringSets.test.ts`
Expected: FAIL — "Failed to resolve import ./voicingStringSets" (file does not exist).

- [ ] **Step 3: Write the helper**

Create `src/store/voicingStringSets.ts`:

```typescript
/**
 * Dynamic String Set options for the Chord-tab voicing controls.
 *
 * A string set is either `all` (all six strings) or a contiguous window of
 * `N` strings, where `N` is the active chord's tone count. With six strings
 * there are `W = 6 - N + 1` windows, numbered bass → treble.
 *
 * String indices run 0 = high E … 5 = low E (matching `VoicingNote.stringIndex`).
 * Guitar string numbers are `index + 1`; the bass window includes string 6.
 */

export interface StringSetOption {
  /** Stable id: "all", or the guitar string numbers joined low→high, e.g. "4·5·6". */
  id: string;
  /** i18n key for the human label. */
  labelKey: string;
  /** Allowed string indices, ascending (0 = high E … 5 = low E). */
  strings: readonly number[];
}

const ALL_STRINGS: readonly number[] = [0, 1, 2, 3, 4, 5];

const ALL_OPTION: StringSetOption = {
  id: "all",
  labelKey: "inspector.stringSetAll",
  strings: ALL_STRINGS,
};

/**
 * Labels for the middle windows (all windows except Bass / Treble), keyed by
 * how many middle windows exist. Assigned symmetrically per the design spec.
 */
const MIDDLE_LABEL_KEYS: Record<number, readonly string[]> = {
  0: [],
  1: ["inspector.stringSetMiddle"],
  2: ["inspector.stringSetLowerMid", "inspector.stringSetUpperMid"],
  3: [
    "inspector.stringSetLowerMid",
    "inspector.stringSetMiddle",
    "inspector.stringSetUpperMid",
  ],
};

/**
 * Build the ordered String Set option list for a chord with `toneCount` tones.
 * Always starts with `All`, then the windows bass → treble. A chord with six
 * or more tones (or an unknown tone count) gets only `All`.
 */
export function buildStringSetOptions(toneCount: number): StringSetOption[] {
  const n = Math.floor(toneCount);
  if (n < 2 || n > 5) return [ALL_OPTION];

  const windowCount = 6 - n + 1;
  const middleKeys = MIDDLE_LABEL_KEYS[windowCount - 2] ?? [];

  const windows: StringSetOption[] = [];
  for (let w = 0; w < windowCount; w += 1) {
    // Window 0 (Bass) sits on the lowest-pitch strings (highest indices).
    const start = 6 - n - w;
    const strings: number[] = [];
    for (let s = start; s < start + n; s += 1) strings.push(s);

    const labelKey =
      w === 0
        ? "inspector.stringSetBass"
        : w === windowCount - 1
          ? "inspector.stringSetTreble"
          : middleKeys[w - 1] ?? "inspector.stringSetMiddle";

    // Id: guitar string numbers (index + 1), ascending, joined with "·".
    const id = strings.map((s) => s + 1).join("·");
    windows.push({ id, labelKey, strings });
  }

  return [ALL_OPTION, ...windows];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/store/voicingStringSets.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the `stringSetMiddle` i18n key and drop unused window-sub keys**

In `src/i18n/en.ts`, the `inspector` block currently has (lines 98-107):

```typescript
    stringSetAll: "All",
    stringSetAllSub: "6 strings",
    stringSetBass: "Bass",
    stringSetBassSub: "4·5·6",
    stringSetLowerMid: "Lower mid",
    stringSetLowerMidSub: "3·4·5",
    stringSetUpperMid: "Upper mid",
    stringSetUpperMidSub: "2·3·4",
    stringSetTreble: "Treble",
    stringSetTrebleSub: "1·2·3",
```

Replace that block with:

```typescript
    stringSetAll: "All",
    stringSetAllSub: "6 strings",
    stringSetBass: "Bass",
    stringSetLowerMid: "Lower mid",
    stringSetMiddle: "Middle",
    stringSetUpperMid: "Upper mid",
    stringSetTreble: "Treble",
```

In `src/i18n/es.ts`, the matching block (lines 98-107):

```typescript
    stringSetAll: "Todas",
    stringSetAllSub: "6 cuerdas",
    stringSetBass: "Graves",
    stringSetBassSub: "4·5·6",
    stringSetLowerMid: "Medios graves",
    stringSetLowerMidSub: "3·4·5",
    stringSetUpperMid: "Medios agudos",
    stringSetUpperMidSub: "2·3·4",
    stringSetTreble: "Agudos",
    stringSetTrebleSub: "1·2·3",
```

Replace with:

```typescript
    stringSetAll: "Todas",
    stringSetAllSub: "6 cuerdas",
    stringSetBass: "Graves",
    stringSetLowerMid: "Medios graves",
    stringSetMiddle: "Medios",
    stringSetUpperMid: "Medios agudos",
    stringSetTreble: "Agudos",
```

- [ ] **Step 6: Verify the i18n files still type-check**

Run: `npx tsc -b`
Expected: PASS — no errors. (If `tsc` reports a missing `stringSetMiddle` in one locale, the two `inspector` blocks have drifted; the en and es key sets must match exactly.)

- [ ] **Step 7: Commit**

```bash
git add src/store/voicingStringSets.ts src/store/voicingStringSets.test.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(voicing): dynamic string-set option builder"
```

---

## Task 3: Voicing string-set atoms — id storage, effective resolver, engine wiring

`voicingStringSetAtom` now stores a stable id string. Two new derived atoms expose the chord-appropriate option list and the resolved string-index array. `voicingMatchesAtom` is rewritten so `caged` ignores String Set / Inversion entirely.

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Modify: `src/store/atoms.ts`
- Test: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Append this `describe` block to the end of `src/store/chordOverlayAtoms.test.ts` (before the file's final closing — it is a flat list of `describe` blocks, so add it as a new top-level block):

```typescript
describe("voicing string set", () => {
  it("exposes tone-count-appropriate string-set options", () => {
    const store = makeAtomStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    const optionsTriad = store.get(stringSetOptionsAtom);
    expect(optionsTriad.map((o) => o.id)).toEqual([
      "all", "4·5·6", "3·4·5", "2·3·4", "1·2·3",
    ]);

    store.set(chordQualityOverrideAtom, "Major 7th");
    const optionsSeventh = store.get(stringSetOptionsAtom);
    expect(optionsSeventh.map((o) => o.id)).toEqual([
      "all", "3·4·5·6", "2·3·4·5", "1·2·3·4",
    ]);
  });

  it("resolves a valid stored id to its string-index array", () => {
    const store = makeAtomStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    store.set(voicingStringSetAtom, "4·5·6");
    expect(store.get(effectiveStringSetAtom)).toEqual([3, 4, 5]);
  });

  it("falls back to all six strings when the stored id is invalid for the chord", () => {
    const store = makeAtomStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    // A 3-string window valid for a triad …
    store.set(voicingStringSetAtom, "4·5·6");
    // … then switch to a seventh chord, where "4·5·6" no longer exists.
    store.set(chordQualityOverrideAtom, "Major 7th");
    expect(store.get(effectiveStringSetAtom)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("voicingMatchesAtom returns engine output for a valid triad window", () => {
    const store = makeAtomStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    store.set(voicingTypeAtom, "triad");
    store.set(voicingStringSetAtom, "4·5·6");
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      for (const n of m.notes) expect([3, 4, 5]).toContain(n.stringIndex);
    }
  });

  it("ignores the string set and inversion while voicingType is caged", () => {
    const store = makeAtomStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    store.set(voicingTypeAtom, "caged");
    // A window that would yield zero voicings if it were applied to caged.
    store.set(voicingStringSetAtom, "1·2·3");
    store.set(voicingInversionAtom, "2nd");
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.shape !== undefined)).toBe(true);
  });
});
```

Add `stringSetOptionsAtom`, `effectiveStringSetAtom`, `voicingTypeAtom`, `voicingInversionAtom`, and `voicingStringSetAtom` to the import block at the top of `src/store/chordOverlayAtoms.test.ts` (the existing import from `"./chordOverlayAtoms"`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/store/chordOverlayAtoms.test.ts`
Expected: FAIL — `stringSetOptionsAtom` and `effectiveStringSetAtom` are not exported.

- [ ] **Step 3: Update imports and storage in `chordOverlayAtoms.ts`**

In `src/store/chordOverlayAtoms.ts`, remove `VoicingStringSet` from the type import (lines 13-20). The block becomes:

```typescript
import type {
  ChordMemberFact,
  ResolvedChordMember,
  PracticeLens,
  VoicingType,
  VoicingInversion,
} from "@fretflow/core";
```

Add an import of the new helper near the other local imports (after the `../utils/storage` import block, around line 34):

```typescript
import { buildStringSetOptions } from "./voicingStringSets";
```

Replace the `VOICING_STRING_SETS` constant (line 444) and the `voicingStringSetStorage` definition (lines 454-456). Delete this line:

```typescript
const VOICING_STRING_SETS: VoicingStringSet[] = ["all", "low", "mid", "mid-hi", "top"];
```

and delete:

```typescript
const voicingStringSetStorage = createStorage<VoicingStringSet>({
  validate: (v) => (VOICING_STRING_SETS as string[]).includes(v),
});
```

Replace the `voicingStringSetAtom` definition (lines 472-477):

```typescript
export const voicingStringSetAtom = atomWithStorage<VoicingStringSet>(
  k("voicingStringSet"),
  "all",
  voicingStringSetStorage,
  GET_ON_INIT,
);
```

with:

```typescript
/**
 * The selected string set, stored as a stable id ("all" or a string-number
 * window like "4·5·6"). The id encodes the exact strings, so it survives a
 * chord change when still valid; `effectiveStringSetAtom` resolves it and
 * falls back to "all" when it no longer exists for the active chord.
 */
export const voicingStringSetAtom = atomWithStorage<string>(
  k("voicingStringSet"),
  "all",
  rawStringStorage,
  GET_ON_INIT,
);
```

(`rawStringStorage` is already imported in this file — see the `../utils/storage` import block.)

- [ ] **Step 4: Add the option-list and effective-string-set atoms**

In `src/store/chordOverlayAtoms.ts`, immediately after the `voicingStringSetAtom` definition, add:

```typescript
/**
 * The ordered String Set options for the active chord. The option list
 * rebuilds whenever the chord's tone count changes.
 */
export const stringSetOptionsAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const def = chordType ? CHORD_DEFINITIONS[chordType] : undefined;
  return buildStringSetOptions(def ? def.members.length : 0);
});

/**
 * The stored string-set id resolved to its string-index array against the
 * active chord. When the id is not a current option (the chord changed),
 * this falls back to all six strings — the engine and picker both self-heal.
 */
export const effectiveStringSetAtom = atom((get): readonly number[] => {
  const options = get(stringSetOptionsAtom);
  const stored = get(voicingStringSetAtom);
  const match = options.find((o) => o.id === stored);
  return match ? match.strings : [0, 1, 2, 3, 4, 5];
});
```

- [ ] **Step 5: Rewrite `voicingMatchesAtom`**

Replace the `voicingMatchesAtom` definition (lines 501-517) with:

```typescript
/** The renderer's voicing source. */
export const voicingMatchesAtom = atom((get) => {
  if (get(chordOverlayHiddenAtom)) return [];
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  const voicingType = get(voicingTypeAtom);
  const isCaged = voicingType === "caged";
  const available = get(availableInversionsAtom);
  const inversion = get(voicingInversionAtom);
  return generateVoicings({
    chordRoot: get(chordRootAtom),
    chordType,
    tuning: get(currentTuningAtom),
    maxFret: 24,
    voicingType,
    // A CAGED shape is a fixed root-position object — it has no meaningful
    // string subset or inversion, so caged ignores both controls.
    inversion: isCaged
      ? "root"
      : available.includes(inversion)
        ? inversion
        : "root",
    stringSet: isCaged ? [0, 1, 2, 3, 4, 5] : get(effectiveStringSetAtom),
  });
});
```

- [ ] **Step 6: Re-export the new atoms and helper from the barrel**

In `src/store/atoms.ts`, find the existing re-export of `chordOverlayAtoms` symbols and add `stringSetOptionsAtom` and `effectiveStringSetAtom` to it. If `chordOverlayAtoms` is re-exported with an explicit name list, add both names; if it uses `export * from "./chordOverlayAtoms"`, no change is needed for the atoms. Additionally add a re-export for the helper and its type:

```typescript
export { buildStringSetOptions } from "./voicingStringSets";
export type { StringSetOption } from "./voicingStringSets";
```

Run `grep -n "chordOverlayAtoms" src/store/atoms.ts` first to see which form is used, then apply the matching change.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm exec vitest run src/store/chordOverlayAtoms.test.ts`
Expected: PASS — all five new cases plus the existing suite.

- [ ] **Step 8: Commit**

```bash
git add src/store/chordOverlayAtoms.ts src/store/atoms.ts src/store/chordOverlayAtoms.test.ts
git commit -m "feat(voicing): id-based string-set atom with effective resolver"
```

---

## Task 4: StringSetPicker renders dynamic options

The picker stops owning a hardcoded `CARDS` list. It receives an `options` array and a string id `value`, and derives each card's six-string diagram mask from `option.strings`.

**Files:**
- Modify: `src/components/Inspector/StringSetPicker.tsx`
- Test: `src/components/Inspector/StringSetPicker.test.tsx`

- [ ] **Step 1: Rewrite the failing test**

Replace the entire contents of `src/components/Inspector/StringSetPicker.test.tsx` with:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../test-utils/a11y";
import { StringSetPicker } from "./StringSetPicker";
import { buildStringSetOptions } from "../../store/voicingStringSets";

const triadOptions = buildStringSetOptions(3);
const seventhOptions = buildStringSetOptions(4);

describe("StringSetPicker", () => {
  it("renders the options it is given (triad → 5 cards)", () => {
    render(
      <StringSetPicker options={triadOptions} value="all" onChange={() => {}} />,
    );
    for (const label of ["All", "Bass", "Lower mid", "Upper mid", "Treble"]) {
      expect(
        screen.getByRole("radio", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("renders four cards for a seventh chord", () => {
    render(
      <StringSetPicker options={seventhOptions} value="all" onChange={() => {}} />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: /Middle/ })).toBeInTheDocument();
  });

  it("marks the active card as checked", () => {
    render(
      <StringSetPicker options={triadOptions} value="4·5·6" onChange={() => {}} />,
    );
    expect(screen.getByRole("radio", { name: /Bass/ })).toBeChecked();
  });

  it("calls onChange with the option id when a card is clicked", async () => {
    const onChange = vi.fn();
    render(
      <StringSetPicker options={triadOptions} value="all" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /Treble/ }));
    expect(onChange).toHaveBeenCalledWith("1·2·3");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <StringSetPicker options={triadOptions} value="all" onChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/Inspector/StringSetPicker.test.tsx`
Expected: FAIL — `StringSetPicker` does not accept an `options` prop; its `value` is typed as `VoicingStringSet` which no longer exists.

- [ ] **Step 3: Rewrite the picker**

Replace the entire contents of `src/components/Inspector/StringSetPicker.tsx` with:

```typescript
import clsx from "clsx";
import type { StringSetOption } from "../../store/voicingStringSets";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./StringSetPicker.module.css";

interface StringSetPickerProps {
  /** The chord-appropriate option list (from `buildStringSetOptions`). */
  options: readonly StringSetOption[];
  /** The selected option id. */
  value: string;
  onChange: (value: string) => void;
}

/** Six-string on/off mask for a diagram, index 0 = high E … 5 = low E. */
function diagramMask(strings: readonly number[]): boolean[] {
  const set = new Set(strings);
  return [0, 1, 2, 3, 4, 5].map((i) => set.has(i));
}

/**
 * The locale-neutral sub-text: the option id for a window ("4·5·6"), or a
 * localized "6 strings" for the All option.
 */
function subText(option: StringSetOption, t: (key: string) => string): string {
  return option.id === "all" ? t("inspector.stringSetAllSub") : option.id;
}

export function StringSetPicker({ options, value, onChange }: StringSetPickerProps) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.grid}
      role="radiogroup"
      aria-label={t("inspector.voicingStringSet")}
    >
      {options.map((option) => {
        const active = value === option.id;
        const label = t(option.labelKey);
        const sub = subText(option, t);
        const mask = diagramMask(option.strings);
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} — ${sub}`}
            className={clsx(styles.card, active && styles.cardActive)}
            onClick={() => onChange(option.id)}
          >
            <span className={styles.diagram} aria-hidden="true">
              {/* Reverse so low-E (thick) renders at the bottom, high-E (thin) at the top. */}
              {[...mask].reverse().map((on, i) => (
                <span
                  key={i}
                  className={clsx(styles.string, on && styles.stringOn)}
                  style={{ height: `${1 + i * 0.4}px` }}
                />
              ))}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{label}</span>
              <span className={styles.sub}>{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/Inspector/StringSetPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Inspector/StringSetPicker.tsx src/components/Inspector/StringSetPicker.test.tsx
git commit -m "feat(voicing): StringSetPicker renders dynamic option list"
```

---

## Task 5: ChordOverlayControls — hide controls for caged, normalize, wire picker

When `voicingType === "caged"`, the String Set and Inversion `Prop` cells are not rendered. A normalizing effect resets a stale string-set id back to `all`. The picker receives the dynamic `options`.

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

Append this `describe` block to `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` (it is a flat list of `describe` blocks — add at the end). The file already has a render helper and atom-seeding utilities; match the existing pattern in the file for how a chord is seeded (use the same `renderWithAtoms` / initial-atom-values approach the other tests in this file use). Skeleton:

```typescript
describe("ChordOverlayControls — voicing controls visibility", () => {
  it("hides String Set and Inversion when voicingType is caged", () => {
    renderControls({
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
      voicingType: "caged",
    });
    expect(screen.queryByLabelText("Voicing inversion")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: /String Set/i }),
    ).not.toBeInTheDocument();
  });

  it("shows String Set and Inversion for triad and drop2", () => {
    renderControls({
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
      voicingType: "triad",
    });
    expect(screen.getByLabelText("Voicing inversion")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: /String Set/i }),
    ).toBeInTheDocument();
  });

  it("shows five string-set cards for a triad and four for a seventh chord", () => {
    const { rerender } = renderControls({
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
      voicingType: "triad",
    });
    expect(screen.getAllByRole("radio", { name: /strings|·/ })).toHaveLength(5);

    rerender({ chordQualityOverride: "Major 7th" });
    expect(screen.getAllByRole("radio", { name: /strings|·/ })).toHaveLength(4);
  });

  it("snaps a stale string-set selection back to All on an incompatible chord", async () => {
    const { rerender } = renderControls({
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
      voicingType: "triad",
      voicingStringSet: "4·5·6",
    });
    expect(screen.getByRole("radio", { name: /Bass/ })).toBeChecked();

    rerender({ chordQualityOverride: "Major 7th" });
    // "4·5·6" is not a valid window for a 4-note chord — normalizer resets it.
    await screen.findByRole("radio", { name: /All/, checked: true });
  });
});
```

Adapt `renderControls` / `rerender` to whatever helper the existing tests in this file use to seed atoms — do not invent a new harness. If the file has no rerender-with-new-atoms helper, seed a Jotai store, render `<Provider store={store}>`, and call `store.set(...)` then re-assert inside `act`. Read the top of the existing test file before writing this step.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: FAIL — String Set and Inversion render regardless of `voicingType`; the picker still shows the fixed five cards.

- [ ] **Step 3: Wire the dynamic options and caged gating**

In `src/components/ChordOverlayControls/ChordOverlayControls.tsx`:

Add `stringSetOptionsAtom` to the atom import block (lines 5-13):

```typescript
import {
  lensAvailabilityAtom,
  fingeringPatternAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
  voicingConnectorsAtom,
  availableInversionsAtom,
  stringSetOptionsAtom,
} from "../../store/atoms";
```

Add a hook read alongside the existing `availableInversions` read (after line 56):

```typescript
  const stringSetOptions = useAtomValue(stringSetOptionsAtom);
```

Add the string-set normalizer effect immediately after the existing inversion normalizer (after line 99):

```typescript
  // Normalize a persisted string-set id the active chord no longer offers
  // (e.g. a 3-string triad window after switching to a 4-note chord).
  useEffect(() => {
    if (!stringSetOptions.some((o) => o.id === voicingStringSet)) {
      setVoicingStringSet("all");
    }
  }, [stringSetOptions, voicingStringSet, setVoicingStringSet]);
```

- [ ] **Step 4: Hide the Inversion and String Set cells for caged**

Still in `ChordOverlayControls.tsx`, find the VOICING block (the `{showDisplay && (` group near line 222). The Inversion `Prop` (`label={t("inspector.voicingInversion")}`) and the String Set `Prop` (`label={t("inspector.voicingStringSet")}`) must be gated on `voicingType !== "caged"`.

Wrap the Inversion `Prop` so it reads:

```typescript
            {voicingType !== "caged" && (
              <Prop
                label={t("inspector.voicingInversion")}
                span={4}
                hint={t("inspector.voicingInversionHint")}
              >
                <ToggleBar
                  label="Voicing inversion"
                  options={(["root", "1st", "2nd", "3rd"] as const).map((v) => ({
                    value: v,
                    label: v === "root" ? t("controls.root") : v,
                    disabled: !availableInversions.includes(v),
                  }))}
                  value={voicingInversion}
                  onChange={setVoicingInversion}
                />
              </Prop>
            )}
```

Wrap the String Set `Prop` so it reads:

```typescript
            {voicingType !== "caged" && (
              <Prop
                label={t("inspector.voicingStringSet")}
                span={7}
                hint={t("inspector.voicingStringSetHint")}
              >
                <StringSetPicker
                  options={stringSetOptions}
                  value={voicingStringSet}
                  onChange={setVoicingStringSet}
                />
              </Prop>
            )}
```

Note the two changes to the String Set `Prop`: it is now gated on `voicingType`, and `StringSetPicker` now receives the `options` prop.

The Voicing Type `Prop` (`label={t("inspector.voicingType")}`, `span={3}`) and the VOICING `GroupHeader` are **not** gated — they always render.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/ChordOverlayControls.tsx src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
git commit -m "feat(voicing): caged hides string-set/inversion, dynamic picker wiring"
```

---

## Task 6: FretboardSVG — no generated scatter while a voicing source is active

The connector hook must never synthesize connectors from loose chord tones when a voicing source is active. When the voicing engine yields nothing, the board shows the plain chord-tone overlay with no connectors.

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx:426-439`
- Test: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`. The file already exercises `buildChordConnectorPolylines` with `noteData` fixtures — reuse one of those fixtures. Add a `describe` block:

```typescript
describe("useChordConnectorPolylines — voicing source gating", () => {
  it("emits no generated scatter when a voicing source is active but empty", () => {
    // Render the hook with chord-tone noteData but an empty explicitVoicings
    // list and voicingSourceActive = true. The generated fallback must NOT run.
    const { result } = renderHook(() =>
      useChordConnectorPolylines({
        noteData: scatteredChordToneNoteData, // existing fixture in this file
        chordToneNames: ["C", "E", "G"],
        fretCenterX: (f) => f * 40,
        stringYAt: (s) => s * 30,
        stringRowPx: 30,
        chordRoot: "C",
        explicitVoicings: [],
        voicingSourceActive: true,
      }),
    );
    expect(result.current).toEqual([]);
  });

  it("still generates connectors when no voicing source is active (legacy path)", () => {
    const { result } = renderHook(() =>
      useChordConnectorPolylines({
        noteData: scatteredChordToneNoteData,
        chordToneNames: ["C", "E", "G"],
        fretCenterX: (f) => f * 40,
        stringYAt: (s) => s * 30,
        stringRowPx: 30,
        chordRoot: "C",
        explicitVoicings: [],
        voicingSourceActive: false,
      }),
    );
    expect(result.current.length).toBeGreaterThan(0);
  });
});
```

If the test file does not already import `renderHook`, add `import { renderHook } from "@testing-library/react";`. If there is no fixture named `scatteredChordToneNoteData`, build a minimal inline `NoteData[]` with at least three chord-tone positions spanning three adjacent strings on the same fret window (copy the shape of an existing fixture in the file). Read the existing tests in this file first and reuse their fixture rather than inventing one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`
Expected: FAIL — `voicingSourceActive` is not a recognized param (TypeScript error), and with it ignored the first case returns generated voicings instead of `[]`.

- [ ] **Step 3: Add the `voicingSourceActive` param to the hook**

In `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`, add the field to `UseChordConnectorPolylinesParams` (the interface near line 926), after `explicitVoicings`:

```typescript
  /**
   * True when the voicing engine is the active connector source. When set,
   * the hook never synthesizes connectors from loose chord tones — an empty
   * `explicitVoicings` yields `[]` (the plain chord-tone overlay), not the
   * "generated scatter" fallback.
   */
  voicingSourceActive?: boolean;
```

In the `useChordConnectorPolylines` function, add `voicingSourceActive` to the destructured params and rewrite the `useMemo` body:

```typescript
export function useChordConnectorPolylines({
  noteData,
  chordToneNames,
  fretCenterX,
  stringYAt,
  stringRowPx,
  chordRoot,
  yBounds,
  explicitVoicings,
  voicingSourceActive,
}: UseChordConnectorPolylinesParams): ChordConnectorVoicing[] {
  return useMemo(
    () => {
      if (explicitVoicings && explicitVoicings.length > 0) {
        return buildExplicitChordConnectorPolylines(
          explicitVoicings,
          chordToneNames,
          fretCenterX,
          stringYAt,
          stringRowPx,
          chordRoot,
          yBounds,
        );
      }

      // A voicing source is active but produced nothing — show no connectors
      // rather than a misleading scatter over every loose chord tone.
      if (voicingSourceActive) return [];

      return buildChordConnectorPolylines(
        noteData,
        chordToneNames,
        fretCenterX,
        stringYAt,
        stringRowPx,
        chordRoot,
        yBounds,
      );
    },
    [
      noteData,
      chordToneNames,
      fretCenterX,
      stringYAt,
      stringRowPx,
      chordRoot,
      yBounds,
      explicitVoicings,
      voicingSourceActive,
    ],
  );
}
```

- [ ] **Step 4: Pass `voicingSourceActive` from FretboardSVG**

In `src/components/FretboardSVG/FretboardSVG.tsx`, the `useChordConnectorPolylines` call (around line 426) currently ends with `explicitVoicings: fullChordVoicings,`. Add one line:

```typescript
  const connectorPolylines = useChordConnectorPolylines({
    noteData: chordNoteData,
    chordToneNames:
      fingeringPattern === "one-string" || fingeringPattern === "two-strings"
        ? []
        : chordTones,
    fretCenterX,
    stringYAt,
    stringRowPx,
    chordRoot: chordRoot ?? "",
    yBounds: connectorYBounds,
    explicitVoicings: fullChordVoicings,
    voicingSourceActive: hasChordOverlay,
  });
```

(`hasChordOverlay` is already computed at line 190 as `chordTones.length > 0`.)

Change the `connectorSource` line (line 439) from:

```typescript
  const connectorSource = fullChordVoicings?.length ? "full-chord" : "generated";
```

to:

```typescript
  // When a chord overlay is active the voicing engine is the only source —
  // never label the layer "generated", even when the engine returns nothing.
  const connectorSource = hasChordOverlay ? "full-chord" : "generated";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the FretboardSVG component test**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS. If a case asserts `data-connector-source="generated"` while a chord overlay is active, update that assertion to `"full-chord"` — the new behavior is correct per spec §6.

- [ ] **Step 7: Commit**

```bash
git add src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "fix(voicing): no generated connector scatter while voicing source active"
```

---

## Task 7: Full verification + visual-regression refresh

**Files:**
- Modify (snapshots): `e2e/app-components.visual.spec.ts-snapshots/`, `e2e/chord-overlay-controls.visual.spec.ts-snapshots/`, `e2e/fretboard-svg.visual.spec.ts-snapshots/`, `e2e/fretboard-connectors.visual.spec.ts-snapshots/`

- [ ] **Step 1: Run the full unit + component suite**

Run: `pnpm run test`
Expected: PASS — all suites green. If a test elsewhere imported `VoicingStringSet` or `stringSetMask`, fix it: replace `VoicingStringSet` usages with the `string` id type and replace `stringSetMask("low")` calls with the literal index array (`[3, 4, 5]`, etc.). Run `grep -rn "VoicingStringSet\|stringSetMask" src packages` to confirm zero remaining references in non-deleted code.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint`
Expected: PASS — eslint + stylelint clean.

- [ ] **Step 3: Run the type build**

Run: `npx tsc -b`
Expected: PASS — no type errors. This surfaces any missed `VoicingStringSet` consumer (spec §8).

- [ ] **Step 4: Run the production build**

Run: `pnpm run build`
Expected: PASS — `tsc -b && vite build` completes.

- [ ] **Step 5: Refresh visual-regression baselines**

The Chord-tab voicing controls, the string-set picker, and connector rendering all changed appearance. Refresh the darwin snapshots:

Run: `pnpm run test:visual:update`
Expected: the four affected suites' darwin `.png` baselines update; review the diffs to confirm only the intended changes (hidden String Set / Inversion under `caged`, dynamic picker cards, no scatter when the engine is empty).

- [ ] **Step 6: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: matching linux baselines update.

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test(voicing): refresh visual-regression baselines for voicing redesign"
```

---

## Self-Review (completed against the spec)

**Spec coverage:**
- §3 (Type drives visible controls) → Task 5 Step 4 hides the Inversion + String Set cells when `voicingType === "caged"`; Task 3 Step 5 makes the engine ignore both for caged.
- §4a (window model) → Task 2 Step 3 `buildStringSetOptions`.
- §4b (identity / persistence / auto-pick) → Task 3: `voicingStringSetAtom` stores the id, `effectiveStringSetAtom` resolves with `all` fallback; Task 5 adds the normalizer; Task 4 picker shows only valid options.
- §4c (core param) → Task 1: `stringSet` is `readonly number[]`; `VoicingStringSet` / `STRING_SET_MASKS` / `stringSetMask` removed.
- §5 (Inversion) → unchanged substance; Task 5 Step 4 hides the cell for caged; existing normalizer kept.
- §6 (coherent rendering, no scatter) → Task 6: `voicingSourceActive` suppresses the generated fallback; `selectFullChordMatchesForCagedPosition` (in `useFretboardState`) is untouched, so triad/drop2 stay constrained to the active CAGED position.
- §7 (file-level impact) → every listed file appears in a task.
- §8 (cross-cutting) → i18n keys in Task 2 Step 5 (en + es); `tsc -b` in Task 7 Step 3; visual baselines in Task 7 Steps 5-6.
- §9 (testing) → every bullet maps to a task's failing-test step.
- §10 (acceptance criteria) → covered by Tasks 5, 6 and the Task 7 gate.

**Type consistency:** `StringSetOption` (`{ id, labelKey, strings }`) is defined once in Task 2 and consumed unchanged in Tasks 3, 4. `voicingStringSetAtom` is `string` from Task 3 onward; `StringSetPicker`'s `value`/`onChange` use `string`. `voicingSourceActive` is `boolean | undefined` in both the hook (Task 6 Step 3) and the call site (Step 4).

**Note on `selectFullChordMatchesForCagedPosition`:** spec §6 references it as already scoring any `Voicing`. It lives in the `useFretboardState` chain and needs no change — confirmed in `src/hooks/useFretboardState.ts:175`.
