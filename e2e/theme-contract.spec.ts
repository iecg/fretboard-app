import { test, expect } from "@playwright/test";
import { loadVisualState } from "./visual-helpers";

test.describe("Theme Contract", () => {
  test("should apply modern-light theme when light is selected", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    // Check that data-theme is correctly set on documentElement
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("modern-light");
    
    // Check background color matches modern-light --bg-color (#f8fafc)
    // Playwright returns rgb values
    const bgColor = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--bg-color").trim()
    );
    expect(bgColor.toLowerCase()).toBe("#f8fafc");

    // Check a semantic token
    const chromeBg = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--chrome-bg").trim()
    );
    // --chrome-bg: #f1f5f9; in themes.css
    expect(chromeBg.toLowerCase()).toBe("#f1f5f9");
  });

  test("should apply modern-dark theme when dark is selected", async ({ page }) => {
    await loadVisualState(page, { theme: "dark" });
    
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("modern-dark");
  });

  test("Circle of Fifths should use light colors in light mode", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    // Check Circle center start color
    const cofContainer = page.getByTestId("circle-of-fifths");
    const centerStart = await cofContainer.evaluate((el) => {
      // Force resolution of color-mix by applying it to a temporary element
      const temp = document.createElement("div");
      temp.style.color = getComputedStyle(el).getPropertyValue("--cof-center-start");
      document.body.appendChild(temp);
      const resolved = getComputedStyle(temp).color;
      document.body.removeChild(temp);
      return resolved;
    });
    
    // In light mode: should be white or nearly white
    // Handle both rgb(255, 255, 255) and color(srgb 1 1 1) formats
    expect(centerStart).toMatch(/255|1 1 1/);
  });

  test("Circle of Fifths should use dark colors in dark mode", async ({ page }) => {
    await loadVisualState(page, { theme: "dark" });
    
    const cofContainer = page.getByTestId("circle-of-fifths");
    const centerStart = await cofContainer.evaluate((el) => 
      getComputedStyle(el).getPropertyValue("--cof-center-start").trim()
    );
    
    // In dark mode: rgb(34 40 54 / 0.98)
    expect(centerStart).toContain("34");
    expect(centerStart).toContain("40");
    expect(centerStart).toContain("54");
  });

  test("Disabled controls should have correct opacity in light mode", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    // Check --disabled-opacity is 0.45
    const opacity = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--disabled-opacity").trim()
    );
    expect(opacity).toBe("0.45");
  });

  test("Disabled controls should have correct opacity in dark mode", async ({ page }) => {
    await loadVisualState(page, { theme: "dark" });
    
    const opacity = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--disabled-opacity").trim()
    );
    // In dark mode it should be 0.3 (from tokens.css)
    expect(opacity).toBe("0.3");
  });

  test("should follow system preference (dark)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await loadVisualState(page, { theme: "system" });
    
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("modern-dark");
  });

  test("should follow system preference (light)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await loadVisualState(page, { theme: "system" });
    
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("modern-light");
  });
});
