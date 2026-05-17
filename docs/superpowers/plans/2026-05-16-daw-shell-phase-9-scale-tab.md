# DAW Shell Phase 9 — Scale Tab 3-Column Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Inspector's Scale tab into the design's 3-column DAW layout — a Key picker, a Theory-facts readout, and the Circle of Fifths — each under its own group header.

**Architecture:** `ScaleTab` becomes a bespoke 3-column CSS grid (`5fr / 4fr / 3fr` on desktop, stacked on smaller tiers). Each column is a flex `<div>` carrying a reused `GroupHeader` (from Phase 8's `InspectorGrid`) plus its content: column 1 = `ScaleSelector` (refactored to emit `Prop` cells), column 2 = a new read-only `ScaleTheoryFacts` component, column 3 = the existing `CircleOfFifths`. `GroupHeader`/`Prop`'s `grid-column`/`grid-column:span` declarations are inert inside a flex column, so they compose cleanly without a `PropGrid`. The Theory facts derive entirely from the existing `degreeChipsAtom` — no new atoms.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, Vitest + Testing Library, Playwright (visual regression).

---

## Background for the implementer

Read these before starting:

- `docs/superpowers/specs/2026-05-16-daw-shell-phases-8-13-design.md` — the spec; this plan implements **Phase 9** (§5).
- `src/components/Inspector/ScaleTab.tsx` — the tab body being rebuilt.
- `src/components/ScaleSelector/ScaleSelector.tsx` — the leaf control being refactored.
- `src/components/Inspector/InspectorGrid.tsx` — Phase 8's layout primitives. This plan reuses `GroupHeader` and `Prop`. `Prop({ label, span?, hint?, children })` renders a flex-column cell: an uppercase mono label, the control, and an optional hint. `GroupHeader({ children, right? })` renders a label + hairline rule. Both set `grid-column*` properties that are simply ignored when the element is a flex child rather than a grid item — which is how this plan composes them outside a `PropGrid`.

Key facts:

- **`degreeChipsAtom`** (`src/store/scaleAtoms.ts`, re-exported from `src/store/atoms.ts`) is a derived atom returning, for the active root + scale, an array of `{ internalNote, note, interval, scaleDegree, degreeColor, inScale, isTonic }`. `note`/`interval`/`scaleDegree` are display-ready strings. This single atom supplies every Theory fact — Notes (`.note`), Intervals (`.interval`), Degrees (`.scaleDegree`), Tones (the array length). No new atom or theory logic is needed.
- **Key Signature and Parent key are intentionally NOT shown** in the Theory facts. The spec (§9b) marks them best-effort: Key Sig is already displayed by the Circle of Fifths in the same tab (column 3), so repeating it is redundant; a correct Parent-key derivation is not a clean one-liner. Theory facts = Notes / Intervals / Degrees / Tones only. This is a deliberate, spec-permitted scope decision.
- **`CircleOfFifths` is unchanged.** It is already responsive (`container-type: inline-size`, SVG `width: 100%`, `aspect-ratio: 1`, `max-width: 320px`) and already carries a `desktop-3col` layout rule in `CircleOfFifths.module.css`. It drops straight into the narrow wheel column.
- The `ScaleTab` is currently a 1-col → 2-col (desktop) grid. Phase 9 makes it 1-col (mobile/tablet) → 3-col (desktop).
- All controls bind to existing atoms (`rootNoteAtom`, `scaleNameAtom`, `scaleBrowseModeAtom`, etc.). **No new atoms.**
- The repo uses **pnpm**: `pnpm run lint`, `pnpm run test`, `pnpm run build`. Run specific test files with `pnpm run test -- <path> [<path> …]`.
- **Commit messages must be a single `type(scope): description` line — no body, no trailer** (the repo's commit-message hook validates every line). Use the exact commit command in each task's final step.
- This branch (`claude/daw-shell-phase-9-scale-tab`) is stacked on the Phase 8 branch, so Phase 8's `InspectorGrid` primitives and `inspector.*` i18n keys are already present.

Task order is mandatory: **Task 1 → 2 → 3 → 4.** Task 1 adds the i18n keys Tasks 2-3 reference. Task 2 builds the `ScaleTheoryFacts` component Task 3 mounts. Task 3 rebuilds the tab. Task 4 refreshes baselines and runs the gate.

---

## File Structure

**Created:**
- `src/components/Inspector/ScaleTheoryFacts.tsx` — read-only Notes/Intervals/Degrees/Tones readout.
- `src/components/Inspector/ScaleTheoryFacts.module.css` — its styling.
- `src/components/Inspector/ScaleTheoryFacts.test.tsx` — its unit tests.

**Modified:**
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — eight new `inspector.*` keys.
- `src/components/ScaleSelector/ScaleSelector.tsx` — emits `Prop` cells instead of `control-section` wrappers.
- `src/components/ScaleSelector/ScaleSelector.test.tsx` — updated for the `Prop`-cell structure.
- `src/components/Inspector/ScaleTab.tsx` — rebuilt as a 3-column layout.
- `src/components/Inspector/ScaleTab.module.css` — 3-column grid.
- `src/components/Inspector/ScaleTab.test.tsx` — column-header / theory-facts coverage.
- `e2e/*.visual.spec.ts-snapshots/*` — refreshed baselines (Task 4).

---

## Task 1: Add the Scale-tab i18n strings

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

Adding keys to `types.ts` first makes the build fail until both locale files supply them — that type error is this task's "failing test".

- [ ] **Step 1: Add the new keys to the `Dictionary` type**

In `src/i18n/types.ts`, the `inspector` block currently ends with the seven Phase 8 keys (`groupFingering` … `tapToPlay`). Add these eight lines immediately before the closing `};` of the `inspector` block:

```ts
    groupKey: string;
    groupTheory: string;
    groupWheel: string;
    factNotes: string;
    factIntervals: string;
    factDegrees: string;
    factTones: string;
    relationship: string;
```

- [ ] **Step 2: Run the build and verify it fails**

Run: `pnpm run build`
Expected: FAIL — `tsc` reports `en` and `es` are missing the eight new `inspector` properties.

- [ ] **Step 3: Add the English strings**

In `src/i18n/en.ts`, add these eight lines immediately before the closing `},` of the `inspector` block (after `tapToPlay: "Tap to Play",`):

```ts
    groupKey: "Key",
    groupTheory: "Theory",
    groupWheel: "Wheel",
    factNotes: "Notes",
    factIntervals: "Intervals",
    factDegrees: "Degrees",
    factTones: "Tones",
    relationship: "Relationship",
```

- [ ] **Step 4: Add the Spanish strings**

In `src/i18n/es.ts`, add these eight lines immediately before the closing `},` of the `inspector` block (after `tapToPlay: "Tocar al pulsar",`):

```ts
    groupKey: "Tonalidad",
    groupTheory: "Teoría",
    groupWheel: "Círculo",
    factNotes: "Notas",
    factIntervals: "Intervalos",
    factDegrees: "Grados",
    factTones: "Tonos",
    relationship: "Relación",
```

- [ ] **Step 5: Run the build and verify it passes**

Run: `pnpm run build`
Expected: PASS — both locales supply every `inspector` key.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): add Scale tab theory-fact strings"
```

---

## Task 2: Build the `ScaleTheoryFacts` readout

**Files:**
- Create: `src/components/Inspector/ScaleTheoryFacts.tsx`
- Create: `src/components/Inspector/ScaleTheoryFacts.module.css`
- Test: `src/components/Inspector/ScaleTheoryFacts.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/Inspector/ScaleTheoryFacts.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { ScaleTheoryFacts } from "./ScaleTheoryFacts";

describe("ScaleTheoryFacts", () => {
  it("renders the Notes, Intervals, Degrees, and Tones fact labels", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Intervals")).toBeInTheDocument();
    expect(screen.getByText("Degrees")).toBeInTheDocument();
    expect(screen.getByText("Tones")).toBeInTheDocument();
  });

  it("lists the notes of C major and reports a tone count of 7", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const notesRow = screen.getByText("Notes").closest("div");
    expect(notesRow?.textContent).toContain("C");
    expect(notesRow?.textContent).toContain("G");
    const tonesRow = screen.getByText("Tones").closest("div");
    expect(tonesRow?.textContent).toContain("7");
  });

  it("reflects a root change in the listed notes", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "G"],
      [scaleNameAtom, "Major"],
    ]);
    const notesRow = screen.getByText("Notes").closest("div");
    // G major contains F# — the seventh scale degree.
    expect(notesRow?.textContent).toContain("F");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm run test -- src/components/Inspector/ScaleTheoryFacts.test.tsx`
Expected: FAIL — `./ScaleTheoryFacts` does not exist yet.

- [ ] **Step 3: Create the `ScaleTheoryFacts` component**

Create `src/components/Inspector/ScaleTheoryFacts.tsx` with:

```tsx
import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { degreeChipsAtom } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ScaleTheoryFacts.module.css";

