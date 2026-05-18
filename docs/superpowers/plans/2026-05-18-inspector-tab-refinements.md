# Inspector Tab Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the View, Scale, and Progression inspector tabs for layout consistency, control alignment, and visual parity with the Chord tab.

**Architecture:** Incremental edits to existing `Inspector` tab components and their CSS modules, plus the shared `ToggleBar`/`StepperShell` primitives. No new atoms, no new domain logic. The existing `DegreeChordList`, `ChordTypeGrid`, and `LabeledSelect` components are reused. Spec: `docs/superpowers/specs/2026-05-18-inspector-tab-refinements-design.md`.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, Vitest + Testing Library, Playwright (visual regression). Package manager is **pnpm**.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/i18n/en.ts`, `es.ts`, `types.ts` | Translation strings | Rename `groupWheel`, add `factChords` |
| `src/components/StepperShell/StepperShell.module.css` | Shell control height | Add shared min-height |
| `src/components/shared/shared.module.css` | `.toggle-group` height | Match shared min-height |
| `src/components/FretRangeControl/FretRangeControl.module.css` | Inline fret stepper sizing | Match shared min-height |
| `src/components/Inspector/ViewTab.tsx` | View tab layout | Move Fret Range, remove 2 toggles |
| `src/components/Inspector/ScaleTab.tsx` / `.module.css` | Scale tab columns | Reorder columns |
| `src/components/Inspector/ScaleTheoryFacts.tsx` / `.module.css` | Theory readout | Replace Tones with chord list |
| `src/components/CircleOfFifths/CircleOfFifths.tsx` | Circle size | Shrink `SIZE` |
| `src/components/StepperSelect/StepperSelect.module.css` | Family/Variant stepper | Compact sizing |
| `src/components/ProgressionControls/ProgressionControls.tsx` / `.module.css` | Progression tab | Header actions, quality picker, SELECTED header, Loop removal, compact steppers |
| `src/components/ProgressionControls/BackingTrackControls.tsx` / `.module.css` | Backing track | LabeledSelect swap, styled Swing slider |
| `src/components/TransportBar/TransportBar.tsx` / `.module.css` | Playback transport | Add editable tempo stepper |

---

## Task 1: i18n string updates

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`
- Modify: `src/i18n/types.ts`

- [ ] **Step 1: Rename the Wheel group label and add a Chords fact key in `en.ts`**

In `src/i18n/en.ts`, change line 61 from:

```ts
    groupWheel: "Wheel",
```

to:

```ts
    groupWheel: "Circle of Fifths",
```

Then add a new key immediately after `factDegrees` (line 64):

```ts
    factDegrees: "Degrees",
    factChords: "Chords",
    factTones: "Tones",
```

(Leave `factTones` in place — it stays a valid key even though the Scale tab stops rendering it.)

- [ ] **Step 2: Mirror the changes in `es.ts`**

In `src/i18n/es.ts`, change line 61 `groupWheel: "Círculo"` to `groupWheel: "Círculo de Quintas"`, and add after `factDegrees`:

```ts
    factChords: "Acordes",
```

- [ ] **Step 3: Add the `factChords` key to the type definition**

In `src/i18n/types.ts`, add `factChords: string;` immediately after the `factDegrees: string;` line (near line 63).

- [ ] **Step 4: Verify the type-check passes**

Run: `pnpm exec tsc -b --noEmit`
Expected: no errors. (If `tsc -b` reports "no inputs", run `pnpm run build` up to the tsc step instead.)

