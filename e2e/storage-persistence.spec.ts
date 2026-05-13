import { expect, test, type Page } from "@playwright/test";
import { loadVisualState } from "./visual-helpers";

const STORAGE_KEY_ROOT_NOTE = "fretflow:rootNote";

async function gotoApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
}

test.describe("storage persistence", () => {
  test("root note persists across page reload", async ({ page }) => {
    await gotoApp(page);

    // Confirm the Circle of Fifths SVG is rendered
    const svg = page.locator('[data-testid="circle-of-fifths-svg"]');
    await expect(svg).toBeVisible();

    // The default root note is "C". Verify the initial localStorage state is
    // either absent (first visit) or already "C".
    const initialStored = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY_ROOT_NOTE,
    );
    expect(["C", null]).toContain(initialStored);

    // Click the "G" slice to change the root note.
    // Each interactive slice carries role="button" and aria-label "<note> — <selected|not selected>".
    const gSlice = svg.locator('path[role="button"][aria-label^="G —"]');
    await expect(gSlice).toBeVisible();
    await gSlice.click();

    // Wait until Jotai flushes the atom write to localStorage.
    await page.waitForFunction(
      (key) => localStorage.getItem(key) === "G",
      STORAGE_KEY_ROOT_NOTE,
    );

    // Confirm the G slice is now marked selected.
    await expect(
      svg.locator('path[role="button"][aria-label="G — selected"]'),
    ).toBeVisible();

    // Reload the page — localStorage survives the reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="circle-of-fifths-svg"]'),
    ).toBeVisible();

    // The G slice must still be selected after the reload.
    await expect(
      page
        .locator('[data-testid="circle-of-fifths-svg"]')
        .locator('path[role="button"][aria-label="G — selected"]'),
    ).toBeVisible();

    // localStorage must still hold "G".
    const persistedValue = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY_ROOT_NOTE,
    );
    expect(persistedValue).toBe("G");
  });

  test("persists progression settings across reload", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionEnabled: true,
        progressionTempoBpm: 132,
        progressionLoopEnabled: false,
        progressionSteps: [
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "two", degree: "V", duration: { value: 2, unit: "bar" }, qualityOverride: "Dominant 7th" },
        ],
      },
      { width: 1280, height: 900 },
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("group", { name: "Progression playback" })).toBeVisible();
    // Tempo is now a StepperControl (role=group, not spinbutton). Verify the
    // decrease button carries the current value in its aria-label.
    await expect(page.getByRole("button", { name: /Decrease Tempo \(current: 132\)/i })).toBeVisible();
    await page.locator('button:has-text("Progression")').filter({ hasText: "bars" }).click();
    // Chord rows no longer have a "Step N" prefix — check degree + chord name instead.
    await expect(page.getByRole("button", { name: /V.*Dominant 7th.*2 bars/i })).toBeVisible();
  });
});
