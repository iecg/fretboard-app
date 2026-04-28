import { expect, test, type Page } from "@playwright/test";

async function gotoApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
}

test.describe("production css module scoping", () => {
  test("renders app with production-scoped styles", async ({ page }) => {
    await gotoApp(page);

    const appContainer = page.locator('[data-testid="app-container"]');
    const appClassList = await appContainer.getAttribute("class");
    expect(appClassList, "App container should have classes").toBeTruthy();

    // Verify the container is properly styled (has dimensions)
    const rect = await appContainer.boundingBox();
    expect(rect, "App container should be rendered with dimensions").not.toBeNull();
    expect(rect!.width, "App container should have non-zero width").toBeGreaterThan(0);
    expect(rect!.height, "App container should have non-zero height").toBeGreaterThan(0);
  });

  test("fretboard renders with module styles and grid layout", async ({ page }) => {
    await gotoApp(page);

    const fretboard = page.locator('[data-testid="fretboard-outer"]');
    await expect(fretboard).toBeVisible();

    const fretboardStyle = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="fretboard-outer"]');
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        display: style.display,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      };
    });

    expect(fretboardStyle, "Fretboard should be rendered").not.toBeNull();
    expect(fretboardStyle!.display, "Fretboard should have valid display").toBeTruthy();
    expect(fretboardStyle!.width, "Fretboard should have width").toBeGreaterThan(100);
    expect(fretboardStyle!.height, "Fretboard should have height").toBeGreaterThan(100);
  });

  test("circle of fifths renders with scoped styles", async ({ page }) => {
    await gotoApp(page);

    const circle = page.locator('[data-testid="circle-of-fifths-svg"]');
    await expect(circle).toBeVisible();

    const circleRect = await circle.boundingBox();
    expect(circleRect, "Circle of fifths should be rendered").not.toBeNull();
    expect(circleRect!.width, "Circle should have non-zero width").toBeGreaterThan(0);
    expect(circleRect!.height, "Circle should have non-zero height").toBeGreaterThan(0);
  });

  test("dashboard panels have scoped module styles", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoApp(page);

    const dashboardCards = page.locator('[data-testid="dashboard-card-configuration"]');
    await expect(dashboardCards.first()).toBeVisible();
    expect(await dashboardCards.count(), "Dashboard cards should be present").toBeGreaterThan(0);
    const cardRect = await dashboardCards.first().boundingBox();
    expect(cardRect, "Dashboard card should be rendered").not.toBeNull();
    expect(cardRect!.width, "Dashboard card should have non-zero width").toBeGreaterThan(0);
  });

  test("global design tokens work alongside scoped modules", async ({
    page,
  }) => {
    await gotoApp(page);

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      const neonCyan = rootStyle.getPropertyValue("--neon-cyan").trim();
      const spaceToken = rootStyle.getPropertyValue("--space-4").trim();
      return { neonCyan, spaceToken };
    });

    expect(result.neonCyan.toLowerCase(), "tokens.css --neon-cyan should be applied").toBe("#4de4ff");
    expect(result.spaceToken, "tokens.css --space-4 should be applied").toBe("1rem");
  });

  test("mobile tab panel styles work on narrow viewports", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);

    const tabContent = page.locator('[data-testid="mobile-tab-content"]');
    await expect(tabContent.first()).toBeVisible();
    expect(await tabContent.count(), "Tab content should be present").toBeGreaterThan(0);
    const contentRect = await tabContent.first().boundingBox();
    expect(contentRect, "Tab content should be rendered").not.toBeNull();
    expect(contentRect!.width, "Tab content should have width").toBeGreaterThan(0);
    expect(contentRect!.height, "Tab content should have height").toBeGreaterThan(0);
  });

  test("no unscoped style conflicts in production build", async ({
    page,
  }) => {
    await gotoApp(page);

    const result = await page.evaluate(() => {
      let elementCount = 0;
      let styledElementCount = 0;

      const allElements = document.querySelectorAll("*");
      allElements.forEach((el) => {
        elementCount++;
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          const style = getComputedStyle(el);
          if (style.display !== "none" && style.display !== "contents") {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              styledElementCount++;
            }
          }
        }
      });

      return {
        totalElements: elementCount,
        styledElements: styledElementCount,
        renderingRatio: Math.round((styledElementCount / elementCount) * 100),
      };
    });

    // Ensure production build renders substantial DOM with proper styling.
    // At least 100 elements expected in standard fretboard layout.
    expect(
      result.totalElements,
      "Should have rendered elements in production build"
    ).toBeGreaterThan(100);
    // Most visible elements should have computed styles (strict threshold).
    expect(
      result.renderingRatio,
      "Most elements should be rendered with styles"
    ).toBeGreaterThan(50);
  });

  test("layout responsiveness preserved with scoped module styles", async ({
    page,
  }) => {
    const viewports = [
      { width: 390, height: 844, tier: "mobile" },
      { width: 768, height: 1024, tier: "tablet" },
      { width: 1200, height: 800, tier: "desktop" },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoApp(page);

      const tier = await page
        .locator('[data-testid="app-container"]')
        .getAttribute("data-layout-tier");
      expect(tier, `Viewport ${viewport.width}x${viewport.height}`).toBe(viewport.tier);

      const fretboard = page.locator('[data-testid="fretboard-outer"]');
      await expect(fretboard, "Fretboard should be visible").toBeVisible();
    }
  });

  test("chord overlay controls render with module styles", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoApp(page);

    const chordDisclosure = page.getByRole("button", { name: /Chords/i });
    if ((await chordDisclosure.getAttribute("aria-expanded")) !== "true") {
      await chordDisclosure.click();
    }
    await page.getByRole("button", { name: "Manual" }).click();
    const chordTypeSelect = page.getByRole("combobox", { name: "Chord Type" });
    await expect(chordTypeSelect).toBeVisible();

    const styles = await chordTypeSelect.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        color: computed.color,
        display: computed.display,
        padding: computed.padding,
      };
    });

    expect(styles, "Chord controls should have computed styles").not.toBeNull();
    expect(styles!.display, "Should have display property").toBeTruthy();
    expect(styles!.color, "Should have text color").toBeTruthy();
  });

  test("mobile theory buttons enforce touch target min-height", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await page.waitForSelector('[data-testid="theory-controls"]');

    const result = await page.evaluate(() => {
      // Find theory control buttons by looking for buttons within theory controls
      const theoryControls = document.querySelector('[data-testid="theory-controls"]');
      if (!theoryControls) return { found: false, buttons: [] };

      const buttons = theoryControls.querySelectorAll('button');

      const buttonHeights = Array.from(buttons)
        .filter((btn) => btn instanceof HTMLElement && btn.offsetHeight > 0)
        .map((btn) => {
          const rect = (btn as HTMLElement).getBoundingClientRect();
          const computed = getComputedStyle(btn as HTMLElement);
          return {
            text: (btn as HTMLElement).textContent?.substring(0, 20) || 'button',
            height: Math.round(rect.height),
            minHeight: computed.minHeight,
            computedHeight: Math.round(parseFloat(computed.height) || 0),
          };
        });

      return {
        found: true,
        buttons: buttonHeights,
        containerLayout: theoryControls.getAttribute('data-layout-tier'),
      };
    });

    expect(result.found, "Theory controls should be present").toBe(true);
    expect(result.buttons.length, "Should have at least one button").toBeGreaterThan(0);
    result.buttons.forEach((btn) => {
      expect(
        btn.height,
        `Mobile button should meet touch target (36px minimum): button has ${btn.height}px`
      ).toBeGreaterThanOrEqual(36);
    });
  });

  test("no stale global class selectors present", async ({ page }) => {
    // Allowlist of unscoped class names that should NOT appear in production DOM.
    // These were historically used as global CSS classes and have been migrated to CSS Modules.
    // Format: class name without the dot prefix.
    const staleGlobalClasses = [
      "controls-panel",    // Migrated to .controls-panel in ExpandedControlsPanel.module.css
      "header-btn",        // Migrated to module scoped in AppHeader.tsx
      "key-column",        // Migrated to :global([data-layout-column="key"]) in ExpandedControlsPanel.module.css
      "control-btn",       // Migrated to module scoped components
      "scale-selector",    // Migrated to .scale-selector in ScaleSelector.module.css
    ];

    await gotoApp(page);

    const result = await page.evaluate((classesToCheck: string[]) => {
      const foundClasses = new Set<string>();

      document.querySelectorAll("[class]").forEach((el) => {
        const classes = (el.getAttribute("class") || "").split(/\s+/);
        classesToCheck.forEach((className) => {
          if (classes.includes(className)) {
            foundClasses.add(className);
          }
        });
      });

      return {
        foundStaleClasses: Array.from(foundClasses),
        totalElementsChecked: document.querySelectorAll("[class]").length,
      };
    }, staleGlobalClasses);

    expect(
      result.foundStaleClasses,
      `Should not find stale global classes in production build. Found: ${result.foundStaleClasses.join(", ")}`
    ).toEqual([]);
  });

  test("css modules use scoped class names in production", async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(() => {
      const KNOWN_GLOBALS = new Set([
        "app-container",
        "panel-surface",
        "panel-surface--compact",
        "panel-surface--inset",
        "icon",
        "icon-active",
        "icon-muted",
        "loading-spinner",
        "custom-scrollbar",
        "hide-scrollbar",
        "brand-mark",
      ]);

      const elements = document.querySelectorAll("[class]");
      const classInfo: Record<string, number> = {};
      let nonUtilityClasses = 0;

      elements.forEach((el) => {
        const classes = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean);
        classes.forEach((cls) => {
          classInfo[cls] = (classInfo[cls] || 0) + 1;

          if (
            !KNOWN_GLOBALS.has(cls) &&
            cls.length > 5 &&
            (cls.includes("_") || /[a-z]-[a-z]/.test(cls))
          ) {
            nonUtilityClasses++;
          }
        });
      });

      return {
        totalClasses: Object.keys(classInfo).length,
        nonUtilityClasses,
        sampleClasses: Object.keys(classInfo).slice(0, 10),
      };
    });

    expect(
      result.totalClasses,
      "Should have some scoped classes in the production build"
    ).toBeGreaterThan(10);
    expect(
      result.nonUtilityClasses,
      "Should have component-scoped classes in production"
    ).toBeGreaterThan(0);
  });

  test("verifies header chrome styling with scoped modules", async ({ page }) => {
    await gotoApp(page);

    const header = page.locator('[data-testid="app-header"]');
    await expect(header).toBeVisible();

    const headerClassList = await header.getAttribute("class");
    expect(headerClassList).toBeTruthy();

    const result = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="app-header"]');
      if (!header) return null;

      const style = getComputedStyle(header);
      const rect = header.getBoundingClientRect();

      return {
        display: style.display,
        position: style.position,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });

    expect(result).not.toBeNull();
    expect(result!.display, "Header should have proper display").toBeTruthy();
    expect(result!.width, "Header should span full width").toBeGreaterThan(200);
    expect(result!.height, "Header should have reasonable height").toBeGreaterThan(40);
  });
});
