# Controls Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Inspector controls so each tab is self-contained, replace the hidden fingering↔chord couplings with one explicit opt-in "Scope to position" toggle, relocate Chord Spread into the Chord tab, and make the Voicing section collapsible.

**Architecture:** Re-parent `FingeringPatternControls` from `ViewTab` to `ScaleTab`. Split the single fingering `ToggleBar` into two labeled clusters (Position / String study) backed by the same `fingeringPatternAtom`. Introduce two persisted atoms (`chordScopeToPositionAtom`, `voicingSectionExpandedAtom`) plus a derived `activePositionAtom`; rewire the existing CAGED-position scoping in `useFretboardState` and the chord-tone box-bounds clamp in `useNoteData` to gate on the new toggle. Remove `isChordOverlayPatternDisabled` and every consumer of it. Render Chord Spread and the new toggle inside a collapsible VOICING section in `ChordOverlayControls`; delete `ChordLayoutSettingsSection` and the `chordSpread` `SettingsOverlay` wiring.

**Tech Stack:** React 19 + TypeScript, Jotai (`atomWithStorage` via `src/utils/storage.ts`), Vitest + Testing Library, CSS Modules, `clsx`, `motion/react`. Commands: `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b`.

---

## File Structure

**Created:**
- `src/store/chordScope.ts` — `chordScopeToPositionAtom`, `voicingSectionExpandedAtom`, `activePositionAtom`.
- `src/store/chordScope.test.ts` — unit tests for the three atoms.

