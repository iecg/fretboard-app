# DAW Shell Phase 5 Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three DAW-shell issues from Phase 5 — the unreachable Progression tab, the duplicated chord readout, and the unfinished DAW reskin of the top-band components.

**Architecture:** Three independent corrections. (A) The Inspector stops gating the Progression tab on `progressionEnabledAtom` — all four tabs are always visible. (B) The `ChordSelectionCallout` (which duplicates the above-the-fretboard `ChordPracticeBar`) is deleted; its Duplicate action moves to `ProgressionControls`. (C) `DegreeChipStrip` and `ChordPracticeBar` get the DAW faceplate typographic language.

**Tech Stack:** React 19, TypeScript, Jotai atoms, Radix Tabs, CSS Modules, lucide-react icons, Vitest + Testing Library, Playwright visual regression.

**Spec:** `docs/superpowers/specs/2026-05-16-daw-shell-phase-5-corrections-design.md`

---

## Notes for the implementer

- `ProgressionControls` uses **hardcoded English UI strings** (e.g. `"Add"`, `"Remove"`, `aria-label="Add chord"`), not i18n `t()` calls. The new Duplicate button follows that same hardcoded style — no new i18n key is added.
- `duplicateProgressionStepAtom` already exists and is already barrel-exported from `src/store/atoms.ts` (it shipped in Phase 5). This plan only wires it into the UI.
- `chordSourceIsProgressionAtom` stays — the Chord tab keeps its cyan→orange accent.

## File Structure

**Delete:**
- `src/components/Inspector/ChordSelectionCallout.tsx`
- `src/components/Inspector/ChordSelectionCallout.module.css`
- `src/components/Inspector/ChordSelectionCallout.test.tsx`

**Modify:**
- `src/components/Inspector/tabs.ts` — single 4-tab list.
- `src/components/Inspector/Inspector.tsx` — drop the progression-enabled gate.
- `src/components/Inspector/Inspector.test.tsx` — Progression tab is always present.
- `src/components/Inspector/ChordTab.tsx` — render only `ChordOverlayControls`.
- `src/components/Inspector/ChordTab.test.tsx` — drop callout-variant assertions.
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — remove the `chordCallout*` keys.
- `src/hooks/useProgressionState.ts` — expose `duplicateProgressionStep`.
- `src/components/ProgressionControls/ProgressionControls.tsx` — add a Duplicate button.
- `src/components/ProgressionControls/ProgressionControls.test.tsx` — test Duplicate.
- `src/components/DegreeChipStrip/DegreeChipStrip.module.css` — DAW micro-label header + cyan focus glow.
- `src/components/ChordPracticeBar/ChordPracticeBar.module.css` — DAW micro-label group labels/badges + cyan focus glow.

---

## Task 1: Always-visible Progression tab

**Files:**
- Modify: `src/components/Inspector/tabs.ts`
- Modify: `src/components/Inspector/Inspector.tsx`
- Modify: `src/components/Inspector/Inspector.test.tsx`

- [ ] **Step 1: Confirm `ALWAYS_VISIBLE_TABS` / `PROGRESSION_TAB` have no other consumers**

Run: `grep -rn "ALWAYS_VISIBLE_TABS\|PROGRESSION_TAB" src`
Expected: matches only in `src/components/Inspector/tabs.ts` and `src/components/Inspector/Inspector.tsx`. If any other file imports them, stop and report — the rename in Step 4 would break it.

- [ ] **Step 2: Update the failing tests**

In `src/components/Inspector/Inspector.test.tsx`, replace the two progression-tab visibility tests (currently "hides the Progression tab when progressionEnabledAtom is false" and "shows the Progression tab when progressionEnabledAtom is true") with these:

```tsx
  it("renders the Progression tab even when progressionEnabledAtom is false", () => {
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, false]]);
    expect(screen.getByRole("tab", { name: "Progression" })).toBeInTheDocument();
  });

  it("renders the Progression tab when progressionEnabledAtom is true", () => {
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, true]]);
    expect(screen.getByRole("tab", { name: "Progression" })).toBeInTheDocument();
  });
```

Leave every other test in the file unchanged. Keep the existing import line for `progressionEnabledAtom, progressionStepsAtom, rootNoteAtom, scaleNameAtom` — all are still used.

- [ ] **Step 3: Run the tests to verify the first one fails**

