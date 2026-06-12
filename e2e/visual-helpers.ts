import { expect, type Locator, type Page } from "@playwright/test";
import {
  STORAGE_PREFIX,
  LEGACY_KEYS,
  COACHMARK_SETTINGS_DISMISSED_KEY,
} from "../src/utils/storageConstants";

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
  /** Phase 02: chord quality for manual-mode chord overlay (Tonal symbol, e.g. "7", "maj7") */
  chordQualityOverride?: string;
  /** Phase 02: "degree" | "manual" */
  chordOverlayMode?: string;
  /** Phase 02: Roman numeral degree (e.g. "I", "V") */
  chordDegree?: string;
  chordFretSpread?: number;
  practiceLens?: string;
  theme?: "light" | "dark" | "system";
  /** Progression atom seeds (Phase 03+). */
  progressionTempoBpm?: number;
  progressionLoopEnabled?: boolean;
  progressionSteps?: Array<{
    id: string;
    degree: string;
    duration: { value: number; unit: "beat" | "bar" };
    qualityOverride: string | null;
  }>;
  fingeringPattern?: string;
  [key: string]: unknown;
}

/**
 * Opens a mobile dock panel (sheet shell only). The panel atom is
 * deliberately not persisted, so specs open panels through the dock toggles
 * exactly like a user. Waits for the panel surface to be visible.
 */
export async function openMobilePanel(page: Page, panel: "overlay" | "song") {
  await page.getByTestId(`dock-toggle-${panel}`).click();
  await expect(page.getByTestId(`mobile-${panel}-panel`)).toBeVisible();
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
    ({ s, prefix, legacyKeys, coachmarkKey }) => {
      // Clear previous state
      Object.keys(localStorage).forEach((key) => {
        const legacy = legacyKeys as readonly string[];
        if (key.startsWith(prefix) || legacy.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Suppress the first-run coach mark so it never appears in snapshots.
      localStorage.setItem(coachmarkKey, "true");

      // Map well-known atom keys to their current storage-version suffix.
      // Phase N2 bumped baseScaleNameAtom -> scaleName.v2; Phase N5 bumped
      // progressionStepsAtom -> progressionSteps.v2. Specs use the friendly
      // base name in their VisualState seed; remap here so we write to the
      // version the atoms read from at boot.
      const STORAGE_KEY_RENAMES: Record<string, string> = {
        scaleName: "scaleName.v2",
        progressionSteps: "progressionSteps.v2",
      };

      // Write new state
      Object.entries(s).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        // Serialize complex types as JSON, simple types as strings
        const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
        const storageKey = STORAGE_KEY_RENAMES[key] ?? key;
        localStorage.setItem(`${prefix}${storageKey}`, serialized);
      });
    },
    {
      s: state,
      prefix: STORAGE_PREFIX,
      legacyKeys: LEGACY_KEYS,
      coachmarkKey: COACHMARK_SETTINGS_DISMISSED_KEY,
    }
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

  // Mobile/tablet-split render the MobileShell instead of the desktop
  // app-container, so wait for whichever shell root mounts.
  await page.waitForSelector(
    '[data-testid="app-container"], [data-testid="mobile-shell"]'
  );
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

async function waitForStable(locator: Locator, timeout = 2000) {
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
 *
 * By default, this function navigates to "/" after registering the
 * coachmark-suppression init script so the flag is in localStorage before
 * the app boots. Pass `{ goto: false }` to skip the internal navigation
 * (e.g. when the caller navigates to a non-root path).
 */
export async function prepareVisualPage(
  page: Page,
  viewport = { width: 1280, height: 720 },
  options: { goto?: boolean } = {}
) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });

  // Suppress the first-run coach mark so it never appears in snapshots.
  // addInitScript covers future navigations; for callers that already
  // navigated and pass goto:false, set the flag retroactively on the
  // currently-loaded document so the suppression still applies.
  await page.addInitScript((key: string) => {
    localStorage.setItem(key, "true");
  }, COACHMARK_SETTINGS_DISMISSED_KEY);

  if (options.goto !== false) {
    // Wait for "load" (not just navigation commit) so the document is fully
    // parsed before addStyleTag injects into it. Without this, cold Docker
    // containers can time out because the page is still loading when the
    // style injection runs.
    await page.goto("/", { waitUntil: "load" });
  } else {
    await page.evaluate((key: string) => {
      localStorage.setItem(key, "true");
    }, COACHMARK_SETTINGS_DISMISSED_KEY);
  }

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
  const page = locator.page();
  await waitForStable(locator);

  const viewport = page.viewportSize();
  const bounds = await locator.boundingBox();

  // Linux Chromium can defer final layout for very tall elements until the
  // first rasterized capture. Prime those locators once so the assertion runs
  // against the post-layout geometry instead of oscillating between heights.
  if (
    viewport &&
    bounds &&
    bounds.height > viewport.height * 1.5
  ) {
    await locator.screenshot({
      animations: "disabled",
      scale: "css",
    });
    await page.evaluate(() => document.fonts.ready);
    await waitForStableLayout(page);
    await waitForStable(locator);
  }

  await expect(locator).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    scale: "css",
  });
}

/**
 * True when the current shell is the mobile/tablet-split sheet shell — the
 * compact header renders a single overflow menu instead of inline icon buttons.
 */
async function isSheetShell(page: Page): Promise<boolean> {
  return (
    (await page.locator('[data-testid="header-overflow-trigger"]').count()) > 0
  );
}

/**
 * Opens an overflow-menu item ("Settings" / "Help") on the mobile sheet shell
 * and waits for the resulting AdaptiveModal sheet to be visible + stable.
 */
async function openOverflowItem(page: Page, itemName: RegExp) {
  await page.getByTestId("header-overflow-trigger").click();
  await page.getByRole("menuitem", { name: itemName }).click();
  const sheet = page.locator('[data-testid="adaptive-modal-sheet"]');
  await sheet.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await waitForStable(sheet);
  await waitForStableLayout(page);
}

/**
 * Opens settings and waits for it to be stable. Desktop opens the inline
 * settings drawer; the mobile sheet shell opens it from the overflow menu as an
 * AdaptiveModal sheet.
 */
export async function openSettings(page: Page) {
  if (await isSheetShell(page)) {
    await openOverflowItem(page, /^Settings$/);
    return;
  }
  await page.getByLabel("Open settings").click();
  const drawer = page.locator('[data-testid="settings-drawer"]');
  await drawer.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await waitForStable(drawer);
  await waitForStableLayout(page);
}

/**
 * Opens help and waits for it to be stable. Desktop opens the inline help
 * modal; the mobile sheet shell opens it from the overflow menu as an
 * AdaptiveModal sheet.
 */
export async function openHelp(page: Page) {
  if (await isSheetShell(page)) {
    await openOverflowItem(page, /Help/);
    return;
  }
  await page.getByLabel("Open help").click();
  const modal = page.locator('[data-testid="help-modal"]');
  await modal.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await waitForStable(modal);
  await waitForStableLayout(page);
}