/**
 * Read-only theory readout for the Scale tab's middle column: the active
 * scale's notes, intervals, scale degrees, and tone count. Derives entirely
 * from `degreeChipsAtom` — no new atoms, no new theory logic.
 */
export function ScaleTheoryFacts() {
  const { t } = useTranslation();
  const chips = useAtomValue(degreeChipsAtom);

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
      <FactRow label={t("inspector.factTones")}>{chips.length}</FactRow>
    </dl>
  );
}

interface FactRowProps {
  label: string;
  children: ReactNode;
}

function FactRow({ label, children }: FactRowProps) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Create `src/components/Inspector/ScaleTheoryFacts.module.css` with:

```css
.facts {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
}

.row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--faceplate-divider);
}

.row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.label {
  flex: 0 0 4.5rem;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--dc-fg);
}

.value {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--dc-fg-strong);
}

.tonic {
  color: var(--neon-orange);
  font-weight: 600;
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm run test -- src/components/Inspector/ScaleTheoryFacts.test.tsx`
Expected: PASS — all four tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ScaleTheoryFacts.tsx src/components/Inspector/ScaleTheoryFacts.module.css src/components/Inspector/ScaleTheoryFacts.test.tsx
git commit -m "feat(inspector): add the Scale tab theory-facts readout"
```

---

## Task 3: Convert the Scale tab to a 3-column grid

This task refactors `ScaleSelector` and rebuilds `ScaleTab` together, in one commit.

**Files:**
- Modify: `src/components/ScaleSelector/ScaleSelector.tsx`
- Modify: `src/components/ScaleSelector/ScaleSelector.test.tsx`
- Modify: `src/components/Inspector/ScaleTab.tsx`
- Modify: `src/components/Inspector/ScaleTab.module.css`
- Modify: `src/components/Inspector/ScaleTab.test.tsx`

- [ ] **Step 1: Replace `ScaleSelector.test.tsx`**

The refactor replaces `ScaleSelector`'s `control-section` / `section-label` / `theory-mode-browser` wrappers with `Prop` cells, so the tests that assert those class names must change. Replace the entire contents of `src/components/ScaleSelector/ScaleSelector.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { getScaleFamilyOptions } from "@fretflow/core";
import { ScaleSelector } from "./ScaleSelector";

