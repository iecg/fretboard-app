import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "capture-assets.ts",
  testIgnore: [],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  projects: [
    {
      name: "capture",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 2,
      },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:4173/fretboard-app/",
    colorScheme: "dark",
    trace: "off",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/fretboard-app/",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
