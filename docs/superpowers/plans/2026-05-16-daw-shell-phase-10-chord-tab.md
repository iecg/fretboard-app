# DAW Shell Phase 10 — Chord Tab 6-Column Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Inspector's Chord tab into the design's 6-column DAW property grid — SOURCE / CHORD TYPE / VOICING groups — with the chord-type quality picker rendered as a wrapping cell grid.

**Architecture:** `ChordOverlayControls` is refactored to render a `PropGrid columns={6}` (from Phase 8's `InspectorGrid`) with three `GroupHeader` groups. All of its conditional logic is preserved: degree/manual modes, the one/two-string pattern disable, the Full-Chords support gating, the lens auto-exit, and the cyan/orange accent. A new `ChordTypeGrid` component renders the chord-type qualities as a wrapping CSS-grid of cells — a *new* component, so the shared `ToggleBar` is untouched. A "Show on Board" toggle (bound to the existing `chordOverlayHiddenAtom`) is added to the VOICING group. CAGED Span / String Set are descoped per the spec.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, `clsx`, Vitest + Testing Library, Playwright (visual regression).

---

## Background for the implementer

Read these before starting:

- `docs/superpowers/specs/2026-05-16-daw-shell-phases-8-13-design.md` — the spec; this plan implements **Phase 10** (§7, "Phase 10 — Chord tab").
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — the leaf control being refactored (a heavily conditional component).
- `src/components/Inspector/ChordTab.tsx` — the tab wrapper (UNCHANGED by this plan — it keeps `data-inspector-tab="chord"` and the `data-chord-accent` attribute).
- `src/components/Inspector/InspectorGrid.tsx` — Phase 8's layout primitives. This plan reuses `PropGrid`, `Prop`, `GroupHeader`. `Prop({ label, span?, hint?, children })` renders a flex-column cell (label `<span class*='propLabel'>`, control, optional `<p>` hint). `GroupHeader` renders an `<h3>` label + hairline rule and is `grid-column: 1 / -1` inside a `PropGrid`.

Key facts:

- `ChordOverlayControls` is intentionally conditional: it has degree vs. manual modes, a one/two-string-pattern disable (`isPatternDisabled`), the chord-type picker that appears in manual mode always and in degree mode only once a degree is chosen, a Full-Chords switch gated by `fullChordsSupported`, and a lens picker. **Every one of these behaviors is preserved** — the refactor changes layout (wrappers → `PropGrid` cells), not logic. The component's 680-line test suite (`ChordOverlayControls.test.tsx`) is the behavior contract; almost all of it is behavioral (`getByRole`/`getByText`) and survives the refactor unchanged.
- The chord-type picker is currently a horizontally-scrolling `ToggleBar` (`overflow="scroll"`). It becomes a `ChordTypeGrid` — a **new** component — so the shared `ToggleBar` (used by four other controls) is not modified. `ChordTypeGrid` renders `role="group"` + `aria-pressed` buttons, so the existing `getByRole("group", { name: "Chord Type" })` + button queries keep working.
- "Show on Board" binds `chordOverlayHiddenAtom` (re-exported from `src/store/atoms.ts`, inverted: checked = not hidden). It is a new control surface for an existing atom — no new atom.
- The Full-Chords control keeps a `Switch` that can be `disabled` (when the quality/tuning is unsupported) plus a contextual hint paragraph. It is rendered as a `Prop` wrapping a `Switch` (the `Prop`'s `hint` carries the contextual text). "Show on Board" is likewise a `Prop` + `Switch`. The `InspectorGrid` `ToggleProp` primitive is **not** used (it cannot express the disabled state + paragraph hint) and `InspectorGrid.tsx` is **not** modified.
- CAGED Span / String Set are **descoped** (spec §1 "Descoped" + §7) — not added.
- `ChordOverlayControls.module.css` currently has only `.panel-disabled`; this plan adds a `.root` class.
- The repo uses **pnpm**: `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- **Commit messages must be a single `type(scope): description` line — no body, no trailer** (the repo's commit-message hook validates every line). Use the exact commit command in each task's final step.
- This branch (`claude/daw-shell-phase-10-chord-tab`) is off `main`, which has Phase 8 merged — so `InspectorGrid` and the Phase-8 `inspector.*` i18n keys are present.

Task order is mandatory: **Task 1 → 2 → 3 → 4.** Task 1 adds the i18n keys Task 3 references. Task 2 builds `ChordTypeGrid` which Task 3 mounts. Task 3 refactors the tab. Task 4 refreshes baselines and runs the gate.

---

## File Structure

**Created:**
- `src/components/Inspector/ChordTypeGrid.tsx` — wrapping cell-grid chord-type picker.
- `src/components/Inspector/ChordTypeGrid.module.css` — its styling.
- `src/components/Inspector/ChordTypeGrid.test.tsx` — its unit tests.

**Modified:**
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — four new `inspector.*` keys.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — refactored into a `PropGrid`.
- `src/components/ChordOverlayControls/ChordOverlayControls.module.css` — add a `.root` class.
- `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` — two updates for the new structure.
- `e2e/*.visual.spec.ts-snapshots/*` — refreshed baselines (Task 4).

---

## Task 1: Add the Chord-tab i18n strings

**Files:** Modify `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`.

Adding keys to `types.ts` first makes the build fail until both locale files supply them — that type error is this task's "failing test".

- [ ] **Step 1: Add the new keys to the `Dictionary` type**

In `src/i18n/types.ts`, the `inspector` block currently ends with `relationship: string;` (the last Phase 9 key). Add these four lines immediately before the closing `};` of the `inspector` block:

```ts
    groupSource: string;
    groupChordType: string;
    groupVoicing: string;
    showOnBoard: string;
```

- [ ] **Step 2: Run the build and verify it fails**

Run: `pnpm run build`
Expected: FAIL — `tsc` reports `en` and `es` are missing the four new `inspector` properties.

- [ ] **Step 3: Add the English strings**

In `src/i18n/en.ts`, add these four lines immediately before the closing `},` of the `inspector` block (after `relationship: "Relationship",`):

```ts
    groupSource: "Source",
    groupChordType: "Chord Type",
    groupVoicing: "Voicing",
    showOnBoard: "Show on Board",
```

- [ ] **Step 4: Add the Spanish strings**

In `src/i18n/es.ts`, add these four lines immediately before the closing `},` of the `inspector` block (after `relationship: "Relación",`):

```ts
    groupSource: "Fuente",
    groupChordType: "Tipo de acorde",
    groupVoicing: "Disposición",
    showOnBoard: "Mostrar en mástil",
```

- [ ] **Step 5: Run the build and verify it passes**

Run: `pnpm run build`
Expected: PASS — both locales supply every `inspector` key.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): add Chord tab property-grid strings"
```

---

## Task 2: Build the `ChordTypeGrid` component

**Files:**
- Create: `src/components/Inspector/ChordTypeGrid.tsx`
- Create: `src/components/Inspector/ChordTypeGrid.module.css`
- Test: `src/components/Inspector/ChordTypeGrid.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/Inspector/ChordTypeGrid.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChordTypeGrid } from "./ChordTypeGrid";

const OPTIONS = [
  { value: "Major Triad", label: "Maj" },
  { value: "Minor Triad", label: "min" },
  { value: "Dominant 7th", label: "7" },
];

describe("ChordTypeGrid", () => {
  it("renders a labeled group with a button per option", () => {
    render(
      <ChordTypeGrid options={OPTIONS} value="Major Triad" onChange={() => {}} label="Chord Type" />,
    );
    expect(screen.getByRole("group", { name: "Chord Type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7" })).toBeInTheDocument();
  });

  it("marks the active option as pressed", () => {
    render(
      <ChordTypeGrid options={OPTIONS} value="Minor Triad" onChange={() => {}} label="Chord Type" />,
    );
    expect(screen.getByRole("button", { name: "min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Maj" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the option value when a cell is clicked", async () => {
    const user = userEvent.setup();
    let picked = "";
    render(
      <ChordTypeGrid
        options={OPTIONS}
        value="Major Triad"
        onChange={(v) => {
          picked = v;
        }}
        label="Chord Type"
      />,
    );
    await user.click(screen.getByRole("button", { name: "7" }));
    expect(picked).toBe("Dominant 7th");
  });

  it("disables an option flagged disabled", () => {
    render(
      <ChordTypeGrid
        options={[{ value: "x", label: "X", disabled: true }]}
        value=""
        onChange={() => {}}
        label="Chord Type"
      />,
    );
    expect(screen.getByRole("button", { name: "X" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm run test -- src/components/Inspector/ChordTypeGrid.test.tsx`
Expected: FAIL — `./ChordTypeGrid` does not exist yet.

- [ ] **Step 3: Create the `ChordTypeGrid` component**

Create `src/components/Inspector/ChordTypeGrid.tsx` with:

```tsx
import clsx from "clsx";
import styles from "./ChordTypeGrid.module.css";

export interface ChordTypeOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ChordTypeGridProps {
  options: readonly ChordTypeOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the button group. */
  label: string;
}

/**
 * Chord-quality picker for the Chord tab's CHORD TYPE group — the chord types
 * as a wrapping grid of cells. A standalone component (not a `ToggleBar`
 * variant) so the shared `ToggleBar` is untouched. Renders `role="group"` with
 * `aria-pressed` buttons, matching the accessibility shape callers query.
 */
export function ChordTypeGrid({ options, value, onChange, label }: ChordTypeGridProps) {
  return (
    <div className={styles.grid} role="group" aria-label={label}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={clsx(styles.cell, isActive && styles.cellActive)}
            aria-pressed={isActive}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Create `src/components/Inspector/ChordTypeGrid.module.css` with:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.1875rem;
}

.cell {
  min-height: 1.625rem;
  padding: 0 0.25rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--dc-fg);
  background: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  cursor: pointer;
  transition: var(--dc-transition);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell:hover:not(:disabled) {
  background: var(--dc-bg-hover);
  border-color: var(--dc-border-hover);
}

.cell:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cellActive {
  color: var(--dc-fg-strong);
  background: var(--dc-bg-active);
  border-color: var(--dc-border-active);
  box-shadow: var(--dc-glow-active);
}

.cell:focus-visible {
  outline: none;
  box-shadow: var(--dc-glow-focus);
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm run test -- src/components/Inspector/ChordTypeGrid.test.tsx`
Expected: PASS — all four tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ChordTypeGrid.tsx src/components/Inspector/ChordTypeGrid.module.css src/components/Inspector/ChordTypeGrid.test.tsx
git commit -m "feat(inspector): add the Chord tab chord-type grid"
```

---

## Task 3: Convert the Chord tab to a 6-column property grid

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.module.css`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Update the two structure-coupled tests in `ChordOverlayControls.test.tsx`**

The refactor replaces the `control-section` / `section-label` wrappers with `Prop` cells and the scrolling chord-type `ToggleBar` with `ChordTypeGrid`. Two tests assert the old structure and must change; every other test is behavioral and stays as-is.

1. Replace the test `"renders 'Chord Type' label in manual mode"` (inside `describe("8. chord-type toggle bar (manual mode)", ...)`) — the whole `it(...)` block:

```tsx
    it("renders 'Chord Type' label in manual mode", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const labels = container.querySelectorAll(".section-label");
      const chordTypeLabel = Array.from(labels).find((el) => el.textContent === "Chord Type");
      expect(chordTypeLabel).toBeInTheDocument();
    });
```

with:

```tsx
    it("renders 'Chord Type' label in manual mode", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(
        screen.getByText("Chord Type", { selector: "span[class*='propLabel']" }),
      ).toBeInTheDocument();
    });
```

2. Delete the test `"chord-type toggle bar has data-overflow='scroll'"` entirely (the whole `it(...)` block) — `ChordTypeGrid` is a grid, not a scrolling bar, so `data-overflow` no longer exists.

- [ ] **Step 2: Run the test file and verify it fails**

Run: `pnpm run test -- src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: FAIL — the updated `"renders 'Chord Type' label"` test now looks for a `propLabel` span the current component does not render. (Most other tests still pass against the current component; the suite as a whole is RED until Step 3.)

- [ ] **Step 3: Add a `.root` class to `ChordOverlayControls.module.css`**

Replace the entire contents of `src/components/ChordOverlayControls/ChordOverlayControls.module.css` with:

```css
.root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Panel-level disabled overlay — applied when fingering pattern is one-string or two-strings */
.panel-disabled {
  pointer-events: none;
  opacity: 0.5;
}
```

- [ ] **Step 4: Refactor `ChordOverlayControls.tsx` into a property grid**

Replace the entire contents of `src/components/ChordOverlayControls/ChordOverlayControls.tsx` with:

```tsx
import { startTransition, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, LENS_REGISTRY } from "@fretflow/core";
import {
  lensAvailabilityAtom,
  fingeringPatternAtom,
  chordOverlayHiddenAtom,
} from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { ChordTypeGrid } from "../Inspector/ChordTypeGrid";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import panelStyles from "./ChordOverlayControls.module.css";
import shared from "../shared/shared.module.css";
import { CHORD_NONE_VALUE } from "./chordTypeOptions";
import {
  buildDegreeToggleOptions,
  buildQualityToggleOptions,
} from "../shared/chordControlOptions";

// Subset of chord types that have full-chord shape data on the fretboard.
// Used to gate the Full Chord overlay toggle in the UI.
const FULL_CHORD_SUPPORTED_TYPES = new Set([
  "Major Triad",
  "Minor Triad",
  "Dominant 7th",
]);

export function ChordOverlayControls() {
  const { t } = useTranslation();
  const { scaleName, useFlats } = useScaleState();
  const {
    chordType,
    currentTuning,
    fullChordsEnabled,
    setFullChordsEnabled,
    practiceLens,
    setPracticeLens,
    chordDegree,
    setChordDegree,
    chordOverlayMode,
    setChordOverlayMode,
    chordRootOverride,
    setChordRootOverride,
    chordQualityOverride,
    setChordQualityOverride,
  } = useChordState();
  const [chordOverlayHidden, setChordOverlayHidden] = useAtom(chordOverlayHiddenAtom);

  const lensAvailability = useAtomValue(lensAvailabilityAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isPatternDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";
  const fullChordsSupported =
    chordType != null &&
    FULL_CHORD_SUPPORTED_TYPES.has(chordType) &&
    currentTuning.length === 6;

  const hasQualityOverride = chordQualityOverride != null;
  const degreeSelectOptions = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden: hasQualityOverride,
    activeDegree: chordDegree,
    includeOffSentinel: true,
  });

  // Hide tension lens when unavailable and not currently active.
  const lensOptions = lensAvailability.flatMap((entry) => {
    const { id } = entry;
    const isActive = id === practiceLens;
    const available = entry.available;
    const reason = entry.reason ?? undefined;

    if (!available && !isActive && entry?.hideWhenUnavailable) return [];

    return [
      {
        value: id,
        label: entry?.label ?? id,
        disabled: !isActive && !available,
        title: !isActive && reason ? reason : undefined,
        description: !isActive && reason ? reason : undefined,
      },
    ];
  });

  const currentLensEntry = lensAvailability.find((l) => l.id === practiceLens);
  const activeLensDescription =
    LENS_REGISTRY.find((l) => l.id === practiceLens)?.description ?? undefined;

  // Auto-exit unavailable lenses (except "targets").
  useEffect(() => {
    if (
      currentLensEntry &&
      !currentLensEntry.available &&
      currentLensEntry.id !== "targets"
    ) {
      const tAvailable = lensAvailability.find((l) => l.id === "targets")?.available;
      if (tAvailable) {
        setPracticeLens("targets");
      }
    }
  }, [currentLensEntry, lensAvailability, setPracticeLens]);

  const handleDegreeChange = (value: string) => {
    startTransition(() => {
      setChordDegree(value === CHORD_NONE_VALUE ? null : value);
    });
  };

  const handleChordTypeChange = (value: string) => {
    startTransition(() => {
      setChordQualityOverride(value === CHORD_NONE_VALUE ? null : value);
    });
  };

  // ── Visibility ────────────────────────────────────────────────────────
  const showDegree = !isPatternDisabled && chordOverlayMode === "degree";
  const showChordTypeGrid =
    !isPatternDisabled &&
    (chordOverlayMode === "manual" ||
      (chordOverlayMode === "degree" && Boolean(chordDegree)));
  const showRoot = !isPatternDisabled && chordOverlayMode === "manual";
  const showChordTypeGroup = showChordTypeGrid || showRoot;
  const showVoicing = !isPatternDisabled && Boolean(chordType);

  const fullChordsHint = fullChordsSupported
    ? "Show canonical CAGED voicings instead of scattered chord tones."
    : currentTuning.length !== 6
      ? "Full Chords currently supports 6-string tunings only."
      : "Full Chords currently supports Major Triad, Minor Triad, and Dominant 7th.";

  return (
    <div
      className={clsx(panelStyles.root, isPatternDisabled && panelStyles["panel-disabled"])}
      data-disabled={isPatternDisabled ? "true" : undefined}
    >
      {isPatternDisabled && (
        <p className={shared["field-hint"]} aria-live="polite">
          {t("controls.chordOverlayDisabled")}
        </p>
      )}
      <PropGrid columns={6}>
        {/* ── SOURCE ───────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupSource")}</GroupHeader>
        <Prop
          label={t("controls.chordMode")}
          span={2}
          hint={
            isPatternDisabled
              ? undefined
              : chordOverlayMode === "degree"
                ? t("controls.degreeModeHint")
                : t("controls.manualModeHint")
          }
        >
          <ToggleBar
            options={[
              {
                value: "degree",
                label: isPatternDisabled
                  ? t("controls.disabled")
                  : t("controls.degree"),
                disabled: isPatternDisabled,
              },
              {
                value: "manual",
                label: t("controls.manual"),
                disabled: isPatternDisabled,
              },
            ]}
            value={chordOverlayMode}
            onChange={isPatternDisabled ? () => undefined : setChordOverlayMode}
            label="Chord overlay mode"
          />
        </Prop>
        {showDegree && (
          <Prop label={t("controls.degree")} span={4}>
            <ToggleBar
              options={degreeSelectOptions}
              value={chordDegree ?? CHORD_NONE_VALUE}
              onChange={handleDegreeChange}
              label="Chord degree"
            />
          </Prop>
        )}
        {showVoicing && (
          <Prop label={t("controls.lens")} span={6} hint={activeLensDescription}>
            <ToggleBar
              options={lensOptions}
              value={practiceLens}
              onChange={setPracticeLens}
              label="Practice lens"
            />
          </Prop>
        )}

        {/* ── CHORD TYPE ───────────────────────────────────────────────── */}
        {showChordTypeGroup && (
          <GroupHeader>{t("inspector.groupChordType")}</GroupHeader>
        )}
        {showChordTypeGrid && (
          <Prop
            label={t("controls.chordType")}
            span={6}
            hint={
              chordOverlayMode === "degree"
                ? hasQualityOverride
                  ? t("controls.customChordHint")
                  : t("controls.diatonicDefaultHint")
                : undefined
            }
          >
            <ChordTypeGrid
              label="Chord Type"
              options={
                chordOverlayMode === "degree"
                  ? buildQualityToggleOptions({ includeSentinel: false })
                  : buildQualityToggleOptions({ diatonicLabel: t("controls.off") })
              }
              value={
                chordOverlayMode === "degree"
                  ? chordType ?? ""
                  : chordQualityOverride ?? CHORD_NONE_VALUE
              }
              onChange={handleChordTypeChange}
            />
          </Prop>
        )}
        {showRoot && (
          <Prop label={t("controls.root")} span={2}>
            <NoteGrid
              notes={NOTES}
              selected={chordRootOverride}
              onSelect={(note) => {
                startTransition(() => {
                  setChordRootOverride(note);
                });
              }}
              useFlats={useFlats}
            />
          </Prop>
        )}

        {/* ── VOICING ──────────────────────────────────────────────────── */}
        {showVoicing && (
          <>
            <GroupHeader>{t("inspector.groupVoicing")}</GroupHeader>
            <Prop label="Full Chords" span={3} hint={fullChordsHint}>
              <Switch
                label="Full Chords"
                checked={fullChordsEnabled}
                onChange={setFullChordsEnabled}
                disabled={!fullChordsSupported}
              />
            </Prop>
            <Prop label={t("inspector.showOnBoard")} span={3}>
              <Switch
                label={t("inspector.showOnBoard")}
                checked={!chordOverlayHidden}
                onChange={(next) => setChordOverlayHidden(!next)}
              />
            </Prop>
          </>
        )}
      </PropGrid>
    </div>
  );
}
```

The deliberate changes from the original: the `theoryStyles` import is dropped (the outer wrapper now uses `panelStyles.root`); `PropGrid`/`Prop`/`GroupHeader` and `ChordTypeGrid` are imported; `useAtom` + `chordOverlayHiddenAtom` are added for the new Show-on-Board toggle; the `control-section`/`section-label`/`switch-row` wrappers become `Prop` cells under three `GroupHeader`s; the scrolling chord-type `ToggleBar` becomes a `ChordTypeGrid`; the Full-Chords `Switch` (with its `disabled` gate and contextual hint) is preserved inside a `Prop`. All conditional logic — `isPatternDisabled`, degree/manual modes, the chord-type grid showing only with an active degree, `fullChordsSupported`, the lens auto-exit effect — is unchanged.

- [ ] **Step 5: Run the test files and verify they pass**

Run: `pnpm run test -- src/components/ChordOverlayControls/ChordOverlayControls.test.tsx src/components/Inspector/ChordTab.test.tsx src/components/Inspector/ChordTypeGrid.test.tsx`
Expected: PASS — all three suites pass. (`ChordTab.test.tsx` is untouched: its queries — `getByText(/chord mode/i)`, `data-inspector-tab`, `data-chord-accent`, `axe` — are all behavioral and unaffected by the layout refactor.)

- [ ] **Step 6: Run lint, build, and the full suite**

Run: `pnpm run lint`
Expected: PASS — no unused imports (`theoryStyles` was removed from `ChordOverlayControls.tsx`).

Run: `pnpm run build`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS — the full suite is green. If a test outside the three files above fails because it asserted the old Chord-tab structure, apply the minimal fix to keep it green and include it in this task's commit; report it.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChordOverlayControls/ChordOverlayControls.tsx src/components/ChordOverlayControls/ChordOverlayControls.module.css src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
git commit -m "feat(inspector): convert the Chord tab to a 6-column grid"
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
Expected: darwin snapshots are rebuilt. The Chord-tab captures (in `chord-overlay-controls` and any full-app suite that navigates to the Chord tab) now show the 6-column SOURCE / CHORD TYPE / VOICING grid.

- [ ] **Step 3: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots are regenerated. If `test:visual:update:linux` fails for an environment reason (no Docker / Linux container) rather than a real snapshot diff, record the exact failing command and error, finish the remaining steps, and report DONE_WITH_CONCERNS — the linux baselines are regenerated by CI.

- [ ] **Step 4: Confirm the visual suite passes against the new baselines**

Run: `pnpm run test:visual`
Expected: PASS — every visual spec matches the freshly updated baselines.

- [ ] **Step 5: Manual sanity check of the snapshot diff**

Run: `git status --short e2e`
Inspect the changed snapshot images: the Chord tab should render as a 6-column grid — a SOURCE group (mode / degree / lens), a CHORD TYPE group (the wrapping cell grid), and a VOICING group (Full Chords + Show on Board) — each under a cyan group header. If a snapshot still shows the old stacked Chord tab, a source change was missed.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for the Chord tab grid"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — against `2026-05-16-daw-shell-phases-8-13-design.md` Phase 10 (§7):
- 6-column `PropGrid` with SOURCE / CHORD TYPE / VOICING group headers → Task 3.
- SOURCE = Mode / Degree / Lens; CHORD TYPE = the 15-cell quality grid; VOICING = Full Chords + Show on Board → Task 3.
- 15-cell chord-type grid replacing the scrolling `ToggleBar` → Task 2 (`ChordTypeGrid`) + Task 3 (mounting it).
- "Show on Board" = `chordOverlayHiddenAtom` inverted → Task 3. No new atom.
- Cyan/orange accent preserved → `ChordTab` (unchanged) keeps `data-chord-accent`; `ChordOverlayControls.module.css` keeps the `--chord-accent` switch driven by that attribute. The `ChordTab.test.tsx` accent tests remain green (Task 3 Step 5).
- CAGED Span / String Set descoped → not added (confirmed: no such controls in the refactored component).
- Data flow — existing atoms only: `chordOverlayHiddenAtom`, `fullChordsEnabledAtom`, `practiceLensAtom`, `chordDegreeAtom`, `chordOverlayModeAtom`, `chordRootOverrideAtom`, `chordQualityOverrideAtom`, `lensAvailabilityAtom`, `fingeringPatternAtom` all pre-exist. No new atoms.
- Testing → Task 2 (ChordTypeGrid tests), Task 3 (the 680-line behavior suite preserved with two structural updates; full-suite gate), Task 4 (visual refresh).

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"; every code step gives complete file contents or an exact replace block, and every command has an expected result.

**Type consistency:** `ChordTypeGrid`'s `ChordTypeOption` (`{ value, label, disabled? }`) matches the `ToggleOption` shape returned by `buildQualityToggleOptions`. `PropGrid`/`Prop`/`GroupHeader` are consumed with the signatures from Phase 8's `InspectorGrid.tsx`. `chordOverlayHiddenAtom` is a `boolean` atom; the Show-on-Board `Switch` uses `checked={!chordOverlayHidden}` / `onChange={(next) => setChordOverlayHidden(!next)}`. The four `inspector.*` keys added in Task 1 (`groupSource`, `groupChordType`, `groupVoicing`, `showOnBoard`) are exactly the keys referenced by `t(...)` in Task 3.

---

## Execution complete

After Task 4, the branch is ready for a PR — Phase 10, against `main`, with `pnpm run lint`, `pnpm run test`, and `pnpm run build` green and visual baselines refreshed. Phase 11 (Progression tab) is the next plan.
