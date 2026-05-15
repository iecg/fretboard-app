import { test } from "@playwright/test";
import { expectFullPageVisual, prepareVisualPage } from "./visual-helpers";

test.describe("Inspector Preview Visual", () => {
  test("inspector-preview-default-1280x900", async ({ page }) => {
    await page.goto("/?inspector=tabs");
    await prepareVisualPage(page, { width: 1280, height: 900 }, { goto: false });
    await expectFullPageVisual(page, "inspector-preview-default-1280x900");
  });
});
