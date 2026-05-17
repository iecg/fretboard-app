# DAW Shell Phase 11 — Progression Tab Property Grid + Backing-Track Rehost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Inspector's Progression tab into the design's DAW property grid — a METER row, a CHORDS group (list + selected-chord editor), and a BACKING TRACK group — and move the backing-track controls out of `ProgressionTrack` into that BACKING TRACK group.

**Architecture:** `ProgressionControls` is refactored to render a `PropGrid columns={6}` (from Phase 8's `InspectorGrid`) with three `GroupHeader` groups. Its existing preset/chord-list/editor logic is preserved; only the wrappers change (`control-section`/`switch-row` → `Prop`/`ToggleProp` cells). Two additive controls bind existing atoms: a Loop `ToggleProp` (`progressionLoopEnabledAtom`) and a read-only Length readout (`totalProgressionBarsAtom`). The accompaniment block currently inside `ProgressionTrack` becomes a new `BackingTrackControls` component — a fragment of a `GroupHeader` + `Prop` cells — rendered as the third group inside `ProgressionControls`'s `PropGrid`. `ProgressionTrack` loses the accompaniment row and its CSS, keeping only the timeline, playhead, position readout, and `TransportBar`.

**Tech Stack:** React 19, TypeScript, Jotai, CSS Modules, `clsx`, Vitest + Testing Library, Playwright (visual regression).

---

## Background for the implementer

Read these before starting:

- `docs/superpowers/specs/2026-05-16-daw-shell-phases-8-13-design.md` — the spec; this plan implements **Phase 11** (§7, "Phase 11 — Progression tab → property grid + backing-track rehost").
- `src/components/ProgressionControls/ProgressionControls.tsx` — the leaf control being refactored (preset picker, chord list, step actions, selected-step editor).
- `src/components/ProgressionTrack/ProgressionTrack.tsx` — currently hosts the `.accompanimentControls` block (lines ~131-197); that block moves out.
- `src/components/Inspector/InspectorGrid.tsx` — Phase 8's layout primitives. This plan reuses `PropGrid`, `Prop`, `GroupHeader`, `ToggleProp`. `PropGrid({ columns=6, children })` is a CSS grid. `Prop({ label?, span=1, hint?, children })` renders a cell (uppercase micro-label `<span class*='propLabel'>`, the control, optional `<p>` hint). `GroupHeader({ children, right? })` renders an `<h3 class*='groupHeaderLabel'>` + hairline rule and is `grid-column: 1 / -1`. `ToggleProp({ label, checked, onChange, status?, span=2 })` renders an inline label + `Switch` row; the `Switch`'s accessible name is the `label` prop.
- `src/components/Inspector/ChordTypeGrid.module.css` — Phase 10's reference for the `--dc-*` faceplate token set used by Inspector controls (`--dc-fg`, `--dc-bg`, `--dc-bg-hover`, `--dc-border`, `--dc-border-hover`, `--dc-radius`, `--dc-transition`, `--dc-glow-focus`).

Key facts:

- `ProgressionControls`'s preset grouping, `handlePresetChange`, `qualityValue`, `degreeOptions`, and `activeStep` derivations are **unchanged** — only the returned JSX is re-laid into a `PropGrid`.
- The hook `useProgressionState()` already exposes everything needed: `progressionLoopEnabled`/`setProgressionLoopEnabled` and `totalProgressionBars` (for the new Loop and Length controls), and all six backing-track values/setters (`progressionGenreStyle`, `applyGenreStyle`, `progressionChordInstrument`/`setProgressionChordInstrument`, `progressionChordPattern`/`setProgressionChordPattern`, `progressionBassPattern`/`setProgressionBassPattern`, `progressionDrumPattern`/`setProgressionDrumPattern`, `progressionSwing`/`setProgressionSwing`). **No new atoms.**
- The Loop and Length controls are new *surfaces* for existing atoms — Loop is also reachable via the `TransportBar` "Loop progression" button; both bind `progressionLoopEnabledAtom`. The meter-row Loop control is a `Switch` (role `switch`, name "Loop"), distinct from the track's button (role `button`, name "Loop progression").
- The CHORDS group keeps the existing chord list, step-action buttons, and the Degree/Duration/Quality editor verbatim — including their `shared["control-section"]`/`shared["section-label"]` sub-structure inside the editor cell. The spec calls the CHORDS group "functionally unchanged ... only re-laid into the two-column grouping."
- The backing-track block currently uses native `<select>`/`<input type=range>` styled with `--track-*` tokens scoped to `ProgressionTrack`. Those tokens do not exist in the Inspector context, so `BackingTrackControls` gets a fresh stylesheet using `--dc-*` faceplate tokens. The control markup (and its `aria-label`s) is otherwise copied verbatim so `getByLabelText("Genre style")` etc. keep working.
- The repo uses **pnpm**: `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- **Commit messages must be a single `type(scope): description` line — no body, no trailer** (the repo's commit-message hook validates every line). Use the exact commit command in each task's final step.
- This branch is off `main`, which has Phases 8-10 merged — `InspectorGrid`, `ChordTypeGrid`, and the Phase 8-10 `inspector.*` i18n keys are all present.

Task order is mandatory: **Task 1 → 2 → 3 → 4 → 5.** Task 1 adds the i18n keys Tasks 2 and 3 reference. Task 2 builds `BackingTrackControls`, which Task 3 mounts. Task 3 refactors `ProgressionControls`. Task 4 strips the now-duplicated block from `ProgressionTrack`. Task 5 refreshes baselines and runs the gate.

---

## File Structure

**Created:**
- `src/components/ProgressionControls/BackingTrackControls.tsx` — the BACKING TRACK group (genre / instrument / chord-pattern / bass-pattern / drum-pattern / swing), a fragment of a `GroupHeader` + `Prop` cells.
- `src/components/ProgressionControls/BackingTrackControls.module.css` — its styling.
- `src/components/ProgressionControls/BackingTrackControls.test.tsx` — its unit tests.

**Modified:**
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — 14 new `inspector.*` keys.
- `src/components/ProgressionControls/ProgressionControls.tsx` — refactored into a `PropGrid`.
- `src/components/ProgressionControls/ProgressionControls.module.css` — drop `.progression-controls`, add `.length-readout`.
- `src/components/ProgressionControls/ProgressionControls.test.tsx` — add a grid-layout test block.
- `src/components/ProgressionTrack/ProgressionTrack.tsx` — remove the accompaniment block + its hook destructuring + now-unused imports.
- `src/components/ProgressionTrack/ProgressionTrack.module.css` — remove the accompaniment CSS.
- `src/components/ProgressionTrack/ProgressionTrack.test.tsx` — drop two accompaniment tests, add an absence test.
- `e2e/*.visual.spec.ts-snapshots/*` — refreshed baselines (Task 5).

---

## Task 1: Add the Progression-tab i18n strings

**Files:** Modify `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`.

Adding keys to `types.ts` first makes the build fail until both locale files supply them — that type error is this task's "failing test".

- [ ] **Step 1: Add the new keys to the `Dictionary` type**

In `src/i18n/types.ts`, the `inspector` block currently ends with `fullChordsHintUnsupportedType: string;`. Add these 14 lines immediately after that line (before the closing `};` of the `inspector` block):

```ts
    groupMeter: string;
    groupChords: string;
    groupBackingTrack: string;
    progressionMode: string;
    meterBeats: string;
    meterLength: string;
    meterLoop: string;
    meterPreset: string;
    btGenre: string;
    btInstrument: string;
    btChordPattern: string;
    btBassPattern: string;
    btDrumPattern: string;
    btSwing: string;
```

- [ ] **Step 2: Run the build and verify it fails**

Run: `pnpm run build`
Expected: FAIL — `tsc` reports `en` and `es` are missing the 14 new `inspector` properties.

- [ ] **Step 3: Add the English strings**

In `src/i18n/en.ts`, add these 14 lines immediately after `fullChordsHintUnsupportedType: "...",` (before the closing `},` of the `inspector` block):

```ts
    groupMeter: "Meter",
    groupChords: "Chords",
    groupBackingTrack: "Backing Track",
    progressionMode: "Mode",
    meterBeats: "Beats/Bar",
    meterLength: "Length",
    meterLoop: "Loop",
    meterPreset: "Preset",
    btGenre: "Genre",
    btInstrument: "Instrument",
    btChordPattern: "Chord Pattern",
    btBassPattern: "Bass Pattern",
    btDrumPattern: "Drum Pattern",
    btSwing: "Swing",
```

- [ ] **Step 4: Add the Spanish strings**

In `src/i18n/es.ts`, add these 14 lines immediately after `fullChordsHintUnsupportedType: "...",` (before the closing `},` of the `inspector` block):

```ts
    groupMeter: "Compás",
    groupChords: "Acordes",
    groupBackingTrack: "Pista de acompañamiento",
    progressionMode: "Modo",
    meterBeats: "Tiempos/Compás",
    meterLength: "Longitud",
    meterLoop: "Bucle",
    meterPreset: "Preajuste",
    btGenre: "Género",
    btInstrument: "Instrumento",
    btChordPattern: "Patrón de acordes",
    btBassPattern: "Patrón de bajo",
    btDrumPattern: "Patrón de batería",
    btSwing: "Swing",
```

- [ ] **Step 5: Run the build and verify it passes**

Run: `pnpm run build`
Expected: PASS — both locales supply every `inspector` key.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): add Progression tab property-grid strings"
```

---

## Task 2: Build the `BackingTrackControls` component

**Files:**
- Create: `src/components/ProgressionControls/BackingTrackControls.tsx`
- Create: `src/components/ProgressionControls/BackingTrackControls.module.css`
- Test: `src/components/ProgressionControls/BackingTrackControls.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ProgressionControls/BackingTrackControls.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  progressionDrumPatternAtom,
  progressionGenreStyleAtom,
  progressionSwingAtom,
} from "../../store/atoms";
import { BackingTrackControls } from "./BackingTrackControls";

describe("BackingTrackControls", () => {
  it("renders the backing-track group header and every control", () => {
    renderWithStore(<BackingTrackControls />, makeAtomStore([]));
    expect(screen.getByRole("heading", { name: "Backing Track" })).toBeInTheDocument();
    expect(screen.getByLabelText("Genre style")).toBeInTheDocument();
    expect(screen.getByLabelText("Chord instrument")).toBeInTheDocument();
    expect(screen.getByLabelText("Chord pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Bass pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Drum pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Swing amount")).toBeInTheDocument();
  });

  it("writes the drum pattern atom when the drum select changes", () => {
    const store = makeAtomStore([]);
    renderWithStore(<BackingTrackControls />, store);
    const select = screen.getByLabelText("Drum pattern") as HTMLSelectElement;
    const next = Array.from(select.options).map((o) => o.value).find((v) => v !== select.value);
    expect(next).toBeDefined();
    fireEvent.change(select, { target: { value: next } });
    expect(store.get(progressionDrumPatternAtom)).toBe(next);
  });

  it("writes the swing atom when the swing slider changes", () => {
    const store = makeAtomStore([[progressionSwingAtom, 0]]);
    renderWithStore(<BackingTrackControls />, store);
    fireEvent.change(screen.getByLabelText("Swing amount"), { target: { value: "0.25" } });
    expect(store.get(progressionSwingAtom)).toBeCloseTo(0.25);
  });

  it("reverts the genre selector to custom when an individual control changes", () => {
    // Seed a real genre so the assertion proves a reversion, not a no-op.
    const store = makeAtomStore([[progressionGenreStyleAtom, "rock"]]);
    renderWithStore(<BackingTrackControls />, store);
    const select = screen.getByLabelText("Drum pattern") as HTMLSelectElement;
    const next = Array.from(select.options).map((o) => o.value).find((v) => v !== select.value);
    fireEvent.change(select, { target: { value: next } });
    expect(store.get(progressionGenreStyleAtom)).toBe("custom");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm run test -- src/components/ProgressionControls/BackingTrackControls.test.tsx`
Expected: FAIL — `./BackingTrackControls` does not exist yet.

- [ ] **Step 3: Create the `BackingTrackControls` component**

Create `src/components/ProgressionControls/BackingTrackControls.tsx` with:

```tsx
import { useProgressionState } from "../../hooks/useProgressionState";
import { useTranslation } from "../../hooks/useTranslation";
import { GENRE_STYLES } from "../../progressions/audio/genres";
import { CHORD_PATTERNS, BASS_PATTERNS, DRUM_PATTERNS } from "../../progressions/audio/patterns";
import type { ChordInstrumentId } from "../../progressions/audio/instruments/types";
import { Prop, GroupHeader } from "../Inspector/InspectorGrid";
import styles from "./BackingTrackControls.module.css";

/**
 * The BACKING TRACK group of the Progression tab — genre, chord instrument,
 * the chord/bass/drum pattern pickers, and the swing slider. Rehosted here
 * from `ProgressionTrack` (DAW Shell Phase 11). Returns a fragment of a
 * `GroupHeader` plus `Prop` cells, designed to be rendered inside the
 * Progression tab's `PropGrid`.
 */
export function BackingTrackControls() {
  const { t } = useTranslation();
  const {
    progressionGenreStyle,
    applyGenreStyle,
    progressionChordInstrument,
    setProgressionChordInstrument,
    progressionChordPattern,
    setProgressionChordPattern,
    progressionBassPattern,
    setProgressionBassPattern,
    progressionDrumPattern,
    setProgressionDrumPattern,
    progressionSwing,
    setProgressionSwing,
  } = useProgressionState();

  return (
    <>
      <GroupHeader>{t("inspector.groupBackingTrack")}</GroupHeader>
      <Prop label={t("inspector.btGenre")} span={1}>
        <select
          aria-label="Genre style"
          value={progressionGenreStyle}
          onChange={(e) => applyGenreStyle(e.target.value)}
          className={styles.select}
        >
          {GENRE_STYLES.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </Prop>
      <Prop label={t("inspector.btInstrument")} span={1}>
        <select
          aria-label="Chord instrument"
          value={progressionChordInstrument}
          onChange={(e) => setProgressionChordInstrument(e.target.value as ChordInstrumentId)}
          className={styles.select}
        >
          <option value="strum">Strum</option>
          <option value="piano">Piano</option>
          <option value="organ">Organ</option>
        </select>
      </Prop>
      <Prop label={t("inspector.btChordPattern")} span={1}>
        <select
          aria-label="Chord pattern"
          value={progressionChordPattern}
          onChange={(e) => setProgressionChordPattern(e.target.value)}
          className={styles.select}
        >
          {CHORD_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Prop>
      <Prop label={t("inspector.btBassPattern")} span={1}>
        <select
          aria-label="Bass pattern"
          value={progressionBassPattern}
          onChange={(e) => setProgressionBassPattern(e.target.value)}
          className={styles.select}
        >
          {BASS_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Prop>
      <Prop label={t("inspector.btDrumPattern")} span={1}>
        <select
          aria-label="Drum pattern"
          value={progressionDrumPattern}
          onChange={(e) => setProgressionDrumPattern(e.target.value)}
          className={styles.select}
        >
          {DRUM_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Prop>
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
          />
          <span className={styles.swingValue}>{Math.round(progressionSwing * 100)}%</span>
        </div>
      </Prop>
    </>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Create `src/components/ProgressionControls/BackingTrackControls.module.css` with:

```css
.select {
  width: 100%;
  min-width: 0;
  appearance: none;
  padding: 0.25rem 1.3rem 0.25rem 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--dc-fg);
  background: var(--dc-bg)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23c1daeb' stroke-opacity='.55' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 0.4rem center;
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  cursor: pointer;
  transition: var(--dc-transition);
}

.select:hover {
  background-color: var(--dc-bg-hover);
  border-color: var(--dc-border-hover);
}

.select:focus-visible {
  outline: none;
  box-shadow: var(--dc-glow-focus);
}

.swing {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.swingRange {
  flex: 1;
  min-width: 0;
  accent-color: var(--neon-cyan);
  cursor: pointer;
}

.swingValue {
  min-width: 2.4rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--dc-fg);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm run test -- src/components/ProgressionControls/BackingTrackControls.test.tsx`
Expected: PASS — all four tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressionControls/BackingTrackControls.tsx src/components/ProgressionControls/BackingTrackControls.module.css src/components/ProgressionControls/BackingTrackControls.test.tsx
git commit -m "feat(progression): add the BackingTrackControls component"
```

---

## Task 3: Convert the Progression tab to a 6-column property grid

**Files:**
- Modify: `src/components/ProgressionControls/ProgressionControls.tsx`
- Modify: `src/components/ProgressionControls/ProgressionControls.module.css`
- Modify: `src/components/ProgressionControls/ProgressionControls.test.tsx`

- [ ] **Step 1: Add the grid-layout test block to `ProgressionControls.test.tsx`**

In `src/components/ProgressionControls/ProgressionControls.test.tsx`, add `progressionLoopEnabledAtom` to the existing import from `../../store/atoms` (the import block currently lists `activeProgressionStepIndexAtom`, `beatsPerBarAtom`, `progressionEnabledAtom`, `progressionStepsAtom`, `rootNoteAtom`, `scaleNameAtom`). The block becomes:

```tsx
import {
  activeProgressionStepIndexAtom,
  beatsPerBarAtom,
  progressionEnabledAtom,
  progressionLoopEnabledAtom,
  progressionStepsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
```

Then append this new `describe` block at the end of the file (after the `ProgressionControls DURATION` block):

```tsx
describe("ProgressionControls grid layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders Meter / Chords / Backing Track group headers", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByRole("heading", { name: "Meter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chords" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backing Track" })).toBeInTheDocument();
  });

  it("renders a Loop switch bound to progressionLoopEnabledAtom", async () => {
    const store = makeAtomStore([...BASE_SEEDS, [progressionLoopEnabledAtom, false]]);
    renderWithStore(<ProgressionControls />, store);
    const loop = screen.getByRole("switch", { name: "Loop" });
    expect(loop.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(loop);
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
  });

  it("shows the progression length readout", () => {
    // BASE_SEEDS is two 1-bar steps -> a 2-bar progression.
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByText("2 bars")).toBeInTheDocument();
  });

  it("renders the rehosted backing-track controls", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByLabelText("Genre style")).toBeInTheDocument();
    expect(screen.getByLabelText("Chord instrument")).toBeInTheDocument();
    expect(screen.getByLabelText("Swing amount")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test file and verify it fails**

Run: `pnpm run test -- src/components/ProgressionControls/ProgressionControls.test.tsx`
Expected: FAIL — the new `grid layout` block fails (no group-header headings, no Loop switch, no Length readout, no backing-track controls in the current component). The other describe blocks still pass.

- [ ] **Step 3: Update `ProgressionControls.module.css`**

Replace the entire contents of `src/components/ProgressionControls/ProgressionControls.module.css` with:

```css
.step-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.4rem;
  padding: 0.42rem 0.55rem;
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  background: var(--dc-bg);
  color: var(--dc-fg);
  text-align: left;
  cursor: pointer;
  transition: var(--dc-transition);
}

.step-row:hover {
  border-color: var(--dc-border-hover);
  background: var(--dc-bg-hover);
  color: var(--dc-fg-strong);
}

.step-row:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.step-row--active {
  border-color: var(--dc-border-active);
  background: var(--dc-bg-active);
  color: var(--dc-fg-strong);
  box-shadow: var(--dc-glow-active);
}

.step-row[data-unavailable="true"] {
  opacity: var(--disabled-opacity);
}

.step-index {
  font-variant-numeric: tabular-nums;
  width: 1.5em;
  text-align: right;
  color: var(--color-text-muted);
}

.step-duration {
  font-size: var(--text-xxs);
  color: var(--text-muted);
  white-space: nowrap;
}

.step-degree {
  font-weight: var(--font-weight-bold);
  min-width: 2rem;
}

.step-chord {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--font-weight-medium);
}

.duration-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.step-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.chords-cell {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.editor-cell {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.length-readout {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--dc-fg);
  font-variant-numeric: tabular-nums;
}
```

The only changes from the original: `.progression-controls` is removed (the component now returns a `PropGrid`), and `.chords-cell`, `.editor-cell`, and `.length-readout` are added.

- [ ] **Step 4: Refactor `ProgressionControls.tsx` into a property grid**

Replace the entire contents of `src/components/ProgressionControls/ProgressionControls.tsx` with:

```tsx
import { startTransition } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
import {
  BEATS_PER_BAR_OPTIONS,
  MIN_PROGRESSION_STEP_DURATION_VALUE,
  MAX_PROGRESSION_STEP_DURATION_VALUE,
  formatProgressionDurationLabel,
  getAvailableProgressionPresets,
} from "../../progressions/progressionDomain";
import { generateCommonProgressions } from "../../progressions/progressionGeneration";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useScaleState } from "../../hooks/useScaleState";
import { useTranslation } from "../../hooks/useTranslation";
import type { ProgressionPresetCategory } from "../../progressions/progressionDomain";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { StepperControl } from "../StepperControl/StepperControl";
import { LabeledSelect, type LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { PropGrid, Prop, GroupHeader, ToggleProp } from "../Inspector/InspectorGrid";
import { BackingTrackControls } from "./BackingTrackControls";
import shared from "../shared/shared.module.css";
import { buildDegreeToggleOptions, buildQualityToggleOptions, CHORD_QUALITY_DIATONIC_VALUE } from "../shared/chordControlOptions";
import { CUSTOM_PRESET_ID } from "../../store/atoms";
import styles from "./ProgressionControls.module.css";

const CATEGORY_LABELS: Record<ProgressionPresetCategory, string> = {
  "pop-rock": "Pop / Rock",
  blues: "Blues",
  jazz: "Jazz",
  folk: "Folk / Country",
  modal: "Modal",
  minor: "Minor",
};

export function ProgressionControls() {
  const { t } = useTranslation();
  const { scaleName, rootNote } = useScaleState();
  const {
    progressionEnabled,
    setProgressionEnabled,
    progressionSteps,
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    loadProgressionPreset,
    loadProgressionSteps,
    setActiveProgressionStepIndex,
    addProgressionStep,
    duplicateProgressionStep,
    removeProgressionStep,
    moveProgressionStep,
    updateProgressionStepDegree,
    updateProgressionStepDuration,
    updateProgressionStepQuality,
    beatsPerBar,
    setBeatsPerBar,
    currentProgressionPresetId,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    totalProgressionBars,
  } = useProgressionState();

  const activeStep = progressionSteps[activeProgressionStepIndex] ?? null;
  const availablePresets = getAvailableProgressionPresets(scaleName);
  const groupedPresets = (Object.keys(CATEGORY_LABELS) as ProgressionPresetCategory[])
    .map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat],
      presets: availablePresets.filter((p) => p.category === cat),
    }))
    .filter((g) => g.presets.length > 0);
  const suggestedPresets = generateCommonProgressions(scaleName, rootNote);
  const presetGroups: LabeledSelectGroup[] = [
    {
      options: [
        {
          value: CUSTOM_PRESET_ID,
          label: "Custom",
          disabled: currentProgressionPresetId !== CUSTOM_PRESET_ID,
        },
      ],
    },
    ...groupedPresets.map((group) => ({
      groupLabel: group.label,
      options: group.presets.map((preset) => ({
        value: preset.id,
        label: preset.label,
      })),
    })),
    ...(suggestedPresets.length > 0
      ? [
          {
            groupLabel: `Suggested for ${scaleName}`,
            options: suggestedPresets.map((preset) => ({
              value: preset.id,
              label: preset.label,
            })),
          },
        ]
      : []),
  ];
  const handlePresetChange = (id: string) => {
    if (id === CUSTOM_PRESET_ID) return;
    const suggested = suggestedPresets.find((p) => p.id === id);
    if (suggested) {
      startTransition(() => loadProgressionSteps(suggested.steps));
      return;
    }
    startTransition(() => loadProgressionPreset(id));
  };
  const qualityValue = activeStep?.qualityOverride ?? CHORD_QUALITY_DIATONIC_VALUE;
  const degreeOptions = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden: qualityValue !== CHORD_QUALITY_DIATONIC_VALUE,
    activeDegree: activeStep?.degree ?? null,
  });
  const lengthLabel = formatProgressionDurationLabel({
    value: Math.ceil(Math.max(1, totalProgressionBars)),
    unit: "bar",
  });

  return (
    <PropGrid columns={6}>
      {/* ── METER ────────────────────────────────────────────────────────── */}
      <GroupHeader>{t("inspector.groupMeter")}</GroupHeader>
      <Prop label={t("inspector.progressionMode")} span={2}>
        <Switch
          label="Progression mode"
          checked={progressionEnabled}
          onChange={setProgressionEnabled}
        />
      </Prop>
      <Prop label={t("inspector.meterBeats")} span={1}>
        <StepperControl
          label="Beats per bar"
          value={beatsPerBar}
          min={BEATS_PER_BAR_OPTIONS[0]}
          max={BEATS_PER_BAR_OPTIONS[BEATS_PER_BAR_OPTIONS.length - 1]}
          step={1}
          onChange={(next) => {
            // Cycle through the allowed set directionally
            const current = beatsPerBar;
            const idx = BEATS_PER_BAR_OPTIONS.indexOf(current as 3 | 4 | 6 | 8);
            const dir = next > current ? 1 : -1;
            const nextIdx = Math.max(0, Math.min(BEATS_PER_BAR_OPTIONS.length - 1, idx + dir));
            setBeatsPerBar(BEATS_PER_BAR_OPTIONS[nextIdx]);
          }}
        />
      </Prop>
      <Prop label={t("inspector.meterLength")} span={1}>
        <span className={styles["length-readout"]}>{lengthLabel}</span>
      </Prop>
      <ToggleProp
        label={t("inspector.meterLoop")}
        checked={progressionLoopEnabled}
        onChange={setProgressionLoopEnabled}
        span={2}
      />
      <Prop label={t("inspector.meterPreset")} span={6}>
        <LabeledSelect
          label="Preset"
          hideLabel
          value={currentProgressionPresetId}
          groups={presetGroups}
          onChange={handlePresetChange}
        />
      </Prop>

      {/* ── CHORDS ───────────────────────────────────────────────────────── */}
      <GroupHeader>{t("inspector.groupChords")}</GroupHeader>
      <Prop span={3}>
        <div className={styles["chords-cell"]}>
          {resolvedProgressionSteps.length === 0 ? (
            <p className={shared["field-hint"]}>Add a chord or load a preset.</p>
          ) : (
            <ol className={styles["step-list"]}>
              {resolvedProgressionSteps.map((step, index) => (
                <li key={step.id}>
                  <button
                    type="button"
                    className={clsx(styles["step-row"], index === activeProgressionStepIndex && styles["step-row--active"])}
                    data-unavailable={step.unavailable ? "true" : undefined}
                    onClick={() => setActiveProgressionStepIndex(index)}
                  >
                    <span className={styles["step-index"]}>{index + 1}</span>
                    <span className={styles["step-degree"]}>{step.degree}</span>
                    <span className={styles["step-chord"]}>
                      {step.resolvedChordLabel ?? step.unavailableReason}
                    </span>
                    <span className={styles["step-duration"]}>
                      {formatProgressionDurationLabel(step.duration)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
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
        </div>
      </Prop>
      <Prop span={3}>
        {activeStep ? (
          <div className={styles["editor-cell"]}>
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Degree</span>
              <ToggleBar
                label="Progression degree"
                options={degreeOptions}
                value={activeStep.degree}
                onChange={(degree) => updateProgressionStepDegree({ id: activeStep.id, degree })}
                overflow="scroll"
              />
            </div>
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Duration</span>
              <div className={styles["duration-row"]}>
                <StepperControl
                  label="Duration value"
                  value={activeStep.duration.value}
                  min={MIN_PROGRESSION_STEP_DURATION_VALUE}
                  max={MAX_PROGRESSION_STEP_DURATION_VALUE}
                  step={1}
                  onChange={(next) =>
                    updateProgressionStepDuration({
                      id: activeStep.id,
                      duration: { ...activeStep.duration, value: next },
                    })
                  }
                />
                <ToggleBar
                  label="Duration unit"
                  value={activeStep.duration.unit}
                  options={[
                    { value: "beat", label: "Beat" },
                    { value: "bar", label: "Bar" },
                  ]}
                  onChange={(unit) =>
                    updateProgressionStepDuration({
                      id: activeStep.id,
                      duration: { ...activeStep.duration, unit: unit as "beat" | "bar" },
                    })
                  }
                />
              </div>
            </div>
            <div className={shared["control-section"]}>
              <span className={shared["section-label"]}>Quality</span>
              <ToggleBar
                label="Chord quality"
                options={buildQualityToggleOptions({ diatonicLabel: "Diatonic" })}
                value={qualityValue}
                onChange={(quality) => updateProgressionStepQuality({
                  id: activeStep.id,
                  qualityOverride: quality === CHORD_QUALITY_DIATONIC_VALUE ? null : quality,
                })}
                overflow="scroll"
              />
              <p className={shared["field-hint"]}>
                {activeResolvedProgressionStep?.qualityOverrideApplied
                  ? "Custom quality on a degree-derived root."
                  : "Diatonic uses the chord quality from the active scale."}
              </p>
            </div>
          </div>
        ) : (
          <p className={shared["field-hint"]}>Select a chord to edit its degree, duration, and quality.</p>
        )}
      </Prop>

      {/* ── BACKING TRACK ────────────────────────────────────────────────── */}
      <BackingTrackControls />
    </PropGrid>
  );
}
```

The deliberate changes from the original: the outer `.progression-controls` div / `switch-row` / standalone `control-section` wrappers are gone — the component returns a `PropGrid columns={6}`; `useTranslation`, the `InspectorGrid` primitives, and `BackingTrackControls` are imported; `progressionLoopEnabled`/`setProgressionLoopEnabled`/`totalProgressionBars` are pulled from the hook; the Progression-mode `Switch` becomes a `Prop` cell (visible label "Mode", `Switch` accessible name kept as "Progression mode" so existing tests pass); Beats/Bar, Length, and Loop join the meter row; Preset spans the full width; the chord list + step actions become one `Prop span={3}`; the Degree/Duration/Quality editor becomes one `Prop span={3}` (its internal `control-section`/`section-label` sub-structure is unchanged); a no-active-step placeholder hint is added; `BackingTrackControls` renders as the BACKING TRACK group. All preset, list, action, and editor logic is byte-for-byte the same.

- [ ] **Step 5: Run the test files and verify they pass**

Run: `pnpm run test -- src/components/ProgressionControls/ProgressionControls.test.tsx src/components/Inspector/ProgressionTab.test.tsx src/components/ProgressionControls/BackingTrackControls.test.tsx`
Expected: PASS — all three suites pass. (`ProgressionTab.test.tsx` is untouched: its queries — `getByRole("switch", { name: "Progression mode" })`, `data-inspector-tab="progression"`, `axe` — are all behavioral and unaffected by the layout refactor.)

- [ ] **Step 6: Run lint, build, and the full suite**

Run: `pnpm run lint`
Expected: PASS — no unused imports or unused CSS classes.

Run: `pnpm run build`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS — the full suite is green. If a test outside the three files above fails because it asserted the old stacked Progression-tab structure, apply the minimal fix to keep it green and include it in this task's commit; report it.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProgressionControls/ProgressionControls.tsx src/components/ProgressionControls/ProgressionControls.module.css src/components/ProgressionControls/ProgressionControls.test.tsx
git commit -m "feat(inspector): convert the Progression tab to a 6-column grid"
```

---

## Task 4: Remove the accompaniment block from `ProgressionTrack`

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.module.css`
- Modify: `src/components/ProgressionTrack/ProgressionTrack.test.tsx`

- [ ] **Step 1: Update the `ProgressionTrack` tests**

In `src/components/ProgressionTrack/ProgressionTrack.test.tsx`:

1. Delete the test `it("renders genre selector", ...)` entirely (the whole `it(...)` block).
2. Delete the test `it("renders chord instrument selector", ...)` entirely (the whole `it(...)` block).
3. In their place, add this test (e.g. immediately before `it("renders the extracted TransportBar with the timeline intact", ...)`):

```tsx
  it("no longer renders the rehosted backing-track controls", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // The accompaniment controls moved to the Progression tab (Phase 11).
    expect(screen.queryByLabelText("Genre style")).toBeNull();
    expect(screen.queryByLabelText("Chord instrument")).toBeNull();
    expect(screen.queryByLabelText("Chord pattern")).toBeNull();
    expect(screen.queryByLabelText("Bass pattern")).toBeNull();
    expect(screen.queryByLabelText("Drum pattern")).toBeNull();
    expect(screen.queryByLabelText("Swing amount")).toBeNull();
  });
```

- [ ] **Step 2: Run the test file and verify it fails**

Run: `pnpm run test -- src/components/ProgressionTrack/ProgressionTrack.test.tsx`
Expected: FAIL — the new `no longer renders` test fails because the accompaniment controls are still present in the current `ProgressionTrack`.

- [ ] **Step 3: Remove the accompaniment block from `ProgressionTrack.tsx`**

In `src/components/ProgressionTrack/ProgressionTrack.tsx`:

1. Update the imports — delete these four import lines (the genres/patterns/instrument-type imports are no longer used):

```tsx
import { GENRE_STYLES } from "../../progressions/audio/genres";
import { CHORD_PATTERNS, BASS_PATTERNS, DRUM_PATTERNS } from "../../progressions/audio/patterns";
import type { ChordInstrumentId } from "../../progressions/audio/instruments/types";
```

(Keep all other imports: `useCallback`/`CSSProperties` from `react`, `clsx`, `useProgressionState`, `useScaleState`, `./ProgressionTrack.module.css`, `ProgressionBlock`, `ProgressionPlayhead`, `ProgressionPositionReadout`, `TransportBar`.)

2. In the `useProgressionState()` destructuring at the top of `ProgressionTrack`, delete these 12 lines (the genre/instrument/pattern/swing values and setters):

```tsx
    progressionGenreStyle,
    applyGenreStyle,
    progressionChordInstrument,
    setProgressionChordInstrument,
    progressionChordPattern,
    setProgressionChordPattern,
    progressionBassPattern,
    setProgressionBassPattern,
    progressionDrumPattern,
    setProgressionDrumPattern,
    progressionSwing,
    setProgressionSwing,
```

Keep every other destructured field (`progressionTempoBpm`, `progressionPlaying`, `progressionPlaybackBlockedReason`, `currentProgressionBar`, `totalProgressionBars`, `activeProgressionStepIndex`, `resolvedProgressionSteps`, `setActiveProgressionStepIndex`, `beatsPerBar`).

3. Delete the entire `.accompanimentControls` JSX block — the `<div className={styles.accompanimentControls} ...>` element and everything inside it (the five `<select>`s and the `<label className={styles.swingControl}>`), through its closing `</div>`. It currently sits between the `</div>` that closes `.transportRow` and the `<div className={styles.timeline} ...>` element.

- [ ] **Step 4: Remove the accompaniment CSS from `ProgressionTrack.module.css`**

In `src/components/ProgressionTrack/ProgressionTrack.module.css`, delete two regions:

1. The `modern-light` select-arrow rules — the comment `/* Select arrow: dark chevron on light bg */` and the two rule blocks that follow it: the `:global([data-theme="modern-light"]) .genreSelect, .instrumentSelect, .patternSelect { background-image: ... }` block and the `:global([data-theme="modern-light"]) .genreSelect:hover, ... { border-color: ... }` block.

2. The accompaniment layout rules — the `.accompanimentControls` rule, the `.genreSelect, .instrumentSelect, .patternSelect` rule, its `:hover` and `:focus-visible` variants, and the `.swingControl`, `.swingControl input[type="range"]`, and `.swingControl span` rules.

After this, no `.accompanimentControls`, `.genreSelect`, `.instrumentSelect`, `.patternSelect`, or `.swingControl` selector remains anywhere in the file. Verify with:

Run: `grep -n "accompanimentControls\|genreSelect\|instrumentSelect\|patternSelect\|swingControl" src/components/ProgressionTrack/ProgressionTrack.module.css`
Expected: no output (every match removed).

- [ ] **Step 5: Run the test files and verify they pass**

Run: `pnpm run test -- src/components/ProgressionTrack/ProgressionTrack.test.tsx`
Expected: PASS — including the new `no longer renders the rehosted backing-track controls` test. The timeline / playhead / position-readout / `TransportBar` tests are unaffected.

- [ ] **Step 6: Run lint, build, and the full suite**

Run: `pnpm run lint`
Expected: PASS — no unused imports (`GENRE_STYLES`, `CHORD_PATTERNS`, `BASS_PATTERNS`, `DRUM_PATTERNS`, `ChordInstrumentId` were removed), no unused CSS classes.

Run: `pnpm run build`
Expected: PASS.

Run: `pnpm run test`
Expected: PASS — the full suite is green. If a test elsewhere asserted the accompaniment controls inside `ProgressionTrack`, apply the minimal fix and include it in this commit; report it.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionTrack.tsx src/components/ProgressionTrack/ProgressionTrack.module.css src/components/ProgressionTrack/ProgressionTrack.test.tsx
git commit -m "refactor(progression): move backing-track controls off the track"
```

---

## Task 5: Refresh visual baselines and run the full verification

**Files:**
- Modify (regenerated): `e2e/*.visual.spec.ts-snapshots/*` — any snapshot whose images changed.

- [ ] **Step 1: Run the mandatory pre-PR checks**

Run: `pnpm run lint` → Expected: PASS.
Run: `pnpm run test` → Expected: PASS — the full unit/component suite is green.
Run: `pnpm run build` → Expected: PASS.

- [ ] **Step 2: Refresh the darwin visual-regression baselines**

Run: `pnpm run test:visual:update`
Expected: darwin snapshots are rebuilt. The Progression-tab captures now show the METER / CHORDS / BACKING TRACK property grid; the `ProgressionTrack` captures no longer show the accompaniment row.

- [ ] **Step 3: Refresh the linux baselines**

Run: `pnpm run test:visual:update:linux`
Expected: linux snapshots are regenerated. If `test:visual:update:linux` fails for an environment reason (no Docker / Linux container) rather than a real snapshot diff, record the exact failing command and error, finish the remaining steps, and report DONE_WITH_CONCERNS — the linux baselines are regenerated by CI.

- [ ] **Step 4: Confirm the visual suite passes against the new baselines**

Run: `pnpm run test:visual`
Expected: PASS — every visual spec matches the freshly updated baselines.

- [ ] **Step 5: Manual sanity check of the snapshot diff**

Run: `git status --short e2e`
Inspect the changed snapshot images: the Progression tab should render as a 6-column grid — a METER group (Mode / Beats-per-bar / Length / Loop / Preset), a CHORDS group (the chord list beside the selected-chord editor), and a BACKING TRACK group (genre / instrument / chord-pattern / bass-pattern / drum-pattern / swing) — each under a cyan group header. The `ProgressionTrack` should show only the transport row + timeline, with no accompaniment controls. If a snapshot still shows the old stacked Progression tab or the accompaniment row on the track, a source change was missed.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(visual): refresh baselines for the Progression tab grid"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — against `2026-05-16-daw-shell-phases-8-13-design.md` Phase 11 (§7):
- `ProgressionTab` / `ProgressionControls` → `PropGrid columns={6}` → Task 3.
- Meter row (full-width): Beats/Bar (`StepperControl` → `beatsPerBarAtom`), Preset (`LabeledSelect` → `currentProgressionPresetIdAtom`), Length (read-only — `totalProgressionBarsAtom`), Loop (`Switch` → `progressionLoopEnabledAtom`), Progression Mode kept → Task 3 (METER `GroupHeader` + cells).
- CHORDS group: chord list (`span 3`) beside selected-chord editor (`span 3`, degree/duration/quality), functionally unchanged → Task 3.
- BACKING TRACK group: Genre / Chord instrument / Chord pattern / Bass pattern / Drum pattern / Swing → Task 2 (`BackingTrackControls`) + Task 3 (mounting it).
- Backing-track rehost — `.accompanimentControls` removed from `ProgressionTrack`, and `.accompanimentControls`/`.genreSelect`/`.instrumentSelect`/`.patternSelect`/`.swingControl` CSS removed → Task 4. `ProgressionTrack` keeps timeline / playhead / position readout / `TransportBar` → Task 4 keeps those untouched.
- Data flow — existing atoms only: `beatsPerBarAtom`, `currentProgressionPresetIdAtom`, `totalProgressionBarsAtom`, `progressionLoopEnabledAtom`, `progressionEnabledAtom`, `progressionGenreStyleAtom`, `applyGenreStyleAtom`, `progressionChordInstrumentAtom`, `progressionChordPatternAtom`, `progressionBassPatternAtom`, `progressionDrumPatternAtom`, `progressionSwingAtom` all pre-exist (confirmed in `useProgressionState.ts`). No new atoms.
- Testing → Task 2 (`BackingTrackControls` tests), Task 3 (`ProgressionControls` grid-layout block + full-suite gate), Task 4 (`ProgressionTrack` accompaniment-absence test), Task 5 (visual refresh of `app-components` / `app-overlays`).

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"; every code step gives complete file contents or an exact delete/insert instruction, and every command has an expected result.

**Type consistency:** `useProgressionState()` is destructured with the exact field names it exports (`progressionLoopEnabled`/`setProgressionLoopEnabled`, `totalProgressionBars`, the six backing-track pairs). `PropGrid`/`Prop`/`GroupHeader`/`ToggleProp` are consumed with the Phase 8 `InspectorGrid.tsx` signatures — `ToggleProp` takes `{ label, checked, onChange, span }` and the `Switch` accessible name is its `label`; the Progression-mode switch therefore uses a plain `Prop` + `Switch` (visible label "Mode" via the `Prop`, accessible name "Progression mode" via the `Switch`) so `getByRole("switch", { name: "Progression mode" })` still resolves, while the Loop control uses `ToggleProp` with accessible name "Loop". `formatProgressionDurationLabel` accepts `{ value, unit }` and is reused for the Length readout (`unit: "bar"`). The 14 `inspector.*` keys added in Task 1 are exactly the keys referenced by `t(...)` in Tasks 2 and 3 (`groupMeter`, `groupChords`, `groupBackingTrack`, `progressionMode`, `meterBeats`, `meterLength`, `meterLoop`, `meterPreset`, `btGenre`, `btInstrument`, `btChordPattern`, `btBassPattern`, `btDrumPattern`, `btSwing`).

---

## Execution complete

After Task 5, the branch is ready for a PR — Phase 11, against `main`, with `pnpm run lint`, `pnpm run test`, and `pnpm run build` green and visual baselines refreshed. Phase 12 (status bar) is the next plan.
