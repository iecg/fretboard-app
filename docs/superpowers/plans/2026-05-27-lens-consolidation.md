# Lens Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the practice-lens picker control, collapse the two-lens model to always-Lead emphasis behavior, and clean up all collateral state, types, components, and tests.

**Architecture:** Top-down deletion: drop the `PracticeLens` type + `LENS_REGISTRY` in `@fretflow/core`, then cascade the deletions through atoms, components, and tests. The Lead-branch logic in `getLensEmphasis` becomes the single emphasis function (renamed `getEmphasis`). Storage cleanup folds into the existing v2 redesign migration.

**Tech Stack:** TypeScript, Jotai, React, Vitest, Playwright (visual regression).

**Spec:** `docs/superpowers/specs/2026-05-27-lens-consolidation-design.md`

---

## File Structure

```
packages/core/src/
├── theory.ts           # DELETE: PracticeLens, LENS_REGISTRY, LensRegistryEntry,
│                       #          LensAvailabilityContext, "guide-tones" cue kind
└── index.ts            # SWEEP: remove deleted re-exports

src/store/
├── chordOverlayAtoms.ts        # DELETE: practiceLensAtom, practiceLensStorage,
│                               #         PRACTICE_LENS_VALUES
├── practiceLensAtoms.ts        # DELETE: lensAvailabilityContextAtom,
│                               #         lensAvailabilityAtom, guideTonesCuesAtom,
│                               #         GUIDE_TONE_FORMATTED; INLINE: tensionCuesAtom
│                               #         body into practiceCuesAtom
├── actions.ts                  # DELETE: practiceLensAtom RESET line
├── v2RedesignMigration.ts      # ADD: k("practiceLens") to KEYS_TO_RETIRE
└── practiceLens.test.ts        # DELETE: most cases; preserve relevant ones in
                                #         practiceLensAtoms.test.ts (or new home)

src/components/
├── ChordOverlayControls/ChordOverlayControls.tsx
│                       # DELETE: Lens Prop cell, lensOptions, lensAvailability,
│                       #         lensHelp paragraph, auto-exit useEffect,
│                       #         LENS_SHORT_LABELS
├── StatusBar/StatusBar.tsx
│                       # DELETE: lens label readout + LENS_SHORT_LABELS
├── HelpModal/HelpModal.test.tsx
│                       # REPLACE: registry-parity test → absence-of-lens-names test
├── FretboardSVG/utils/semantics.ts
│                       # SIMPLIFY: drop practiceLens param, rename
│                       #          getLensEmphasis → getEmphasis, collapse switch
├── FretboardSVG/hooks/useAnimatedFretboardView.ts
│                       # DELETE: practiceLens argument
└── (test files for each above)

src/hooks/useFretboardTopologyModel.ts
                       # DELETE: practiceLensAtom subscription + downstream argument

CLAUDE.md              # TIGHTEN: "Lens & Note Roles" section to single emphasis model
```

---

### Task 1: Remove `LENS_REGISTRY` and related types from `@fretflow/core`

**Files:**
- Modify: `packages/core/src/theory.ts:147-187` (LensAvailabilityContext, LensRegistryEntry, LENS_REGISTRY)
- Modify: `packages/core/src/theory.ts:189` (PracticeCueKind to drop "guide-tones")
- Modify: `packages/core/src/index.ts` (sweep re-exports)
- Verify: `packages/core/src/theory.ts` for the `PracticeLens` type definition (likely needs deletion too)

- [ ] **Step 1: Locate the `PracticeLens` type definition**

Run: `grep -n "^export type PracticeLens\|PracticeLens =" packages/core/src/theory.ts`
Expected output: one line declaring `export type PracticeLens = "tones" | "lead"` (or similar).

- [ ] **Step 2: Delete `PracticeLens` type**

Open `packages/core/src/theory.ts` and remove the line declaring `export type PracticeLens` plus any surrounding JSDoc.

- [ ] **Step 3: Delete `LensAvailabilityContext` interface**

In `packages/core/src/theory.ts`, remove lines 147-156 (the entire `LensAvailabilityContext` interface):
```ts
// Context for lens availability predicates
export interface LensAvailabilityContext {
  hasChordOverlay: boolean;
  /** Chord definition includes a 3rd or 7th member. */
  hasGuideTones: boolean;
  /** Scale has characteristic/divergent color notes. */
  hasColorNotes: boolean;
  /** At least one active chord tone falls outside the scale. */
  hasOutsideTones: boolean;
}
```

- [ ] **Step 4: Delete `LensRegistryEntry` interface**

