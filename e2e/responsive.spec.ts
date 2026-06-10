import { expect, test, type Page } from "@playwright/test";
import { loadVisualState, openSettings } from "./visual-helpers";

/**
 * Navigates to the app and waits for whichever shell root mounts.
 *
 * Desktop/tablet-stacked render the `app-container`; mobile and tablet-split
 * render the `mobile-shell` (the vaul bottom-sheet shell). The Inspector
 * tablist lives inside the sheet on mobile and is below the fold at the
 * default "peek" snap, so it is only awaited on the desktop `app-container`
 * path — mobile callers wait for whatever they actually need.
 */
async function gotoApp(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.locator('[data-testid="app-container"], [data-testid="mobile-shell"]'),
  ).toBeVisible();

  // The desktop controls panel mounts the Inspector tablist inline; on mobile
  // the tablist is inside the (collapsed) sheet, so only gate on it for the
  // desktop shell.
  if ((await page.locator('[data-testid="app-container"]').count()) > 0) {
    await expect(
      page.getByRole("tablist", { name: "Inspector" }),
    ).toBeVisible();
  }
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

/**
 * The legacy fixed bottom tab bar is gone — the bottom surface is now the vaul
 * sheet. An open dropdown/listbox must therefore stay within the viewport: its
 * bottom edge must not run past the viewport's bottom and it must be a real,
 * usable menu (taller than a single touch target).
 */
async function expectOpenMenuWithinViewport(page: Page, viewportName: string) {
  const metrics = await page.evaluate(() => {
    const menu = document.querySelector('[role="listbox"], [role="menu"]');
    const getRect = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        height: Math.round(rect.height),
      };
    };
    return {
      menu: getRect(menu),
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    };
  });

  expect(metrics.menu, viewportName).not.toBeNull();
  expect(metrics.menu!.height, viewportName).toBeGreaterThan(44);
  expect(metrics.menu!.bottom, viewportName).toBeLessThanOrEqual(
    metrics.innerHeight + 1,
  );
  expect(metrics.menu!.top, viewportName).toBeGreaterThanOrEqual(-1);
  expect(metrics.menu!.right, viewportName).toBeLessThanOrEqual(
    metrics.innerWidth + 1,
  );
  expect(metrics.menu!.left, viewportName).toBeGreaterThanOrEqual(-1);
}

