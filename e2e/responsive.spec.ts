import { expect, test, type Page } from "@playwright/test";

async function gotoApp(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".app-container")).toBeVisible();
}

async function getMetrics(page: Page) {
  return page.evaluate(() => {
    const app = document.querySelector(".app-container");
    const badge = document.querySelector(".version-badge");
    const badgeRect = badge?.getBoundingClientRect();
    const toolbar = document.querySelector(".fretboard-toolbar");

    return {
      tier: app?.getAttribute("data-layout-tier"),
      variant: app?.getAttribute("data-layout-variant"),
      summaryCount: document.querySelectorAll(".summary-area").length,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      badgeBottom: badgeRect ? Math.round(badgeRect.bottom) : null,
      badgeTop: badgeRect ? Math.round(badgeRect.top) : null,
      toolbarDisplay: toolbar ? getComputedStyle(toolbar).display : null,
    };
  });
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

      await page.locator(".version-badge").scrollIntoViewIfNeeded();

      const after = await getMetrics(page);
      expect(after.badgeBottom).not.toBeNull();
      expect(after.badgeBottom!).toBeLessThanOrEqual(viewport.height);
    }
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
});