beforeEach(() => {
  localStorage.clear();
});

const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
] as const;

describe("ScaleSelector/ScaleSelector", () => {
  describe("Scale Family browser", () => {
    it("renders the Root and Scale Family labels", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getByText("Root")).toBeInTheDocument();
      expect(screen.getByText("Scale Family")).toBeInTheDocument();
    });

    it("renders Prev and Next scale family buttons", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(
        screen.getByRole("button", { name: "Previous scale family" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Next scale family" }),
      ).toBeInTheDocument();
    });

    it("renders Scale Family as a selectable dropdown", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const user = userEvent.setup();
      const familySelect = screen.getByRole("combobox", { name: "Scale Family" });
      expect(within(familySelect).getByText("Major Modes")).toBeInTheDocument();
      await user.click(familySelect);
      await user.click(screen.getByRole("option", { name: "Pentatonic" }));
      expect(
        within(screen.getByRole("combobox", { name: "Scale Family" })).getByText(
          "Pentatonic",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Variant" })).toBeInTheDocument();
    });

    it("clicking Next advances to the next family", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familyOptions = getScaleFamilyOptions();
      const secondFamily = familyOptions[1];
      await act(async () => {
        await userEvent.click(
          screen.getByRole("button", { name: "Next scale family" }),
        );
      });
      const familySelect = screen.getByRole("combobox", { name: "Scale Family" });
      expect(within(familySelect).getByText(secondFamily)).toBeInTheDocument();
    });

    it("clicking Prev from first family wraps to last", async () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      const familyOptions = getScaleFamilyOptions();
      const lastFamily = familyOptions[familyOptions.length - 1];
      await act(async () => {
        await userEvent.click(
          screen.getByRole("button", { name: "Previous scale family" }),
        );
      });
      const familySelect = screen.getByRole("combobox", { name: "Scale Family" });
      expect(within(familySelect).getByText(lastFamily)).toBeInTheDocument();
    });
  });

  describe("Parallel/relative toggle", () => {
    it("renders the Mode browser label when the scale supports relative browsing", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getAllByText("Mode").length).toBeGreaterThan(0);
    });

    it("renders Parallel and Relative toggle buttons", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(screen.getByRole("button", { name: "Parallel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Relative" })).toBeInTheDocument();
    });

    it("shows a short hint for Parallel/Relative behavior", () => {
      renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(
        screen.getByText("Cycle modes that share the current root note."),
      ).toBeInTheDocument();
    });
  });

  describe("a11y", () => {
    it("has no accessibility violations", async () => {
      const { container } = renderWithAtoms(<ScaleSelector />, [...BASE_SEEDS]);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
```

- [ ] **Step 2: Replace `ScaleTab.test.tsx`**

Replace the entire contents of `src/components/Inspector/ScaleTab.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { ScaleTab } from "./ScaleTab";

describe("ScaleTab", () => {
  it("renders the Key, Theory, and Wheel column headers", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Key")).toBeInTheDocument();
    expect(screen.getByText("Theory")).toBeInTheDocument();
    expect(screen.getByText("Wheel")).toBeInTheDocument();
  });

  it("renders the scale selector — root chips and the scale family picker", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("Scale Family")).toBeInTheDocument();
  });

  it("renders the Theory facts readout", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Degrees")).toBeInTheDocument();
  });

  it("lazy-loads and renders the Circle of Fifths", async () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: /circle of fifths/i }),
      ).toBeInTheDocument();
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: /circle of fifths/i }),
      ).toBeInTheDocument();
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 3: Run the test files and verify the new tests fail**

