/**
 * Visual regression tests for the ChordOverlayControls panel.
 *
 * Tests the chord-type toggle bar surface in manual mode (the mode that always
 * renders the full 16-button chord-type toggle bar unconditionally). Resolves
 * QC-10: no existing visual spec captured this panel prior to plan 01-04.
 *
 * Covers:
 *   1. Desktop dark  — 1280x900, manual mode, Major Triad active
 *   2. Desktop light — 1280x900, manual mode, Major Triad active
 *   3. Mobile dark   — 390x844, manual mode (scroll overflow validation)
 */
import { expect, test } from "@playwright/test";
import { loadVisualState, expectFullPageVisual } from "./visual-helpers";

const linuxTolerance =
  process.platform === "linux" ? { maxDiffPixels: 12000 } : undefined;

test.describe("Chord Overlay Controls Visual", () => {
  test("chord-overlay-controls-manual-1280x900", async ({ page }) => {
    // Seed manual mode with Major Triad selected so the Chords disclosure
    // opens by default (defaultOpen={Boolean(chordType)}) and the toggle
    // bar is immediately visible without requiring a disclosure click.
    await loadVisualState(
      page,
      {
        chordOverlayMode: "manual",
        chordQualityOverride: "Major Triad",
        chordRootOverride: "C",
      },
      { width: 1280, height: 900 },
    );

    // Wait for the chord-type toggle bar to be visible.
    await page
      .getByRole("group", { name: "Chord Type" })
      .first()
      .waitFor({ state: "visible" });

    // Assert new chord types from plan 01-02 and updated labels from plan 01-03.
    await expect(page.getByRole("button", { name: "aug" })).toBeVisible();
    await expect(page.getByRole("button", { name: "m7♭5" })).toBeVisible();

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

    await page
      .getByRole("group", { name: "Chord Type" })
      .first()
      .waitFor({ state: "visible" });

    await expect(page.getByRole("button", { name: "aug" })).toBeVisible();
    await expect(page.getByRole("button", { name: "m7♭5" })).toBeVisible();

    await expectFullPageVisual(
      page,
      "chord-overlay-controls-manual-light-1280x900",
    );
  });

  test("chord-overlay-controls-manual-mobile-390x844", async ({ page }) => {
    // Mobile viewport validates the scroll-overflow CSS added in plan 01-03.
    // Seed mobileTab="chords" so the Chords tab panel is active on boot —
    // on mobile the theory controls live in a tab strip, not a sidebar.
    await loadVisualState(
      page,
      {
        chordOverlayMode: "manual",
        chordQualityOverride: "Major Triad",
        chordRootOverride: "C",
        mobileTab: "chords",
      },
      { width: 390, height: 844 },
    );

    // Wait for the chord-type toggle bar to be visible in the chords tab.
    const toggleBar = page.getByRole("group", { name: "Chord Type" }).first();
    await toggleBar.waitFor({ state: "visible" });

    await expect(page.getByRole("button", { name: "aug" })).toBeVisible();
    await expect(page.getByRole("button", { name: "m7♭5" })).toBeVisible();

    await expectFullPageVisual(
      page,
      "chord-overlay-controls-manual-mobile-390x844",
      linuxTolerance,
    );
  });
});
