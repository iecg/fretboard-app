# DAW Shell Phase 8 — Inspector Property-Grid + View Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the Inspector property-grid layout primitives and convert the View tab into a dense 6-column DAW property grid with FINGERING / LABELS / DISPLAY group headers.

**Architecture:** A new `InspectorGrid` module exports four pure layout primitives — `PropGrid` (a CSS-grid container), `Prop` (a labeled grid cell with a `span`), `GroupHeader` (a full-width section divider), and `ToggleProp` (an inline label + `Switch` row). The View tab composes them into one `PropGrid`. `FingeringPatternControls` is refactored to emit a `GroupHeader` plus `Prop` cells (instead of its own `control-section` wrappers); because React fragments are transparent to CSS grid, its emitted cells become direct grid items of the View tab's `PropGrid`. The Note-Labels control moves out of `FingeringPatternControls` into the View tab's LABELS group. No new atoms — every control binds to an existing Jotai atom.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, `clsx`, `motion/react`, Vitest + Testing Library, Playwright (visual regression).

---

## Background for the implementer

Read these before starting:

- `docs/superpowers/specs/2026-05-16-daw-shell-phases-8-13-design.md` — the spec; this plan implements **Phase 8** (§4).
- `src/components/Inspector/ViewTab.tsx` — the tab body being rebuilt.
- `src/components/FingeringPatternControls/FingeringPatternControls.tsx` — the leaf control being refactored.
- `src/components/Switch/Switch.tsx` — the toggle primitive `ToggleProp` wraps. Props: `checked`, `onChange(checked)`, `label` (becomes `aria-label`), optional `tone`/`disabled`/`id`/`className`. Renders `role="switch"` with `aria-checked`.
- `src/components/ToggleBar/ToggleBar.tsx` — the segmented control. Renders `role="group"` with `aria-label={label}`; each option button has `aria-pressed`.

Key facts:

- **Fragments flow through CSS grid.** A child component that returns `<><GroupHeader/><Prop/>…</>` placed inside `<PropGrid>` contributes the `GroupHeader` and `Prop`s as *direct* grid items — fragments produce no DOM node. This is why `FingeringPatternControls` can emit grid cells consumed by the View tab's grid.
- The DAW tokens used in the new CSS (`--faceplate-accent`, `--faceplate-divider`, `--dc-fg`, `--dc-fg-muted`, `--font-mono`) are defined in `src/styles/semantic.css` / `src/styles/tokens.css` and are theme-adaptive (light + dark).
- `fingeringPatternAtom`, `displayFormatAtom`, `fretStartAtom`, `fretEndAtom`, `accidentalModeAtom`, `enharmonicDisplayAtom`, `scaleDegreeColorsEnabledAtom`, `fullChordsEnabledAtom`, `isMutedAtom` are all re-exported from the `src/store/atoms.ts` barrel — import them from `"../../store/atoms"`.
- Commands use **pnpm**: `pnpm run lint`, `pnpm run test`, `pnpm run build`. Run a single test file with `pnpm run test -- <path>`.
- **Commit messages must be a single `type(scope): description` line.** The repo's commit-message hook validates every line of the message against that format, so do not add a body or trailer to plan commits.
- The Inspector directory uses flat files (`Inspector.tsx`, `ViewTab.tsx`, `tabs.tsx`), not per-component folders — the new `InspectorGrid.*` files follow that flat convention.

Task order is mandatory: **Task 1 → 2 → 3 → 4.** Task 1 creates the primitives that Task 3 imports. Task 2 adds the i18n keys Task 3's components reference. Task 3 converts the tab. Task 4 refreshes visual baselines and runs the full gate.

---

## File Structure

**Created:**
- `src/components/Inspector/InspectorGrid.tsx` — `PropGrid`, `Prop`, `GroupHeader`, `ToggleProp` layout primitives.
- `src/components/Inspector/InspectorGrid.module.css` — their styling.
- `src/components/Inspector/InspectorGrid.test.tsx` — primitive unit tests.

**Modified:**
- `src/i18n/types.ts` — seven new keys in the `inspector` dictionary section.
- `src/i18n/en.ts`, `src/i18n/es.ts` — the matching English + Spanish strings.
- `src/components/FingeringPatternControls/FingeringPatternControls.tsx` — emits `GroupHeader` + `Prop` cells; the Note-Labels control is removed (it moves to the View tab).
- `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx` — the moved Note-Labels test is dropped.
- `src/components/Inspector/ViewTab.tsx` — rebuilt as a `PropGrid`.
- `src/components/Inspector/ViewTab.test.tsx` — group / grid / Display-toggle coverage.
- `e2e/*.visual.spec.ts-snapshots/*` — refreshed baselines (Task 4).

