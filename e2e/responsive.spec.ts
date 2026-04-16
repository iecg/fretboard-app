import { expect, test, type Page } from "@playwright/test";

const CIRCLE_OF_FIFTHS_SELECTOR =
  '.key-column [role="group"][aria-label="Circle of Fifths — select a key"]';

async function gotoApp(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".app-container")).toBeVisible();
}

async function getMetrics(page: Page) {
  return page.evaluate((circleSelector) => {
    const app = document.querySelector(".app-container");
    const badge = document.querySelector(".version-badge");
    const badgeRect = badge?.getBoundingClientRect();
    const toolbar = document.querySelector(".fretboard-toolbar");
    const title = document.querySelector(".title-container");
    const actions = document.querySelector(".header-actions");
    const settingsDrawer = document.querySelector(".settings-overlay-drawer");
    const helpModal = document.querySelector(".help-modal");
    const helpContent = document.querySelector(".help-modal-content");
    const circle = document.querySelector(circleSelector);
    const controlsColumn = document.querySelector(".controls-panel-column");
    const keyColumn = document.querySelector(".key-column");

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

    return {
      tier: app?.getAttribute("data-layout-tier"),
      variant: app?.getAttribute("data-layout-variant"),
      headerSubtitle: app?.getAttribute("data-header-subtitle"),
      headerActionsMode: app?.getAttribute("data-header-actions"),
      fullWidthOverlay: app?.getAttribute("data-full-width-overlay"),
      summaryCount: document.querySelectorAll(".summary-area").length,
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

function toolbarButton(page: Page, name: string) {
  return page.locator(".fretboard-toolbar").getByRole("button", {
    name,
    exact: true,
  });
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

      await page.locator(".version-badge").scrollIntoViewIfNeeded();

      const after = await getMetrics(page);
      expect(after.badgeBottom, viewport.name).not.toBeNull();
      expect(after.badgeBottom!, viewport.name).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(after.scrollHeight, viewport.name).toBeGreaterThanOrEqual(
        after.innerHeight,
      );
      expect(after.titleRect).not.toBeNull();
      expect(after.actionsRect).not.toBeNull();
      const headerSharesRow =
        after.titleRect!.bottom > after.actionsRect!.top &&
        after.actionsRect!.bottom > after.titleRect!.top;
      expect(headerSharesRow, viewport.name).toBe(true);
    }
  });

  test("keeps landscape mobile overlays usable without stealing the fretboard", async ({
    page,
  }) => {
    await gotoApp(page, 667, 375);

    const initial = await getMetrics(page);
    expect(initial.tier).toBe("mobile");
    expect(initial.variant).toBe("landscape-mobile");
    expect(initial.summaryCount).toBe(0);
    await expect(page.locator(".main-fretboard")).toBeVisible();
    await expect(page.locator(".mobile-tab-content")).toHaveCount(0);

    await page.getByRole("button", { name: "Open help" }).click();
    const withHelp = await getMetrics(page);
    expect(withHelp.helpModalRect).not.toBeNull();
    expect(withHelp.helpModalRect!.left).toBeGreaterThanOrEqual(0);
    expect(withHelp.helpModalRect!.top).toBeGreaterThanOrEqual(0);
    expect(withHelp.helpModalRect!.right).toBeLessThanOrEqual(667);
    expect(withHelp.helpModalRect!.bottom).toBeLessThanOrEqual(375);
    expect(withHelp.helpContent).not.toBeNull();
    expect(withHelp.helpContent!.overflowY).toBe("auto");
    expect(withHelp.helpContent!.scrollHeight).toBeGreaterThan(
      withHelp.helpContent!.clientHeight,
    );

    await page.getByRole("button", { name: "Close help" }).click();
    await page.getByRole("button", { name: "Open settings" }).click();
    const withSettings = await getMetrics(page);
    expect(withSettings.settingsDrawerRect).not.toBeNull();
    expect(withSettings.settingsDrawerRect!.width).toBeGreaterThanOrEqual(665);
    expect(withSettings.scrollWidth).toBeLessThanOrEqual(withSettings.innerWidth);
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

      await page.locator(".version-badge").scrollIntoViewIfNeeded();

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
    expect(initial.controlsColumnRect).not.toBeNull();
    expect(initial.keyColumnRect).not.toBeNull();

    const panelIsSplit =
      initial.controlsColumnRect!.right < initial.keyColumnRect!.left &&
      Math.abs(initial.controlsColumnRect!.top - initial.keyColumnRect!.top) <
        24;
    expect(panelIsSplit).toBe(true);

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
    await expect(toolbarButton(page, "Open")).toBeVisible();
    await expect(toolbarButton(page, "Mid")).toBeVisible();
    await expect(toolbarButton(page, "High")).toBeVisible();
  });

  test("keeps the quick-jump toolbar on tablet and desktop layouts", async ({ page }) => {
    await gotoApp(page, 768, 1024);
    expect((await getMetrics(page)).variant).toBe("tablet-split");
    await expect(page.locator(".fretboard-toolbar")).toBeVisible();
    await expect(toolbarButton(page, "Open")).toBeVisible();

    await gotoApp(page, 1024, 768);
    expect((await getMetrics(page)).variant).toBe("desktop-stacked");
    await expect(page.locator(".fretboard-toolbar")).toBeVisible();
    await expect(toolbarButton(page, "High")).toBeVisible();
  });

  test("keeps desktop stacked key content and summary comfortably reachable", async ({
    page,
  }) => {
    await gotoApp(page, 1024, 768);

    const initial = await getMetrics(page);
    expect(initial.variant).toBe("desktop-stacked");
    expect(initial.summaryCount).toBe(1);

    await page.locator(CIRCLE_OF_FIFTHS_SELECTOR).scrollIntoViewIfNeeded();
    const after = await getMetrics(page);
    expect(after.circleRect).not.toBeNull();
    expect(after.circleRect!.height).toBeGreaterThanOrEqual(220);
    expect(after.circleRect!.height).toBeLessThanOrEqual(430);
    expect(after.circleRect!.bottom).toBeLessThanOrEqual(768);
  });

  test("uses a full-width settings drawer on narrow portrait phones", async ({
    page,
  }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("button", { name: "Open settings" }).click();

    const metrics = await getMetrics(page);
    expect(metrics.fullWidthOverlay).toBe("true");
    expect(metrics.settingsDrawerRect).not.toBeNull();
    expect(metrics.settingsDrawerRect!.width).toBeGreaterThanOrEqual(388);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  });
});
