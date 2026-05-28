/**
 * Visual regression tests for the ChordOverlayControls panel.
 *
 * After lens consolidation (commit e5d2f2ea), ChordOverlayControls renders only
 * the Voicing group (dropdown + optional ChordStringSetPicker).
 * The Practice lens toggle row and the former Chord Type toggle bar were removed.
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
        chordQualityOverride: "M",
        chordRootOverride: "C",
      },
      { width: 1280, height: 900 },
    );

    // ChordOverlayControls lives in the Inspector's Overlay tab.
    await page.getByRole("tab", { name: "Overlay" }).click();

    // Wait for the Voicing dropdown — confirms ChordOverlayControls is fully
    // mounted. (Practice lens row was removed in lens consolidation e5d2f2ea.)
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
        chordQualityOverride: "M",
        chordRootOverride: "C",
        theme: "light",
      },
      { width: 1280, height: 900 },
    );

    await page.getByRole("tab", { name: "Overlay" }).click();

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
        chordQualityOverride: "M",
        chordRootOverride: "C",
      },
      { width: 390, height: 844 },
    );

    // Activate the Overlay tab so ChordOverlayControls is visible.
    await page.getByRole("tab", { name: "Overlay" }).click();

    // Wait for the Voicing dropdown to confirm the panel is mounted.
    // (Practice lens row was removed in lens consolidation e5d2f2ea.)
    await expect(page.getByRole("combobox", { name: "Voicing" })).toBeVisible();

    await expectFullPageVisual(
      page,
      "chord-overlay-controls-manual-mobile-390x844",
      linuxTolerance,
    );
  });
});
