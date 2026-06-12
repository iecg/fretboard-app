import { expect, test } from "@playwright/test";
import { expectFullPageVisual, loadVisualState, openMobilePanel } from "./visual-helpers";

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

    // Open the full-screen Song panel via its dock toggle.
    await openMobilePanel(page, "song");

    await expect(page.getByRole("button", { name: "Sequence" })).toBeVisible();
    // The shell's top-band ProgressionTrack is painted behind the modal Song
    // panel (Radix aria-hides the background), so role-based queries skip it —
    // assert via the attribute selector instead.
    await expect(page.locator('[aria-label="Progression track"]')).toBeVisible();
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
        // Inspector tabs live inside the bottom sheet; "full" exposes them.
      },
      { width: 390, height: 844 },
    );

    // Open the full-screen Song panel via its dock toggle.
    await openMobilePanel(page, "song");

    await expect(page.locator('[aria-label="Progression track"]')).toBeVisible();
    await expectFullPageVisual(page, "progression-mobile-long-390x844", linuxTolerance);
  });

  test("progression-mobile-long-375x667", async ({ page }) => {
    // Compact-height guardrail (375x667): the same long progression must stay
    // readable and the Song tab usable on the smallest supported phone.
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
        // Inspector tabs live inside the bottom sheet; "full" exposes them.
      },
      { width: 375, height: 667 },
    );

    // Open the full-screen Song panel via its dock toggle.
    await openMobilePanel(page, "song");

    await expect(page.locator('[aria-label="Progression track"]')).toBeVisible();
    await expectFullPageVisual(page, "progression-mobile-long-375x667", linuxTolerance);
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

  test("scrolls the active timeline chord into view on an overflowing mobile progression", async ({ page }) => {
    // Seed 8 single-bar chords at 390px: the timeline min-width is
    // (8/1)*5.25rem = 42rem ~= 672px, which genuinely overflows the ~390px
    // track (measured scrollWidth ~688 vs clientWidth ~369). Selecting a late
    // chord must fire useTimelineAutoScroll so the active block ends up inside
    // the visible scrollport.
    //
    // Non-vacuity note: we drive the selection from the *step list* (Song tab),
    // not by clicking the track block directly. Clicking a track block focuses
    // it, which makes the browser natively scroll the track regardless of the
    // hook — that would pass even with the hook stubbed. Selecting from the
    // list moves activeIndex without putting focus inside the track, so the
    // track's scrollLeft only changes if useTimelineAutoScroll actually runs.
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
        // Inspector tabs live inside the bottom sheet; "full" exposes them.
      },
      { width: 390, height: 844 },
    );

    // The step list lives in the Inspector Song tab.
    await openMobilePanel(page, "song");

    // The modal Song panel aria-hides the background, so the top-band
    // track is skipped by role queries — locate it via the attribute selector.
    const track = page.locator('[aria-label="Progression track"]');
    await expect(track).toBeVisible();
    expect(
      await track.evaluate((el) => el.scrollLeft),
      "track starts unscrolled",
    ).toBe(0);

    // Select the last chord from the list (label "Progression navigation").
    const rows = page.locator('[aria-label="Progression navigation"]').getByRole("button");
    const count = await rows.count();
    await rows.nth(count - 1).click();

    // The active block carries data-active; wait for the selection to land.
    const activeBlock = track.locator('[data-active="true"]');
    await expect(activeBlock).toBeVisible();

    // The track (its own ref is the scrollable container — see
    // ProgressionTrack.tsx) must have scrolled right, proving the hook ran.
    // Poll to let the smooth-scroll animation settle.
    await expect
      .poll(async () => track.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);

    const inView = await track.evaluate((el) => {
      const active = el.querySelector('[data-active="true"]');
      if (!active) return false;
      const c = el.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      return a.left >= c.left - 1 && a.right <= c.right + 1;
    });
    expect(inView, "active block within track viewport").toBe(true);
  });
});
