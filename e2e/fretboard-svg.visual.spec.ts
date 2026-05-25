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
      scaleName: "major"
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-default-c-major");
  });

  test("light mode C Major", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      theme: "light"
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-light-c-major");
  });

  test("C Minor Blues color-note scale", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "minor blues"
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-c-minor-blues");
  });

  test("C Major with G Dominant 7th chord overlay", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      // Phase 02 storage keys: manual mode with G Dominant 7th
      chordOverlayMode: "manual",
      chordRootOverride: "G",
      chordQualityOverride: "7",
    });
    
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-c-major-g7-overlay");
  });

  // ─── Motion-policy path: CAGED shape layer ─────────────────────────────────
  // Exercises FretboardShapeLayer with the animationMode prop introduced by the
  // motion-policy refactor. The CAGED pattern activates shape polygon rendering,
  // which is the surface gated by resolveFretboardMotionPolicy.shapeMode.
  test("CAGED shape layer — motion policy path — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "G",
      scaleName: "major",
      fingeringPattern: "caged",
    });

    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "fretboard-caged-shape-layer-dark");
  });
});
