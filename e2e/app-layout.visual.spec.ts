import { expect, test } from "@playwright/test";
import { expectFullPageVisual, loadVisualState, prepareVisualPage } from "./visual-helpers";

test.describe("App Layout Visual Regression", () => {
  test("app-desktop-split-1280x900", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 1280, height: 900 });
    await expectFullPageVisual(page, "app-desktop-split-1280x900");
  });

  test("app-desktop-light-1280x900", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });
    await expectFullPageVisual(page, "app-desktop-light-1280x900");
  });

  test("app-desktop-split-light-1280x900", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });
    await expect(page.getByTestId("app-container")).toHaveAttribute(
      "data-layout-variant",
      "desktop-split"
    );
    await expectFullPageVisual(page, "app-desktop-split-light-1280x900");
  });

  test("app-compact-desktop-1024x768", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 1024, height: 768 });
    await expect(page.getByTestId("app-container")).toBeVisible();
    await expectFullPageVisual(page, "app-compact-desktop-1024x768");
  });

  test("app-tablet-portrait-768x1024", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 768, height: 1024 });
    await expect(page.getByTestId("app-container")).toBeVisible();
    await expectFullPageVisual(page, "app-tablet-portrait-768x1024");
  });
});
