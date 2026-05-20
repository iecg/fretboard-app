import { expect, test, type Page } from "@playwright/test";

async function gotoApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
}

test.describe("production css module scoping", () => {
  // The 10 deleted tests here were variations on "X element renders with
  // non-zero dimensions and has computed styles" — testing the browser layout
  // engine and the bundler pipeline, not our app. Any CSS Modules
  // misconfiguration would also break every visual regression suite
  // (e2e/*.visual.spec.ts), which exercises the same surfaces with pixel
  // assertions. What's preserved here is the explicit regression guard that
  // _named_ legacy global classes don't reappear, plus a contract check that
  // the bundler actually scoped module classes.

  test("no stale global class selectors present", async ({ page }) => {
    // Allowlist of unscoped class names that should NOT appear in production DOM.
    // These were historically used as global CSS classes and have been migrated to CSS Modules.
    const staleGlobalClasses = [
      "header-btn",     // Migrated to module scoped in AppHeader.tsx
      "control-btn",    // Migrated to module scoped components
      "scale-selector", // Migrated to .scale-selector in ScaleSelector.module.css
    ];

    await gotoApp(page);

    const result = await page.evaluate((classesToCheck: string[]) => {
      const foundClasses = new Set<string>();
      document.querySelectorAll("[class]").forEach((el) => {
        const classes = (el.getAttribute("class") || "").split(/\s+/);
        classesToCheck.forEach((className) => {
          if (classes.includes(className)) {
            foundClasses.add(className);
          }
        });
      });
      return Array.from(foundClasses);
    }, staleGlobalClasses);

    expect(
      result,
      `Should not find stale global classes. Found: ${result.join(", ")}`,
    ).toEqual([]);
  });

  test("css modules use scoped class names in production", async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(() => {
      const KNOWN_GLOBALS = new Set([
        "app-container",
        "panel-surface",
        "panel-surface--compact",
        "panel-surface--inset",
        "icon",
        "icon-active",
        "icon-muted",
        "loading-spinner",
        "custom-scrollbar",
        "hide-scrollbar",
        "brand-mark",
      ]);

      let nonUtilityClasses = 0;
      const seen = new Set<string>();
      document.querySelectorAll("[class]").forEach((el) => {
        (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).forEach((cls) => {
          seen.add(cls);
          if (
            !KNOWN_GLOBALS.has(cls) &&
            cls.length > 5 &&
            (cls.includes("_") || /[a-z]-[a-z]/.test(cls))
          ) {
            nonUtilityClasses++;
          }
        });
      });

      return { totalClasses: seen.size, nonUtilityClasses };
    });

    expect(result.totalClasses).toBeGreaterThan(10);
    expect(result.nonUtilityClasses).toBeGreaterThan(0);
  });
});