Run: `npm run test -- src/components/Inspector/Inspector.test.tsx`
Expected: FAIL — "renders the Progression tab even when progressionEnabledAtom is false" fails because the tab is currently hidden when progression is off.

- [ ] **Step 4: Collapse the tab list in `tabs.ts`**

Replace the entire contents of `src/components/Inspector/tabs.ts`:

```ts
import type { Dictionary } from "../../i18n/types";

export type InspectorTabId = "view" | "scale" | "chord" | "progression";

export interface InspectorTabConfig {
  id: InspectorTabId;
  labelKey: keyof Dictionary["inspector"];
}

export const INSPECTOR_TABS: InspectorTabConfig[] = [
  { id: "view", labelKey: "viewTab" },
  { id: "scale", labelKey: "scaleTab" },
  { id: "chord", labelKey: "chordTab" },
  { id: "progression", labelKey: "progressionTab" },
];
```

- [ ] **Step 5: Drop the progression gate in `Inspector.tsx`**

Replace the entire contents of `src/components/Inspector/Inspector.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { useTranslation } from "../../hooks/useTranslation";
import { INSPECTOR_TABS, type InspectorTabId } from "./tabs";
import { ViewTab } from "./ViewTab";
import { ScaleTab } from "./ScaleTab";
import { ChordTab } from "./ChordTab";
import { ProgressionTab } from "./ProgressionTab";
import styles from "./Inspector.module.css";

const TAB_BODIES: Record<InspectorTabId, () => ReactNode> = {
  view: () => <ViewTab />,
  scale: () => <ScaleTab />,
  chord: () => <ChordTab />,
  progression: () => <ProgressionTab />,
};

export function Inspector() {
  const { t } = useTranslation();
  const [active, setActive] = useState<InspectorTabId>("view");

  return (
    <RadixTabs.Root
      className={styles.root}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      <RadixTabs.List className={styles.tabList} aria-label="Inspector">
        {INSPECTOR_TABS.map((tab) => (
          <RadixTabs.Trigger key={tab.id} value={tab.id} className={styles.tab}>
            {t(`inspector.${tab.labelKey}`)}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {INSPECTOR_TABS.map((tab) => (
        <RadixTabs.Content
          key={tab.id}
          value={tab.id}
          className={styles.tabPanel}
          data-tab-id={tab.id}
        >
          {TAB_BODIES[tab.id]()}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -- src/components/Inspector/Inspector.test.tsx`
Expected: PASS — all Inspector tests green.

- [ ] **Step 7: Commit**

```bash
git add src/components/Inspector/tabs.ts src/components/Inspector/Inspector.tsx src/components/Inspector/Inspector.test.tsx
git commit -m "fix(inspector): keep the Progression tab always visible"
```

---

## Task 2: Remove ChordSelectionCallout

**Files:**
- Delete: `src/components/Inspector/ChordSelectionCallout.tsx`, `ChordSelectionCallout.module.css`, `ChordSelectionCallout.test.tsx`
- Modify: `src/components/Inspector/ChordTab.tsx`
- Modify: `src/components/Inspector/ChordTab.test.tsx`

- [ ] **Step 1: Update the ChordTab tests**

Replace the entire contents of `src/components/Inspector/ChordTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  progressionEnabledAtom,
  progressionStepsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
import { ChordTab } from "./ChordTab";

const PROGRESSION_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [progressionEnabledAtom, true],
  [
    progressionStepsAtom,
    [{ id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }],
  ],
] as const;

describe("ChordTab", () => {
  it("renders ChordOverlayControls", () => {
    renderWithAtoms(<ChordTab />);
    expect(screen.getByText(/chord mode/i)).toBeInTheDocument();
  });

  it("tags its root container with data-inspector-tab=chord", () => {
    const { container } = renderWithAtoms(<ChordTab />);
    expect(
      container.querySelector('[data-inspector-tab="chord"]'),
    ).not.toBeNull();
  });

  it("uses the overlay accent when progression mode is off", () => {
    const { container } = renderWithAtoms(<ChordTab />, [
      [progressionEnabledAtom, false],
    ]);
    expect(
      container.querySelector('[data-chord-accent="overlay"]'),
    ).not.toBeNull();
  });

  it("uses the progression accent when a progression step is the chord source", () => {
    const { container } = renderWithAtoms(<ChordTab />, [...PROGRESSION_SEEDS]);
    expect(
      container.querySelector('[data-chord-accent="progression"]'),
    ).not.toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ChordTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the ChordTab tests to verify they still pass**

Run: `npm run test -- src/components/Inspector/ChordTab.test.tsx`
Expected: PASS — the callout still renders for now, but these tests no longer assert on it, so they pass against the current code.

- [ ] **Step 3: Simplify `ChordTab.tsx`**

Replace the entire contents of `src/components/Inspector/ChordTab.tsx`:

```tsx
import { useAtomValue } from "jotai";
import { chordSourceIsProgressionAtom } from "../../store/atoms";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import styles from "./ChordTab.module.css";