Run: `pnpm run test -- src/components/Inspector/ScaleTab.test.tsx src/components/ScaleSelector/ScaleSelector.test.tsx`
Expected: FAIL — `ScaleTab.test.tsx` fails (no "Key"/"Theory"/"Wheel" headers, no "Notes"/"Degrees" facts yet); `ScaleSelector.test.tsx` fails its `getByText("Root")` / `getByText("Scale Family")` cases because the current `ScaleSelector` puts those strings in `section-label` spans that the new query still finds — note: some `ScaleSelector` tests may still pass, but the suite as a whole is RED until Step 4.

- [ ] **Step 4: Refactor `ScaleSelector.tsx` to emit `Prop` cells**

Replace the entire contents of `src/components/ScaleSelector/ScaleSelector.tsx` with:

```tsx
import { startTransition } from "react";
import { NOTES } from "@fretflow/core";
import {
  getActiveScaleBrowseOption,
  getAdjacentScaleBrowseOption,
  getEffectiveScaleBrowseMode,
  getScaleBrowseOptions,
  getScaleFamilyOptions,
  getScaleMemberTerm,
  getScaleNameForFamilySelector,
  resolveScaleCatalogEntry,
  supportsRelativeScaleBrowsing,
  type ScaleBrowseMode,
} from "@fretflow/core";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { StepperSelect } from "../StepperSelect/StepperSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Prop } from "../Inspector/InspectorGrid";
import { useScaleState } from "../../hooks/useScaleState";

/**
 * Key picker for the Scale tab's first column. Emits a fragment of `Prop`
 * cells (Root / Scale Family / Variant / Relationship) so it composes into the
 * Scale tab's column layout. All state is held in existing atoms via
 * `useScaleState`.
 */
export function ScaleSelector() {
  const { t } = useTranslation();
  const {
    rootNote,
    setRootNote,
    scaleName,
    setScaleName,
    scaleBrowseMode,
    setScaleBrowseMode,
    useFlats,
  } = useScaleState();

  const scaleEntry = resolveScaleCatalogEntry(scaleName);
  const familyOptions = getScaleFamilyOptions();
  const currentFamily = scaleEntry.family;
  const memberTerm = getScaleMemberTerm(scaleEntry.member.scaleName);
  const supportsRelativeBrowse = supportsRelativeScaleBrowsing(
    scaleEntry.member.scaleName,
  );
  const effectiveBrowseMode = getEffectiveScaleBrowseMode(
    scaleEntry.member.scaleName,
    scaleBrowseMode,
  );
  const browseOptions = getScaleBrowseOptions(
    rootNote,
    scaleEntry.member.scaleName,
    effectiveBrowseMode,
    useFlats,
  );
  const activeBrowseOption = getActiveScaleBrowseOption(
    rootNote,
    scaleEntry.member.scaleName,
    effectiveBrowseMode,
    useFlats,
  );

  const familySelectOptions = familyOptions.map((option) => ({
    value: option,
    label: option,
  }));

  const browseSelectOptions = browseOptions.map((option) => ({
    value: option.label,
    label: option.label,
  }));

  const applyRootNote = (note: string) => {
    startTransition(() => {
      setRootNote(note);
    });
  };

  const applyTheorySelection = (nextRootNote: string, nextScaleName: string) => {
    startTransition(() => {
      setRootNote(nextRootNote);
      setScaleName(nextScaleName);
    });
  };

  const handleFamilySelect = (selectorLabel: string) => {
    if (selectorLabel === currentFamily.selectorLabel) return;
    startTransition(() => {
      setScaleName(getScaleNameForFamilySelector(selectorLabel));
    });
  };

  const handleStepFamily = (direction: -1 | 1) => {
    const currentIndex = familyOptions.indexOf(currentFamily.selectorLabel);
    const nextIndex =
      (currentIndex + direction + familyOptions.length) % familyOptions.length;
    handleFamilySelect(familyOptions[nextIndex]);
  };

  const handleBrowseSelect = (selectedLabel: string) => {
    const selectedOption = browseOptions.find(
      (option) => option.label === selectedLabel,
    );
    if (!selectedOption) return;
    if (selectedOption.label === activeBrowseOption.label) {
      return;
    }
    applyTheorySelection(selectedOption.rootNote, selectedOption.scaleName);
  };

  const handleStepBrowse = (direction: -1 | 1) => {
    const nextOption = getAdjacentScaleBrowseOption(
      rootNote,
      scaleEntry.member.scaleName,
      effectiveBrowseMode,
      direction,
      useFlats,
    );
    applyTheorySelection(nextOption.rootNote, nextOption.scaleName);
  };

  return (
    <>
      <Prop label="Root">
        <NoteGrid
          notes={NOTES}
          selected={rootNote}
          onSelect={applyRootNote}
          useFlats={useFlats}
        />
      </Prop>

      <Prop label="Scale Family">
        <StepperSelect
          selectLabel="Scale Family"
          groupLabel="Browse scale families"
          previousLabel="Previous scale family"
          nextLabel="Next scale family"
          value={currentFamily.selectorLabel}
          options={familySelectOptions}
          onChange={handleFamilySelect}
          onPrevious={() => handleStepFamily(-1)}
          onNext={() => handleStepFamily(1)}
        />
      </Prop>

      <Prop label={memberTerm}>
        <StepperSelect
          selectLabel={memberTerm}
          groupLabel={`Browse ${memberTerm}`}
          previousLabel={`Previous ${memberTerm}`}
          nextLabel={`Next ${memberTerm}`}
          value={activeBrowseOption.label}
          options={browseSelectOptions}
          onChange={handleBrowseSelect}
          onPrevious={() => handleStepBrowse(-1)}
          onNext={() => handleStepBrowse(1)}
        />
      </Prop>

      {supportsRelativeBrowse ? (
        <Prop
          label={t("inspector.relationship")}
          hint={
            effectiveBrowseMode === "parallel"
              ? t("controls.scaleParallelHint")
              : t("controls.scaleRelativeHint")
          }
        >
          <ToggleBar
            options={[
              { value: "parallel", label: "Parallel" },
              { value: "relative", label: "Relative" },
            ]}
            value={effectiveBrowseMode}
            onChange={(value) => setScaleBrowseMode(value as ScaleBrowseMode)}
            label="Scale relationship"
          />
        </Prop>
      ) : null}
    </>
  );
}
```

