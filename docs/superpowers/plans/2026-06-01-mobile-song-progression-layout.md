# Mobile Song And Progression Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Song tab efficient on mobile by pairing sensible fields, compacting progression actions, and preventing the chord list/editor overlap.

**Architecture:** Keep the existing two Inspector tabs. Improve `SongControls` mobile composition locally, using CSS module classes for paired rows and single-column progression editing. Add a final density checkpoint before considering any new tab.

**Tech Stack:** React, CSS Modules, Radix Tabs, Playwright, Vitest

---

## File Structure

- `src/components/SongControls/SongControls.tsx`: adds local grouping classes around Key/Time/Backing Track and progression editor sections.
- `src/components/SongControls/SongControls.module.css`: owns mobile paired rows, progression toolbar compactness, and master-detail stacking.
- `src/components/Inspector/InspectorCard.module.css`: only touched if the generic card header needs a mobile action-row adjustment.
- `src/components/SongControls/SongControls.test.tsx`: verifies structure and locked actions still render correctly.
- `e2e/responsive.spec.ts`: adds geometry checks for Song controls and progression editor non-overlap.
- `e2e/app-mobile.visual.spec.ts`: captures the mobile Song tab.

### Task 1: Add Song Mobile Geometry Regression

**Files:**
- Modify: `e2e/responsive.spec.ts`

- [ ] **Step 1: Add a helper for overlap checks**

Near the existing helpers, add:

```ts
async function expectNoVerticalOverlap(page: Page, firstSelector: string, secondSelector: string, label: string) {
  const metrics = await page.evaluate(({ first, second }) => {
    const getRect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      };
    };
    return {
      first: getRect(first),
      second: getRect(second),
    };
  }, { first: firstSelector, second: secondSelector });

  expect(metrics.first, label).not.toBeNull();
  expect(metrics.second, label).not.toBeNull();
  expect(metrics.first!.bottom, label).toBeLessThanOrEqual(metrics.second!.top + 1);
}
```

- [ ] **Step 2: Add stable hooks in the test via existing class names**

This test will query CSS module output by semantic content where possible. Add:

```ts
  test("keeps mobile progression chord list and editor from overlapping", async ({ page }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("tab", { name: "Song" }).click();

    await expect(page.getByRole("button", { name: "Sequence" })).toBeVisible();
    await page.getByText("Editing chord", { exact: false }).scrollIntoViewIfNeeded();

    await expectNoVerticalOverlap(
      page,
      '[aria-label="Progression navigation"]',
      '[class*="editor-panel"]',
      "progression editor",
    );
  });
```

- [ ] **Step 3: Run focused test**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "keeps mobile progression chord list and editor from overlapping"`

Expected before implementation: FAIL if the current overlap reproduces; otherwise PASS and keep as a guard.

- [ ] **Step 4: Commit**

```bash
git add e2e/responsive.spec.ts
git commit -m "test(mobile): cover progression editor overlap"
```

### Task 2: Pair Key And Time Fields On Mobile

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/components/SongControls/SongControls.module.css`
- Test: `src/components/SongControls/SongControls.test.tsx`

- [ ] **Step 1: Add grouping classes to Key and Time cards**

In `SongControls.tsx`, add `className` props to the existing `PropGrid` instances:

```tsx
            <PropGrid columns={4} className={styles["mobile-paired-grid"]}>
```

For the Time card:

```tsx
            <PropGrid columns={5} className={styles["mobile-paired-grid"]}>
```

If `PropGrid` does not accept `className`, update `src/components/Inspector/InspectorGrid.tsx` to include it:

```tsx
export interface PropGridProps {
  columns?: number;
  className?: string;
  children: ReactNode;
}
```

```tsx
<div className={clsx(styles.propGrid, className)} style={style}>
```

- [ ] **Step 2: Add mobile paired grid CSS**

In `SongControls.module.css`, add:

```css
:global(.app-container[data-layout-tier="mobile"]) .mobile-paired-grid {
  grid-template-columns: minmax(5.5rem, 0.8fr) minmax(0, 1.2fr);
}

:global(.app-container[data-layout-tier="mobile"]) .mobile-paired-grid > * {
  grid-column: auto !important;
  min-width: 0;
}
```