**Modified:**
- `src/store/fingeringAtoms.ts` — remove `isChordOverlayPatternDisabled`.
- `src/store/atoms.ts` — re-export the three new atoms; drop `isChordOverlayPatternDisabled`.
- `src/store/actions.ts`, `src/store/chordOverlayAtoms.ts`, `src/store/practiceLensAtoms.ts`, `src/store/progressionAtoms.ts` — drop the `isChordOverlayPatternDisabled` import + every branch that calls it.
- `src/hooks/useFretboardState.ts` — gate `selectFullChordMatchesForCagedPosition` on the new scope atom + `activePositionAtom`; expose a derived `chordBoxBounds` (null when scope off / no active position).
- `src/components/FretboardSVG/FretboardSVG.tsx`, `src/components/FretboardSVG/hooks/useNoteData.ts`, `src/components/Fretboard/Fretboard.tsx` — accept a new `chordBoxBounds` prop and use it (instead of `boxBounds`) in the chord-tone fret-range clamp.
- `src/components/FingeringPatternControls/FingeringPatternControls.tsx` — split the pattern selector into two labeled clusters; same atom write contract.
- `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx` — new cluster expectations.
- `src/components/FingeringPatternControls/FingeringPatternControls.module.css` — cluster layout.
- `src/components/Inspector/ScaleTab.tsx`, `src/components/Inspector/ScaleTab.module.css`, `src/components/Inspector/ScaleTab.test.tsx` — render `FingeringPatternControls` inside a `PropGrid` row above the 3-col Key/Wheel/Theory grid.
- `src/components/Inspector/ViewTab.tsx`, `src/components/Inspector/ViewTab.test.tsx` — remove `FingeringPatternControls`.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx`, `…test.tsx`, `…module.css` — remove disabled-panel branch; render Chord Spread + Scope-to-position inside a collapsible VOICING `<details>` section.
- `src/components/SettingsOverlay/SettingsOverlay.tsx`, `constants.ts`, `types.ts`, `useSettingsForm.ts` — drop the `chordSpread` field + section.
- `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/types.ts` — new keys (`positionCluster`, `stringStudyCluster`, `scopeToPosition`, `scopeToPositionHint`, `scopeToPositionNeedsPosition`, `voicingSection`, `chordSpread`); remove `controls.chordOverlayDisabled`.

**Deleted:**
- `src/components/SettingsOverlay/sections/ChordLayoutSettingsSection.tsx`.

---

## Task 1: Add new atoms (`chordScopeToPositionAtom`, `voicingSectionExpandedAtom`, `activePositionAtom`)

**Files:**
- Create: `src/store/chordScope.ts`
- Create: `src/store/chordScope.test.ts`
- Modify: `src/store/atoms.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/chordScope.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import {
  chordScopeToPositionAtom,
  voicingSectionExpandedAtom,
  activePositionAtom,
} from "./chordScope";
import { fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "./fingeringAtoms";

describe("chordScope atoms", () => {
  let store: ReturnType<typeof createStore>;
  beforeEach(() => {
    store = createStore();
  });

  it("chordScopeToPositionAtom defaults to false", () => {
    expect(store.get(chordScopeToPositionAtom)).toBe(false);
  });

  it("voicingSectionExpandedAtom defaults to false (collapsed)", () => {
    expect(store.get(voicingSectionExpandedAtom)).toBe(false);
  });

  it("activePositionAtom is false when fingering is 'none'", () => {
    store.set(fingeringPatternAtom, "none");
    expect(store.get(activePositionAtom)).toBe(false);
  });

  it("activePositionAtom is true when a single CAGED shape is selected", () => {
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set(["C"]));
    expect(store.get(activePositionAtom)).toBe(true);
  });

  it("activePositionAtom is false when multiple CAGED shapes are selected", () => {
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set(["C", "A"]));
    expect(store.get(activePositionAtom)).toBe(false);
  });

  it("activePositionAtom is true when fingering is 3nps and npsPosition > 0", () => {
    store.set(fingeringPatternAtom, "3nps");
    store.set(npsPositionAtom, 1);
    expect(store.get(activePositionAtom)).toBe(true);
  });

  it("activePositionAtom is false for one-string / two-strings", () => {
    store.set(fingeringPatternAtom, "one-string");
    expect(store.get(activePositionAtom)).toBe(false);
    store.set(fingeringPatternAtom, "two-strings");
    expect(store.get(activePositionAtom)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/chordScope.test.ts`
Expected: FAIL — module `./chordScope` does not exist.

- [ ] **Step 3: Implement the atoms**

Create `src/store/chordScope.ts`:

```ts
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, GET_ON_INIT, createStorage } from "../utils/storage";
import { cagedShapesAtom, fingeringPatternAtom, npsPositionAtom } from "./fingeringAtoms";

const boolStorage = createStorage<boolean>({
  serialize: (v) => JSON.stringify(v),
  deserialize: (v) => v === "true",
});

/**
 * The single, explicit fingering↔chord coupling: when on AND
 * `activePositionAtom` resolves true, the chord overlay (loose chord-tone
 * highlighting + voicing-engine output) is constrained to the active
 * fingering position's fret window. Default off.
 */
export const chordScopeToPositionAtom = atomWithStorage<boolean>(
  k("chordScopeToPosition"),
  false,
  boolStorage,
  GET_ON_INIT,
);

/**
 * Persisted collapsed/expanded state for the Chord-tab VOICING section.
 * Default collapsed — the simpler reading is the common case.
 */
export const voicingSectionExpandedAtom = atomWithStorage<boolean>(
  k("voicingSectionExpanded"),
  false,
  boolStorage,
  GET_ON_INIT,
);

/**
 * True when the fingering mode resolves to a single, identifiable position:
 *   - `caged` with exactly one shape selected
 *   - `3nps` with a position > 0
 * `none`, multi-shape CAGED, and the String-study modes have no single
 * position — `activePositionAtom` is false in those cases.
 */
export const activePositionAtom = atom((get) => {
  const pattern = get(fingeringPatternAtom);
  if (pattern === "caged") return get(cagedShapesAtom).size === 1;
  if (pattern === "3nps") return get(npsPositionAtom) > 0;
  return false;
});
```

- [ ] **Step 4: Re-export from the barrel**

Modify `src/store/atoms.ts` — add the re-exports near the other chord-overlay exports. Find the existing `chordOverlayAtoms` re-export block and add a new line:

```ts
export {
  chordScopeToPositionAtom,
  voicingSectionExpandedAtom,
  activePositionAtom,
} from "./chordScope";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/store/chordScope.test.ts`
Expected: PASS — all 7 cases green.

- [ ] **Step 6: Commit**

```bash
git add src/store/chordScope.ts src/store/chordScope.test.ts src/store/atoms.ts
git commit -m "feat(controls-overhaul): add chord-scope + voicing-section atoms"
```

---

## Task 2: Add i18n keys

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Extend the types**

In `src/i18n/types.ts`:

- Add to the `inspector` block: `positionCluster: string;`, `stringStudyCluster: string;`, `voicingSection: string;`, `scopeToPosition: string;`, `scopeToPositionHint: string;`, `scopeToPositionNeedsPosition: string;`, `chordSpread: string;`, `chordSpreadHint: string;`.
- Remove `controls.chordOverlayDisabled` from the `controls` block.

The `settings.fields.chordSpread` and `settings.fields.chordSpreadHint` keys are now obsolete (Task 11 deletes the Settings field). Either repurpose by keeping them and pointing the new `inspector.chordSpread*` to the same strings, or remove the `settings.fields` ones. Choose remove + add to `inspector` for clarity; update the type accordingly.

- [ ] **Step 2: Add English strings**

In `src/i18n/en.ts`, inside the `inspector` block append:

```ts
positionCluster: "Position",
stringStudyCluster: "String study",
voicingSection: "Voicing",
scopeToPosition: "Scope to position",
scopeToPositionHint: "Constrain the chord to the active fingering position.",
scopeToPositionNeedsPosition: "Pick a single CAGED shape or a 3NPS position to enable.",
chordSpread: "Chord Spread",
chordSpreadHint: "How far chord tones may span across frets.",
```

In the `controls` block remove the `chordOverlayDisabled` line. In `settings.fields`, remove `chordSpread` and `chordSpreadHint`.

- [ ] **Step 3: Add Spanish strings**

In `src/i18n/es.ts`, inside the `inspector` block append:

```ts
positionCluster: "Posición",
stringStudyCluster: "Estudio en cuerdas",
voicingSection: "Voicing",
scopeToPosition: "Limitar a la posición",
scopeToPositionHint: "Restringe el acorde a la posición de digitación activa.",
scopeToPositionNeedsPosition: "Elige una forma CAGED única o una posición 3NPS para activarlo.",
chordSpread: "Extensión de acorde",
chordSpreadHint: "Hasta dónde pueden extenderse los tonos del acorde entre trastes.",
```

In `controls` remove `chordOverlayDisabled`. In `settings.fields` remove `chordSpread` + `chordSpreadHint`.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc -b`
Expected: PASS — no missing-key errors in i18n usage (the consumers we are about to touch all still typecheck before this task is consumed because the deletions/additions match the consumer changes in later tasks; but `controls.chordOverlayDisabled` is still referenced in `ChordOverlayControls.tsx:199`). **Therefore this task's tsc will fail unless Task 4 runs in the same commit boundary** — bundle Task 2 + Task 4 in one PR-coherent step (do not push between them) OR run typecheck only after Task 4. Skip the standalone tsc run here.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(controls-overhaul): i18n keys for scope-to-position, cluster labels, Chord Spread"
```

---

## Task 3: Remove `isChordOverlayPatternDisabled` from every store consumer

**Files:**
- Modify: `src/store/fingeringAtoms.ts`
- Modify: `src/store/chordOverlayAtoms.ts`
- Modify: `src/store/actions.ts`
- Modify: `src/store/practiceLensAtoms.ts`
- Modify: `src/store/progressionAtoms.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/store/chordOverlayAtoms.test.ts` (or create if missing — the project keeps store tests in `src/store/`):

```ts
import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { chordTonesAtom } from "./chordOverlayAtoms";
import { rootNoteAtom } from "./scaleAtoms";

describe("chord overlay is independent of fingering pattern", () => {
  it("chord tones still render with one-string fingering", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(fingeringPatternAtom, "one-string");
    // a chord must be active for the test — set a triad via the atoms
    // exposed by this store; if the existing test file already sets one,
    // reuse that helper. The expectation is non-empty output.
    expect(store.get(chordTonesAtom)).not.toEqual([]);
  });
});
```

If the project's store-test helpers differ (e.g. a `setChord` action), use them. The point: with `one-string` active the chord tones are *not* gated to `[]`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts`
Expected: FAIL — `chordTonesAtom` currently returns `[]` whenever `isChordOverlayPatternDisabled(pattern)` is true (via the wiring in `chordOverlayAtoms.ts:208`, `practiceLensAtoms.ts:195`, `progressionAtoms.ts:323`, `actions.ts:64`).

- [ ] **Step 3: Remove the helper from `fingeringAtoms.ts`**

Delete lines 21-23 of `src/store/fingeringAtoms.ts`:

```ts
export function isChordOverlayPatternDisabled(pattern: FingeringPattern): boolean {
  return pattern === "one-string" || pattern === "two-strings";
}
```

- [ ] **Step 4: Remove the call site in `chordOverlayAtoms.ts`**

Open `src/store/chordOverlayAtoms.ts`. At the import block (line 48) drop `isChordOverlayPatternDisabled`. At line 208 the surrounding atom currently AND's `!isChordOverlayPatternDisabled(get(fingeringPatternAtom)) && …`. Delete that conjunct so the remaining expression no longer depends on the fingering pattern. Read the file context first to choose the right edit; the rest of the expression stays.

- [ ] **Step 5: Remove the call site in `actions.ts`**

Open `src/store/actions.ts`. Drop the import (line 30). Around line 64 the code is:

```ts
if (isChordOverlayPatternDisabled(pattern)) {
  return; // or sets chord mode off
}
```

Delete that early-return block entirely. The action body that follows runs in every fingering mode.

- [ ] **Step 6: Remove the call site in `practiceLensAtoms.ts`**

Open `src/store/practiceLensAtoms.ts`. Drop the import (line 57). At line 195 the same pattern (`!isChordOverlayPatternDisabled(…) && …`) — drop the conjunct.

- [ ] **Step 7: Remove the call site in `progressionAtoms.ts`**

Open `src/store/progressionAtoms.ts`. Drop the import (line 27). Around line 323 the code returns early when the helper is true — delete that early return.

- [ ] **Step 8: Run the new + existing store tests**

Run: `pnpm vitest run src/store/`
Expected: PASS — the failing case from Step 1 now succeeds; no other store tests regress.

- [ ] **Step 9: Commit**

```bash
git add src/store/
git commit -m "feat(controls-overhaul): remove isChordOverlayPatternDisabled and its consumers"
```

---

## Task 4: Remove the `isPatternDisabled` branch from `ChordOverlayControls`

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.module.css`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

In `ChordOverlayControls.test.tsx` add:

```tsx
it("does not disable any control when fingering is one-string", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialAtoms: [[fingeringPatternAtom, "one-string"]],
  });
  // The whole panel must NOT render the data-disabled attribute.
  expect(screen.queryByText(/chord overlay disabled/i)).toBeNull();
  expect(
    document.querySelector("[data-disabled=\"true\"]"),
  ).toBeNull();
});
```

`renderWithAtoms` lives in `src/test-utils/`; use the same helper as the surrounding tests.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ChordOverlayControls/`
Expected: FAIL — `data-disabled="true"` still appears.