In `packages/core/src/theory.ts`, remove lines 158-168 (the `LensRegistryEntry` interface):
```ts
// Practice lens registry entry
export interface LensRegistryEntry {
  id: PracticeLens;
  label: string;
  description: string;
  isAvailable: (ctx: LensAvailabilityContext) => boolean;
  /** Returns a human-readable reason when the lens is unavailable, or null. */
  unavailableReason: (ctx: LensAvailabilityContext) => string | null;
  /** When true, hide this lens from the picker instead of showing it disabled. */
  hideWhenUnavailable?: boolean;
}
```

- [ ] **Step 5: Delete `LENS_REGISTRY` constant**

In `packages/core/src/theory.ts`, remove lines 170-187:
```ts
export const LENS_REGISTRY: readonly LensRegistryEntry[] = [
  {
    id: "tones",
    label: "Tones",
    description: "Shows chord tones with guide-tone (3rd/7th) emphasis",
    isAvailable: (ctx) => ctx.hasChordOverlay,
    unavailableReason: (ctx) =>
      ctx.hasChordOverlay ? null : "Requires an active chord overlay",
  },
  {
    id: "lead",
    label: "Lead",
    description: "Highlights common tones with the next chord and anticipates upcoming guide tones",
    isAvailable: (ctx) => ctx.hasChordOverlay,
    unavailableReason: (ctx) =>
      ctx.hasChordOverlay ? null : "Requires an active chord overlay",
  },
];
```

- [ ] **Step 6: Shrink `PracticeCueKind` to remove `"guide-tones"`**

In `packages/core/src/theory.ts` line 189, replace:
```ts
export type PracticeCueKind = "land-on" | "guide-tones" | "color-note" | "tension";
```
with:
```ts
export type PracticeCueKind = "land-on" | "color-note" | "tension";
```

- [ ] **Step 7: Update `packages/core/src/index.ts` re-exports**

Run: `grep -n "PracticeLens\|LENS_REGISTRY\|LensRegistryEntry\|LensAvailabilityContext" packages/core/src/index.ts`

For each line that re-exports one of these names, delete that name from the export list. If a re-export becomes empty, delete the entire line.

- [ ] **Step 8: Typecheck the core package**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: errors at the consumer sites in `src/store/`, `src/components/`, `src/hooks/` referencing the deleted exports. These will be cleared in Tasks 2-7.

DO NOT commit yet — the working tree is in a broken intermediate state. Commits happen at the end of each downstream task once the cascading deletions are in place.

---