- [ ] **Step 3: Add a render assertion**

In `SongControls.test.tsx`, add:

```tsx
it("marks key and time grids as mobile paired grids", () => {
  render(<SongControls />);
  const pairedGrids = document.querySelectorAll('[class*="mobile-paired-grid"]');
  expect(pairedGrids.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 4: Run SongControls tests**

Run: `pnpm test src/components/SongControls/SongControls.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.module.css src/components/Inspector/InspectorGrid.tsx src/components/SongControls/SongControls.test.tsx
git commit -m "fix(mobile): pair song key and time fields"
```

### Task 3: Compact Progression Card Header Actions

**Files:**
- Modify: `src/components/SongControls/SongControls.module.css`
- Modify: `src/components/Inspector/InspectorCard.module.css`
- Test: `src/components/Inspector/InspectorCard.test.tsx`

- [ ] **Step 1: Keep card header actions aligned on mobile**

In `InspectorCard.module.css`, add:

```css
:global(.app-container[data-layout-tier="mobile"]) .cardHeadActions {
  margin-left: auto;
  max-width: 100%;
}
```

- [ ] **Step 2: Compact the progression toolbar**

In `SongControls.module.css`, add:

```css
:global(.app-container[data-layout-tier="mobile"]) .progression-toolbar {
  gap: 0.35rem;
  flex-wrap: nowrap;
  margin-left: auto;
}

:global(.app-container[data-layout-tier="mobile"]) .toolbar-button span {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .toolbar-divider {
  display: none;
}
```

- [ ] **Step 3: Run card and song tests**

Run: `pnpm test src/components/Inspector/InspectorCard.test.tsx src/components/SongControls/SongControls.test.tsx`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Inspector/InspectorCard.module.css src/components/SongControls/SongControls.module.css
git commit -m "fix(mobile): compact progression card actions"
```

### Task 4: Stack Progression Master Detail On Mobile

**Files:**
- Modify: `src/components/SongControls/SongControls.module.css`

- [ ] **Step 1: Force single-column mobile master-detail**

In `SongControls.module.css`, add:

```css
:global(.app-container[data-layout-tier="mobile"]) .progression-master-detail {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
}

:global(.app-container[data-layout-tier="mobile"]) .editor-panel {
  flex: 0 1 auto;
  width: 100%;
  min-width: 0;
}
```

- [ ] **Step 2: Make editor controls wrap cleanly**

Add:

```css
:global(.app-container[data-layout-tier="mobile"]) .editor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
}

:global(.app-container[data-layout-tier="mobile"]) .duration-row,
:global(.app-container[data-layout-tier="mobile"]) .quality-row {
  flex-wrap: wrap;
}

:global(.app-container[data-layout-tier="mobile"]) .duration-unit {
  flex: 1 1 8rem;
}
```

- [ ] **Step 3: Run focused overlap e2e test**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "keeps mobile progression chord list and editor from overlapping"`

Expected: PASS.

- [ ] **Step 4: Run mobile Song visual**

Run: `pnpm run test:visual -- e2e/app-mobile.visual.spec.ts -g "app-mobile-progression-tab-portrait-390x844"`

Expected: PASS, or intentional Song tab snapshot diff.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/SongControls.module.css
git commit -m "fix(mobile): stack progression editor below chord list"
```

### Task 5: Document Song Tab Density Decision

**Files:**
- Modify: `docs/superpowers/specs/2026-06-01-mobile-responsiveness-design.md`

- [ ] **Step 1: Add a density checkpoint note**

Under `### 9. Song Tab Density Checkpoint`, append:

```md
**Decision record:** After implementing the Song card pairing, compact progression actions, and stacked progression editor, review the Song tab at `390x844` and `375x667`. If the tab is still too dense, create a separate implementation plan for a new mobile tab. If the tab is usable, keep the existing two-tab Inspector.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-01-mobile-responsiveness-design.md
git commit -m "docs(mobile): record song tab density checkpoint"
```