- [ ] **Step 5: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts src/i18n/types.ts
git commit -m "i18n(inspector): rename Wheel label, add Chords fact key"
```

---

## Task 2: Shared control height for steppers and toggle bars

The `StepperShell` (used by `StepperControl`, `StepperSelect`, `FretRangeControl`) renders taller than the inspector `ToggleBar` (`.toggle-group`). Align them on one min-height so controls in a `PropGrid` row match.

**Files:**
- Modify: `src/components/StepperShell/StepperShell.module.css`
- Modify: `src/components/shared/shared.module.css`
- Modify: `src/components/FretRangeControl/FretRangeControl.module.css`

- [ ] **Step 1: Give `StepperShell` a fixed min-height**

In `src/components/StepperShell/StepperShell.module.css`, edit the `.shell` rule (lines 1-11) to add `min-height` and keep contents stretched:

```css
.shell {
  min-width: 0;
  min-height: 2rem;
  display: flex;
  align-items: stretch;
  gap: 0.22rem;
  padding: 0.25rem;
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  background-color: var(--dc-bg);
  transition: var(--dc-transition);
}
```

- [ ] **Step 2: Match the inspector toggle group to the same min-height**

In `src/components/shared/shared.module.css`, edit the `.toggle-group` rule (lines 161-168) to add `min-height` and vertically center:

```css
.toggle-group {
  display: flex;
  align-items: stretch;
  gap: 0.1rem;
  min-height: 2rem;
  background-color: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: calc(var(--dc-radius) - 1px);
  padding: 0.1rem;
}
```

- [ ] **Step 3: Shrink the inline fret-range buttons so the control fits the new shell height**

In `src/components/FretRangeControl/FretRangeControl.module.css`, edit the `.fret-btn` rule (lines 12-18) so the buttons stretch to the shell instead of forcing a min-height:

```css
.fret-btn {
  composes: button from '../StepperShell/StepperShell.module.css';
  min-width: 1.55rem;
  align-self: stretch;
  padding: 0.12rem 0.3rem;
  font-size: 0.8rem;
}
```

- [ ] **Step 4: Run lint to confirm the stylesheets are valid**

Run: `pnpm run lint`
Expected: PASS (no stylelint errors in the three modified files).

- [ ] **Step 5: Run the existing component tests for affected controls**

Run: `pnpm run test -- FretRangeControl StepperControl StepperSelect ToggleBar`
Expected: PASS — no behavioral assertions break.

- [ ] **Step 6: Commit**

```bash
git add src/components/StepperShell/StepperShell.module.css src/components/shared/shared.module.css src/components/FretRangeControl/FretRangeControl.module.css
git commit -m "style(controls): align stepper and toggle-bar heights"
```

---

## Task 3: View tab — relocate Fret Range, remove Full Chords and Tap to Play

**Files:**
- Modify: `src/components/Inspector/ViewTab.tsx`
- Test: `src/components/Inspector/ViewTab.test.tsx`

- [ ] **Step 1: Update the ViewTab test for the new layout**

In `src/components/Inspector/ViewTab.test.tsx`, find the test "renders the fingering pattern control and the fret range group" and the existing fret-range tests. Add this test asserting Full Chords / Tap to Play are gone and Fret Range is present:

```tsx
it("omits the Full Chords and Tap to Play toggles", () => {
  renderWithAtoms(<ViewTab />);
  expect(screen.queryByText("Full Chords")).not.toBeInTheDocument();
  expect(screen.queryByText("Tap to Play")).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
});
```

Then delete any existing test in this file that asserts `"Full Chords"` or `"Tap to Play"` text is present, and remove now-unused imports `fullChordsEnabledAtom` and `isMutedAtom` from the import block if no remaining test references them.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test -- ViewTab`
Expected: FAIL — "Full Chords" / "Tap to Play" still render.

- [ ] **Step 3: Edit `ViewTab.tsx` to remove the two toggles and move Fret Range**

In `src/components/Inspector/ViewTab.tsx`:

(a) Remove `fullChordsEnabledAtom` and `isMutedAtom` from the import block (lines 2-11).

(b) Remove these destructured atom lines (lines 47-48):

```tsx
  const [fullChords, setFullChords] = useAtom(fullChordsEnabledAtom);
  const [muted, setMuted] = useAtom(isMutedAtom);
```

(c) Delete the entire Fret Range `<Prop>` block currently in the FINGERING group (lines 57-66).

(d) Delete the Full Chords and Tap to Play `<ToggleProp>` blocks from the DISPLAY group (lines 101-112).

(e) In the DISPLAY group, after the Degree Colors `<ToggleProp>`, add the Fret Range `<Prop>`:

```tsx
        <GroupHeader>{t("inspector.groupDisplay")}</GroupHeader>
        <ToggleProp
          label={t("inspector.degreeColors")}
          checked={scaleDegreeColors}
          onChange={setScaleDegreeColors}
          status={scaleDegreeColors ? t("inspector.statusByDegree") : t("inspector.statusUniform")}
        />
        <Prop label={t("settings.fields.fretRange")} span={2}>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="inline"
          />
        </Prop>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test -- ViewTab`
Expected: PASS.

- [ ] **Step 5: Run lint to catch unused imports**

Run: `pnpm run lint`
Expected: PASS — no unused-variable errors in `ViewTab.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ViewTab.tsx src/components/Inspector/ViewTab.test.tsx
git commit -m "feat(inspector): move Fret Range to Display, drop Full Chords and Tap to Play"
```

---

## Task 4: Scale tab — reorder columns and rename the Wheel header

Target column order: **KEY · CIRCLE OF FIFTHS · THEORY**.

**Files:**
- Modify: `src/components/Inspector/ScaleTab.tsx`
- Modify: `src/components/Inspector/ScaleTab.module.css`
- Test: `src/components/Inspector/ScaleTab.test.tsx`

- [ ] **Step 1: Add a column-order test**

In `src/components/Inspector/ScaleTab.test.tsx`, add:

```tsx
it("renders columns in Key, Circle of Fifths, Theory order", () => {
  renderWithAtoms(<ScaleTab />);
  const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(headers).toEqual(["Key", "Circle of Fifths", "Theory"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test -- ScaleTab`
Expected: FAIL — current order is `Key, Theory, Wheel`.

- [ ] **Step 3: Reorder the columns in `ScaleTab.tsx`**