---

## Task 1: Inspector property-grid primitives

**Files:**
- Create: `src/components/Inspector/InspectorGrid.tsx`
- Create: `src/components/Inspector/InspectorGrid.module.css`
- Test: `src/components/Inspector/InspectorGrid.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/Inspector/InspectorGrid.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropGrid, Prop, GroupHeader, ToggleProp } from "./InspectorGrid";

describe("InspectorGrid", () => {
  it("PropGrid sets the grid template columns from the columns prop", () => {
    const { container } = render(
      <PropGrid columns={4}>
        <Prop label="A">a</Prop>
      </PropGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  it("PropGrid defaults to six columns", () => {
    const { container } = render(
      <PropGrid>
        <Prop label="A">a</Prop>
      </PropGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))");
  });

  it("Prop renders its label, children, and hint, and applies the span", () => {
    const { container } = render(
      <Prop label="Pattern" span={2} hint="Pick one">
        <button type="button">child</button>
      </Prop>,
    );
    expect(screen.getByText("Pattern")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "child" })).toBeInTheDocument();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    const cell = container.firstElementChild as HTMLElement;
    expect(cell.style.gridColumn).toBe("span 2");
  });

  it("GroupHeader renders its label text", () => {
    render(<GroupHeader>Fingering</GroupHeader>);
    expect(screen.getByText("Fingering")).toBeInTheDocument();
  });

  it("ToggleProp renders a switch bound to checked/onChange", async () => {
    const user = userEvent.setup();
    let value = false;
    const handleChange = (v: boolean) => {
      value = v;
    };
    const { rerender } = render(
      <ToggleProp label="Degree Colors" checked={value} onChange={handleChange} />,
    );
    const sw = screen.getByRole("switch", { name: "Degree Colors" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(value).toBe(true);
    rerender(<ToggleProp label="Degree Colors" checked={value} onChange={handleChange} />);
    expect(screen.getByRole("switch", { name: "Degree Colors" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("ToggleProp shows the status word when provided", () => {
    render(<ToggleProp label="Full Chords" checked onChange={() => {}} status="CAGED" />);
    expect(screen.getByText("CAGED")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm run test -- src/components/Inspector/InspectorGrid.test.tsx`
Expected: FAIL — `./InspectorGrid` does not exist yet, so the import is unresolved.

- [ ] **Step 3: Create the `InspectorGrid` component module**

Create `src/components/Inspector/InspectorGrid.tsx` with:

```tsx
import type { ReactNode } from "react";
import clsx from "clsx";
import { Switch } from "../Switch/Switch";
import styles from "./InspectorGrid.module.css";

export interface PropGridProps {
  /** Number of grid columns. Defaults to 6 — the DAW inspector standard. */
  columns?: number;
  children: ReactNode;
  className?: string;
}

/** A CSS-grid container for inspector property cells. */
export function PropGrid({ columns = 6, children, className }: PropGridProps) {
  return (
    <div
      className={clsx(styles.propGrid, className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export interface PropProps {
  /** Uppercase micro-label shown above the control. */
  label?: string;
  /** Column span within the parent PropGrid. Defaults to 1. */
  span?: number;
  /** Optional terse hint shown below the control. */
  hint?: string;
  children: ReactNode;
}

/** A labeled property cell inside a PropGrid. */
export function Prop({ label, span = 1, hint, children }: PropProps) {
  return (
    <div className={styles.prop} style={{ gridColumn: `span ${span}` }}>
      {label ? <span className={styles.propLabel}>{label}</span> : null}
      <div className={styles.propControl}>{children}</div>
      {hint ? <p className={styles.propHint}>{hint}</p> : null}
    </div>
  );
}

export interface GroupHeaderProps {
  children: ReactNode;
  /** Optional right-aligned content (e.g. action buttons). */
  right?: ReactNode;
}

/** A full-width section divider spanning every PropGrid column. */
export function GroupHeader({ children, right }: GroupHeaderProps) {
  return (
    <div className={styles.groupHeader}>
      <span className={styles.groupHeaderLabel}>{children}</span>
      <span className={styles.groupHeaderRule} aria-hidden="true" />
      {right}
    </div>
  );
}

export interface TogglePropProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Optional state word shown between the label and the switch. */
  status?: string;
  /** Column span within the parent PropGrid. Defaults to 2. */
  span?: number;
}

/** An inline label + Switch row for boolean settings. */
export function ToggleProp({ label, checked, onChange, status, span = 2 }: TogglePropProps) {
  return (
    <div className={styles.toggleProp} style={{ gridColumn: `span ${span}` }}>
      <span className={styles.togglePropLabel}>{label}</span>
      {status ? <span className={styles.togglePropStatus}>{status}</span> : null}
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
```

