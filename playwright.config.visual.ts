import { defineConfig, devices } from "@playwright/test";
import { productionConfig } from "./playwright.config.production-base";

/**
 * Playwright configuration for visual regression testing.
 * Runs against the production build to ensure consistency.
 */
export default defineConfig({
  ...productionConfig,
  testMatch: "e2e/**/*.visual.spec.ts",
  
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

  /* Visual-specific snapshot settings */
  expect: {
    ...productionConfig.expect,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0,
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
