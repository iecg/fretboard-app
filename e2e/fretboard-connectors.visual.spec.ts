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
import { loadVisualState, waitForStableLayout, expectLocatorVisual } from "./visual-helpers";

test.describe("Chord Connector Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  // ─── C major triad (open position) ─────────────────────────────────────────
  test("C major triad connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "M",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-c-major-dark");
  });

  test("C major triad connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "M",
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
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "F",
      chordQualityOverride: "M",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-f-major-dark");
  });

  test("F major barre connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "F",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "F",
      chordQualityOverride: "M",
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
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "G",
      chordQualityOverride: "7",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-g7-dark");
  });

  test("G7 dominant seventh connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "G",
      chordQualityOverride: "7",
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
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "M",
      chordFretSpread: 12,
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-spread-dark");
  });

  test("spread voicing connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "M",
      chordFretSpread: 12,
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-spread-light");
  });

  // ─── Phase 3: Spread voicing — connector geometry crosses the fretboard taper edge ──
  // Validates that chord-connectors render past the SVG bounding box once relocated
  // out of the taper clip (Plan 03-01). Uses a wider locator (the <main data-testid=
  // "main-fretboard"> wrapper) than the other scenarios so the overflow paint that
  // escapes the SVG element box is captured in the snapshot. The fretboard-svg
  // test-id locator clips to the SVG element and would hide this overflow region.
  test("C major spread connector — edge crossing — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "M",
      chordFretSpread: 12,
    });
    const locator = page.getByTestId("main-fretboard");
    await locator.scrollIntoViewIfNeeded();
    await waitForStableLayout(page);
    await expectLocatorVisual(locator, "connector-c-major-spread-edge-dark");
  });

  test("C major spread connector — edge crossing — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "M",
      chordFretSpread: 12,
      theme: "light",
    });
    const locator = page.getByTestId("main-fretboard");
    await locator.scrollIntoViewIfNeeded();
    await waitForStableLayout(page);
    await expectLocatorVisual(locator, "connector-c-major-spread-edge-light");
  });

  // ─── Motion-policy refactor: static/group wrapper path ────────────────────
  // Ensures the chord-connector layer still renders correctly when the CAGED
  // shape layer is active alongside the overlay. This exercises the combined
  // shape+connector wrapper path introduced by the motion-policy refactor.
  test("C major connector with CAGED shape — static wrapper path — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "M",
      fingeringPattern: "caged",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-c-major-caged-shape-dark");
  });
});