export function ChordTab() {
  const isProgressionSource = useAtomValue(chordSourceIsProgressionAtom);
  return (
    <div
      className={styles.root}
      data-inspector-tab="chord"
      data-chord-accent={isProgressionSource ? "progression" : "overlay"}
    >
      <ChordOverlayControls />
    </div>
  );
}
```

`ChordTab.module.css` is unchanged — the `--chord-accent` cyan/orange switch stays.

- [ ] **Step 4: Delete the ChordSelectionCallout files**

```bash
git rm src/components/Inspector/ChordSelectionCallout.tsx src/components/Inspector/ChordSelectionCallout.module.css src/components/Inspector/ChordSelectionCallout.test.tsx
```

- [ ] **Step 5: Verify nothing else references ChordSelectionCallout**

Run: `grep -rn "ChordSelectionCallout" src`
Expected: no matches. If any remain, remove those references.

- [ ] **Step 6: Run tests + build to verify**

Run: `npm run test -- src/components/Inspector/ChordTab.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS — no dangling import of the deleted component.

- [ ] **Step 7: Commit**

```bash
git add src/components/Inspector/ChordTab.tsx src/components/Inspector/ChordTab.test.tsx
git commit -m "fix(inspector): remove ChordSelectionCallout, render only ChordOverlayControls"
```

---

## Task 3: Remove the unused chordCallout i18n keys

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Trim the `inspector` type**

In `src/i18n/types.ts`, replace the `inspector` block:

```ts
  inspector: {
    viewTab: string;
    scaleTab: string;
    chordTab: string;
    progressionTab: string;
  };
```

- [ ] **Step 2: Trim the English `inspector` block**

In `src/i18n/en.ts`, replace the `inspector` block:

```ts
  inspector: {
    viewTab: "View",
    scaleTab: "Scale",
    chordTab: "Chord",
    progressionTab: "Progression",
  },
```

- [ ] **Step 3: Trim the Spanish `inspector` block**

In `src/i18n/es.ts`, replace the `inspector` block:

```ts
  inspector: {
    viewTab: "Vista",
    scaleTab: "Escala",
    chordTab: "Acorde",
    progressionTab: "Progresión",
  },
```

- [ ] **Step 4: Verify the build typechecks**

Run: `npm run build`
Expected: PASS — the six `chordCallout*` keys had no remaining consumer after Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "chore(i18n): drop unused chordCallout strings"
```

---

## Task 4: Duplicate-step action in ProgressionControls

**Files:**
- Modify: `src/hooks/useProgressionState.ts`
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`
- Modify: `src/components/ProgressionControls/ProgressionControls.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/ProgressionControls/ProgressionControls.test.tsx`, add this test inside the `describe("ProgressionControls", ...)` block (after the existing "selects steps and edits…" test). The file already imports `makeAtomStore`, `renderWithStore`, `userEvent`, `screen`, `progressionStepsAtom`, and defines `BASE_SEEDS`:

```tsx
  it("duplicates the active step via the Duplicate button", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    // BASE_SEEDS active index defaults to 0 -> the "I" step is active.
    await userEvent.click(screen.getByRole("button", { name: /duplicate chord/i }));

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual([
      "I",
      "I",
      "V",
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/ProgressionControls/ProgressionControls.test.tsx`
Expected: FAIL — no button with accessible name "Duplicate chord" exists yet.

- [ ] **Step 3: Expose `duplicateProgressionStep` from the hook**

In `src/hooks/useProgressionState.ts`:

First, add `duplicateProgressionStepAtom` to the import from `../store/atoms` — place it next to `addProgressionStepAtom` in the import list:

```ts
  addProgressionStepAtom,
  duplicateProgressionStepAtom,
```