In `src/components/Inspector/ScaleTab.tsx`, replace the three `<div className={styles.col}>` blocks (lines 33-52) with this order — Key, then Wheel, then Theory:

```tsx
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
```

- [ ] **Step 4: Update the desktop grid track template**

In `src/components/Inspector/ScaleTab.module.css`, the desktop rule (lines 10-14) sizes columns Key/Theory/Wheel. Re-map it for Key/Wheel/Theory — Key widest, Circle in the middle, Theory on the right:

```css
:global(.app-container[data-layout-tier="desktop"]) .root {
  grid-template-columns: minmax(0, 5fr) minmax(0, 3fr) minmax(0, 4fr);
  gap: 1.25rem;
  align-items: start;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm run test -- ScaleTab`
Expected: PASS. The "Circle of Fifths" header text comes from the `groupWheel` key updated in Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ScaleTab.tsx src/components/Inspector/ScaleTab.module.css src/components/Inspector/ScaleTab.test.tsx
git commit -m "feat(inspector): reorder Scale tab columns to Key/Circle/Theory"
```

---

## Task 5: Scale tab — replace the Tones row with a diatonic chord list

`ScaleTheoryFacts` currently shows Notes / Intervals / Degrees / Tones. Replace Tones with the existing `DegreeChordList` component (read-only — no `onSelect`).

**Files:**
- Modify: `src/components/Inspector/ScaleTheoryFacts.tsx`
- Modify: `src/components/Inspector/ScaleTheoryFacts.module.css`
- Test: `src/components/Inspector/ScaleTheoryFacts.test.tsx`

- [ ] **Step 1: Update the ScaleTheoryFacts test**

In `src/components/Inspector/ScaleTheoryFacts.test.tsx`, replace the first two tests so they assert the Chords row instead of Tones:

```tsx
it("renders the Notes, Intervals, Degrees, and Chords fact labels", () => {
  renderWithAtoms(<ScaleTheoryFacts />, [
    [rootNoteAtom, "C"],
    [scaleNameAtom, "Major"],
  ]);
  expect(screen.getByText("Notes")).toBeInTheDocument();
  expect(screen.getByText("Intervals")).toBeInTheDocument();
  expect(screen.getByText("Degrees")).toBeInTheDocument();
  expect(screen.getByText("Chords")).toBeInTheDocument();
  expect(screen.queryByText("Tones")).not.toBeInTheDocument();
});

