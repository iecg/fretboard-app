import { test, expect } from "@playwright/test";
import { loadVisualState, getPseudoStyle } from "./visual-helpers";

function colorToHex(color: string): string {
  const c = color.replace(/\s*,\s*/g, ",").replace(/\s+/g, " ").trim().toLowerCase();
  if (c.startsWith("#")) {
    // Expand short hex (#abc → #aabbcc, #abcd → #aabbccdd) so vite/lightning-css
    // minified values compare equal to their authored long-form counterparts.
    if (/^#[0-9a-f]{3,4}$/.test(c)) {
      return "#" + c.slice(1).split("").map((ch) => ch + ch).join("");
    }
    return c;
  }
  const m = c.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[/, ]+([0-9.]+))?\)/);
  if (!m) return c;
  const toH = (n: string) => parseInt(n).toString(16).padStart(2, "0");
  const hex = `#${toH(m[1])}${toH(m[2])}${toH(m[3])}`;
  if (m[4]) return hex + Math.round(parseFloat(m[4]) * 255).toString(16).padStart(2, "0");
  return hex;
}

function parseRgbChannels(color: string): [number, number, number] {
  const normalized = color.trim().toLowerCase().replace(/\s*,\s*/g, ",");
  const rgb = normalized.match(/rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  const srgb = normalized.match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/);
  if (srgb) {
    return [
      Math.round(Number(srgb[1]) * 255),
      Math.round(Number(srgb[2]) * 255),
      Math.round(Number(srgb[3]) * 255)
    ];
  }

  throw new Error(`Unable to parse color: ${color}`);
}

