# Improvisation Lenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-option practice-lens selector (Root / Guide tones / Common-pivot) that swaps which predictive notes the fretboard emphasizes during progression playback, with `guide` as the default (today's behavior, byte-identical).

**Architecture:** A new `practiceLensAtom` feeds two existing paths. The "Target" family (Root, Guide) reuses the verbatim planning→landing ring by widening the existing next-chord target atom to a per-lens member set. The "Field" family (Common) adds one new emphasis branch (`hold-common`) driven by the already-present `commonTonesWithNextAtom`. No new colors or marker shapes — lenses ride the existing ring / size / opacity / label channels.

**Tech Stack:** React 19 + TypeScript, Jotai atoms (`atomWithStorage`), Vitest + Testing Library (jsdom), Playwright visual regression, CSS Modules, i18n (en/es), `@fretflow/core` (pure theory).

---

## Resolved design decisions

The spec's three Open Questions are resolved per its own recommendations — no further input needed:

1. **Selector shape:** `ToggleBar` (3 chips), matching the retired lens control and the sibling `ChordStringSetToggleBar`.
2. **Default lens:** `guide` — zero behavior change on first load.
3. **Common-tone timing:** hold for the duration of the single guide **countdown window** (`guideCountdownActive`), mirroring "as the change approaches."

**One spec correction:** the spec sketch uses `{"1"}` for the Root target member, but in this codebase the root chord member is named **`"root"`** (`packages/core/src/theory.ts:204` — `["root", "3", "5"]`). The Root lens target set is therefore `new Set(["root"])`. The displayed label is still `"R"`.

## Codebase drift note — rebased onto the countdown-ring model (commit `52372b0f`, #546)

This plan was originally drafted against the **two-phase** guide-tone model (a breathing `planning` preview ring → a draining `landing` ring, driven by `planningWindowActiveAtom` + `leadInActiveAtom`, with `TransitionRole = "guide-target" | "guide-preview"` and `data-guide-phase="preview" | "landing"`). Commit `52372b0f` ("continuous countdown ring with beat-tick notches") **replaced** that model with a **single continuous countdown**:

- The emphasis pipeline now reads **`guideCountdownActiveAtom`** (one boolean window, `min(step, 2·bar)`) instead of `leadInActiveAtom` / `planningWindowActiveAtom`. (Those two atoms still exist for the CSS-duration custom properties, but the ring no longer keys off them.)
- **`TransitionRole`** is now just `"guide-target"` (the `"guide-preview"` role was removed).
- **`LeadLensContext`** dropped `leadInActive` + `planningActive` and gained a single **`guideCountdownActive: boolean`**.
- **`EmphasisContext`** (in `useEmphasisContext.ts`) gained `guideCountdownActive` + **`countdownTicks: number[]`** (static beat-tick notch fractions from `guideCountdownTickFractionsAtom`).
- **`getEmphasis`** has one guide branch: `guideCountdownActive && nextGuideTones.has(notePc)`.
- **`FretboardNote`** maps `transitionRole === "guide-target" → guidePhase "landing"` (a 1-way ternary), and renders **static beat-tick `<line>` notches** inside the ring group, gated on `note.isInRegion && countdownTicks?.map(...)`.
- **CSS** has only `[data-guide-phase="landing"]` (no `"preview"`); the drain / loom / flash / tick animations are all scoped to `[data-guide-phase="landing"][data-guide-primary="true"]`.