it("lists the diatonic chords of C major", () => {
  renderWithAtoms(<ScaleTheoryFacts />, [
    [rootNoteAtom, "C"],
    [scaleNameAtom, "Major"],
  ]);
  const chordList = screen.getByRole("list", { name: /diatonic chords for C/i });
  expect(chordList.textContent).toContain("Maj");
  expect(chordList.textContent).toContain("min");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test -- ScaleTheoryFacts`
Expected: FAIL — "Tones" still renders, no chord list.

- [ ] **Step 3: Rewrite `ScaleTheoryFacts.tsx` to render the chord list**

Replace the full contents of `src/components/Inspector/ScaleTheoryFacts.tsx` with:

```tsx
import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import {
  degreeChipsAtom,
  rootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
} from "../../store/atoms";
import { DegreeChordList } from "../CircleOfFifths/DegreeChordList";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ScaleTheoryFacts.module.css";

/**
 * Read-only theory readout for the Scale tab's Theory column: the active
 * scale's notes, intervals, scale degrees, and its diatonic chords. The
 * note/interval/degree rows derive from `degreeChipsAtom`; the chord list is
 * the shared `DegreeChordList` rendered without a select handler.
 */
export function ScaleTheoryFacts() {
  const { t } = useTranslation();
  const chips = useAtomValue(degreeChipsAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);

  return (
    <dl className={styles.facts}>
      <FactRow label={t("inspector.factNotes")}>
        {chips.map((chip, index) => (
          <span
            key={chip.internalNote}
            className={chip.isTonic ? styles.tonic : undefined}
          >
            {chip.note}
            {index < chips.length - 1 ? " · " : ""}
          </span>
        ))}
      </FactRow>
      <FactRow label={t("inspector.factIntervals")}>
        {chips.map((chip) => chip.interval).join(" · ")}
      </FactRow>
      <FactRow label={t("inspector.factDegrees")}>
        {chips.map((chip) => chip.scaleDegree).join(" · ")}
      </FactRow>
      <FactRow label={t("inspector.factChords")} stacked>
        <DegreeChordList
          rootNote={rootNote}
          scaleName={scaleName}
          useFlats={useFlats}
          className={styles.chordList}
        />
      </FactRow>
    </dl>
  );
}

interface FactRowProps {
  label: string;
  children: ReactNode;
  /** When true, the value stacks below the label instead of sharing a baseline row. */
  stacked?: boolean;
}

function FactRow({ label, children, stacked }: FactRowProps) {
  return (
    <div className={stacked ? styles.rowStacked : styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}
```

- [ ] **Step 4: Add the stacked-row and chord-list styles**

In `src/components/Inspector/ScaleTheoryFacts.module.css`, append:

```css
.rowStacked {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.chordList {
  width: 100%;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm run test -- ScaleTheoryFacts`
Expected: PASS, including the existing `axe` accessibility test.

- [ ] **Step 6: Run lint**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/Inspector/ScaleTheoryFacts.tsx src/components/Inspector/ScaleTheoryFacts.module.css src/components/Inspector/ScaleTheoryFacts.test.tsx
git commit -m "feat(inspector): replace Tones readout with diatonic chord list"
```

---

## Task 6: Scale tab — compact the Circle of Fifths and the Family/Variant steppers

**Files:**
- Modify: `src/components/CircleOfFifths/CircleOfFifths.tsx`
- Modify: `src/components/StepperSelect/StepperSelect.module.css`

- [ ] **Step 1: Shrink the Circle of Fifths SVG footprint**

In `src/components/CircleOfFifths/CircleOfFifths.tsx`, change the `SIZE` constant (line 18) from `320` to `260`:

```ts
const SIZE = 260;
```

All other geometry constants (`CX`, `CY`, radii, font sizes) are derived from `SIZE`, so they scale proportionally — no other edit needed in this file.

- [ ] **Step 2: Read `StepperSelect.module.css` to see current sizing**

Run: `cat src/components/StepperSelect/StepperSelect.module.css`
Note the `.nav-button` and `.select-slot` rules — the nav buttons are the height drivers.

- [ ] **Step 3: Compact the StepperSelect nav buttons**

In `src/components/StepperSelect/StepperSelect.module.css`, edit the `.nav-button` rule so the buttons stretch to the (now fixed, 2rem) shell height rather than forcing extra height, and tighten horizontal padding. Replace the `.nav-button` rule with:

```css
.nav-button {
  composes: button from '../StepperShell/StepperShell.module.css';
  align-self: stretch;
  min-width: 1.6rem;
  padding: 0.1rem 0.3rem;
}
```

(If the existing rule already uses `composes: button` keep that line; only adjust `min-width`/`min-height`/`padding` — remove any `min-height` so the shell governs height.)

- [ ] **Step 4: Run the Circle and StepperSelect tests**

Run: `pnpm run test -- CircleOfFifths StepperSelect ScaleTab`
Expected: PASS. The Circle tests assert roles/labels, not pixel size, so the `SIZE` change is non-breaking.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CircleOfFifths/CircleOfFifths.tsx src/components/StepperSelect/StepperSelect.module.css
git commit -m "style(inspector): compact the Circle of Fifths and Family/Variant steppers"
```

---

## Task 7: Progression tab — move chord-list actions to the CHORDS header row, shrink the list

**Files:**
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`
- Modify: `src/components/ProgressionControls/ProgressionControls.module.css`

- [ ] **Step 1: Move the action toolbar into the CHORDS `GroupHeader`**

In `src/components/ProgressionControls/ProgressionControls.tsx`, the CHORDS group currently is `<GroupHeader>{t("inspector.groupChords")}</GroupHeader>` (line 177) followed by a `<Prop span={3}>` whose `chords-cell` div ends with a `<div className={styles["step-actions"]}>...</div>` (lines 205-247).

(a) Cut the entire `<div className={styles["step-actions"]}> ... </div>` block (lines 205-247) out of the `chords-cell`.

(b) Pass it to the `GroupHeader` via the `right` prop. Replace line 177 with:

```tsx
      <GroupHeader
        right={
          <div className={styles["step-actions"]}>
            <button type="button" className={shared["control-button"]} onClick={() => addProgressionStep()} aria-label="Add chord">
              <Plus size={16} aria-hidden="true" />
              <span>Add</span>
            </button>
            <button
              type="button"
              className={shared["control-button"]}
              onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: -1 })}
              disabled={!activeStep || activeProgressionStepIndex === 0}
              aria-label="Move chord up"
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={shared["control-button"]}
              onClick={() => activeStep && moveProgressionStep({ id: activeStep.id, direction: 1 })}
              disabled={!activeStep || activeProgressionStepIndex === progressionSteps.length - 1}
              aria-label="Move chord down"
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={shared["control-button"]}
              onClick={() => activeStep && duplicateProgressionStep(activeStep.id)}
              disabled={!activeStep}
              aria-label="Duplicate chord"
            >
              <CopyPlus size={16} aria-hidden="true" />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              className={shared["control-button"]}
              onClick={() => activeStep && removeProgressionStep(activeStep.id)}
              disabled={!activeStep}
              aria-label="Remove chord"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        }
      >
        {t("inspector.groupChords")}
      </GroupHeader>
```

After this, the `chords-cell` div contains only the `<ol className={styles["step-list"]}>` (or the empty-state `<p>`).

- [ ] **Step 2: Shrink the chord-list rows**

In `src/components/ProgressionControls/ProgressionControls.module.css`:

(a) Edit `.step-list` to tighten the gap:

```css
.step-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
```

(b) Edit `.step-row` to reduce height and padding:

```css
.step-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.9rem;
  padding: 0.28rem 0.5rem;
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  background: var(--dc-bg);
  color: var(--dc-fg);
  text-align: left;
  cursor: pointer;
  transition: var(--dc-transition);
}
```

(c) Add a `margin: 0` reset on the `.step-actions` block so it sits flush in the header row:

```css
.step-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
  margin: 0;
}
```

- [ ] **Step 3: Run the Progression tests**

Run: `pnpm run test -- ProgressionControls ProgressionTab`
Expected: PASS — the action buttons keep the same `aria-label`s, so any query-by-label tests still find them.

- [ ] **Step 4: Run lint**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressionControls/ProgressionControls.tsx src/components/ProgressionControls/ProgressionControls.module.css
git commit -m "feat(inspector): host Progression chord actions in the Chords header"
```

---

## Task 8: Progression tab — unify the quality picker with the Chord tab

Drop the standalone "Diatonic" button. Use `ChordTypeGrid` alone; selecting the active quality again clears the override back to diatonic. The `*` marker on the active degree already comes from `buildDegreeToggleOptions({ qualityOverridden })`.

**Files:**
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`
- Test: create `src/components/ProgressionControls/ProgressionControls.test.tsx` (only if it does not already exist — otherwise add to it)

- [ ] **Step 1: Add a test for the quality-toggle clear behavior**

If `src/components/ProgressionControls/ProgressionControls.test.tsx` does not exist, create it:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { ProgressionControls } from "./ProgressionControls";

describe("ProgressionControls quality picker", () => {
  it("has no standalone Diatonic button", () => {
    renderWithAtoms(<ProgressionControls />);
    expect(screen.queryByRole("button", { name: "Diatonic" })).not.toBeInTheDocument();
  });

  it("marks the active degree with * when a quality override is set", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ProgressionControls />);
    // Add a chord so an active step exists.
    await user.click(screen.getByRole("button", { name: /add chord/i }));
    const qualityGroup = screen.getByRole("group", { name: /chord quality/i });
    const majBtn = within(qualityGroup).getAllByRole("button")[0];
    await user.click(majBtn);
    const degreeGroup = screen.getByRole("group", { name: /progression degree/i });
    expect(within(degreeGroup).getByText(/\*/)).toBeInTheDocument();
  });
});
```

Add `import { within } from "@testing-library/react";` to the imports (combine with the existing `screen` import: `import { screen, within } from "@testing-library/react";`).

If the file already exists, append only the `describe("ProgressionControls quality picker", ...)` block and reconcile imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test -- ProgressionControls`
Expected: FAIL — the "Diatonic" button currently exists.

- [ ] **Step 3: Replace the quality row in `ProgressionControls.tsx`**

In `src/components/ProgressionControls/ProgressionControls.tsx`, the Quality `control-section` (lines 298-323) currently renders a `<div className={styles["quality-row"]}>` containing a Diatonic `<button>` plus `<ChordTypeGrid>`. Replace that whole `control-section` block with:

```tsx
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Quality</span>
              <ChordTypeGrid
                label="Chord quality"
                options={buildQualityToggleOptions({ includeSentinel: false })}
                value={qualityValue === CHORD_QUALITY_DIATONIC_VALUE ? "" : qualityValue}
                onChange={(quality) =>
                  updateProgressionStepQuality({
                    id: activeStep.id,
                    qualityOverride: quality === qualityValue ? null : quality,
                  })
                }
              />
              <p className={shared["field-hint"]}>
                {activeResolvedProgressionStep?.qualityOverrideApplied
                  ? "Custom quality on a degree-derived root."
                  : "No quality selected uses the diatonic chord from the active scale."}
              </p>
            </div>
```

- [ ] **Step 4: Remove the now-unused `quality-row` style**

In `src/components/ProgressionControls/ProgressionControls.module.css`, delete the `.quality-row` rule (the `display: flex; align-items: flex-start; gap: 0.35rem;` block). `clsx` is still used elsewhere in the file, so leave the import.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm run test -- ProgressionControls`
Expected: PASS.

- [ ] **Step 6: Run lint to catch unused symbols**

Run: `pnpm run lint`
Expected: PASS — confirm `CHORD_QUALITY_DIATONIC_VALUE` is still imported (it is still referenced) and no unused-class warnings remain.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProgressionControls/ProgressionControls.tsx src/components/ProgressionControls/ProgressionControls.module.css src/components/ProgressionControls/ProgressionControls.test.tsx
git commit -m "feat(inspector): unify Progression quality picker with the Chord tab"
```

---

## Task 9: Progression tab — SELECTED editor header, remove Loop, compact steppers

**Files:**
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`
- Modify: `src/components/ProgressionControls/ProgressionControls.module.css`

- [ ] **Step 1: Add a test for the SELECTED header and the absence of Loop**

In `src/components/ProgressionControls/ProgressionControls.test.tsx`, add:

```tsx
describe("ProgressionControls meter and editor", () => {
  it("does not render a Loop control", () => {
    renderWithAtoms(<ProgressionControls />);
    expect(screen.queryByText("Loop")).not.toBeInTheDocument();
  });

  it("shows a SELECTED header naming the active chord", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ProgressionControls />);
    await user.click(screen.getByRole("button", { name: /add chord/i }));
    expect(screen.getByText(/^Selected —/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test -- ProgressionControls`
Expected: FAIL — "Loop" still renders, no "Selected —" header.

- [ ] **Step 3: Remove the Loop control from the meter row**

In `src/components/ProgressionControls/ProgressionControls.tsx`:

(a) Remove `progressionLoopEnabled` and `setProgressionLoopEnabled` from the `useProgressionState()` destructure (lines 60-61).

(b) Delete the Loop `<Prop>` block (lines 159-165):

```tsx
      <Prop label={t("inspector.meterLoop")} span={1}>
        <Switch label="Loop" checked={progressionLoopEnabled} onChange={setProgressionLoopEnabled} />
      </Prop>
```

(c) Change the Preset `<Prop>` span from `2` to `3` so the meter row still fills 6 columns (Mode 1 + Beats 1 + Length 1 + Preset 3 = 6):

```tsx
      <Prop label={t("inspector.meterPreset")} span={3}>
```

- [ ] **Step 4: Add the SELECTED header to the editor cell**

In `ProgressionControls.tsx`, inside the `activeStep ?` branch, the editor is `<div className={styles["editor-cell"]}>`. Add a header span as its first child, before the Degree `control-section`:

```tsx
          <div className={styles["editor-cell"]}>
            <span className={styles["editor-selected"]}>
              Selected — {activeStep.degree} ·{" "}
              {activeResolvedProgressionStep?.resolvedChordLabel ?? "—"}
            </span>
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Degree</span>
```

(The rest of the editor cell is unchanged.)

- [ ] **Step 5: Add the `editor-selected` style**

In `src/components/ProgressionControls/ProgressionControls.module.css`, append:

```css
.editor-selected {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dc-fg);
}
```

- [ ] **Step 6: Compact the editor steppers**

The Beats/Bar and Duration steppers use `StepperControl`, already shrunk by the shared shell height in Task 2. No extra change is needed here — verify visually in Step 8. If the `.duration-row` still looks unbalanced, tighten its gap in `ProgressionControls.module.css`:

```css
.duration-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm run test -- ProgressionControls`
Expected: PASS.

- [ ] **Step 8: Run lint**

Run: `pnpm run lint`
Expected: PASS — `Switch` is still imported and used by the Mode cell, so the import stays. Confirm no unused `meterLoop`/`progressionLoopEnabled` references remain.

- [ ] **Step 9: Commit**

```bash
git add src/components/ProgressionControls/ProgressionControls.tsx src/components/ProgressionControls/ProgressionControls.module.css src/components/ProgressionControls/ProgressionControls.test.tsx
git commit -m "feat(inspector): add SELECTED editor header, remove Loop from Progression tab"
```

---

## Task 10: Progression tab — restyle Swing slider and Backing Track selects

**Files:**
- Modify: `src/components/ProgressionControls/BackingTrackControls.tsx`
- Modify: `src/components/ProgressionControls/BackingTrackControls.module.css`

- [ ] **Step 1: Swap the native selects for `LabeledSelect`**

In `src/components/ProgressionControls/BackingTrackControls.tsx`:

(a) Add the import:

```tsx
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
```

(b) Replace the Genre `<select>` (`Prop label={t("inspector.btGenre")}`) body with:

```tsx
      <Prop label={t("inspector.btGenre")} span={1}>
        <LabeledSelect
          label="Genre style"
          hideLabel
          value={progressionGenreStyle}
          options={[
            ...GENRE_STYLES.map((g) => ({ value: g.id, label: g.label })),
            { value: "custom", label: "Custom" },
          ]}
          onChange={applyGenreStyle}
        />
      </Prop>
```

(c) Replace the Instrument `<select>` body with:

```tsx
      <Prop label={t("inspector.btInstrument")} span={1}>
        <LabeledSelect
          label="Chord instrument"
          hideLabel
          value={progressionChordInstrument}
          options={[
            { value: "strum", label: "Strum" },
            { value: "piano", label: "Piano" },
            { value: "organ", label: "Organ" },
          ]}
          onChange={(v) => setProgressionChordInstrument(v as ChordInstrumentId)}
        />
      </Prop>
```

(d) Replace the Chord Pattern `<select>` body with:

```tsx
      <Prop label={t("inspector.btChordPattern")} span={1}>
        <LabeledSelect
          label="Chord pattern"
          hideLabel
          value={progressionChordPattern}
          options={CHORD_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setProgressionChordPattern}
        />
      </Prop>
```

(e) Replace the Bass Pattern `<select>` body with:

```tsx
      <Prop label={t("inspector.btBassPattern")} span={1}>
        <LabeledSelect
          label="Bass pattern"
          hideLabel
          value={progressionBassPattern}
          options={BASS_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setProgressionBassPattern}
        />
      </Prop>
```

(f) Replace the Drum Pattern `<select>` body with:

```tsx
      <Prop label={t("inspector.btDrumPattern")} span={1}>
        <LabeledSelect
          label="Drum pattern"
          hideLabel
          value={progressionDrumPattern}
          options={DRUM_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setProgressionDrumPattern}
        />
      </Prop>
```

- [ ] **Step 2: Restyle the Swing slider as a filled-track DAW slider**

In `BackingTrackControls.tsx`, replace the Swing `<Prop>` body with a slider that exposes its fill ratio as a CSS custom property:

```tsx
      <Prop label={t("inspector.btSwing")} span={1}>
        <div className={styles.swing}>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={progressionSwing}
            onChange={(e) => setProgressionSwing(Number(e.target.value))}
            aria-label="Swing amount"
            className={styles.swingRange}
            style={{ ["--swing-fill" as string]: `${(progressionSwing / 0.5) * 100}%` }}
          />
          <span className={styles.swingValue}>{Math.round(progressionSwing * 100)}%</span>
        </div>
      </Prop>
```

- [ ] **Step 3: Replace the Swing slider CSS with a styled filled track**

In `src/components/ProgressionControls/BackingTrackControls.module.css`, delete the `.swingRange` rule and replace it with:

```css
.swingRange {
  flex: 1;
  min-width: 0;
  height: 2rem;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.swingRange::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--neon-cyan) 0,
    var(--neon-cyan) var(--swing-fill, 0%),
    var(--dc-border) var(--swing-fill, 0%)
  );
}

.swingRange::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: var(--dc-border);
}

.swingRange::-moz-range-progress {
  height: 4px;
  border-radius: 2px;
  background: var(--neon-cyan);
}

.swingRange::-webkit-slider-thumb {
  appearance: none;
  margin-top: -5px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--neon-cyan);
  border: 2px solid var(--dc-bg);
  box-shadow: var(--dc-glow-active);
}

.swingRange::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--neon-cyan);
  border: 2px solid var(--dc-bg);
}

.swingRange:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

The `.select` rule in this file is no longer referenced after Step 1 — delete the `.select`, `.select:hover`, `.select:focus-visible`, and the `:global([data-theme="modern-light"]) .select` rules.

- [ ] **Step 4: Run the Progression tests**

Run: `pnpm run test -- ProgressionControls ProgressionTab`
Expected: PASS — `LabeledSelect` renders an accessible select with the same `aria-label`s.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint`
Expected: PASS — no unused `.select` class, no unused imports.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressionControls/BackingTrackControls.tsx src/components/ProgressionControls/BackingTrackControls.module.css
git commit -m "feat(inspector): restyle Backing Track selects and Swing slider"
```

---

## Task 11: TransportBar — editable tempo stepper

The tempo state already exists (`progressionTempoBpmAtom`, exposed by `useProgressionState` as `progressionTempoBpm` / `setProgressionTempoBpm`); only an editable control is missing. Add a BPM stepper to the `TransportBar`, styled in the existing transport chrome.

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx`
- Modify: `src/components/TransportBar/TransportBar.module.css`
- Test: `src/components/TransportBar/TransportBar.test.tsx`

- [ ] **Step 1: Add a tempo-stepper test**

In `src/components/TransportBar/TransportBar.test.tsx`, add (reconcile imports with the existing file — it already renders `<TransportBar />` via `renderWithAtoms`):

```tsx
import { progressionTempoBpmAtom } from "../../store/atoms";

describe("TransportBar tempo", () => {
  it("renders the current tempo in BPM", () => {
    renderWithAtoms(<TransportBar />, [[progressionTempoBpmAtom, 90]]);
    expect(screen.getByText(/90 BPM/)).toBeInTheDocument();
  });

  it("increases the tempo by 5 BPM when the increment button is pressed", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<TransportBar />, [[progressionTempoBpmAtom, 90]]);
    await user.click(screen.getByRole("button", { name: /increase tempo/i }));
    expect(screen.getByText(/95 BPM/)).toBeInTheDocument();
  });

  it("does not raise the tempo above 240 BPM", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<TransportBar />, [[progressionTempoBpmAtom, 238]]);
    await user.click(screen.getByRole("button", { name: /increase tempo/i }));
    expect(screen.getByText(/240 BPM/)).toBeInTheDocument();
  });
});
```

If the file does not already import `userEvent` / `screen` / `renderWithAtoms`, add them — match the import style used by `ViewTab.test.tsx`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test -- TransportBar`
Expected: FAIL — no tempo control rendered.