function brightness(color: string): number {
  const [r, g, b] = parseRgbChannels(color);
  return r + g + b;
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
    
    // modern-light: --practice-bar-fill = --surface-strip = --surface-card-top -> rgb(250, 251, 253)
    expect(styles.backgroundColor.replace(/\s/g, "")).toBe("rgb(250,251,253)");
    // text-main: #0f172a -> rgb(15, 23, 42)
    expect(styles.color.replace(/\s/g, "")).toBe("rgb(15,23,42)");
  });

  test("BottomTabBar should use theme-appropriate active indicators", async ({ page }) => {
    // Mobile layout renders the BottomTabBar; the default active tab is "Scales".
    await loadVisualState(page, { theme: "dark" }, { width: 390, height: 844 });
    const darkTab = page.getByRole("tab", { name: /Scales/i });
    await expect(darkTab).toBeVisible();

    const darkStyles = await darkTab.evaluate((el) => {
      const buttonColor = getComputedStyle(el).color;
      const indicator = getComputedStyle(el, "::before").backgroundColor;
      return { color: buttonColor, indicator };
    });
    // modern-dark: --nav-active-fg = --neon-cyan -> rgb(77, 228, 255)
    expect(darkStyles.color.replace(/\s/g, "")).toBe("rgb(77,228,255)");
    // ::before indicator background: --nav-active-indicator = --neon-cyan
    expect(darkStyles.indicator).toMatch(/77,\s*228,\s*255|0\.301961\s+0\.894118\s+1/);

    // Light mode
    await loadVisualState(page, { theme: "light" }, { width: 390, height: 844 });
    const lightTab = page.getByRole("tab", { name: /Scales/i });
    await expect(lightTab).toBeVisible();
    const lightStyles = await lightTab.evaluate((el) => {
      const buttonColor = getComputedStyle(el).color;
      const indicator = getComputedStyle(el, "::before").backgroundColor;
      return { color: buttonColor, indicator };
    });
    // modern-light: --nav-active-fg = --accent-primary = #0891b2 -> rgb(8, 145, 178)
    expect(lightStyles.color.replace(/\s/g, "")).toBe("rgb(8,145,178)");
    expect(lightStyles.indicator.replace(/\s/g, "")).toBe("rgb(8,145,178)");
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
            "Stepper Select": page.getByRole("group", { name: "Browse scale families" }),
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
          // Disclosure rows only exist in TheoryControls (rendered at tablet
          // tier and above). The desktop viewport is already configured by the
          // surrounding beforeEach.
          const theoryControls = page.getByTestId("theory-controls");
          await expect(theoryControls).toBeVisible();

          const chordsDisclosure = theoryControls.getByRole("button", { name: /^Chords/i });
          await expect(chordsDisclosure).toBeVisible();

          // Ensure it is collapsed before measuring hover paint.
          if ((await chordsDisclosure.getAttribute("aria-expanded")) === "true") {
            await chordsDisclosure.click();
            await expect(chordsDisclosure).toHaveAttribute("aria-expanded", "false");
          }

          // Hover paint lives on `::before` — host is transparent.
          const beforeBg = await getPseudoStyle(chordsDisclosure, "::before", "backgroundColor");
          await chordsDisclosure.hover();
          const afterStyles = await chordsDisclosure.evaluate((el) => {
            const cs = getComputedStyle(el, "::before");
            return { bg: cs.backgroundColor, bgImg: cs.backgroundImage };
          });

          expect(afterStyles.bg).not.toBe(beforeBg);
          if (theme === "dark") {
            expect(
              isCyanLike(afterStyles.bg) || afterStyles.bgImg.includes("gradient"),
            ).toBe(true);
          } else {
            expect(afterStyles.bg.replace(/\s/g, "")).toBe("rgb(221,228,239)");
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
          const shell = theoryControls.getByRole("group", { name: "Browse scale families" });
          const select = theoryControls.getByRole("combobox", { name: "Scale Family" });
          await expect(shell).toBeVisible();
          await expect(select).toBeVisible();

          await shell.hover();
          const hoverBorder = await shell.evaluate((el) => getComputedStyle(el).borderColor);
          if (theme === "light") {
            expect(hoverBorder.replace(/\s/g, "")).toBe("rgb(8,145,178)");
          } else {
            expect(isCyanLike(hoverBorder)).toBe(true);
          }

          // Focus ring is on the StepperShell via :focus-within.
          await select.focus();
          const shellOutline = await shell.evaluate((el) => getComputedStyle(el).outlineStyle);
          expect(shellOutline).toBe("solid");
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

        test("theory stepper shell should use shared control hover treatment", async ({ page }) => {
          const stepperShell = page.getByRole("group", { name: "Browse scale families" });
          await expect(stepperShell).toBeVisible();

          const beforeStyles = await stepperShell.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              border: cs.borderColor
            };
          });

          await stepperShell.hover();

          const afterStyles = await stepperShell.evaluate((el) => {
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
          // Disclosure rows live in TheoryControls — rendered at desktop tier
          // (already configured by the surrounding beforeEach).
          const theoryControls = page.getByTestId("theory-controls");
          await expect(theoryControls).toBeVisible();

          const disclosureBtn = theoryControls.getByRole("button", { name: /^Chords/i });
          await expect(disclosureBtn).toBeVisible();
          // Ensure it is collapsed before focusing
          if (await disclosureBtn.getAttribute("aria-expanded") === "true") {
            await disclosureBtn.click();
            await expect(disclosureBtn).toHaveAttribute("aria-expanded", "false");
          }

          await disclosureBtn.focus();
          // Glow box-shadow lives on `::before`; outline lives on the host.
          const [outlineStyle, boxShadow] = await Promise.all([
            disclosureBtn.evaluate((el) => getComputedStyle(el).outlineStyle),
            getPseudoStyle(disclosureBtn, "::before", "boxShadow"),
          ]);
          const focusStyles = { outlineStyle, boxShadow };

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
    test("light surface ladder separates controls from nested cards", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });

      const tokens = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          shell:    cs.getPropertyValue("--surface-shell").trim(),
          cardTop:  cs.getPropertyValue("--surface-card-top").trim(),
          nested:   cs.getPropertyValue("--surface-card-nested").trim(),
          well:     cs.getPropertyValue("--surface-well").trim(),
          strip:    cs.getPropertyValue("--surface-strip").trim(),
          control:  cs.getPropertyValue("--surface-control").trim(),
          float:    cs.getPropertyValue("--surface-float").trim(),
        };
      });

      // Exact light-mode values from themes.css surface ladder.
      // Vite/lightning-css minifies `#ffffff` → `#fff` in production builds, so
      // canonicalize via colorToHex before comparing.
      expect(colorToHex(tokens.shell)).toBe("#eef2f7");
      expect(colorToHex(tokens.cardTop)).toBe("#fafbfd");
      expect(colorToHex(tokens.nested)).toBe("#f2f6fb");
      expect(colorToHex(tokens.well)).toBe("#e5ecf5");
      expect(colorToHex(tokens.float)).toBe("#ffffff");

      // Summary strips intentionally join the card family, while controls remain sunken wells.
      expect(tokens.strip).toBe(tokens.cardTop);
      expect(tokens.control).toBe(tokens.well);
      expect(tokens.cardTop).not.toBe(tokens.nested);
      expect(tokens.nested).not.toBe(tokens.well);

      expect(colorToHex(tokens.cardTop)).not.toBe("#ffffff");
    });

    test("dark surface ladder separates controls from nested cards", async ({ page }) => {
      await loadVisualState(page, { theme: "dark" });

      const colors = await page.evaluate(() => {
        const resolveBg = (token: string) => {
          const el = document.createElement("div");
          el.style.background = `var(${token})`;
          document.body.appendChild(el);
          const color = getComputedStyle(el).backgroundColor;
          el.remove();
          return color;
        };

        return {
          shell:   resolveBg("--surface-shell"),
          cardTop: resolveBg("--surface-card-top"),
          nested:  resolveBg("--surface-card-nested"),
          well:    resolveBg("--surface-well"),
          control: resolveBg("--surface-control"),
          strip:   resolveBg("--surface-strip"),
          float:   resolveBg("--surface-float"),
        };
      });

      // In dark mode, all three should be dark (no channel brighter than 80)
      const [sr, sg, sb] = parseRgbChannels(colors.shell);
      const [cr, cg, cb] = parseRgbChannels(colors.cardTop);
      const [nr, ng, nb] = parseRgbChannels(colors.nested);
      const [wr, wg, wb] = parseRgbChannels(colors.well);
      const [fr, fg, fb] = parseRgbChannels(colors.float);

      // Shell is the darkest base — all channels < 60
      expect(sr).toBeLessThan(60);
      expect(sg).toBeLessThan(60);
      expect(sb).toBeLessThan(80);

      // Card top should be slightly elevated (higher R channel than shell)
      expect(cr).toBeGreaterThanOrEqual(sr);

      // Nested content cards stay visually above sunken controls.
      expect(brightness(colors.nested)).toBeGreaterThan(brightness(colors.control));
      expect(colors.control).toBe(colors.well);
      expect(colors.strip).toBe(colors.cardTop);

      expect(nr).toBeGreaterThanOrEqual(wr);
      expect(ng).toBeGreaterThanOrEqual(wg);
      expect(nb).toBeGreaterThanOrEqual(wb);

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

    test("theory sections stay flat inside the top-level card in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" }, { width: 1280, height: 900 });
      await expect(page.getByTestId("theory-controls")).toBeVisible();

      const panelSurfaces = page.getByTestId("theory-controls").locator(".panel-surface");
      await expect(panelSurfaces).toHaveCount(0);

      const sections = page.getByTestId("theory-controls").locator("section[data-open]");
      await expect(sections).toHaveCount(2);
    });

    test("chord practice strip aligns with card surface in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" });

      const practiceBar = page.locator('section[aria-label^="Practice cues:"]');
      await expect(practiceBar).toBeVisible();

      const bg = await practiceBar.evaluate((el) => getComputedStyle(el).backgroundColor);
      // surface-strip = --surface-card-top → rgb(250, 251, 253)
      expect(bg.replace(/\s/g, "")).toBe("rgb(250,251,253)");
      // Must not be pure white or the old f1f5f9 value
      expect(bg.replace(/\s/g, "")).not.toBe("rgb(255,255,255)");
      expect(bg.replace(/\s/g, "")).not.toBe("rgb(241,245,249)");
    });

    test("chord practice and degree strips share the card surface in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" });

      const practiceBar = page.locator('section[aria-label^="Practice cues:"]');
      await expect(practiceBar).toBeVisible();
      const degreeStrip = page.locator('[class*="degree-chip-strip"]').first();
      await expect(degreeStrip).toBeVisible();

      const practiceBg = await practiceBar.evaluate((el) => getComputedStyle(el).backgroundColor);
      const degreeBg = await degreeStrip.evaluate((el) => getComputedStyle(el).backgroundColor);

      expect(practiceBg.replace(/\s/g, "")).toBe("rgb(250,251,253)");
      expect(degreeBg.replace(/\s/g, "")).toBe(practiceBg.replace(/\s/g, ""));
    });

    test("degree chip strip uses surface-strip token in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });

      // DegreeChipStrip is rendered inside the scale summary area
      const degreeStrip = page.locator('section[role="group"]').filter({ hasText: /C|D|E|F|G|A|B/ }).first();
      await expect(degreeStrip).toBeVisible();

      const bg = await degreeStrip.evaluate((el) => getComputedStyle(el).backgroundColor);
      // strip-surface sets background via --strip-fill = --surface-strip = --surface-card-top
      expect(bg.replace(/\s/g, "")).toBe("rgb(250,251,253)");
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

    test("theory scale and chord sections share the same flat section treatment in light mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light", chordType: "Major 7th" }, { width: 1280, height: 900 });
      await expect(page.getByTestId("theory-controls")).toBeVisible();

      const sections = page.getByTestId("theory-controls").locator("section[data-open]");
      await expect(sections).toHaveCount(2);

      const scaleBg = await sections.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor);
      const chordBg = await sections.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor);

      expect(scaleBg.replace(/\s/g, "")).toBe("rgba(0,0,0,0)");
      expect(chordBg).toBe(scaleBg);
    });

    test("rendered controls remain visually distinct inside flat theory sections", async ({ page }) => {
      for (const theme of ["light", "dark"] as const) {
        await loadVisualState(page, { theme, chordType: "Major 7th" }, { width: 1280, height: 900 });
        await expect(page.getByTestId("theory-controls")).toBeVisible();

        const theorySection = page.locator("section[data-open]").first();
        const scaleFamilyStepper = page.getByRole("group", { name: "Browse scale families" });
        const scaleFamilySelect = page.getByRole("combobox", { name: "Scale Family" }).first();
        const toggleGroup = page.locator('[class*="toggle-group"]').first();

        await expect(theorySection).toBeVisible();
        await expect(scaleFamilyStepper).toBeVisible();
        await expect(scaleFamilySelect).toBeVisible();
        await expect(toggleGroup).toBeVisible();

        const sectionBg = await theorySection.evaluate((el) => getComputedStyle(el).backgroundColor);
        const stepperBg = await scaleFamilyStepper.evaluate((el) => getComputedStyle(el).backgroundColor);
        const selectBg = await scaleFamilySelect.evaluate((el) => getComputedStyle(el).backgroundColor);
        const toggleBg = await toggleGroup.evaluate((el) => getComputedStyle(el).backgroundColor);

        expect(sectionBg.replace(/\s/g, "")).toBe("rgba(0,0,0,0)");
        expect(stepperBg).not.toBe(sectionBg);
        expect(toggleBg).not.toBe(sectionBg);
        expect(selectBg.replace(/\s/g, "")).toBe("rgba(0,0,0,0)");

        await page.getByLabel("Open settings").click();
        const sectionCard = page.getByTestId("settings-drawer").locator('[class*="overlay-section-card"]').first();
        await expect(sectionCard).toBeVisible();
        const settingsNestedBg = await sectionCard.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(settingsNestedBg).not.toBe(sectionBg);
      }
    });
  });

  test.describe("Role Token Contract", () => {
    test("fretboard a11y hover token is dark in light mode and white in dark mode", async ({ page }) => {
      await loadVisualState(page, { theme: "light" });
      const lightVal = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--fretboard-a11y-hover-bg").trim()
      );
      // Light: rgb(0 0 0 / 0.05) — dark translucent overlay. Production builds
      // minify this to `#0000000d`, so canonicalize before asserting.
      expect(colorToHex(lightVal).slice(0, 7)).toBe("#000000");

      await loadVisualState(page, { theme: "dark" });
      const darkVal = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--fretboard-a11y-hover-bg").trim()
      );
      // Dark: rgb(255 255 255 / 0.15) — light translucent overlay. Same minification caveat.
      expect(colorToHex(darkVal).slice(0, 7)).toBe("#ffffff");
      expect(colorToHex(lightVal)).not.toBe(colorToHex(darkVal));
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
