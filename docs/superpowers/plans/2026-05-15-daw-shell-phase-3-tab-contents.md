# DAW Shell Phase 3 — Move Tab Contents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the existing View / Scale / Chord controls into the Inspector tab shell built in Phase 2, make the Inspector the default controls panel for desktop and tablet layouts, remove the `?inspector=tabs` dev flag, and delete the now-orphaned `ExpandedControlsPanel`.

**Architecture:** Three small tab-body components (`ViewTab`, `ScaleTab`, `ChordTab`) compose the existing leaf controls — `FingeringPatternControls`, `FretRangeControl`, `ScaleSelector`, `ChordOverlayControls`, `CircleOfFifths` — into Radix Tabs panels. No leaf component is modified; this phase is purely a re-host. After wiring, `App.tsx` swaps `<ExpandedControlsPanel mode={…}/>` for `<Inspector />`, the `?inspector=tabs` query flag is retired, and `ExpandedControlsPanel.tsx` + its module CSS are deleted. The mobile path (`MobileTabPanel`) keeps using the same leaf components directly, so mobile is unaffected until Phase 7.

**Tech Stack:** React 19 + TypeScript, Jotai, `@radix-ui/react-tabs`, CSS Modules with tokens from `src/styles/tokens.css` / `semantic.css`. Tests via Vitest + Testing Library. Visual regression via Playwright (darwin + linux baselines).

**Phase 2 recap (already shipped, do not modify in Phase 3 unless a step says so):**
- `src/components/Inspector/Inspector.tsx` renders three (or four, when progression is on) `<RadixTabs.Trigger>` and a matching `<RadixTabs.Content>` per tab, currently with **empty** panel bodies.
- `src/components/Inspector/tabs.ts` exports `ALWAYS_VISIBLE_TABS`, `PROGRESSION_TAB`, and the `InspectorTabId` union.
- `src/components/Inspector/Inspector.module.css` applies the DAW faceplate chrome and a cyan-underline active-tab style.
- `src/utils/inspectorPreview.ts` exports `isInspectorPreviewEnabled()` reading `?inspector=tabs`.
- `src/App.tsx` mounts `<Inspector />` *alongside* `<ExpandedControlsPanel />` inside the `controlsPanel` slot when the flag is on.
- `e2e/inspector-preview.visual.spec.ts` snapshots `/?inspector=tabs` at 1280×900 (darwin + linux baselines committed).

**What this plan does NOT do (deferred to later phases per the spec):**
- It does **not** refactor leaf components. The spec's eventual View tab also wants Accidentals / Enharmonic display / Scale-degree-colors switches; the spec's eventual Scale tab wants the chord-type-for-scale chip row. Those moves are deferred — Phase 3 just rehosts the current controls.
- It does **not** add the Chord tab's "selected-chord callout" (Phase 5).
- It does **not** move `ProgressionControls` into the Progression tab (Phase 5).
- It does **not** touch `MobileTabPanel` or any mobile leaf rendering (Phase 7).
- It does **not** restyle `TopBandSummary` (Phase 4) or the transport bar (Phase 6).

---

## File Structure

**New files:**
- `src/components/Inspector/ViewTab.tsx` — composes `FingeringPatternControls` + `FretRangeControl`.
- `src/components/Inspector/ViewTab.module.css` — minimal layout (vertical stack with section spacing).
- `src/components/Inspector/ViewTab.test.tsx` — unit test that the View tab renders the expected leaves and wires fret-range atoms.
- `src/components/Inspector/ScaleTab.tsx` — composes `ScaleSelector` + lazy `CircleOfFifths`.
- `src/components/Inspector/ScaleTab.module.css` — two-column layout on wider widths, single column below.
- `src/components/Inspector/ScaleTab.test.tsx` — unit test for tab content (ScaleSelector + a Suspense boundary for CoF).
- `src/components/Inspector/ChordTab.tsx` — wraps `ChordOverlayControls`.
- `src/components/Inspector/ChordTab.module.css` — minimal padding wrapper.
- `src/components/Inspector/ChordTab.test.tsx` — unit test that Chord tab renders ChordOverlayControls.

