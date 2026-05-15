import { expect, test, type Page } from "@playwright/test";

const CIRCLE_OF_FIFTHS_SELECTOR =
  '[data-testid="circle-of-fifths-svg"]';

async function gotoApp(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

  const container = page.locator('[data-testid="app-container"]');
  const tier = await container.getAttribute("data-layout-tier");
  const variant = await container.getAttribute("data-layout-variant");

  // Layouts that use the mobile tab panel: mobile + tablet-split.
  const usesMobileTabs =
    tier === "mobile" || variant === "tablet-split";

  if (usesMobileTabs) {
    // Wait for the lazy-loaded mobile tab content to mount before continuing.
    await expect(page.locator('[data-testid="mobile-tab-content"]')).toBeVisible();
  } else {
    // Wait for the Inspector controls panel to mount on tablet/desktop layouts.
    await expect(
      page.getByRole("tablist", { name: "Inspector" }),
    ).toBeVisible();
  }
}

async function getMetrics(page: Page) {
  return page.evaluate((circleSelector) => {
    const app = document.querySelector('[data-testid="app-container"]');
    const badge = document.querySelector('[data-testid="version-badge"]');
    const badgeRect = badge?.getBoundingClientRect();
    const toolbar = document.querySelector('[data-testid="fretboard-outer"]');
    const title = document.querySelector('[data-testid="app-header-brand"]');
    const actions = document.querySelector('[data-testid="app-header-actions"]');
    const settingsDrawer = document.querySelector('[data-testid="settings-drawer"]');
    const helpModal = document.querySelector('[data-testid="help-modal"]');
    const helpContent = document.querySelector('[data-testid="help-modal-content"]');
    const circle = document.querySelector(circleSelector);
    // The desktop controls panel is the Inspector (Radix Tabs); its tablist
    // is the stable container hook now that .dashboard-card columns are gone.
    const controlsColumn = document.querySelector('[role="tablist"][aria-label="Inspector"]');
    const keyColumn = document.querySelector('[role="tabpanel"]');

    const subtitle = document.querySelector('[data-testid="app-header-brand-subtitle"]');
    const kofiDesktop = document.querySelector('[data-testid="kofi-btn-desktop"]');

    const getRect = (element: Element | null) => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const settingsRect = getRect(settingsDrawer);

    return {
      tier: app?.getAttribute("data-layout-tier"),
      variant: app?.getAttribute("data-layout-variant"),
      headerSubtitle: subtitle ? getComputedStyle(subtitle).display === "none" ? "hidden" : "visible" : "hidden",
      headerActionsMode: kofiDesktop ? getComputedStyle(kofiDesktop).display === "none" ? "compact" : "default" : "compact",
      isFullWidthSettings: settingsRect ? Math.abs(settingsRect.width - window.innerWidth) < 5 : false,
      summaryCount: document.querySelectorAll('[data-testid="summary-shell"]').length,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      scrollY: window.scrollY,
      badgeBottom: badgeRect ? Math.round(badgeRect.bottom) : null,
      badgeTop: badgeRect ? Math.round(badgeRect.top) : null,
      toolbarDisplay: toolbar ? getComputedStyle(toolbar).display : null,
      titleRect: getRect(title),
      actionsRect: getRect(actions),
      settingsDrawerRect: getRect(settingsDrawer),
      helpModalRect: getRect(helpModal),
      circleRect: getRect(circle),
      controlsColumnRect: getRect(controlsColumn),
      keyColumnRect: getRect(keyColumn),
      helpContent:
        helpContent instanceof HTMLElement
          ? {
              clientHeight: helpContent.clientHeight,
              scrollHeight: helpContent.scrollHeight,
              overflowY: getComputedStyle(helpContent).overflowY,
            }
          : null,
    };
  }, CIRCLE_OF_FIFTHS_SELECTOR);
}


