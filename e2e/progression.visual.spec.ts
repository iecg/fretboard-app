import { expect, test } from "@playwright/test";
import { expectFullPageVisual, loadVisualState } from "./visual-helpers";

const linuxTolerance =
  process.platform === "linux" ? { maxDiffPixels: 12000 } : undefined;

test.describe("Progression Visual", () => {
  test("progression-desktop-1280x900", async ({ page }) => {
    await loadVisualState(
      page,
      {
        progressionSteps: [
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
          { id: "three", degree: "vi", duration: { value: 2, unit: "bar" }, qualityOverride: null },
          { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 1280, height: 900 },
    );

    // The chord track is always visible (Always-On DAW Phase B). The
    // ProgressionTrack renders in the top band via ProgressionSummarySlot
    // (not inside the Inspector) — no click required.
    await expect(page.getByRole("group", { name: "Progression track" })).toBeVisible();
    await expectFullPageVisual(page, "progression-desktop-1280x900", linuxTolerance);
  });

  test("progression-mobile-390x844", async ({ page }) => {
    // After the mobile rehost, progression controls live in the Inspector's
    // Song tab. mobileTabAtom was removed; navigate via tab click.
    await loadVisualState(
      page,
      {
        progressionSteps: [
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 390, height: 844 },
    );

    // Navigate to the Song tab in the Inspector bottom tab bar.
    await page.getByRole("tab", { name: "Song" }).click();

    await expect(page.getByRole("button", { name: "Sequence" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Progression track" })).toBeVisible();
    await expectFullPageVisual(page, "progression-mobile-390x844", linuxTolerance);
  });

  test("progression-mobile-long-390x844", async ({ page }) => {
    // A progression longer than four chords must stay readable on a phone via
    // the horizontal-scroll timeline (min-width driven by chord count).
    await loadVisualState(
      page,
      {
        progressionSteps: [
          { id: "s1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s2", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s3", degree: "iii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s5", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
          { id: "s6", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s7", degree: "vii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
          { id: "s8", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 390, height: 844 },
    );

    // Navigate to the Song tab in the Inspector bottom tab bar.
    await page.getByRole("tab", { name: "Song" }).click();

    await expect(page.getByRole("group", { name: "Progression track" })).toBeVisible();
    await expectFullPageVisual(page, "progression-mobile-long-390x844", linuxTolerance);
  });

  test("progression-string-study-pattern-1280x900", async ({ page }) => {
    // After the controls overhaul, the one-string / two-strings patterns no
    // longer disable the chord overlay — they only change how the scale is
    // drawn. This snapshot verifies the chord overlay + progression remain
    // fully usable on top of a string-study fingering.
    await loadVisualState(
      page,
      {
        fingeringPattern: "one-string",
        progressionSteps: [
          { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ],
      },
      { width: 1280, height: 900 },
    );

    await expectFullPageVisual(page, "progression-string-study-pattern-1280x900", linuxTolerance);
  });
});
