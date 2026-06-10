import { test, expect } from "@playwright/test";
import {
  prepareVisualPage,
  expectFullPageVisual,
  loadVisualState,
} from "./visual-helpers";

/**
 * Mobile visual coverage for the sheet shell (`MobileShell` + vaul
 * `MobileSheet`). The old scrolling `app-container` / `main-fretboard` layout
 * with an in-flow Inspector tablist is gone — assertions now target the shell
 * (`mobile-shell` / `mobile-stage`), the always-visible peek transport
 * (`peek-transport`), and the portaled sheet (`mobile-sheet`).
 *
 * Sheet snap is persisted in `<prefix>mobileSheetSnap`; `loadVisualState` seeds
 * it via the `mobileSheetSnap` VisualState field so the vaul sheet boots at a
 * deterministic snap ("peek" | "half" | "full") instead of animating into one.
 */
test.describe("App Mobile Visual", () => {
  test("app-mobile-portrait-390x844", async ({ page }) => {
    await prepareVisualPage(page, { width: 390, height: 844 });

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    await expect(page.getByTestId("mobile-stage")).toBeVisible();
    await expect(page.getByTestId("peek-transport")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-portrait-390x844");
  });

  test("app-mobile-light-portrait-390x844", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    await expect(page.getByTestId("peek-transport")).toBeVisible();

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

  // ─── Sheet snap scenarios ──────────────────────────────────────────────────
  // Seed `mobileSheetSnap` so the vaul sheet boots already at the target snap.
  // With reduced-motion + the animation detox injected by loadVisualState the
  // sheet renders at its final translate without an entrance animation, so the
  // full-page captures are deterministic.

  test("app-mobile-sheet-peek-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      { mobileSheetSnap: "peek" },
      { width: 390, height: 844 },
    );

    await expect(page.getByTestId("mobile-shell")).toBeVisible();
    const sheet = page.getByTestId("mobile-sheet");
    await expect(sheet).toBeVisible();
    // Only the mini-player row shows; the body is visibility:hidden at peek.
    await expect(page.getByTestId("peek-transport")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-sheet-peek-390x844");
  });

  test("app-mobile-sheet-half-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      { mobileSheetSnap: "half" },
      { width: 390, height: 844 },
    );

    await expect(page.getByTestId("mobile-sheet")).toBeVisible();
    // Expanded — Inspector tabs + Overlay content are now reachable.
    await expect(page.getByRole("tab", { name: "Overlay" })).toBeVisible();
    await expect(page.getByTestId("view-tab")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-sheet-half-390x844");
  });

  test("app-mobile-sheet-full-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      { mobileSheetSnap: "full" },
      { width: 390, height: 844 },
    );

    await expect(page.getByTestId("mobile-sheet")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overlay" })).toBeVisible();
    await expect(page.getByTestId("view-tab")).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-sheet-full-390x844");
  });

  test("app-mobile-sheet-song-390x844", async ({ page }) => {
    await loadVisualState(
      page,
      { mobileSheetSnap: "full" },
      { width: 390, height: 844 },
    );

    await expect(page.getByTestId("mobile-sheet")).toBeVisible();
    // Switch to the Song tab — key/scale, progression, time signature, tempo,
    // backing track + Instruments toggles.
    await page.getByRole("tab", { name: "Song" }).click();
    await expect(page.getByRole("button", { name: "Sequence" })).toBeVisible();

    await expectFullPageVisual(page, "app-mobile-sheet-song-390x844");
  });
});
