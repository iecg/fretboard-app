import { test } from "@playwright/test";
import { prepareVisualPage, expectLocatorVisual, loadVisualState } from "./visual-helpers";

test.describe("App Components Visual", () => {
  test.beforeEach(async ({ page }) => {
    // Use the shared helper to load the desktop viewport as requested (1280x900)
    await prepareVisualPage(page, { width: 1280, height: 900 });
  });

  test("fretboard-desktop-1280x900", async ({ page }) => {
    const locator = page.getByTestId("fretboard-outer");
    // Scroll locator into view before capturing as requested
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-desktop-1280x900");
  });

  test("fretboard-light-1280x900", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });
    const locator = page.getByTestId("fretboard-outer");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-light-1280x900");
  });

  test("circle-of-fifths-desktop-1280x900", async ({ page }) => {
    // v2.0: CircleOfFifths is no longer rendered in the app shell.
    // Capture the Inspector View tab (Scale Fingering + Chord Voicing controls)
    // which replaced the old Scale/Chord/Key 3-tab layout.
    await page.getByRole("tab", { name: "View" }).click();
    const locator = page.getByTestId("view-tab");
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "circle-of-fifths-desktop-1280x900");
  });

  test("circle-of-fifths-light-1280x900", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });
    await page.getByRole("tab", { name: "View" }).click();
    const locator = page.getByTestId("view-tab");
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "circle-of-fifths-light-1280x900");
  });
});

