import { test, expect } from "@playwright/test";
import { prepareVisualPage, expectFullPageVisual, loadVisualState, expectLocatorVisual } from "./visual-helpers";

test.describe("App Mobile Visual", () => {
  test("app-mobile-portrait-390x844", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 390, height: 844 });

    await expect(page.getByTestId("app-container")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-content")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-portrait-390x844");
  });

  test("app-mobile-key-tab-portrait-390x844", async ({ page }) => {
    await loadVisualState(page, { mobileTab: "cof" }, { width: 390, height: 844 });

    await expect(page.getByTestId("app-container")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-content")).toBeVisible();

    const circleLocator = page.getByTestId("circle-of-fifths-svg");
    await expect(circleLocator).toBeVisible();
    await expectLocatorVisual(circleLocator, "app-mobile-key-tab-portrait-390x844");
  });

  test("app-mobile-light-portrait-390x844", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });

    await expect(page.getByTestId("app-container")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-light-portrait-390x844");
  });

  test("app-mobile-landscape-667x375", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 667, height: 375 });

    await expect(page.getByTestId("app-container")).toBeVisible();
    await expect(page.getByTestId("main-fretboard")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-landscape-667x375");
  });
});