The deliberate changes: the `shared` and `TheoryControls.module.css` imports are gone; `Prop` is imported from `../Inspector/InspectorGrid`; the four `control-section` / `theory-mode-browser` wrappers become `Prop` cells; the Parallel/Relative `field-hint` paragraph becomes the `Prop`'s `hint`. The `memberTerm` (e.g. `"Mode"`) is the third `Prop`'s label — the `ScaleSelector` test's `getAllByText("Mode")` still finds it.

- [ ] **Step 5: Rebuild `ScaleTab.tsx` as a 3-column layout**

Replace the entire contents of `src/components/Inspector/ScaleTab.tsx` with:

```tsx
import { lazy, Suspense } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import {
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
  enharmonicDisplayAtom,
} from "../../store/atoms";
import { ScaleSelector } from "../ScaleSelector/ScaleSelector";
import { ScaleTheoryFacts } from "./ScaleTheoryFacts";
import { GroupHeader } from "./InspectorGrid";
import { CircleOfFifthsSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ScaleTab.module.css";

const CircleOfFifths = lazy(() =>
  import("../CircleOfFifths/CircleOfFifths").then((m) => ({
    default: m.CircleOfFifths,
  })),
);

export function ScaleTab() {
  const { t } = useTranslation();
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName] = useAtom(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  return (
    <div className={styles.root} data-inspector-tab="scale">
      <div className={styles.col}>
        <GroupHeader>{t("inspector.groupKey")}</GroupHeader>
        <ScaleSelector />
      </div>
      <div className={styles.col}>
        <GroupHeader>{t("inspector.groupTheory")}</GroupHeader>
        <ScaleTheoryFacts />
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
    </div>
  );
}
```

