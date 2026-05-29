# Progressions Drive Scale & Chord Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make loading a progression set its home scale (parallel-key, root unchanged) and load its degrees verbatim so chord qualities follow the scale, fix the picker mislabel via a tracked loaded-id, support a per-step quality pin for the minor-key dominant V, and move the preset picker into its own card first in the top row.

**Architecture:** A progression carries a `scale`. Loaders write the base `scaleNameAtom` (no remap) + verbatim steps + a persisted `loadedPresetIdAtom`; `currentProgressionPresetIdAtom` returns that id (no step-matching). `resolveProgressionStep` lets a valid `qualityOverride` pin a non-diatonic chord on its scale-degree root. The picker shows all presets (no availability filter) and lives in a new first card.

**Tech Stack:** React 19 + TypeScript, Jotai (`atomWithStorage`), `@fretflow/core` theory, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-28-progression-scale-coupling-design.md`

**Branch:** continue on `claude/zealous-fermat-f6ef59` (this builds on the unmerged PR #472). pnpm. Commitlint types: build/chore/ci/docs/feat/fix/perf/refactor/revert/style/test. Don't skip hooks.

---

## File Structure

- `src/progressions/progressionDomain.ts` — `resolveProgressionStep` quality pin (Task 1); `scale` on `ProgressionPreset` + `PRESET_SPECS` incl. `V:7` pins (Task 2); remove dead helpers (Task 5).
- `src/progressions/progressionDomain.test.ts` — pin tests, preset-resolves-in-scale tests.
- `src/progressions/progressionGeneration.ts` — `scale` on `SuggestedPreset` (Task 2).
- `src/store/progressionAtoms.ts` — `loadedPresetIdAtom`, loader rewrites, `currentProgressionPresetIdAtom`, clear-on-edit (Tasks 3–4).
- `src/store/actions.ts` — clear loaded id on manual scale change (Task 4).
- `src/hooks/useProgressionState.ts` — expose suggestion loader (Task 5).
- `src/components/SongControls/SongControls.tsx` + `.module.css` — categories from all presets, suggestion load, Preset card first (Tasks 5–6).
- `src/i18n/{types,en,es}.ts` — `groupPreset` strings (Task 6).
- `CLAUDE.md` — invariant wording (Task 7).

---

## Task 1: Per-step quality pin in `resolveProgressionStep`

**Files:**
- Modify: `src/progressions/progressionDomain.ts` (imports + `resolveProgressionStep`, lines ~512–576)
- Test: `src/progressions/progressionDomain.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/progressionDomain.test.ts`:

```ts
import { resolveProgressionStep } from "./progressionDomain";

