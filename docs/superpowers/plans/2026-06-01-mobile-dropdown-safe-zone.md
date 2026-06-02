# Mobile Dropdown Safe Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep mobile select and dropdown menus above the fixed bottom Inspector tabs while preserving desktop menu behavior.

**Architecture:** Add a shared mobile safe-zone token, apply it to Radix Select and DropdownMenu content, and verify the Overlay voicing dropdown geometry at `390x844` and `375x667`. The fix stays in shared menu primitives because Overlay and Song controls use the same wrappers.

**Tech Stack:** React, Radix Select, Radix DropdownMenu, CSS Modules, Playwright, Vitest

---

## File Structure

- `src/styles/tokens.css`: owns shared app-level sizing tokens; add the mobile bottom navigation safe-zone token here.
- `src/components/LabeledSelect/LabeledSelect.tsx`: passes Radix collision boundaries and alignment props for Select content.
- `src/components/LabeledSelect/LabeledSelect.module.css`: constrains Select content height using Radix available-height plus the safe-zone fallback.
- `src/components/PresetMenu/PresetMenu.tsx`: passes matching collision props for DropdownMenu content and subcontent.
- `src/components/PresetMenu/PresetMenu.module.css`: constrains DropdownMenu content height.
- `e2e/responsive.spec.ts`: adds geometry regression tests for the mobile Overlay voicing dropdown.

### Task 1: Add Mobile Safe-Zone Token

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add a root token and mobile override**

In `src/styles/tokens.css`, add a default token near the existing size/control tokens:

```css
  --mobile-bottom-nav-safe-zone: 0px;
```

Inside the existing `@media (max-width: 767px)` `:root` block, add:

```css
    --mobile-bottom-nav-safe-zone: calc(3.5rem + env(safe-area-inset-bottom));
```

- [ ] **Step 2: Run token/CSS tests**

Run: `pnpm test src/styles/semantic.css.test.ts src/components/shared/shared.test.tsx`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "style(mobile): add bottom nav safe-zone token"
```

### Task 2: Constrain LabeledSelect Menus

**Files:**
- Modify: `src/components/LabeledSelect/LabeledSelect.tsx`
- Modify: `src/components/LabeledSelect/LabeledSelect.module.css`

- [ ] **Step 1: Update Select content props**

In `src/components/LabeledSelect/LabeledSelect.tsx`, update the `<Select.Content>` props:

```tsx
          <Select.Content
            className={styles['labeled-select-content']}
            position="popper"
            sideOffset={4}
            collisionPadding={{
              top: 8,
              right: 8,
              bottom: 8,
              left: 8,
            }}
          >
```

- [ ] **Step 2: Update Select content height CSS**

In `src/components/LabeledSelect/LabeledSelect.module.css`, replace the existing `.labeled-select-content` `max-height` declaration with:

```css
  max-height: min(
    var(--radix-select-content-available-height, 60vh),
    calc(100dvh - var(--mobile-bottom-nav-safe-zone, 0px) - 1rem),
    480px
  );
```

- [ ] **Step 3: Run LabeledSelect tests**

Run: `pnpm test src/components/LabeledSelect/LabeledSelect.test.tsx`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/LabeledSelect/LabeledSelect.tsx src/components/LabeledSelect/LabeledSelect.module.css
git commit -m "fix(mobile): keep select menus above bottom tabs"
```

### Task 3: Constrain PresetMenu Dropdowns

**Files:**
- Modify: `src/components/PresetMenu/PresetMenu.tsx`
- Modify: `src/components/PresetMenu/PresetMenu.module.css`

- [ ] **Step 1: Update root DropdownMenu content props**

In `src/components/PresetMenu/PresetMenu.tsx`, update the top-level `<DropdownMenu.Content>`:

```tsx
        <DropdownMenu.Content
          className={styles["preset-menu-content"]}
          sideOffset={4}
          align="start"
          collisionPadding={{
            top: 8,
            right: 8,
            bottom: 8,
            left: 8,
          }}
        >
```

- [ ] **Step 2: Update submenu content props**

Update both `<DropdownMenu.SubContent>` instances to include the same collision padding:

```tsx
                  <DropdownMenu.SubContent
                    className={styles["preset-menu-content"]}
                    sideOffset={2}
                    alignOffset={-4}
                    collisionPadding={{
                      top: 8,
                      right: 8,
                      bottom: 8,
                      left: 8,
                    }}
                  >
```

- [ ] **Step 3: Update DropdownMenu content height CSS**

In `src/components/PresetMenu/PresetMenu.module.css`, ensure `.preset-menu-content` includes:

```css
  max-height: min(
    var(--radix-dropdown-menu-content-available-height, 60vh),
    calc(100dvh - var(--mobile-bottom-nav-safe-zone, 0px) - 1rem),
    480px
  );
  overflow-y: auto;
```

- [ ] **Step 4: Run PresetMenu tests**

Run: `pnpm test src/components/PresetMenu/PresetMenu.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PresetMenu/PresetMenu.tsx src/components/PresetMenu/PresetMenu.module.css
git commit -m "fix(mobile): constrain preset menu height"
```

### Task 4: Add Mobile Dropdown Geometry Regression

**Files:**
- Modify: `e2e/responsive.spec.ts`

- [ ] **Step 1: Add a helper for dropdown geometry**

Near the existing helpers in `e2e/responsive.spec.ts`, add:

```ts
async function expectOpenMenuAboveBottomTabs(page: Page, viewportName: string) {
  const metrics = await page.evaluate(() => {
    const menu = document.querySelector('[role="listbox"], [role="menu"]');
    const tabList = document.querySelector('[role="tablist"][aria-label="Inspector"]');
    const getRect = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
      };
    };
    return {
      menu: getRect(menu),
      tabList: getRect(tabList),
      innerHeight: window.innerHeight,
    };
  });

  expect(metrics.menu, viewportName).not.toBeNull();
  expect(metrics.tabList, viewportName).not.toBeNull();
  expect(metrics.menu!.height, viewportName).toBeGreaterThan(44);
  expect(metrics.menu!.bottom, viewportName).toBeLessThanOrEqual(metrics.tabList!.top - 4);
}
```

- [ ] **Step 2: Add the mobile Overlay dropdown test**

Inside `test.describe("responsive layout regressions", () => { ... })`, add:

```ts
  test("keeps Overlay voicing dropdown above bottom tabs on mobile", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844, name: "390x844" },
      { width: 375, height: 667, name: "375x667" },
    ]) {
      await gotoApp(page, viewport.width, viewport.height);
      await page.getByRole("tab", { name: "Overlay" }).click();

      const voicing = page.getByRole("combobox", { name: "Voicing" });
      await expect(voicing, viewport.name).toBeVisible();
      await voicing.click();

      await expectOpenMenuAboveBottomTabs(page, viewport.name);
    }
  });
```

- [ ] **Step 3: Run the focused e2e test**

Run: `pnpm run test:e2e -- e2e/responsive.spec.ts -g "keeps Overlay voicing dropdown above bottom tabs on mobile"`

Expected: PASS.

- [ ] **Step 4: Run mobile visual checks**

Run: `pnpm run test:visual -- e2e/chord-overlay-controls.visual.spec.ts e2e/app-mobile.visual.spec.ts`

Expected: PASS, or intentional snapshot diffs limited to dropdown-safe layout changes.

- [ ] **Step 5: Commit**

```bash
git add e2e/responsive.spec.ts
git commit -m "test(mobile): cover dropdown bottom safe zone"
```