- [ ] **Step 6: Replace `ScaleTab.module.css` with the 3-column grid**

Replace the entire contents of `src/components/Inspector/ScaleTab.module.css` with:

```css
.root {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3, 0.75rem);
}

/* Three columns on desktop — Key (widest) / Theory / Wheel. Gated on the
   layout-tier attribute per the project's responsive-CSS contract; mobile and
   tablet stack the columns vertically. */
:global(.app-container[data-layout-tier="desktop"]) .root {
  grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) minmax(0, 3fr);
  gap: 1.25rem;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.col[data-scale-col="wheel"] {
  align-items: center;
}
```

- [ ] **Step 7: Run the test files and verify they pass**

Run: `pnpm run test -- src/components/Inspector/ScaleTab.test.tsx src/components/ScaleSelector/ScaleSelector.test.tsx src/components/Inspector/ScaleTheoryFacts.test.tsx`
Expected: PASS — all three suites pass.

- [ ] **Step 8: Run lint and build**

Run: `pnpm run lint`
Expected: PASS — no unused imports (`shared` and the `TheoryControls.module.css` import were removed from `ScaleSelector.tsx`).

Run: `pnpm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/ScaleSelector/ScaleSelector.tsx src/components/ScaleSelector/ScaleSelector.test.tsx src/components/Inspector/ScaleTab.tsx src/components/Inspector/ScaleTab.module.css src/components/Inspector/ScaleTab.test.tsx
git commit -m "feat(inspector): convert the Scale tab to a 3-column grid"
```

---

## Task 4: Refresh visual baselines and run the full verification

**Files:**
- Modify (regenerated): `e2e/*.visual.spec.ts-snapshots/*` — any snapshot whose images changed.

- [ ] **Step 1: Run the mandatory pre-PR checks**

