import { expect, test, type Page } from "@playwright/test";

/**
 * Regression guard for the persistent mobile bottom sheet's accessibility.
 *
 * The always-open, non-modal `MobileSheet` is a vaul `Drawer` rendered with
 * `modal={false}`. vaul 1.1.2 fails to forward that prop to the underlying
 * Radix Dialog, so Radix runs its modal `hideOthers()` and permanently marks
 * the shell (header / progression track / fretboard stage) `aria-hidden="true"`
 * — making the whole app invisible to VoiceOver / TalkBack. `MobileShell`
 * counteracts this with `useUnhideMobileShell`, while still allowing the
 * genuinely-modal Settings / Help sheets to hide the background.
 *
 * These tests assert both halves of that contract on a mobile viewport.
 */

const MOBILE = { width: 390, height: 844 } as const;

async function gotoMobile(page: Page) {
  await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="mobile-shell"]')).toBeVisible();
  // The persistent sheet is always mounted.
  await expect(page.locator('[data-testid="mobile-sheet"]')).toBeVisible();
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
      stage: read(stage),
      header: read(header),
      track: read(track),
      // Count of elements still carrying the aria-hidden package's spurious
      // marker inside the shell (should be 0 when no modal is open).
      spuriousMarkerCount: shell
        ? shell.querySelectorAll('[data-aria-hidden="true"]').length
        : -1,
    };
  });
}

test.describe("mobile persistent sheet accessibility", () => {
  test("does not aria-hide the fretboard, header, or track while the persistent sheet is open", async ({
    page,
  }) => {
    await gotoMobile(page);

    const state = await shellHiddenState(page);

    // The fretboard stage must be reachable by assistive tech.
    expect(state.stage).not.toBeNull();
    expect(state.stage!.ariaHidden).toBeNull();
    expect(state.stage!.dataAriaHidden).toBeNull();

    // Header and progression track too.
    expect(state.header).not.toBeNull();
    expect(state.header!.ariaHidden).toBeNull();
    expect(state.track).not.toBeNull();
    expect(state.track!.ariaHidden).toBeNull();

    // No element under the shell carries the aria-hidden package's marker.
    expect(state.spuriousMarkerCount).toBe(0);

    // The persistent sheet's own content must remain reachable (it is the
    // dialog labeled by its visually-hidden Title).
    const sheetDialog = page.getByRole("dialog");
    await expect(sheetDialog.first()).toBeVisible();
  });

  test("still hides the background for the modal Settings sheet, and restores it on close", async ({
    page,
  }) => {
    await gotoMobile(page);

    // Open Settings via the overflow menu (mobile presents actions in a menu).
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();

    // The modal Settings sheet is now open.
    await expect(page.locator('[data-testid="adaptive-modal-sheet"]')).toBeVisible();

    // Modal behavior: the background shell IS aria-hidden while Settings is open.
    const open = await shellHiddenState(page);
    expect(open.stage!.ariaHidden).toBe("true");

    // Close Settings (Escape dismisses the vaul modal sheet).
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-testid="adaptive-modal-sheet"]'),
    ).toHaveCount(0);

    // The observer re-asserts: the shell is reachable again.
    await expect
      .poll(async () => (await shellHiddenState(page)).stage!.ariaHidden)
      .toBeNull();
    const restored = await shellHiddenState(page);
    expect(restored.spuriousMarkerCount).toBe(0);
  });
});
