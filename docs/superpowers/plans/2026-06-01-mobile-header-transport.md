# Mobile Header And Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile header actions and transport controls touch-sized, unclipped, and compact enough for `390x844` and `375x667`.

**Architecture:** Keep the mobile header as two rows: brand/actions first, transport second. Improve the action row through `AppHeader` CSS and improve transport density through `HeaderTransportCluster`/`TransportBar` CSS without changing playback state.

**Tech Stack:** React, CSS Modules, Playwright, Vitest

---

## File Structure

- `src/components/AppHeader/AppHeader.module.css`: owns header row wrapping, brand/action sizing, and mobile header spacing.
- `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css`: owns position/tempo/scale readout layout in the header transport row.
- `src/components/TransportBar/TransportBar.module.css`: owns play/stop and transport button sizing.
- `e2e/responsive.spec.ts`: adds mobile geometry checks for header actions and transport row.
- `e2e/app-mobile.visual.spec.ts`: verifies visual outcomes at `390x844`.

### Task 1: Add Header Mobile Geometry Regression

**Files:**
- Modify: `e2e/responsive.spec.ts`

- [ ] **Step 1: Extend `getMetrics` with transport geometry**

In `getMetrics`, add these selectors:

```ts
    const header = document.querySelector('[data-testid="app-header"]');
    const transport = document.querySelector('[data-testid="app-header-transport"]');
    const transportCluster = document.querySelector('[data-testid="header-transport-cluster"]');
```

Add these return fields:

```ts
      headerRect: getRect(header),
      transportRect: getRect(transport),
      transportClusterRect: getRect(transportCluster),
```

- [ ] **Step 2: Add mobile header fit assertions**

Inside `test.describe("responsive layout regressions", () => { ... })`, add:

```ts
  test("keeps mobile header actions and transport within the viewport", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844, name: "390x844" },
      { width: 375, height: 667, name: "375x667" },
    ]) {
      await gotoApp(page, viewport.width, viewport.height);

      const metrics = await getMetrics(page);
      expect(metrics.headerRect, viewport.name).not.toBeNull();
      expect(metrics.titleRect, viewport.name).not.toBeNull();
      expect(metrics.actionsRect, viewport.name).not.toBeNull();
      expect(metrics.transportRect, viewport.name).not.toBeNull();
      expect(metrics.transportClusterRect, viewport.name).not.toBeNull();

      expect(metrics.actionsRect!.right, viewport.name).toBeLessThanOrEqual(viewport.width);
      expect(metrics.transportClusterRect!.right, viewport.name).toBeLessThanOrEqual(viewport.width);
      expect(metrics.headerRect!.height, viewport.name).toBeLessThanOrEqual(176);
    }
  });
```

- [ ] **Step 3: Run the test and confirm the current failure or baseline**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "keeps mobile header actions and transport within the viewport"`

Expected before implementation: FAIL if current header clips or exceeds the height budget; otherwise PASS and keep the test as a regression guard.

- [ ] **Step 4: Commit**

```bash
git add e2e/responsive.spec.ts
git commit -m "test(mobile): cover header transport geometry"
```

### Task 2: Tighten Mobile Header Action Row

**Files:**
- Modify: `src/components/AppHeader/AppHeader.module.css`

- [ ] **Step 1: Add mobile row constraints**

In the mobile `.app-header` block, ensure the first row is compact and cannot overflow horizontally:

```css
:global(.app-container[data-layout-tier="mobile"]) .app-header {
  padding-inline: 0.65rem;
  margin-top: -0.65rem;
  margin-inline: -0.65rem;
  gap: 0.45rem 0.5rem;
}
```

- [ ] **Step 2: Constrain brand width against actions**

Add:

```css
:global(.app-container[data-layout-tier="mobile"]) .app-header-brand {
  flex: 1 1 auto;
  min-width: 0;
}

:global(.app-container[data-layout-tier="mobile"]) .app-header-brand-wordmark {
  min-width: 0;
  max-width: min(13rem, 52vw);
}
```

- [ ] **Step 3: Keep actions touch-sized but compact**

Add:

```css
:global(.app-container[data-layout-tier="mobile"]) .app-header-actions {
  flex: 0 0 auto;
  gap: 0.3rem;
  max-width: 44vw;
}
```

- [ ] **Step 4: Run header tests**

Run: `pnpm test src/components/AppHeader/AppHeader.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run responsive header geometry test**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "keeps mobile header actions and transport within the viewport"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppHeader/AppHeader.module.css
git commit -m "fix(mobile): prevent header action overflow"
```

### Task 3: Resize Mobile Transport Controls

**Files:**
- Modify: `src/components/TransportBar/TransportBar.module.css`
- Test: `src/components/TransportBar/TransportBar.test.tsx`

- [ ] **Step 1: Inspect existing transport button selectors**

Run: `rg "button|transport|play|stop|control-height" src/components/TransportBar/TransportBar.module.css`

Expected: locate the button class names used by `TransportBar`.

- [ ] **Step 2: Add mobile touch target rules**

In `src/components/TransportBar/TransportBar.module.css`, add mobile-tier rules for the actual transport button class names found in Step 1. If the file uses `.transport-button`, add:

```css
:global(.app-container[data-layout-tier="mobile"]) .transport-button {
  min-width: var(--control-height);
  min-height: var(--control-height);
}
```

If the play/stop button has a separate class, add:

```css
:global(.app-container[data-layout-tier="mobile"]) .play-button {
  min-width: var(--control-height);
  min-height: var(--control-height);
}
```

- [ ] **Step 3: Add or update a CSS test**

In `src/components/TransportBar/TransportBar.test.tsx`, add an assertion matching the actual class names:

```tsx
import css from "./TransportBar.module.css?raw";

it("sizes transport buttons to the mobile control-height token", () => {
  expect(css).toMatch(/data-layout-tier="mobile"[\s\S]*min-height:\s*var\(--control-height\)/);
});
```

- [ ] **Step 4: Run TransportBar tests**

Run: `pnpm test src/components/TransportBar/TransportBar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TransportBar/TransportBar.module.css src/components/TransportBar/TransportBar.test.tsx
git commit -m "fix(mobile): enlarge transport touch targets"
```

### Task 4: Compact Mobile Readouts

**Files:**
- Modify: `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css`
- Test: `src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx`

- [ ] **Step 1: Update mobile cluster layout**

In `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css`, replace the mobile `.contextReadouts` grid with a compact row:

```css
:global(.app-container[data-layout-tier="mobile"]) .contextReadouts {
  flex: 1 1 100%;
  grid-template-columns: minmax(4.25rem, 0.7fr) minmax(0, 1.3fr);
  min-width: 0;
}
```

- [ ] **Step 2: Reduce mobile readout padding without shrinking text below legible sizes**

Add:

```css
:global(.app-container[data-layout-tier="mobile"]) .positionReadout,
:global(.app-container[data-layout-tier="mobile"]) .contextBox {
  padding-block: 0.18rem;
  padding-inline: 0.38rem;
}

:global(.app-container[data-layout-tier="mobile"]) .scalePrimary {
  max-width: 100%;
}
```

- [ ] **Step 3: Run HeaderTransportCluster tests**

Run: `pnpm test src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx`

Expected: PASS.

- [ ] **Step 4: Run mobile visual snapshots**

Run: `pnpm run test:visual -- e2e/app-mobile.visual.spec.ts`

Expected: PASS, or intentional header snapshot diffs.

- [ ] **Step 5: Commit**

```bash
git add src/components/HeaderTransportCluster/HeaderTransportCluster.module.css
git commit -m "fix(mobile): compact header transport readouts"
```

