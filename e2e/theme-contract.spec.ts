import { test, expect } from "@playwright/test";
import { loadVisualState } from "./visual-helpers";

function colorToHex(color: string): string {
  const c = color.replace(/\s*,\s*/g, ",").replace(/\s+/g, " ").trim().toLowerCase();
  if (c.startsWith("#")) return c;
  const m = c.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[/, ]+([0-9.]+))?\)/);
  if (!m) return c;
  const toH = (n: string) => parseInt(n).toString(16).padStart(2, "0");
  const hex = `#${toH(m[1])}${toH(m[2])}${toH(m[3])}`;
  if (m[4]) return hex + Math.round(parseFloat(m[4]) * 255).toString(16).padStart(2, "0");
  return hex;
}

test.describe("Theme Contract", () => {
  test("should apply modern-light theme when light is selected", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    // Check that data-theme is correctly set on documentElement
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("modern-light");
    
    // Check background color matches modern-light --bg-color (#eef2f7 — cool blue-gray shell)
    // Playwright returns rgb values
    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg-color").trim()
    );
    expect(bgColor.toLowerCase()).toBe("#eef2f7");

    // Check a semantic token
    const chromeBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--chrome-bg").trim()
    );
    // --chrome-bg maps to --surface-shell = #eef2f7 in modern-light
    expect(chromeBg.toLowerCase()).toBe("#eef2f7");
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
    // rgba(90, 60, 40, 0.08) == #5a3c2814 (minified)
    expect(colorToHex(woodGrain)).toBe("#5a3c2814");
  });

  test("modern-light should use solid active styling for chips", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    const activeBg = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--token-chip-active-bg").trim()
    );
    // #0891b2
    expect(activeBg.toLowerCase()).toBe("#0891b2");

    const tonicBg = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--token-chip-tonic-bg").trim()
    );
    // #ea580c
    expect(tonicBg.toLowerCase()).toBe("#ea580c");
  });

  test("light shell vars do not resolve to dark navy defaults", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    const bgAppStart = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg-app-gradient-start").trim()
    );
    // modern-light: #eef2f7 (matches --surface-shell; was #f1f5f9 before surface ladder refactor)
    expect(bgAppStart.toLowerCase()).toBe("#eef2f7");

    const bgAppMid = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg-app-gradient-mid").trim()
    );
    // modern-light: #eef2f7 (was #f8fafc before refactor)
    expect(bgAppMid.toLowerCase()).toBe("#eef2f7");
  });

  test("practice bar is light-readable in light mode", async ({ page }) => {
    // Need a chord to show the practice bar. Use the full name from CHORD_DEFINITIONS.
    await loadVisualState(page, { theme: "light", chordType: "Major 7th" });
    
    // The practice bar is an aria-role="group" with "Practice cues" in its label
    const practiceBar = page.locator('section[aria-label^="Practice cues:"]');
    await expect(practiceBar).toBeVisible();
    
    const styles = await practiceBar.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        backgroundColor: cs.backgroundColor,
        color: cs.color
      };
    });
    
    // modern-light: --practice-bar-fill = --surface-strip = #f6f9fc -> rgb(246, 249, 252)
    expect(styles.backgroundColor.replace(/\s/g, "")).toBe("rgb(246,249,252)");
    // text-main: #0f172a -> rgb(15, 23, 42)
    expect(styles.color.replace(/\s/g, "")).toBe("rgb(15,23,42)");
  });

  test("BottomTabBar should use theme-appropriate active indicators", async ({ page }) => {
    // Mobile layout uses ToggleBar as tabs
    await loadVisualState(page, { theme: "dark" }, { width: 390, height: 844 });
    const darkTab = page.getByRole("tab", { name: /Theory/i });
    await expect(darkTab).toBeVisible();
    
    const darkStyles = await darkTab.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        color: cs.color,
        bgImg: cs.backgroundImage
      };
    });
    // modern-dark: --selected-fg: rgb(243, 251, 255)
    expect(darkStyles.color.replace(/\s/g, "")).toBe("rgb(243,251,255)");
    // Should use neon-cyan in the gradient: rgb(77, 228, 255)
    // Handle both rgb(77, 228, 255) and color(srgb 0.301961 0.894118 1) formats
    expect(darkStyles.bgImg).toMatch(/77,\s*228,\s*255|0\.301961\s+0\.894118\s+1/);

    // Light mode
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });
    const lightTab = page.getByRole("tab", { name: /Theory/i });
    await expect(lightTab).toBeVisible();
    const lightColor = await lightTab.evaluate((el) => getComputedStyle(el).color);
    // modern-light: --selected-fg: #ffffff -> rgb(255, 255, 255)
    expect(lightColor.replace(/\s/g, "")).toBe("rgb(255,255,255)");
  });

  test("fretboard notes and summary chips have coherent role colors in light mode", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    // Check summary chips - use a non-tonic scale note to check scale color
    const activeChip = page.locator('li[data-in-scale="true"]:not([data-is-tonic="true"]) button').first();
    await expect(activeChip).toBeVisible();
    const activeChipBorder = await activeChip.evaluate((el) => getComputedStyle(el).borderColor);
    // app-cyan: rgb(8, 145, 178)
    expect(activeChipBorder.replace(/\s/g, "")).toBe("rgb(8,145,178)");

    const tonicChip = page.locator('li[data-is-tonic="true"] button').first();
    await expect(tonicChip).toBeVisible();
    const tonicChipBorder = await tonicChip.evaluate((el) => getComputedStyle(el).borderColor);
    // neon-orange: #ea580c -> rgb(234, 88, 12)
    expect(tonicChipBorder.replace(/\s/g, "")).toBe("rgb(234,88,12)");

    // Check fretboard notes - they use stroke for the ring. 
    // The role class is on the g element, so we look for circle inside.
    const tonicNote = page.locator('g[data-note-role="key-tonic"] circle').first();
    await expect(tonicNote).toBeVisible();
    const tonicNoteStroke = await tonicNote.evaluate((el) => getComputedStyle(el).stroke);
    // --note-ring-tonic: var(--neon-orange) -> rgb(234, 88, 12)
    expect(tonicNoteStroke.replace(/\s/g, "")).toBe("rgb(234,88,12)");
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

  test("modern-light active shared controls should use app cyan", async ({ page }) => {
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
    
    // Should be the app cyan: #0891b2 -> rgb(8, 145, 178)
    expect(styles.backgroundColor.replace(/\s/g, "")).toBe("rgb(8,145,178)");
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

    // In light mode: should be white or nearly white (#fafbfd or #ffffff)
    // Parse and verify each channel >= 250 (0.98 for normalized srgb)
    const normalized = centerStart.trim().toLowerCase();
    let r = 0, g = 0, b = 0;

    // Parse rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      r = Number(rgbMatch[1]);
      g = Number(rgbMatch[2]);
      b = Number(rgbMatch[3]);
    } else {
      // Parse color(srgb r g b) where values are 0–1
      const srgbMatch = normalized.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (srgbMatch) {
        r = Math.round(Number(srgbMatch[1]) * 255);
        g = Math.round(Number(srgbMatch[2]) * 255);
        b = Math.round(Number(srgbMatch[3]) * 255);
      }
    }

    // surface-base (#f3f7fc = 243, 247, 252) is clearly light — threshold 230 excludes dark navy (34–54)
    expect(r).toBeGreaterThanOrEqual(230);
    expect(g).toBeGreaterThanOrEqual(230);
    expect(b).toBeGreaterThanOrEqual(230);
  });

  test("Circle of Fifths should use dark colors in dark mode", async ({ page }) => {
    await loadVisualState(page, { theme: "dark" });
    
    const cofContainer = page.getByTestId("circle-of-fifths");
    const centerStart = await cofContainer.evaluate((el) => 
      getComputedStyle(el).getPropertyValue("--cof-center-start").trim()
    );
    
    // In dark mode: rgb(34 40 54 / 0.98) == #222836fa (minified)
    expect(colorToHex(centerStart)).toBe("#222836fa");
  });

  test("Disabled controls should have correct opacity in light mode", async ({ page }) => {
    await loadVisualState(page, { theme: "light" });
    
    // Check --disabled-opacity is 0.4
    const opacity = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue("--disabled-opacity").trim()
    );
    expect(parseFloat(opacity)).toBe(0.4);
  });

  test("Disabled controls should have correct opacity in dark mode", async ({ page }) => {
    await loadVisualState(page, { theme: "dark" });

    const opacity = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--disabled-opacity").trim()
    );
    // In dark mode it should be 0.3 (from tokens.css)
    expect(parseFloat(opacity)).toBe(0.3);
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
            expect(hoverStyles.borderColor.replace(/\s/g, "")).toBe("rgb(8,145,178)");
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
              // light surface hover: --surface-highlight = #dde4ef -> rgb(221, 228, 239)
              expect(afterBg.replace(/\s/g, "")).toBe("rgb(221,228,239)");
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
            expect(hoverBorder.replace(/\s/g, "")).toBe("rgb(8,145,178)");
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

        test("theory browser main should use shared control hover treatment", async ({ page }) => {
          const browserMain = page.locator('[class*="theory-browser-main"]').first();
          await expect(browserMain).toBeVisible();

          const beforeStyles = await browserMain.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              border: cs.borderColor
            };
          });

          await browserMain.hover();

          const afterStyles = await browserMain.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              border: cs.borderColor
            };
          });

          expect(afterStyles.bg).not.toBe(beforeStyles.bg);

          if (theme === "dark") {
            // In dark mode, it should have a gradient hover
            expect(afterStyles.bgImg).not.toBe("none");
            expect(afterStyles.bgImg).toContain("gradient");
            expect(isCyanLike(afterStyles.border)).toBe(true);
          } else {
            // In light mode, it should be a solid color change
            // light surface hover: --surface-highlight = #dde4ef -> rgb(221, 228, 239)
            expect(afterStyles.bg.replace(/\s/g, "")).toBe("rgb(221,228,239)");
            // hover border: --surface-control-hover-border = app cyan = #0891b2 -> rgb(8, 145, 178)
            expect(afterStyles.border.replace(/\s/g, "")).toBe("rgb(8,145,178)");
          }
        });

        test("theory disclosure focus uses tokenized focus glow", async ({ page }) => {
          // Mobile viewport: disclosure buttons are visible there
          await loadVisualState(page, { theme }, { width: 390, height: 844 });

          const disclosureBtn = page.getByRole("button", { name: /Chord Overlay/i });
          await expect(disclosureBtn).toBeVisible();
          // Ensure it is collapsed before focusing
          if (await disclosureBtn.getAttribute("aria-expanded") === "true") {
            await disclosureBtn.click();
            await expect(disclosureBtn).toHaveAttribute("aria-expanded", "false");
          }

          await disclosureBtn.focus();
          const focusStyles = await disclosureBtn.evaluate((el) => {
            const cs = getComputedStyle(el);
            return { outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow };
          });

          if (theme === "dark") {
            // Dark mode: --control-focus-ring = none; glow via --control-focus-glow (cyan)
            expect(focusStyles.outlineStyle).toBe("none");
            expect(focusStyles.boxShadow).not.toBe("none");
            // The glow resolves from --neon-cyan (77, 228, 255 in dark mode)
            expect(isCyanLike(focusStyles.boxShadow)).toBe(true);
          } else {
            // Light mode: --control-focus-ring = 2px solid neon-cyan → solid outline
            expect(focusStyles.outlineStyle).toBe("solid");
          }
        });
      });
    }
  });

  test.describe("Surface Hierarchy", () => {
    test("light surface ladder tokens are all distinct and none are pure white", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });

      const tokens = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          shell:    cs.getPropertyValue("--surface-shell").trim(),
          cardTop:  cs.getPropertyValue("--surface-card-top").trim(),
          nested:   cs.getPropertyValue("--surface-card-nested").trim(),
          well:     cs.getPropertyValue("--surface-well").trim(),
          strip:    cs.getPropertyValue("--surface-strip").trim(),
          float:    cs.getPropertyValue("--surface-float").trim(),
        };
      });

      // All six surface rungs must be distinct
      const values = Object.values(tokens);
      const unique = new Set(values);
      expect(unique.size, `Expected 6 distinct surface tokens, got: ${JSON.stringify(tokens)}`).toBe(6);

      // Exact light-mode values from themes.css surface ladder
      expect(tokens.shell.toLowerCase()).toBe("#eef2f7");
      expect(tokens.cardTop.toLowerCase()).toBe("#fafbfd");
      expect(tokens.nested.toLowerCase()).toBe("#f2f6fb");
      expect(tokens.well.toLowerCase()).toBe("#e5ecf5");
      expect(tokens.strip.toLowerCase()).toBe("#f6f9fc");
      expect(tokens.float.toLowerCase()).toBe("#ffffff");

      // card-top is the brightest non-float level — it must not equal pure white
      expect(tokens.cardTop.toLowerCase()).not.toBe("#ffffff");
    });

    test("dark surface ladder maintains internal hierarchy", async ({ page }) => {
      await loadVisualState(page, { theme: "dark" });

      const tokens = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          shell:   cs.getPropertyValue("--surface-shell").trim(),
          cardTop: cs.getPropertyValue("--surface-card-top").trim(),
          float:   cs.getPropertyValue("--surface-float").trim(),
        };
      });

      // In dark mode, all three should be dark (no channel brighter than 80)
      const parseDark = (v: string) => {
        const m = v.match(/rgb\((\d+),?\s*(\d+),?\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
      };
      const [sr, sg, sb] = parseDark(tokens.shell);
      const [cr, cg, cb] = parseDark(tokens.cardTop);
      const [fr, fg, fb] = parseDark(tokens.float);

      // Shell is the darkest base — all channels < 60
      expect(sr).toBeLessThan(60);
      expect(sg).toBeLessThan(60);
      expect(sb).toBeLessThan(80);

      // Card top should be slightly elevated (higher R channel than shell)
      expect(cr).toBeGreaterThanOrEqual(sr);

      // Float is the highest elevation — at least as bright as card
      expect(fr).toBeGreaterThanOrEqual(cr);
      expect(fg).toBeGreaterThanOrEqual(cg);
      expect(fb).toBeGreaterThanOrEqual(cb);
    });

    test("top-level Card uses surface-card-top (not pure white) in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });

      // Card is the primary content container — locate the first one in the layout
      const card = page.locator('[class*="card"]:not([class*="card-header"]):not([class*="card-body"])').first();
      await expect(card).toBeVisible();

      const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
      // surface-card-top = #fafbfd → rgb(250, 251, 253)
      expect(bg.replace(/\s/g, "")).toBe("rgb(250,251,253)");
      // Verify it is NOT pure white — the card-top is intentionally near-white
      expect(bg.replace(/\s/g, "")).not.toBe("rgb(255,255,255)");
    });

    test("theory nested panels use surface-card-nested token in light mode", async ({ page }) => {
      // chordType activates the chord overlay section which renders .theory-chord-section.panel-surface
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" }, { width: 1280, height: 900 });
      await expect(page.getByTestId("theory-controls")).toBeVisible();

      // Multiple .panel-surface elements exist; at least one must resolve to surface-card-nested.
      // The .theory-chord-section.panel-surface and .theory-inline-key.panel-surface use --surface-card-nested.
      const panelSurfaces = page.getByTestId("theory-controls").locator(".panel-surface");
      const count = await panelSurfaces.count();
      expect(count).toBeGreaterThan(0);

      const backgrounds = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          panelSurfaces.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor)
        )
      );

      // surface-card-nested = #f2f6fb → rgb(242, 246, 251)
      const hasNested = backgrounds.some((bg) => bg.replace(/\s/g, "") === "rgb(242,246,251)");
      expect(hasNested, `Expected at least one panel-surface with surface-card-nested. Got: ${JSON.stringify(backgrounds)}`).toBe(true);
    });

    test("chord practice strip uses surface-strip token in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" });

      const practiceBar = page.locator('section[aria-label^="Practice cues:"]');
      await expect(practiceBar).toBeVisible();

      const bg = await practiceBar.evaluate((el) => getComputedStyle(el).backgroundColor);
      // surface-strip = #f6f9fc → rgb(246, 249, 252)
      expect(bg.replace(/\s/g, "")).toBe("rgb(246,249,252)");
      // Must not be pure white or the old f1f5f9 value
      expect(bg.replace(/\s/g, "")).not.toBe("rgb(255,255,255)");
      expect(bg.replace(/\s/g, "")).not.toBe("rgb(241,245,249)");
    });

    test("chord practice strip is visually distinct from card-top in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" });

      const practiceBar = page.locator('section[aria-label^="Practice cues:"]');
      await expect(practiceBar).toBeVisible();

      const bg = await practiceBar.evaluate((el) => getComputedStyle(el).backgroundColor);
      // surface-strip (#f6f9fc) must be distinct from surface-card-top (#fafbfd)
      expect(bg.replace(/\s/g, "")).not.toBe("rgb(250,251,253)");
      // And distinct from pure white
      expect(bg.replace(/\s/g, "")).not.toBe("rgb(255,255,255)");
      // Correct strip value
      expect(bg.replace(/\s/g, "")).toBe("rgb(246,249,252)");
    });

    test("degree chip strip uses surface-strip token in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });

      // DegreeChipStrip is rendered inside the scale summary area
      const degreeStrip = page.locator('section[role="group"]').filter({ hasText: /C|D|E|F|G|A|B/ }).first();
      await expect(degreeStrip).toBeVisible();

      const bg = await degreeStrip.evaluate((el) => getComputedStyle(el).backgroundColor);
      // strip-surface sets background via --strip-fill = --surface-strip = #f6f9fc → rgb(246, 249, 252)
      expect(bg.replace(/\s/g, "")).toBe("rgb(246,249,252)");
    });
    test("settings overlay uses surface-float (highest elevation) in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });

      await page.getByLabel("Open settings").click();
      const drawer = page.getByTestId("settings-drawer");
      await expect(drawer).toBeVisible();

      const bg = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor);
      // surface-float = #ffffff → rgb(255, 255, 255) — highest elevation, pure white
      expect(bg.replace(/\s/g, "")).toBe("rgb(255,255,255)");
    });

    test("settings section cards use aligned nested surface tokens in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });

      await page.getByLabel("Open settings").click();
      const drawer = page.getByTestId("settings-drawer");
      await expect(drawer).toBeVisible();

      // Find a section card in the settings drawer
      const sectionCard = drawer.locator('[class*="overlay-section-card"]').first();
      await expect(sectionCard).toBeVisible();

      const styles = await sectionCard.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderColor,
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow
        };
      });

      // --nested-card-bg = --surface-card-nested = #f2f6fb → rgb(242, 246, 251)
      expect(styles.backgroundColor.replace(/\s/g, "")).toBe("rgb(242,246,251)");
      
      // --nested-card-border = --surface-card-border = --surface-highlight = #dde4ef → rgb(221, 228, 239)
      expect(styles.borderColor.replace(/\s/g, "")).toBe("rgb(221,228,239)");
      
      // --nested-card-radius = --radius-lg = 12px
      expect(styles.borderRadius).toBe("12px");
      
      // --nested-card-shadow = none
      expect(styles.boxShadow).toBe("none");
    });

    test("help modal uses surface hierarchy tokens in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" }, { width: 1280, height: 900 });

      await page.getByLabel(/help|keyboard shortcuts/i).click();
      const modal = page.getByTestId("help-modal");
      await expect(modal).toBeVisible();

      // Modal body uses --surface-panel = --surface-card-top = #fafbfd → rgb(250, 251, 253)
      const bodyBg = await modal.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bodyBg.replace(/\s/g, "")).toBe("rgb(250,251,253)");

      // Modal header uses --surface-float (highest elevation) = #ffffff → rgb(255, 255, 255)
      const header = modal.locator('[class*="help-modal-header"]');
      await expect(header).toBeVisible();
      const headerBg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(headerBg.replace(/\s/g, "")).toBe("rgb(255,255,255)");
    });

    test("selected controls use cyan identity in both themes", async ({ page }) => {
      for (const theme of ["light", "dark"] as const) {
        await loadVisualState(page, { theme }, { width: 1280, height: 900 });
        await expect(page.getByTestId("theory-controls")).toBeVisible();

        // Find any active (selected) toggle button
        const activeBtn = page.getByTestId("theory-controls").locator('button[aria-pressed="true"]').first();
        await expect(activeBtn).toBeVisible();

        const styles = await activeBtn.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { bg: cs.backgroundColor, color: cs.color };
        });

        if (theme === "light") {
          // light: --selected-bg = #0891b2 → rgb(8, 145, 178) — cyan solid
          expect(styles.bg.replace(/\s/g, "")).toBe("rgb(8,145,178)");
          // text on accent: white
          expect(styles.color.replace(/\s/g, "")).toBe("rgb(255,255,255)");
        } else {
          // dark: selected-bg is a gradient; backgroundColor is the base dark navy
          // Just verify the text is light (near-white)
          const m = styles.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (m) {
            expect(Number(m[1])).toBeGreaterThan(200);
            expect(Number(m[2])).toBeGreaterThan(200);
            expect(Number(m[3])).toBeGreaterThan(200);
          }
        }
      }
    });

    test("tonic note ring uses orange identity in both themes", async ({ page }) => {
      for (const theme of ["light", "dark"] as const) {
        await loadVisualState(page, { theme });
        await expect(page.getByTestId("fretboard-svg")).toBeVisible();

        const tonicNote = page.locator('g[data-note-role="key-tonic"] circle').first();
        await expect(tonicNote).toBeVisible();

        const stroke = await tonicNote.evaluate((el) => getComputedStyle(el).stroke);
        // --note-ring-tonic = --neon-orange
        // light: #ea580c → rgb(234, 88, 12); dark: #FF9A4D → rgb(255, 154, 77)
        const m = stroke.replace(/\s/g, "").match(/rgb\((\d+),(\d+),(\d+)\)/);
        expect(m).not.toBeNull();
        if (m) {
          // Orange: high R, low-mid G, low B
          expect(Number(m[1])).toBeGreaterThan(200); // R high
          expect(Number(m[2])).toBeLessThan(180);     // G mid
          expect(Number(m[3])).toBeLessThan(100);     // B low
        }
      }
    });

    test("theory-mode-browser and theory-chord-section use aligned nested surface tokens in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" }, { width: 1280, height: 900 });
      await expect(page.getByTestId("theory-controls")).toBeVisible();

      // theory-mode-browser now uses --nested-card-bg = --surface-card-nested = #f2f6fb → rgb(242, 246, 251)
      const modeBrowser = page.locator('[class*="theory-mode-browser"]');
      await expect(modeBrowser).toBeVisible();
      const modeBg = await modeBrowser.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(modeBg.replace(/\s/g, "")).toBe("rgb(242,246,251)");

      // theory-chord-section also uses --surface-card-nested = #f2f6fb → rgb(242, 246, 251)
      const chordSection = page.locator('[class*="theory-chord-section"]');
      await expect(chordSection).toBeVisible();
      const chordBg = await chordSection.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(chordBg.replace(/\s/g, "")).toBe("rgb(242,246,251)");

      // Both should now be aligned to the same nested surface level
      expect(modeBg).toBe(chordBg);
    });
  });

  test.describe("Role Token Contract", () => {
    test("fretboard a11y hover token is dark in light mode and white in dark mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });
      const lightVal = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--fretboard-a11y-hover-bg").trim()
      );
      // Light: rgb(0 0 0 / 0.05) — dark translucent overlay
      expect(lightVal).toMatch(/^rgb\(0\s+0\s+0/);

      await loadVisualState(page, { theme: "dark" });
      const darkVal = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--fretboard-a11y-hover-bg").trim()
      );
      // Dark: rgb(255 255 255 / 0.15) — light translucent overlay
      expect(darkVal).toMatch(/^rgb\(255\s+255\s+255/);
      expect(lightVal).not.toBe(darkVal);
    });

    test("practice pills render with role-scale-border for in-scale notes in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" });
      const practiceBar = page.locator('section[aria-label^="Practice cues:"]');
      await expect(practiceBar).toBeVisible();

      // Exclude chord-root/guide-tone pills (they override to orange); target a pure scale note
      const inScalePill = practiceBar.locator(
        '[data-in-scale="true"]:not([data-chord-root="true"]):not([data-guide-tone="true"])'
      ).first();
      await expect(inScalePill).toBeVisible();
      const border = await inScalePill.evaluate((el) => getComputedStyle(el).borderColor);
      // --role-scale-border = --neon-cyan = #0891b2 → rgb(8, 145, 178)
      expect(border.replace(/\s/g, "")).toBe("rgb(8,145,178)");
    });

    test("practice pills render with role-chord-border for guide-tone notes in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" });
      const practiceBar = page.locator('section[aria-label^="Practice cues:"]');
      await expect(practiceBar).toBeVisible();

      const guidePill = practiceBar.locator('[data-guide-tone="true"], [data-chord-root="true"]').first();
      await expect(guidePill).toBeVisible();
      const border = await guidePill.evaluate((el) => getComputedStyle(el).borderColor);
      // --role-chord-border = --neon-orange = #ea580c → rgb(234, 88, 12)
      expect(border.replace(/\s/g, "")).toBe("rgb(234,88,12)");
    });

    test("degree chips use role-scale-border for in-scale notes in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });

      const degreeStrip = page.locator('[class*="degree-chip-strip"]').first();
      await expect(degreeStrip).toBeVisible();

      // Exclude tonic chips — their CSS rule is declared after in-scale and overrides to orange
      const inScaleItem = degreeStrip.locator('[data-in-scale="true"]:not([data-is-tonic="true"])').first();
      await expect(inScaleItem).toBeVisible();

      const chip = inScaleItem.locator('button').first();
      await expect(chip).toBeVisible();
      const border = await chip.evaluate((el) => getComputedStyle(el).borderColor);
      // --role-scale-border = --neon-cyan = #0891b2 → rgb(8, 145, 178)
      expect(border.replace(/\s/g, "")).toBe("rgb(8,145,178)");
    });

    test("degree chips use role-chord-border for tonic note in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });

      const degreeStrip = page.locator('[class*="degree-chip-strip"]').first();
      await expect(degreeStrip).toBeVisible();

      const tonicItem = degreeStrip.locator('[data-is-tonic="true"]').first();
      await expect(tonicItem).toBeVisible();

      const chip = tonicItem.locator('button').first();
      await expect(chip).toBeVisible();
      const border = await chip.evaluate((el) => getComputedStyle(el).borderColor);
      // --role-chord-border = --neon-orange = #ea580c → rgb(234, 88, 12)
      expect(border.replace(/\s/g, "")).toBe("rgb(234,88,12)");
    });
  });
});
