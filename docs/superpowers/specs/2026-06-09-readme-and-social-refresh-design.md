# README & Social Media Refresh

Update the repo README, demo GIF, and social preview images to reflect the current state of FretFlow (v2.6.4, ~389 commits since last asset refresh at PR #144).

## 1. Demo GIF (`public/demo.gif`)

**Format:** 960x540 (16:9), dark theme, looping, under 3 MB.

**Capture viewport:** Fretboard-focused crop — includes the fretboard, scale degree bar, progression bar, and transport. Controls/Inspector panels are excluded to keep the GIF visually clean and readable at README scale.

**Flow (aha-moment build-up, ~8-12 seconds):**

1. **Scale overlay (2s):** C Major Ionian, all notes visible — clean starting state.
2. **CAGED shape (2s):** Toggle to CAGED fingering pattern, isolate the E shape — polygon boundary appears, notes filter to that position.
3. **Progression load (2s):** Switch to Song tab, load a progression preset (e.g. I-IV-V-I).
4. **Playback (3s):** Progression plays — voice-leading emphasis animates across notes, guide-tone ring counts down, progression bar highlights the active chord.
5. **Brief pause, then loop.**

**Capture method:** Run the app locally in the browser at a fixed viewport size, record using a screen capture tool, crop to the target region. Optimize the GIF for file size (color palette reduction, frame rate ~10-12 fps).

## 2. Social Preview Images

All three images are captured from the same app state:

- Dark theme
- A progression loaded and playing (e.g. I-vi-IV-V in G Major)
- Paused on a chord that shows voice-leading emphasis (anticipation/hold/departing colors visible)
- Guide-tone ring visible with countdown segments
- Progression bar showing the chord sequence with one chord highlighted

### 2a. OG / Twitter (`public/screenshot.png`)

- **Dimensions:** 1200x628
- **Composition:** Landscape crop — fretboard + scale degree bar + progression bar + transport.
- **Meta tags:** Already wired in `index.html` as `og:image` and `twitter:image`. Update `og:image:alt` and `twitter:image:alt` to: "FretFlow app showing progression playback with voice-leading emphasis on a guitar fretboard."

### 2b. LinkedIn (`public/social-linkedin.png`)

- **Dimensions:** 1200x627
- **Composition:** Nearly identical to OG. Compose with tighter vertical margins so key content survives LinkedIn's mobile feed crop (center ~1200x500 safe zone).
- **Usage:** For manual LinkedIn post sharing. No dedicated meta tag — LinkedIn reads `og:image`, but the dedicated file is available for direct uploads.

### 2c. WhatsApp Stories (`public/social-whatsapp-story.png`)

- **Dimensions:** 1080x1920 (9:16 vertical)
- **Composition:** Mobile layout of the app — fretboard + progression bar + bottom tab bar captured at a mobile viewport. FretFlow logo/branding at top for context (stories are ephemeral, need identity).
- **Usage:** For manual sharing to WhatsApp Stories and similar vertical-format platforms (Instagram Stories, etc.).

### Meta tag changes (`index.html`)

Update these two alt attributes:

```html
<meta property="og:image:alt" content="FretFlow app showing progression playback with voice-leading emphasis on a guitar fretboard." />
<meta name="twitter:image:alt" content="FretFlow app showing progression playback with voice-leading emphasis on a guitar fretboard." />
```

No new meta tags needed — LinkedIn and WhatsApp both read `og:image`. The extra files are for direct upload/sharing.

## 3. README Rewrite (`README.md`)

Full restructure. The app has evolved from a fretboard visualizer into a practice and theory tool. The README should reflect that.

### New structure

1. **Header** — title, badge row (keep current set), one-liner tagline.

2. **Demo GIF** — updated `public/demo.gif`, immediately after badges.

3. **What is FretFlow?** — 2-3 sentence elevator pitch. Position as an interactive practice + theory tool for guitar, not just a scale visualizer. Mention key differentiators: progression playback, voice-leading emphasis, CAGED/3NPS patterns, and audio feedback.

4. **Features** — reorganized by user workflow:

   - **Fretboard & Scales** — scale overlay across full fretboard, 3-tier note system (chord tones / scale-only / off-scale chord tones), arpeggio view, display modes (note names / interval degrees).
   - **Fingering Patterns** — All / CAGED / 3NPS, single-shape and multi-select (click / Shift+click), polygon boundary overlays.
   - **Chord Overlay** — independent chord root selector (or linked to scale root), all common chord qualities, distinct off-scale tone styling.
   - **Progressions & Playback** — progression presets, chord sequence editor, backing tracks with structural variations, transport controls (play/pause/stop), tempo and time signature controls.
   - **Practice Tools** — improvisation lenses (Root / Guide / Common), guide-tone countdown ring with beat-tick notches, voice-leading emphasis (anticipation / hold / departing cues).
   - **Circle of Fifths** — interactive annular segments for key selection, key signature display, scale degrees, enharmonic equivalents.
   - **Fretboard Controls** — fret range narrowing, zoom, quick-jump (Open / Mid / High), drag-to-scroll, audio playback (tap any note).
   - **Settings** — tuning selector, display format, theme, mute toggle, reset to defaults.

5. **Tech Stack** — updated list:
   - React 19 + TypeScript
   - Vite for bundling
   - Jotai for state management
   - Tonal.js for music theory
   - Tone.js for progression audio
   - Web Audio API for note synthesis
   - Lucide React for icons

6. **Getting Started** — commands updated from `npm` to `pnpm`:
   ```bash
   pnpm install
   pnpm run dev
   ```
   Build:
   ```bash
   pnpm run build
   ```

7. **Support** — Ko-fi badge, unchanged.

### Sections removed or merged

- "Fretboard Visualization" and "Fretboard Controls" are no longer top-level peers — absorbed into the new hierarchy.
- "Settings" is demoted to a bullet group rather than a full section.

### Sections not changed

- Badge row stays as-is (already up to date with Node 24, TS 6, React 19, Vite 8).
- License badge and Ko-fi section stay as-is.

## Execution order

1. Capture social preview images (screenshot.png, social-linkedin.png, social-whatsapp-story.png)
2. Record and optimize demo GIF
3. Update `index.html` meta tag alt text
4. Rewrite `README.md`

Images first because the README embeds the GIF.
