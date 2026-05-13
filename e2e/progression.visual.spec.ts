import { expect, test } from "@playwright/test";
import { expectFullPageVisual, loadVisualState } from "./visual-helpers";

const linuxTolerance =
  process.platform === "linux" ? { maxDiffPixels: 12000 } : undefined;

test.describe("Progression Visual", () => {
  test("progression-desktop-1280x900", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionEnabled: true,
        progressionSteps: [
          { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
          { id: "two", degree: "V", duration: "1-bar", qualityOverride: "Dominant 7th" },
          { id: "three", degree: "vi", duration: "2-bars", qualityOverride: null },
          { id: "four", degree: "IV", duration: "1-bar", qualityOverride: null },
        ],
      },
      { width: 1280, height: 900 },
    );

    await expect(page.getByRole("group", { name: "Progression playback" })).toBeVisible();
    await page.locator('button:has-text("Progression")').filter({ hasText: "steps" }).click();
    await expect(page.getByText("Progression Mode")).toBeVisible();
    await expectFullPageVisual(page, "progression-desktop-1280x900", linuxTolerance);
  });

  test("progression-mobile-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionEnabled: true,
        mobileTab: "progression",
        progressionSteps: [
          { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
          { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
        ],
      },
      { width: 390, height: 844 },
    );

    await expect(page.getByRole("heading", { name: "Progression" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Progression playback" })).toBeVisible();
    await expectFullPageVisual(page, "progression-mobile-390x844", linuxTolerance);
  });

  test("progression-disabled-pattern-1280x900", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionEnabled: true,
        fingeringPattern: "one-string",
        progressionSteps: [
          { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
        ],
      },
      { width: 1280, height: 900 },
    );

    await expect(page.getByText("Chord overlay disabled for single/two-string patterns.")).toBeVisible();
    await expectFullPageVisual(page, "progression-disabled-pattern-1280x900", linuxTolerance);
  });
});
