import { defineConfig } from "@playwright/test";

export const productionConfig = defineConfig({
  testDir: "./e2e",
  testIgnore: "**/*.visual.spec.ts",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173/fretboard-app/",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/fretboard-app/",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
