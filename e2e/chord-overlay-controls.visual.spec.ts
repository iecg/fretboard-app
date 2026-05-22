/**
 * Visual regression tests for the ChordOverlayControls panel.
 *
 * After Plan D (v2.0 inspector cleanup), ChordOverlayControls renders only the
 * Voicing group (dropdown + Practice lens toggle + optional ClosePositionCycle).
 * The former Chord Type toggle bar was removed in D2.
 *
 * Covers:
 *   1. Desktop dark  — 1280x900, manual mode, Major Triad active
 *   2. Desktop light — 1280x900, manual mode, Major Triad active
 *   3. Mobile dark   — 390x844, manual mode
 */
import { expect, test } from "@playwright/test";
import { loadVisualState, expectFullPageVisual } from "./visual-helpers";

const linuxTolerance =
  process.platform === "linux" ? { maxDiffPixels: 12000 } : undefined;

test.describe("Chord Overlay Controls Visual", () => {
  test("chord-overlay-controls-manual-1280x900", async ({ page }) => {
    await loadVisualState(
      page,
      {
        chordOverlayMode: "manual",
        chordQualityOverride: "Major Triad",
        chordRootOverride: "C",
      },
      { width: 1280, height: 900 },
    );

    // ChordOverlayControls lives in the Inspector's View tab.
    await page.getByRole("tab", { name: "View" }).click();

    // Wait for the Practice lens toggle (role=group) to be visible — this
    // confirms ChordOverlayControls is fully mounted after D2 cleanup.
    await page
      .getByRole("group", { name: "Practice lens" })
      .first()
      .waitFor({ state: "visible" });

    // Verify the Voicing dropdown is present.
    await expect(page.getByRole("combobox", { name: "Voicing" })).toBeVisible();

    await expectFullPageVisual(
      page,
      "chord-overlay-controls-manual-1280x900",
      linuxTolerance,
    );
  });

  test("chord-overlay-controls-manual-light-1280x900", async ({ page }) => {
    await loadVisualState(
      page,
      {
        chordOverlayMode: "manual",
        chordQualityOverride: "Major Triad",
        chordRootOverride: "C",
        theme: "light",
      },
      { width: 1280, height: 900 },
    );

    await page.getByRole("tab", { name: "View" }).click();

    await page
      .getByRole("group", { name: "Practice lens" })
      .first()
      .waitFor({ state: "visible" });

    await expect(page.getByRole("combobox", { name: "Voicing" })).toBeVisible();

    await expectFullPageVisual(
      page,
      "chord-overlay-controls-manual-light-1280x900",
    );
  });

  test("chord-overlay-controls-manual-mobile-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      {
        chordOverlayMode: "manual",
        chordQualityOverride: "Major Triad",
        chordRootOverride: "C",
      },
      { width: 390, height: 844 },
    );

    // Activate the View tab so ChordOverlayControls is visible.
    await page.getByRole("tab", { name: "View" }).click();

    // Wait for the Practice lens toggle to confirm the panel is mounted.
    await page
      .getByRole("group", { name: "Practice lens" })
      .first()
      .waitFor({ state: "visible" });

    await expect(page.getByRole("combobox", { name: "Voicing" })).toBeVisible();

    await expectFullPageVisual(
      page,
      "chord-overlay-controls-manual-mobile-390x844",
      linuxTolerance,
    );
  });
});
