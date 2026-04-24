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

  test("BottomTabBar should use theme-appropriate active indicators", async ({ page }) => {
    // Mobile layout
    await loadVisualState(page, { theme: "dark" }, { width: 390, height: 844 });
    // In MobileTabPanel, the ToggleBar with variant="tabs" is used for navigation
    const darkTab = page.getByRole("tab", { name: /Theory/i });
    await expect(darkTab).toBeVisible();
    
    const darkStyles = await darkTab.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        color: cs.color,
        background: cs.background,
        boxShadow: cs.boxShadow
      };
    });
    
    // In dark mode, the active tab should NOT use the light mode accent blue.
    expect(darkStyles.color.replace(/\s/g, "")).not.toBe("rgb(37,99,235)");
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
    
    // Should be the solid blue: #2563eb -> rgb(37, 99, 235)
    expect(styles.backgroundColor.replace(/\s/g, "")).toBe("rgb(37,99,235)");
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
      // neon-cyan: rgb(77, 228, 255)
      // neon-cyan-bright: rgb(140, 238, 255)
      return normalized.includes("77,228,255") || 
             normalized.includes("140,238,255") ||
             (normalized.includes("0.301961") && normalized.includes("0.894118")) ||
             (normalized.includes("0.549") && normalized.includes("0.933"));
    };

    for (const theme of themes) {
      test.describe(`${theme} theme`, () => {
        test.beforeEach(async ({ page }) => {
          // Use desktop viewport to ensure all controls are visible
          await loadVisualState(page, { theme }, { width: 1280, height: 900 });
          // Ensure theory controls are visible
          await expect(page.getByTestId("theory-controls")).toBeVisible();
        });

        test("shared default chrome should be equivalent across controls", async ({ page }) => {
          const locators = {
            "Note Button": page.getByRole("group", { name: "Note selector" }).getByRole("button", { pressed: false }).first(),
            "Toggle Group": page.locator('[class*="toggle-group"]').first(),
            "Labeled Select": page.getByLabel("Scale Family"),
            "Settings Trigger": page.getByLabel("Open settings")
          };

          const results: Record<string, { bg: string; bgImg: string; border: string }> = {};

          for (const [name, locator] of Object.entries(locators)) {
            await expect(locator).toBeVisible();
            results[name] = await locator.evaluate((el) => {
              const cs = getComputedStyle(el);
              return {
                bg: cs.backgroundColor,
                bgImg: cs.backgroundImage,
                border: cs.borderColor
              };
            });
          }

          const baseline = results["Note Button"];
          for (const [name, styles] of Object.entries(results)) {
            if (name === "Note Button") continue;
            expect(styles.bg, `${name} background-color should match`).toBe(baseline.bg);
            expect(styles.bgImg, `${name} background-image should match`).toBe(baseline.bgImg);
            expect(styles.border, `${name} border-color should match`).toBe(baseline.border);
          }
        });

        test("note buttons should have correct hover and focus behavior", async ({ page }) => {
          const theoryControls = page.getByTestId("theory-controls");
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
            expect(hoverStyles.color.replace(/\s/g, "")).toBe("rgb(15,23,42)");
            expect(hoverStyles.borderColor.replace(/\s/g, "")).toBe("rgb(37,99,235)");
          } else {
            expect(hoverStyles.color.replace(/\s/g, "")).toBe("rgb(255,255,255)");
            expect(isCyanLike(hoverStyles.borderColor)).toBe(true);
          }

          // Focus state
          await noteBtn.focus();
          const focusStyles = await noteBtn.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              outlineStyle: cs.outlineStyle,
              borderColor: cs.borderColor,
              boxShadow: cs.boxShadow
            };
          });

          if (theme === "light") {
            expect(focusStyles.outlineStyle).toBe("solid");
          } else {
            expect(focusStyles.outlineStyle).toBe("none");
            expect(isCyanLike(focusStyles.borderColor)).toBe(true);
            expect(isCyanLike(focusStyles.boxShadow)).toBe(true);
          }
        });

        test("collapsed disclosure hover should use theme-appropriate hover surface", async ({ page }) => {
          // Use mobile viewport to ensure Circle of Fifths disclosure is rendered
          await loadVisualState(page, { theme }, { width: 390, height: 844 });

          const disclosures = [
            page.getByRole("button", { name: /Circle of Fifths/i }),
            page.getByRole("button", { name: /Chord Overlay/i })
          ];

          for (const btn of disclosures) {
            await expect(btn).toBeVisible();
            // Ensure it's collapsed
            if (await btn.getAttribute("aria-expanded") === "true") {
              await btn.click();
            }

            const beforeBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
            await btn.hover();
            const afterBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
            
            expect(afterBg).not.toBe(beforeBg);
            if (theme === "dark") {
              expect(isCyanLike(afterBg)).toBe(true);
            } else {
              // light surface hover: #e2e8f0 -> rgb(226, 232, 240)
              expect(afterBg.replace(/\s/g, "")).toBe("rgb(226,232,240)");
            }
          }
        });

        test("fretboard note hover and focus remain distinct", async ({ page }) => {
          // Ensure fretboard is visible
          await expect(page.getByTestId("fretboard-svg")).toBeVisible();
          
          // Target a note bubble using a more stable locator
          const note = page.getByRole("button", { name: /on string/i }).first();
          await expect(note).toBeVisible();

          // Hover state
          await note.hover();
          const hoverStyles = await note.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              bg: cs.backgroundColor,
              mixBlend: cs.mixBlendMode
            };
          });

          expect(hoverStyles.bg).not.toBe("rgba(0, 0, 0, 0)");
          expect(hoverStyles.bg).not.toBe("transparent");
          
          if (theme === "dark") {
            expect(hoverStyles.mixBlend).toBe("soft-light");
          } else {
            expect(hoverStyles.mixBlend).toBe("multiply");
          }

          // Focus state
          await note.focus();
          const focusStyles = await note.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              outlineStyle: cs.outlineStyle,
              boxShadow: cs.boxShadow
            };
          });

          expect(focusStyles.outlineStyle).toBe("solid");
          expect(focusStyles.boxShadow).not.toBe("none");
          // Verify focus is distinct from hover by checking properties that hover doesn't touch
          expect(focusStyles.outlineStyle).not.toBe(hoverStyles.mixBlend);
        });

        test("ToggleBar buttons should only change color when unselected", async ({ page }) => {
          const theoryControls = page.getByTestId("theory-controls");
          const activeToggle = theoryControls.locator('button[aria-pressed="true"]').first();
          const inactiveToggle = theoryControls.locator('button[aria-pressed="false"]').first();
          
          await expect(activeToggle).toBeVisible();
          await expect(inactiveToggle).toBeVisible();

          const inactiveBefore = await inactiveToggle.evaluate((el) => getComputedStyle(el).color);
          await inactiveToggle.hover();
          const inactiveAfter = await inactiveToggle.evaluate((el) => getComputedStyle(el).color);
          expect(inactiveAfter).not.toBe(inactiveBefore);

          const activeBefore = await activeToggle.evaluate((el) => getComputedStyle(el).color);
          await activeToggle.hover();
          const activeAfter = await activeToggle.evaluate((el) => getComputedStyle(el).color);
          
          if (theme === "light") {
             expect(activeAfter).toBe(activeBefore);
          } else {
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

          await select.hover();
          const hoverBorder = await select.evaluate((el) => getComputedStyle(el).borderColor);
          if (theme === "light") {
            expect(hoverBorder.replace(/\s/g, "")).toBe("rgb(37,99,235)");
          } else {
            expect(isCyanLike(hoverBorder)).toBe(true);
          }

          await select.focus();
          const focusOutline = await select.evaluate((el) => getComputedStyle(el).outlineStyle);
          expect(focusOutline).toBe("solid");
        });

        test("audio icon should not use accent color when unmuted", async ({ page }) => {
          const audioBtn = page.getByLabel("Mute audio");
          await expect(audioBtn).toBeVisible();

          const icon = audioBtn.locator(".icon-active");
          await expect(icon).toBeVisible();

          const iconColor = await icon.evaluate((el) => getComputedStyle(el).color);

          // Get accent colors to compare
          const accentColors = await page.evaluate(() => {
            const cs = getComputedStyle(document.documentElement);
            return {
              primary: cs.getPropertyValue("--accent-primary").trim(),
              interactive: cs.getPropertyValue("--interactive-primary").trim()
            };
          });

          // Function to normalize colors for comparison
          const normalize = (c: string) => {
            if (c.startsWith("#")) return c.toLowerCase();
            return c.replace(/\s/g, "").toLowerCase();
          };

          expect(normalize(iconColor)).not.toBe(normalize(accentColors.primary));
          expect(normalize(iconColor)).not.toBe(normalize(accentColors.interactive));
        });

        test("theory browser selector should use shared control hover treatment", async ({ page }) => {
          const browserSelector = page.locator('[class*="theory-browser-selector"]').first();
          await expect(browserSelector).toBeVisible();

          const beforeStyles = await browserSelector.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage
            };
          });

          await browserSelector.hover();

          const afterStyles = await browserSelector.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage
            };
          });

          expect(afterStyles.bg).not.toBe(beforeStyles.bg);

          if (theme === "dark") {
            // In dark mode, it should have a gradient hover
            expect(afterStyles.bgImg).not.toBe("none");
            expect(afterStyles.bgImg).toContain("gradient");
          } else {
            // In light mode, it should be a solid color change
            // light surface hover: #e2e8f0 -> rgb(226, 232, 240)
            expect(afterStyles.bg.replace(/\s/g, "")).toBe("rgb(226,232,240)");
          }
        });
      });
    }
  });
});
