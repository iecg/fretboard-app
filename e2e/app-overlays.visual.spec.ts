import { test } from "@playwright/test";
import {
  prepareVisualPage,
  expectFullPageVisual,
  openSettings,
  openHelp,
  loadVisualState,
} from "./visual-helpers";

test.describe("App Overlays Visual", () => {
  test("app-settings-mobile-390x844", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 390, height: 844 });
    await openSettings(page);
    await expectFullPageVisual(page, "app-settings-mobile-390x844");
  });

  test("app-settings-light-mobile-390x844", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });
    await openSettings(page);
    await expectFullPageVisual(page, "app-settings-light-mobile-390x844");
  });

  test("app-help-landscape-667x375", async ({ page }) => {
    await page.goto("/");
    await prepareVisualPage(page, { width: 667, height: 375 });
    await openHelp(page);
    await expectFullPageVisual(page, "app-help-landscape-667x375");
  });
});