### Task 2: Delete `practiceLensAtom` and storage glue from `chordOverlayAtoms.ts`

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts:83` (PRACTICE_LENS_VALUES), `:95-110` (practiceLensStorage), `:686-687` (practiceLensAtom), import lines

- [ ] **Step 1: Locate exact line ranges**

Run: `grep -n "PRACTICE_LENS_VALUES\|practiceLensStorage\|practiceLensAtom\b" src/store/chordOverlayAtoms.ts`

- [ ] **Step 2: Remove `PRACTICE_LENS_VALUES` constant**

Open `src/store/chordOverlayAtoms.ts` and delete the `const PRACTICE_LENS_VALUES = LENS_REGISTRY.map(...)` line.

- [ ] **Step 3: Remove `practiceLensStorage` factory**

Delete the entire `const practiceLensStorage = createStorage<PracticeLens>({...})` block, including its surrounding JSDoc.

- [ ] **Step 4: Remove `practiceLensAtom` export**

Delete the entire `export const practiceLensAtom = atomWithStorage<PracticeLens>(k("practiceLens"), ...)` declaration, including its surrounding JSDoc.

- [ ] **Step 5: Update imports**

At the top of `src/store/chordOverlayAtoms.ts`, remove `LENS_REGISTRY` from the `@fretflow/core` import line. Remove `PracticeLens` from the type imports. Remove any imports that were only used by the now-deleted code (e.g. `createStorage` if no longer referenced).

- [ ] **Step 6: Verify file compiles in isolation**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep "chordOverlayAtoms"`
Expected: no errors specific to this file. (Errors at other call sites are fine — they'll be cleared in subsequent tasks.)

---

### Task 3: Simplify `practiceLensAtoms.ts` to always-Lead behavior

**Files:**
- Modify: `src/store/practiceLensAtoms.ts:103-104` (GUIDE_TONE_FORMATTED), `:160-181` (guideTonesCuesAtom), `:183-209` (tensionCuesAtom), `:337-347` (practiceCuesAtom switch), `:353-378` (lensAvailability* atoms), imports

- [ ] **Step 1: Delete `GUIDE_TONE_FORMATTED` set**

In `src/store/practiceLensAtoms.ts`, remove line 104:
```ts
const GUIDE_TONE_FORMATTED = new Set(["♭3", "3", "♭7", "7"]);
```

Keep `GUIDE_TONE_RAW` on line 103 — it's still referenced by `noteSemanticMapAtom`.

- [ ] **Step 2: Delete `guideTonesCuesAtom`**

Remove the entire `const guideTonesCuesAtom = atom((get) => {...})` block (lines 160-181). It's the only consumer of `GUIDE_TONE_FORMATTED`.

- [ ] **Step 3: Rename `tensionCuesAtom` to `practiceCuesAtom` body**

The current `practiceCuesAtom` is a switch dispatcher. Replace it (lines 337-347) and the old `tensionCuesAtom` (lines 183-209) with a single new `practiceCuesAtom`:

Delete the current `const tensionCuesAtom = atom((get) => {...})` block (lines 183-209).

Delete the current `export const practiceCuesAtom = atom((get) => {...})` block (lines 337-347).

Add the new `practiceCuesAtom` at the location where the old `practiceCuesAtom` was (preserving its JSDoc location near the comment block at lines 325-336):

```ts
/**
 * Derives the ordered coaching cues rendered in the practice bar.
 *
 * Inputs (read via `get`): chord root/type, scale name, and the chord-row
 * catalog. Emits "Land on" + "Tension" cues (chord notes that fall outside
 * the active scale, with nearest-in-scale resolution targets).
 *
 * Output: `PracticeCue[]` ordered for left-to-right display. Returns `[]`
 * when no chord is active.
 *
 * See the "Note Roles" section in `CLAUDE.md` for how cues compose with the
 * base note-role model.
 */
export const practiceCuesAtom = atom((get) => {
  const base = get(cueBaseInputsAtom);
  if (!base) return [] as PracticeCue[];
  const { allChordMembers, chordRoot, preferFlats, scaleNotes } = base;

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, preferFlats));

  const cues: PracticeCue[] = [];
  if (allChordMembers.length > 0) {
    cues.push(buildLandOnCue(allChordMembers));
  }
  const tensionMembers = allChordMembers.filter((e) => !e.inScale);
  if (tensionMembers.length > 0) {
    const tensionNotes = tensionMembers.map((e) => ({
      ...toCueNote(e),
      role: "chord-tone-outside-scale" as const,
      resolvesTo: findNearestScaleResolution(e.internalNote, scaleNotes, displayNote),
    }));
    cues.push({
      kind: "tension",
      label: "Tension",
      notes: tensionNotes,
    });
  }
  return cues;
});
```

- [ ] **Step 4: Delete `lensAvailabilityContextAtom`**

Remove the entire `export const lensAvailabilityContextAtom = atom((get): LensAvailabilityContext => {...})` block (lines 353-364).

- [ ] **Step 5: Delete `lensAvailabilityAtom`**

Remove the entire `export const lensAvailabilityAtom = atom((get) => {...})` block (lines 369-378).

- [ ] **Step 6: Clean up imports**

At the top of `src/store/practiceLensAtoms.ts`:
- Remove `LENS_REGISTRY` from the value imports.
- Remove `LensAvailabilityContext` from the type imports.
- Remove `practiceLensAtom` from the `./chordOverlayAtoms` import (it's deleted in Task 2).

The full updated import block should look like:
```ts
import { atom } from "jotai";
import {
  NOTES,
  ENHARMONICS,
  INTERVAL_NAMES,
  CHORD_DEFINITIONS,
  getNoteDisplay,
  formatAccidental,
  getDiatonicChord,
  getChordNotes,
} from "@fretflow/core";
import type {
  ChordMemberName,
  NoteSemantics,
  PracticeCue,
  PracticeCueNote,
  ChordRowEntry,
} from "@fretflow/core";
import { type DegreeId } from "@fretflow/core";
import {
  scaleContextAtom,
  colorNotesAtom,
  preferFlatsAtom,
} from "./scaleAtoms";
import {
  chordLookupAtom,
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  fullChordsEnabledAtom,
} from "./chordOverlayAtoms";
import { activeChordCachedDegreeAtom } from "./songStateAtoms";
import {
  resolvedProgressionStepsAtom,
  displayedProgressionStepIndexAtom,
  activeResolvedProgressionStepAtom,
  progressionTempoBpmAtom,
  progressionStepDeadlineAtom,
  beatsPerBarAtom,
  progressionLoopEnabledAtom,
} from "./progressionAtoms";
import {
  getProgressionDurationBeats,
  MIN_PROGRESSION_TEMPO_BPM,
} from "../progressions/progressionDomain";
import {
  hasOutsideChordMembersAtom,
  allChordMembersAtom,
} from "./composableSelectors";
```

Note: `hasOutsideChordMembersAtom` was previously consumed only by `lensAvailabilityContextAtom`. If `grep "hasOutsideChordMembersAtom" src/` shows zero remaining consumers, also remove this import. (Verification step in Task 9.)

- [ ] **Step 7: Verify file compiles**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep "practiceLensAtoms"`
Expected: no errors in this file.

---

### Task 4: Remove `practiceLensAtom` from `actions.ts`

**Files:**
- Modify: `src/store/actions.ts:14, :92`

- [ ] **Step 1: Locate references**

Run: `grep -n "practiceLensAtom" src/store/actions.ts`
Expected output:
```
14:  practiceLensAtom,
92:  set(practiceLensAtom, RESET);
```

- [ ] **Step 2: Remove the import**

In `src/store/actions.ts` line 14, delete the `practiceLensAtom,` entry from the import list.

- [ ] **Step 3: Remove the reset call**

In `src/store/actions.ts` line 92, delete the line:
```ts
  set(practiceLensAtom, RESET);
```

- [ ] **Step 4: Verify file compiles**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep "actions.ts"`
Expected: no errors in this file.

---

### Task 5: Extend v2 redesign migration to retire `k("practiceLens")`

**Files:**
- Modify: `src/store/v2RedesignMigration.ts:52-60` (KEYS_TO_RETIRE), JSDoc at top
- Test: `src/store/v2RedesignMigration.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/store/v2RedesignMigration.test.ts` and add a new test case inside the existing `describe` block:

```ts
it("retires the practiceLens key", () => {
  localStorage.setItem("fretflow:practiceLens", JSON.stringify("tones"));
  runV2RedesignMigration();
  expect(localStorage.getItem("fretflow:practiceLens")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/v2RedesignMigration.test.ts -t "retires the practiceLens key"`
Expected: FAIL — the key is not in `KEYS_TO_RETIRE`, so it survives the migration.

- [ ] **Step 3: Add `k("practiceLens")` to `KEYS_TO_RETIRE`**

In `src/store/v2RedesignMigration.ts`, locate the `KEYS_TO_RETIRE` array and append the new key:

```ts
const KEYS_TO_RETIRE = [
  k("region"),
  k("chordFretSpread"),
  k("voicingType"),
  k("voicingInversion"),
  k("voicingStringSet"),
  k("voicingConnectors"),
  k("voicingSectionExpanded"),
  k("practiceLens"),
];
```

- [ ] **Step 4: Update the JSDoc**

In `src/store/v2RedesignMigration.ts`, update the "Retired keys" comment block to include the new entry:

```ts
 * Retired keys:
 *   - region                 (regionAtom)
 *   - chordFretSpread        (chordFretSpreadAtom)
 *   - voicingType            (voicingTypeAtom)
 *   - voicingInversion       (voicingInversionAtom)
 *   - voicingStringSet       (voicingStringSetAtom)
 *   - voicingConnectors      (voicingConnectorsAtom)
 *   - voicingSectionExpanded (voicingSectionExpandedAtom)
 *   - practiceLens           (practiceLensAtom — Lens Consolidation)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/store/v2RedesignMigration.test.ts -t "retires the practiceLens key"`
Expected: PASS.

- [ ] **Step 6: Run the full migration test file**

Run: `pnpm vitest run src/store/v2RedesignMigration.test.ts`
Expected: all tests pass (no regression).

---

### Task 6: Simplify `getLensEmphasis` → `getEmphasis` in `semantics.ts`

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:66-137`
- Test: `src/components/FretboardSVG/utils/semantics.test.ts` (if exists; otherwise create later)

- [ ] **Step 1: Locate the current signature**

Run: `grep -n "getLensEmphasis\b" src/components/FretboardSVG/utils/semantics.ts`
Expected output: lines around 66 (declaration) and consumers in two hook files.

- [ ] **Step 2: Replace `getLensEmphasis` with simplified `getEmphasis`**

In `src/components/FretboardSVG/utils/semantics.ts`, replace lines 66-137 (the entire `getLensEmphasis` function) with:

```ts
export function getEmphasis(
  noteClass: string,
  isGuideTone: boolean,
  leadContext?: LeadLensContext,
): LensEmphasis {
  // Voice-leading emphasis based on how the current note relates to the
  // upcoming chord change. Priority order (highest → lowest):
  //   1. Anticipation — next chord's guide tone in the last beat window
  //      (fires even on notes not in the current chord)
  //   2. Hold — current chord tone that carries into the next chord
  //   3. Departing — current chord tone that resolves away on the change
  //   4. Tones base — guide-tone glow + scale-only dim
  //
  // When leadContext is not provided (e.g. no active progression),
  // fall back to tones-base behavior so visuals still render meaningfully.
  if (!leadContext) {
    return applyTonesBase(noteClass, isGuideTone);
  }

  const {
    notePc,
    commonWithNext,
    nextGuideTones,
    beatPosition,
    stepDurationBeats,
  } = leadContext;

  const isCurrentChordTone = CHORD_TONE_CLASSES.has(noteClass);

  // 1. Anticipation: next chord's guide tone in the last-beat window.
  //    Applies regardless of current-chord membership.
  if (
    stepDurationBeats > 0 &&
    beatPosition >= stepDurationBeats - 1 &&
    nextGuideTones.has(notePc)
  ) {
    return { glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 };
  }

  // 2. Hold: current chord tone that persists into the next chord.
  if (isCurrentChordTone && commonWithNext.has(notePc)) {
    return { glowColor: "cyan", radiusBoost: 1.2, opacityBoost: 1 };
  }

  // 3. Departing: current chord tone that doesn't carry into the next chord.
  if (isCurrentChordTone && !commonWithNext.has(notePc)) {
    return { radiusBoost: 0.85, opacityBoost: 0.6 };
  }

  // 4. Tones base.
  return applyTonesBase(noteClass, isGuideTone);
}
```

Note: `glowColor: "orange"` and `glowColor: "cyan"` are kept literal here; the Theming plan replaces them with CSS-var references (`var(--note-glow-anticipation)`, `var(--note-glow-hold)`).

- [ ] **Step 3: Remove the `PracticeLens` type import from this file**

At the top of `src/components/FretboardSVG/utils/semantics.ts`, remove `PracticeLens` from the import list. Keep `LeadLensContext`, `LensEmphasis`, and any other still-used imports.

- [ ] **Step 4: Verify file compiles**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep "semantics.ts"`
Expected: no errors in `utils/semantics.ts` itself; call-site errors at `useAnimatedFretboardView.ts` and `useFretboardTopologyModel.ts` are expected (cleared in next task).

---

### Task 7: Update `getEmphasis` consumers (hooks)

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Modify: `src/hooks/useFretboardTopologyModel.ts`

- [ ] **Step 1: Locate call sites**

Run: `grep -n "getLensEmphasis\|getEmphasis\|practiceLensAtom\|practiceLens" src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts src/hooks/useFretboardTopologyModel.ts`

- [ ] **Step 2: Update `useAnimatedFretboardView.ts`**

Replace any `getLensEmphasis(noteClass, practiceLens, isGuideTone, leadContext)` calls with `getEmphasis(noteClass, isGuideTone, leadContext)`. Remove the `practiceLens` parameter from the function signature and any prop pipelines that fed it through.

The specific edits depend on the current call structure. Typical pattern:

```ts
// before
import { getLensEmphasis } from "../utils/semantics";
// ...
const emphasis = getLensEmphasis(noteClass, practiceLens, isGuideTone, leadCtx);

// after
import { getEmphasis } from "../utils/semantics";
// ...
const emphasis = getEmphasis(noteClass, isGuideTone, leadCtx);
```

- [ ] **Step 3: Update `useFretboardTopologyModel.ts`**

Remove the `useAtomValue(practiceLensAtom)` subscription. Remove `practiceLens` from any downstream calls or prop pipelines. Remove the `practiceLensAtom` import.

Typical pattern:

```ts
// before
import { practiceLensAtom } from "../store/chordOverlayAtoms";
// ...
const practiceLens = useAtomValue(practiceLensAtom);
// ... downstream usage that needs to be removed ...

// after
// (no practiceLens reference at all)
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: zero errors related to lens / PracticeLens / getLensEmphasis / LENS_REGISTRY. If errors remain, address them inline (likely additional consumers in the hooks).

- [ ] **Step 5: Sweep for any remaining references**

Run: `grep -rn "practiceLensAtom\|getLensEmphasis\|LENS_REGISTRY\|LensAvailabilityContext\|LensRegistryEntry\|guideTonesCuesAtom\|lensAvailabilityAtom\|lensAvailabilityContextAtom" src/ packages/core/src/ 2>/dev/null | grep -v ".test."`

Expected: zero non-test results. Any remaining references must be removed.

---

### Task 8: Remove lens picker from `ChordOverlayControls`

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx` (entire file)
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test for absence**

Open `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` and add (or update existing test to assert):

```ts
it("does not render a Lens control", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    // minimal atom setup with an active chord
  });
  expect(screen.queryByRole("group", { name: /lens/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/Tones/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Lead/i)).not.toBeInTheDocument();
});
```

(Adapt the atom-setup boilerplate to match the file's existing `renderWithAtoms` usage.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx -t "does not render a Lens control"`
Expected: FAIL — current component still renders the Lens toggle.

- [ ] **Step 3: Rewrite `ChordOverlayControls.tsx`**

Replace the entire file content with:

```tsx
import { useAtomValue } from "jotai";
import {
  chordTypeAtom,
  voicingAtom,
} from "../../store/chordOverlayAtoms";
import { hasFallbackPositionsAtom } from "../../store/voicingFallbackAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { VoicingControl } from "./VoicingControl";
import { ChordStringSetPicker } from "./ChordStringSetPicker";
import panelStyles from "./ChordOverlayControls.module.css";

export function ChordOverlayControls() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const voicing = useAtomValue(voicingAtom);
  const hasFallback = useAtomValue(hasFallbackPositionsAtom);

  const hasActiveChord = Boolean(chordType);

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={12} className={panelStyles.grid}>
        <Prop label={t("inspector.voicingLabel")} span={3}>
          <VoicingControl />
        </Prop>
        {(voicing === "close" || (voicing === "full" && hasFallback)) && hasActiveChord ? (
          <Prop label={t("inspector.chordStringSetLabel")} span={2}>
            <ChordStringSetPicker />
          </Prop>
        ) : null}
      </PropGrid>
    </div>
  );
}
```

Note: the picker render gate keeps the current `voicing === "full" && hasFallback` branch — that branch is removed by Plan 3 (Chord Voicings Card UX). This plan only removes Lens, nothing else.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx -t "does not render a Lens control"`
Expected: PASS.

- [ ] **Step 5: Update existing test cases**

Open `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` and remove any test cases that asserted Lens-toggle presence, lens options, or lens auto-exit behavior. Common patterns to delete:
- `it("renders the lens toggle with all options", ...)`
- `it("disables unavailable lenses", ...)`
- `it("auto-exits unavailable lenses to tones", ...)`

- [ ] **Step 6: Run full test file**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: all remaining tests pass.

---

### Task 9: Remove lens label from `StatusBar`

**Files:**
- Modify: `src/components/StatusBar/StatusBar.tsx` (lens label readout + LENS_SHORT_LABELS)
- Test: `src/components/StatusBar/StatusBar.test.tsx`

- [ ] **Step 1: Write the failing test for absence**

Open `src/components/StatusBar/StatusBar.test.tsx` and add (or update existing test to assert):

```ts
it("does not render a lens label", () => {
  renderWithAtoms(<StatusBar />, {
    // minimal atom setup with an active chord
  });
  expect(screen.queryByText(/Tones/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Lead/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/StatusBar/StatusBar.test.tsx -t "does not render a lens label"`
Expected: FAIL.

- [ ] **Step 3: Remove lens label from `StatusBar.tsx`**

In `src/components/StatusBar/StatusBar.tsx`:
- Remove the `LENS_SHORT_LABELS` constant.
- Remove the `useAtomValue(practiceLensAtom)` line.
- Remove the JSX element/chip that renders the lens label.
- Remove `practiceLensAtom` and `LENS_REGISTRY` from the imports.

Exact lines depend on the current file structure. Use:

Run: `grep -n "LENS_SHORT_LABELS\|practiceLensAtom\|LENS_REGISTRY\|lens" src/components/StatusBar/StatusBar.tsx`

to locate. Delete each reference in order.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/StatusBar/StatusBar.test.tsx -t "does not render a lens label"`
Expected: PASS.

- [ ] **Step 5: Update existing test cases**

Remove any existing `StatusBar.test.tsx` cases that asserted lens-label presence or styling.

- [ ] **Step 6: Run full test file**

Run: `pnpm vitest run src/components/StatusBar/StatusBar.test.tsx`
Expected: all tests pass.

---

### Task 10: Rewrite `HelpModal` lens-registry parity test

**Files:**
- Modify: `src/components/HelpModal/HelpModal.test.tsx`

- [ ] **Step 1: Locate the existing test**

Run: `grep -n "LENS_REGISTRY\|lens names" src/components/HelpModal/HelpModal.test.tsx`

- [ ] **Step 2: Delete the registry-parity test**

Remove the entire `it("lists current lens names matching LENS_REGISTRY labels", ...)` test block.

- [ ] **Step 3: Add an absence-of-lens-names regression-guard test**

In its place add:

```ts
it("does not mention 'Tones' or 'Lead' as lens names", () => {
  renderWithAtoms(<HelpModal isOpen={true} onClose={() => {}} />);
  // Lens picker was removed; help text should not mention the old lens names.
  expect(screen.queryByText(/Tones lens/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Lead lens/i)).not.toBeInTheDocument();
});
```

(If the HelpModal copy still mentions "tones" / "lead" in other contexts that aren't about the lens picker, scope the assertion more tightly — e.g. assert absence in a specific section. The implementer adjusts based on actual modal content.)

- [ ] **Step 4: Remove `LENS_REGISTRY` import from test file**

If the test file imported `LENS_REGISTRY` only for the deleted test, remove the import.

- [ ] **Step 5: Run the test file**

Run: `pnpm vitest run src/components/HelpModal/HelpModal.test.tsx`
Expected: all tests pass.

- [ ] **Step 6: Sweep `HelpModal.tsx` for lens copy**

Run: `grep -in "tones\|lead" src/components/HelpModal/HelpModal.tsx`

Remove any user-facing copy that describes the lens picker, the "Tones lens", or the "Lead lens". (The copy may still mention "lead playing" or "chord tones" in other contexts — only remove references to the picker itself.)

If you remove any copy, run the test file again to confirm it still passes.

---

### Task 11: Delete or migrate `practiceLens.test.ts`

**Files:**
- Delete: `src/store/practiceLens.test.ts` (if all cases were lens-specific)
- OR: migrate non-lens cases to `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Audit the file's test cases**

Open `src/store/practiceLens.test.ts` and read every `describe` / `it` block. Categorize each:
- **Lens-specific** (LENS_REGISTRY, lensAvailability, guideTonesCuesAtom, practiceLensAtom): DELETE.
- **Non-lens** (e.g. tests of `practiceCuesAtom` tension branch, `noteSemanticMapAtom`, `nextChordGuideTonesAtom`): MIGRATE to `practiceLensAtoms.test.ts` (or `chordOverlayAtoms.test.ts` if more appropriate).

- [ ] **Step 2: Migrate non-lens cases (if any)**

For each non-lens case identified in Step 1, copy the `describe`/`it` block into the appropriate target test file (creating the file if it doesn't exist). Update imports to point to the canonical atom locations.

- [ ] **Step 3: Delete `practiceLens.test.ts`**

Run: `rm src/store/practiceLens.test.ts`

- [ ] **Step 4: Run the broader test suite for the store**

Run: `pnpm vitest run src/store/`
Expected: all tests pass; no missing-coverage gaps from the migration.

---

### Task 12: Update `CLAUDE.md` lens documentation

**Files:**
- Modify: `CLAUDE.md` (Lens & Note Roles section)

- [ ] **Step 1: Locate the section**

Run: `grep -n "Lens & Note Roles\|lens" CLAUDE.md`

- [ ] **Step 2: Tighten the section copy**

In `CLAUDE.md`, find the "Lens & Note Roles" subsection (under `## Lens & Note Roles` or similar). Replace any text that names the two lenses with a single-emphasis description.

Replace:
```
Notes carry a semantic role (...). **Lenses** (registered in `src/store/practiceLensAtoms.ts` + `chordOverlayAtoms.ts`) compose emphasis rules (colors, squircles, tension cues) on top of that base model.
```
with:
```
Notes carry a semantic role (...). The **emphasis layer** in `src/components/FretboardSVG/utils/semantics.ts#getEmphasis` adds voice-leading cues (anticipation, hold, departing) when a progression is active, falling back to guide-tone emphasis when there's no progression.
```

Adjust phrasing to match the surrounding text.

- [ ] **Step 3: Verify the section renders**

Run: `grep -A 4 "Lens & Note Roles" CLAUDE.md` (or rename the section title to "Note Roles" if "Lens" no longer applies).

---

### Task 13: Final verification + commit

- [ ] **Step 1: Full typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 5: Sweep for any remaining lens references**

Run: `grep -rn "practiceLensAtom\|getLensEmphasis\|LENS_REGISTRY\|LensAvailabilityContext\|LensRegistryEntry\|guideTonesCuesAtom\|lensAvailabilityAtom\|lensAvailabilityContextAtom\|GUIDE_TONE_FORMATTED" src/ packages/core/src/`

Expected: zero results.

- [ ] **Step 6: Stage and commit production code**

```bash
git add packages/core/src/theory.ts packages/core/src/index.ts \
        src/store/chordOverlayAtoms.ts src/store/practiceLensAtoms.ts \
        src/store/actions.ts src/store/v2RedesignMigration.ts \
        src/store/v2RedesignMigration.test.ts \
        src/components/ChordOverlayControls/ChordOverlayControls.tsx \
        src/components/ChordOverlayControls/ChordOverlayControls.test.tsx \
        src/components/StatusBar/StatusBar.tsx \
        src/components/StatusBar/StatusBar.test.tsx \
        src/components/HelpModal/HelpModal.tsx \
        src/components/HelpModal/HelpModal.test.tsx \
        src/components/FretboardSVG/utils/semantics.ts \
        src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts \
        src/hooks/useFretboardTopologyModel.ts \
        CLAUDE.md
git rm src/store/practiceLens.test.ts
git commit -m "$(cat <<'EOF'
refactor(lens): consolidate two lenses into always-Lead emphasis

Removes the practice-lens picker entirely. The Lead-branch logic
(anticipation, hold, departing, tones-base fallback) becomes the single
emphasis function (getLensEmphasis → getEmphasis). Practice bar keeps
"Land on" + "Tension" cues.

- packages/core/src/theory.ts: delete PracticeLens, LENS_REGISTRY,
  LensRegistryEntry, LensAvailabilityContext; shrink PracticeCueKind to
  drop "guide-tones".
- src/store/chordOverlayAtoms.ts: delete practiceLensAtom + storage glue.
- src/store/practiceLensAtoms.ts: delete lensAvailability* atoms +
  guideTonesCuesAtom; inline tension logic into practiceCuesAtom.
- src/components: drop Lens picker from ChordOverlayControls, lens chip
  from StatusBar, lens registry parity test from HelpModal.
- src/store/actions.ts: drop practiceLensAtom RESET.
- src/store/v2RedesignMigration.ts: retire k("practiceLens").
- CLAUDE.md: tighten Lens & Note Roles section to single emphasis model.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Visual regression baseline refresh

- [ ] **Step 1: Refresh darwin baselines**

Run: `pnpm test:visual:update`
Expected: snapshots in `e2e/app-overlays`, `e2e/app-components/StatusBar`, and the chord-voicings-card visual specs update to reflect the removed Lens chip/cell. No failures.

- [ ] **Step 2: Inspect the diff**

Run: `git diff --stat e2e/`
Expected: a non-zero number of `.png` files changed. Spot-check one or two to confirm the Lens chip is gone from StatusBar and the Lens row is gone from ChordOverlayControls.

- [ ] **Step 3: Commit snapshot updates**

```bash
git add e2e/
git commit -m "$(cat <<'EOF'
test(visual): refresh darwin baselines for lens consolidation

Lens chip removed from StatusBar; lens row removed from
ChordOverlayControls; help paragraph removed. Linux baselines auto-rebuild
on next CI run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Manual smoke verification

No file changes; no commit.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Verify the Lens control is absent**

In the running app:
1. Open the Overlay tab. Confirm the Chord/Voicing card row has only Voicing (and String set when in close mode). No Lens toggle anywhere.
2. Check the Status Bar at the bottom. Confirm no "Tones" / "Lead" chip.
3. Open the Help modal (? button). Confirm no lens-related copy.

- [ ] **Step 3: Verify emphasis behavior still works**

1. Set up a 4-bar progression in 4/4 at 120 BPM (e.g. C - Am - F - G).
2. Press Play. During the last beat of each step, confirm: notes that are the next chord's guide tones (3rd/7th of the upcoming chord) get a visible glow (orange) — anticipation.
3. Notes that are chord tones in BOTH the current and next chords stay solid (cyan glow) — hold.
4. Notes that are current-chord-only fade slightly as the next chord approaches — departing.

If any of these are absent or visually wrong, the emphasis function was likely broken during refactor — re-check Task 6.

---

## Verification summary

After completing all tasks:

```bash
pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production
```
Expected: all green.

```bash
git log --oneline -3
```
Expected: 2 commits from this plan (lens consolidation refactor, visual baseline refresh) at the top.

---

## Self-review notes

- **Spec coverage:**
  - B1 (Remove lens picker UI): Tasks 8, 9.
  - B2 (Collapse lens model to always-Lead): Tasks 1-4.
  - B3 (Simplify getLensEmphasis): Tasks 6-7.
  - B4 (Storage cleanup): Task 5.
  - B5 (Help/docs): Tasks 10, 12.
  - Tests section: Tasks 5, 8, 9, 10, 11; broader sweep in Task 13.
- **Placeholder scan:** No TODO / TBD steps. Test bodies that depend on existing `renderWithAtoms` helpers note this explicitly with "Adapt the atom-setup boilerplate" — that's a deliberate flag for the implementer, not a placeholder for missing logic.
- **Type consistency:** `getLensEmphasis` → `getEmphasis` rename applied consistently across Tasks 6-7. `PracticeCueKind` shrink in Task 1 doesn't affect the now-inlined tension-only `practiceCuesAtom` in Task 3 (tension cue still uses `kind: "tension"`).
- **Sequencing:** Tasks 1-7 leave the working tree in a broken state until Task 7 completes. Task 13 is the first place where all tests + typecheck must pass together. This is intentional — early commits would force partial-broken builds.