Run: `pnpm run lint` → Expected: PASS.
Run: `pnpm run test` → Expected: PASS — the full unit/component suite is green.
Run: `pnpm run build` → Expected: PASS.

- [ ] **Step 2: Refresh the darwin visual-regression baselines**

Run: `pnpm run test:visual:update`
Expected: darwin snapshots are rebuilt. The Scale-tab captures (in `app-components` / `app-layout` / `inspector` suites, and any full-app capture that shows the Inspector) now show the 3-column Key / Theory / Wheel layout.

- [ ] **Step 3: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots are regenerated for the same suites. If `test:visual:update:linux` fails for an environment reason (no Docker / no Linux container available) rather than a real snapshot diff, record the exact failing command and error, finish the remaining steps, and report DONE_WITH_CONCERNS — the linux baselines are regenerated by CI.

- [ ] **Step 4: Confirm the visual suite passes against the new baselines**

Run: `pnpm run test:visual`
Expected: PASS — every visual spec matches the freshly updated baselines.

- [ ] **Step 5: Manual sanity check of the snapshot diff**

Run: `git status --short e2e`
Inspect the changed snapshot images: the Scale tab should now render as three columns — a Key picker (root chips + family/variant steppers), a Theory readout (Notes / Intervals / Degrees / Tones), and the Circle of Fifths — each under a cyan group header. If a snapshot still shows the old two-column Scale tab, a source change was missed — fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for the Scale tab grid"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — against `2026-05-16-daw-shell-phases-8-13-design.md` §5:
- §5a (3-column layout: Key picker / Theory facts / Wheel; `ScaleSelector` refactored to grid cells; the Parallel/Relative `ToggleBar` kept in the Key column; `CircleOfFifths` kept and placed in column 3) → Task 3.
- §5b (Theory facts column — Notes / Intervals / Degrees / Tones from `degreeChipsAtom`; new label strings via `useTranslation`; no new atoms) → Tasks 1 + 2. Key Sig and Parent are deliberately omitted — §5b explicitly permits omission when not cleanly available; Key Sig is moreover already shown by the Circle of Fifths in the same tab. This is recorded in "Background" so the spec reviewer does not flag it as missing.
- §5 Data flow ("all existing atoms, no new atoms") → confirmed: `rootNoteAtom`, `setRootNoteAtom`, `scaleNameAtom`, `scaleBrowseModeAtom`, `useFlatsAtom`, `enharmonicDisplayAtom`, `degreeChipsAtom` all pre-exist and are re-exported from the `store/atoms` barrel.
- §5 Testing (ScaleTab tests, ScaleSelector updated, new ScaleTheoryFacts tests, visual refresh) → Tasks 2, 3, 4.
- §5 Acceptance criteria (3-column grid: Key / Theory / Wheel; accurate Notes/Intervals/Degrees/Tones; Root/Family/Variant/Parallel-Relative still drive their atoms; lint/test/build pass) → verified across Task 3 steps 7-8 and Task 4 step 1.

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases" placeholders; every code step gives complete file contents, and every command has an expected result.

**Type consistency:** `Prop` and `GroupHeader` are consumed with the signatures defined by Phase 8's `InspectorGrid.tsx` (`Prop({ label, span?, hint?, children })`, `GroupHeader({ children })`). `degreeChipsAtom`'s chip shape (`internalNote`, `note`, `interval`, `scaleDegree`, `isTonic`) is used consistently in `ScaleTheoryFacts.tsx`. The eight `inspector.*` keys added in Task 1 (`groupKey`, `groupTheory`, `groupWheel`, `factNotes`, `factIntervals`, `factDegrees`, `factTones`, `relationship`) are exactly the keys referenced by `t(...)` in Tasks 2-3. `ScaleSelector` and `ScaleTab` keep their existing `useScaleState` / atom wiring — only their rendered structure changes.

---

## Execution complete

After Task 4, the branch is ready for a PR — Phase 9, stacked on the Phase 8 PR (#407), with `pnpm run lint`, `pnpm run test`, and `pnpm run build` green and visual baselines refreshed. Phase 10 (Chord tab) is the next plan.
