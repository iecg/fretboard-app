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
    // E1: Root note is now a LabeledSelect combobox (label="Root"), not a button group.
    await page.getByRole("tab", { name: "Song" }).click();
    const rootCombobox = page.getByRole("combobox", { name: /^Root$/i });
    await expect(rootCombobox).toBeVisible();

    // The default root note is "C". Verify the initial localStorage state is
    // either absent (first visit) or already "C".
    const initialStored = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY_ROOT_NOTE,
    );
    expect(["C", null]).toContain(initialStored);

    // Open the Root combobox and select "G".
    await rootCombobox.click();
    await page.getByRole("option", { name: /^G$/ }).click();

    // Wait until Jotai flushes the atom write to localStorage.
    await page.waitForFunction(
      (key) => localStorage.getItem(key) === "G",
      STORAGE_KEY_ROOT_NOTE,
    );

    // Confirm the combobox now displays "G" as the selected value.
    await expect(rootCombobox).toHaveText(/G/);

    // Reload the page — localStorage survives the reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    // The Inspector resets to the View tab on reload — reopen the Song tab.
    await page.getByRole("tab", { name: "Song" }).click();
    await expect(page.getByRole("combobox", { name: /^Root$/i })).toBeVisible();

    // The Root combobox must still display "G" after the reload.
    await expect(page.getByRole("combobox", { name: /^Root$/i })).toHaveText(/G/);

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
          { id: "two", degree: "V", duration: { value: 2, unit: "bar" }, qualityOverride: "7" },
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
    // the persisted second step (degree V, dominant seventh, 2 bars) survived.
    // Phase N3: chord qualities are stored as Tonal symbols ("7") and rendered
    // via Tonal's English label ("dominant seventh").
    await expect(
      page.getByRole("button", { name: /Step 2, V, G dominant seventh, 2 bars/i }),
    ).toBeVisible();
  });
});