- [ ] **Step 4: Create the `InspectorGrid` stylesheet**

Create `src/components/Inspector/InspectorGrid.module.css` with:

```css
.propGrid {
  display: grid;
  gap: 0.875rem 1rem;
  align-items: start;
}

.prop {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.propLabel {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--dc-fg);
  line-height: 1;
}

.propControl {
  min-width: 0;
}

.propHint {
  margin: 0;
  font-size: 0.625rem;
  line-height: 1.4;
  color: var(--dc-fg-muted);
}

.groupHeader {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.groupHeaderLabel {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--faceplate-accent);
  white-space: nowrap;
  line-height: 1;
}

.groupHeaderRule {
  flex: 1;
  height: 1px;
  background: var(--faceplate-divider);
}

.toggleProp {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 1.625rem;
  min-width: 0;
}

.togglePropLabel {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--dc-fg);
  white-space: nowrap;
}

.togglePropStatus {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--dc-fg-muted);
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm run test -- src/components/Inspector/InspectorGrid.test.tsx`
Expected: PASS — all six tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/InspectorGrid.tsx src/components/Inspector/InspectorGrid.module.css src/components/Inspector/InspectorGrid.test.tsx
git commit -m "feat(inspector): add property-grid layout primitives"
```

---

## Task 2: Add the View-tab property-grid i18n strings

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

The `en` and `es` dictionaries are both typed as `Dictionary`, so adding keys to `types.ts` first makes the build fail until both locale files supply them — that type error is this task's "failing test".

- [ ] **Step 1: Add the new keys to the `Dictionary` type**

In `src/i18n/types.ts`, in the `inspector` block, replace:

```ts
  inspector: {
    viewTab: string;
    scaleTab: string;
    chordTab: string;
    progressionTab: string;
  };
```

with:

```ts
  inspector: {
    viewTab: string;
    scaleTab: string;
    chordTab: string;
    progressionTab: string;
    groupFingering: string;
    groupLabels: string;
    groupDisplay: string;
    pattern: string;
    degreeColors: string;
    fullChords: string;
    tapToPlay: string;
  };
```

- [ ] **Step 2: Run the build and verify it fails**

Run: `pnpm run build`
Expected: FAIL — `tsc` reports `en` and `es` are missing the seven new `inspector` properties.

- [ ] **Step 3: Add the English strings**

In `src/i18n/en.ts`, in the `inspector` block, replace:

```ts
  inspector: {
    viewTab: "View",
    scaleTab: "Scale",
    chordTab: "Chord",
    progressionTab: "Progression",
  },
```

with:

```ts
  inspector: {
    viewTab: "View",
    scaleTab: "Scale",
    chordTab: "Chord",
    progressionTab: "Progression",
    groupFingering: "Fingering",
    groupLabels: "Labels",
    groupDisplay: "Display",
    pattern: "Pattern",
    degreeColors: "Degree Colors",
    fullChords: "Full Chords",
    tapToPlay: "Tap to Play",
  },
```

- [ ] **Step 4: Add the Spanish strings**

In `src/i18n/es.ts`, in the `inspector` block, replace:

```ts
  inspector: {
    viewTab: "Vista",
    scaleTab: "Escala",
    chordTab: "Acorde",
    progressionTab: "Progresión",
  },
```

with:

```ts
  inspector: {
    viewTab: "Vista",
    scaleTab: "Escala",
    chordTab: "Acorde",
    progressionTab: "Progresión",
    groupFingering: "Digitación",
    groupLabels: "Etiquetas",
    groupDisplay: "Visualización",
    pattern: "Patrón",
    degreeColors: "Colores de grado",
    fullChords: "Acordes completos",
    tapToPlay: "Tocar al pulsar",
  },