**Modified files:**
- `src/components/Inspector/Inspector.tsx` — populate `<RadixTabs.Content>` children with the tab bodies.
- `src/components/Inspector/Inspector.test.tsx` — additional assertions that selecting a tab reveals the right content.
- `src/App.tsx` — swap `<ExpandedControlsPanel />` for `<Inspector />`, drop the `?inspector=tabs` flag and the `showInspectorPreview` constant; remove the `ExpandedControlsPanel` lazy import.
- `src/App.test.tsx` — replace any assertions that depended on `ExpandedControlsPanel` lazy-load timing or its DOM markers.
- `src/layout/layout.test.tsx` — update the CSS regression guard (currently reads `ExpandedControlsPanel.module.css`).
- `e2e/css-scoping.spec.ts` — drop the `controls-panel` / `key-column` class-name entries that reference the deleted file.
- `e2e/inspector-preview.visual.spec.ts` → rename to `e2e/inspector.visual.spec.ts`; point at `/` instead of `/?inspector=tabs`; rename the snapshot id.
- `e2e/app-layout.visual.spec.ts-snapshots/`, `e2e/app-components.visual.spec.ts-snapshots/` — refresh darwin + linux PNGs (the desktop/tablet panel area has changed).

**Deleted files:**
- `src/components/ExpandedControlsPanel/ExpandedControlsPanel.tsx`
- `src/components/ExpandedControlsPanel/ExpandedControlsPanel.module.css`
- `src/utils/inspectorPreview.ts`
- `src/utils/inspectorPreview.test.ts`
- `e2e/inspector-preview.visual.spec.ts-snapshots/inspector-preview-default-1280x900-chromium-darwin.png`
- `e2e/inspector-preview.visual.spec.ts-snapshots/inspector-preview-default-1280x900-chromium-linux.png`

**Not touched:** every leaf control, `TheoryControls`, `MobileTabPanel`, `MainLayoutWrapper`, every Jotai atom, every i18n string. Phase 2's `Inspector.module.css`, `tabs.ts`, and i18n inspector keys are reused as-is.

---

### Task 1: Build the View tab body

**Files:**
- Create: `src/components/Inspector/ViewTab.tsx`
- Create: `src/components/Inspector/ViewTab.module.css`
- Create: `src/components/Inspector/ViewTab.test.tsx`

The View tab composes the two existing controls that today live in `BaseControlsSection` (inside `ExpandedControlsPanel.tsx`): `FingeringPatternControls` (which already handles fingering pattern + pattern-specific sub-controls + Note Labels) and `FretRangeControl` (driven by `fretStartAtom` / `fretEndAtom`). The Recenter button stays where it currently lives — inside `FretRangeControl` and its consumers — i.e. the visual recenter button is not added in this phase; the spec's standalone Recenter chip is a later move.

- [ ] **Step 1: Write the failing test**

Create `src/components/Inspector/ViewTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { fretStartAtom, fretEndAtom } from "../../store/atoms";
import { ViewTab } from "./ViewTab";

describe("ViewTab", () => {
  it("renders the fingering pattern controls and the fret range group", () => {
    renderWithAtoms(<ViewTab />);
    // FingeringPatternControls renders a labelled region. Its role/title is
    // structural; we assert the canonical label its consumers already test for.
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
    // FingeringPatternControls exposes the pattern chip row under a known label.
    expect(screen.getByText(/fingering pattern/i)).toBeInTheDocument();
  });

  it("reflects atom-seeded fret start/end values in the steppers", () => {
    renderWithAtoms(<ViewTab />, [
      [fretStartAtom, 3],
      [fretEndAtom, 8],
    ]);
    // FretRangeControl renders the value as text inside a labelled <StepperShell role="group">.
    const startGroup = screen.getByRole("group", { name: /start fret/i });
    expect(startGroup.textContent).toContain("3");
    const endGroup = screen.getByRole("group", { name: /end fret/i });
    expect(endGroup.textContent).toContain("8");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Inspector/ViewTab.test.tsx`
