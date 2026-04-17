/**
 * T01 measurement script — captures DOM heights at critical viewports.
 * Run after `npm run dev` is up (default port 5173).
 * Usage: node scripts/measure-layout.mjs
 * Env: SCREENSHOT_URL — override base URL (default: http://localhost:5173/fretboard-app/)
 */
import { chromium } from '@playwright/test';

const BASE_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:5173/fretboard-app/';

const VIEWPORTS = [
  { name: '1200×1080', width: 1200, height: 1080 },  // desktop-expanded (controls fit)
  { name: '1200×720',  width: 1200, height: 720  },   // tablet-portrait (controls don't fit at 720)
  { name: '1200×600',  width: 1200, height: 600  },   // tablet-portrait short
  { name: '375×667',   width: 375,  height: 667  },   // mobile portrait
];

async function measure(page, vpName) {
  const data = await page.evaluate(() => {
    function h(sel) {
      const el = document.querySelector(sel);
      return el ? el.offsetHeight : 'N/A';
    }
    function bottom(sel) {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().bottom) : 'N/A';
    }
    return {
      layoutTier: document.querySelector('.app-container')?.getAttribute('data-layout-tier') ?? 'N/A',
      layoutVariant: document.querySelector('.app-container')?.getAttribute('data-layout-variant') ?? 'N/A',
      rootH: h('#root'),
      fretboardNeckH: h('.fretboard-neck'),
      summaryAreaH: h('.summary-area'),
      controlsColLeftH: h('[data-layout-tier="desktop"] .controls-col-left'),
      keyColumnH: h('[data-layout-tier="desktop"] .controls-panel > .col-span-2'),
      mobileTabPanelH: h('.mobile-tab-panel'),
      versionBadgeH: h('.version-badge'),
      versionBadgeBottom: bottom('.version-badge'),
      windowInnerH: window.innerHeight,
    };
  });
  return { viewport: vpName, ...data };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // layout stabilisation
    const data = await measure(page, vp.name);
    results.push(data);
    await page.close();
    console.log(`\n--- ${vp.name} ---`);
    console.log(JSON.stringify(data, null, 2));
  }

  await browser.close();

  // Print summary for derivation
  console.log('\n\n=== DERIVATION SUMMARY ===');

  // Use desktop measurement from 1200×1080 for constant derivation
  const desktopExpanded = results.find(r => r.layoutTier === 'desktop');
  const mobile667 = results.find(r => r.viewport === '375×667');

  if (desktopExpanded) {
    const ctrlH = typeof desktopExpanded.controlsColLeftH === 'number' ? desktopExpanded.controlsColLeftH : 0;
    const keyH  = typeof desktopExpanded.keyColumnH === 'number' ? desktopExpanded.keyColumnH : 0;
    const CONTROLS_MIN_HEIGHT = Math.ceil((ctrlH + 20) / 10) * 10;
    const KEY_MIN_HEIGHT = Math.max(keyH === 0 ? 280 : keyH, 280);
    const chromeH = 200;
    const fretboardMin = 240;
    const summaryMin = 72;
    const rootMinHeight = Math.ceil((chromeH + fretboardMin + Math.max(CONTROLS_MIN_HEIGHT, KEY_MIN_HEIGHT) + summaryMin + 20) / 10) * 10;

    console.log(`\nDesktop-expanded (${desktopExpanded.viewport}) measurements:`);
    console.log(`  controlsColLeftH  = ${desktopExpanded.controlsColLeftH}`);
    console.log(`  keyColumnH        = ${desktopExpanded.keyColumnH}`);
    console.log(`  rootH             = ${desktopExpanded.rootH}`);
    console.log(`  fretboardNeckH    = ${desktopExpanded.fretboardNeckH}`);
    console.log(`  summaryAreaH      = ${desktopExpanded.summaryAreaH}`);
    console.log(`\nDerived proposals:`);
    console.log(`  CONTROLS_MIN_HEIGHT = ${CONTROLS_MIN_HEIGHT}  (ctrlH=${ctrlH} + 20px buffer, ceil to 10)`);
    console.log(`  KEY_MIN_HEIGHT      = ${KEY_MIN_HEIGHT}  (max(keyH=${keyH}, 280))`);
    console.log(`  #root min-height    = ${rootMinHeight}  (chrome=${chromeH} + fretboard=${fretboardMin} + max(ctrl,key)=${Math.max(CONTROLS_MIN_HEIGHT, KEY_MIN_HEIGHT)} + summary=${summaryMin} + 20, ceil to 10)`);
  } else {
    console.log('\nWARNING: No desktop-expanded measurement found. Fallback to conservative estimates.');
  }

  if (mobile667) {
    const badgeBottom = mobile667.versionBadgeBottom;
    const offScreen = typeof badgeBottom === 'number' && badgeBottom > 667;
    console.log(`\nMobile 375×667 measurements:`);
    console.log(`  versionBadgeBottom = ${badgeBottom}  (${offScreen ? 'OFF-SCREEN' : 'in-viewport'})`);
    console.log(`  mobileTabPanelH    = ${mobile667.mobileTabPanelH}`);
    console.log(`  versionBadgeH      = ${mobile667.versionBadgeH}`);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