describe("resolveProgressionStep — quality pin", () => {
  const step = (degree: string, qualityOverride: string | null) => ({
    id: "t", degree, duration: { value: 1, unit: "bar" as const }, qualityOverride, manualRoot: null,
  });

  it("pins a dominant V in natural minor on the perfect-5th root", () => {
    const c = resolveProgressionStep(step("V", "7"), "minor", "C");
    expect(c.unavailable).toBe(false);
    expect(c.root).toBe("G");
    expect(c.quality).toBe("7");

    const a = resolveProgressionStep(step("V", "7"), "minor", "A");
    expect(a.unavailable).toBe(false);
    expect(a.root).toBe("E");
  });

  it("leaves a non-diatonic degree unavailable when there is no override", () => {
    const r = resolveProgressionStep(step("V", null), "minor", "C");
    expect(r.unavailable).toBe(true);
  });

  it("stays unavailable when the degree's ordinal exceeds the scale length", () => {
    // major pentatonic has 5 notes; VII (ordinal 6) has no scale note to pin to.
    const r = resolveProgressionStep(step("VII", "7"), "major pentatonic", "C");
    expect(r.unavailable).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/progressionDomain.test.ts -t "quality pin"`
Expected: FAIL — the first test currently returns `unavailable: true` for `V:7` in minor.

- [ ] **Step 3: Add the `getScaleNotes` import**

In `src/progressions/progressionDomain.ts`, extend the `@fretflow/core` import block (top of file) to include `getScaleNotes`:

```ts
import {
  CHORD_DEFINITIONS,
  formatAccidental,
  getChordDisplayLabel,
  getDegreeSequence,
  getDiatonicChord,
  getNoteDisplay,
  getScaleNotes,
  transposeNoteToSharps,
  type DegreeId,
} from "@fretflow/core";
```

- [ ] **Step 4: Implement the pin in `resolveProgressionStep`**

Replace the body from the `const diatonic = …` line down through the unavailable-return block and the `root`/`quality` resolution (lines ~519–558) with:

```ts
  const harmonyScale = getProgressionHarmonyScaleName(scaleName);
  const diatonic = getDiatonicChord(step.degree, harmonyScale, rootNote);

  // When manualRoot is set we bypass the diatonic resolver for root + quality.
  const usingManualRoot = step.manualRoot != null;

  const overrideValid =
    step.qualityOverride !== null && CHORD_DEFINITIONS[step.qualityOverride] !== undefined;

  // Quality pin: a valid override resolves a non-diatonic degree on its
  // scale-position root (e.g. a dominant V in natural minor). The pin is
  // relative to the scale degree, so it transposes with the root.
  let pinnedRoot: string | null = null;
  if (!diatonic && !usingManualRoot && overrideValid) {
    const ordinal = getDegreeOrdinal(step.degree);
    if (ordinal !== null) {
      pinnedRoot = getScaleNotes(rootNote, harmonyScale)[ordinal] ?? null;
    }
  }

  if (!diatonic && !usingManualRoot && pinnedRoot === null) {
    return {
      ...step,
      index,
      root: null,
      quality: null,
      diatonicQuality: null,
      label: step.degree,
      resolvedChordLabel: null,
      shortChordLabel: null,
      unavailable: true,
      unavailableReason: "Degree unavailable in this scale",
      qualityOverrideApplied: false,
      invalidQualityOverride: false,
    };
  }

  // Resolve root: manualRoot > diatonic > pinned scale-degree root.
  const root = usingManualRoot ? step.manualRoot! : (diatonic?.root ?? pinnedRoot!);

  // Resolve quality: qualityOverride > manualRoot default > diatonic quality.
  const quality = overrideValid
    ? step.qualityOverride!
    : usingManualRoot
      ? guessQualityForBorrowedRoot(step.manualRoot ?? undefined, scaleName, rootNote)
      : diatonic!.quality;
```

(The existing `diatonicQuality`, `rootLabel`, and the final `return { … }` below this block are unchanged. Note `diatonic!.quality` is only reached when `diatonic` is non-null — when pinned, `overrideValid` is true so the first branch wins. The earlier standalone `const diatonic = getDiatonicChord(step.degree, getProgressionHarmonyScaleName(scaleName), rootNote);` lines are replaced by the `harmonyScale` version above — ensure there is no leftover duplicate `const diatonic`.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/progressionDomain.test.ts`
Expected: PASS (new quality-pin tests + existing domain tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/progressionDomain.ts src/progressions/progressionDomain.test.ts
git commit -m "feat(progressions): pin non-diatonic chords via quality override"
```

---

## Task 2: `scale` field on presets + `V:7` pins

**Files:**
- Modify: `src/progressions/progressionDomain.ts` (`ProgressionPreset` interface ~180; `PRESET_SPECS` ~228–265)
- Modify: `src/progressions/progressionGeneration.ts` (`SuggestedPreset`, `buildPreset`)
- Test: `src/progressions/progressionDomain.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/progressionDomain.test.ts`:

```ts
import { PROGRESSION_PRESETS } from "./progressionDomain";

const PRESET_HOME_SCALE: Record<string, string> = {
  "one-five-six-four": "major", "two-five-one": "major", "one-six-four-five": "major",
  "one-four-five": "major", "twelve-bar-blues": "major", "vi-iv-i-v": "major",
  "i-iv-vi-v": "major", "canon": "major", "eight-bar-blues": "major",
  "minor-blues": "minor", "one-six-two-five": "major", "three-six-two-five": "major",
  "two-five-one-six": "major", "one-four-two-five": "major", "one-four-one-five": "major",
  "one-five-one-four-one-five-one": "major", "dorian-i-iv": "dorian", "dorian-i-vii-iv": "dorian",
  "mixolydian-i-vii-iv": "mixolydian", "phrygian-i-ii": "phrygian", "lydian-i-ii": "lydian",
  "minor-i-iv-v": "minor", "minor-i-vi-vii": "minor", "andalusian": "minor",
  "minor-i-iv-vii-iii": "minor",
};

describe("PROGRESSION_PRESETS — home scale", () => {
  it("declares the expected scale for every preset", () => {
    for (const p of PROGRESSION_PRESETS) {
      expect(p.scale).toBe(PRESET_HOME_SCALE[p.id]);
    }
  });

  it("every preset's steps resolve (not unavailable) in its home scale", () => {
    const problems: string[] = [];
    for (const p of PROGRESSION_PRESETS) {
      p.steps.forEach((s, i) => {
        const r = resolveProgressionStep({ id: `${p.id}-${i}`, ...s }, p.scale, "C");
        if (r.unavailable) problems.push(`${p.id}[${p.scale}] #${i} ${s.degree}`);
      });
    }
    expect(problems).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/progressions/progressionDomain.test.ts -t "home scale"`
Expected: FAIL — `p.scale` is `undefined` (TypeScript may also error; that's fine, the test asserts the runtime value).

- [ ] **Step 3: Add `scale` to the `ProgressionPreset` interface**

In `src/progressions/progressionDomain.ts`, change:

```ts
export interface ProgressionPreset {
  id: string;
  label: string;
  category: ProgressionPresetCategory;
  steps: Array<Omit<ProgressionStep, "id">>;
}
```
to:
```ts
export interface ProgressionPreset {
  id: string;
  label: string;
  category: ProgressionPresetCategory;
  /** The scale this progression is written in; loading it sets the active scale. */
  scale: string;
  steps: Array<Omit<ProgressionStep, "id">>;
}
```

- [ ] **Step 4: Add `scale` to every `PRESET_SPECS` entry and pin the minor-key V**

Replace the entire `PRESET_SPECS` array with (note the `scale` field on each, and `V:7` in `minor-blues` and `andalusian`):

```ts
const PRESET_SPECS: ReadonlyArray<{
  id: string;
  label: string;
  category: ProgressionPresetCategory;
  scale: string;
  spec: string;
}> = [
  { id: "one-five-six-four", label: "I-V-vi-IV", category: "pop-rock", scale: "major", spec: "I V vi IV" },
  { id: "two-five-one", label: "ii-V-I", category: "jazz", scale: "major", spec: "ii V:7 I" },
  { id: "one-six-four-five", label: "I-vi-IV-V", category: "pop-rock", scale: "major", spec: "I vi IV V" },
  { id: "one-four-five", label: "I-IV-V", category: "folk", scale: "major", spec: "I IV V" },
  { id: "twelve-bar-blues", label: "12-bar blues", category: "blues", scale: "major",
    spec: "I*4:7 IV*2:7 I*2:7 V:7 IV:7 I:7 V:7" },
  { id: "vi-iv-i-v", label: "vi-IV-I-V", category: "pop-rock", scale: "major", spec: "vi IV I V" },
  { id: "i-iv-vi-v", label: "I-IV-vi-V", category: "pop-rock", scale: "major", spec: "I IV vi V" },
  { id: "canon", label: "Canon (I-V-vi-iii-IV-I-IV-V)", category: "pop-rock", scale: "major",
    spec: "I V vi iii IV I IV V" },
  { id: "eight-bar-blues", label: "8-bar blues", category: "blues", scale: "major",
    spec: "I*2:7 IV*2:7 I:7 V:7 I:7 V:7" },
  { id: "minor-blues", label: "Minor blues", category: "blues", scale: "minor",
    spec: "i*4 iv*2 i*2 V:7 iv i V:7" },
  { id: "one-six-two-five", label: "I-vi-ii-V (turnaround)", category: "jazz", scale: "major", spec: "I vi ii V" },
  { id: "three-six-two-five", label: "iii-vi-ii-V", category: "jazz", scale: "major", spec: "iii vi ii V" },
  { id: "two-five-one-six", label: "ii-V-I-vi (rhythm changes)", category: "jazz", scale: "major",
    spec: "ii V:7 I vi" },
  { id: "one-four-two-five", label: "I-IV-ii-V", category: "jazz", scale: "major", spec: "I IV ii V" },
  { id: "one-four-one-five", label: "I-IV-I-V", category: "folk", scale: "major", spec: "I IV I V" },
  { id: "one-five-one-four-one-five-one", label: "I-V-I-IV-I-V-I", category: "folk", scale: "major",
    spec: "I V I IV I V I" },
  { id: "dorian-i-iv", label: "Dorian i-IV", category: "modal", scale: "dorian", spec: "i IV" },
  { id: "dorian-i-vii-iv", label: "Dorian i-VII-IV", category: "modal", scale: "dorian", spec: "i VII IV" },
  { id: "mixolydian-i-vii-iv", label: "Mixolydian I-VII-IV", category: "modal", scale: "mixolydian", spec: "I VII IV" },
  { id: "phrygian-i-ii", label: "Phrygian i-II", category: "modal", scale: "phrygian", spec: "i II" },
  { id: "lydian-i-ii", label: "Lydian I-II", category: "modal", scale: "lydian", spec: "I II" },
  { id: "minor-i-iv-v", label: "i-iv-v", category: "minor", scale: "minor", spec: "i iv v" },
  { id: "minor-i-vi-vii", label: "i-VI-VII", category: "minor", scale: "minor", spec: "i VI VII" },
  { id: "andalusian", label: "Andalusian (i-VII-VI-V)", category: "minor", scale: "minor", spec: "i VII VI V:7" },
  { id: "minor-i-iv-vii-iii", label: "i-iv-VII-III", category: "minor", scale: "minor", spec: "i iv VII III" },
];
```

Then update the `PROGRESSION_PRESETS` map to carry `scale`:

```ts
export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = PRESET_SPECS.map(
  ({ id, label, category, scale, spec }) => ({ id, label, category, scale, steps: parseSteps(spec) }),
);
```

- [ ] **Step 5: Add `scale` to `SuggestedPreset`**

In `src/progressions/progressionGeneration.ts`, change the interface and `buildPreset` return:

```ts
export interface SuggestedPreset extends Omit<ProgressionPreset, "category"> {
  category: "suggested";
  feel: SuggestionFeel;
}
```
(`SuggestedPreset` already extends `Omit<ProgressionPreset, "category">`, so adding `scale` to `ProgressionPreset` automatically requires it here.) In `buildPreset`, add `scale: scaleName` to the returned object:

```ts
  return {
    id: `suggested-${template.feel}-${template.ordinals.join("")}`,
    label: labelParts.join("-"),
    category: "suggested",
    feel: template.feel,
    scale: scaleName,
    steps,
  };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/progressionDomain.test.ts src/progressions/progressionGeneration.test.ts`
Expected: PASS (home-scale tests pass; `minor-blues`/`andalusian` resolve via the Task 1 pin).

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc -b`
Expected: exit 0. If any test or fixture constructs a `ProgressionPreset`/`SuggestedPreset` literal without `scale`, add `scale: "major"` (or the appropriate value) to it.

- [ ] **Step 8: Commit**

```bash
git add src/progressions/progressionDomain.ts src/progressions/progressionGeneration.ts src/progressions/progressionDomain.test.ts
git commit -m "feat(progressions): give every preset a home scale (incl. V:7 minor pins)"
```

---

## Task 3: `loadedPresetIdAtom` + loader rewrites + simplified selection

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/store/progressionAtoms.test.ts` (merge imports with the existing ones at the top):

```ts
import { createStore } from "jotai";
import {
  loadProgressionPresetAtom,
  loadProgressionSuggestionAtom,
  currentProgressionPresetIdAtom,
  loadedPresetIdAtom,
  progressionStepsAtom,
  resolvedProgressionStepsAtom,
  CUSTOM_PRESET_ID,
} from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { generateCommonProgressions } from "../progressions/progressionGeneration";

describe("progression loading — scale coupling", () => {
  it("loading a minor preset sets minor scale, keeps root, resolves minor chords", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionPresetAtom, "minor-i-iv-v");
    expect(store.get(scaleNameAtom)).toBe("minor");
    expect(store.get(rootNoteAtom)).toBe("C");
    const resolved = store.get(resolvedProgressionStepsAtom);
    expect(resolved.map((s) => s.degree)).toEqual(["i", "iv", "v"]);
    expect(resolved.every((s) => !s.unavailable)).toBe(true);
    expect(store.get(currentProgressionPresetIdAtom)).toBe("minor-i-iv-v");
  });

  it("loading a Dorian preset switches scale to dorian and reflects the id", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionPresetAtom, "dorian-i-iv");
    expect(store.get(scaleNameAtom)).toBe("dorian");
    expect(store.get(currentProgressionPresetIdAtom)).toBe("dorian-i-iv");
  });

  it("loading the major I-IV vamp shows the vamp id, not a colliding preset", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    const vamp = generateCommonProgressions("major", "C").find((s) => s.feel === "vamp")!;
    store.set(loadProgressionSuggestionAtom, vamp);
    expect(store.get(scaleNameAtom)).toBe("major");
    expect(store.get(currentProgressionPresetIdAtom)).toBe(vamp.id);
  });

  it("is custom with no loaded id", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    expect(store.get(currentProgressionPresetIdAtom)).toBe(CUSTOM_PRESET_ID);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/store/progressionAtoms.test.ts -t "scale coupling"`
Expected: FAIL — `loadProgressionSuggestionAtom`/`loadedPresetIdAtom` don't exist; loading a preset doesn't set the scale.

- [ ] **Step 3: Add `loadedPresetIdAtom` (persisted)**

In `src/store/progressionAtoms.ts`, near the other `atomWithStorage` atoms, add (use the existing storage-key helper — confirm the import name; the file already imports a key helper like `k`/`storageKey` — reuse it):

```ts
export const loadedPresetIdAtom = atomWithStorage<string | null>(
  k("loadedPresetId"),
  null,
);
```

(If `atomWithStorage` / the key helper `k` are not yet imported in this file, import them following the pattern used by other persisted atoms in the same file.)

- [ ] **Step 4: Rewrite `loadProgressionPresetAtom` and add `loadProgressionSuggestionAtom`**

Replace the existing `loadProgressionPresetAtom` (lines ~465–474) with:

```ts
export const loadProgressionPresetAtom = atom(null, (get, set, presetId: string) => {
  const preset = PROGRESSION_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return;
  // Loading establishes harmonic context: set the home scale (base write — no
  // remap) and load degrees verbatim so qualities follow the scale.
  set(scaleNameAtom, preset.scale);
  set(progressionStepsAtom, preset.steps.map((step) => createProgressionStep({ ...step })));
  set(activeProgressionStepIndexAtom, 0);
  set(progressionPlayingStateAtom, false);
  set(progressionStepDeadlineAtom, null);
  set(loadedPresetIdAtom, preset.id);
  const genreId = PRESET_CATEGORY_GENRE[preset.category];
  if (genreId) set(applyGenreStyleAtom, genreId);
});

export const loadProgressionSuggestionAtom = atom(
  null,
  (_get, set, suggestion: { id: string; steps: ReadonlyArray<Omit<ProgressionStep, "id">> }) => {
    if (suggestion.steps.length === 0) return;
    // Suggestions are generated in the current scale, so no scale switch.
    set(progressionStepsAtom, suggestion.steps.map((step) => createProgressionStep({ ...step })));
    set(activeProgressionStepIndexAtom, 0);
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
    set(loadedPresetIdAtom, suggestion.id);
  },
);
```

Leave `loadProgressionStepsAtom` in place (still exported/used by the hook for generic loads); it does not set a loaded id.

- [ ] **Step 5: Simplify `currentProgressionPresetIdAtom`**

Replace the current derived atom (lines ~377–393, the version that step-matches presets and suggestions) with:

```ts
export const currentProgressionPresetIdAtom = atom<string>(
  (get) => get(loadedPresetIdAtom) ?? CUSTOM_PRESET_ID,
);
```

Remove the now-unused imports in this file: `getAvailableProgressionPresets`, `getProgressionPresetStepsForScale`, `generateCommonProgressions`, and the local `stepsMatchPreset` helper (delete the function if no other reference remains — grep first).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/progressionAtoms.test.ts`
Expected: PASS. Remove/replace any pre-existing test in this file that asserted the old step-matching behavior of `currentProgressionPresetIdAtom` (the suggestion-matching `describe` added in PR #472) — it is superseded by the loaded-id model; delete it.

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc -b`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progressions): load sets scale + verbatim steps + tracked id"
```

---

## Task 4: Clear the loaded id on edits and manual scale change

**Files:**
- Modify: `src/store/progressionAtoms.ts` (8 mutation atoms)
- Modify: `src/store/actions.ts` (`setScaleNameAtom`)
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/store/progressionAtoms.test.ts` (reuse imports; add `addProgressionStepAtom`, `updateProgressionStepDegreeAtom` to the import list, and import `setScaleNameAtom` from `./actions`):

```ts
import { addProgressionStepAtom, updateProgressionStepDegreeAtom } from "./progressionAtoms";
import { setScaleNameAtom } from "./actions";

describe("loadedPresetId clearing", () => {
  it("clears to custom after editing a step", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionPresetAtom, "one-five-six-four");
    expect(store.get(currentProgressionPresetIdAtom)).toBe("one-five-six-four");
    const firstId = store.get(progressionStepsAtom)[0].id;
    store.set(updateProgressionStepDegreeAtom, { id: firstId, degree: "ii" });
    expect(store.get(currentProgressionPresetIdAtom)).toBe(CUSTOM_PRESET_ID);
  });

  it("clears to custom after adding a step", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionPresetAtom, "one-five-six-four");
    store.set(addProgressionStepAtom);
    expect(store.get(currentProgressionPresetIdAtom)).toBe(CUSTOM_PRESET_ID);
  });

  it("clears to custom after a manual scale change", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionPresetAtom, "one-five-six-four");
    store.set(setScaleNameAtom, "dorian");
    expect(store.get(currentProgressionPresetIdAtom)).toBe(CUSTOM_PRESET_ID);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/store/progressionAtoms.test.ts -t "loadedPresetId clearing"`
Expected: FAIL — the loaded id is not cleared on edits/scale change.

- [ ] **Step 3: Clear the id in each step-mutation atom**

In `src/store/progressionAtoms.ts`, add `set(loadedPresetIdAtom, null);` as the first statement inside the writer of each of these eight atoms: `addProgressionStepAtom`, `removeProgressionStepAtom`, `moveProgressionStepAtom`, `duplicateProgressionStepAtom`, `updateProgressionStepDegreeAtom`, `updateProgressionStepDurationAtom`, `updateProgressionStepQualityAtom`, `updateProgressionStepRootAtom`. Example for `addProgressionStepAtom`:

```ts
export const addProgressionStepAtom = atom(null, (get, set) => {
  set(loadedPresetIdAtom, null);
  const tonic = get(rootNoteAtom);
  // … existing body unchanged …
});
```

Apply the identical one-line insertion to the other seven. Do **not** add it to `remapProgressionStepsForScaleAtom` (that runs as part of a scale change, handled next) or to the loaders.

- [ ] **Step 4: Clear the id on manual scale change**

In `src/store/actions.ts`, update `setScaleNameAtom` to clear the loaded id when the scale actually changes (import `loadedPresetIdAtom` from `../store/progressionAtoms` — check the existing import path used for `remapProgressionStepsForScaleAtom` and reuse it):

```ts
export const setScaleNameAtom = atom(null, (get, set, value: string) => {
  const prevScale = get(scaleNameAtom);
  set(scaleNameAtom, value);
  const newScale = get(scaleNameAtom);
  if (newScale === prevScale) return;
  set(remapProgressionStepsForScaleAtom, newScale);
  set(loadedPresetIdAtom, null);
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/progressionAtoms.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/actions.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progressions): detach loaded preset id on edit and scale change"
```

---

## Task 5: Picker shows all presets; wire suggestion loader; remove dead helpers

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/hooks/useProgressionState.ts`
- Modify: `src/progressions/progressionDomain.ts` (remove dead exports)
- Test: `src/components/SongControls/SongControls.test.tsx`

- [ ] **Step 1: Write/adjust the failing test**

In `src/components/SongControls/SongControls.test.tsx`, replace the `"only lists presets that are available for the selected scale"` test body with a test that all categories surface regardless of scale (keep the keyboard-submenu helper already in the file):

```ts
  it("lists all preset categories regardless of the active scale", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
    ]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Preset" }));
    for (const cat of ["Pop / Rock", "Jazz", "Modal", "Minor"]) {
      expect(screen.getByRole("menuitem", { name: cat })).toBeInTheDocument();
    }
  });
```

- [ ] **Step 2: Run to verify it fails or to capture the baseline**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx -t "all preset categories"`
Expected: depending on the active scale's filter, "Modal"/"Minor" may be missing → FAIL. (If it passes already because all happen to be available in major, proceed — the implementation change still removes the filter.)

- [ ] **Step 3: Expose the suggestion loader in the hook**

In `src/hooks/useProgressionState.ts`: import `loadProgressionSuggestionAtom`, and expose it. Add to the imports list `loadProgressionSuggestionAtom`, then in the returned object add:

```ts
    loadProgressionSuggestion: useSetAtom(loadProgressionSuggestionAtom),
```

- [ ] **Step 4: Update `SongControls.tsx` — build categories from all presets, use the suggestion loader**

(a) Replace the import of `getAvailableProgressionPresets` with `PROGRESSION_PRESETS`:

```ts
import {
  MIN_PROGRESSION_STEP_DURATION_VALUE,
  MAX_PROGRESSION_STEP_DURATION_VALUE,
  MIN_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
  PROGRESSION_PRESETS,
} from "../../progressions/progressionDomain";
```

(b) Replace `const availablePresets = getAvailableProgressionPresets(scaleName);` with:

```ts
  const availablePresets = PROGRESSION_PRESETS;
```

(`groupedPresets` already filters out empty categories, so it still works unchanged.)

(c) Pull `loadProgressionSuggestion` from the hook (add to the destructure of `useProgressionState()`), and update `handlePresetChange` to use it:

```ts
  const handlePresetChange = (id: string) => {
    if (id === CUSTOM_PRESET_ID) return;
    const suggested = suggestedPresets.find((p) => p.id === id);
    if (suggested) {
      startTransition(() => loadProgressionSuggestion(suggested));
      return;
    }
    startTransition(() => loadProgressionPreset(id));
  };
```

(If `loadProgressionSteps` is now unused in this file, remove it from the destructure.)

- [ ] **Step 5: Remove dead helpers from `progressionDomain.ts`**

Grep first: `grep -rn "getAvailableProgressionPresets\|isProgressionPresetAvailableForScale\|createStepsFromPreset\|getProgressionPresetStepsForScale" src` (exclude tests). If a symbol has no remaining non-test caller, delete its definition and any test that only existed to cover it. Expected outcome: `getAvailableProgressionPresets`, `isProgressionPresetAvailableForScale`, `createStepsFromPreset` become removable; `getProgressionPresetStepsForScale` and `remapProgressionStepsForScale`/`remapDegreeByOrdinal` are still used by `remapProgressionStepsForScaleAtom` (manual scale change) — keep those.

- [ ] **Step 6: Run the SongControls + domain tests**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx src/progressions/progressionDomain.test.ts`
Expected: PASS. Update any SongControls test that selected a preset via the old availability-filtered list or asserted the removed "Custom" option behavior; the prior keyboard-nav selection tests for `ii-V-I` still work.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc -b && pnpm run lint`
Expected: exit 0. Remove any now-unused imports flagged by eslint.

- [ ] **Step 8: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/hooks/useProgressionState.ts src/progressions/progressionDomain.ts src/progressions/progressionDomain.test.ts src/components/SongControls/SongControls.test.tsx
git commit -m "feat(progressions): show all presets; load suggestions via tracked-id atom"
```

---

## Task 6: Move the picker into its own card, first in the top row

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/components/SongControls/SongControls.module.css`
- Modify: `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`
- Test: `src/components/SongControls/SongControls.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/SongControls/SongControls.test.tsx`, add:

```ts
  it("renders the Preset in its own card, before Key, with the menu out of the Progression header", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const presetHeading = screen.getByRole("heading", { name: "Preset" });
    const keyHeading = screen.getByRole("heading", { name: "Key" });
    expect(presetHeading).toBeInTheDocument();
    // Preset heading appears before Key heading in document order.
    expect(presetHeading.compareDocumentPosition(keyHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The preset trigger button still exists (now inside the Preset card).
    expect(screen.getByRole("button", { name: "Preset" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx -t "own card"`
Expected: FAIL — there is no "Preset" heading yet (the menu lives in the Progression header).

- [ ] **Step 3: Add i18n strings**

In `src/i18n/types.ts`, inside the inspector strings interface, add (next to `groupKey`):

```ts
    groupPreset: string;
    groupPresetDesc: string;
```

In `src/i18n/en.ts` (next to `groupKey`/`groupKeyDesc`):

```ts
    groupPreset: "Preset",
```
and next to `groupKeyDesc`:
```ts
    groupPresetDesc: "Pick a progression — it sets the key and chords.",
```

In `src/i18n/es.ts` (mirror placement):

```ts
    groupPreset: "Preset",
```
and:
```ts
    groupPresetDesc: "Elige una progresión — define la tonalidad y los acordes.",
```

- [ ] **Step 4: Add the Preset card as the first column and remove the menu from the Progression header**

In `src/components/SongControls/SongControls.tsx`, inside the top `<div className={styles.groupRow}>` (currently first child is the Key `groupColumn`), add a new first column **before** the Key column:

```tsx
        <div className={clsx(styles.groupColumn, styles["groupColumn--preset"])}>
          <InspectorCard
            name={t("inspector.groupPreset")}
            description={t("inspector.groupPresetDesc")}
            labelledById="song-preset-heading"
            locked={editsLocked}
            lockedHint={t("controls.lockedHint")}
          >
            <PresetMenu
              triggerLabel={t("inspector.progressionPreset")}
              customLabel="Custom"
              scaleName={scaleName}
              currentId={currentProgressionPresetId}
              categories={categories}
              suggestionGroups={suggestionGroups}
              disabled={editsLocked}
              onSelect={handlePresetChange}
            />
          </InspectorCard>
        </div>
```

Then delete the `<PresetMenu … />` element (and the surrounding `actions` wiring if it becomes empty) from the Progression `InspectorCard` header `actions` (lines ~268–278). Keep the rest of the toolbar (`toolbar-divider`, Add button, etc.). If `actions` still holds the toolbar, leave it; only the `PresetMenu` element moves.

- [ ] **Step 5: Add the responsive CSS**

In `src/components/SongControls/SongControls.module.css`, after the `.groupColumn` rule, add a narrower basis for the preset column so the three cards balance (Key/Time keep more room):

```css
.groupColumn--preset {
  flex: 1 1 16rem;
}
```

(The existing `.groupRow { flex-wrap: wrap }` already stacks columns on narrow widths; three `flex: 1 1 …` columns lay out across on desktop and wrap on tablet/mobile.)

- [ ] **Step 6: Run the SongControls tests**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx`
Expected: PASS. The `button { name: "Preset" }` queries still resolve (now inside the Preset card). Fix any test that assumed the menu was in the Progression header.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc -b && pnpm run lint`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.module.css src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts src/components/SongControls/SongControls.test.tsx
git commit -m "feat(progressions): move preset picker into its own card first in the row"
```

---

## Task 7: Update the CLAUDE.md invariant

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Note Roles paragraph**

In `CLAUDE.md`, find the sentence in the "Note Roles" section: *"**Scale and chord are independent domains** — do not cross-wire their visibility or color state."* Replace it with:

```text
**Scale and chord rendering are independent domains** — do not cross-wire their visibility or color state. (Loading a progression preset is the one intentional exception that sets the active *scale* — a one-time user action establishing harmonic context — but it does not couple the rendering/color domains.)
```

- [ ] **Step 2: Verify no other doc text contradicts the new behavior**

Run: `grep -n "independent domains" CLAUDE.md`
Expected: only the updated sentence remains; no stale contradicting copy.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: progression load may set the active scale (refine independence invariant)"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full unit/component suite**

Run: `pnpm run test`
Expected: PASS. (If failures appear to be timeouts, re-run in isolation — the machine may have other worktrees running; a clean run should be green.)

- [ ] **Step 2: Lint + build**

Run: `pnpm run lint && pnpm run build`
Expected: both exit 0.

- [ ] **Step 3: Note the visual-snapshot follow-up**

The SongControls layout changed (new Preset card), so darwin Playwright baselines need regeneration via `pnpm run test:visual:update`. Per the project decision this is **deferred to the user** (run when the machine is quiet). Do not run it here. Mention it in the final summary.

- [ ] **Step 4: Confirm clean tree**

Run: `git status`
Expected: clean working tree; all task commits present.

---

## Self-Review Notes

- **Spec coverage:** A/core model → Tasks 2–3. B/data model → Task 2. C/loading → Task 3. D/loaded-id selection → Tasks 3–4. E/picker no-filter → Task 5. F/layout → Task 6. G/manual scale change → Task 4. H/CLAUDE.md → Task 7. I/quality pin → Task 1. Testing → in every task + Task 8.
- **Type consistency:** `ProgressionPreset.scale` (Task 2) is consumed by `loadProgressionPresetAtom` (Task 3) and inherited by `SuggestedPreset` (Task 2). `loadedPresetIdAtom` (Task 3) is written by loaders (Task 3) and mutation/scale atoms (Task 4) and read by `currentProgressionPresetIdAtom` (Task 3). `loadProgressionSuggestionAtom` (Task 3) is exposed by the hook (Task 5) and called in `SongControls` (Task 5). `groupColumn--preset` CSS (Task 6) matches the `clsx` class (Task 6).
- **Ordering:** Task 1 (pin) precedes Task 2 (presets that rely on it). Task 3 (loaders/selection) precedes Task 4 (clearing) and Task 5 (suggestion loader use). Each task ends green; behavior-change tasks update their affected test files in-task.
```
