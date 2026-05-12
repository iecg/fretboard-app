import { expect, test, type Page } from "@playwright/test";

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
});
