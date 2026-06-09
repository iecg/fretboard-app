# README & Social Media Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the demo GIF, social preview images, and README to reflect FretFlow v2.6.4.

**Architecture:** A standalone Playwright capture script (`scripts/capture-assets.ts`) seeds the app into specific states via `loadVisualState` (from `e2e/visual-helpers.ts`) and captures screenshots. The GIF is assembled from those frames using `ffmpeg`. The README is a full rewrite. No production code changes except `index.html` alt text.

**Tech Stack:** Playwright (existing), ffmpeg (available at `/opt/homebrew/bin/ffmpeg`), existing `loadVisualState` helper.

---

### Task 1: Create the Playwright asset capture script

**Files:**
- Create: `scripts/capture-assets.ts`

This script captures all static screenshots (social previews) and the individual GIF frames. It uses `loadVisualState` from `e2e/visual-helpers.ts` to seed app state, then takes Playwright screenshots. It is NOT a test — it's a standalone script run with `npx playwright test --config scripts/capture-assets.ts`.

- [ ] **Step 1: Create `scripts/capture-assets.ts`**

```ts
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
```

- [ ] **Step 2: Create Playwright config for the capture script**

Create `scripts/playwright.capture.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";
import { productionConfig } from "../playwright.config.production-base";

export default defineConfig({
  ...productionConfig,
  testMatch: "scripts/capture-assets.ts",
  testIgnore: [],
  projects: [
    {
      name: "capture",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 2,
      },
    },
  ],
  use: {
    ...productionConfig.use,
  },
});
```

- [ ] **Step 3: Create the gif-frames output directory**

```bash
mkdir -p scripts/gif-frames
echo "gif-frames/" >> scripts/.gitignore
```

- [ ] **Step 4: Add `scripts/.gitignore`**

```gitignore
gif-frames/
```

- [ ] **Step 5: Commit**

```bash
git add scripts/capture-assets.ts scripts/playwright.capture.config.ts scripts/.gitignore
git commit -m "chore(scripts): add Playwright asset capture script"
```

---

### Task 2: Build the app and run the capture script

This task produces the actual image files. It requires a production build since the capture config extends `productionConfig`.

- [ ] **Step 1: Build the app**

```bash
pnpm run build
```

Expected: Clean build, `dist/` directory created.

- [ ] **Step 2: Run the capture script**

```bash
npx playwright test --config scripts/playwright.capture.config.ts
```

Expected: All 7 tests pass. Files created:
- `public/screenshot.png` (1200x628)
- `public/social-linkedin.png` (1200x627)
- `public/social-whatsapp-story.png` (1080x1920)
- `scripts/gif-frames/frame-1-scale.png`
- `scripts/gif-frames/frame-2-caged.png`
- `scripts/gif-frames/frame-3-progression.png`
- `scripts/gif-frames/frame-4-playback.png`

- [ ] **Step 3: Visually inspect the captured images**

Open each file and verify:
- Social previews show the app in dark theme with a progression loaded, fretboard visible, notes colored by role.
- GIF frames show the intended progression from scale → CAGED → progression → playback.
- WhatsApp story shows mobile layout with fretboard and progression visible.

If any frame looks wrong (e.g. wrong crop, missing elements, wrong state), adjust the `loadVisualState` parameters in `scripts/capture-assets.ts` and re-run.

- [ ] **Step 4: Commit the capture results (do not commit yet — wait for GIF assembly)**

No commit yet — the social previews and GIF will be committed together after the GIF is assembled.

---

### Task 3: Assemble the demo GIF from frames

Uses `ffmpeg` to combine the captured PNG frames into an optimized looping GIF.

- [ ] **Step 1: Assemble GIF with ffmpeg**

```bash
ffmpeg -y \
  -loop 0 \
  -framerate 0.5 \
  -i scripts/gif-frames/frame-1-scale.png \
  -framerate 0.5 \
  -i scripts/gif-frames/frame-2-caged.png \
  -framerate 0.5 \
  -i scripts/gif-frames/frame-3-progression.png \
  -framerate 0.5 \
  -i scripts/gif-frames/frame-4-playback.png \
  -filter_complex "[0][1][2][3]concat=n=4:v=1:a=0,fps=1,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  public/demo.gif
```

Each frame displays for ~2 seconds (0.5 fps), total loop ~8 seconds. The palette optimization keeps file size low.

If the command above doesn't produce the right timing, use this alternative approach with explicit frame durations:

```bash
# Create a concat file with durations
cat > scripts/gif-frames/frames.txt << 'EOF'
file 'frame-1-scale.png'
duration 2.5
file 'frame-2-caged.png'
duration 2.5
file 'frame-3-progression.png'
duration 2.5
file 'frame-4-playback.png'
duration 3
file 'frame-4-playback.png'
EOF

ffmpeg -y \
  -f concat -safe 0 -i scripts/gif-frames/frames.txt \
  -filter_complex "fps=10,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 \
  public/demo.gif
```

- [ ] **Step 2: Check GIF file size and quality**

```bash
ls -lh public/demo.gif
```

Target: under 3 MB. If larger, reduce `max_colors` to 64 or lower `bayer_scale`.

Open the GIF in a browser or viewer to verify the frame sequence loops correctly and each frame is visible long enough to read.

- [ ] **Step 3: Commit all captured assets**

```bash
git add public/screenshot.png public/social-linkedin.png public/social-whatsapp-story.png public/demo.gif
git commit -m "chore(assets): refresh demo GIF and social preview images for v2.6.4"
```

---

### Task 4: Update `index.html` meta tag alt text

**Files:**
- Modify: `index.html:47-54`

