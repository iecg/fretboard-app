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
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
          { id: "three", degree: "vi", duration: { value: 2, unit: "bar" }, qualityOverride: null },
          { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 1280, height: 900 },
    );

    // progressionEnabled is seeded by loadVisualState, so progression mode is
    // already active at boot. The ProgressionTrack renders in the top band via
    // ProgressionSummarySlot (not inside the Inspector) — no click required.
    await expect(page.getByRole("group", { name: "Progression track" })).toBeVisible();
    await expectFullPageVisual(page, "progression-desktop-1280x900", linuxTolerance);
  });

  test("progression-mobile-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionEnabled: true,
        mobileTab: "progression",
        progressionSteps: [
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 390, height: 844 },
    );

    await expect(page.getByRole("heading", { name: "Progression" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Progression track" })).toBeVisible();
    await expectFullPageVisual(page, "progression-mobile-390x844", linuxTolerance);
  });

  test("progression-disabled-pattern-1280x900", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionEnabled: true,
        fingeringPattern: "one-string",
        progressionSteps: [
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 1280, height: 900 },
    );

    await expect(page.getByText("Chord overlay disabled for single/two-string patterns.")).toBeVisible();
    await expectFullPageVisual(page, "progression-disabled-pattern-1280x900", linuxTolerance);
  });
});