- [ ] **Step 3: Strip the disabled branch from the component**

Edit `src/components/ChordOverlayControls/ChordOverlayControls.tsx`:

- Remove the import of `fingeringPatternAtom` (line 7) **only if no other code in the file uses it**. (It is currently used only to compute `isPatternDisabled` — confirm by reading the file.)
- Delete lines 69-71 (the `const fingeringPattern = …; const isPatternDisabled = …`).
- Delete the hint render block (lines 197-201, the `<p className={shared["field-hint"]} aria-live="polite">{t("controls.chordOverlayDisabled")}</p>`).
- Delete the `panel-disabled` class application and `data-disabled` attribute in the wrapper (lines 193-196), leaving:

```tsx
<div className={panelStyles.root}>
```

- Replace every `isPatternDisabled` use in the JSX (lines 182, 184, 187, 189, 208, 214-217, 222, 227, 231) by inlining the simpler expression. Specifically:
  - `showDegree`, `showRoot`, `showChordTypeGrid`, `showDisplay` lose their `!isPatternDisabled &&` conjunct.
  - The Source-row `Prop`'s `hint` becomes `t("controls.modeHint")` unconditionally.
  - The `ToggleBar` `options` for Source mode lose the `disabled: isPatternDisabled` flags and the `t("controls.disabled")` swap; each option's label is the normal value (`t("controls.off")`, `t("controls.degree")`, `t("controls.manual")`).
  - The `onChange` for that bar is just `setChordOverlayMode`.

