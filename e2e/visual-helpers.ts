import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Prepares a page for visual regression testing by setting the viewport,
 * enabling reduced motion, and ensuring the page is in a stable state.
 */
export async function prepareVisualPage(page: Page, viewport = { width: 1280, height: 720 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForLoadState("networkidle");
  // Small delay to ensure any post-load animations or JS layouts settle
  await page.waitForTimeout(500);
}

/**
 * Captures a full-page screenshot with the version badge masked.
 */
export async function expectFullPageVisual(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [page.getByTestId("version-badge")],
    animations: "disabled",
    scale: "css",
  });
}

/**
 * Captures a screenshot of a specific locator.
 */
export async function expectLocatorVisual(locator: Locator, name: string) {
  await expect(locator).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    scale: "css",
  });
}

/**
 * Opens the settings drawer.
 */
export async function openSettings(page: Page) {
  await page.getByLabel("Open settings").click();
  // Wait for drawer animation to complete
  await page.waitForTimeout(1000);
}

/**
 * Opens the help modal.
 */
export async function openHelp(page: Page) {
  await page.getByLabel("Open help").click();
  // Wait for modal animation to complete
  await page.waitForTimeout(300);
}