Then, in the returned object, add the setter next to `addProgressionStep` (which reads `addProgressionStep: useSetAtom(addProgressionStepAtom),`):

```ts
    addProgressionStep: useSetAtom(addProgressionStepAtom),
    duplicateProgressionStep: useSetAtom(duplicateProgressionStepAtom),
```

- [ ] **Step 4: Add the Duplicate button to ProgressionControls**

In `src/components/ProgressionControls/ProgressionControls.tsx`:

First, add `CopyPlus` to the lucide-react import (keep it alphabetical):

```ts
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
```

Then, in the `useProgressionState()` destructure, add `duplicateProgressionStep` next to `addProgressionStep`:

```ts
    addProgressionStep,
    duplicateProgressionStep,
    removeProgressionStep,
```

Then, in the `<div className={styles["step-actions"]}>` group, add the Duplicate button immediately before the Remove button (the one with `aria-label="Remove chord"`):

```tsx
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/components/ProgressionControls/ProgressionControls.test.tsx`
Expected: PASS — clicking Duplicate inserts a copy of the active "I" step after it, producing degrees `["I", "I", "V"]`.

- [ ] **Step 6: Run lint to confirm clean**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProgressionState.ts src/components/ProgressionControls/ProgressionControls.tsx src/components/ProgressionControls/ProgressionControls.test.tsx
git commit -m "feat(progressions): add a Duplicate step action to ProgressionControls"
```

---

## Task 5: DAW reskin — DegreeChipStrip

**Files:**
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.module.css`

This is a CSS-only restyle. There is no unit test for visual styling; correctness is verified by lint, the unchanged component tests, and the visual-regression refresh in Task 7. Make only the edits below — do not restructure the file.

- [ ] **Step 1: Restyle the strip header as a DAW micro-label**

In `src/components/DegreeChipStrip/DegreeChipStrip.module.css`, replace the `.degree-chip-strip-header` rule (currently `composes: card-section-header` with `font-size: 0.72rem` and `color: var(--chip-text-inactive)`):

```css
.degree-chip-strip-header {
  composes: card-section-header from "../shared/shared.module.css";

  /* DAW faceplate micro-label — matches the Inspector's section labels. */
  font-size: var(--text-2xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--surface-control-fg-muted);
}
```

- [ ] **Step 2: Remove the responsive header font-size overrides**

So the micro-label stays consistent across tiers (the Inspector tab labels are a fixed size), delete these two rules from the same file:

```css
:global(.app-container[data-layout-tier="mobile"]) .degree-chip-strip-header {
  font-size: 0.92rem;
}
```

and

```css
:global(.app-container[data-layout-tier="desktop"]) .degree-chip-strip-header {
  font-size: clamp(0.84rem, 1.2vw, 0.96rem);
}
```

Leave every other `mobile` / `desktop` rule in those blocks (chip sizes, note/interval font sizes) untouched.

- [ ] **Step 3: Add a cyan focus glow to the chips**

Replace the `.degree-chip:focus-visible` rule:

```css
.degree-chip:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
  box-shadow: var(--glow-cyan-sm);
}
```

The semantic role borders/glows (in-scale cyan, tonic orange, color-tone) are intentionally left unchanged — they are the note-role coding.

- [ ] **Step 4: Verify lint and the component tests**

Run: `npm run lint`
Expected: PASS — stylelint clean.

Run: `npm run test -- src/components/DegreeChipStrip/`
Expected: PASS — DOM/behavior unchanged, so the existing DegreeChipStrip tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/components/DegreeChipStrip/DegreeChipStrip.module.css
git commit -m "style(degree-chip-strip): DAW faceplate micro-label header + cyan focus glow"
```

---

## Task 6: DAW reskin — ChordPracticeBar

**Files:**
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.module.css`

CSS-only restyle. Verified by lint, the unchanged component tests, and Task 7's visual refresh. Make only the edits below.

- [ ] **Step 1: Restyle the group labels as DAW micro-labels**

In `src/components/ChordPracticeBar/ChordPracticeBar.module.css`, replace the `.practice-bar-group-label` rule (currently `font-size: 0.68rem`, `letter-spacing: 0.06em`, `font-weight: var(--font-weight-semibold)`, `opacity: 0.6`):

```css
.practice-bar-group-label {
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 500;
  color: var(--surface-control-fg-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}
```

