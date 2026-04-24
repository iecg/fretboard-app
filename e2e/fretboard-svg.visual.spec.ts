import { test } from "@playwright/test";
import { loadVisualState, expectLocatorVisual } from "./visual-helpers";

test.describe("Fretboard SVG Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    // 1280x900 matches the desktop viewport used in other visual tests
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("default C Major", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major"
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-default-c-major");
  });

  test("light mode C Major", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      theme: "light"
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-light-c-major");
  });

  test("C Minor Blues color-note scale", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Minor Blues"
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-c-minor-blues");
  });

  test("C Major with G Dominant 7th chord overlay", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordRoot: "G",
      chordType: "Dominant 7th",
      linkChordRoot: false
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-c-major-g7-overlay");
  });
});
