import { test } from "@playwright/test";
import {
  prepareVisualPage,
  expectFullPageVisual,
  openSettings,
  loadVisualState,
} from "./visual-helpers";

const linuxDarkOverlayTolerance = process.platform === "linux" ? { maxDiffPixels: 12000 } : undefined;

test.describe("App Overlays Visual", () => {
  test("app-settings-mobile-390x844", async ({ page }) => {
    await prepareVisualPage(page, { width: 390, height: 844 });
    await openSettings(page);
    await expectFullPageVisual(page, "app-settings-mobile-390x844", linuxDarkOverlayTolerance);
  });

  test("app-settings-light-mobile-390x844", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });
    await openSettings(page);
    await expectFullPageVisual(page, "app-settings-light-mobile-390x844");
  });

});