Note: the `opacity: 0.6` is dropped — the muted color now carries the de-emphasis. Leave the existing `.practice-bar-group[data-group-variant="land-on"] .practice-bar-group-label` and the `[data-theme="modern-dark"]` group-label rules in place; they still apply on top of this base rule.

- [ ] **Step 2: Remove the dark-theme group-label opacity override**

The base rule no longer sets `opacity`, so delete this now-misleading rule:

```css
:global([data-theme="modern-dark"]) .practice-bar-group-label {
  color: var(--text-muted);
  opacity: 0.5;
}
```

Leave the `land-on` variant rules (`.practice-bar-group[data-group-variant="land-on"] .practice-bar-group-label` and its dark-theme override) untouched.

- [ ] **Step 3: Align the badge and lens label to faceplate micro-label chrome**

Replace the `.chord-practice-bar-badge` rule (currently `font-size: 0.7rem`, `letter-spacing: 0.04em`):

```css
.chord-practice-bar-badge {
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 500;
  color: var(--surface-control-fg-muted);
  line-height: 1;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: var(--chip-surface-inactive);
  border: 1px solid var(--chip-border-inactive);
  border-radius: 0.3rem;
  padding: 0.15rem 0.35rem;
  white-space: nowrap;
}
```

The `.chord-practice-bar-lens-label` rule keeps its current size/padding (it carries a readable lens name, not a micro-label) — leave it unchanged.

- [ ] **Step 4: Confirm the chord-name title is left alone**

Do NOT change `.chord-practice-bar-title` or its responsive overrides — the title shows the chord name (content), not a micro-label, and stays readable.

- [ ] **Step 5: Verify lint and the component tests**

Run: `npm run lint`
Expected: PASS

Run: `npm run test -- src/components/ChordPracticeBar/`
Expected: PASS — DOM/behavior unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordPracticeBar/ChordPracticeBar.module.css
git commit -m "style(chord-practice-bar): DAW faceplate micro-label group labels + badge"
```

---

## Task 7: Final verification + visual baselines

**Files:**
- Modify: visual-regression snapshots under `e2e/` (darwin + linux baselines for top-band / Inspector suites)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS — eslint + stylelint clean.

- [ ] **Step 2: Run the full unit/component suite**

Run: `npm run test`
Expected: PASS — all suites green, including the updated `Inspector`, `ChordTab`, and `ProgressionControls` tests, and with no `ChordSelectionCallout` test file remaining.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Refresh the darwin visual baselines**

The Inspector now always shows the Progression tab, the Chord tab no longer has the callout, and the top-band components are restyled — so the visual suites that capture these change intentionally.

Run: `npm run test:visual:update`
Expected: darwin snapshots regenerated; the run passes.

- [ ] **Step 5: Review the snapshot diffs**

Run: `git status --short e2e`

Inspect each changed `.png`. Confirm the changes are exactly the intended ones: Progression tab always present in the Inspector tab row; no callout above `ChordOverlayControls` in the Chord tab; `DegreeChipStrip` header and `ChordPracticeBar` group-labels/badge now render as small uppercase faceplate micro-labels. Reject and re-investigate any snapshot that changed outside these areas.

- [ ] **Step 6: Refresh the linux visual baselines**

Run: `npm run test:visual:update:linux`
Expected: linux snapshots regenerated. If the command's Docker tooling is unavailable locally, note in the PR description that linux baselines must be refreshed in CI.

- [ ] **Step 7: Commit the baselines**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for DAW shell Phase 5 corrections"
```

- [ ] **Step 8: Final check**

Run: `npm run lint && npm run test && npm run build`
Expected: all PASS — ready to open the PR.

---

## Acceptance criteria (from spec §7)

- Progression tab is visible even with progression mode off; its "Progression mode" switch turns progression back on. — Task 1
- Chord tab renders only `ChordOverlayControls`; no `ChordSelectionCallout` remains; the cyan→orange accent still works. — Tasks 2, 3
- `ProgressionControls` has a working Duplicate step action reusing `duplicateProgressionStepAtom`; the `inspector.chordCallout*` keys are gone. — Tasks 3, 4
- `DegreeChipStrip` and `ChordPracticeBar` carry the DAW faceplate micro-label language; semantic note-role colors unchanged. — Tasks 5, 6
- `npm run lint`, `npm run test`, `npm run build` pass; visual baselines refreshed. — Task 7
