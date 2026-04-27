import { expect, type Locator, type Page } from "@playwright/test";
import { STORAGE_PREFIX, LEGACY_KEYS } from "../src/utils/storageConstants";

export interface FullPageVisualOptions {
  maxDiffPixels?: number;
  maxDiffPixelRatio?: number;
  threshold?: number;
}

export interface VisualState {
  rootNote?: string;
  scaleName?: string;
  displayFormat?: "notes" | "degrees" | "none";
  scaleVisible?: boolean;
  /** @deprecated Use chordRootOverride + chordQualityOverride + chordOverlayMode for Phase 02 atoms. */
  chordRoot?: string;
  /** @deprecated Use chordRootOverride + chordQualityOverride + chordOverlayMode for Phase 02 atoms. */
  chordType?: string;
  /** @deprecated Use chordOverlayMode instead. */
  linkChordRoot?: boolean;
  /** Phase 02: root note for manual-mode chord overlay */
  chordRootOverride?: string;
  /** Phase 02: chord quality for manual-mode chord overlay (e.g. "Dominant 7th") */
  chordQualityOverride?: string;
  /** Phase 02: "degree" | "manual" */
  chordOverlayMode?: string;
  /** Phase 02: Roman numeral degree (e.g. "I", "V") */
  chordDegree?: string;
  chordFretSpread?: number;
  practiceLens?: string;
  theme?: "light" | "dark" | "system";
  [key: string]: string | number | boolean | undefined;
}

/**
 * Loads the application in a specific visual state by setting localStorage
 * before navigation and ensuring the page is stable.
 */
export async function loadVisualState(
  page: Page,
  state: VisualState,
  viewport?: { width: number; height: number }
) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });

  // Inject state into localStorage before the app boots
  await page.addInitScript(
    ({ s, prefix, legacyKeys }) => {
      // Clear previous state
      Object.keys(localStorage).forEach((key) => {
        const legacy = legacyKeys as readonly string[];
        if (key.startsWith(prefix) || legacy.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Write new state
      Object.entries(s).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        
        // Serialize simple types as strings
        localStorage.setItem(`${prefix}${key}`, String(value));
      });
    },
    { s: state, prefix: STORAGE_PREFIX, legacyKeys: LEGACY_KEYS }
  );

  await page.goto("/");

  // Apply visual "detox" for deterministic screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      ::-webkit-scrollbar {
        display: none !important;
      }
      * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
    `,
  });

  await page.waitForSelector('[data-testid="app-container"]');
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await waitForStableLayout(page);
}

/**
 * Waits for the layout to be stable by checking if the layout state remains
 * unchanged for several consecutive animation frames.
 */
export async function waitForStableLayout(page: Page, timeout = 2000) {
  await page.evaluate(async (timeoutMs) => {
    const getLayoutState = () => {
      const { clientWidth, clientHeight, scrollHeight, scrollWidth } = document.documentElement;
      return JSON.stringify({
        clientWidth,
        clientHeight,
        scrollHeight,
        scrollWidth,
        elementCount: document.querySelectorAll("*").length,
        // Include bounding boxes of all visible elements might be too expensive, 
        // but we can check the body's bounding box
        bodyRect: document.body.getBoundingClientRect(),
      });
    };

    let lastState = getLayoutState();
    let stableFrames = 0;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      function check() {
        const currentState = getLayoutState();
        if (currentState === lastState) {
          stableFrames++;
        } else {
          stableFrames = 0;
          lastState = currentState;
        }

        if (stableFrames >= 5) {
          resolve(true);
        } else if (Date.now() - startTime > timeoutMs) {
          reject(new Error("visual stability timeout: page layout was not stable"));
        } else {
          requestAnimationFrame(check);
        }
      }
      requestAnimationFrame(check);
    });
  }, timeout);
}

/**
 * Waits for a specific locator to have a stable bounding box.
 */
export async function waitForStable(locator: Locator, timeout = 2000) {
  const page = locator.page();
  const element = await locator.elementHandle();
  if (!element) return;

  await page.evaluate(async ({ el, timeoutMs }) => {
    const getRect = () => {
      const { top, left, width, height } = el.getBoundingClientRect();
      return JSON.stringify({ top, left, width, height });
    };
    let lastRect = getRect();
    let stableFrames = 0;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      function check() {
        const currentRect = getRect();
        if (currentRect === lastRect) {
          stableFrames++;
        } else {
          stableFrames = 0;
          lastRect = currentRect;
        }

        if (stableFrames >= 10) {
          resolve(true);
        } else if (Date.now() - startTime > timeoutMs) {
          reject(new Error("visual stability timeout: locator bounding box was not stable"));
        } else {
          requestAnimationFrame(check);
        }
      }
      requestAnimationFrame(check);
    });
  }, { el: element, timeoutMs: timeout });
}

/**
 * Prepares a page for visual regression testing by setting the viewport,
 * enabling reduced motion, and ensuring the page is in a stable state.
 */
export async function prepareVisualPage(page: Page, viewport = { width: 1280, height: 720 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  
  // Disable all animations, transitions, and hide scrollbars globally
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      ::-webkit-scrollbar {
        display: none !important;
      }
      * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
    `,
  });

  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await waitForStableLayout(page);
}

/**
 * Captures a full-page screenshot with the version badge masked.
 */
export async function expectFullPageVisual(page: Page, name: string, options: FullPageVisualOptions = {}) {
  await waitForStableLayout(page);
  
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [page.getByTestId("version-badge")],
    animations: "disabled",
    scale: "css",
    ...options,
  });
}

/**
 * Captures a screenshot of a specific locator.
 */
export async function expectLocatorVisual(locator: Locator, name: string) {
  await waitForStable(locator);
  await expect(locator).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    scale: "css",
  });
}

/**
 * Opens the settings drawer and waits for it to be stable.
 */
export async function openSettings(page: Page) {
  await page.getByLabel("Open settings").click();
  const drawer = page.locator('[data-testid="settings-drawer"]');
  await drawer.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await waitForStable(drawer);
  await waitForStableLayout(page);
}

/**
 * Opens the help modal and waits for it to be stable.
 */
export async function openHelp(page: Page) {
  await page.getByLabel("Open help").click();
  const modal = page.locator('[data-testid="help-modal"]');
  await modal.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await waitForStable(modal);
  await waitForStableLayout(page);
}