- [ ] **Step 4: Drop the unused CSS rule**

Open `ChordOverlayControls.module.css` and delete the `.panel-disabled` rule(s). Keep `.root` and any unrelated classes.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/components/ChordOverlayControls/`
Expected: PASS — including the new case from Step 1.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/ src/i18n/
git commit -m "feat(controls-overhaul): drop pattern-disabled branch from ChordOverlayControls"
```

(The i18n removal of `controls.chordOverlayDisabled` from Task 2 lands in this commit since they are mutually required for `tsc` to pass.)

---

## Task 5: Split `FingeringPatternControls` into Position + String-study clusters

**Files:**
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.tsx`
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.module.css`
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`

- [ ] **Step 1: Write the failing test**

In `FingeringPatternControls.test.tsx` add:

```tsx
it("renders Position and String study clusters", () => {
  renderWithAtoms(<FingeringPatternControls />);
  expect(screen.getByRole("group", { name: /^position$/i })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: /string study/i })).toBeInTheDocument();
});

it("selecting a Position option clears the String study selection visually", () => {
  const { rerender } = renderWithAtoms(<FingeringPatternControls />, {
    initialAtoms: [[fingeringPatternAtom, "one-string"]],
  });
  // CAGED is in the Position cluster
  fireEvent.click(screen.getByRole("button", { name: /^CAGED$/ }));
  rerender(<FingeringPatternControls />);
  // 1-String button is no longer pressed
  expect(
    screen.getByRole("button", { name: /1-String/i }).getAttribute("aria-pressed"),
  ).toBe("false");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/FingeringPatternControls/`
Expected: FAIL — no separate groups exist.

- [ ] **Step 3: Replace the single ToggleBar with two clusters**

In `FingeringPatternControls.tsx`, replace the JSX block from line 69 (`<GroupHeader>…`) through line 84 (the closing of the single `<Prop>` for `pattern`) with:

```tsx
<GroupHeader>{t("inspector.groupFingering")}</GroupHeader>

<Prop label={t("inspector.positionCluster")} span={2}>
  <ToggleBar
    label={t("inspector.positionCluster")}
    options={[
      { value: "none", label: "None" },
      { value: "caged", label: "CAGED" },
      { value: "3nps", label: "3NPS" },
    ]}
    value={
      fingeringPattern === "none" ||
      fingeringPattern === "caged" ||
      fingeringPattern === "3nps"
        ? fingeringPattern
        : ""
    }
    onChange={(v) => setFingeringPattern(v as FingeringPattern)}
  />
</Prop>

<Prop label={t("inspector.stringStudyCluster")} span={2}>
  <ToggleBar
    label={t("inspector.stringStudyCluster")}
    options={[
      { value: "one-string", label: "1-String" },
      { value: "two-strings", label: "2-Strings" },
    ]}
    value={
      fingeringPattern === "one-string" || fingeringPattern === "two-strings"
        ? fingeringPattern
        : ""
    }
    onChange={(v) => setFingeringPattern(v as FingeringPattern)}
  />
</Prop>
```

The two clusters both write to `setFingeringPattern`; passing `""` to the inactive `ToggleBar` makes none of its buttons pressed (`ToggleBar` compares `value === option.value`). Verify `ToggleBar` accepts `""` and leaves all options unpressed; if not, pass a sentinel value that is not in the option list (any string that does not match an `option.value`). Confirm by reading `src/components/ToggleBar/ToggleBar.tsx` before edit.

- [ ] **Step 4: Style the cluster spacing**

In `FingeringPatternControls.module.css`, no required change — `Prop` cells already lay out side-by-side in the host grid. If the design needs a divider between the two `Prop`s, add a `border-inline-start` on the second `Prop` via a class passed through `Prop`'s `className` prop (only if `Prop` supports it; otherwise leave layout to the host grid).

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/components/FingeringPatternControls/`
Expected: PASS — including the two new cases.

- [ ] **Step 6: Commit**

```bash
git add src/components/FingeringPatternControls/
git commit -m "feat(controls-overhaul): split fingering selector into Position + String study clusters"
```

---

## Task 6: Move `FingeringPatternControls` from `ViewTab` to `ScaleTab`

**Files:**
- Modify: `src/components/Inspector/ScaleTab.tsx`
- Modify: `src/components/Inspector/ScaleTab.module.css`
- Modify: `src/components/Inspector/ScaleTab.test.tsx`
- Modify: `src/components/Inspector/ViewTab.tsx`
- Modify: `src/components/Inspector/ViewTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `ScaleTab.test.tsx` add:

```tsx
it("renders the fingering pattern controls", () => {
  renderWithAtoms(<ScaleTab />);
  expect(screen.getByRole("group", { name: /^position$/i })).toBeInTheDocument();
});
```

In `ViewTab.test.tsx` add:

```tsx
it("no longer renders the fingering pattern controls", () => {
  renderWithAtoms(<ViewTab />);
  expect(screen.queryByRole("group", { name: /^position$/i })).toBeNull();
});
```

- [ ] **Step 2: Run to verify both fail**

Run: `pnpm vitest run src/components/Inspector/ScaleTab.test.tsx src/components/Inspector/ViewTab.test.tsx`
Expected: FAIL — ScaleTab does not yet host the controls; ViewTab still does.

- [ ] **Step 3: Remove `FingeringPatternControls` from `ViewTab`**

In `src/components/Inspector/ViewTab.tsx`:

- Delete the `import { FingeringPatternControls } …` line.
- Delete the `<FingeringPatternControls />` element and its preceding comment in the `PropGrid`.

- [ ] **Step 4: Add `FingeringPatternControls` to `ScaleTab`**

In `src/components/Inspector/ScaleTab.tsx`, add imports:

```ts
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { PropGrid } from "./InspectorGrid";
import useLayoutMode from "../../hooks/useLayoutMode";
```

Inside the `ScaleTab` component, replace the outer JSX with a section that renders the fingering controls in a `PropGrid` row above the three-column grid:

```tsx
const { tier } = useLayoutMode();

return (
  <div className={styles.root} data-inspector-tab="scale">
    <div className={styles.fingeringRow}>
      <PropGrid columns={tier === "mobile" ? 2 : 6}>
        <FingeringPatternControls />
      </PropGrid>
    </div>
    <div className={styles.columns}>
      <div className={styles.col}>
        <GroupHeader>{t("inspector.groupKey")}</GroupHeader>
        <ScaleSelector />
      </div>
      <div className={styles.col} data-scale-col="wheel">
        <GroupHeader>{t("inspector.groupWheel")}</GroupHeader>
        <Suspense fallback={<CircleOfFifthsSkeleton />}>
          <CircleOfFifths
            rootNote={rootNote}
            setRootNote={setRootNote}
            scaleName={scaleName}
            useFlats={useFlats}
            enharmonicDisplay={enharmonicDisplay}
          />
        </Suspense>
      </div>
      <div className={styles.col}>
        <GroupHeader>{t("inspector.groupTheory")}</GroupHeader>
        <ScaleTheoryFacts />
      </div>
    </div>
  </div>
);
```

- [ ] **Step 5: Update `ScaleTab.module.css`**

Wrap the existing three-column grid into a new `.columns` class; add a `.fingeringRow` class for the new top row. Adjust:

```css
.root {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.fingeringRow {
  /* PropGrid handles its own layout; just provide horizontal padding parity */
}

.columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3, 0.75rem);
}

:global(.app-container[data-layout-tier="desktop"]) .columns {
  grid-template-columns: minmax(0, 5fr) minmax(0, 3fr) minmax(0, 4fr);
  gap: 1.25rem;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run src/components/Inspector/ScaleTab.test.tsx src/components/Inspector/ViewTab.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/Inspector/
git commit -m "feat(controls-overhaul): move fingering controls from View tab to Scale tab"
```

---

## Task 7: Gate voicing scope on `chordScopeToPositionAtom`

**Files:**
- Modify: `src/hooks/useFretboardState.ts`

- [ ] **Step 1: Write the failing test**

The existing `useFretboardState` test (find it in the file tree under `src/hooks/`) — append:

```ts
it("does not scope voicings to the position when chordScopeToPositionAtom is off", () => {
  const store = createStore();
  store.set(fingeringPatternAtom, "caged");
  store.set(cagedShapesAtom, new Set(["C"]));
  store.set(chordScopeToPositionAtom, false);
  // construct a chord with at least one full-board match outside the C-shape box
  // (use whatever test fixture the existing suite uses for full chord matches)
  const { result } = renderHook(() => useFretboardState(), { wrapper: withStore(store) });
  expect(result.current.fullChordMatches.length).toBeGreaterThan(
    /* the box-scoped count would be */ 1,
  );
});
```

If there is no existing hook test that already wires `fullChordMatchesAtom` with fixture data, write the assertion at the equivalence level: with scope off, `fullChordMatches.length` equals the raw `fullChordMatchesAtom` value; with scope on + single CAGED shape, the count is filtered (≤ raw).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/hooks/useFretboardState`
Expected: FAIL — current code calls `selectFullChordMatchesForCagedPosition` whenever `fingeringPattern === "caged"`, regardless of the new atom.

- [ ] **Step 3: Rewire `useFretboardState`**

In `src/hooks/useFretboardState.ts`:

- Add imports:

```ts
import { chordScopeToPositionAtom, activePositionAtom } from "../store/atoms";
```

- Inside `useFretboardState`, read the new atoms:

```ts
const chordScopeToPosition = useAtomValue(chordScopeToPositionAtom);
const activePosition = useAtomValue(activePositionAtom);
```

- Change the `visibleFullChordMatches` memo (line 173-183) so the scoping runs only when scope is on AND there is an active position AND the pattern is `caged` (the polygon scorer needs `shapePolygons`, which are only meaningful for CAGED):

```ts
const visibleFullChordMatches = useMemo(
  () =>
    chordScopeToPosition && activePosition && fingeringPattern === "caged"
      ? selectFullChordMatchesForCagedPosition(
          fullChordMatches,
          shapePolygons,
          cagedShapes,
        )
      : fullChordMatches,
  [
    chordScopeToPosition,
    activePosition,
    fingeringPattern,
    fullChordMatches,
    shapePolygons,
    cagedShapes,
  ],
);
```

- Derive a `chordBoxBounds` value and return it from the hook:

```ts
const chordBoxBounds = chordScopeToPosition && activePosition ? boxBounds : null;
```

And in the returned object replace nothing — *add*:

```ts
chordBoxBounds,
```

(The chord-tone clamp now consumes `chordBoxBounds`; `boxBounds` remains exported for scale highlighting.)

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/hooks/useFretboardState`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFretboardState.ts
git commit -m "feat(controls-overhaul): gate voicing scope on chordScopeToPositionAtom"
```

---

## Task 8: Pipe `chordBoxBounds` through `Fretboard` → `FretboardSVG` → `useNoteData`

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Modify: `src/components/FretboardSVG/hooks/useNoteData.ts`

- [ ] **Step 1: Plumb the prop**

In `Fretboard.tsx`:

- Pull `chordBoxBounds` from `useFretboardState`: `const chordBoxBounds = state.chordBoxBounds;`
- Pass it to the rendered `FretboardSVG`: `chordBoxBounds={chordBoxBounds}`.

In `FretboardSVG.tsx`:

- Add `chordBoxBounds?: BoxBounds | null;` to the prop type (the existing `BoxBounds` type next to `boxBounds`).
- Default `chordBoxBounds = null` in the destructuring.
- Pass it through to `useNoteData({ …, chordBoxBounds })`.

In `useNoteData.ts`:

- Add `chordBoxBounds: BoxBounds | null` to the parameter type around line 55.
- Destructure it around line 86.
- At lines 203-204 and 238-239 the existing chord-tone clamp consults `boxBounds`. Replace **only those chord-tone-related** lookups with `chordBoxBounds` (the surrounding scale-highlighting paths keep using `boxBounds`). Concretely: read those lines in context first; the chord-tone path is the one inside the `hasChordOverlay` / `chordTones` branch. Where currently:

```ts
fretIndex >= b.minFret - chordFretSpread &&
fretIndex <= b.maxFret + chordFretSpread,
```

…replace `b` (the `boxBounds` element) with the equivalent loop variable derived from `chordBoxBounds ?? []`. When `chordBoxBounds` is null, *skip the clamp* — emit the chord tones unbounded. The simplest concrete transform: introduce `const chordBounds = chordBoxBounds ?? null;` near the top of the function and replace each chord-tone clamp block with:

```ts
if (chordBounds) {
  // run the existing per-box-bounds filter using chordBounds
} else {
  // include all chord tones for that string, only excluding hidden ones
}
```

Read lines 195-245 of `useNoteData.ts` first to pick the precise edit shape.

- Add `chordBoxBounds` to the dependency list on line 366.

- [ ] **Step 2: Run typecheck + tests**

Run: `npx tsc -b && pnpm vitest run src/components/FretboardSVG src/components/Fretboard`
Expected: PASS — `tsc` clean, existing visual-data tests still green.

- [ ] **Step 3: Commit**

```bash
git add src/components/Fretboard/ src/components/FretboardSVG/
git commit -m "feat(controls-overhaul): pipe chordBoxBounds for opt-in chord-tone clamp"
```

---

## Task 9: Render Chord Spread + Scope-to-position inside ChordOverlayControls

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `ChordOverlayControls.test.tsx` add:

```tsx
it("renders the Chord Spread stepper inside the Voicing section", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialAtoms: [
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "major"],
      [voicingSectionExpandedAtom, true],
    ],
  });
  expect(screen.getByLabelText(/chord spread/i)).toBeInTheDocument();
});

it("renders the Scope to position switch and disables it when no active position", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialAtoms: [
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "major"],
      [voicingSectionExpandedAtom, true],
      [fingeringPatternAtom, "none"],
    ],
  });
  const sw = screen.getByLabelText(/scope to position/i) as HTMLInputElement;
  expect(sw.disabled).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/ChordOverlayControls/`
Expected: FAIL — neither control renders.

- [ ] **Step 3: Add the imports**

In `ChordOverlayControls.tsx`:

```ts
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  chordFretSpreadAtom,
  chordScopeToPositionAtom,
  voicingSectionExpandedAtom,
  activePositionAtom,
  // …existing imports
} from "../../store/atoms";
import { StepperControl } from "../StepperControl/StepperControl";
```

Hook them in the component:

```ts
const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);
const [chordScopeToPosition, setChordScopeToPosition] = useAtom(chordScopeToPositionAtom);
const activePosition = useAtomValue(activePositionAtom);
```

- [ ] **Step 4: Render the controls inside the VOICING section**

Inside the `{showDisplay && (<>` block, at the bottom of the existing VOICING props (after the String Set `Prop`), add:

```tsx
<Prop label={t("inspector.chordSpread")} span={3} hint={t("inspector.chordSpreadHint")}>
  <StepperControl
    value={chordFretSpread}
    onChange={setChordFretSpread}
    min={0}
    max={4}
    step={1}
  />
</Prop>
<Prop
  label={t("inspector.scopeToPosition")}
  span={4}
  hint={
    activePosition
      ? t("inspector.scopeToPositionHint")
      : t("inspector.scopeToPositionNeedsPosition")
  }
>
  <Switch
    label={t("inspector.scopeToPosition")}
    checked={chordScopeToPosition && activePosition}
    onChange={setChordScopeToPosition}
    disabled={!activePosition}
  />
</Prop>
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/components/ChordOverlayControls/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/
git commit -m "feat(controls-overhaul): chord spread + scope-to-position in Chord tab"
```

---

## Task 10: Make the VOICING section collapsible

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.module.css`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

In `ChordOverlayControls.test.tsx`:

```tsx
it("collapses the Voicing section by default", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialAtoms: [
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "major"],
    ],
  });
  expect(screen.queryByLabelText(/voicing type/i)).toBeNull();
  // Header still rendered with an expand affordance
  expect(screen.getByRole("button", { name: /voicing/i })).toBeInTheDocument();
});