The plan's **design intent is unchanged** — Root reuses the (now single-window) ring verbatim with a `{rootPc}` target; Common adds a `hold-common` branch. Tasks 3–8 and 11 below have been updated to the countdown-model API. Two integration consequences worth flagging up front:
- The Common-hold branch now triggers on **`guideCountdownActive`** (the single window), not `leadInActive || planningActive`.
- The Common-hold ring must **suppress the beat-tick notches** (ticks belong to the guide countdown, not the held-tone cue) — Task 7 gates ticks to `guidePhase === "landing"`.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/store/v2RedesignMigration.ts` | One-shot v2 key sweep | Stop retiring `practiceLens` so the reintroduced atom persists |
| `src/store/practiceLensAtoms.ts` | Lens state + lens-aware target selection | `PracticeLens` type, `practiceLensAtom`, `TARGET_MEMBERS_BY_LENS`, `nextTargetToneLabelsAtom` (+ `nextChordGuideToneLabelsAtom` alias), lens-aware `nextChordGuideTonesAtom` |
| `src/components/FretboardSVG/utils/semantics.ts` | Per-note emphasis | Add `"hold-common"` to `TransitionRole`, `lens`/`commonTones` on `LeadLensContext` (alongside the existing `guideCountdownActive`), common-hold branch in `getEmphasis`, `COMMON_HOLD_RADIUS_BOOST` |
| `src/components/FretboardSVG/hooks/useEmphasisContext.ts` | Frame-stable emphasis inputs | Add `lens` + `commonTones` (preserve `guideCountdownActive` + `countdownTicks`) |
| `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` | Build per-note `LeadLensContext` | Copy `lens` + `commonTones` into the context (alongside `guideCountdownActive`) |
| `src/components/FretboardSVG/FretboardNote.tsx` | SVG note render | Map `transitionRole === "hold-common"` → `data-guide-phase="hold"`; suppress beat-tick notches on hold rings |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Ring styles | Static `[data-guide-phase="hold"]` backing opacity (ring core/halo already static; no `preview` rules exist) |
| `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` | Strings | `lensLabel`, `lensRoot`, `lensGuide`, `lensCommon` |
| `src/components/ChordOverlayControls/ChordOverlayControls.tsx` | Control surface | Lens `ToggleBar` alongside Voicing |
| Co-located `*.test.ts(x)` + `e2e/` snapshots | Tests | Per task below |

---

## Background the engineer needs

- **Atoms:** Jotai. `atomWithStorage(key, default, storageAdapter, GET_ON_INIT)` persists to `localStorage`. `k("foo")` from `src/utils/storage.ts` prefixes the key (`fretflow:foo`). `createStorage` + `enumValidator([...])` makes a validated adapter that **self-heals** an invalid stored value back to the default (this is how we discard the legacy `"tones"` value the retired lens once stored). Mirror `voicingAtom` (`src/store/chordOverlayAtoms.ts:160-182`).
- **The emphasis pipeline:** `useEmphasisContext` (atoms → a frame-stable context, `null` when not playing) → `buildAnimatedFretboardNotes` (builds a per-note `LeadLensContext`) → `getEmphasis(noteClass, isGuideTone, leadContext)` returns `{ radiusBoost, opacityBoost, transitionRole?, guideTargetLabel? }` → `FretboardNote` renders ring/size/label from those.
- **Why the ring "just works" for Root:** `getEmphasis`'s guide branch fires on `guideCountdownActive && nextGuideTones.has(notePc)`. We make `nextChordGuideTonesAtom` lens-aware (its keys come from `nextTargetToneLabelsAtom`), so for the Root lens that set is `{rootPc}` and the *same* single-window countdown ring lights the root. No ring/CSS change for Root.
- **Why Common needs a new branch:** the Common lens returns an **empty** target map, so the ring path goes quiet; a new `hold-common` branch in `getEmphasis` emphasizes notes in `commonTones` instead.
- **The countdown context (post-#546):** `useEmphasisContext` exposes `guideCountdownActive: boolean` (the single drain window) and `countdownTicks: number[]` (static beat-tick fractions). Both must be **preserved** when threading the new `lens`/`commonTones` fields — do not revert to the old `leadInActive`/`planningActive` pair.
- **`renderedNoteSignature` (stale-render guard, `useAnimatedFretboardView.ts:97`):** a cheap string of every field that affects a note's rendered SVG. Both new outputs — `transitionRole` (now also `"hold-common"`) and `radiusBoost` — are **already** in the signature, so **no new signature field is required**. The `lens`/`commonTones` context fields are *inputs* to `getEmphasis`, never written onto the rendered note, so they must NOT be added. Task 6 adds a test that locks this in.
- **Verification commands** (run from repo root): `pnpm run test <path>` runs one test file; `pnpm run lint`, `pnpm run test`, `pnpm run build` are the mandatory pre-PR gates.

---

### Task 1: Stop retiring the `practiceLens` storage key

The v2 migration deletes `k("practiceLens")` on **every** boot (`v2RedesignMigration.ts:58`). Reintroducing the atom without this change would wipe the user's lens choice on every reload. Remove the retire entry; the legacy `"tones"` value is now discarded by the validated atom adapter (Task 2) instead.

**Files:**
- Modify: `src/store/v2RedesignMigration.ts:50-59`
- Modify: `src/store/v2RedesignMigration.ts:19` (doc comment)
- Test: `src/store/v2RedesignMigration.test.ts:95-99`

- [ ] **Step 1: Update the failing test**

Replace the existing `"retires the practiceLens key"` test (`src/store/v2RedesignMigration.test.ts:95-99`) with one asserting the key is now **preserved**:

```ts
  it("preserves the practiceLens key (reintroduced as the improvisation lens)", () => {
    localStorage.setItem("fretflow:practiceLens", JSON.stringify("guide"));
    runV2RedesignMigration();
    expect(localStorage.getItem("fretflow:practiceLens")).toBe(
      JSON.stringify("guide"),
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test src/store/v2RedesignMigration.test.ts`
Expected: FAIL — the migration still removes the key, so `getItem` returns `null`.

- [ ] **Step 3: Remove the retire entry**

In `src/store/v2RedesignMigration.ts`, delete the `k("practiceLens"),` line from `KEYS_TO_RETIRE` (currently line 58):

```ts
    const KEYS_TO_RETIRE = [
      k("region"),
      k("chordFretSpread"),
      k("voicingType"),
      k("voicingInversion"),
      k("voicingStringSet"),
      k("voicingConnectors"),
      k("voicingSectionExpanded"),
    ];
```

Then update the doc comment — remove line 19 (`*   - practiceLens           (practiceLensAtom — Lens Consolidation)`) from the "Retired keys" list.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test src/store/v2RedesignMigration.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/store/v2RedesignMigration.ts src/store/v2RedesignMigration.test.ts
git commit -m "chore(migration): stop retiring practiceLens key for improvisation lenses"
```

---

### Task 2: `PracticeLens` type + persisted `practiceLensAtom`

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (add imports near top + atom after the `commonTonesWithNextAtom` block, ~line 477)
- Test: `src/store/practiceLensAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/store/practiceLensAtoms.test.ts` (add `practiceLensAtom` to the existing import from `./practiceLensAtoms`, and `createStorage`-backed default check):

```ts
describe("practiceLensAtom", () => {
  it("defaults to 'guide'", () => {
    const store = createStore();
    expect(store.get(practiceLensAtom)).toBe("guide");
  });

  it("accepts 'root' and 'common'", () => {
    const store = createStore();
    store.set(practiceLensAtom, "root");
    expect(store.get(practiceLensAtom)).toBe("root");
    store.set(practiceLensAtom, "common");
    expect(store.get(practiceLensAtom)).toBe("common");
  });

  it("discards a legacy invalid stored value, healing to 'guide'", () => {
    localStorage.setItem("fretflow:practiceLens", JSON.stringify("tones"));
    const store = createStore();
    expect(store.get(practiceLensAtom)).toBe("guide");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts`
Expected: FAIL — `practiceLensAtom` is not exported.

- [ ] **Step 3: Add the type and atom**

In `src/store/practiceLensAtoms.ts`, extend the existing top imports. Add `atomWithStorage` to the jotai import and pull storage helpers:

```ts
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, createStorage, enumValidator, GET_ON_INIT } from "../utils/storage";
```

(Keep the existing `import { atom } from "jotai";` — merge so there is a single jotai import line. The other existing imports in the file are unchanged.)

Then add, immediately after `commonTonesWithNextAtom` (after line 477):

```ts
/**
 * Improvisation lens — selects which predictive notes the fretboard emphasizes
 * during progression playback. Reintroduces the retired `practiceLens` storage
 * key, now pointed at voice-leading targeting (not the removed coloring lens).
 *
 *  - "guide"  (default): the next chord's 3rd/7th get the planning→landing ring.
 *  - "root":  the next chord's root gets the same ring (one target, label "R").
 *  - "common": notes shared with the next chord get a steady hold (no ring).
 */
export type PracticeLens = "guide" | "root" | "common";

const PRACTICE_LENS_VALUES = ["guide", "root", "common"] as const satisfies readonly PracticeLens[];

const practiceLensStorage = createStorage<PracticeLens>({
  validate: enumValidator(PRACTICE_LENS_VALUES),
});

export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "guide",
  practiceLensStorage,
  GET_ON_INIT,
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(lens): add persisted practiceLensAtom (guide/root/common)"
```

---

### Task 3: Lens-aware next-target atom (Root & Guide)

Generalize `nextChordGuideToneLabelsAtom` into `nextTargetToneLabelsAtom`, which reads `practiceLensAtom`. Keep a thin `nextChordGuideToneLabelsAtom` alias for existing callers/tests. Re-point `nextChordGuideTonesAtom` at the new atom's keys.

**Files:**
- Modify: `src/store/practiceLensAtoms.ts:254` (add the per-lens member map right after `GUIDE_TONE_RAW`)
- Modify: `src/store/practiceLensAtoms.ts:576-609` (rewrite the labels atom + alias + tones atom — `nextChordGuideToneLabelsAtom` at ~576, `nextChordGuideTonesAtom` at ~608)
- Test: `src/store/practiceLensAtoms.test.ts`

> Note: the `#546` countdown-ring commit did **not** change these two atoms — they are still guide-only and structurally identical to the original plan target. Only their line numbers moved (`GUIDE_TONE_RAW` is now at line 254, the labels atom at ~576). The rewrite below is unchanged in substance.

- [ ] **Step 1: Write the failing tests**

Append to `src/store/practiceLensAtoms.test.ts` (the file already imports `nextChordGuideTonesAtom`, `nextChordGuideToneLabelsAtom`, and has a `makeStore()` seeding `C major` with steps; add `nextTargetToneLabelsAtom` and `practiceLensAtom` to the imports). These tests seed a Dm7→G7 two-step progression so the "next" chord (G7) is deterministic:

```ts
describe("nextTargetToneLabelsAtom — lens-aware targets", () => {
  // Seed: active step Dm7 (degree ii in C major), next step G7 (degree V).
  // G7 = G B D F → guide tones B(3) F(b7); root G.
  function makeIIVStore() {
    const store = createStore();
    store.set(scaleNameAtom, "major");
    store.set(rootNoteAtom, "C");
    store.set(progressionStepsAtom, [
      { id: "s1", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "s2", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ] as ProgressionStep[]);
    store.set(activeProgressionStepIndexAtom, 0); // active = Dm7, next = G7
    return store;
  }

  it("guide lens → next chord's 3rd & 7th with interval labels", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "guide");
    const labels = store.get(nextTargetToneLabelsAtom);
    expect(new Set(labels.keys())).toEqual(new Set(["B", "F"])); // G7 3rd + b7
    expect(labels.get("B")).toBe("3");
    expect(labels.get("F")).toBe("b7");
  });

  it("root lens → next chord's root labeled 'R'", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "root");
    const labels = store.get(nextTargetToneLabelsAtom);
    expect(new Set(labels.keys())).toEqual(new Set(["G"]));
    expect(labels.get("G")).toBe("R");
  });

  it("common lens → empty map (no aim ring)", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "common");
    expect(store.get(nextTargetToneLabelsAtom).size).toBe(0);
  });

  it("nextChordGuideToneLabelsAtom is an alias of nextTargetToneLabelsAtom", () => {
    expect(nextChordGuideToneLabelsAtom).toBe(nextTargetToneLabelsAtom);
  });

  it("nextChordGuideTonesAtom tracks the active lens's target set", () => {
    const store = makeIIVStore();
    store.set(practiceLensAtom, "root");
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set(["G"]));
  });
});
```

Add `import type { ProgressionStep } from "../progressions/progressionDomain";` only if not already present (it is, per the file's existing imports).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts`
Expected: FAIL — `nextTargetToneLabelsAtom` is not exported.

- [ ] **Step 3: Add the per-lens member map**

In `src/store/practiceLensAtoms.ts`, just after `const GUIDE_TONE_RAW = new Set(["b3", "3", "b7", "7"]);` (line 254), add:

```ts
/**
 * Per-lens "aim" target member set, keyed by ChordDefinition member name. The
 * `common` lens has no aim ring, so it is absent here (handled in the atom).
 * Root's member is named "root" (not "1") in CHORD_DEFINITIONS.
 */
const TARGET_MEMBERS_BY_LENS: Record<"guide" | "root", Set<string>> = {
  guide: GUIDE_TONE_RAW, // 3rd & 7th — quality-defining "money notes"
  root: new Set(["root"]), // L1 — aim at the next chord's root
};
```

- [ ] **Step 4: Rewrite the labels atom, alias, and derived tones atom**

Replace the entire `nextChordGuideToneLabelsAtom` definition (~lines 576-595) and the `nextChordGuideTonesAtom` definition (~lines 608-609) with:

```ts
/**
 * Map of pitch-class → label for the chord at the *next* progression step,
 * filtered by the active improvisation lens ({@link practiceLensAtom}):
 *
 *  - "guide": the 3rd & 7th, labeled by interval ("3"/"b3", "b7"/"7"). Triads
 *    yield a single target (the 3rd); power chords yield an empty Map.
 *  - "root":  the root only, labeled "R". Always exactly one target.
 *  - "common": an empty Map — the Field lens has no aim ring; the common-hold
 *    branch in `getEmphasis` takes over.
 *
 * Also returns an empty Map when the progression is empty, the next step is
 * unavailable, or root/quality is missing. This is the canonical source for the
 * ring's target set; {@link nextChordGuideTonesAtom} derives its keys.
 */
export const nextTargetToneLabelsAtom = atom((get): Map<string, string> => {
  const lens = get(practiceLensAtom);
  if (lens === "common") return new Map(); // Field lens: no aim ring.
  const members = TARGET_MEMBERS_BY_LENS[lens];

  const steps = get(resolvedProgressionStepsAtom);
  if (steps.length === 0) return new Map();
  const active = get(displayedProgressionStepIndexAtom);
  if (active === steps.length - 1 && !get(progressionLoopEnabledAtom)) {
    return new Map();
  }
  const nextIndex = (active + 1) % steps.length;
  const step = steps[nextIndex];
  if (!step || step.unavailable || step.root === null || step.quality === null) {
    return new Map();
  }
  const def = CHORD_DEFINITIONS[step.quality];
  if (!def) return new Map();
  const rootIndex = NOTES.indexOf(step.root);
  if (rootIndex === -1) return new Map();
  const labels = new Map<string, string>();
  for (const member of def.members) {
    if (members.has(member.name)) {
      // Root lens shows "R"; guide lens shows the interval name ("3"/"b7").
      const label = lens === "root" ? "R" : member.name;
      labels.set(NOTES[(rootIndex + member.semitone) % 12], label);
    }
  }
  return labels;
});

/**
 * Back-compat alias. The previous name was guide-only; the emphasis pipeline
 * and external tests still reference it. It now resolves to the lens-aware
 * target map. Kept as a `const` alias (same atom reference).
 */
export const nextChordGuideToneLabelsAtom = nextTargetToneLabelsAtom;

/**
 * Pitch-class set of the active lens's aim targets for the *next* progression
 * step. Derived from {@link nextTargetToneLabelsAtom}'s keys. Empty for the
 * common lens (and every case the labels atom returns an empty Map).
 */
export const nextChordGuideTonesAtom = atom((get): Set<string> =>
  new Set(get(nextTargetToneLabelsAtom).keys()),
);
```

(`practiceLensAtom` is already in scope from Task 2; `CHORD_DEFINITIONS`, `NOTES`, `resolvedProgressionStepsAtom`, `displayedProgressionStepIndexAtom`, `progressionLoopEnabledAtom` are all already imported in this file.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm run test src/store/practiceLensAtoms.test.ts`
Expected: PASS (new tests + existing guide-tone tests still green, since `guide` is unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(lens): lens-aware nextTargetToneLabelsAtom for root/guide targets"
```

---

### Task 4: Common-hold emphasis branch in `getEmphasis`

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:9` (`TransitionRole`)
- Modify: `src/components/FretboardSVG/utils/semantics.ts:26-43` (`LeadLensContext` fields)
- Modify: `src/components/FretboardSVG/utils/semantics.ts:59-97` (`getEmphasis` branch + const)
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/FretboardSVG/utils/semantics.test.ts`. Add a helper that builds a full `LeadLensContext` so each test only overrides what it needs:

```ts
import type { PracticeLens } from "../../../store/practiceLensAtoms";

function makeLeadContext(overrides: Partial<LeadLensContext> = {}): LeadLensContext {
  return {
    notePc: "C",
    nextGuideTones: new Set(),
    nextGuideToneLabels: new Map(),
    nextChordTones: new Set(),
    incomingTones: new Set(),
    departingTones: new Set(),
    guideCountdownActive: false,
    lens: "guide" as PracticeLens,
    commonTones: new Set(),
    ...overrides,
  };
}

describe("getEmphasis — common-hold (Field lens)", () => {
  it("holds a common tone while the countdown window is open under the common lens", () => {
    const res = getEmphasis(
      "chord-tone-in-scale",
      false,
      makeLeadContext({
        notePc: "D",
        lens: "common",
        commonTones: new Set(["D", "F"]),
        guideCountdownActive: true,
      }),
    );
    expect(res.transitionRole).toBe("hold-common");
    expect(res.opacityBoost).toBe(1);
    expect(res.radiusBoost).toBeGreaterThan(1); // gentle size hold
  });

  it("does not hold a non-common note under the common lens", () => {
    const res = getEmphasis(
      "chord-tone-in-scale",
      false,
      makeLeadContext({
        notePc: "E",
        lens: "common",
        commonTones: new Set(["D", "F"]),
        guideCountdownActive: true,
      }),
    );
    expect(res.transitionRole).toBeUndefined();
  });

  it("does not hold when the countdown window is closed", () => {
    const res = getEmphasis(
      "chord-tone-in-scale",
      false,
      makeLeadContext({
        notePc: "D",
        lens: "common",
        commonTones: new Set(["D"]),
        guideCountdownActive: false,
      }),
    );
    expect(res.transitionRole).toBeUndefined();
  });

  it("does not hold common tones under the guide or root lens", () => {
    for (const lens of ["guide", "root"] as const) {
      const res = getEmphasis(
        "chord-tone-in-scale",
        false,
        makeLeadContext({
          notePc: "D",
          lens,
          commonTones: new Set(["D"]),
          guideCountdownActive: true,
        }),
      );
      expect(res.transitionRole).not.toBe("hold-common");
    }
  });
});
```

Note: the existing `getEmphasis - voice-leading emphasis` block in `semantics.test.ts` builds `LeadLensContext` objects from a shared `baseLeadContext` literal (~line 380) that has fields `notePc, nextGuideTones, nextGuideToneLabels, nextChordTones, incomingTones, departingTones, guideCountdownActive`. After Step 3 adds two **required** fields (`lens`, `commonTones`), that literal will fail to type-check. As part of Step 3, add `lens: "guide"` and `commonTones: new Set<string>()` to `baseLeadContext` (every spread context inherits them).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm run test src/components/FretboardSVG/utils/semantics.test.ts`
Expected: FAIL — `LeadLensContext` has no `lens`/`commonTones`; `getEmphasis` never returns `"hold-common"`.

- [ ] **Step 3: Extend the type, context, and `getEmphasis`**

In `src/components/FretboardSVG/utils/semantics.ts`:

(a) Add the import at the top (after the existing imports):

```ts
import type { PracticeLens } from "../../../store/practiceLensAtoms";
```

(b) Widen `TransitionRole` (line 9 — currently `export type TransitionRole = "guide-target";`):

```ts
export type TransitionRole = "guide-target" | "hold-common";
```

(c) Add the gentle-hold constant just below the `RADIUS_*` imports / above `getEmphasis` (anywhere at module scope; place it after the `BoxBound` type, ~line 7):

```ts
/** Gentle size hold for pivot/common tones under the Field lens. */
const COMMON_HOLD_RADIUS_BOOST = 1.15;
```

(d) Add two fields to `LeadLensContext` (inside the type, after the existing `guideCountdownActive: boolean;` field, ~line 40):

```ts
  /** Active improvisation lens — selects the emphasis mode. */
  lens: PracticeLens;
  /** Pitch classes shared between the active chord and the next (`active ∩ next`). */
  commonTones: Set<string>;
```

(e) In `getEmphasis`, after the single guide branch and **before** the final `return resting;` (~line 83), add the common-hold branch. Also extend the destructure (current line 69 is `const { notePc, nextGuideTones, nextGuideToneLabels, guideCountdownActive } = leadContext;`) to pull `lens` and `commonTones`:

```ts
  const { notePc, nextGuideTones, nextGuideToneLabels, guideCountdownActive, lens, commonTones } = leadContext;
```

```ts
  // Field lens: notes shared with the next chord get a steady hold (size +
  // full opacity, static ring) through the guide countdown window, showing
  // what survives the change. No drain/ticks — the ring path is quiet because
  // the common lens returns an empty target set; this branch supplies the cue.
  if (lens === "common" && guideCountdownActive && commonTones.has(notePc)) {
    return {
      radiusBoost: COMMON_HOLD_RADIUS_BOOST,
      opacityBoost: 1,
      transitionRole: "hold-common",
    };
  }
  return resting;
```

(f) Update the existing `baseLeadContext` literal in `semantics.test.ts` (~line 380, in the `getEmphasis - voice-leading emphasis` block) so it satisfies the two new required fields — add `lens: "guide"` and `commonTones: new Set<string>()`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm run test src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS (new common-hold tests + existing guide tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "feat(lens): common-hold emphasis branch in getEmphasis"
```

---

### Task 5: Thread `lens` + `commonTones` through `useEmphasisContext`

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useEmphasisContext.ts`
- Test: none new (covered by Task 6's integration test + existing FretboardSVG tests). This is a pure plumbing change.

- [ ] **Step 1: Add the atom reads and context fields**

This is a **targeted addition**, not a rewrite — the current file (post-#546) wires `guideCountdownActiveAtom` + `guideCountdownTickFractionsAtom`, which must be preserved. Replace the contents of `src/components/FretboardSVG/hooks/useEmphasisContext.ts` with (the only additions are the two `practiceLensAtoms` imports, the `PracticeLens` type, the two `EmphasisContext` fields, and the two `useAtomValue` reads — everything else is the current file verbatim):

```ts
import { useAtomValue } from "jotai";
import {
  nextChordGuideTonesAtom,
  nextChordGuideToneLabelsAtom,
  nextChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
  guideCountdownActiveAtom,
  guideCountdownTickFractionsAtom,
  commonTonesWithNextAtom,
  practiceLensAtom,
  type PracticeLens,
} from "../../../store/practiceLensAtoms";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";

export interface EmphasisContext {
  nextGuideTones: Set<string>;
  nextGuideToneLabels: Map<string, string>;
  nextChordTones: Set<string>;
  incomingTones: Set<string>;
  departingTones: Set<string>;
  guideCountdownActive: boolean;
  countdownTicks: number[];
  lens: PracticeLens;
  commonTones: Set<string>;
}

/**
 * Frame-stable emphasis context. Every field changes only at a step boundary
 * or the lead-in threshold — never per animation frame — so note emphasis
 * recomputes at most twice per step.
 */
export function useEmphasisContext(enabled: boolean): EmphasisContext | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const guideCountdownActive = useAtomValue(guideCountdownActiveAtom);
  const countdownTicks = useAtomValue(guideCountdownTickFractionsAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);
  const nextGuideToneLabels = useAtomValue(nextChordGuideToneLabelsAtom);
  const nextChordTones = useAtomValue(nextChordTonesAtom);
  const incomingTones = useAtomValue(incomingTonesAtom);
  const departingTones = useAtomValue(departingTonesAtom);
  const lens = useAtomValue(practiceLensAtom);
  const commonTones = useAtomValue(commonTonesWithNextAtom);
  if (!enabled || !playing) return null;
  return {
    nextGuideTones,
    nextGuideToneLabels,
    nextChordTones,
    incomingTones,
    departingTones,
    guideCountdownActive,
    countdownTicks,
    lens,
    commonTones,
  };
}
```

- [ ] **Step 2: Run the existing suite for this area**

Run: `pnpm run test src/components/FretboardSVG/`
Expected: PASS (no behavior change yet — `buildAnimatedFretboardNotes` ignores the new fields until Task 6). If a test constructs `EmphasisContext` literals directly and now fails to type-check, that is expected and fixed in Task 6 Step 3.

- [ ] **Step 3: Commit**

```bash
git add src/components/FretboardSVG/hooks/useEmphasisContext.ts
git commit -m "feat(lens): thread lens + commonTones through useEmphasisContext"
```

---

### Task 6: Copy `lens` + `commonTones` into the per-note `LeadLensContext`

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts:41-53` (build the context)
- Test: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` (create if absent) OR extend the existing FretboardSVG-area test. Check first: `ls src/components/FretboardSVG/hooks/`.

- [ ] **Step 1: Write the failing test**

The `#546` commit added `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` — it **already exists** and is store-driven (`makePlayingStore`, a `makeNote(overrides: Partial<NoteData>)` helper, etc.). **Append** the block below; use the **uniquely-named** helpers `makeLensTopologyNote` / `makeLensEmphasisContext` to avoid colliding with the existing `makeNote`. Note `makeLensEmphasisContext` uses the current `EmphasisContext` shape — `guideCountdownActive` + `countdownTicks`, **not** `leadInActive`/`planningActive`:

```ts
import { buildAnimatedFretboardNotes } from "./useAnimatedFretboardView";
import type { EmphasisContext } from "./useEmphasisContext";
import type { StaticFretboardTopologyNote } from "./useStaticFretboardTopology";

function makeLensTopologyNote(
  overrides: Partial<StaticFretboardTopologyNote> = {},
): StaticFretboardTopologyNote {
  return {
    stringIndex: 0,
    fretIndex: 5,
    noteName: "D",
    octave: 4,
    noteClass: "chord-tone-in-scale",
    displayName: "D",
    displayValue: "D",
    applyDimOpacity: false,
    isInRegion: true,
    isHidden: false,
    isTension: false,
    isGuideTone: false,
    ...overrides,
  } as StaticFretboardTopologyNote;
}

function makeLensEmphasisContext(
  overrides: Partial<EmphasisContext> = {},
): EmphasisContext {
  return {
    nextGuideTones: new Set(),
    nextGuideToneLabels: new Map(),
    nextChordTones: new Set(),
    incomingTones: new Set(),
    departingTones: new Set(),
    guideCountdownActive: false,
    countdownTicks: [],
    lens: "guide",
    commonTones: new Set(),
    ...overrides,
  };
}

describe("buildAnimatedFretboardNotes — Field lens wiring", () => {
  it("emits hold-common on a common tone under the common lens during the countdown", () => {
    const notes = buildAnimatedFretboardNotes({
      topology: [makeLensTopologyNote({ noteName: "D" })],
      hasChordOverlay: true,
      emphasisContext: makeLensEmphasisContext({
        lens: "common",
        commonTones: new Set(["D"]),
        guideCountdownActive: true,
      }),
    });
    expect(notes[0].transitionRole).toBe("hold-common");
    expect(notes[0].applyLensEmphasis.radiusBoost).toBeGreaterThan(1);
  });
});
```

Adjust the `makeLensTopologyNote` field set if `StaticFretboardTopologyNote` differs — open `src/components/FretboardSVG/hooks/useStaticFretboardTopology.ts` and match its shape exactly. If the existing test file already imports `buildAnimatedFretboardNotes` / `StaticFretboardTopologyNote`, drop the duplicate import lines.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: FAIL — `transitionRole` is `undefined` because `buildAnimatedFretboardNotes` doesn't yet pass `lens`/`commonTones` into the context, so the common branch never fires.

- [ ] **Step 3: Copy the new fields into `LeadLensContext`**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, inside `buildAnimatedFretboardNotes`, extend the `leadContext` literal (currently lines 43-51 — it has `guideCountdownActive`, not `leadInActive`/`planningActive`) to add the two fields:

```ts
      leadContext = {
        notePc: note.noteName,
        nextGuideTones: emphasisContext.nextGuideTones,
        nextGuideToneLabels: emphasisContext.nextGuideToneLabels,
        nextChordTones: emphasisContext.nextChordTones,
        incomingTones: emphasisContext.incomingTones,
        departingTones: emphasisContext.departingTones,
        guideCountdownActive: emphasisContext.guideCountdownActive,
        lens: emphasisContext.lens,
        commonTones: emphasisContext.commonTones,
      };
```

(`countdownTicks` lives on `EmphasisContext` for `FretboardNote`'s tick rendering — it is **not** part of `LeadLensContext`, so it is intentionally not copied here.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the signature-guard regression test**

Append to the same test file. This locks in that `hold-common` output flows through the existing `transitionRole` signature slot (so no new `renderedNoteSignature` field is needed):

```ts
import { buildRenderedFretboardNotes } from "./useAnimatedFretboardView";

describe("renderedNoteSignature — hold-common is not stale", () => {
  const fretCenterX = (i: number) => i * 10;
  const stringYAt = () => 20;

  it("rebuilds the note object when emphasis flips to hold-common", () => {
    const restingNotes = buildAnimatedFretboardNotes({
      topology: [makeLensTopologyNote({ noteName: "D" })],
      hasChordOverlay: true,
      emphasisContext: makeLensEmphasisContext({ lens: "common", commonTones: new Set(["D"]) }),
    });
    const before = buildRenderedFretboardNotes({ noteData: restingNotes, fretCenterX, stringYAt })[0];

    const holdNotes = buildAnimatedFretboardNotes({
      topology: [makeLensTopologyNote({ noteName: "D" })],
      hasChordOverlay: true,
      emphasisContext: makeLensEmphasisContext({
        lens: "common",
        commonTones: new Set(["D"]),
        guideCountdownActive: true,
      }),
    });
    const after = buildRenderedFretboardNotes({ noteData: holdNotes, fretCenterX, stringYAt })[0];

    // Different transitionRole ⇒ different signature ⇒ NOT the same cached object.
    expect(after).not.toBe(before);
    expect(after.transitionRole).toBe("hold-common");
  });
});
```

Run: `pnpm run test src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts
git commit -m "feat(lens): wire lens + commonTones into per-note emphasis context"
```

---

### Task 7: Render the common-hold ring in `FretboardNote`

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx:84` (`guidePhase` mapping — currently a 1-way ternary post-#546)
- Modify: `src/components/FretboardSVG/FretboardNote.tsx:247` (suppress beat-tick notches on hold rings)
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/FretboardSVG/FretboardNote.test.tsx` (the file already has `makeNote` / `renderNote` helpers). `renderNote` does not pass `countdownTicks`, so add a thin wrapper that does — used by the "no ticks" assertion:

```ts
import { render } from "@testing-library/react";

function renderNoteWithTicks(note: RenderedFretboardNote, countdownTicks: number[]) {
  return render(
    <svg>
      <FretboardNote
        note={note}
        noteBubblePx={40}
        displayFormat="notes"
        countdownTicks={countdownTicks}
      />
    </svg>,
  );
}

describe("FretboardNote — common-hold ring", () => {
  it("maps transitionRole 'hold-common' to data-guide-phase='hold' on the ring", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "hold-common",
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
    );
    const ring = container.querySelector('g[data-guide-ring="true"]');
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("data-guide-phase")).toBe("hold");
  });

  it("renders no interval label for a common-hold note (no guideTargetLabel)", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "hold-common",
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
    );
    expect(container.querySelector('[data-guide-label="true"]')).toBeNull();
  });

  it("renders NO beat-tick notches on a hold ring (ticks belong to the guide countdown)", () => {
    const { container } = renderNoteWithTicks(
      makeNote({
        transitionRole: "hold-common",
        isInRegion: true,
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
      [0.25, 0.5, 0.75],
    );
    expect(container.querySelector('[data-guide-tick="true"]')).toBeNull();
  });

  it("still renders beat-tick notches on a guide-target (landing) ring", () => {
    const { container } = renderNoteWithTicks(
      makeNote({
        transitionRole: "guide-target",
        isInRegion: true,
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, guideTargetLabel: "3" },
      }),
      [0.25, 0.5, 0.75],
    );
    expect(container.querySelector('[data-guide-tick="true"]')).not.toBeNull();
  });

  it("applies the size hold via --emph-scale", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "hold-common",
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
    );
    const g = container.querySelector("g[data-note-shape]") as SVGGElement;
    expect(g.style.getPropertyValue("--emph-scale")).toBe("1.15");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: FAIL — `guidePhase` is `undefined` for `hold-common` (no ring renders), and the hold ring would render ticks since the tick gate is currently `note.isInRegion && ...`.

- [ ] **Step 3: Map `hold-common` → `"hold"` and suppress ticks on hold rings**

(a) In `src/components/FretboardSVG/FretboardNote.tsx`, replace the current 1-way `guidePhase` ternary (line 84 — `const guidePhase = transitionRole === "guide-target" ? "landing" : undefined;`) with:

```ts
  const guidePhase =
    transitionRole === "guide-target"
      ? "landing"
      : transitionRole === "hold-common"
        ? "hold"
        : undefined;
```

(b) Suppress the beat-tick notches on the hold ring. In the tick-rendering block (line ~247, currently `{note.isInRegion &&` `countdownTicks?.map(...)}`), tighten the gate to the landing phase so a `"hold"` ring never draws countdown ticks:

```tsx
            {guidePhase === "landing" &&
              note.isInRegion &&
              countdownTicks?.map((f, i) => {
```

No other change is needed: the existing `{guidePhase && (...)}` blocks render the backing circle and the ring group with `data-guide-phase={guidePhase}` (`"hold"`), and `guideTargetLabel` is absent for common notes so the label block stays empty. The drain / loom / flash animations are CSS-gated to `[data-guide-phase="landing"]` only, so `"hold"` is naturally static.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS (new tests + existing guide-phase tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNote.test.tsx
git commit -m "feat(lens): render static common-hold ring (data-guide-phase=hold)"
```

---

### Task 8: Static `[data-guide-phase="hold"]` CSS

The ring group already paints a solid halo + core from the base rules; `hold` simply gets no animation. The base `.note-target-backing` rule (line 227) sets only fill/stroke/pointer-events — opacity defaults to `1` and is overridden per-phase (only `[data-guide-phase="landing"]` exists post-#546, at line 233, opacity `0.52`). Add a calm backing opacity for `hold`.

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css` (after the `[data-guide-phase="landing"]` backing rule, line 233-235)
- Test: visual regression (Task 11). CSS Modules are not unit-tested directly.

- [ ] **Step 1: Add the hold backing opacity**

In `src/components/FretboardSVG/FretboardSVG.module.css`, after the `.note-target-backing[data-guide-phase="landing"]` rule (lines 233-235), add:

```css
/* Common-hold (Field lens) — a calm, STATIC anchor: same incoming-hue backing,
   no contraction. The ring core/halo inherit the base static stroke; the
   drain/loom/flash/tick keyframes are gated to [data-guide-phase="landing"],
   so "hold" shows a steady ring with no animation. No new colour or shape. */
.note-target-backing[data-guide-phase="hold"] {
  opacity: 0.42;
}
```

- [ ] **Step 2: Verify the static-ring intent (no new animation rules needed)**

Confirm by reading the drain/loom/flash/tick selectors (lines ~289, ~310, ~334, ~343): each is scoped to `[data-guide-phase="landing"][data-guide-primary="true"]`. `hold` matches none, so the core renders as the static base ring. No additional CSS required.

- [ ] **Step 3: Run lint (stylelint is wired into `pnpm run lint`)**

Run: `pnpm run lint`
Expected: PASS (no stylelint errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(lens): static common-hold ring styling (calm backing, no animation)"
```

---

### Task 9: i18n strings for the lens selector

**Files:**
- Modify: `src/i18n/types.ts` (after `voicingClose`, line 87)
- Modify: `src/i18n/en.ts` (after `voicingClose`, line 89)
- Modify: `src/i18n/es.ts` (after `voicingClose`, line 89)
- Test: existing i18n parity test if present (`ls src/i18n/*.test.ts`); otherwise the `pnpm run build` type-check enforces parity via the `TranslationStrings` type.

- [ ] **Step 1: Add the keys to the type**

In `src/i18n/types.ts`, inside the `inspector` block after `voicingClose: string;` (line 87), add:

```ts
    lensLabel: string;
    lensRoot: string;
    lensGuide: string;
    lensCommon: string;
```

- [ ] **Step 2: Run the type-check to verify it fails**

Run: `pnpm run build`
Expected: FAIL — `en.ts` and `es.ts` are missing the four new required keys.

- [ ] **Step 3: Add the English strings**

In `src/i18n/en.ts`, after `voicingClose: "Close",` (line 89), add:

```ts
    lensLabel: "Lens",
    lensRoot: "Root",
    lensGuide: "Guide",
    lensCommon: "Common",
```

- [ ] **Step 4: Add the Spanish strings**

In `src/i18n/es.ts`, after `voicingClose: "Cerrado",` (line 89), add:

```ts
    lensLabel: "Lente",
    lensRoot: "Tónica",
    lensGuide: "Guía",
    lensCommon: "Comunes",
```

- [ ] **Step 5: Run the type-check to verify it passes**

Run: `pnpm run build`
Expected: PASS (type-check passes; full build completes).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(lens): i18n strings for the improvisation lens selector"
```

---

### Task 10: Lens `ToggleBar` in `ChordOverlayControls`

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` (uses the existing `renderDegree` helper and seeds). Import `practiceLensAtom` and `axe` (already imported):

```ts
import { practiceLensAtom } from "../../store/practiceLensAtoms";

describe("ChordOverlayControls — lens selector", () => {
  it("renders the three lens chips", () => {
    renderDegree();
    expect(screen.getByRole("button", { name: "Root" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Common" })).toBeInTheDocument();
  });

  it("defaults to the guide chip pressed", () => {
    renderDegree();
    expect(screen.getByRole("button", { name: "Guide" })).toHaveAttribute("aria-pressed", "true");
  });

  it("writes practiceLensAtom when a chip is clicked", async () => {
    const store = createStore();
    renderWithStore(<ChordOverlayControls />, store, [...DEGREE_SEEDS] as never);
    await userEvent.click(screen.getByRole("button", { name: "Root" }));
    expect(store.get(practiceLensAtom)).toBe("root");
  });

  it("has no a11y violations with the lens bar present", async () => {
    const { container } = renderDegree();
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

Check `renderWithStore`'s signature in `src/test-utils/renderWithAtoms.tsx` (line 56) and adjust the call if it differs (it may take `(ui, store, seeds)` or `(ui, { store, seeds })`). Match the existing usage elsewhere in this same test file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: FAIL — no lens chips render.

- [ ] **Step 3: Add the lens `ToggleBar`**

Replace the contents of `src/components/ChordOverlayControls/ChordOverlayControls.tsx` with:

```tsx
import { useAtom, useAtomValue } from "jotai";
import {
  chordTypeAtom,
  voicingAtom,
} from "../../store/chordOverlayAtoms";
import { practiceLensAtom, type PracticeLens } from "../../store/practiceLensAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { VoicingControl } from "./VoicingControl";
import { ChordStringSetToggleBar } from "./ChordStringSetToggleBar";
import panelStyles from "./ChordOverlayControls.module.css";

export function ChordOverlayControls() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const voicing = useAtomValue(voicingAtom);
  const [lens, setLens] = useAtom(practiceLensAtom);

  const hasActiveChord = Boolean(chordType);

  const lensOptions: ReadonlyArray<{ value: PracticeLens; label: string }> = [
    { value: "root", label: t("inspector.lensRoot") },
    { value: "guide", label: t("inspector.lensGuide") },
    { value: "common", label: t("inspector.lensCommon") },
  ];

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={12} className={panelStyles.grid}>
        <Prop label={t("inspector.voicingLabel")} span={3}>
          <VoicingControl />
        </Prop>
        <Prop label={t("inspector.lensLabel")} span={9}>
          <ToggleBar
            variant="chip"
            options={lensOptions}
            value={lens}
            onChange={setLens}
            label={t("inspector.lensLabel")}
          />
        </Prop>
        {voicing === "close" && hasActiveChord ? (
          <Prop label={t("inspector.chordStringSetLabel")} span={12}>
            <ChordStringSetToggleBar />
          </Prop>
        ) : null}
      </PropGrid>
    </div>
  );
}
```

(The string-set `Prop` span widens to `12` since the lens row now occupies the first row's remaining 9 columns. Verify the visual fit in Task 11; if the grid wraps oddly, adjust spans but keep the lens bar on its own row.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordOverlayControls/ChordOverlayControls.tsx src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
git commit -m "feat(lens): lens ToggleBar in ChordOverlayControls"
```

---

### Task 11: Full verification + visual regression snapshots

**Files:**
- Modify (regenerated): `e2e/**/__snapshots__/*` (darwin baselines locally; linux baselines via the cross-platform updater)
- Possibly add: a static Inspector lens-selector scenario (see Step 2 — the playback ring is NOT statically snapshot-able post-#546)

- [ ] **Step 1: Run the full gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all PASS. Fix any failures before proceeding. The `guide` default means all existing unit/component tests must remain green.

- [ ] **Step 2: Add a static lens-selector scenario (NOT the playback ring)**

**Important (per #546):** the static visual-regression suite **does not capture the playback-active guide ring** — the rings/holds only render while a progression is *playing*, which the static snapshots don't exercise. So do **not** try to snapshot the Root/Common rings; that coverage is the manual check in Step 6.

What the static suite *can* cover is the **Inspector lens selector** (the new ToggleBar). Inspect `e2e/app-components.spec.ts` / `e2e/app-overlays.spec.ts` for how the Inspector/ChordOverlayControls is rendered. Add (or extend) a scenario that shows the Overlay tab's Chord card with the lens ToggleBar present and the default `guide` chip pressed. Keep every *existing* scenario's state identical so its baseline does not churn.

- [ ] **Step 3: Refresh darwin snapshots**

Run: `pnpm run test:visual:update`
Expected: snapshots written/updated under `e2e/**/__snapshots__/`. Review the diff: pre-existing baselines should change **only** where the Inspector now shows the lens row (the ChordOverlayControls scenarios). If an unrelated fretboard baseline changes, investigate before accepting — the lens default is `guide`, so the board itself must be unaffected.

- [ ] **Step 4: Refresh linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: matching linux `.png` baselines for the new scenarios (CI runs linux; missing baselines fail CI).

- [ ] **Step 5: Run the production visual suite to confirm green**

Run: `pnpm run test:visual`
Expected: PASS against the refreshed baselines.

- [ ] **Step 6: Manual smoke test (per spec Rollout/Verification)**

Run: `pnpm run dev`, then at a moderate BPM with a ii→V (or any) progression playing:
  - **Root:** the single countdown ring drains on the **next chord's root**, label `R`, with beat-tick notches.
  - **Guide:** unchanged — countdown ring on the next 3rd/7th, labels `3`/`b7`, with notches.
  - **Common:** at a Dm7→G7 change, the shared D and F show a steady hold (size + static ring) through the countdown window; **no drain and no beat-tick notches**.
  - Switch lenses mid-playback: the cue swaps at the next step.
  - Stop playback: the fretboard renders exactly as before (lenses are playback-only).

- [ ] **Step 7: Commit the snapshots**

```bash
git add e2e
git commit -m "test(lens): visual regression scenarios for root/guide/common lenses"
```

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|------------------|------|
| Mode atom `practiceLensAtom` (default `guide`, persisted) | Task 2 |
| Reintroduce retired `practiceLens` key | Task 1 (+ Task 2 validated adapter) |
| `TARGET_MEMBERS_BY_LENS` + lens-aware `nextTargetToneLabelsAtom` + alias | Task 3 |
| Root lens: one target, label `R`, ring path reused verbatim | Task 3 + Task 7 (no ring change) |
| Guide lens unchanged (default) | Tasks 2-3 (guide branch untouched) |
| `TransitionRole` gains `hold-common` | Task 4 |
| `LeadLensContext` gains `lens` + `commonTones` | Task 4 |
| `getEmphasis` common-hold branch (during the countdown window) | Task 4 |
| `commonTonesWithNextAtom` becomes a real consumer | Task 5 |
| Thread context through `useEmphasisContext` (preserving `guideCountdownActive`/`countdownTicks`) | Task 5 |
| Copy fields in `buildAnimatedFretboardNotes` | Task 6 |
| Stale-render guard (signature) | Task 6 (verified no new field needed) |
| `FretboardNote` hold ring `data-guide-phase="hold"` + tick suppression | Task 7 |
| CSS static hold ring | Task 8 |
| UI selector (ToggleBar) | Task 10 |
| i18n `lensLabel` + `lens.{root,guide,common}` (en/es/types) | Task 9 |
| `COMMON_HOLD_RADIUS_BOOST ≈ 1.15` | Task 4 |
| Edge cases (power chord root, no common tones, last step, not playing) | Covered by atom logic (Tasks 3-5); tested in Tasks 3-4 |
| Testing: pure/atom, emphasis, component, signature, visual, a11y | Tasks 2-11 |

Future Work (L4 approach-note lens, leveled auto-advance) is explicitly out of scope — no task, correct.

**2. Placeholder scan:** No `TBD`/`add appropriate…`/"similar to Task N" — every code step shows complete code. The i18n key naming was flattened to `lensRoot`/`lensGuide`/`lensCommon` (the spec wrote `inspector.lens.{root,guide,common}`); both are valid, and the flat form matches the existing `voicingOff`/`voicingFull`/`voicingClose` convention in this codebase.

**3. Type consistency:**
- `PracticeLens` defined once (Task 2), imported by `semantics.ts` (Task 4), `useEmphasisContext.ts` (Task 5), `ChordOverlayControls.tsx` (Task 10).
- `nextTargetToneLabelsAtom` (Task 3) is the canonical name; `nextChordGuideToneLabelsAtom` is its alias; `nextChordGuideTonesAtom` derives from it. `useEmphasisContext` consumes the alias + the tones atom (unchanged import names).
- `EmphasisContext` (Task 5) and `LeadLensContext` (Task 4) both gain exactly `lens` + `commonTones` — **added alongside** the countdown-model fields (`guideCountdownActive` on both; `countdownTicks` on `EmphasisContext` only). `buildAnimatedFretboardNotes` copies `guideCountdownActive` + `lens` + `commonTones` into `LeadLensContext` (NOT `countdownTicks`, which is consumed by `FretboardNote` directly). Task 6.
- The Common-hold branch triggers on **`guideCountdownActive`** (the single post-#546 window), consistently across the `getEmphasis` branch (Task 4), the test helpers (Tasks 4 & 6), and the manual check (Task 11).
- `transitionRole` value `"hold-common"` (Task 4) → `guidePhase` `"hold"` (Task 7) → CSS `[data-guide-phase="hold"]` (Task 8). Beat-tick notches are gated to `guidePhase === "landing"` (Task 7), so `"hold"` rings carry none. Consistent across the chain.
- `COMMON_HOLD_RADIUS_BOOST = 1.15` (Task 4) is asserted as `> 1` in Task 4 tests and `=== 1.15` indirectly via the component test in Task 7 (which passes `radiusBoost: 1.15` explicitly).

**Spec deviation (documented):** Root target member is `"root"`, not the spec's `"1"`, matching `CHORD_DEFINITIONS` in this codebase. Label remains `"R"`.

**Codebase-drift reconciliation (commit `52372b0f` / #546):** the plan was rebased from the two-phase guide model onto the single continuous countdown model. Verified post-rebase: (a) `TransitionRole` starts as `"guide-target"` only → plan widens to `"guide-target" | "hold-common"` (the removed `"guide-preview"` is not reintroduced); (b) `LeadLensContext` / `EmphasisContext` carry `guideCountdownActive` (+ `countdownTicks` on the latter), which the plan preserves; (c) `getEmphasis`'s common branch keys off `guideCountdownActive`; (d) `FretboardNote.guidePhase` is a 1-way ternary the plan extends; (e) the new beat-tick notch render is suppressed on hold rings; (f) the static visual suite can't capture the playback ring — Task 11 snapshots the Inspector selector instead and relies on the manual check for the rings. Atoms `nextChordGuideToneLabelsAtom` / `nextChordGuideTonesAtom` were unchanged by #546, so Task 3's rewrite still applies (line numbers updated).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-improvisation-lenses.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
