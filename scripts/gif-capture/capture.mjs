/**
 * Capture screenshots for demo GIF.
 * Requires preview server on :4173.
 */
import { chromium } from "playwright";
import { mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "frames");

const BASE_URL = "http://127.0.0.1:4173/fretboard-app/";
// desktop-split layout requires height > 899; 1200 provides enough room for CoF + chrome
const VIEWPORT = { width: 1280, height: 1200 };

let frameIdx = 0;

async function shot(page, label, count = 1) {
  for (let i = 0; i < count; i++) {
    const name = `${String(frameIdx).padStart(4, "0")}_${label}_${i}.png`;
    const file = path.join(OUT_DIR, name);
    await page.screenshot({ path: file, type: "png" });
    console.log("  frame:", name);
  }
  frameIdx++;
}

async function waitReady(page) {
  await page.waitForSelector(".fretboard-neck", { timeout: 10_000 });
  await page.waitForTimeout(400);
}

async function clickNote(page, noteName) {
  const cof = page.getByRole("group", {
    name: /Circle of Fifths — select a key/i,
  });
  const slice = cof
    .getByRole("button", { name: new RegExp(`^${noteName}`) })
    .first();
  if (await slice.isVisible().catch(() => false)) {
    await slice.click();
    await page.waitForTimeout(350);
  } else {
    throw new Error(`Note "${noteName}" not found on Circle of Fifths`);
  }
}

async function selectFamily(page, familyLabel) {
  await page.getByLabel("Scale Family").selectOption(familyLabel);
  await page.waitForTimeout(400);
}

async function clickBtn(page, name, parent = page) {
  const btn = parent.getByRole("button", { name, exact: true });
  if (await btn.first().isVisible().catch(() => false)) {
    await btn.first().click();
    await page.waitForTimeout(300);
  } else {
    console.warn(`  Button "${name}" not visible`);
  }
}

async function clickCagedShape(page, shape) {
  const shapeGroup = page.getByRole("group", { name: /^Shape$/i });
  const btn = shapeGroup
    .getByRole("button", { name: shape, exact: true })
    .first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(350);
    return;
  }
  console.warn(`  CAGED shape button "${shape}" not found`);
}

async function main() {
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  let browser;
  let ctx;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
    ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await waitReady(page);

    console.log("Capturing frames...\n");

    // Scene 1: Default state (C Major, All notes)
    await shot(page, "s1_default", 5);

    // Scene 2: Switch root to G
    await clickNote(page, "G");
    await shot(page, "s2_root_G", 3);

    // Scene 3: Switch root to D
    await clickNote(page, "D");
    await shot(page, "s3_root_D", 3);

    // Scene 4: Switch root to A
    await clickNote(page, "A");
    await shot(page, "s4_root_A", 3);

    // Scene 5: Switch family to Pentatonic (A Minor Pentatonic)
    await selectFamily(page, "Pentatonic");
    await shot(page, "s5_minor_pent", 4);

    // Scene 6: Activate CAGED view, show all shapes
    await clickBtn(page, "CAGED");
    await shot(page, "s6_caged_all", 4);

    // Scene 7: Isolate C shape
    await clickCagedShape(page, "C");
    await shot(page, "s7_caged_c", 3);

    // Scene 8: Isolate A shape
    await clickCagedShape(page, "A");
    await shot(page, "s8_caged_a", 3);

    // Scene 9: Isolate G shape
    await clickCagedShape(page, "G");
    await shot(page, "s9_caged_g", 3);

    // Scene 10: Isolate E shape
    await clickCagedShape(page, "E");
    await shot(page, "s10_caged_e", 3);

    // Scene 11: Back to All shapes
    await clickCagedShape(page, "All");
    await shot(page, "s11_caged_all_again", 3);

    // Scene 12: Switch to interval mode
    await clickBtn(page, "Intervals");
    await shot(page, "s12_intervals", 4);

    // Scene 13: Switch back to notes
    await clickBtn(page, "Notes");
    await shot(page, "s13_notes", 3);

    // Scene 14: Switch back to Major Modes, root C
    // Scope to the fingering toggle row to avoid Shape group's "All" button
    const fingeringBar = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "CAGED", exact: true }) })
      .filter({ has: page.getByRole("button", { name: "3NPS", exact: true }) })
      .first();
    await clickBtn(page, "All", fingeringBar);
    await selectFamily(page, "Major Modes");
    await clickNote(page, "C");
    await shot(page, "s14_back_to_start", 4);
  } finally {
    await ctx?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }

  const total = frameIdx;
  console.log(`\nDone. Captured ${total} scenes → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