Expected: FAIL with module-not-found for `./ViewTab`.

- [ ] **Step 3: Create the minimal CSS module**

Create `src/components/Inspector/ViewTab.module.css`:

```css
.root {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.sectionLabel {
  font-family: var(--font-sans, "IBM Plex Sans", sans-serif);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-muted);
}
```

- [ ] **Step 4: Implement the View tab**

Create `src/components/Inspector/ViewTab.tsx`:

```tsx
import { useAtom } from "jotai";
import { fretStartAtom, fretEndAtom } from "../../store/atoms";
import { MAX_FRET } from "@fretflow/core";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import styles from "./ViewTab.module.css";

export function ViewTab() {
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);

  return (
    <div className={styles.root} data-inspector-tab="view">
      <FingeringPatternControls />
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Fret Range</span>
        <FretRangeControl
          startFret={fretStart}
          endFret={fretEnd}
          onStartChange={setFretStart}
          onEndChange={setFretEnd}
          maxFret={MAX_FRET}
          layout="dashboard"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Inspector/ViewTab.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ViewTab.tsx src/components/Inspector/ViewTab.module.css src/components/Inspector/ViewTab.test.tsx
git commit -m "feat(inspector): add ViewTab body composing fingering + fret range"
```

---

### Task 2: Build the Scale tab body

**Files:**
- Create: `src/components/Inspector/ScaleTab.tsx`
- Create: `src/components/Inspector/ScaleTab.module.css`
- Create: `src/components/Inspector/ScaleTab.test.tsx`

The Scale tab composes `ScaleSelector` (root + scale family selector, already atom-wired via `useScaleState`) and `CircleOfFifths` (lazy-loaded to preserve the current bundle behavior; takes explicit props as today). The right-column CoF reads its inputs from the same atoms that `KeyColumn` reads in `ExpandedControlsPanel.tsx` lines 80–100 — copy that wiring verbatim.

- [ ] **Step 1: Write the failing test**

Create `src/components/Inspector/ScaleTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { ScaleTab } from "./ScaleTab";

describe("ScaleTab", () => {
  it("renders the scale selector (root chips + family selector)", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    // ScaleSelector renders a root NoteGrid with role=radiogroup or a labelled
    // section; assert by the section heading it already exposes.
    expect(screen.getByText(/^root$/i)).toBeInTheDocument();
    expect(screen.getByText(/scale/i)).toBeInTheDocument();
  });

  it("lazy-loads and renders the Circle of Fifths", async () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    // CoF is lazy; wait for it to mount, then assert its accessible label.
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: /circle of fifths/i }),
      ).toBeInTheDocument();
    });
  });
});
```

> Note for the implementer: if `CircleOfFifths` exposes a different accessible name (e.g. `aria-label="Circle of Fifths"` on a `<figure>` or `<svg role="img">`), keep the matcher consistent. If no label exists today, add `aria-label="Circle of Fifths"` to the lazy-loaded component's outer wrapper as part of this task (one-line change, with no behavior impact).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Inspector/ScaleTab.test.tsx`
Expected: FAIL with module-not-found for `./ScaleTab`.

- [ ] **Step 3: Create the CSS module**

Create `src/components/Inspector/ScaleTab.module.css`:

```css
.root {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3, 0.75rem);
}

@media (min-width: 1024px) {
  .root {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
}

.cofWrapper {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: Implement the Scale tab**

Create `src/components/Inspector/ScaleTab.tsx`:

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
import { CircleOfFifthsSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import styles from "./ScaleTab.module.css";

const CircleOfFifths = lazy(() =>
  import("../CircleOfFifths/CircleOfFifths").then((m) => ({
    default: m.CircleOfFifths,
  })),
);

export function ScaleTab() {
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName] = useAtom(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  return (
    <div className={styles.root} data-inspector-tab="scale">
      <ScaleSelector />
      <div className={styles.cofWrapper}>
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

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Inspector/ScaleTab.test.tsx`
Expected: 2 tests pass. If the CoF accessible-name assertion fails because the component lacks an `aria-label`, add `aria-label="Circle of Fifths"` to its outermost SVG/figure in `src/components/CircleOfFifths/CircleOfFifths.tsx` (one-line addition) and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ScaleTab.tsx src/components/Inspector/ScaleTab.module.css src/components/Inspector/ScaleTab.test.tsx src/components/CircleOfFifths/CircleOfFifths.tsx
git commit -m "feat(inspector): add ScaleTab body with ScaleSelector + lazy CircleOfFifths"
```

(If `CircleOfFifths.tsx` was not modified, omit it from the `git add` line.)

---

### Task 3: Build the Chord tab body

**Files:**
- Create: `src/components/Inspector/ChordTab.tsx`
- Create: `src/components/Inspector/ChordTab.module.css`
- Create: `src/components/Inspector/ChordTab.test.tsx`

Phase 3's Chord tab body is exactly `ChordOverlayControls` — the selected-chord callout and Duplicate/Remove buttons are Phase 5. Wrap it in a minimal container so future tabs can add a tab-toolbar slot without touching `ChordOverlayControls`.

- [ ] **Step 1: Write the failing test**

Create `src/components/Inspector/ChordTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { ChordTab } from "./ChordTab";

