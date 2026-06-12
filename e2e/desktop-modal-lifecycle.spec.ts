import { expect, test, type Page } from "@playwright/test";

/**
 * Regression guard for desktop modal teardown.
 *
 * The desktop Help dialog and Settings drawer are Radix `Dialog`s. A previous
 * implementation `forceMount`ed `Dialog.Content` and delegated unmount to
 * Framer Motion's `AnimatePresence`. AnimatePresence never released the
 * portaled `asChild` subtree, so Radix `Dialog.Content` stayed mounted forever
 * after close — and because Radix ties its modal side effects (scroll lock +
 * `pointer-events: none` via RemoveScroll, the focus trap + guards via
 * FocusScope) to Content being mounted, the whole desktop app was left frozen
 * to pointer input and focus was trapped on the (now invisible) close button.
 *
 * These tests assert the modals fully tear down on close: Content unmounts,
 * the page becomes interactive again, and focus returns to the trigger.
 */

const DESKTOP = { width: 1440, height: 900 } as const;

async function gotoDesktop(page: Page) {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await page.goto("/", { waitUntil: "networkidle" });
  // Desktop tier renders inline header buttons (not the mobile overflow menu).
  await expect(page.getByRole("button", { name: "Open help" })).toBeVisible();
}

function bodyPointerEvents(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).pointerEvents);
}

function activeElementLabel(page: Page) {
  return page.evaluate(
    () =>
      document.activeElement?.getAttribute("aria-label") ??
      document.activeElement?.tagName ??
      null,
  );
}

test.describe("desktop modal lifecycle", () => {
  test("Help dialog fully unmounts on close and restores interactivity + focus", async ({
    page,
  }) => {
    await gotoDesktop(page);

    await page.getByRole("button", { name: "Open help" }).click();
    await expect(page.locator('[data-testid="help-modal"]')).toBeVisible();
    // While open the page is intentionally pointer-locked behind the modal.
    expect(await bodyPointerEvents(page)).toBe("none");

    await page.keyboard.press("Escape");

    // The dialog must actually unmount (not linger at data-state="closed").
    await expect(page.locator('[data-testid="help-modal"]')).toHaveCount(0);

    // The page is interactive again — no lingering RemoveScroll pointer lock.
    await expect.poll(() => bodyPointerEvents(page)).not.toBe("none");

    // Focus returns to the Help trigger (keyboard / screen-reader users).
    await expect.poll(() => activeElementLabel(page)).toBe("Open help");
  });

  test("Settings drawer fully unmounts on close and restores interactivity + focus", async ({
    page,
  }) => {
    await gotoDesktop(page);

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page.locator('[data-testid="settings-drawer"]')).toBeVisible();
    expect(await bodyPointerEvents(page)).toBe("none");

    await page.keyboard.press("Escape");

    await expect(page.locator('[data-testid="settings-drawer"]')).toHaveCount(0);
    await expect.poll(() => bodyPointerEvents(page)).not.toBe("none");
    await expect.poll(() => activeElementLabel(page)).toBe("Open settings");
  });
});