it("expands the Voicing section on header click", () => {
  renderWithAtoms(<ChordOverlayControls />, {
    initialAtoms: [
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "major"],
    ],
  });
  fireEvent.click(screen.getByRole("button", { name: /voicing/i }));
  expect(screen.getByLabelText(/voicing type/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/ChordOverlayControls/`
Expected: FAIL — the VOICING props always render.

- [ ] **Step 3: Wrap the VOICING block in a collapsible header**

In `ChordOverlayControls.tsx`, hook the expanded atom:

```ts
const [voicingExpanded, setVoicingExpanded] = useAtom(voicingSectionExpandedAtom);
```

Replace the existing `<GroupHeader …>{t("inspector.groupVoicing")}</GroupHeader>` block with a button-styled header that toggles `voicingExpanded`. Render the inner `<Prop>`s only when expanded:

```tsx
<GroupHeader
  right={
    <span className={panelStyles.connectorsToggle}>
      <span className={panelStyles.connectorsToggleLabel}>
        {t("controls.connectors")}
      </span>
      <Switch
        label={t("controls.connectors")}
        checked={voicingConnectors}
        onChange={setVoicingConnectors}
        disabled={displayDisabled}
      />
    </span>
  }
>
  <button
    type="button"
    className={panelStyles.voicingDisclosure}
    aria-expanded={voicingExpanded}
    aria-controls="voicing-section"
    onClick={() => setVoicingExpanded((v) => !v)}
  >
    <span aria-hidden="true" className={panelStyles.voicingChevron} data-open={voicingExpanded || undefined}>
      ▸
    </span>
    {t("inspector.voicingSection")}
  </button>
</GroupHeader>
{voicingExpanded && (
  <div id="voicing-section" style={{ display: "contents" }}>
    {/* existing Voicing Props: Type, Inversion, String Set, Chord Spread, Scope-to-position */}
  </div>
)}
```

`display: contents` keeps the wrapped `Prop` cells direct children of the parent `PropGrid` (cells must remain CSS-grid items). Verify the existing `Prop` cells were direct grid items — they are, in the current `<>` fragment; this preserves that.

If `GroupHeader` rejects a non-text child, render the disclosure button outside `GroupHeader` instead — directly as a grid item, with the connectors `<Switch>` as its sibling.

- [ ] **Step 4: Add disclosure styling**

In `ChordOverlayControls.module.css` append:

```css
.voicingDisclosure {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
}

.voicingChevron {
  transition: transform 120ms ease;
}

.voicingChevron[data-open] {
  transform: rotate(90deg);
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/components/ChordOverlayControls/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/
git commit -m "feat(controls-overhaul): collapsible VOICING section in Chord tab"
```

---

## Task 11: Delete `ChordLayoutSettingsSection` + Settings `chordSpread` wiring

**Files:**
- Delete: `src/components/SettingsOverlay/sections/ChordLayoutSettingsSection.tsx`
- Modify: `src/components/SettingsOverlay/SettingsOverlay.tsx`
- Modify: `src/components/SettingsOverlay/constants.ts`
- Modify: `src/components/SettingsOverlay/types.ts`
- Modify: `src/components/SettingsOverlay/useSettingsForm.ts`

- [ ] **Step 1: Write the failing test**

If there is an existing `SettingsOverlay.test.tsx`, add:

```tsx
it("does not render a Chord Layout / Chord Spread section", () => {
  renderWithAtoms(<SettingsOverlay />, { initialAtoms: [[settingsOverlayOpenAtom, true]] });
  expect(screen.queryByText(/chord spread/i)).toBeNull();
});
```

Otherwise skip Step 1-2 and verify by build + visual inspection (the deletions are mechanical).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/SettingsOverlay/`
Expected: FAIL (if a test exists).

- [ ] **Step 3: Delete the section file**

```bash
rm src/components/SettingsOverlay/sections/ChordLayoutSettingsSection.tsx
```

- [ ] **Step 4: Remove the consumer wiring**

In `SettingsOverlay.tsx`:
- Delete the `import ChordLayoutSettingsSection …` line.
- Delete the `<ChordLayoutSettingsSection />` render at line 127.

In `constants.ts`:
- Delete the `chordSpread: { … }` entry inside `SETTING_FIELDS`.

In `types.ts`:
- Remove `"chordSpread"` from the `SettingFieldKey` union.

In `useSettingsForm.ts`:
- Remove the `chordFretSpreadAtom` import.
- Remove the `chordFretSpread` / `setChordFretSpread` `useAtom` call and the return-object entries.

- [ ] **Step 5: Run typecheck + tests**

Run: `npx tsc -b && pnpm vitest run src/components/SettingsOverlay/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/SettingsOverlay/
git commit -m "feat(controls-overhaul): remove Chord Spread from Settings overlay"
```

---

## Task 12: Update `HelpModal` references

**Files:**
- Modify: `src/components/HelpModal/HelpModal.tsx` (only if it currently mentions Chord Spread or the CAGED naming distinction)

- [ ] **Step 1: Audit current copy**

Run:

```bash
grep -n -iE "chord spread|caged" src/components/HelpModal/HelpModal.tsx
```

- [ ] **Step 2: Update copy**

If a Chord Spread reference exists pointing to the Settings overlay, change it to point at the Chord tab's Voicing section.

If no CAGED-naming note exists, add one sentence noting that the "CAGED" label appears both under **Position** (fingering) and **Voicing** (chord shape) and refers to the same five-shape system applied to scales versus chords. Mirror in `src/i18n/en.ts` + `es.ts` if the modal uses translated strings.

If no references exist, this task is a no-op — record that in the commit.

- [ ] **Step 3: Run tests + lint**

Run: `pnpm vitest run src/components/HelpModal && pnpm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/HelpModal/ src/i18n/
git commit -m "docs(help): update Chord Spread location + CAGED naming note"
```

---

## Task 13: Full lint, test, build, typecheck + visual snapshot refresh

**Files:** none modified beyond snapshots.

- [ ] **Step 1: Run the mandatory pre-PR commands**

```bash
pnpm run lint
pnpm run test
pnpm run build
npx tsc -b
```

Expected: all PASS. Read each command's output. Any failure → diagnose, edit, re-run from this step.

- [ ] **Step 2: Refresh visual baselines**

The View, Scale, and Chord tabs all change layout. Refresh darwin baselines locally:

```bash
pnpm run test:visual:update
```

Then refresh linux baselines (cross-platform):

```bash
pnpm run test:visual:update:linux
```

Inspect the regenerated snapshots in `e2e/__screenshots__/` — confirm the changes match the expected layout (fingering controls in Scale tab; no Chord Spread section in Settings; collapsed VOICING in Chord tab; Scope to position toggle visible inside expanded VOICING).

- [ ] **Step 3: Run the visual suites against the new baselines**

```bash
pnpm run test:visual
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/__screenshots__
git commit -m "test(visual): refresh baselines after controls overhaul"
```

---

## Acceptance Criteria Coverage Check

| Spec criterion | Task(s) |
|---|---|
| Fingering controls in Scale tab; View tab holds only display preferences | 6 |
| Fingering selector reads as two labeled groups — Position and String study | 5 |
| Chord overlay fully usable in any fingering pattern (incl. 1-String, 2-Strings) | 3, 4 |
| Voicings constrained to fingering position only when "Scope to position" is on AND a single CAGED/3NPS position is active | 1, 7, 8, 9 |
| Chord Spread adjustable from the Chord tab; not in Settings | 9, 11 |
| Chord tab shows Source + Lens by default; Voicing collapsed; expanding reveals Type/Inversion/String Set/Connectors/Chord Spread/Scope-to-position | 9, 10 |
| `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` pass | 13 |
| Visual regression baselines refreshed (darwin + linux) | 13 |
