import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility contract for the mobile dock shell.
 *
 * History: the previous always-open vaul sheet failed to forward
 * `modal={false}` to Radix, which permanently aria-hid the whole shell and
 * required a MutationObserver workaround. The dock architecture removed the
 * persistent drawer entirely, so the contract is now:
 *
 * 1. By default NOTHING aria-hides the shell (regression guard against any
 *    future broken non-modal dialog).
 * 2. Genuine modals (the Settings/Help sheets) DO hide the background while
 *    open and restore it on close — Radix's refcounted hideOthers, working
 *    unassisted.
 * 3. The non-modal dock panels (Overlay AND Song) do NOT hide the shell: the
 *    chrome above/below the drawers (board, transport strip, dock tabs) must
 *    stay operable while they are open.
 */

const MOBILE = { width: 390, height: 844 } as const;

async function gotoMobile(page: Page) {
  await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="mobile-shell"]')).toBeVisible();
  await expect(page.locator('[data-testid="mobile-dock"]')).toBeVisible();
}

function shellHiddenState(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-testid="mobile-shell"]');
    const stage = document.querySelector('[data-testid="mobile-stage"]');
    const header = shell?.querySelector('[class*="_header_"]') ?? null;
    const track = shell?.querySelector('[class*="_track_"]') ?? null;
    const read = (el: Element | null) =>
      el
        ? {
            ariaHidden: el.getAttribute("aria-hidden"),
            dataAriaHidden: el.getAttribute("data-aria-hidden"),
          }
        : null;
    return {
      shellAriaHidden: shell?.getAttribute("aria-hidden") ?? null,
      // The shell hosts an aria-live region (rotate overlay), so the
      // aria-hidden package descends into it and hides individual children
      // (stage/header/track) rather than the shell or #root — "effectively
      // hidden" checks the stage's own ancestor chain.
      stageEffectivelyHidden: !!stage?.closest('[aria-hidden="true"]'),
      stage: read(stage),
      header: read(header),
      track: read(track),
      // Count of elements carrying the aria-hidden package's marker inside
      // the shell (should be 0 when no modal is open).
      spuriousMarkerCount: shell
        ? shell.querySelectorAll('[data-aria-hidden="true"]').length
        : -1,
    };
  });
}

test.describe("mobile dock shell accessibility", () => {
  test("nothing aria-hides the shell by default", async ({ page }) => {
    await gotoMobile(page);

    const state = await shellHiddenState(page);
    expect(state.shellAriaHidden).toBeNull();
    expect(state.stage).not.toBeNull();
    expect(state.stage!.ariaHidden).toBeNull();
    expect(state.stage!.dataAriaHidden).toBeNull();
    expect(state.header).not.toBeNull();
    expect(state.header!.ariaHidden).toBeNull();
    expect(state.track).not.toBeNull();
    expect(state.track!.ariaHidden).toBeNull();
    expect(state.spuriousMarkerCount).toBe(0);
  });

  test("the non-modal Overlay panel keeps the stage reachable", async ({ page }) => {
    await gotoMobile(page);

    await page.getByTestId("dock-toggle-overlay").click();
    await expect(page.getByTestId("mobile-overlay-panel")).toBeVisible();

    const state = await shellHiddenState(page);
    // The board must remain operable while the Overlay panel is open.
    expect(state.shellAriaHidden).toBeNull();
    expect(state.stage!.ariaHidden).toBeNull();
    expect(state.spuriousMarkerCount).toBe(0);

    // And the panel is a labelled non-modal dialog.
    const panel = page.getByTestId("mobile-overlay-panel");
    await expect(panel).toHaveAttribute("role", "dialog");
    await expect(panel).not.toHaveAttribute("aria-modal", "true");
  });

  test("the non-modal Song panel keeps the shell reachable and closes on Escape", async ({
    page,
  }) => {
    await gotoMobile(page);

    await page.getByTestId("dock-toggle-song").click();
    await expect(page.getByTestId("mobile-song-panel")).toBeVisible();

    // Same contract as the Overlay panel: nothing gets aria-hidden — the
    // transport strip and dock tabs around the drawer stay operable.
    const state = await shellHiddenState(page);
    expect(state.shellAriaHidden).toBeNull();
    expect(state.stageEffectivelyHidden).toBe(false);
    expect(state.spuriousMarkerCount).toBe(0);

    const panel = page.getByTestId("mobile-song-panel");
    await expect(panel).toHaveAttribute("role", "dialog");
    await expect(panel).not.toHaveAttribute("aria-modal", "true");
    // The dock tabs stay visible under the open drawer.
    await expect(page.getByTestId("dock-toggle-overlay")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("mobile-song-panel")).toHaveCount(0);
    // Focus returns to the owning dock toggle.
    await expect(page.getByTestId("dock-toggle-song")).toBeFocused();
  });

  test("the modal Settings sheet hides the background and restores it on close", async ({
    page,
  }) => {
    await gotoMobile(page);

    // Open Settings via the overflow menu (mobile presents actions in a menu).
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page.locator('[data-testid="adaptive-modal-sheet"]')).toBeVisible();

    await expect
      .poll(async () => (await shellHiddenState(page)).stageEffectivelyHidden)
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-testid="adaptive-modal-sheet"]'),
    ).toHaveCount(0);

    await expect
      .poll(async () => (await shellHiddenState(page)).stageEffectivelyHidden)
      .toBe(false);
    const restored = await shellHiddenState(page);
    expect(restored.spuriousMarkerCount).toBe(0);
  });
});
