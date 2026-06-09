import { test } from "@playwright/test";
import { loadVisualState } from "../e2e/visual-helpers";

const PROGRESSION_STEPS = [
  { id: "s1", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
  { id: "s2", degree: "vi", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
  { id: "s3", degree: "IV", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
  { id: "s4", degree: "V", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
];

// ─── Social Preview: OG / Twitter (1200x628) ───────────────────────────────
test("capture-og-screenshot", async ({ page }) => {
  await loadVisualState(
    page,
    {
      rootNote: "G",
      scaleName: "major",
      theme: "dark",
      fingeringPattern: "none",
      progressionSteps: PROGRESSION_STEPS,
    },
    { width: 1200, height: 628 },
  );

  await page.screenshot({ path: "public/screenshot.png", fullPage: false });
});

// ─── Social Preview: LinkedIn (1200x627) ────────────────────────────────────
test("capture-linkedin-screenshot", async ({ page }) => {
  await loadVisualState(
    page,
    {
      rootNote: "G",
      scaleName: "major",
      theme: "dark",
      fingeringPattern: "none",
      progressionSteps: PROGRESSION_STEPS,
    },
    { width: 1200, height: 627 },
  );

  await page.screenshot({ path: "public/social-linkedin.png", fullPage: false });
});

// ─── Social Preview: WhatsApp Story (1080x1920, mobile) ─────────────────────
test("capture-whatsapp-story", async ({ page }) => {
  await loadVisualState(
    page,
    {
      rootNote: "G",
      scaleName: "major",
      theme: "dark",
      fingeringPattern: "none",
      progressionSteps: PROGRESSION_STEPS,
    },
    { width: 1080, height: 1920 },
  );

  // Navigate to Song tab on mobile layout for richer visual
  const songTab = page.getByRole("tab", { name: "Song" });
  if (await songTab.isVisible()) {
    await songTab.click();
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: "public/social-whatsapp-story.png", fullPage: false });
});

// ─── GIF Frames ─────────────────────────────────────────────────────────────
// Frame 1: C Major scale overlay, all notes
test("gif-frame-1-scale", async ({ page }) => {
  await loadVisualState(
    page,
    {
      rootNote: "C",
      scaleName: "major",
      theme: "dark",
      fingeringPattern: "none",
      displayFormat: "notes",
    },
    { width: 960, height: 540 },
  );

  await page.screenshot({ path: "scripts/gif-frames/frame-1-scale.png", fullPage: false });
});

// Frame 2: CAGED E shape
test("gif-frame-2-caged", async ({ page }) => {
  await loadVisualState(
    page,
    {
      rootNote: "C",
      scaleName: "major",
      theme: "dark",
      fingeringPattern: "caged",
      displayFormat: "notes",
    },
    { width: 960, height: 540 },
  );

  await page.screenshot({ path: "scripts/gif-frames/frame-2-caged.png", fullPage: false });
});

// Frame 3: Progression loaded (Song tab visible but not playing)
test("gif-frame-3-progression", async ({ page }) => {
  await loadVisualState(
    page,
    {
      rootNote: "C",
      scaleName: "major",
      theme: "dark",
      fingeringPattern: "none",
      displayFormat: "notes",
      progressionSteps: [
        { id: "s1", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
        { id: "s2", degree: "IV", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
        { id: "s3", degree: "V", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
        { id: "s4", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
      ],
    },
    { width: 960, height: 540 },
  );

  await page.screenshot({ path: "scripts/gif-frames/frame-3-progression.png", fullPage: false });
});

// Frame 4: Progression with chord overlay active (simulating mid-playback)
test("gif-frame-4-playback", async ({ page }) => {
  await loadVisualState(
    page,
    {
      rootNote: "C",
      scaleName: "major",
      theme: "dark",
      fingeringPattern: "none",
      displayFormat: "notes",
      chordOverlayMode: "degree",
      chordDegree: "V",
      progressionSteps: [
        { id: "s1", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
        { id: "s2", degree: "IV", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
        { id: "s3", degree: "V", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
        { id: "s4", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null },
      ],
    },
    { width: 960, height: 540 },
  );

  await page.screenshot({ path: "scripts/gif-frames/frame-4-playback.png", fullPage: false });
});
