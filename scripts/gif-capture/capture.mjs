/**
 * Capture screenshots of FretFlow for animated GIF.
 * Run: node scripts/gif-capture/capture.mjs
 * (Dev server must be running on port 4173)
 * Env: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH — override Chromium binary path
 */
import { chromium } from "playwright";
import { mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "frames");

const BASE_URL = "http://127.0.0.1:4173/fretboard-app/";
// desktop-split layout requires height > 899; 1200 gives enough room for CoF (576px)
// plus header+fretboard+summary chrome (~480px) + padding (32px) = ~1088px total
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
  // Click a note on the circle of fifths by its text label position
  const pos = await page.evaluate((note) => {
    const svg = document.querySelector(".circle-fifths-svg");
    if (!svg) return null;
    const texts = [...svg.querySelectorAll("text")];
    for (const t of texts) {
      if (t.textContent.trim() === note) {
        const tr = t.getBoundingClientRect();
        return { x: Math.round(tr.left + tr.width / 2), y: Math.round(tr.top + tr.height / 2) };
      }
    }
    return null;
  }, noteName);

  if (!pos) {
    console.warn(`  Note ${noteName} not found on circle`);
    return;
  }
  // Click slightly inward to hit the slice path, not the text
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(350);
}

async function selectScale(page, scaleName) {
  const drawer = page.locator(".drawer-selector").filter({ hasText: /Scale/ }).first();
  await drawer.click();
  await page.waitForTimeout(250);
  const opt = page.locator(".drawer-option").filter({ hasText: new RegExp(`^${scaleName}$`, "i") }).first();
  if (await opt.isVisible().catch(() => false)) {
    await opt.click();
  } else {
    await page.keyboard.press("Escape");
    console.warn(`  Scale "${scaleName}" not found`);
  }
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

// Click a CAGED shape button by label (All / C / A / G / E / D)
// These only appear after clicking the CAGED mode button
async function clickCagedShape(page, shape) {
  // Scope to the "Shape" control-section to avoid matching "All" in the
  // Fingering Pattern row or single letters elsewhere in the UI.
  const shapeSection = page
    .locator(".control-section")
    .filter({ has: page.locator(".section-label", { hasText: /^Shape$/ }) })
    .first();
  const btn = shapeSection.getByRole("button", { name: shape, exact: true }).first();
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

    // ── Scene 1: Default state (C Major, All notes) ──────────────────
    // Hold 5 frames so viewers see the starting position
    await shot(page, "s1_default", 5);

    // ── Scene 2: Switch root to G ────────────────────────────────────
    await clickNote(page, "G");
    await shot(page, "s2_root_G", 3);

    // ── Scene 3: Switch root to D ───────────────────────────────────
    await clickNote(page, "D");
    await shot(page, "s3_root_D", 3);

    // ── Scene 4: Switch root to A ────────────────────────────────────
    await clickNote(page, "A");
    await shot(page, "s4_root_A", 3);

    // ── Scene 5: Switch scale to Minor Pentatonic ─────────────────────
    await selectScale(page, "Minor Pentatonic");
    await shot(page, "s5_minor_pent", 4);

    // ── Scene 6: Activate CAGED view, show all shapes ─────────────────
    await clickBtn(page, "CAGED");
    await shot(page, "s6_caged_all", 4);

    // ── Scene 7: Isolate C shape ──────────────────────────────────────
    await clickCagedShape(page, "C");
    await shot(page, "s7_caged_c", 3);

    // ── Scene 8: Isolate A shape ──────────────────────────────────────
    await clickCagedShape(page, "A");
    await shot(page, "s8_caged_a", 3);

    // ── Scene 9: Isolate G shape ──────────────────────────────────────
    await clickCagedShape(page, "G");
    await shot(page, "s9_caged_g", 3);

    // ── Scene 10: Isolate E shape ─────────────────────────────────────
    await clickCagedShape(page, "E");
    await shot(page, "s10_caged_e", 3);

    // ── Scene 11: Back to All shapes ──────────────────────────────────
    await clickCagedShape(page, "All");
    await shot(page, "s11_caged_all_again", 3);

    // ── Scene 12: Switch to interval mode ─────────────────────────────
    await clickBtn(page, "Intervals");
    await shot(page, "s12_intervals", 4);

    // ── Scene 13: Switch back to notes ───────────────────────────────
    await clickBtn(page, "Notes");
    await shot(page, "s13_notes", 3);

    // ── Scene 14: Switch back to Major, root C ────────────────────────
    // Scope "All" to the Fingering Pattern section to avoid the Shape "All" button
    const fingeringSection = page
      .locator(".control-section")
      .filter({ has: page.locator(".section-label", { hasText: /^Fingering Pattern$/ }) })
      .first();
    await clickBtn(page, "All", fingeringSection);
    await selectScale(page, "Major");
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