```

- [ ] **Step 5: Run the build and verify it passes**

Run: `pnpm run build`
Expected: PASS — `tsc` is satisfied; both locales supply every `inspector` key.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): add View tab property-grid strings"
```

---

## Task 3: Convert the View tab to a property grid

This task refactors `FingeringPatternControls` and rebuilds `ViewTab` together, in one commit, so the Note-Labels control is never momentarily absent from the app (it moves from `FingeringPatternControls` into the View tab's LABELS group).

**Files:**
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.tsx`
- Modify: `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`
- Modify: `src/components/Inspector/ViewTab.tsx`
- Modify: `src/components/Inspector/ViewTab.test.tsx`

- [ ] **Step 1: Update `FingeringPatternControls.test.tsx` for the moved control**

The Note-Labels control moves to the View tab, so its test moves too. In `src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`:

1. Delete the `displayFormatAtom,` line from the `../../store/atoms` import block (the block becomes `fingeringPatternAtom`, `cagedShapesAtom`, `oneStringIndexAtom`, `oneStringIntervalAtom`, `twoStringsPairAtom`, `twoStringsIntervalAtom`).
2. Delete this whole test (the `it(...)` block):

```tsx
  it("updates display format when Intervals button clicked", () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    fireEvent.click(screen.getByText("Intervals"));
    expect(store.get(displayFormatAtom)).toBe("degrees");
  });
```

- [ ] **Step 2: Replace `ViewTab.test.tsx` with grid coverage**

Replace the entire contents of `src/components/Inspector/ViewTab.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  fretStartAtom,
  fretEndAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  scaleDegreeColorsEnabledAtom,
  fullChordsEnabledAtom,
  isMutedAtom,
  displayFormatAtom,
} from "../../store/atoms";
import { ViewTab } from "./ViewTab";

