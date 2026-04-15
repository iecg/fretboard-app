/**
 * Captures a social-media screenshot at 1200×628 (Twitter/LinkedIn recommended size).
 * Run after `npm run dev` is up (default port 5173).
 * Usage: node scripts/capture-screenshot.mjs
 * Env: SCREENSHOT_URL — override base URL (default: http://localhost:5173/fretboard-app/)
 *      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH — override Chromium binary path
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../public/screenshot.png');
const BASE_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:5173/fretboard-app/';

// Twitter summary_large_image + LinkedIn recommended: 1200×628 (1.91:1)
const WIDTH = 1200;
const HEIGHT = 628;

async function run() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage();

  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Wait for layout to stabilise and any animations to settle
  await page.waitForTimeout(1500);

  const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  writeFileSync(OUT_PATH, buffer);

  await browser.close();
  console.log(`Screenshot saved → ${OUT_PATH} (${WIDTH}×${HEIGHT})`);
}

run().catch(err => { console.error(err); process.exit(1); });
