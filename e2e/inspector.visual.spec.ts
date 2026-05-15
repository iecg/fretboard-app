import { test } from "@playwright/test";
import { expectFullPageVisual, prepareVisualPage } from "./visual-helpers";

test.describe("Inspector Visual", () => {
  test("inspector-default-1280x900", async ({ page }) => {
    await prepareVisualPage(page, { width: 1280, height: 900 });
    await expectFullPageVisual(page, "inspector-default-1280x900");
  });
});
