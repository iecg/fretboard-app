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

    // v2.0: Key group (Root + Scale) now lives in the Inspector's Song tab.
    // The Circle of Fifths is retired from the main app.
    await page.getByRole("tab", { name: "Song" }).click();
    const noteGroup = page.getByRole("group", { name: "Note selector" });
    await expect(noteGroup).toBeVisible();

    // The default root note is "C". Verify the initial localStorage state is
    // either absent (first visit) or already "C".
    const initialStored = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY_ROOT_NOTE,
    );
    expect(["C", null]).toContain(initialStored);

    // Click the "G" button to change the root note.
    // Each note button carries aria-pressed and its note label.
    const gBtn = noteGroup.getByRole("button", { name: /^G$/ });
    await expect(gBtn).toBeVisible();
    await gBtn.click();

    // Wait until Jotai flushes the atom write to localStorage.
    await page.waitForFunction(
      (key) => localStorage.getItem(key) === "G",
      STORAGE_KEY_ROOT_NOTE,
    );

    // Confirm the G button is now marked selected.
    await expect(noteGroup.getByRole("button", { name: /^G$/, pressed: true })).toBeVisible();

    // Reload the page — localStorage survives the reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    // The Inspector resets to the View tab on reload — reopen the Song tab.
    await page.getByRole("tab", { name: "Song" }).click();
    await expect(page.getByRole("group", { name: "Note selector" })).toBeVisible();

    // The G button must still be selected after the reload.
    await expect(
      page.getByRole("group", { name: "Note selector" }).getByRole("button", { name: /^G$/, pressed: true }),
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
    const track = page.getByRole("group", { name: "Progression track" });
    await expect(track).toBeVisible();
    // Tempo now lives in the unified header transport cluster (Always-On DAW
    // Phase A) — the inline stepper moved to the Progression inspector tab.
    // Target the header readout's stable test id and verify the persisted
    // value round-tripped.
    await expect(page.getByTestId("header-tempo")).toHaveText(/132\s*BPM/i);
    // Chord-row state lives directly in the progression timeline now. Verify
    // the persisted second step (degree V, Dominant 7th, 2 bars) survived.
    await expect(
      page.getByRole("button", { name: /Step 2, V, G Dominant 7th, 2 bars/i }),
    ).toBeVisible();
  });
});
