import { test } from "@playwright/test";
import {
  prepareVisualPage,
  expectFullPageVisual,
  openSettings,
  openHelp,
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

  // ─── AppMotionConfig root path ─────────────────────────────────────────────
  // The help modal shares the root <MotionConfig reducedMotion="user"> added by
  // AppMotionConfig in the Task 3 refactor. This snapshot locks in the initial-
  // appearance behaviour of the overlay under the centralised motion policy.
  test("app-help-modal-mobile-390x844", async ({ page }) => {
    await prepareVisualPage(page, { width: 390, height: 844 });
    await openHelp(page);
    await expectFullPageVisual(page, "app-help-modal-mobile-390x844");
  });
});