describe("ViewTab", () => {
  it("renders the Fingering, Labels, and Display group headers", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByText("Fingering")).toBeInTheDocument();
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
  });

  it("renders the fingering pattern control and the fret range group", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CAGED" })).toBeInTheDocument();
  });

  it("reflects atom-seeded fret start/end values in the steppers", () => {
    renderWithAtoms(<ViewTab />, [
      [fretStartAtom, 3],
      [fretEndAtom, 8],
    ]);
    expect(screen.getByRole("group", { name: /start fret/i }).textContent).toContain("3");
    expect(screen.getByRole("group", { name: /end fret/i }).textContent).toContain("8");
  });

  it("renders the accidentals and enharmonic controls", () => {
    renderWithAtoms(<ViewTab />, [
      [accidentalModeAtom, "flats"],
      [enharmonicDisplayAtom, "on"],
    ]);
    expect(screen.getByRole("group", { name: /accidentals/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /enharmonic display/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "♭" })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the accidental mode atom when an option is clicked", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[accidentalModeAtom, "auto"]]);
    await user.click(screen.getByRole("button", { name: "♯" }));
    expect(screen.getByRole("button", { name: "♯" })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the display format atom when a Note Labels option is clicked", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[displayFormatAtom, "notes"]]);
    await user.click(screen.getByRole("button", { name: "Intervals" }));
    expect(screen.getByRole("button", { name: "Intervals" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders the Display group toggles bound to their atoms", () => {
    renderWithAtoms(<ViewTab />, [
      [scaleDegreeColorsEnabledAtom, true],
      [fullChordsEnabledAtom, false],
      [isMutedAtom, false],
    ]);
    expect(screen.getByRole("switch", { name: "Degree Colors" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: "Full Chords" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    // Tap to Play is the inverse of isMuted — not muted → checked.
    expect(screen.getByRole("switch", { name: "Tap to Play" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("turns Tap to Play on (unmutes) when switched from a muted state", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[isMutedAtom, true]]);
    const tapToPlay = screen.getByRole("switch", { name: "Tap to Play" });
    expect(tapToPlay).toHaveAttribute("aria-checked", "false");
    await user.click(tapToPlay);
    expect(screen.getByRole("switch", { name: "Tap to Play" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ViewTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 3: Run the test files and verify the View-tab tests fail**

Run: `pnpm run test -- src/components/Inspector/ViewTab.test.tsx src/components/FingeringPatternControls/FingeringPatternControls.test.tsx`
Expected: `ViewTab.test.tsx` FAILS — the current `ViewTab` renders neither group headers ("Fingering"/"Labels"/"Display") nor `role="switch"` Display toggles. `FingeringPatternControls.test.tsx` PASSES — only a test was removed.

- [ ] **Step 4: Refactor `FingeringPatternControls.tsx` to emit grid cells**

Replace the entire contents of `src/components/FingeringPatternControls/FingeringPatternControls.tsx` with:

```tsx
import { useCallback, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { CAGED_SHAPES, type CagedShape, ANIMATION_DURATION_FAST } from "@fretflow/core";
import { useShapeState } from "../../hooks/useShapeState";
import { type FingeringPattern } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { GroupHeader, Prop } from "../Inspector/InspectorGrid";
import shared from "../shared/shared.module.css";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

const isTouchPrimary =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

/**
 * Renders the FINGERING property-grid group: the group header plus the
 * pattern selector and its per-pattern sub-controls, as `Prop` cells. It is
 * designed to be a child of the View tab's `PropGrid` — React fragments are
 * transparent to CSS grid, so the emitted `GroupHeader`/`Prop` elements become
 * direct grid items.
 */
export function FingeringPatternControls() {
  const { t } = useTranslation();
  const {
    fingeringPattern,
    setFingeringPattern,
    cagedShapes,
    setCagedShapes,
    toggleCagedShape,
    selectSingleCagedShape,
    npsPosition,
    setNpsPosition,
    npsOctave,
    setNpsOctave,
    onShapeClick,
    onRecenter,
    oneStringIndex,
    setOneStringIndex,
    oneStringInterval,
    setOneStringInterval,
    twoStringsPair,
    setTwoStringsPair,
    twoStringsInterval,
    setTwoStringsInterval,
  } = useShapeState();

  const shapeHelpId = useId();

  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedShapeRef = useRef<CagedShape | null>(null);
  const [pressingShape, setPressingShape] = useState<CagedShape | null>(null);

  const cancelPress = useCallback(() => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    pressStartRef.current = null;
    setPressingShape(null);
  }, []);

  return (
    <>
      <GroupHeader>{t("inspector.groupFingering")}</GroupHeader>

      <Prop label={t("inspector.pattern")} span={2}>
        <ToggleBar
          options={[
            { value: "none", label: "None" },
            { value: "caged", label: "CAGED" },
            { value: "3nps", label: "3NPS" },
            { value: "one-string", label: "1-String" },
            { value: "two-strings", label: "2-Strings" },
          ]}
          value={fingeringPattern}
          onChange={(v) => setFingeringPattern(v as FingeringPattern)}
        />
      </Prop>

      {fingeringPattern === "caged" && (
        <Prop
          label={t("controls.shape")}
          span={2}
          hint={isTouchPrimary ? t("controls.longPressToAdd") : t("controls.shiftClickToAdd")}
        >
          <span id={shapeHelpId} className={shared["sr-only"]}>
            {isTouchPrimary ? t("controls.shapeHintTouch") : t("controls.shapeHintPointer")}
          </span>
          <div
            className={shared["toggle-group"]}
            role="group"
            aria-label={t("controls.shape")}
            aria-describedby={shapeHelpId}
          >
            <motion.button
              type="button"
              className={clsx(
                shared["toggle-btn"],
                cagedShapes.size === CAGED_SHAPES.length && shared.active,
              )}
              aria-pressed={cagedShapes.size === CAGED_SHAPES.length}
              onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}
              whileTap={{ scale: 0.96 }}
              animate={
                cagedShapes.size === CAGED_SHAPES.length ? { scale: [1, 1.04, 1] } : { scale: 1 }
              }
              transition={{ duration: ANIMATION_DURATION_FAST }}
            >
              All
            </motion.button>
            {CAGED_SHAPES.map((s) => {
              const isActive = cagedShapes.has(s);
              return (
                <motion.button
                  key={s}
                  type="button"
                  className={clsx(shared["toggle-btn"], isActive && shared.active)}
                  data-pressing={pressingShape === s || undefined}
                  aria-pressed={isActive}
                  title={
                    isTouchPrimary
                      ? "Tap to select; long press to add/remove"
                      : "Click to select; Shift+click to toggle multiple"
                  }
                  onPointerDown={(e) => {
                    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
                    cancelPress();
                    longPressedShapeRef.current = null;
                    pressStartRef.current = { x: e.clientX, y: e.clientY };
                    setPressingShape(s);
                    pressTimerRef.current = setTimeout(() => {
                      longPressedShapeRef.current = s;
                      pressTimerRef.current = null;
                      pressStartRef.current = null;
                      setPressingShape(null);
                      toggleCagedShape(s);
                      navigator.vibrate?.(30);
                    }, LONG_PRESS_MS);
                  }}
                  onPointerMove={(e) => {
                    if (!pressStartRef.current) return;
                    const dx = e.clientX - pressStartRef.current.x;
                    const dy = e.clientY - pressStartRef.current.y;
                    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancelPress();
                  }}
                  onPointerUp={cancelPress}
                  onPointerCancel={cancelPress}
                  onPointerLeave={cancelPress}
                  onContextMenu={(e) => {
                    if (longPressedShapeRef.current !== null) e.preventDefault();
                  }}
                  onClick={(e) => {
                    if (longPressedShapeRef.current !== null) {
                      longPressedShapeRef.current = null;
                      return;
                    }
                    onShapeClick?.(s);
                    onRecenter?.();
                    if (e.shiftKey) {
                      toggleCagedShape(s);
                    } else {
                      selectSingleCagedShape(s);
                    }
                  }}
                  whileTap={{ scale: 0.96 }}
                  animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={{ duration: ANIMATION_DURATION_FAST }}
                >
                  {s}
                </motion.button>
              );
            })}
          </div>
        </Prop>
      )}

      {fingeringPattern === "3nps" && (
        <>
          <Prop label={t("controls.position")} span={2}>
            <ToggleBar
              options={[1, 2, 3, 4, 5, 6, 7].map((p) => ({
                value: p,
                label: String(p),
              }))}
              value={npsPosition}
              onChange={(v) => setNpsPosition(v as number)}
            />
          </Prop>
          <Prop label={t("controls.octave")} span={2}>
            <ToggleBar
              options={[
                { value: 0, label: "Low" },
                { value: 1, label: "High" },
              ]}
              value={npsOctave}
              onChange={(v) => setNpsOctave(v as number)}
            />
          </Prop>
        </>
      )}

      {fingeringPattern === "one-string" && (
        <>
          <Prop label={t("controls.string")} span={2}>
            <ToggleBar
              options={[1, 2, 3, 4, 5, 6].map((n, i) => ({ value: i, label: String(n) }))}
              value={oneStringIndex}
              onChange={(v) => setOneStringIndex(v as number)}
            />
          </Prop>
          <Prop
            label={t("controls.connectors")}
            span={2}
            hint={oneStringInterval > 0 ? t("controls.showConsecutiveSteps") : undefined}
          >
            <ToggleBar
              options={[
                { value: 0, label: t("controls.off") },
                { value: 1, label: "On" },
              ]}
              value={oneStringInterval}
              onChange={(v) => setOneStringInterval(v as number)}
            />
          </Prop>
        </>
      )}

      {fingeringPattern === "two-strings" && (
        <>
          <Prop label={t("controls.strings")} span={2}>
            <ToggleBar
              options={
                twoStringsInterval === 3
                  ? [
                      { value: 0, label: "1-3" },
                      { value: 1, label: "2-4" },
                      { value: 2, label: "3-5" },
                      { value: 3, label: "4-6" },
                    ]
                  : [
                      { value: 0, label: "1-2" },
                      { value: 1, label: "2-3" },
                      { value: 2, label: "3-4" },
                      { value: 3, label: "4-5" },
                      { value: 4, label: "5-6" },
                    ]
              }
              value={twoStringsPair}
              onChange={(v) => setTwoStringsPair(v as number)}
            />
          </Prop>
          <Prop
            label={t("controls.interval")}
            span={2}
            hint={twoStringsInterval > 0 ? t("controls.pairMembersConnected") : undefined}
          >
            <ToggleBar
              options={[
                { value: 0, label: t("controls.off") },
                { value: 1, label: "3rds" },
                { value: 2, label: "4ths" },
                { value: 3, label: "6ths" },
              ]}
              value={twoStringsInterval}
              onChange={(v) => setTwoStringsInterval(v as number)}
            />
          </Prop>
        </>
      )}
    </>
  );
}
```

Note the deliberate changes from the original: the `useAtom`/`displayFormatAtom` imports and the Note-Labels `control-section` are gone (Note Labels moves to `ViewTab` in Step 5); the `control-section`/`section-label` wrappers become `GroupHeader`/`Prop`; `field-hint` paragraphs become `Prop` `hint` props; and the CAGED group uses `aria-label` (not the removed `shapeLabelId`/`aria-labelledby`) since `Prop` now renders the visible "Shape" label.

- [ ] **Step 5: Rebuild `ViewTab.tsx` as a property grid**

Replace the entire contents of `src/components/Inspector/ViewTab.tsx` with:

```tsx
import { useAtom } from "jotai";
import {
  fretStartAtom,
  fretEndAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  scaleDegreeColorsEnabledAtom,
  fullChordsEnabledAtom,
  isMutedAtom,
  displayFormatAtom,
} from "../../store/atoms";
import { MAX_FRET } from "@fretflow/core";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { PropGrid, Prop, GroupHeader, ToggleProp } from "./InspectorGrid";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ViewTab.module.css";

const ACCIDENTAL_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "♯", value: "sharps" },
  { label: "♭", value: "flats" },
] as const;

const ENHARMONIC_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
] as const;

const NOTE_LABEL_OPTIONS = [
  { value: "notes", label: "Notes" },
  { value: "degrees", label: "Intervals" },
  { value: "none", label: "None" },
] as const;

export function ViewTab() {
  const { t } = useTranslation();
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [scaleDegreeColors, setScaleDegreeColors] = useAtom(scaleDegreeColorsEnabledAtom);
  const [fullChords, setFullChords] = useAtom(fullChordsEnabledAtom);
  const [muted, setMuted] = useAtom(isMutedAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);

  return (
    <div className={styles.root} data-inspector-tab="view">
      <PropGrid columns={6}>
        {/* FINGERING — the group header and pattern cells are emitted by
            FingeringPatternControls; Fret Range closes the group. */}
        <FingeringPatternControls />
        <Prop label={t("settings.fields.fretRange")} span={2}>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="dashboard"
          />
        </Prop>

        <GroupHeader>{t("inspector.groupLabels")}</GroupHeader>
        <Prop label={t("controls.noteLabels")} span={2}>
          <ToggleBar
            label={t("controls.noteLabels")}
            options={NOTE_LABEL_OPTIONS}
            value={displayFormat}
            onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "none")}
          />
        </Prop>
        <Prop label={t("settings.fields.accidentals")} span={2}>
          <ToggleBar
            label={t("settings.fields.accidentals")}
            options={ACCIDENTAL_OPTIONS}
            value={accidentalMode}
            onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
          />
        </Prop>
        <Prop label={t("settings.fields.enharmonicDisplay")} span={2}>
          <ToggleBar
            label={t("settings.fields.enharmonicDisplay")}
            options={ENHARMONIC_OPTIONS}
            value={enharmonicDisplay}
            onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
          />
        </Prop>

        <GroupHeader>{t("inspector.groupDisplay")}</GroupHeader>
        <ToggleProp
          label={t("inspector.degreeColors")}
          checked={scaleDegreeColors}
          onChange={setScaleDegreeColors}
        />
        <ToggleProp
          label={t("inspector.fullChords")}
          checked={fullChords}
          onChange={setFullChords}
        />
        <ToggleProp
          label={t("inspector.tapToPlay")}
          checked={!muted}
          onChange={(next) => setMuted(!next)}
        />
      </PropGrid>
    </div>
  );
}
```

`ViewTab.module.css` is unchanged — its `.root` is a thin wrapper around the single `PropGrid`.

- [ ] **Step 6: Run the test files and verify they pass**

Run: `pnpm run test -- src/components/Inspector/ViewTab.test.tsx src/components/FingeringPatternControls/FingeringPatternControls.test.tsx src/components/Inspector/InspectorGrid.test.tsx`
Expected: PASS — all three suites pass, including the View-tab group-header, Note-Labels, and Display-toggle tests.

- [ ] **Step 7: Run lint and build**

Run: `pnpm run lint`
Expected: PASS — no unused imports (`useAtom`/`displayFormatAtom` were removed from `FingeringPatternControls.tsx`; `displayFormatAtom` was removed from the `FingeringPatternControls.test.tsx` import).

Run: `pnpm run build`
Expected: PASS — `tsc -b` and the Vite build succeed.

- [ ] **Step 8: Commit**

```bash
git add src/components/FingeringPatternControls/FingeringPatternControls.tsx src/components/FingeringPatternControls/FingeringPatternControls.test.tsx src/components/Inspector/ViewTab.tsx src/components/Inspector/ViewTab.test.tsx
git commit -m "feat(inspector): convert the View tab to a property grid"
```

---

## Task 4: Refresh visual baselines and run the full verification

**Files:**
- Modify (regenerated): `e2e/app-components.visual.spec.ts-snapshots/*`, `e2e/app-layout.visual.spec.ts-snapshots/*`, and any other snapshot directory whose images changed.

- [ ] **Step 1: Run the mandatory pre-PR checks**

Run: `pnpm run lint`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS — the full unit/component suite is green.

Run: `pnpm run build`
Expected: PASS.

- [ ] **Step 2: Refresh the darwin visual-regression baselines**

Run: `pnpm run test:visual:update`
Expected: the suite rebuilds and rewrites darwin snapshots. The View-tab captures in `e2e/app-components.visual.spec.ts-snapshots/` (and any `app-layout` capture that includes the Inspector) now show the 6-column property grid with FINGERING / LABELS / DISPLAY group headers.

- [ ] **Step 3: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots are regenerated for the same suites.

- [ ] **Step 4: Confirm the visual suite passes against the new baselines**

Run: `pnpm run test:visual`
Expected: PASS — every visual spec matches the freshly updated baselines.

- [ ] **Step 5: Manual sanity check of the snapshot diff**

Run: `git status --short e2e`
Inspect the changed snapshot images: the View tab should now render as a dense property grid — three cyan group headers (FINGERING / LABELS / DISPLAY), the pattern + fret-range cells on the first group, the notation toggles on LABELS, and three inline `Switch` rows on DISPLAY. If a snapshot still shows the old stacked `control-section` layout, a source change was missed — fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for the View tab grid"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — against `2026-05-16-daw-shell-phases-8-13-design.md` §4:
- §4a (grid primitives `PropGrid` / `Prop` / `GroupHeader` / `ToggleProp`; `ToggleBar` reused as the segmented control, no new segmented primitive) → Task 1.
- §4b (View tab as a 6-column `PropGrid`; FINGERING / LABELS / DISPLAY groups; `FingeringPatternControls` refactored to grid cells with its conditional sub-controls kept; Note Labels moved to LABELS; DISPLAY = Degree Colors + Full Chords + Tap to Play) → Task 3.
- §4b "Full Chords appears on two surfaces" → the View tab DISPLAY group binds `fullChordsEnabledAtom`; Phase 10 keeps the Chord-tab copy. No conflict — same atom.
- §4 Data flow ("existing atoms only, no new atoms") → confirmed: `fingeringPatternAtom`, `displayFormatAtom`, `fretStartAtom`, `fretEndAtom`, `accidentalModeAtom`, `enharmonicDisplayAtom`, `scaleDegreeColorsEnabledAtom`, `fullChordsEnabledAtom`, `isMutedAtom` all pre-exist. The i18n keys (Task 2) are UI strings, not state.
- §4 Testing (InspectorGrid tests, ViewTab tests extended, FingeringPatternControls updated, visual refresh) → Tasks 1, 3, 4.
- §4 Acceptance criteria (6-column grid with the three group headers; controls behave identically; DISPLAY toggles drive their atoms; lint/test/build pass) → verified across Task 3 steps 6-7 and Task 4 step 1.

One intentional simplification: `ToggleProp` carries an optional `status` prop (spec §4a: "an optional state word") and Task 1 tests it, but the View tab's three `ToggleProp`s do not pass `status` in this phase — the status words are deferred polish and were not worth seven extra i18n keys now. The prop exists for later phases.

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases" placeholders; every code step shows complete file contents or an exact replace block, and every command has an expected result.

**Type consistency:** `PropGrid` / `Prop` / `GroupHeader` / `ToggleProp` and their prop interfaces are defined once in Task 1 and consumed with matching signatures in Task 3 (`FingeringPatternControls.tsx`, `ViewTab.tsx`). `ToggleProp`'s `onChange: (checked: boolean) => void` matches the `setScaleDegreeColors` / `setFullChords` setters and the `(next) => setMuted(!next)` inversion for Tap to Play. The seven `inspector.*` keys added in Task 2 (`groupFingering`, `groupLabels`, `groupDisplay`, `pattern`, `degreeColors`, `fullChords`, `tapToPlay`) are exactly the keys referenced by `t(...)` in Task 3.

---

## Execution complete

After Task 4, the branch is ready for a PR per the spec's cross-phase notes: one PR for Phase 8, with `pnpm run lint`, `pnpm run test`, and `pnpm run build` all green and visual baselines refreshed. Phase 9 (Scale tab) is the next plan.