async function getMetrics(page: Page) {
  return page.evaluate(() => {
    // Tier/variant data attributes live on `app-container` (desktop) or
    // `mobile-shell` (mobile / tablet-split). Read from whichever exists.
    const app =
      document.querySelector('[data-testid="app-container"]') ??
      document.querySelector('[data-testid="mobile-shell"]');
    const badge = document.querySelector('[data-testid="version-badge"]');
    const badgeRect = badge?.getBoundingClientRect();
    const toolbar = document.querySelector('[data-testid="fretboard-outer"]');
    const title = document.querySelector('[data-testid="app-header-brand"]');
    const actions = document.querySelector('[data-testid="app-header-actions"]');
    const header = document.querySelector('[data-testid="app-header"]');
    const transport = document.querySelector('[data-testid="app-header-transport"]');
    const transportCluster = document.querySelector('[data-testid="header-transport-cluster"]');
    const settingsDrawer = document.querySelector('[data-testid="settings-drawer"]');
    // Mobile/tablet-split present Settings/Help as a vaul adaptive sheet
    // (portaled to <body>) instead of the desktop drawer.
    const adaptiveSheet = document.querySelector('[data-testid="adaptive-modal-sheet"]');
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
      adaptiveSheetRect: getRect(adaptiveSheet),
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

      // Version badge now lives inside the settings overlay, which opens on
      // mobile as a vaul adaptive sheet via the header overflow menu. Open it
      // and verify the footer (version badge) is reachable within the viewport.
      await openSettings(page);
      await expect(
        page.locator('[data-testid="adaptive-modal-sheet"]'),
      ).toBeVisible();
      await page.locator('[data-testid="version-badge"]').scrollIntoViewIfNeeded();

      const after = await getMetrics(page);
      expect(after.badgeBottom, viewport.name).not.toBeNull();
      expect(after.badgeBottom!, viewport.name).toBeLessThanOrEqual(
        viewport.height,
      );
      // The compact mobile header still shares a single row between brand and
      // actions.
      expect(after.titleRect).not.toBeNull();
      expect(after.actionsRect).not.toBeNull();
      const headerSharesRow =
        after.titleRect!.bottom > after.actionsRect!.top &&
        after.actionsRect!.bottom > after.titleRect!.top;
      expect(headerSharesRow, viewport.name).toBe(true);
    }
  });

  test("keeps mobile header actions and peek transport within the viewport", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 375, height: 667 },
    ]) {
      const name = `${viewport.width}x${viewport.height}`;
      await gotoApp(page, viewport.width, viewport.height);

      const metrics = await getMetrics(page);
      // The mobile header is compact: brand + a single overflow trigger, no
      // inline transport cluster (transport moved into the sheet peek).
      expect(metrics.headerRect, name).not.toBeNull();
      expect(metrics.titleRect, name).not.toBeNull();
      expect(metrics.actionsRect, name).not.toBeNull();

      const overflowRect = await page
        .getByTestId("header-overflow-trigger")
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { right: Math.round(r.right), bottom: Math.round(r.bottom) };
        });
      expect(overflowRect.right, name).toBeLessThanOrEqual(viewport.width);
      expect(metrics.actionsRect!.right, name).toBeLessThanOrEqual(viewport.width);
      // Compact header stays within a sane bound.
      expect(metrics.headerRect!.height, name).toBeLessThanOrEqual(96);

      // Transport is now the peek mini-player at the bottom sheet's top edge —
      // assert it (and its play button) stay within the viewport.
      const peek = page.getByTestId("peek-transport");
      await expect(peek, name).toBeVisible();
      const peekRect = await peek.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: Math.round(r.left),
          right: Math.round(r.right),
          bottom: Math.round(r.bottom),
        };
      });
      expect(peekRect.left, name).toBeGreaterThanOrEqual(0);
      expect(peekRect.right, name).toBeLessThanOrEqual(viewport.width);
      expect(peekRect.bottom, name).toBeLessThanOrEqual(viewport.height + 1);

      await expect(page.getByTestId("peek-play"), name).toBeVisible();
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

  test("keeps tablet split layout and settings sheet from crowding the layout", async ({
    page,
  }) => {
    await gotoApp(page, 768, 1024);

    const initial = await getMetrics(page);
    // Tablet-split renders the MobileShell sheet shell — tier reads from the
    // shell root.
    expect(initial.tier).toBe("tablet");
    expect(initial.variant).toBe("tablet-split");

    // Tablet-split renders the fretboard stage; the Inspector lives in the
    // bottom sheet. Verify the fretboard is visible without horizontal overflow.
    await expect(page.locator('[data-testid="fretboard-outer"]')).toBeVisible();
    expect(initial.scrollWidth).toBeLessThanOrEqual(initial.innerWidth);

    // The header presents the overflow menu (compact actions) at tablet-split.
    expect(initial.headerActionsMode).toBe("compact");

    // Settings opens from the header overflow menu. Tablet-split is a touch
    // shell (useSheetShell), so Settings presents as the full-height adaptive
    // sheet — matching the header + main shell — NOT the desktop side drawer.
    // Open it via the overflow menu and verify the sheet sits within the
    // viewport without crowding the layout.
    await page.getByTestId("header-overflow-trigger").click();
    await page.getByRole("menuitem", { name: /^Settings$/ }).click();
    await expect(page.getByTestId("adaptive-modal-sheet")).toBeVisible();
    await expect(page.getByTestId("settings-drawer")).toHaveCount(0);

    const withSettings = await getMetrics(page);
    expect(withSettings.adaptiveSheetRect).not.toBeNull();
    // The sheet spans the viewport width without horizontal overflow — unlike
    // the legacy slide-from-right drawer, which extended past the 768px
    // viewport. (The sheet's content box scrolls internally, so its bottom
    // edge can exceed the fold; the invariant here is horizontal fit + anchor.)
    expect(withSettings.adaptiveSheetRect!.left).toBeGreaterThanOrEqual(-1);
    expect(withSettings.adaptiveSheetRect!.right).toBeLessThanOrEqual(
      withSettings.innerWidth + 1,
    );
    expect(withSettings.adaptiveSheetRect!.width).toBeLessThanOrEqual(
      withSettings.innerWidth + 1,
    );
    // The sheet is anchored within the viewport (top edge on-screen).
    expect(withSettings.adaptiveSheetRect!.top).toBeLessThanOrEqual(1024);
    // The sheet must not introduce a horizontal scrollbar on the page.
    expect(withSettings.scrollWidth).toBeLessThanOrEqual(withSettings.innerWidth);
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

  test("opens settings as a bottom sheet that fits the viewport on narrow phones", async ({
    page,
  }) => {
    // The legacy full-width settings drawer is gone; mobile settings present as
    // a vaul bottom sheet. It must fit within the viewport width with no
    // horizontal overflow.
    await gotoApp(page, 390, 844);
    await openSettings(page);

    const metrics = await getMetrics(page);
    expect(metrics.adaptiveSheetRect).not.toBeNull();
    expect(metrics.adaptiveSheetRect!.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.adaptiveSheetRect!.right).toBeLessThanOrEqual(390 + 1);
    expect(metrics.adaptiveSheetRect!.width).toBeLessThanOrEqual(390 + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  });

  test("keeps the Overlay voicing dropdown within the viewport on mobile", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844, name: "390x844" },
      { width: 375, height: 667, name: "375x667" },
    ]) {
      // Seed the sheet open at "full" so the Inspector tabs + Overlay controls
      // are above the fold and interactive.
      await loadVisualState(page, { mobileSheetSnap: "full" }, viewport);

      await page.getByRole("tab", { name: "Overlay" }).click();

      const voicing = page.getByRole("combobox", { name: "Voicing" });
      await expect(voicing, viewport.name).toBeVisible();
      await voicing.click();

      // No bottom tab bar anymore — the open dropdown must simply stay within
      // the viewport (not overflow the bottom or side edges).
      await expectOpenMenuWithinViewport(page, viewport.name);
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
    // Seed an 8-chord progression. The overlap only manifests when the chord
    // list is taller than the list column's flex-basis, so the default 4-chord
    // progression passes this guard vacuously — a long list is required to
    // actually exercise the stacked master-detail layout.
    await loadVisualState(
      page,
      {
        // Seed the sheet open at "full" so the Song tab content is above the
        // fold and reachable inside the bottom sheet.
        mobileSheetSnap: "full",
        progressionSteps: [
          { id: "s1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s2", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s3", degree: "iii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s5", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s6", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s7", degree: "vii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s8", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 390, height: 844 },
    );

    await expect(page.getByRole("tablist", { name: "Inspector" })).toBeVisible();
    await page.getByRole("tab", { name: "Song" }).click();

    // The chord list <ul> carries the "Progression navigation" accessible name;
    // it only renders once a step is active (the seeded progression has steps).
    const chordList = page.getByRole("list", { name: "Progression navigation" });
    await expect(chordList).toBeVisible();

    const editorPanel = page.locator('[class*="editor-panel"]').first();
    await expect(editorPanel).toBeVisible();

    await expectNoVerticalOverlap(
      page,
      '[aria-label="Progression navigation"]',
      '[class*="editor-panel"]',
      "mobile progression editor (long progression)",
    );
  });

  test("shows the full mobile chord list without an inner scroll", async ({ page }) => {
    // Seed a long (8-chord) progression so the list is taller than the column —
    // the default progression fits and would let this guard pass vacuously.
    await loadVisualState(
      page,
      {
        // Seed the sheet open at "full" so the Song tab content is reachable.
        mobileSheetSnap: "full",
        progressionSteps: [
          { id: "s1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s2", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s3", degree: "iii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s5", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s6", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s7", degree: "vii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s8", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 390, height: 844 },
    );

    await expect(page.getByRole("tablist", { name: "Inspector" })).toBeVisible();
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
    // Overflow risk is higher on the narrower 375px phone, so cover both.
    for (const viewport of [
      { width: 390, height: 844, name: "390x844" },
      { width: 375, height: 667, name: "375x667" },
    ]) {
      // Seed the sheet open at "full" so the Song tab + preset menu trigger are
      // above the fold.
      await loadVisualState(page, { mobileSheetSnap: "full" }, viewport);
      await page.getByRole("tab", { name: "Song" }).click();

      // The PresetMenu trigger's accessible name is the translated
      // `inspector.progressionLabel` ("Sequence"), not "preset".
      await page.getByRole("button", { name: /sequence/i }).first().click();

      // Only the preset DropdownMenu is open here, so the lone open role="menu"
      // is its content; `.first()` guards against any transient duplicate during
      // the open animation.
      const menu = page.getByRole("menu").first();
      await expect(menu).toBeVisible();

      const rect = await menu.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right) };
      });
      expect(rect.left, `${viewport.name} menu left`).toBeGreaterThanOrEqual(0);
      expect(rect.right, `${viewport.name} menu right`).toBeLessThanOrEqual(viewport.width);
    }
  });
});
