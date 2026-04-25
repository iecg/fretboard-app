import { defineConfig, devices } from "@playwright/test";
import { productionConfig } from "./playwright.config.production-base";

/**
 * Playwright configuration for visual regression testing.
 * Runs against the production build to ensure consistency.
 */
export default defineConfig({
  ...productionConfig,
  testMatch: "e2e/**/*.visual.spec.ts",
  testIgnore: [],
  
  /* Use Chromium for stable visual snapshots */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 1,
      },
    },
  ],

  /* Visual-specific snapshot settings.
     maxDiffPixels: GH Actions ubuntu-latest visits a fresh VM each run, and
     dark-mode text-heavy overlays (help modal, settings panel) show ~1500-1700
     pixels of subpixel antialiasing variance between runs even with identical
     code/baselines. 2500 absorbs that flake while still being <1% of any full-
     page capture, so genuine visual regressions (color shifts, layout drift)
     still trip the budget. */
  expect: {
    ...productionConfig.expect,
    toHaveScreenshot: {
      maxDiffPixels: 2500,
      threshold: 0.1,
      animations: "disabled",
      scale: "css",
    },
  },

  /* Ensure we only run visual tests in this config */
  use: {
    ...productionConfig.use,
    screenshot: "only-on-failure",
  },
});
