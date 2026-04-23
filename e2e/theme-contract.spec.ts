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
    // --chrome-bg: #f8fafc; in themes.css
    expect(chromeBg.toLowerCase()).toBe("#f8fafc");
  });

  test("modern-light fretboard should use maple tokens", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    const woodTop = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--fretboard-wood-top").trim()
    );
    // #f5e6c8
    expect(woodTop.toLowerCase()).toBe("#f5e6c8");

    const woodGrain = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--fretboard-wood-grain").trim()
    );
    // rgba(90, 60, 40, 0.08)
    expect(woodGrain.replace(/\s/g, "")).toBe("rgba(90,60,40,0.08)");
  });

  test("modern-light should use solid active styling for chips", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    const activeBg = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--token-chip-active-bg").trim()
    );
    // #2563eb
    expect(activeBg.toLowerCase()).toBe("#2563eb");

    const tonicBg = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--token-chip-tonic-bg").trim()
    );
    // #ea580c
    expect(tonicBg.toLowerCase()).toBe("#ea580c");
  });

  test("modern-light should use solid active styling for navigation", async ({ page }) => {
    // Desktop layout
    await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });
    
    // The active tab in theory controls should have solid blue bg
    // Using a more stable way to check the resolved color of an active element
    const activeTab = page.locator('.theory-browser-tab.active');
    if (await activeTab.count() > 0) {
      const bgColor = await activeTab.evaluate(el => getComputedStyle(el).backgroundColor);
      // rgb(37, 99, 235) is #2563eb
      expect(bgColor.replace(/\s/g, "")).toBe("rgb(37,99,235)");
    }
  });

  test("modern-dark should use dark wood tokens", async ({ page }) => {
    await loadVisualState(page, { theme: "dark" });
    
    const woodTop = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--fretboard-wood-top").trim()
    );
    // #160d07 in tokens.css
    expect(woodTop.toLowerCase()).toBe("#160d07");
  });

  test("should apply modern-dark theme when dark is selected", async ({ page }) => {
    await loadVisualState(page, { theme: "dark" });
    
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("modern-dark");
  });

  test("modern-dark active shared controls should use cyan-like treatment", async ({ page }) => {
    // Desktop layout to ensure all controls are visible
    await loadVisualState(page, { theme: "dark" }, { width: 1280, height: 900 });
    
    // Wait for the controls to be loaded (they are lazy-loaded)
    await expect(page.getByTestId("theory-controls")).toBeVisible();
    
    // Check representative active controls: Root C, Note Labels "Notes", Fingering Pattern "All", Mode "Parallel"
    // Using aria-pressed="true" as a stable selector for active state
    const selectors = [
      'button[aria-pressed="true"]',
      'button[aria-selected="true"]'
    ];

    let found = false;
    for (const selector of selectors) {
      const activeEls = page.locator(selector);
      const count = await activeEls.count();
      
      for (let i = 0; i < count; i++) {
        const activeEl = activeEls.nth(i);
        // Only check buttons that are likely shared controls (toggle-btn or note-btn)
        // We can check if they are inside theory-controls or dashboard-card-configuration
        const isSharedControl = await activeEl.evaluate((el) => {
          return el.closest('[data-testid="theory-controls"]') || 
                 el.closest('[data-testid="dashboard-card-configuration"]');
        });
        
        if (!isSharedControl) continue;
        found = true;

        const styles = await activeEl.evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            backgroundImage: cs.backgroundImage,
            borderColor: cs.borderColor,
            color: cs.color
          };
        });

        // Assert it's a gradient, not "none"
        expect(styles.backgroundImage).not.toBe('none');
        
        // Assert borderColor is cyan-like: high G and B channels
        const rgbMatch = styles.borderColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const g = Number(rgbMatch[2]);
          const b = Number(rgbMatch[3]);
          // Blue token (59, 130, 246) has G=130. Cyan-like should be higher.
          expect(g).toBeGreaterThan(140);
          expect(b).toBeGreaterThan(180);
        }
      }
    }
    expect(found).toBe(true);
  });

  test("modern-light active shared controls should remain solid blue", async ({ page }) => {
    await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });
    
    // Wait for the controls to be loaded (they are lazy-loaded)
    await expect(page.getByTestId("theory-controls")).toBeVisible();
    
    // Fingering Pattern "All" or Note Labels "Notes"
    const activeEl = page.locator('button[aria-pressed="true"]').first();
    await expect(activeEl).toBeVisible();

    const styles = await activeEl.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        backgroundImage: cs.backgroundImage,
        backgroundColor: cs.backgroundColor,
      };
    });

    // Light mode should NOT have a gradient background
    expect(styles.backgroundImage).toBe('none');
    
    // Should be the solid blue: #1d4ed8 -> rgb(29, 78, 216)
    expect(styles.backgroundColor.replace(/\s/g, "")).toBe("rgb(29,78,216)");
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
    
    // Check --disabled-opacity is 0.4
    const opacity = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--disabled-opacity").trim()
    );
    expect(opacity).toBe("0.4");
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

  test.describe("Interaction Contract", () => {
    const themes = ["light", "dark"] as const;

    // Helper to check if a color is "cyan-like" or matches a specific hex/rgb
    const isCyanLike = (color: string) => {
      const normalized = color.toLowerCase().replace(/\s/g, "");
      // Matches rgb(77, 228, 255), rgba(77, 228, 255, ...), or color(srgb 0.301961 0.894118 1 ...)
      return normalized.includes("77,228,255") || 
             (normalized.includes("0.301961") && normalized.includes("0.894118"));
    };

    for (const theme of themes) {
      test.describe(`${theme} theme`, () => {
        test.beforeEach(async ({ page }) => {
          // Use desktop viewport to ensure all controls are visible
          await loadVisualState(page, { theme }, { width: 1280, height: 900 });
          // Ensure theory controls are visible
          await expect(page.getByTestId("theory-controls")).toBeVisible();
        });

        test("note buttons should have correct hover and focus behavior", async ({ page }) => {
          const theoryControls = page.getByTestId("theory-controls");
          // Use an inactive note button to test hover color change
          const noteBtn = theoryControls
            .getByRole("group", { name: "Note selector" })
            .getByRole("button", { pressed: false })
            .first();
          await expect(noteBtn).toBeVisible();

          // Hover state
          await noteBtn.hover();
          const hoverStyles = await noteBtn.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              color: cs.color,
              borderColor: cs.borderColor,
            };
          });

          if (theme === "light") {
            // --chrome-fg: #0f172a -> rgb(15, 23, 42)
            expect(hoverStyles.color.replace(/\s/g, "")).toBe("rgb(15,23,42)");
            // --accent-primary: #2563eb -> rgb(37, 99, 235)
            expect(hoverStyles.borderColor.replace(/\s/g, "")).toBe("rgb(37,99,235)");
          } else {
            // In dark mode, note buttons use white for hover color
            expect(hoverStyles.color.replace(/\s/g, "")).toBe("rgb(255,255,255)");
            // border-color: rgb(77 228 255 / 0.38)
            expect(isCyanLike(hoverStyles.borderColor)).toBe(true);
          }

          // Focus state
          await noteBtn.focus();
          const focusStyles = await noteBtn.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              outlineStyle: cs.outlineStyle,
              outlineColor: cs.outlineColor,
              outlineWidth: cs.outlineWidth,
            };
          });

          expect(focusStyles.outlineStyle).toBe("solid");
          expect(focusStyles.outlineWidth).toBe("2px");
          if (theme === "light") {
            // In modern-light, focus-ring uses --neon-cyan which is #0891b2 -> rgb(8, 145, 178)
            expect(focusStyles.outlineColor.replace(/\s/g, "")).toBe("rgb(8,145,178)");
          } else {
            // --neon-cyan: #4DE4FF -> rgb(77, 228, 255)
            expect(focusStyles.outlineColor.replace(/\s/g, "")).toBe("rgb(77,228,255)");
          }
        });

        test("ToggleBar buttons should only change color when unselected", async ({ page }) => {
          const theoryControls = page.getByTestId("theory-controls");
          
          // Root C is usually active by default
          const activeToggle = theoryControls.locator('button[aria-pressed="true"]').first();
          const inactiveToggle = theoryControls.locator('button[aria-pressed="false"]').first();
          
          await expect(activeToggle).toBeVisible();
          await expect(inactiveToggle).toBeVisible();

          // Inactive hover: should change color
          const inactiveBefore = await inactiveToggle.evaluate((el) => getComputedStyle(el).color);
          await inactiveToggle.hover();
          const inactiveAfter = await inactiveToggle.evaluate((el) => getComputedStyle(el).color);
          expect(inactiveAfter).not.toBe(inactiveBefore);

          if (theme === "light") {
            expect(inactiveAfter.replace(/\s/g, "")).toBe("rgb(15,23,42)"); // --chrome-fg
          }

          // Active hover: should NOT change color (or change only very slightly/remain in active spectrum)
          const activeBefore = await activeToggle.evaluate((el) => getComputedStyle(el).color);
          await activeToggle.hover();
          const activeAfter = await activeToggle.evaluate((el) => getComputedStyle(el).color);
          
          if (theme === "light") {
             expect(activeAfter).toBe(activeBefore);
          } else {
             // In dark mode, we allow it to stay white/nearly white
             const isWhiteOrNearWhite = (c: string) => {
               const match = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
               if (!match) return false;
               return Number(match[1]) > 230 && Number(match[2]) > 230 && Number(match[3]) > 230;
             };
             expect(isWhiteOrNearWhite(activeAfter)).toBe(true);
          }
        });

        test("labeled select should have correct hover and focus behavior", async ({ page }) => {
          const theoryControls = page.getByTestId("theory-controls");
          const select = theoryControls.getByLabel("Scale Family");
          await expect(select).toBeVisible();

          // Hover
          await select.hover();
          const hoverBorder = await select.evaluate((el) => getComputedStyle(el).borderColor);
          if (theme === "light") {
            expect(hoverBorder.replace(/\s/g, "")).toBe("rgb(37,99,235)"); // --interactive-primary
          } else {
            // border-color: color-mix(in srgb, var(--neon-cyan) 48%, transparent)
            expect(isCyanLike(hoverBorder)).toBe(true);
          }

          // Focus
          await select.focus();
          const focusOutline = await select.evaluate((el) => getComputedStyle(el).outlineStyle);
          expect(focusOutline).toBe("solid");
        });

        test("theory browser selector and nav buttons consistency", async ({ page }) => {
          const theoryControls = page.getByTestId("theory-controls");
          const browserMain = theoryControls.getByRole("group", { name: /Browse/i });
          
          // selectorContainer is the div with theory-browser-selector class
          const selectorContainer = browserMain.locator('div[class*="theory-browser-selector"]').first();
          const navBtn = browserMain.getByRole("button").first();

          await expect(selectorContainer).toBeVisible();
          await expect(navBtn).toBeVisible();

          // Selector hover: should change background
          const selBefore = await selectorContainer.evaluate((el) => getComputedStyle(el).backgroundColor);
          await selectorContainer.hover();
          const selAfter = await selectorContainer.evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(selAfter).not.toBe(selBefore);

          // Nav button hover: should change background
          const navBefore = await navBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
          await navBtn.hover();
          const navAfter = await navBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(navAfter).not.toBe(navBefore);

          // Focus visibility: should show focus ring (using box-shadow in this component)
          await navBtn.focus();
          const navFocus = await navBtn.evaluate((el) => getComputedStyle(el).boxShadow);
          expect(navFocus).toContain("0px 0px 0px 2px inset");
        });
      });
    }
  });
});
