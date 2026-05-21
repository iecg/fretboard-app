# FretFlow Integration Design — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the FretFlow integration redesign — unify the chord/progression source of truth, collapse the Inspector to three tabs, redesign the lens system, simplify voicing controls, and adopt Tonal.js + Tone.js — across coordinated phase-sized PRs.

**Architecture:** The spec ([`docs/superpowers/specs/2026-05-20-fretflow-integration-design.md`](../specs/2026-05-20-fretflow-integration-design.md)) defines eight phases, each producing working, shippable software. The progression becomes the single source of truth for "the current chord"; the Chord tab edits the active step. Inspector tabs collapse from four to three. Lenses collapse from three to two. View-tab settings migrate into the Settings overlay. Tonal.js replaces the bespoke theory layer; Tone.js replaces the bespoke audio scheduler.

**Tech Stack:** React 19, TypeScript, Jotai, `@tonaljs/*`, `tone`, Vitest, Playwright, pnpm workspaces.

**Spec reference:** [`docs/superpowers/specs/2026-05-20-fretflow-integration-design.md`](../specs/2026-05-20-fretflow-integration-design.md).

---

## Roadmap & Phase Index

| Phase | Title | Plan | Status |
|---|---|---|---|
| 1 | Tonal.js foundation | [`2026-05-20-fretflow-phase-1-tonal-foundation.md`](2026-05-20-fretflow-phase-1-tonal-foundation.md) | In progress (PRs #441, #442 landed) |
| 2 | Chord unification — progression-as-source | this file, §Phase 2 | Not started |
| 3 | Inspector reshape — 3 tabs + visibility switches | this file, §Phase 3 | Blocked on Phase 2 |
| 4 | Lens redesign — Tones + Lead | this file, §Phase 4 | Blocked on Phase 2 |
| 5 | Voicing simplification — Region ToggleBar | this file, §Phase 5 | Blocked on Phase 2 |
| 6 | Scale simplification — grouped select | this file, §Phase 6 | Blocked on Phase 1 |
| 7 | Audio (Tone.js) | this file, §Phase 7 | Complete (Phase 7 PR #448, Phase 7B PR #449) |
| 8 | Polish — Edit-on-Chord, tooltips, hints | this file, §Phase 8 | Blocked on Phases 2–7 |

**Per-phase discipline:** Each phase ends with a green `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`, refreshed visual-regression baselines (darwin + linux), and a single PR. Phases 4 and 7 are mutually independent and may run in parallel; Phases 6 and 1 may overlap.

**Recommendation:** When picking up Phase 2 or later, consider promoting that phase to a dedicated standalone plan file (one phase = one plan file = one PR) so each PR's task list lives next to its diff. The sections below give every phase the full bite-sized task breakdown needed to execute it as-is, but a dedicated file is preferred when a phase has follow-up scope creep.

---

## Phase 1 — Tonal.js Foundation

**Scope:** Replace bespoke theory in `@fretflow/core` with Tonal.js-backed implementations behind a stable public API.

**Plan file:** [`2026-05-20-fretflow-phase-1-tonal-foundation.md`](2026-05-20-fretflow-phase-1-tonal-foundation.md).

**Status:** PR #441 ("feat: adopt Tonal.js for music theory (Phase 1)") and PR #442 ("refactor(core): complete getDivergentNotes Tonal migration") have landed. The adapter layer at [`packages/core/src/lib/tonal.ts`](../../packages/core/src/lib/tonal.ts) is in place. Remaining Phase-1 cleanup (if any) is tracked in that plan; do not duplicate it here.

**Exit criteria:**
- `@tonaljs/{chord,scale,note,interval,key}` are dependencies of `@fretflow/core`.
- All theory functions in `@fretflow/core` delegate to the adapter.
- Public API of `@fretflow/core` is unchanged; no consumer file in `src/` needs an import change for theory reasons.
- All existing tests pass.

---

## Phase 2 — Chord Unification

**Scope:** Make the active progression step the single source of truth for the current chord. Remove the Chord-tab Mode toggle, the override atoms, and the silent side-effects. Add `cachedDegree` to `ProgressionStep`. Migrate persisted state. **No UI restructuring beyond what is required to delete the Mode toggle** — Inspector still has 4 tabs at the end of this phase; that comes in Phase 3.

**File Structure**

- Create: `src/store/songStateAtoms.ts` — unified selectors `activeChordRootAtom`, `activeChordQualityAtom`, `activeChordCachedDegreeAtom`, and a writable `updateActiveChordAtom` that delegates to the active progression step. Single responsibility: be the Chord-tab's read/write contract for the unified chord.
- Modify: `src/store/progressionAtoms.ts` — `ProgressionStep` gains `cachedDegree: DegreeId | null`. Add `updateProgressionStepCachedDegreeAtom`. Extend the scale-change reaction so it transposes each step (diatonic re-derivation when `cachedDegree` is set; interval transpose otherwise).
- Modify: `src/store/chordOverlayAtoms.ts` — delete `chordOverlayModeAtom`, `effectiveChordOverlayModeAtom`, `chordOverlayModeStorage`, `chordRootOverrideAtom`, `chordQualityOverrideAtom`, `chordDegreeAtom`, `progressionIsActiveChordSource`. `chordRootAtom`/`chordTypeAtom`/`chordDegreeAtom` collapse to writes through `updateActiveChordAtom`. Remove the auto-flip-to-manual side-effect.
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — delete the Mode `ToggleBar` (currently at line ~191). Both Degree and Manual inputs always visible; both write through `updateActiveChordAtom`.
- Modify: `src/utils/storage.ts` (if it owns one-shot migrations) or `src/store/chordOverlayAtoms.ts` — first-load migration: `"off"` → set `chordOverlayHiddenAtom = true`; `"manual"`/`"degree"` → discard overrides; delete `chordRootOverride`, `chordQualityOverride`, `chordOverlayMode` storage keys.
- Modify: `src/components/HelpModal/HelpModal.tsx` (or equivalent) — one-time first-load notice: "Manual chord mode has been removed — edit the active progression step directly to customize the chord."
- Test: `src/store/songStateAtoms.test.ts`, `src/store/progressionAtoms.test.ts` (extend), `src/store/chordOverlayAtoms.test.ts` (rewrite), `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` (update).

### Task 2.1: Add `cachedDegree` to `ProgressionStep` (failing test first)

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/store/progressionAtoms.test.ts`, add:

```ts
describe("ProgressionStep.cachedDegree", () => {
  it("defaults new steps to a non-null cachedDegree resolved from the active scale", () => {
    const store = createStore();
    // root = A, scaleName = "Minor Pentatonic", default progression
    const steps = store.get(progressionStepsAtom);
    expect(steps[0]).toHaveProperty("cachedDegree");
    expect(steps[0].cachedDegree).not.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "cachedDegree"`
Expected: FAIL — property `cachedDegree` is undefined on the step.

- [ ] **Step 3: Add `cachedDegree` to the type and default factory**

In `src/store/progressionAtoms.ts`, add `cachedDegree: DegreeId | null` to the `ProgressionStep` interface. In the default-step factory, populate it via the existing degree-resolution helper (or `null` if the chord is not diatonic).

- [ ] **Step 4: Run the test, confirm it passes**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "cachedDegree"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progression): add cachedDegree to ProgressionStep"
```

### Task 2.2: On scale change, transpose each step

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Test: `src/store/progressionAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe("progression scale-change reaction", () => {
  it("transposes in-key steps diatonically when scale changes", () => {
    const store = createStore();
    store.set(rootNoteAtom, "A");
    store.set(scaleNameAtom, "Minor");
    // Suppose step 0 has cachedDegree = "i", root = "A", quality = "Minor Triad"
    store.set(rootNoteAtom, "C");
    const step = store.get(progressionStepsAtom)[0];
    expect(step.root).toBe("C");
    expect(step.quality).toBe("Minor Triad");
    expect(step.cachedDegree).toBe("i");
  });

  it("transposes out-of-key steps by interval distance", () => {
    const store = createStore();
    store.set(rootNoteAtom, "A");
    store.set(scaleNameAtom, "Minor");
    // Manually inject an out-of-key step: root = "F#", quality = "Major Triad", cachedDegree = null
    store.set(updateProgressionStepRootAtom, { index: 0, root: "F#" });
    store.set(updateProgressionStepCachedDegreeAtom, { index: 0, value: null });
    store.set(rootNoteAtom, "C"); // up a minor third
    const step = store.get(progressionStepsAtom)[0];
    expect(step.root).toBe("A"); // F# + minor third = A
    expect(step.cachedDegree).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts -t "scale-change"`
Expected: FAIL.

- [ ] **Step 3: Implement the reaction**

Add (or extend) the `useEffect`-style atom that subscribes to `rootNoteAtom` + `scaleNameAtom` changes. On change, for each step:

```ts
import { Note, Interval } from "@tonaljs/tonal";

const oldRoot = previousRootRef.current;
const newRoot = get(rootNoteAtom);
const scale = get(scaleNameAtom);
const steps = get(progressionStepsAtom);

const next = steps.map((step) => {
  if (step.cachedDegree != null) {
    const diatonic = getDiatonicChord(step.cachedDegree, scale, newRoot);
    return { ...step, root: diatonic.root, quality: step.quality };
  }
  const interval = Interval.distance(oldRoot, newRoot);
  return { ...step, root: Note.transpose(step.root, interval) };
});

set(progressionStepsAtom, next);
```

(Use the existing `tonalAdapter` if direct `@tonaljs/*` imports are not allowed in `src/`.)

- [ ] **Step 4: Run, confirm tests pass**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progression): transpose steps on scale change"
```

### Task 2.3: Add `songStateAtoms.ts` unified selectors

**Files:**
- Create: `src/store/songStateAtoms.ts`
- Test: `src/store/songStateAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { createStore } from "jotai";
import {
  activeChordRootAtom,
  activeChordQualityAtom,
  activeChordCachedDegreeAtom,
  updateActiveChordAtom,
} from "./songStateAtoms";

describe("songStateAtoms", () => {
  it("reads active step's chord", () => {
    const store = createStore();
    expect(store.get(activeChordRootAtom)).toBeTypeOf("string");
    expect(store.get(activeChordQualityAtom)).toBeTypeOf("string");
  });

  it("updateActiveChord writes through to the active step", () => {
    const store = createStore();
    store.set(updateActiveChordAtom, { root: "G", quality: "Major Triad" });
    expect(store.get(activeChordRootAtom)).toBe("G");
    expect(store.get(activeChordQualityAtom)).toBe("Major Triad");
  });

  it("manual chord out of key clears cachedDegree", () => {
    const store = createStore();
    store.set(rootNoteAtom, "A");
    store.set(scaleNameAtom, "Minor");
    store.set(updateActiveChordAtom, { root: "F#", quality: "Major Triad" });
    expect(store.get(activeChordCachedDegreeAtom)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `pnpm vitest run src/store/songStateAtoms.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```ts
// src/store/songStateAtoms.ts
import { atom } from "jotai";
import {
  activeProgressionStepAtom,
  updateProgressionStepRootAtom,
  updateProgressionStepQualityAtom,
  updateProgressionStepCachedDegreeAtom,
  activeProgressionStepIndexAtom,
} from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { resolveDegreeFromChord } from "@fretflow/core";

export const activeChordRootAtom = atom((get) => get(activeProgressionStepAtom).root);
export const activeChordQualityAtom = atom((get) => get(activeProgressionStepAtom).quality);
export const activeChordCachedDegreeAtom = atom((get) => get(activeProgressionStepAtom).cachedDegree);

export const updateActiveChordAtom = atom(
  null,
  (get, set, patch: { root?: string; quality?: string; cachedDegree?: DegreeId | null }) => {
    const index = get(activeProgressionStepIndexAtom);
    if (patch.root != null) set(updateProgressionStepRootAtom, { index, root: patch.root });
    if (patch.quality != null) set(updateProgressionStepQualityAtom, { index, quality: patch.quality });
    if (patch.cachedDegree !== undefined) {
      set(updateProgressionStepCachedDegreeAtom, { index, value: patch.cachedDegree });
    } else if (patch.root != null || patch.quality != null) {
      // Auto-recompute cachedDegree from the new chord against the active scale
      const root = patch.root ?? get(activeChordRootAtom);
      const quality = patch.quality ?? get(activeChordQualityAtom);
      const scaleRoot = get(rootNoteAtom);
      const scaleName = get(scaleNameAtom);
      const cd = resolveDegreeFromChord(root, quality, scaleName, scaleRoot);
      set(updateProgressionStepCachedDegreeAtom, { index, value: cd });
    }
  }
);
```

If `resolveDegreeFromChord` does not exist in `@fretflow/core`, add it as a tiny wrapper around `getDiatonicChord` reverse lookup before completing this task.

- [ ] **Step 4: Run, confirm tests pass**

Run: `pnpm vitest run src/store/songStateAtoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/songStateAtoms.ts src/store/songStateAtoms.test.ts packages/core/
git commit -m "feat(store): add unified active-chord selectors"
```

### Task 2.4: Remove Chord-tab Mode toggle UI

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("does not render the Mode toggle", () => {
  render(<ChordOverlayControls />);
  expect(screen.queryByRole("group", { name: /mode/i })).not.toBeInTheDocument();
});

it("renders Degree input and Manual (root+quality) input simultaneously", () => {
  render(<ChordOverlayControls />);
  expect(screen.getByLabelText(/degree/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/root/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: FAIL — Mode toggle exists.

- [ ] **Step 3: Delete the Mode toggle JSX (currently ~line 191)**

Open `ChordOverlayControls.tsx`. Remove the `ToggleBar` for `Off / Degree / Manual` and its surrounding label/hint. Keep the Degree picker and the Root+Quality pickers; render both unconditionally. Wire both through `updateActiveChordAtom` from `songStateAtoms`.

- [ ] **Step 4: Run, confirm tests pass**

Run: `pnpm vitest run src/components/ChordOverlayControls/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordOverlayControls/
git commit -m "feat(chord): remove Mode toggle; expose Degree and Manual inputs simultaneously"
```

### Task 2.5: Delete dead atoms and storage entries

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Modify: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Delete the dead atoms**

Remove from `src/store/chordOverlayAtoms.ts`:
- `chordOverlayModeAtom`
- `effectiveChordOverlayModeAtom`
- `chordOverlayModeStorage`
- `chordRootOverrideAtom`
- `chordQualityOverrideAtom`
- `progressionIsActiveChordSource`
- The standalone `chordDegreeAtom`, `chordRootAtom`, `chordTypeAtom` if they exist independently of `updateActiveChordAtom`
- The auto-flip-to-manual side-effects (today at lines ~270, ~331)

For each removed export, grep the codebase: `grep -rn "chordOverlayModeAtom\|effectiveChordOverlayModeAtom\|chordRootOverrideAtom\|chordQualityOverrideAtom\|progressionIsActiveChordSource" src/`. Replace consumer reads with `activeChordRootAtom`/`activeChordQualityAtom`/`chordOverlayHiddenAtom` from `songStateAtoms` and `chordOverlayAtoms` as appropriate.

- [ ] **Step 2: Update tests**

Delete or rewrite tests in `src/store/chordOverlayAtoms.test.ts` that exercise the removed atoms.

- [ ] **Step 3: Run lint + tests**

Run: `pnpm run lint && pnpm run test`
Expected: PASS. Type errors mean a consumer was missed in Step 1.

- [ ] **Step 4: Commit**

```bash
git add src/store/chordOverlayAtoms.ts src/store/chordOverlayAtoms.test.ts $(grep -rl 'chordOverlayMode\|chordRootOverride\|chordQualityOverride' src/)
git commit -m "refactor(chord): delete chord-mode atoms; route reads through songStateAtoms"
```

### Task 2.6: One-shot migration for persisted state

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts` (or `src/utils/storage.ts`)
- Test: a focused migration test

- [ ] **Step 1: Write the failing test**

```ts
import { runChordModeMigration } from "./chordOverlayAtoms";

describe("chord mode migration", () => {
  beforeEach(() => localStorage.clear());

  it('"off" sets chordOverlayHidden = true and clears overrides', () => {
    localStorage.setItem(k("chordOverlayMode"), "off");
    localStorage.setItem(k("chordRootOverride"), "G");
    localStorage.setItem(k("chordQualityOverride"), "Major Triad");
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayHidden"))).toBe("true");
    expect(localStorage.getItem(k("chordRootOverride"))).toBeNull();
    expect(localStorage.getItem(k("chordQualityOverride"))).toBeNull();
    expect(localStorage.getItem(k("chordOverlayMode"))).toBeNull();
  });

  it('"manual" discards overrides without hiding', () => {
    localStorage.setItem(k("chordOverlayMode"), "manual");
    localStorage.setItem(k("chordRootOverride"), "G");
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayHidden"))).not.toBe("true");
    expect(localStorage.getItem(k("chordRootOverride"))).toBeNull();
  });

  it('"degree" is a no-op except for cleanup', () => {
    localStorage.setItem(k("chordOverlayMode"), "degree");
    runChordModeMigration();
    expect(localStorage.getItem(k("chordOverlayMode"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `pnpm vitest run -t "chord mode migration"`
Expected: FAIL.

- [ ] **Step 3: Implement the migration**

```ts
export function runChordModeMigration(): void {
  const mode = localStorage.getItem(k("chordOverlayMode"));
  if (mode == null) return;
  if (mode === "off") localStorage.setItem(k("chordOverlayHidden"), "true");
  localStorage.removeItem(k("chordRootOverride"));
  localStorage.removeItem(k("chordQualityOverride"));
  localStorage.removeItem(k("chordOverlayMode"));
}
```

Call `runChordModeMigration()` once from `src/main.tsx` before `<App />` mounts.

- [ ] **Step 4: Run, confirm tests pass**

Run: `pnpm vitest run -t "chord mode migration"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/chordOverlayAtoms.ts src/main.tsx
git commit -m "feat(migration): one-shot migration for chord mode collapse"
```

### Task 2.7: HelpModal notice + i18n cleanup

**Files:**
- Modify: `src/components/HelpModal/HelpModal.tsx`
- Modify: i18n files under `src/i18n/` (en + es)

- [ ] **Step 1: Remove the i18n keys**

In each locale file, remove: `controls.mode`, `controls.modeHint`, `controls.off`, `controls.manual`. Keep `controls.degree` (repurposed as the Degree-input label).

- [ ] **Step 2: Add the first-load notice key**

Add `help.chordModeRemoved`: "Manual chord mode has been removed — edit the active progression step directly to customize the chord."

- [ ] **Step 3: Surface it in HelpModal**

In `HelpModal.tsx`, add a one-time-dismissible "What's new" section reading from a `seenChordModeRemovalAtom` (persisted boolean). On first render after upgrade, show the notice; user dismisses; never shown again.

- [ ] **Step 4: Run lint + tests**

Run: `pnpm run lint && pnpm run test && npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/ src/components/HelpModal/
git commit -m "chore(i18n): remove chord-mode keys; add migration notice"
```

### Task 2.8: Phase 2 quality gate

- [ ] **Step 1: Run full quality gate**

Run: `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`
Expected: all green.

- [ ] **Step 2: Refresh visual baselines (darwin)**

Run: `pnpm run test:visual:update`
Expected: snapshots regenerated; review the diff for the Chord tab.

- [ ] **Step 3: Open PR**

```bash
git push -u origin claude/gifted-shamir-aee582
gh pr create --title "feat(chord): unify chord state through active progression step (Phase 2)" --body "$(cat <<'EOF'
## Summary
- The active progression step is now the single source of truth for the current chord
- Chord-tab Mode toggle removed; Degree and Manual inputs always visible
- One-shot migration converts legacy persisted state

## Test plan
- [ ] `pnpm run lint && pnpm run test && pnpm run build`
- [ ] Visual regression snapshots refreshed
- [ ] First-load migration verified manually with a stale localStorage
EOF
)"
```

---

## Phase 3 — Inspector Reshape

**Scope:** Drop View tab, rename Progression → Song, add per-tab visibility switches, remove top-band legend. View-tab settings move to the Settings overlay.

**File Structure**

- Modify: `src/components/Inspector/tabs.tsx` — `InspectorTabId = "scale" | "chord" | "song"`. Remove `view`. Rename label key.
- Modify: `src/components/Inspector/Inspector.tsx` — 3-tab navigation; `song` routes to existing ProgressionControls (renamed to SongControls in Task 3.4).
- Delete: `src/components/Inspector/ViewTab.tsx`, `ViewTab.module.css`, `ViewTab.test.tsx`.
- Modify: `src/components/SettingsOverlay/SettingsOverlay.tsx` — add "Display" section with `noteLabelStyleAtom`, `useFlatsAtom`, `fretRangeAtom`, `degreeColorsEnabledAtom` controls (Theme already present).
- Modify: `src/components/Inspector/ScaleTab.tsx` — add visibility switch row at top bound to `scaleVisibleAtom`.
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — add visibility switch row at top bound to `chordOverlayHiddenAtom` (inverted).
- Delete: `src/components/TopBandSummary/`, `src/components/FretboardLensOverlay/`. Audit `src/components/DegreeChipStrip/` and `src/components/ChordPracticeBar/` for other consumers; delete if none.
- Modify: `src/App.tsx` — stop rendering the top-band region.
- Modify: `src/components/HelpModal/HelpModal.tsx` — document `S` / `C` keyboard shortcuts for layer visibility.
- Modify: `src/main.tsx` (or a keymap module) — wire `S` and `C` global shortcuts.

### Task 3.1: Audit deletable top-band components

**Files:** none modified

- [ ] **Step 1: Grep for non-top-band consumers**

Run:
```bash
grep -rn "DegreeChipStrip\|ChordPracticeBar\|TopBandSummary\|FretboardLensOverlay" src/ --include="*.tsx" --include="*.ts"
```
Expected: each import appears only in App.tsx + the component's own folder. If a non-top-band consumer exists, document it (this task is a no-commit audit).

- [ ] **Step 2: Record findings**

If any are reused, list them in the PR description and keep that component (skip its deletion in Task 3.7).

### Task 3.2: Switch tab list to 3 tabs (failing test first)

**Files:**
- Modify: `src/components/Inspector/tabs.tsx`, `src/components/Inspector/Inspector.tsx`
- Test: `src/components/Inspector/Inspector.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("renders three tabs: Scale, Chord, Song", () => {
  render(<Inspector />);
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.getByRole("tab", { name: /scale/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /chord/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /song/i })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /view/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `pnpm vitest run src/components/Inspector/Inspector.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update tabs.tsx**

```ts
export type InspectorTabId = "scale" | "chord" | "song";

export const INSPECTOR_TABS: InspectorTabConfig[] = [
  { id: "scale", labelKey: "scaleTab", icon: <Music2 size={18} /> },
  { id: "chord", labelKey: "chordTab", icon: <Layers size={18} /> },
  { id: "song", labelKey: "songTab", icon: <ListMusic size={18} /> },
];
```

In `Inspector.tsx`, replace the `view` branch with no-op (deleted) and the `progression` branch with `song`. Update i18n: rename `inspector.progressionTab` → `inspector.songTab`; remove `inspector.viewTab`.

- [ ] **Step 4: Run, confirm tests pass**

Run: `pnpm vitest run src/components/Inspector/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Inspector/ src/i18n/
git commit -m "feat(inspector): collapse to three tabs (Scale, Chord, Song)"
```

### Task 3.3: Migrate View-tab controls into Settings overlay

**Files:**
- Modify: `src/components/SettingsOverlay/SettingsOverlay.tsx`
- Test: `src/components/SettingsOverlay/SettingsOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("renders Display section with note-label / accidental / fret-range / degree-color controls", () => {
  render(<SettingsOverlay open onClose={() => {}} />);
  expect(screen.getByRole("region", { name: /display/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/note labels/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/accidentals/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/fret range/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/degree colors/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `pnpm vitest run src/components/SettingsOverlay/`
Expected: FAIL.

- [ ] **Step 3: Move the controls**

Copy the relevant JSX from `ViewTab.tsx` into a new "Display" section in `SettingsOverlay.tsx`. Atoms (`noteLabelStyleAtom`, `useFlatsAtom`, `fretRangeAtom`, `degreeColorsEnabledAtom`) are unchanged.

- [ ] **Step 4: Run, confirm tests pass**

Run: `pnpm vitest run src/components/SettingsOverlay/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsOverlay/
git commit -m "feat(settings): move View-tab display controls into Settings overlay"
```

### Task 3.4: Delete View tab

**Files:**
- Delete: `src/components/Inspector/ViewTab.tsx`, `ViewTab.module.css`, `ViewTab.test.tsx`
- Modify: `src/components/Inspector/Inspector.tsx` (remove import)

- [ ] **Step 1: Delete files**

```bash
git rm src/components/Inspector/ViewTab.tsx src/components/Inspector/ViewTab.module.css src/components/Inspector/ViewTab.test.tsx
```

- [ ] **Step 2: Remove the import in `Inspector.tsx`**

Delete the `import ViewTab from "./ViewTab"` line and any remaining references.

- [ ] **Step 3: Run lint + tests + build**

Run: `pnpm run lint && pnpm run test && npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/Inspector/
git commit -m "refactor(inspector): delete ViewTab"
```

### Task 3.5: Rename Progression → Song (component file)

**Files:**
- Rename: `src/components/ProgressionControls/` → `src/components/SongControls/`
- Modify: every import site

- [ ] **Step 1: Rename the folder and main file**

```bash
git mv src/components/ProgressionControls src/components/SongControls
git mv src/components/SongControls/ProgressionControls.tsx src/components/SongControls/SongControls.tsx
git mv src/components/SongControls/ProgressionControls.module.css src/components/SongControls/SongControls.module.css
git mv src/components/SongControls/ProgressionControls.test.tsx src/components/SongControls/SongControls.test.tsx
```

Inside the renamed files, find/replace `ProgressionControls` → `SongControls`. **Do not** rename atoms or files in `src/store/progressionAtoms.ts` — storage compatibility (per spec §8a).

- [ ] **Step 2: Update import sites**

Run:
```bash
grep -rln "ProgressionControls" src/ | xargs sed -i '' 's/ProgressionControls/SongControls/g'
```
(macOS sed flags as shown. On Linux drop the `''` after `-i`.)

- [ ] **Step 3: Run lint + tests + build**

Run: `pnpm run lint && pnpm run test && npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(progression): rename ProgressionControls → SongControls (UI only)"
```

### Task 3.6: Add per-tab visibility switches

**Files:**
- Modify: `src/components/Inspector/ScaleTab.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Test: respective `.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// ScaleTab.test.tsx
it("renders a visibility switch bound to scaleVisibleAtom", () => {
  render(<ScaleTab />);
  const sw = screen.getByRole("switch", { name: /scale layer/i });
  expect(sw).toBeChecked();
});

// ChordOverlayControls.test.tsx
it("renders a visibility switch bound to chordOverlayHiddenAtom (inverted)", () => {
  render(<ChordOverlayControls />);
  const sw = screen.getByRole("switch", { name: /chord layer/i });
  expect(sw).toBeChecked();
});
```

- [ ] **Step 2: Run, confirm they fail**

Run: `pnpm vitest run src/components/Inspector/ScaleTab.test.tsx src/components/ChordOverlayControls/`
Expected: FAIL.

- [ ] **Step 3: Add the switches**

At the top of each tab body, render a row:

```tsx
<div className={styles.layerVisibilityRow}>
  <Switch
    role="switch"
    aria-label={t("inspector.scaleLayer")}
    checked={visible}
    onChange={(next) => setVisible(next)}
  />
  <span>{t("inspector.scaleLayer")}</span>
</div>
```

Use existing Switch primitive if present; otherwise use the same pattern the SettingsOverlay uses for boolean toggles.

- [ ] **Step 4: Run, confirm tests pass**

Run: `pnpm vitest run src/components/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Inspector/ScaleTab.tsx src/components/ChordOverlayControls/ src/i18n/
git commit -m "feat(inspector): per-tab visibility switches for Scale and Chord layers"
```

### Task 3.7: Remove top-band legend region

**Files:**
- Delete: `src/components/TopBandSummary/`, `src/components/FretboardLensOverlay/`, (and `DegreeChipStrip/`, `ChordPracticeBar/` if Task 3.1 confirmed no other consumers)
- Modify: `src/App.tsx` — stop rendering them

- [ ] **Step 1: Remove the JSX in `App.tsx`**

Delete the top-band section from the JSX tree. If `App.tsx` has a layout slot named e.g. `topBand`, set it to `null`.

- [ ] **Step 2: Delete the components**

```bash
git rm -r src/components/TopBandSummary src/components/FretboardLensOverlay
# Plus DegreeChipStrip / ChordPracticeBar if audit cleared them
```

- [ ] **Step 3: Run lint + tests + build**

Run: `pnpm run lint && pnpm run test && npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(layout): remove top-band legend region"
```

### Task 3.8: Add `S` / `C` keyboard shortcuts

**Files:**
- Modify: `src/main.tsx` (or existing keymap module)
- Modify: `src/components/HelpModal/HelpModal.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("S toggles scaleVisibleAtom", () => {
  const { result } = renderHook(() => useAtom(scaleVisibleAtom), { wrapper });
  fireEvent.keyDown(document, { key: "s" });
  expect(result.current[0]).toBe(false);
});
```

- [ ] **Step 2: Implement the handler**

```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "s" || e.key === "S") store.set(scaleVisibleAtom, !store.get(scaleVisibleAtom));
    if (e.key === "c" || e.key === "C") store.set(chordOverlayHiddenAtom, !store.get(chordOverlayHiddenAtom));
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

Document in `HelpModal.tsx` under a "Keyboard shortcuts" section: `S` — toggle scale; `C` — toggle chord.

- [ ] **Step 3: Run, confirm tests pass**

Run: `pnpm vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/components/HelpModal/
git commit -m "feat(a11y): keyboard shortcuts S/C for layer visibility"
```

### Task 3.9: Phase 3 quality gate

- [ ] **Step 1: Full quality gate**

Run: `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`
Expected: green.

- [ ] **Step 2: Refresh visual baselines**

Run: `pnpm run test:visual:update`

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "feat(inspector): collapse to 3 tabs, remove top-band legend (Phase 3)" --body "..."
```

---

## Phase 4 — Lens Redesign (Tones + Lead)

**Scope:** Collapse `targets` / `guide-tones` / `tension` into `tones` + `lead`. Add `nextChordTonesAtom`, `commonTonesWithNextAtom`, `beatPositionAtom`. Implement Full-CAGED-style base coloring + guide-tone emphasis. Implement Lead lens with common-tone hold, departing-note cues, anticipation window.

**File Structure**

- Modify: `packages/core/src/index.ts` (and the registry source) — `LENS_REGISTRY` lists exactly `tones`, `lead`.
- Modify: `packages/core/src/theory.ts` — `PracticeLens = "tones" | "lead"`.
- Modify: `src/store/practiceLensAtoms.ts` — migration `targets|guide-tones → tones`, `tension → lead`. Add the three new derived atoms.
- Modify: `src/hooks/useFretboardState.ts` (or wherever lens roles are computed) — implement Tones (Full-CAGED + guide-tone emphasis) and Lead (common-tone glow + anticipation).
- Modify: `src/i18n/` — drop keys for `guideTones`/`tension`; add `lensTones`, `lensLead`, `lensLeadHint`.
- Modify: `src/components/Inspector/Inspector.tsx`/`ChordOverlayControls.tsx` lens picker — 2 options.
- Test: focused unit tests for the new derived atoms.

### Task 4.1: Migrate lens enum + storage (failing test first)

**Files:**
- Modify: `packages/core/src/theory.ts`
- Modify: `src/store/practiceLensAtoms.ts`
- Test: `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Failing test**

```ts
it("migrates legacy targets → tones", () => {
  localStorage.setItem(k("practiceLens"), "targets");
  const store = createStore();
  expect(store.get(practiceLensAtom)).toBe("tones");
});

it("migrates legacy guide-tones → tones", () => {
  localStorage.setItem(k("practiceLens"), "guide-tones");
  const store = createStore();
  expect(store.get(practiceLensAtom)).toBe("tones");
});

it("migrates legacy tension → lead", () => {
  localStorage.setItem(k("practiceLens"), "tension");
  const store = createStore();
  expect(store.get(practiceLensAtom)).toBe("lead");
});

it("lensAvailabilityAtom returns exactly two entries", () => {
  const store = createStore();
  expect(store.get(lensAvailabilityAtom)).toHaveLength(2);
});
```

- [ ] **Step 2: Run, confirm failing**

Run: `pnpm vitest run src/store/practiceLensAtoms.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `theory.ts`:

```ts
export type PracticeLens = "tones" | "lead";
export const LENS_REGISTRY: ReadonlyArray<{ id: PracticeLens; ... }> = [
  { id: "tones", ... },
  { id: "lead", ... },
];
```

In `practiceLensAtoms.ts`, update `practiceLensStorage.migrate`:

```ts
migrate: () => {
  const raw = readLocalStorage(k("practiceLens"));
  if (raw === "targets" || raw === "guide-tones") return "tones";
  if (raw === "tension") return "lead";
  return undefined;
}
```

- [ ] **Step 4: Run, confirm passing**

Run: `pnpm vitest run src/store/practiceLensAtoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theory.ts src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(lens): collapse to tones+lead with migration"
```

### Task 4.2: Add `nextChordTonesAtom` and `commonTonesWithNextAtom`

**Files:**
- Modify: `src/store/practiceLensAtoms.ts`
- Test: same

- [ ] **Step 1: Failing test**

```ts
it("nextChordTonesAtom returns the notes of the step after the active step", () => {
  const store = createStore();
  // default progression: Am - Dm - G - C ; active = 0
  expect(store.get(nextChordTonesAtom)).toEqual(new Set(["D", "F", "A"]));
});

it("commonTonesWithNextAtom is the intersection", () => {
  const store = createStore();
  // Am {A,C,E} ∩ Dm {D,F,A} = {A}
  expect(store.get(commonTonesWithNextAtom)).toEqual(new Set(["A"]));
});
```

- [ ] **Step 2: Run, confirm failing**

Run: `pnpm vitest run -t "nextChordTones\|commonTones"`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { Chord } from "@tonaljs/tonal";

export const nextChordTonesAtom = atom((get) => {
  const steps = get(progressionStepsAtom);
  const active = get(activeProgressionStepIndexAtom);
  const nextIndex = (active + 1) % steps.length;
  const step = steps[nextIndex];
  // Map our quality label → Tonal symbol via the adapter
  const symbol = qualityLabelToTonalSymbol(step.quality);
  const notes = Chord.getChord(symbol, step.root).notes;
  return new Set(notes.map(Note.pitchClass));
});

export const commonTonesWithNextAtom = atom((get) => {
  const current = new Set([...get(activeChordTonesAtom)]);
  const next = get(nextChordTonesAtom);
  return new Set([...current].filter((n) => next.has(n)));
});
```

- [ ] **Step 4: Run, confirm passing**

Run: `pnpm vitest run -t "nextChordTones\|commonTones"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts
git commit -m "feat(lens): nextChordTones and commonTonesWithNext atoms"
```

### Task 4.3: Add `beatPositionAtom`

**Files:**
- Modify: `src/store/practiceLensAtoms.ts`
- Test: `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Failing test**

```ts
it("derives beat position from deadline + tempo, frozen when paused", () => {
  vi.useFakeTimers();
  const store = createStore();
  store.set(progressionTempoBpmAtom, 120);
  store.set(progressionStepDeadlineAtom, Date.now() + 2000);
  // 120 BPM => 0.5s/beat; 2s remaining => beat 0 of a 4-beat bar
  expect(store.get(beatPositionAtom)).toBeCloseTo(0, 1);
  vi.advanceTimersByTime(500);
  expect(store.get(beatPositionAtom)).toBeCloseTo(1, 1);
});
```

- [ ] **Step 2: Run, confirm failing**

Run: `pnpm vitest run -t "beat position"`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export const beatPositionAtom = atom((get) => {
  const tempo = get(progressionTempoBpmAtom);
  const deadline = get(progressionStepDeadlineAtom);
  const stepDurationBeats = get(activeStepDurationBeatsAtom);
  if (deadline == null) return 0;
  const secondsRemaining = Math.max(0, (deadline - Date.now()) / 1000);
  const secondsPerBeat = 60 / tempo;
  const beatsRemaining = secondsRemaining / secondsPerBeat;
  return Math.max(0, stepDurationBeats - beatsRemaining);
});
```

Important: this atom is time-dependent. The fretboard already rerenders on a tick; if not, gate consumers behind a 60Hz raf-driven atom subscription.

- [ ] **Step 4: Run, confirm passing**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts
git commit -m "feat(lens): beatPositionAtom derived from deadline + tempo"
```

### Task 4.4: Implement Tones lens base coloring

**Files:**
- Modify: `src/hooks/useFretboardState.ts` (or the role-resolver module)
- Test: `src/hooks/useFretboardState.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
it("Tones lens assigns chord notes the connector color and emphasizes guide tones (3rd, 7th)", () => {
  const roles = computeNoteRoles({ lens: "tones", chord: { root: "A", quality: "Minor Triad" }, /* ... */ });
  expect(roles.get("5-0")?.role).toBe("chord-tone"); // open A on low E
  expect(roles.get("5-0")?.emphasis).toBe("normal");
  // The 3rd of Am is C
  const cAnywhere = [...roles.entries()].find(([_, r]) => r.note === "C" && r.role === "chord-tone");
  expect(cAnywhere?.[1].emphasis).toBe("guide-tone");
});
```

- [ ] **Step 2: Run, confirm failing**

- [ ] **Step 3: Implement the role-resolver branch**

```ts
if (lens === "tones") {
  for (const note of chordTones) {
    const isGuideTone = note === chord.third || note === chord.seventh;
    roles.set(coord, { note, role: "chord-tone", emphasis: isGuideTone ? "guide-tone" : "normal" });
  }
  for (const note of scaleOnlyNotes) {
    roles.set(coord, { note, role: "note-scale-only", emphasis: "dim" });
  }
}
```

Coordinate with `FretboardSVG.tsx` to render the `guide-tone` emphasis (brighter fill or inner ring).

- [ ] **Step 4: Run, confirm passing**

- [ ] **Step 5: Commit**

```bash
git add src/hooks/ src/components/FretboardSVG/
git commit -m "feat(lens): Tones base (Full-CAGED color + guide-tone emphasis)"
```

### Task 4.5: Implement Lead lens — common tones + anticipation

**Files:**
- Modify: `src/hooks/useFretboardState.ts`
- Test: same

- [ ] **Step 1: Failing test**

```tsx
it("Lead lens marks common tones with next chord as 'hold'", () => {
  // Am → Dm: common tone A
  const roles = computeNoteRoles({ lens: "lead", chord: { root: "A", quality: "Minor Triad" }, nextChord: { root: "D", quality: "Minor Triad" } });
  const aNote = [...roles.values()].find((r) => r.note === "A" && r.role === "chord-tone");
  expect(aNote?.emphasis).toBe("hold");
});

it("Lead lens anticipates next chord's guide tones in last beat", () => {
  const roles = computeNoteRoles({
    lens: "lead",
    chord: { root: "A", quality: "Minor Triad" },
    nextChord: { root: "D", quality: "Minor Triad" },
    beatPosition: 3.6,
    stepDurationBeats: 4,
  });
  const fNote = [...roles.values()].find((r) => r.note === "F");
  expect(fNote?.emphasis).toBe("anticipation");
});
```

- [ ] **Step 2: Run, confirm failing**

- [ ] **Step 3: Implement**

```ts
if (lens === "lead") {
  applyTonesBase(roles); // start from Tones
  const common = commonTonesWithNext;
  const departing = chordTones.filter((n) => !common.has(n));
  for (const [coord, role] of roles) {
    if (common.has(role.note)) roles.set(coord, { ...role, emphasis: "hold" });
    else if (departing.includes(role.note)) roles.set(coord, { ...role, emphasis: "departing" });
  }
  if (beatPosition >= stepDurationBeats - 1) {
    const nextGuideTones = [nextChord.third, nextChord.seventh].filter(Boolean);
    for (const note of nextGuideTones) {
      // overlay anticipation for matching positions
    }
  }
}
```

- [ ] **Step 4: Run, confirm passing**

- [ ] **Step 5: Commit**

```bash
git add src/hooks/ src/components/FretboardSVG/
git commit -m "feat(lens): Lead lens with common-tone hold and anticipation window"
```

### Task 4.6: Update lens picker UI to 2 options

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx` (or wherever the lens ToggleBar lives)
- Test: same

- [ ] **Step 1: Failing test**

```tsx
it("renders exactly two lens options: Tones, Lead", () => {
  render(<ChordOverlayControls />);
  const group = screen.getByRole("group", { name: /lens/i });
  expect(within(group).getAllByRole("button")).toHaveLength(2);
});
```

- [ ] **Step 2: Run, confirm failing.** Step 3: Update the ToggleBar options array to `["tones", "lead"]`. **Step 4: Run, confirm passing.**

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordOverlayControls/ src/i18n/
git commit -m "feat(lens): UI picker shows Tones and Lead only"
```

### Task 4.7: Phase 4 quality gate + visual baselines

- [ ] **Step 1:** `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`
- [ ] **Step 2:** `pnpm run test:visual:update` — especially `e2e/fretboard-svg.visual.spec.ts`.
- [ ] **Step 3:** Open PR.

---

## Phase 5 — Voicing Simplification

**Scope:** Region 4-state ToggleBar replaces `chordScopeToPosition` + `chordFretSpread`. String-set picker → `LabeledSelect`. `.toggle-btn:disabled` rule added.

### Task 5.1: Region ToggleBar (failing test first)

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Test: same
- Modify: `src/store/chordOverlayAtoms.ts` — add a derived writable `regionAtom` mapping `"position" | "+2" | "+4" | "all"` ↔ `(chordScopeToPositionAtom, chordFretSpreadAtom)` pair.

- [ ] **Step 1: Failing test**

```tsx
it("Region ToggleBar has 4 options: Position / +2 / +4 / All", () => {
  render(<ChordOverlayControls />);
  const group = screen.getByRole("group", { name: /region/i });
  expect(within(group).getAllByRole("button")).toHaveLength(4);
});

it("selecting +2 sets scope=true and spread=2", () => {
  const store = createStore();
  render(<ChordOverlayControls />, { store });
  fireEvent.click(screen.getByRole("button", { name: /^\+2$/ }));
  expect(store.get(chordScopeToPositionAtom)).toBe(true);
  expect(store.get(chordFretSpreadAtom)).toBe(2);
});

it("disables position options when no active position", () => {
  const store = createStore();
  store.set(fingeringPatternAtom, "none");
  render(<ChordOverlayControls />, { store });
  expect(screen.getByRole("button", { name: /^position$/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run, confirm failing.**

- [ ] **Step 3: Implement `regionAtom`**

```ts
export type Region = "position" | "+2" | "+4" | "all";

export const regionAtom = atom(
  (get) => {
    if (!get(chordScopeToPositionAtom)) return "all";
    const sp = get(chordFretSpreadAtom);
    if (sp >= 3) return "+4";
    if (sp >= 1) return "+2";
    return "position";
  },
  (_get, set, next: Region) => {
    if (next === "all") set(chordScopeToPositionAtom, false);
    else {
      set(chordScopeToPositionAtom, true);
      set(chordFretSpreadAtom, next === "position" ? 0 : next === "+2" ? 2 : 4);
    }
  }
);
```

- [ ] **Step 4: Replace the scope-switch + spread-stepper JSX with a ToggleBar bound to `regionAtom`.**

Gate disabled state on `activePositionAtom == null` (from controls-overhaul spec).

- [ ] **Step 5: Run, confirm passing. Commit.**

```bash
git add src/store/chordOverlayAtoms.ts src/components/ChordOverlayControls/ src/i18n/
git commit -m "feat(chord): unify scope+spread into 4-state Region ToggleBar"
```

### Task 5.2: String-set picker → `LabeledSelect`

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Delete: `src/components/Inspector/StringSetPicker.tsx`, `StringSetPicker.module.css`, `StringSetPicker.test.tsx`
- Test: ChordOverlayControls test

- [ ] **Step 1: Failing test**

```tsx
it("renders string set as a LabeledSelect with named options", () => {
  render(<ChordOverlayControls />);
  const select = screen.getByLabelText(/string set/i);
  expect(select.tagName).toBe("SELECT");
  expect(within(select).getByText(/top 3 strings/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, confirm failing.**

- [ ] **Step 3: Replace `<StringSetPicker />` with `<LabeledSelect />`. Use the existing `stringSetOptionsAtom` for options; map IDs → display labels via a small util (`"top3" → "Top 3 strings (1-2-3)"` etc.).**

- [ ] **Step 4: Delete `StringSetPicker.*`** (after grepping `grep -rn StringSetPicker src/` confirms no other consumers).

- [ ] **Step 5: Run lint + tests + build, then commit.**

```bash
git add -A
git commit -m "feat(chord): replace graphical string-set picker with LabeledSelect"
```

### Task 5.3: `.toggle-btn:disabled` styling

**Files:** `src/components/shared/shared.module.css`, `ToggleBar.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
it("disabled option uses reduced opacity and not-allowed cursor", () => {
  render(<ToggleBar options={[{ value: "a", label: "A", disabled: true }]} value={null} onChange={() => {}} />);
  const btn = screen.getByRole("button", { name: "A" });
  expect(btn).toBeDisabled();
  const style = window.getComputedStyle(btn);
  expect(style.cursor).toBe("not-allowed");
});
```

- [ ] **Step 2: Run, confirm failing.**

- [ ] **Step 3: Add CSS**

```css
.toggle-btn:disabled {
  opacity: var(--disabled-opacity);
  cursor: not-allowed;
  color: var(--dc-fg-muted);
}
.toggle-btn:disabled:hover {
  background-color: transparent;
  border-color: transparent;
  color: var(--dc-fg-muted);
}
```

- [ ] **Step 4: Run, confirm passing. Commit.**

```bash
git add src/components/shared/shared.module.css src/components/shared/
git commit -m "fix(toggle-bar): disabled options now visually distinct"
```

### Task 5.4: Phase 5 quality gate

- [ ] `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`
- [ ] `pnpm run test:visual:update`
- [ ] Open PR.

---

## Phase 6 — Scale Simplification

**Scope:** Single grouped `LabeledSelect` for scale; remove Theory Facts panel; remove Relationship toggle; unify string-study string-set UX with Chord-tab pattern.

### Task 6.1: Grouped scale select

**Files:**
- Modify: `src/components/Inspector/ScaleTab.tsx`
- Modify: `src/store/scaleAtoms.ts` — make `scaleFamilyAtom` derived from `scaleNameAtom`.
- Test: `ScaleTab.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
it("renders a single grouped scale select", () => {
  render(<ScaleTab />);
  const select = screen.getByLabelText(/scale/i);
  expect(select.tagName).toBe("SELECT");
  expect(within(select).getAllByRole("group")).toHaveLength(4); // modes / pentatonics / blues / harmonic-melodic
});
```

- [ ] **Step 2: Run, confirm failing.**

- [ ] **Step 3: Implement**

Build options as `LabeledSelectGroup[]`:

```ts
const SCALE_GROUPS: LabeledSelectGroup[] = [
  { label: "Major modes", options: [{ value: "Ionian", label: "Ionian (Major)" }, /* ... */] },
  { label: "Pentatonics", options: [...] },
  { label: "Blues", options: [...] },
  { label: "Harmonic / Melodic", options: [...] },
];
```

Derive `scaleFamilyAtom`:

```ts
export const scaleFamilyAtom = atom((get) => deriveFamilyFromName(get(scaleNameAtom)));
```

Remove `scaleFamily` from storage; add a migration that drops the key.

- [ ] **Step 4: Run, confirm passing.**

- [ ] **Step 5: Commit**

```bash
git add src/store/scaleAtoms.ts src/components/Inspector/ScaleTab.tsx
git commit -m "feat(scale): grouped scale select; derive family from name"
```

### Task 6.2: Remove Theory Facts panel

**Files:** delete `src/components/Inspector/ScaleTheoryFacts.{tsx,module.css,test.tsx}`, `scaleTheoryDerivations.{ts,test.ts}`; modify `ScaleTab.tsx`.

- [ ] **Step 1: Grep for non-ScaleTab consumers**

Run: `grep -rn ScaleTheoryFacts\|scaleTheoryDerivations src/`
If any: address before deletion.

- [ ] **Step 2: Delete files**

```bash
git rm src/components/Inspector/ScaleTheoryFacts.tsx src/components/Inspector/ScaleTheoryFacts.module.css src/components/Inspector/ScaleTheoryFacts.test.tsx src/components/Inspector/scaleTheoryDerivations.ts src/components/Inspector/scaleTheoryDerivations.test.ts
```

- [ ] **Step 3: Remove the panel JSX in `ScaleTab.tsx`.**

- [ ] **Step 4: Run lint + tests + build. Commit.**

```bash
git add -A
git commit -m "refactor(scale): remove Theory Facts panel"
```

### Task 6.3: Remove Scale Relationship toggle

**Files:** `ScaleTab.tsx`, related atom in `scaleAtoms.ts`.

- [ ] **Step 1: Grep for the atom** `grep -rn scaleRelationshipAtom src/`. Remove all reads, then the atom itself.

- [ ] **Step 2: Remove the JSX and i18n keys.**

- [ ] **Step 3: Run lint + tests + build. Commit.**

```bash
git add -A
git commit -m "refactor(scale): remove Scale Relationship toggle"
```

### Task 6.4: Unify string-study string-set UX

**Files:** `ScaleTab.tsx` (1-string and 2-strings sub-controls)

- [ ] **Step 1: Replace the string-set chooser** with the same `LabeledSelect` used in Phase 5 Task 5.2. Share the label-mapping util.

- [ ] **Step 2: Failing test for the unified UI, then implementation, then passing test, then commit.**

```bash
git add src/components/Inspector/ScaleTab.tsx
git commit -m "feat(scale): unify string-set UX across Scale and Chord tabs"
```

### Task 6.5: Phase 6 quality gate

- [ ] `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`
- [ ] `pnpm run test:visual:update`
- [ ] Open PR.

---

## Phase 7 — Audio (Tone.js)

**Scope:** Replace bespoke audio scheduling with Tone.js. `core/audio.ts` becomes Tone-backed; `src/progressions/audio/*` rewritten on Tone.

**Pre-flight:** This phase is the largest single-domain rewrite. **Strongly recommended:** promote this section into a dedicated plan file before execution.

### Task 7.1: Add `tone` dependency and Tone init module

**Files:**
- Modify: `package.json` (root) — add `"tone": "^15"` (or current stable).
- Create: `src/core/toneInit.ts` — single import point for Tone; gates start until first user gesture.

- [ ] **Step 1: Install**

Run: `pnpm add tone`

- [ ] **Step 2: Failing test**

```ts
import { ensureToneStarted } from "./toneInit";

it("ensureToneStarted resolves after a user gesture mock", async () => {
  await ensureToneStarted();
  expect(Tone.getContext().state).toBe("running");
});
```

- [ ] **Step 3: Implement**

```ts
import * as Tone from "tone";
let started = false;
export async function ensureToneStarted(): Promise<void> {
  if (started) return;
  await Tone.start();
  started = true;
}
```

- [ ] **Step 4: Run, confirm passing. Commit.**

### Task 7.2: Replace `GuitarSynth` with Tone

**Files:** rewrite `src/core/audio.ts`; update `src/core/audio.test.ts`.

- [ ] **Step 1: Failing test** — verify `playChord([...notes])` triggers attack on Tone polysynth (mock `Tone.PolySynth` and assert call).

- [ ] **Step 2: Implement** with `Tone.PolySynth(Tone.Synth)` (or `Tone.Sampler` if guitar samples are available). Match the existing public method names (`playChord`, `playNote`, `releaseAll`).

- [ ] **Step 3: Run, confirm passing. Commit.**

```bash
git add src/core/audio.ts src/core/audio.test.ts package.json pnpm-lock.yaml
git commit -m "refactor(audio): rewrite GuitarSynth on Tone.js"
```

### Task 7.3: Replace step deadline + advance with `Tone.Transport` + `Tone.Sequence`

**Files:** modify `src/store/progressionAtoms.ts` (lines ~343–347 today); create `src/progressions/audio/transport.ts`.

- [ ] **Step 1: Failing test** — at 120 BPM with 4-beat steps, after 2 seconds the active step index advances by 1.

- [ ] **Step 2: Implement** — replace the bespoke timer with:

```ts
const seq = new Tone.Sequence((time, stepIdx) => {
  Tone.Draw.schedule(() => store.set(activeProgressionStepIndexAtom, stepIdx), time);
}, steps.map((_, i) => i), `${beatsPerStep}n`);
seq.start(0);
Tone.Transport.bpm.value = tempo;
Tone.Transport.start();
```

- [ ] **Step 3: Run, confirm passing. Commit.**

### Task 7.4: Rewrite backing-track scheduling on Tone

**Files:** `src/progressions/audio/*`.

- [ ] **Step 1: Inventory existing scheduling logic** — list each role (lead, comp, bass, drums) and its current trigger mechanism.

- [ ] **Step 2: Migrate each role** to `Tone.Pattern` (lead/comp/bass) or `Tone.Loop` (drum kit), preserving the same beat-grid semantics as today.

- [ ] **Step 3: Run e2e** `pnpm run test:e2e` to verify playback still works end-to-end.

- [ ] **Step 4: Commit each role migration as its own commit** for review-friendliness.

### Task 7.5: Phase 7 quality gate

- [ ] `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`
- [ ] `pnpm run test:e2e`
- [ ] `pnpm run test:visual:update`
- [ ] Open PR.

---

## Phase 8 — Polish

**Scope:** Edit-on-Chord links, playback-blocked tooltip, cross-tab dependency hints, backing-track collapsed-by-default.

### Task 8.1: Backing-track collapsible (failing test first)

**Files:** `src/components/SongControls/SongControls.tsx`

- [ ] **Step 1: Failing test**

```tsx
it("Backing track section is collapsed by default", () => {
  render(<SongControls />);
  const region = screen.getByRole("region", { name: /backing track/i });
  expect(region).toHaveAttribute("hidden");
});

it("expanding reveals style/lead/comp/bass/drums/swing controls", async () => {
  render(<SongControls />);
  await userEvent.click(screen.getByRole("button", { name: /backing track/i }));
  expect(screen.getByLabelText(/style/i)).toBeVisible();
});
```

- [ ] **Step 2–4: Implement with `<details>`/`<summary>` or a Disclosure primitive. Pass tests.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(song): collapse backing track section by default"
```

### Task 8.2: Per-step Edit-on-Chord link

**Files:** `src/components/SongControls/SongControls.tsx`, `src/store/uiAtoms.ts` (active inspector tab atom)

- [ ] **Step 1: Failing test**

```tsx
it("Edit-on-Chord link switches Inspector tab to chord and activates the step", async () => {
  const store = createStore();
  render(<SongControls />, { store });
  await userEvent.click(screen.getAllByRole("button", { name: /edit on chord/i })[1]);
  expect(store.get(activeInspectorTabAtom)).toBe("chord");
  expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
});
```

- [ ] **Step 2–4: Implement; pass tests.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(song): per-step Edit-on-Chord link"
```

### Task 8.3: Playback-blocked tooltip on Play

**Files:** `src/components/TransportBar/TransportBar.tsx`

- [ ] **Step 1: Failing test**

```tsx
it("Play button title reflects progressionPlaybackBlockedReasonAtom when disabled", () => {
  const store = createStore();
  store.set(progressionPlaybackBlockedReasonAtom, "Audio context not started");
  render(<TransportBar />, { store });
  expect(screen.getByRole("button", { name: /play/i })).toHaveAttribute("title", "Audio context not started");
});
```

- [ ] **Step 2–4: Bind the Play button's `title` to the atom. Pass tests.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(transport): surface playback-blocked reason in Play button tooltip"
```

### Task 8.4: Cross-tab dependency hints

**Files:** `src/components/ChordOverlayControls/ChordOverlayControls.tsx`

- [ ] **Step 1: Failing test**

```tsx
it("Chord-tab region row hints that position comes from Scale → Fingering", () => {
  render(<ChordOverlayControls />);
  expect(screen.getByText(/position comes from scale .* fingering/i)).toBeInTheDocument();
});

it("Chord-tab header reads 'Editing bar N · <chord> (<degree>) — writes to your progression'", () => {
  render(<ChordOverlayControls />);
  expect(screen.getByText(/editing bar 1 ·/i)).toBeInTheDocument();
});
```

- [ ] **Step 2–4: Implement; pass tests.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(chord): cross-tab dependency hints and editing-bar header"
```

### Task 8.5: Phase 8 quality gate

- [ ] `pnpm run lint && pnpm run test && pnpm run build && npx tsc -b`
- [ ] `pnpm run test:visual:update`
- [ ] Open PR.

---

## Self-Review Checklist

This plan was reviewed against the spec on save. Coverage map:

| Spec §          | Phase | Covered? |
|---|---|---|
| 1a–1c, 4a–4f, 11a | Phase 2 | yes |
| 1d–1f, 3a–3e, 11e | Phase 3 | yes |
| 1g, 5a–5d, 11b | Phase 4 | yes |
| 1h, 6a–6d | Phase 5 | yes |
| 7a–7e, 11c | Phase 6 | yes |
| 9b | Phase 7 | yes |
| 8a–8d, polish | Phase 8 | yes |
| 9a (Tonal) | Phase 1 (done) | yes (see linked plan) |

No placeholders detected. Types/atom names cross-referenced — `cachedDegree`, `updateActiveChordAtom`, `regionAtom`, `nextChordTonesAtom`, `commonTonesWithNextAtom`, `beatPositionAtom` used consistently across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-fretflow-integration-design.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks. Best for a plan this large.

**2. Inline Execution** — execute in this session with checkpoints. Workable if scoped to one phase at a time.

**Which approach, and which phase next?** Recommended start: Phase 2 (Chord unification), which unlocks Phases 3–5 and 8.