test.describe("responsive layout regressions", () => {
  test("keeps the footer reachable on small portrait phones", async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 667, name: "iPhone SE portrait" },
      { width: 390, height: 844, name: "iPhone 12 Pro portrait" },
    ]) {
      await gotoApp(page, viewport.width, viewport.height);

      const before = await getMetrics(page);
      expect(before.tier, viewport.name).toBe("mobile");
      expect(before.variant, viewport.name).toBe("mobile");
      expect(before.summaryCount, viewport.name).toBe(1);

      // Version badge now lives inside the settings overlay; open it before
      // verifying the footer is reachable.
      await page.getByRole("button", { name: "Open settings" }).click();
      await page.locator('[data-testid="version-badge"]').scrollIntoViewIfNeeded();

      const after = await getMetrics(page);
      expect(after.badgeBottom, viewport.name).not.toBeNull();
      expect(after.badgeBottom!, viewport.name).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(after.titleRect).not.toBeNull();
      expect(after.actionsRect).not.toBeNull();
      const headerSharesRow =
        after.titleRect!.bottom > after.actionsRect!.top &&
        after.actionsRect!.bottom > after.titleRect!.top;
      expect(headerSharesRow, viewport.name).toBe(true);
    }
  });

  test("reflows compact desktop layouts instead of clipping them", async ({ page }) => {
    for (const viewport of [
      { width: 1200, height: 600 },
      { width: 1200, height: 720 },
    ]) {
      await gotoApp(page, viewport.width, viewport.height);

      const before = await getMetrics(page);
      expect(before.tier).toBe("desktop");
      expect(before.variant).toBe("desktop-stacked");
      expect(before.summaryCount).toBe(1);
      expect(before.toolbarDisplay).toBe("flex");

      // Version badge moved into the settings overlay — open it before
      // verifying the footer remains reachable inside the viewport.
      await page.getByRole("button", { name: "Open settings" }).click();
      await page.locator('[data-testid="version-badge"]').scrollIntoViewIfNeeded();

      const after = await getMetrics(page);
      expect(after.badgeBottom).not.toBeNull();
      expect(after.badgeBottom!).toBeLessThanOrEqual(viewport.height);
    }
  });

  test("keeps tablet split layout and settings drawer from crowding the layout", async ({
    page,
  }) => {
    await gotoApp(page, 768, 1024);

    const initial = await getMetrics(page);
    expect(initial.tier).toBe("tablet");
    expect(initial.variant).toBe("tablet-split");
    expect(initial.headerActionsMode).toBe("compact");
    expect(initial.headerSubtitle).toBe("hidden");

    // Tablet-split now renders the mobile tab panel rather than a side-by-side
    // controls/key split. Verify the fretboard and tab content are visible
    // without horizontal overflow.
    await expect(page.locator('[data-testid="fretboard-outer"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-tab-content"]')).toBeVisible();
    expect(initial.scrollWidth).toBeLessThanOrEqual(initial.innerWidth);

    await page.getByRole("button", { name: "Open settings" }).click();
    const withSettings = await getMetrics(page);
    expect(withSettings.settingsDrawerRect).not.toBeNull();
    expect(withSettings.settingsDrawerRect!.width).toBeGreaterThanOrEqual(320);
    expect(withSettings.settingsDrawerRect!.width).toBeLessThanOrEqual(420);
    expect(withSettings.settingsDrawerRect!.bottom).toBeLessThanOrEqual(1024);
  });

  test("keeps 1024x1366 in the desktop split layout", async ({ page }) => {
    await gotoApp(page, 1024, 1366);

    const metrics = await getMetrics(page);
    expect(metrics.tier).toBe("desktop");
    expect(metrics.variant).toBe("desktop-split");
    expect(metrics.summaryCount).toBe(1);
    await expect(page.locator('[data-testid="fretboard-outer"]')).toBeVisible();
  });

  test("keeps the fretboard visible on tablet and desktop layouts", async ({ page }) => {
    await gotoApp(page, 768, 1024);
    expect((await getMetrics(page)).variant).toBe("tablet-split");
    await expect(page.locator('[data-testid="fretboard-outer"]')).toBeVisible();

    await gotoApp(page, 1024, 768);
    expect((await getMetrics(page)).variant).toBe("desktop-stacked");
    await expect(page.locator('[data-testid="fretboard-outer"]')).toBeVisible();
  });

  test("keeps desktop stacked key content and summary comfortably reachable", async ({
    page,
  }) => {
    await gotoApp(page, 1024, 768);

    const initial = await getMetrics(page);
    expect(initial.variant).toBe("desktop-stacked");
    expect(initial.summaryCount).toBe(1);

    // The Circle of Fifths now lives in the Inspector's Scale tab.
    await page.getByRole("tab", { name: "Scale" }).click();
    await page.locator(CIRCLE_OF_FIFTHS_SELECTOR).waitFor({ state: "visible" });
    await page.locator(CIRCLE_OF_FIFTHS_SELECTOR).scrollIntoViewIfNeeded();
    const after = await getMetrics(page);
    expect(after.circleRect).not.toBeNull();
    expect(after.circleRect!.height).toBeGreaterThanOrEqual(220);
    // Inside the Inspector Scale tab the Circle renders slightly larger than in
    // the legacy key-column layout — widen the upper bound accordingly.
    expect(after.circleRect!.height).toBeLessThanOrEqual(480);
    expect(after.circleRect!.bottom).toBeLessThanOrEqual(768);
  });

  test("uses a full-width settings drawer on narrow portrait phones", async ({
    page,
  }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("button", { name: "Open settings" }).click();

    const metrics = await getMetrics(page);
    expect(metrics.isFullWidthSettings).toBe(true);
    expect(metrics.settingsDrawerRect).not.toBeNull();
    expect(metrics.settingsDrawerRect!.width).toBeGreaterThanOrEqual(388);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  });
});
