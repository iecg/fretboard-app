import { expect, test, type Page } from "@playwright/test";

async function gotoApp(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

  // Wait for the Inspector controls panel to mount.
  await expect(
    page.getByRole("tablist", { name: "Inspector" }),
  ).toBeVisible();
}

async function expectNoVerticalOverlap(
  page: Page,
  firstSelector: string,
  secondSelector: string,
  label: string,
) {
  const rects = await page.evaluate(
    ({ firstSelector, secondSelector }) => {
      const getRect = (selector: string) => {
        const el = document.querySelector(selector);
        if (!(el instanceof HTMLElement)) return null;
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      };
      return {
        first: getRect(firstSelector),
        second: getRect(secondSelector),
      };
    },
    { firstSelector, secondSelector },
  );

  expect(rects.first, `${label}: first element (${firstSelector})`).not.toBeNull();
  expect(rects.second, `${label}: second element (${secondSelector})`).not.toBeNull();
  expect(
    rects.first!.bottom,
    `${label}: first.bottom should sit above second.top`,
  ).toBeLessThanOrEqual(rects.second!.top + 1);
}

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

async function getMetrics(page: Page) {
  return page.evaluate(() => {
    const app = document.querySelector('[data-testid="app-container"]');
    const badge = document.querySelector('[data-testid="version-badge"]');
    const badgeRect = badge?.getBoundingClientRect();
    const toolbar = document.querySelector('[data-testid="fretboard-outer"]');
    const title = document.querySelector('[data-testid="app-header-brand"]');
    const actions = document.querySelector('[data-testid="app-header-actions"]');
    const header = document.querySelector('[data-testid="app-header"]');
    const transport = document.querySelector('[data-testid="app-header-transport"]');
    const transportCluster = document.querySelector('[data-testid="header-transport-cluster"]');
    const settingsDrawer = document.querySelector('[data-testid="settings-drawer"]');
    const helpModal = document.querySelector('[data-testid="help-modal"]');
    const helpContent = document.querySelector('[data-testid="help-modal-content"]');
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
      headerRect: getRect(header),
      transportRect: getRect(transport),
      transportClusterRect: getRect(transportCluster),
      settingsDrawerRect: getRect(settingsDrawer),
      helpModalRect: getRect(helpModal),
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

  test("keeps mobile header actions and transport within the viewport", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 375, height: 667 },
    ]) {
      const name = `${viewport.width}x${viewport.height}`;
      await gotoApp(page, viewport.width, viewport.height);

      const metrics = await getMetrics(page);
      expect(metrics.headerRect, name).not.toBeNull();
      expect(metrics.titleRect, name).not.toBeNull();
      expect(metrics.actionsRect, name).not.toBeNull();
      expect(metrics.transportRect, name).not.toBeNull();
      expect(metrics.transportClusterRect, name).not.toBeNull();

      expect(metrics.actionsRect!.right, name).toBeLessThanOrEqual(viewport.width);
      expect(metrics.transportClusterRect!.right, name).toBeLessThanOrEqual(
        viewport.width,
      );
      expect(metrics.headerRect!.height, name).toBeLessThanOrEqual(176);
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

    // Tablet-split renders the Inspector rather than a side-by-side
    // controls/key split. Verify the fretboard and Inspector are visible
    // without horizontal overflow.
    await expect(page.locator('[data-testid="fretboard-outer"]')).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Inspector" })).toBeVisible();
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

    // v2.0: Key group (Root + Scale) moved to the Song tab. CoF retired.
    // E1: Root note is now a LabeledSelect combobox (label="Root"), not a button group.
    await page.getByRole("tab", { name: "Song" }).click();
    const rootCombobox = page.getByRole("combobox", { name: /^Root$/i });
    await expect(rootCombobox).toBeVisible();
    await rootCombobox.scrollIntoViewIfNeeded();
    const after = await getMetrics(page);
    // The key group panel (tabpanel) should be comfortably within the viewport.
    expect(after.keyColumnRect).not.toBeNull();
    expect(after.keyColumnRect!.bottom).toBeLessThanOrEqual(768 + 10); // 10px tolerance
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

  test("keeps mobile fretboard paint inside the viewport width", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 375, height: 667 },
    ]) {
      const name = `${viewport.width}x${viewport.height}`;
      await gotoApp(page, viewport.width, viewport.height);

      const metrics = await page.evaluate(() => {
        const getRect = (selector: string) => {
          const el = document.querySelector(selector);
          if (!(el instanceof HTMLElement || el instanceof SVGElement)) return null;
          const rect = el.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        };
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          outer: getRect('[data-testid="fretboard-outer"]'),
          wrapper: getRect('[class*="fretboard-wrapper"]'),
        };
      });

      expect(metrics.scrollWidth, name).toBeLessThanOrEqual(metrics.innerWidth);
      expect(metrics.outer, name).not.toBeNull();
      expect(metrics.wrapper, name).not.toBeNull();
      expect(metrics.outer!.right, name).toBeLessThanOrEqual(viewport.width);
      expect(metrics.wrapper!.right, name).toBeLessThanOrEqual(viewport.width);
    }
  });

  test("keeps mobile progression chord list and editor from overlapping", async ({ page }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("tab", { name: "Song" }).click();

    // The chord list <ul> carries the "Progression navigation" accessible name;
    // it only renders once a step is active (the default progression has steps).
    const chordList = page.getByRole("list", { name: "Progression navigation" });
    await expect(chordList).toBeVisible();

    const editorPanel = page.locator('[class*="editor-panel"]').first();
    await editorPanel.scrollIntoViewIfNeeded();
    await expect(editorPanel).toBeVisible();

    await expectNoVerticalOverlap(
      page,
      '[aria-label="Progression navigation"]',
      '[class*="editor-panel"]',
      "mobile progression editor",
    );
  });

  test("shows the full mobile chord list without an inner scroll", async ({ page }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("tab", { name: "Song" }).click();

    const list = page.locator('[aria-label="Progression navigation"]');
    await expect(list).toBeVisible();

    const overflow = await list.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(overflow.scrollHeight, "list inner scroll").toBeLessThanOrEqual(
      overflow.clientHeight + 1,
    );
  });

  test("keeps the mobile preset menu within the viewport width", async ({ page }) => {
    await gotoApp(page, 390, 844);
    await page.getByRole("tab", { name: "Song" }).click();

    // The PresetMenu trigger's accessible name is the translated
    // `inspector.progressionLabel` ("Sequence"), not "preset".
    await page.getByRole("button", { name: /sequence/i }).first().click();

    const menu = page.getByRole("menu").first();
    await expect(menu).toBeVisible();

    const rect = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    });
    expect(rect.left, "menu left").toBeGreaterThanOrEqual(0);
    expect(rect.right, "menu right").toBeLessThanOrEqual(390);
  });

  test("keeps the active timeline chord in view after selecting a late chord on mobile", async ({ page }) => {
    await gotoApp(page, 390, 844);

    const track = page.getByRole("group", { name: "Progression track" });
    await expect(track).toBeVisible();

    const blocks = track.getByRole("button");
    const count = await blocks.count();
    // Guards the in-view invariant for whatever progression is loaded. No
    // reusable seeding mechanism exists in this spec, so this exercises the
    // auto-scroll only if the default progression overflows the 390px track;
    // otherwise it still asserts the last block stays within the viewport.
    await blocks.nth(count - 1).click();

    const inView = await track.evaluate((el) => {
      const active = el.querySelector('[data-active="true"]');
      if (!active) return false;
      const c = el.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      return a.left >= c.left - 1 && a.right <= c.right + 1;
    });
    expect(inView, "active block within track viewport").toBe(true);
  });
});