- [ ] **Step 3: Add the tempo stepper to `TransportBar.tsx`**

In `src/components/TransportBar/TransportBar.tsx`:

(a) Add `Minus` and `Plus` to the `lucide-react` import list.

(b) Add the tempo domain constants to the imports:

```tsx
import {
  MAX_PROGRESSION_TEMPO_BPM,
  MIN_PROGRESSION_TEMPO_BPM,
} from "../../progressions/progressionDomain";
```

(c) Add `progressionTempoBpm` and `setProgressionTempoBpm` to the `useProgressionState()` destructure.

(d) After the destructure, add a clamped setter:

```tsx
  const adjustTempo = (delta: number) =>
    setProgressionTempoBpm(
      Math.min(
        MAX_PROGRESSION_TEMPO_BPM,
        Math.max(MIN_PROGRESSION_TEMPO_BPM, progressionTempoBpm + delta),
      ),
    );
```

(e) At the end of the transport row — after the `instrumentCluster` `<div>` and before the closing `</div>` of `.transportBar` — add a divider and the tempo cluster:

```tsx
      <span className={styles.clusterDivider} aria-hidden="true" />

      <div className={styles.tempoCluster} role="group" aria-label="Tempo">
        <button
          type="button"
          className={styles.transportButton}
          onClick={() => adjustTempo(-5)}
          disabled={progressionTempoBpm <= MIN_PROGRESSION_TEMPO_BPM}
          aria-label="Decrease tempo"
        >
          <Minus size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <span className={styles.tempoValue} data-testid="transport-tempo">
          {progressionTempoBpm} BPM
        </span>
        <button
          type="button"
          className={styles.transportButton}
          onClick={() => adjustTempo(5)}
          disabled={progressionTempoBpm >= MAX_PROGRESSION_TEMPO_BPM}
          aria-label="Increase tempo"
        >
          <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
```

