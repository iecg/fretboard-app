import { test, expect } from "@playwright/test";
import {
  prepareVisualPage,
  expectFullPageVisual,
  loadVisualState,
  openMobilePanel,
} from "./visual-helpers";

/**
 * Mobile visual coverage for the dock shell (`MobileShell` + `MobileDock` +
 * the Overlay / Song panels). Assertions target the shell (`mobile-shell` /
 * `mobile-stage`), the always-visible dock (`mobile-dock` / `dock-transport`),
 * and the panels (`mobile-overlay-panel` / `mobile-song-panel`).
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
    await expect(page.getByTestId("dock-transport")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-portrait-390x844");
  });

  test("app-mobile-light-portrait-390x844", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    await expect(page.getByTestId("dock-transport")).toBeVisible();

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
    // The Overlay tab content hosts inside the anchored panel; the board
    // stays visible above it.
    await expect(page.getByTestId("view-tab")).toBeVisible();
    await expect(page.getByTestId("mobile-stage")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-overlay-panel-390x844");
  });

  test("app-mobile-song-panel-390x844", async ({ page }) => {
    await loadVisualState(page, {}, { width: 390, height: 844 });

    await openMobilePanel(page, "song");
    // Full-screen Song setup: preset, key/scale, time, progression editor.
    await expect(page.getByRole("button", { name: "Sequence" })).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-song-panel-390x844");
  });
});
