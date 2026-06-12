import { test, expect } from "@playwright/test";
import {
  prepareVisualPage,
  expectFullPageVisual,
  loadVisualState,
  openMobilePanel,
} from "./visual-helpers";

/**
 * Mobile visual coverage for the dock shell (`MobileShell` + `MobileDock` +
 * the Overlay / Song drawers). Assertions target the shell (`mobile-shell` /
 * `mobile-stage`), the transport strip under the header (`shell-transport`),
 * the dock tab bar (`mobile-dock`), and the panels (`mobile-overlay-panel` /
 * `mobile-song-panel`).
 *
 * The panel atom is deliberately not persisted, so panel scenarios open via
 * the dock toggles (openMobilePanel). With reduced-motion + the animation
 * detox injected by loadVisualState the panels render at their final position
 * without an entrance animation, so the captures are deterministic.
 */
test.describe("App Mobile Visual", () => {
  test("app-mobile-portrait-390x844", async ({ page }) => {
    await prepareVisualPage(page, { width: 390, height: 844 });

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    await expect(page.getByTestId("mobile-stage")).toBeVisible();
    await expect(page.getByTestId("shell-transport")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-portrait-390x844");
  });

  test("app-mobile-light-portrait-390x844", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    await expect(page.getByTestId("shell-transport")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-light-portrait-390x844");
  });

  test("app-mobile-landscape-667x375", async ({ page }) => {
    // Mobile-tier landscape triggers the CSS-only portrait-lock rotate overlay
    // (MobileShell `.rotateOverlay`, shown via max-width:767px + landscape).
    // The overlay covers the screen; this snapshot locks in that real scenario.
    await prepareVisualPage(page, { width: 667, height: 375 });

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    await expect(page.getByRole("alert")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-landscape-667x375");
  });

  // ─── Dock panel scenarios ──────────────────────────────────────────────────

  test("app-mobile-dock-390x844", async ({ page }) => {
    await loadVisualState(page, {}, { width: 390, height: 844 });

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    await expect(page.getByTestId("mobile-dock")).toBeVisible();
    await expect(page.getByTestId("dock-toggle-overlay")).toBeVisible();
    await expect(page.getByTestId("dock-toggle-song")).toBeVisible();
    await expect(page.getByTestId("stage-zoom")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-dock-390x844");
  });

  test("app-mobile-overlay-panel-390x844", async ({ page }) => {
    await loadVisualState(page, {}, { width: 390, height: 844 });

    await openMobilePanel(page, "overlay");
    // The Overlay tab content hosts inside the anchored drawer; the board
    // stays visible above it.
    await expect(page.getByTestId("view-tab")).toBeVisible();
    await expect(page.getByTestId("mobile-stage")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-overlay-panel-390x844");
  });

  test("app-mobile-song-panel-390x844", async ({ page }) => {
    await loadVisualState(page, {}, { width: 390, height: 844 });

    await openMobilePanel(page, "song");
    // Tall Song drawer: preset, key/scale, time, progression editor — with the
    // transport strip and dock tabs still visible around it.
    await expect(page.getByRole("button", { name: "Sequence" })).toBeVisible();
    await expect(page.getByTestId("shell-transport")).toBeVisible();
    await expect(page.getByTestId("dock-toggle-song")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-song-panel-390x844");
  });

  test("app-mobile-zoomed-out-390x844", async ({ page }) => {
    await loadVisualState(page, {}, { width: 390, height: 844 });

    const boardHeight = async () =>
      (await page.getByTestId("fretboard-outer").boundingBox())?.height ?? 0;
    const fullHeight = await boardHeight();

    // Zoom out to 70%: rows/bubbles shrink (64px -> 45px rows) so more frets
    // fit on screen.
    const zoomOut = page.getByTestId("stage-zoom-out");
    await zoomOut.click();
    await zoomOut.click();
    await zoomOut.click();
    await expect
      .poll(boardHeight)
      .toBeLessThan(fullHeight * 0.8);

    await expectFullPageVisual(page, "app-mobile-zoomed-out-390x844");
  });
});