- [ ] **Step 4: Add the tempo-cluster styles**

In `src/components/TransportBar/TransportBar.module.css`, append:

```css
.tempoCluster {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  flex-shrink: 0;
}

.tempoValue {
  min-width: 3.6rem;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--track-accent);
  letter-spacing: 0.04em;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm run test -- TransportBar`
Expected: PASS.

- [ ] **Step 6: Run lint**

Run: `pnpm run lint`
Expected: PASS — no unused imports.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/components/TransportBar/TransportBar.module.css src/components/TransportBar/TransportBar.test.tsx
git commit -m "feat(transport): add editable tempo stepper to the TransportBar"
```

---

## Task 12: Full verification and visual snapshot refresh

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit/component suite**

Run: `pnpm run test`
Expected: PASS — all suites green.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint`
Expected: PASS — eslint + stylelint clean.

- [ ] **Step 3: Run the production build**

Run: `pnpm run build`
Expected: `tsc -b` and `vite build` both succeed with no errors.

- [ ] **Step 4: Visually verify each tab in the dev server**

Start the dev server and confirm:
- **View tab:** Fret Range sits in the DISPLAY group; no Full Chords or Tap to Play toggles; the fret-range stepper is the same height as the Notes/Accidentals toggle bars.
- **Scale tab:** columns read KEY · CIRCLE OF FIFTHS · THEORY; the header reads "CIRCLE OF FIFTHS"; the circle is visibly smaller; the Theory column shows a diatonic chord list and no Tones row; the Family/Variant steppers match the toggle-bar height.
- **Progression tab:** the Add/move/duplicate/delete actions sit on the CHORDS header row; the chord list is denser; the editor shows a "SELECTED — …" header; the quality picker is the `ChordTypeGrid` with no Diatonic button and the active degree shows `*` when a quality is set; no Loop control; the Swing slider has a filled cyan track; the Backing Track dropdowns match the inspector's styled selects.
- **TransportBar:** an editable BPM stepper (`− / value / +`) sits in the transport row; pressing the buttons changes the tempo in 5 BPM steps and clamps at 40 / 240; the StatusBar tempo field mirrors the value.

- [ ] **Step 5: Refresh the visual regression snapshots**

The affected tabs are covered by the `app-components` and `app-overlays` e2e suites. Refresh the darwin baselines:

Run: `pnpm run test:visual:update`
Expected: snapshots regenerate; review the diff to confirm only the intended tabs changed.

- [ ] **Step 6: Commit the refreshed snapshots**

```bash
git add e2e
git commit -m "test(inspector): refresh visual snapshots for tab refinements"
```

---

## Self-Review Notes

- **Spec coverage:** Cross-cutting height (Task 2); View tab moves/removals (Task 3); Scale column order + header rename (Tasks 1, 4); Tones→chord list (Tasks 1, 5); compact circle + StepperSelect (Task 6); Progression header actions + list shrink (Task 7); unified quality picker with `*` (Task 8); SELECTED header + Loop removal + compact steppers (Tasks 2, 9); Swing + Backing Track restyle (Task 10); TransportBar tempo stepper (Task 11). All spec sections map to a task.
- **Loop relocation** is explicitly out of scope per the spec — Task 9 only removes it from the Progression tab.
- **`factTones` / `fullChordsEnabledAtom` / `isMutedAtom`** are intentionally left in the codebase; only their Scale/View tab exposure changes.