- [ ] **Step 1: Update the OG image alt text**

In `index.html`, change line 47:

```html
<!-- Before -->
<meta property="og:image:alt" content="FretFlow app screenshot showing a guitar fretboard with a scale overlay and CAGED shape highlighting." />

<!-- After -->
<meta property="og:image:alt" content="FretFlow app showing progression playback with voice-leading emphasis on a guitar fretboard." />
```

- [ ] **Step 2: Update the Twitter image alt text**

In `index.html`, change line 54:

```html
<!-- Before -->
<meta name="twitter:image:alt" content="FretFlow app screenshot showing a guitar fretboard with a scale overlay and CAGED shape highlighting." />

<!-- After -->
<meta name="twitter:image:alt" content="FretFlow app showing progression playback with voice-leading emphasis on a guitar fretboard." />
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore(meta): update social preview alt text for refreshed screenshots"
```

---

### Task 5: Rewrite `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the full contents of `README.md`**

```markdown
# FretFlow

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://iecg.github.io/fretboard-app/)
[![Version](https://img.shields.io/github/v/tag/iecg/fretboard-app?label=version&sort=semver)](https://github.com/iecg/fretboard-app/tags)
[![CI](https://github.com/iecg/fretboard-app/actions/workflows/ci.yml/badge.svg)](https://github.com/iecg/fretboard-app/actions/workflows/ci.yml)
[![Deploy](https://github.com/iecg/fretboard-app/actions/workflows/deploy.yml/badge.svg)](https://github.com/iecg/fretboard-app/actions/workflows/deploy.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20FretFlow-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/E1E01XFJ0G)

An interactive guitar fretboard for practicing scales, chords, and progressions — with real-time audio, voice-leading cues, and CAGED/3NPS fingering patterns.

![FretFlow demo](public/demo.gif)

## What is FretFlow?

FretFlow is a browser-based practice tool for guitarists who want to see and hear music theory on the fretboard. Load a chord progression, watch voice-leading emphasis flow across notes in real time, and switch between fingering patterns to find comfortable positions. Everything runs in the browser — no install, no account.

## Features

### Fretboard & Scales
- Scale overlay across the full fretboard (all common scales and modes)
- 3-tier note system — chord tones, scale-only notes, and off-scale chord tones are visually distinct
- Arpeggio view — hide scale notes to focus on chord tones only
- Display modes — toggle between note names and interval degrees

### Fingering Patterns
- **All notes** — every scale note on the fretboard
- **CAGED** — visualize individual or multiple CAGED shapes with boundary overlays; click to isolate, Shift+click to multi-select
- **3NPS** — view individual or all three-notes-per-string positions

### Chord Overlay
- Independent chord root selector (or link to the scale root)
- All common chord qualities
- Off-scale chord tones shown with distinct styling

### Progressions & Playback
- Progression presets for common chord sequences
- Chord sequence editor — add, remove, reorder, set duration per chord
- Backing tracks with structural variations and humanized timing
- Transport controls — play, pause, stop
- Tempo and time signature controls

### Practice Tools
- **Improvisation lenses** — Root, Guide Tone, and Common Tone practice modes
- **Guide-tone countdown ring** — beat-tick notches show where you are in the bar
- **Voice-leading emphasis** — anticipation, hold, and departing cues highlight smooth voice motion between chords

### Circle of Fifths
- Interactive annular segments for root note selection
- Key signature, scale degrees, and enharmonic equivalents

### Fretboard Controls
- Fret range — narrow the visible window (e.g. frets 5–12)
- Zoom — increase fret column width beyond auto-fit
- Quick-jump — scroll to Open, Mid (5), or High (12) positions
- Drag to scroll — pan horizontally
- Audio playback — tap any note to hear it

### Settings
- Tuning selector (Standard, Drop D, Open G, and more)
- Display format (notes / intervals)
- Theme (dark / light)
- Mute toggle
- Reset to defaults

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** for bundling
- **Jotai** for state management
- **Tonal.js** for music theory
- **Tone.js** for progression audio
- **Web Audio API** for note synthesis
- **Lucide React** for icons

## Getting Started

```bash
pnpm install
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

## Support

If you find FretFlow useful, consider supporting its development:

[![ko-fi](https://storage.ko-fi.com/cdn/brandasset/v2/support_me_on_kofi_badge_blue.png)](https://ko-fi.com/E1E01XFJ0G)
```

- [ ] **Step 2: Verify the README renders correctly**

Open the README in a markdown previewer or check it renders on GitHub by reviewing the PR later. Verify:
- All badges render
- GIF path is correct (`public/demo.gif`)
- Ko-fi badge renders
- No broken links

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): rewrite README for v2.6.4 feature set"
```

---

### Task 6: Final verification and cleanup

- [ ] **Step 1: Run lint to ensure no issues**

```bash
pnpm run lint
```

Expected: No errors.

- [ ] **Step 2: Run build to ensure nothing broke**

```bash
pnpm run build
```

Expected: Clean build.

- [ ] **Step 3: Verify all new files are tracked**

```bash
git status
```

Expected: Clean working tree with all changes committed across 4 commits:
1. `chore(scripts): add Playwright asset capture script`
2. `chore(assets): refresh demo GIF and social preview images for v2.6.4`
3. `chore(meta): update social preview alt text for refreshed screenshots`
4. `docs(readme): rewrite README for v2.6.4 feature set`

- [ ] **Step 4: Clean up temporary files**

```bash
rm -rf scripts/gif-frames
```

The `scripts/.gitignore` already excludes this directory, but remove it to keep the worktree clean.
