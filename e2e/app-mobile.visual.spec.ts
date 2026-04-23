import { test, expect } from "@playwright/test";
import { prepareVisualPage, expectFullPageVisual, loadVisualState } from "./visual-helpers";

test.describe("App Mobile Visual", () => {
  test("app-mobile-portrait-390x844", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 390, height: 844 });
    
    // Assert app container is visible
    await expect(page.getByTestId("app-container")).toBeVisible();
    
    // For portrait, assert mobile-tab-content is visible
    await expect(page.getByTestId("mobile-tab-content")).toBeVisible();
    
    // Captures full-page snapshot with version badge masked
    await expectFullPageVisual(page, "app-mobile-portrait-390x844");
  });

  test("app-mobile-light-portrait-390x844", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });
    
    // Assert app container is visible
    await expect(page.getByTestId("app-container")).toBeVisible();
    
    // Captures full-page snapshot with version badge masked
    await expectFullPageVisual(page, "app-mobile-light-portrait-390x844");
  });

  test("app-mobile-landscape-667x375", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 667, height: 375 });
    
    // Assert app container is visible
    await expect(page.getByTestId("app-container")).toBeVisible();
    
    // For landscape, assert main-fretboard is visible
    await expect(page.getByTestId("main-fretboard")).toBeVisible();
    
    // Captures full-page snapshot with version badge masked
    await expectFullPageVisual(page, "app-mobile-landscape-667x375");
  });
});
