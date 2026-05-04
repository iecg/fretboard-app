/**
 * Visual regression tests for chord-tone dotted-line connector layer.
 *
 * These scenarios exercise the four chord shapes identified in 03-RESEARCH.md:
 *   1. Open major triad (C major)  — triangle polyline
 *   2. Barre chord (F major)       — multi-vertex polyline with repeated tones
 *   3. Seventh chord (G7)          — quadrilateral polyline
 *   4. Spread voicing              — polyline-break path (> 5-fret span)
 *
 * Both modern-light and modern-dark themes are tested for each scenario.
 */
import { test } from "@playwright/test";
import { loadVisualState, expectLocatorVisual } from "./visual-helpers";

test.describe("Chord Connector Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  // ─── C major triad (open position) ─────────────────────────────────────────
  test("C major triad connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-c-major-dark");
  });

  test("C major triad connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-c-major-light");
  });

  // ─── F major barre chord ────────────────────────────────────────────────────
  test("F major barre connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "F",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "F",
      chordQualityOverride: "Major",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-f-major-dark");
  });

  test("F major barre connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "F",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "F",
      chordQualityOverride: "Major",
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-f-major-light");
  });

  // ─── G7 seventh chord ────────────────────────────────────────────────────────
  test("G7 dominant seventh connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "G",
      chordQualityOverride: "Dominant 7th",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-g7-dark");
  });

  test("G7 dominant seventh connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "G",
      chordQualityOverride: "Dominant 7th",
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-g7-light");
  });

  // ─── Spread voicing: extended fret range exercises the polyline-break path ──
  // Widen the visible range so the same chord tones appear in positions spanning
  // more than 5 frets apart, triggering the multi-segment polyline algorithm.
  test("spread voicing connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
      chordFretSpread: 12,
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-spread-dark");
  });

  test("spread voicing connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
      chordFretSpread: 12,
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-spread-light");
  });
});
