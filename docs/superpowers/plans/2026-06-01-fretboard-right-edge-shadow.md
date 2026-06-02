# Fretboard Right Edge Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the mobile right-edge fretboard shadow or paint bleed while preserving fretboard scrolling and connector visibility.

**Architecture:** First add a focused visual/geometry guard around the fretboard edge, then inspect wrapper/SVG overflow and filter behavior. The fix should be isolated to `Fretboard` or `FretboardSVG` styles.

**Tech Stack:** React, CSS Modules, SVG, Playwright visual tests, Vitest

---

## File Structure

- `src/components/Fretboard/Fretboard.module.css`: owns scroll wrapper overflow and clipping behavior.
- `src/components/FretboardSVG/FretboardSVG.module.css`: owns SVG sizing and any filter/paint containment.
- `src/components/Fretboard/Fretboard.test.tsx`: verifies mobile wrapper classes and attributes where possible.
- `e2e/app-mobile.visual.spec.ts`: adds or reuses mobile screenshots that capture the fretboard edge.
- `e2e/responsive.spec.ts`: adds geometry guard for page horizontal overflow on mobile.

### Task 1: Add Mobile Fretboard Edge Regression Guard

**Files:**
- Modify: `e2e/responsive.spec.ts`

- [ ] **Step 1: Add a mobile horizontal overflow test**

Inside `test.describe("responsive layout regressions", () => { ... })`, add:

```ts
  test("keeps mobile fretboard paint inside the viewport width", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844, name: "390x844" },
      { width: 375, height: 667, name: "375x667" },
    ]) {
      await gotoApp(page, viewport.width, viewport.height);

      const metrics = await page.evaluate(() => {
        const outer = document.querySelector('[data-testid="fretboard-outer"]');
        const wrapper = document.querySelector('[class*="fretboard-wrapper"]');
        const getRect = (element: Element | null) => {
          if (!(element instanceof HTMLElement || element instanceof SVGElement)) return null;
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        };
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          outer: getRect(outer),
          wrapper: getRect(wrapper),
        };
      });

      expect(metrics.scrollWidth, viewport.name).toBeLessThanOrEqual(metrics.innerWidth);
      expect(metrics.outer, viewport.name).not.toBeNull();
      expect(metrics.wrapper, viewport.name).not.toBeNull();
      expect(metrics.outer!.right, viewport.name).toBeLessThanOrEqual(viewport.width);
      expect(metrics.wrapper!.right, viewport.name).toBeLessThanOrEqual(viewport.width);
    }
  });
```

- [ ] **Step 2: Run the focused regression**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "keeps mobile fretboard paint inside the viewport width"`

Expected before implementation: FAIL if the right-edge artifact creates measurable overflow; otherwise PASS and keep as a guard while using visual review for the paint artifact.

- [ ] **Step 3: Commit**

```bash
git add e2e/responsive.spec.ts
git commit -m "test(mobile): guard fretboard right edge overflow"
```

### Task 2: Isolate The Paint Source

**Files:**
- No committed code required unless the investigation finds an obvious one-line fix.

- [ ] **Step 1: Run local mobile visual capture**

Run: `pnpm run test:visual -- e2e/app-mobile.visual.spec.ts -g "app-mobile-portrait-390x844"`

Expected: either PASS or a snapshot diff that shows the current right-edge artifact.

- [ ] **Step 2: Inspect relevant styles**

Run:

```bash
rg "box-shadow|filter|drop-shadow|overflow|clip|contain" src/components/Fretboard src/components/FretboardSVG
```

Expected: identify whether the artifact is from wrapper overflow, SVG filter expansion, or an explicit shadow.

- [ ] **Step 3: Record the source in the implementation notes**

Append a short note to this plan file under this task:

```md
**Investigation result:** Record the exact selector and CSS property that produce the right-edge artifact. The fix in Task 3 must target that selector only.
```

- [ ] **Step 4: Commit the investigation note**

```bash
git add docs/superpowers/plans/2026-06-01-fretboard-right-edge-shadow.md
git commit -m "docs(mobile): record fretboard edge artifact source"
```

### Task 3: Apply The Narrow CSS Fix

**Files:**
- Modify one or more of:
  - `src/components/Fretboard/Fretboard.module.css`
  - `src/components/FretboardSVG/FretboardSVG.module.css`

- [ ] **Step 1: Apply the wrapper containment fix when overflow is the source**

If Task 2 identifies wrapper paint overflow, update `Fretboard.module.css`:

```css
:global(.app-container[data-layout-tier="mobile"]) .fretboard-wrapper {
  overflow-x: auto;
  overflow-y: clip;
  overflow-clip-margin: 0;
  contain: layout paint;
}
```

- [ ] **Step 2: Apply the SVG containment fix when SVG paint is the source**

If Task 2 identifies SVG-level filter or shadow paint bleed, update `FretboardSVG.module.css` on the SVG root class:

```css
:global(.app-container[data-layout-tier="mobile"]) .fretboard-svg {
  overflow: clip;
}
```

Use the actual SVG root class name from `FretboardSVG.module.css`. Do not add this rule if it clips chord connectors; use the wrapper-only fix instead.

- [ ] **Step 3: Run Fretboard tests**

Run: `pnpm test src/components/Fretboard/Fretboard.test.tsx src/components/FretboardSVG/FretboardSVG.test.tsx`

Expected: PASS.

- [ ] **Step 4: Run focused responsive guard**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "keeps mobile fretboard paint inside the viewport width"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fretboard/Fretboard.module.css src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "fix(mobile): contain fretboard right edge paint"
```

### Task 4: Refresh Mobile Visual Evidence

**Files:**
- Modify generated snapshots under `e2e/app-mobile.visual.spec.ts-snapshots/` only when the visual output intentionally changes.

- [ ] **Step 1: Run mobile visual suite**

Run: `pnpm run test:visual -- e2e/app-mobile.visual.spec.ts`

Expected: PASS or only intentional fretboard-edge snapshot diffs.

- [ ] **Step 2: Update snapshots when the diff is intentional**

Run: `pnpm run test:visual:update -- e2e/app-mobile.visual.spec.ts`

Expected: mobile snapshots update.

- [ ] **Step 3: Commit snapshots**

```bash
git add e2e/app-mobile.visual.spec.ts-snapshots
git commit -m "test(visual): refresh mobile fretboard edge snapshots"
```