describe("ChordTab", () => {
  it("renders ChordOverlayControls", () => {
    renderWithAtoms(<ChordTab />);
    // ChordOverlayControls labels its mode chip row with "Chord Mode" (i18n
    // key `controls.chordMode`). If that copy changes upstream, update both
    // this test and the i18n catalog.
    expect(screen.getByText(/chord mode/i)).toBeInTheDocument();
  });

  it("tags its root container with data-inspector-tab=chord", () => {
    const { container } = renderWithAtoms(<ChordTab />);
    expect(container.querySelector('[data-inspector-tab="chord"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Inspector/ChordTab.test.tsx`
Expected: FAIL with module-not-found for `./ChordTab`.

- [ ] **Step 3: Create the CSS module**

Create `src/components/Inspector/ChordTab.module.css`:

```css
.root {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}
```

- [ ] **Step 4: Implement the Chord tab**

Create `src/components/Inspector/ChordTab.tsx`:

```tsx
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import styles from "./ChordTab.module.css";

export function ChordTab() {
  return (
    <div className={styles.root} data-inspector-tab="chord">
      <ChordOverlayControls />
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Inspector/ChordTab.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/ChordTab.tsx src/components/Inspector/ChordTab.module.css src/components/Inspector/ChordTab.test.tsx
git commit -m "feat(inspector): add ChordTab body wrapping ChordOverlayControls"
```

---

### Task 4: Wire the tab bodies into the Inspector shell

**Files:**
- Modify: `src/components/Inspector/Inspector.tsx`
- Modify: `src/components/Inspector/Inspector.test.tsx`

The Inspector currently renders empty `<RadixTabs.Content>` panels (`Inspector.tsx:39-46`). Inject the body components and extend the existing tests to assert the correct body is visible for the active tab.

- [ ] **Step 1: Add the failing assertions to Inspector.test.tsx**

Append the two new test cases inside the existing `describe("Inspector", () => { … })` block in `src/components/Inspector/Inspector.test.tsx`, before its closing brace:

```tsx
  it("renders the View tab body by default", () => {
    renderInspector();
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("view");
    expect(screen.getByText(/fingering pattern/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
  });

  it("switches to the Scale tab body when the Scale tab is selected", async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole("tab", { name: "Scale" }));
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("scale");
    expect(screen.getByText(/^root$/i)).toBeInTheDocument();
  });

  it("switches to the Chord tab body when the Chord tab is selected", async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole("tab", { name: "Chord" }));
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("chord");
    expect(screen.getByText(/chord mode/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/components/Inspector/Inspector.test.tsx`
Expected: 6 prior tests pass; the 3 new tests FAIL because the panels are still empty.

- [ ] **Step 3: Inject the tab bodies in Inspector.tsx**

Replace the contents of `src/components/Inspector/Inspector.tsx` with:

```tsx
import { useState, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { useAtomValue } from "jotai";
import { progressionEnabledAtom } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import {
  ALWAYS_VISIBLE_TABS,
  PROGRESSION_TAB,
  type InspectorTabId,
} from "./tabs";
import { ViewTab } from "./ViewTab";
import { ScaleTab } from "./ScaleTab";
import { ChordTab } from "./ChordTab";
import styles from "./Inspector.module.css";

const TAB_BODIES: Record<InspectorTabId, () => ReactNode> = {
  view: () => <ViewTab />,
  scale: () => <ScaleTab />,
  chord: () => <ChordTab />,
  progression: () => null, // Phase 5 will mount ProgressionControls here.
};

export function Inspector() {
  const { t } = useTranslation();
  const [active, setActive] = useState<InspectorTabId>("view");
  const progressionEnabled = useAtomValue(progressionEnabledAtom);

  const visibleTabs = progressionEnabled
    ? [...ALWAYS_VISIBLE_TABS, PROGRESSION_TAB]
    : ALWAYS_VISIBLE_TABS;

  return (
    <RadixTabs.Root
      className={styles.root}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      <RadixTabs.List className={styles.tabList} aria-label="Inspector">
        {visibleTabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            className={styles.tab}
          >
            {t(`inspector.${tab.labelKey}`)}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {visibleTabs.map((tab) => (
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

- [ ] **Step 4: Run all Inspector unit tests to verify they pass**

Run: `npx vitest run src/components/Inspector/`
Expected: 9 Inspector tests pass (6 prior + 3 new), plus all `ViewTab.test`, `ScaleTab.test`, `ChordTab.test` cases pass.

- [ ] **Step 5: Smoke-check in the dev server**

Run: `npm run dev` (in a separate terminal) and visit `http://localhost:5173/fretboard-app/?inspector=tabs`.
Expected: the inspector now has populated View / Scale / Chord tabs that match the content currently shown by `ExpandedControlsPanel` (which is still rendered above it). Clicking each tab reveals the right controls. The Progression tab is hidden by default and only appears after enabling progression mode.

Stop the dev server when verified.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector/Inspector.tsx src/components/Inspector/Inspector.test.tsx
git commit -m "feat(inspector): render View/Scale/Chord tab bodies inside the shell"
```

---

### Task 5: Refresh the inspector-preview visual baseline (review checkpoint)

**Files:**
- Modify: `e2e/inspector-preview.visual.spec.ts-snapshots/inspector-preview-default-1280x900-chromium-darwin.png`
- Modify: `e2e/inspector-preview.visual.spec.ts-snapshots/inspector-preview-default-1280x900-chromium-linux.png`

The existing visual baseline captures the *empty* Inspector. After Task 4 it captures the populated Inspector. This task explicitly refreshes the baseline so reviewers can eyeball the new chrome and tab content before the cutover. The flag and the spec file itself are removed in Task 7.

- [ ] **Step 1: Run the visual test to confirm a diff exists**

Run: `npm run test:visual -- e2e/inspector-preview.visual.spec.ts`
Expected: FAIL with a pixel diff on `inspector-preview-default-1280x900`. The diff should show populated tab content in the Inspector area.

- [ ] **Step 2: Refresh the darwin baseline**

Run: `npm run test:visual:update -- e2e/inspector-preview.visual.spec.ts`
Expected: the darwin PNG is overwritten; rerunning `npm run test:visual -- e2e/inspector-preview.visual.spec.ts` now passes locally.

- [ ] **Step 3: Refresh the linux baseline**

Run: `npm run test:visual:update:linux -- e2e/inspector-preview.visual.spec.ts`
Expected: the linux PNG is overwritten; docker run completes cleanly.

- [ ] **Step 4: Commit**

```bash
git add e2e/inspector-preview.visual.spec.ts-snapshots/
git commit -m "test(visual): refresh inspector-preview baselines with populated tabs"
```

---

### Task 6: Cutover — make Inspector the default controls panel

**Files:**
- Modify: `src/App.tsx`

Replace the `<ExpandedControlsPanel />` mount in the `controlsPanel` slot with `<Inspector />`. Remove the `showInspectorPreview` flag and its import. The mobile path (`MobileTabPanel`, `BottomTabBar`) is untouched. The lazy import of `ExpandedControlsPanel` becomes dead and will be removed in Task 7.

- [ ] **Step 1: Remove the inspector preview flag and its import**

Edit `src/App.tsx`. Delete the line that imports `isInspectorPreviewEnabled` (currently `import { isInspectorPreviewEnabled } from "./utils/inspectorPreview";` near the top of the file) and the line `const showInspectorPreview = isInspectorPreviewEnabled();` inside `AppContent()`.

- [ ] **Step 2: Swap the controlsPanel slot content**

In the `<MainLayoutWrapper … />` JSX, find:

```tsx
      controlsPanel={
        <Suspense fallback={<ControlsPanelSkeleton mode={layout.panelMode} />}>
          <>
            <ExpandedControlsPanel mode={layout.panelMode} />
            {showInspectorPreview && <Inspector />}
          </>
        </Suspense>
      }
```

Replace with:

```tsx
      controlsPanel={
        <Suspense fallback={<ControlsPanelSkeleton mode={layout.panelMode} />}>
          <Inspector />
        </Suspense>
      }
```

(Inspector is not lazy-loaded, but its `ScaleTab` lazy-loads `CircleOfFifths`, so the `Suspense` boundary is still useful.)

- [ ] **Step 3: Update App.test.tsx where it assumed the old panel**

Search the file:

Run: `grep -n "ExpandedControlsPanel" src/App.test.tsx`

For every match: replace assertions that look for `ExpandedControlsPanel`-specific DOM (e.g. `dashboard-card-configuration`, `dashboard-card-theory`, `key-column`) with assertions that target the new Inspector. The minimum change per call site is:
- Replace `findByTestId("dashboard-card-configuration")` (or similar) with `findByRole("tab", { name: "View" })`.
- Remove the comment `// ExpandedControlsPanel is lazy loaded, wait for it to be ready` and replace it with `// Inspector is mounted directly; wait for the View tab to be available`.
- Delete the CSS-import regression assertion at line ~984 (`// Rendered CSS regression: verifies ExpandedControlsPanel.css is imported …`). The equivalent check moves to `layout.test.tsx` in Task 7.

Show the change explicitly for the lazy-load wait (this is the typical pattern):

Before:
```tsx
// ExpandedControlsPanel is lazy loaded, wait for it to be ready
await screen.findByTestId("dashboard-card-configuration");
```

After:
```tsx
// Inspector is mounted directly; wait for the View tab to be available
await screen.findByRole("tab", { name: "View" });
```

- [ ] **Step 4: Run the unit and integration tests**

Run: `npm run test`
Expected: all tests pass. If a snapshot test references the old DOM, regenerate or rewrite it as part of this step — never claim completion until the suite is green.

- [ ] **Step 5: Smoke-check the dev server**

Run: `npm run dev` and visit `http://localhost:5173/fretboard-app/` (no query string).
Expected: desktop / tablet layouts show only the new Inspector in the controls slot; `ExpandedControlsPanel` no longer renders. Mobile layout (resize the window below 768px) still uses `MobileTabPanel` exactly as before. The `?inspector=tabs` URL still loads — it's just inert.

Stop the dev server when verified.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(app): make Inspector the default controls panel for desktop/tablet"
```

---

### Task 7: Delete dead code — ExpandedControlsPanel + flag util

**Files:**
- Delete: `src/components/ExpandedControlsPanel/ExpandedControlsPanel.tsx`
- Delete: `src/components/ExpandedControlsPanel/ExpandedControlsPanel.module.css`
- Delete: `src/utils/inspectorPreview.ts`
- Delete: `src/utils/inspectorPreview.test.ts`
- Modify: `src/App.tsx` (remove the lazy import block for `ExpandedControlsPanel`)
- Modify: `src/layout/layout.test.tsx` (update CSS regression guard)
- Modify: `e2e/css-scoping.spec.ts` (drop `controls-panel` / `key-column` allowlist entries that referenced the deleted module)
- Rename: `e2e/inspector-preview.visual.spec.ts` → `e2e/inspector.visual.spec.ts`
- Rename/Delete the matching snapshot directory (see Step 6 below).

- [ ] **Step 1: Remove the lazy import in App.tsx**

Edit `src/App.tsx`. Delete the entire block:

```tsx
const ExpandedControlsPanel = lazy(() =>
  import("./components/ExpandedControlsPanel/ExpandedControlsPanel").then((m) => ({
    default: m.ExpandedControlsPanel,
  }))
);
```

- [ ] **Step 2: Delete the ExpandedControlsPanel directory**

Run: `git rm -r src/components/ExpandedControlsPanel`
Expected: both `.tsx` and `.module.css` are staged for removal.

- [ ] **Step 3: Delete the inspector-preview flag utility and its test**

Run: `git rm src/utils/inspectorPreview.ts src/utils/inspectorPreview.test.ts`

- [ ] **Step 4: Update `src/layout/layout.test.tsx`**

The current CSS regression guard reads `ExpandedControlsPanel.module.css`. Re-point it at `Inspector.module.css`. Concretely, change:

```ts
resolve(__dirname, "../components/ExpandedControlsPanel/ExpandedControlsPanel.module.css"),
```

to:

```ts
resolve(__dirname, "../components/Inspector/Inspector.module.css"),
```

Then update the regression-purpose comment block (around line 19) so it no longer claims to guard `ExpandedControlsPanel`'s grid. The new comment should read:

```ts
// Regression guard: if Inspector.module.css is unimported or its layout rule
// is mistakenly removed, the desktop/tablet controls panel collapses. This
// test reads the file directly to ensure it ships and contains the expected
// `.root` selector.
```

Adjust the assertion (currently checking for a specific selector from the old grid) to check for the new file's `.root` selector instead.

- [ ] **Step 5: Update `e2e/css-scoping.spec.ts`**

Open `e2e/css-scoping.spec.ts` and delete the two list entries that reference the removed module (around lines 253–255):

```ts
"controls-panel",    // Migrated to .controls-panel in ExpandedControlsPanel.module.css
…
"key-column",        // Migrated to :global([data-layout-column="key"]) in ExpandedControlsPanel.module.css
```

Replace with:

```ts
// (`controls-panel` and `key-column` were removed in Phase 3 along with
// ExpandedControlsPanel; the Inspector module CSS does not introduce
// global classes that need allowlisting here.)
```

- [ ] **Step 6: Rename the inspector-preview visual spec and its snapshot folder**

Run:

```bash
git mv e2e/inspector-preview.visual.spec.ts e2e/inspector.visual.spec.ts
git mv e2e/inspector-preview.visual.spec.ts-snapshots e2e/inspector.visual.spec.ts-snapshots
git mv "e2e/inspector.visual.spec.ts-snapshots/inspector-preview-default-1280x900-chromium-darwin.png" "e2e/inspector.visual.spec.ts-snapshots/inspector-default-1280x900-chromium-darwin.png"
git mv "e2e/inspector.visual.spec.ts-snapshots/inspector-preview-default-1280x900-chromium-linux.png" "e2e/inspector.visual.spec.ts-snapshots/inspector-default-1280x900-chromium-linux.png"
```

- [ ] **Step 7: Update the renamed spec to drop the `?inspector=tabs` query and the snapshot id**

Replace the body of `e2e/inspector.visual.spec.ts` with:

```ts
import { test } from "@playwright/test";
import { expectFullPageVisual, prepareVisualPage } from "./visual-helpers";

test.describe("Inspector Visual", () => {
  test("inspector-default-1280x900", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 1280, height: 900 }, { goto: false });
    await expectFullPageVisual(page, "inspector-default-1280x900");
  });
});
```

- [ ] **Step 8: Run lint, typecheck, and unit tests**

Run in parallel:
- `npm run lint`
- `npm run build:types` (or `npm run build` if no script-only typecheck exists)
- `npm run test`

Expected: 0 lint errors; typecheck passes; all unit/integration tests pass. If `npm run lint` flags any straggling import of the removed files, follow the trail and delete those references too.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(app): delete ExpandedControlsPanel and inspector-preview dev flag"
```

---

### Task 8: Refresh app-wide visual baselines

**Files:**
- Modify (auto-generated): `e2e/app-layout.visual.spec.ts-snapshots/` (darwin + linux PNGs for snapshots that capture the controls panel area)
- Modify (auto-generated): `e2e/app-components.visual.spec.ts-snapshots/` (any snapshots that captured `ExpandedControlsPanel` markers)
- Modify (auto-generated): `e2e/inspector.visual.spec.ts-snapshots/inspector-default-1280x900-chromium-{darwin,linux}.png` (regenerate after Task 7 renamed the snapshot id)

This is the second visual checkpoint. After cutover the entire desktop/tablet panel area now shows the Inspector instead of three cards, so multiple suites diff. Refresh both platforms.

- [ ] **Step 1: Run the visual suite and capture the failures**

Run: `npm run test:visual`
Expected: a controlled set of failures in `app-layout`, `app-components`, and `inspector` suites. Note which spec names diffed; if anything outside those suites fails, stop and investigate before proceeding.

- [ ] **Step 2: Refresh darwin baselines**

Run: `npm run test:visual:update`
Expected: PNGs are regenerated for the failing snapshots. Re-run `npm run test:visual` and confirm 0 failures.

- [ ] **Step 3: Refresh linux baselines**

Run: `npm run test:visual:update:linux`
Expected: docker run completes; linux PNGs are regenerated alongside the darwin ones.

- [ ] **Step 4: Eyeball the regenerated PNGs**

Open the changed PNGs in `git status` order and visually confirm each shows the expected new layout (Inspector in place of the three cards). If a snapshot looks broken (e.g. clipped content, missing controls), stop — that's a real regression, not a baseline drift.

- [ ] **Step 5: Commit**

```bash
git add e2e/app-layout.visual.spec.ts-snapshots/ e2e/app-components.visual.spec.ts-snapshots/ e2e/inspector.visual.spec.ts-snapshots/
git commit -m "test(visual): refresh app-layout/app-components/inspector baselines for DAW shell Phase 3"
```

---

### Final Verification

After all tasks complete, run the full quality gate locally before opening a PR.

- [ ] **Lint**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Unit + integration tests**

Run: `npm run test`
Expected: all tests pass, including the new `ViewTab.test`, `ScaleTab.test`, `ChordTab.test`, and the expanded `Inspector.test`.

- [ ] **Production build**

Run: `npm run build`
Expected: clean build; bundle-size warning still absent.

- [ ] **E2E (production)**

Run: `npm run test:e2e:production`
Expected: all e2e tests pass.

- [ ] **Visual regression (darwin)**

Run: `npm run test:visual`
Expected: all tests pass on darwin.

- [ ] **Visual regression (linux)**

Run: `npm run test:visual:ci`
Expected: all tests pass on linux.

If any step fails: stop, return to the task that produced the regression, fix it, recommit, then resume verification.

---

## Notes for the next phase

- Phase 4 (Top Band Summary restyle) does not depend on Phase 3 internals, but it will likely touch the same area of `App.tsx` — coordinate sequencing if both are in flight.
- Phase 5 (Progression integration) will replace the `progression: () => null` placeholder in `Inspector.tsx`'s `TAB_BODIES` map. A subsequent plan should also add the selected-chord callout to the Chord tab.
- Phase 7 will delete `MobileTabPanel`, `BottomTabBar`, `TheoryControls`, `Card`, `ToggleBar`. Phase 3 deliberately leaves those alive because mobile still depends on them.

## Spec recovery note

The spec this plan implements (`docs/superpowers/specs/2026-05-14-daw-shell-redesign-design.md`) and the Phase 2 plan (`docs/superpowers/plans/2026-05-14-daw-shell-phase-2-inspector-shell.md`) lived only in the deleted `claude/agitated-merkle-f73737` worktree and were never committed. If those documents are needed for review, recover them from the worktree's reflog before deleting any further branches, or reconstruct the spec from the inline summary in this plan's header.
