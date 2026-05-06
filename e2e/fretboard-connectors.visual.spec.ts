/**
 * Visual regression tests for chord-tone dotted-line connector layer.
 *
 * These scenarios exercise the four chord shapes identified in 03-RESEARCH.md:
 *   1. Open major triad (C major)  — triangle polyline
 *   2. Barre chord (F major)       — multi-vertex polyline with repeated tones
 *   3. Seventh chord (G7)          — quadrilateral polyline
 *   4. Spread voicing              — polyline-break path (> 5-fret span)
 *
 * Phase 5 additions: active-voicing hover and focus states.
 *   5. C major hover  — hovering a chord-tone note activates the ring/dim effect
 *   6. C major focus  — keyboard-focusing a chord-tone note produces same effect
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

  // ─── Phase 6: Active-voicing hover state (real atom-driven interactions) ────
  //
  // These tests use real Playwright hover/focus interactions on FretboardHitTargetLayer
  // buttons to drive activeVoicingKeyAtom through the actual React event path.
  // The chord overlay is seeded via localStorage (chordOverlayMode: "manual")
  // so the connector layer is mounted on load; then a hover/focus event on a
  // chord-tone button sets the transient activeVoicingKeyAtom and triggers re-render.

  test("connector-c-major-hover — dark: CSS active-voicing attributes produce ring + dim", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    // Hover a chord-root button to activate the first voicing via the real atom path.
    // chord-root is a CHORD_TONE_ROLE that fires activeVoicingKeyAtom in FretboardHitTargetLayer.
    // force:true bypasses Playwright's actionability check since the a11y buttons are opacity:0.
    await page.locator('button[data-note-role="chord-root"]').first().hover({ force: true });
    await waitForStableLayout(page);

    await expectLocatorVisual(fretboard, "connector-c-major-hover-dark");
  });

  test("connector-c-major-hover — light: CSS active-voicing attributes produce ring + dim", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
      theme: "light",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    // Hover a chord-root button to activate the first voicing via the real atom path.
    // force:true bypasses Playwright's actionability check since the a11y buttons are opacity:0.
    await page.locator('button[data-note-role="chord-root"]').first().hover({ force: true });
    await waitForStableLayout(page);

    await expectLocatorVisual(fretboard, "connector-c-major-hover-light");
  });

  // ─── Phase 6: Active-voicing keyboard focus state ───────────────────────────

  test("connector-c-major-focus — dark: CSS active-voicing attributes (focus semantic)", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    // Focus a chord-root button via keyboard to drive the activeVoicingKeyAtom
    // through the real onFocus handler in FretboardHitTargetLayer.
    await page.locator('button[data-note-role="chord-root"]').first().focus();
    await waitForStableLayout(page);

    await expectLocatorVisual(fretboard, "connector-c-major-focus-dark");
  });

  test("connector-c-major-focus — light: CSS active-voicing attributes (focus semantic)", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major Triad",
      theme: "light",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    // Focus a chord-root button via keyboard to drive the activeVoicingKeyAtom
    // through the real onFocus handler in FretboardHitTargetLayer.
    await page.locator('button[data-note-role="chord-root"]').first().focus();
    await waitForStableLayout(page);

    await expectLocatorVisual(fretboard, "connector-c-major-focus-light");
  });
});
