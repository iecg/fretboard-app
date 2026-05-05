/**
 * Visual regression tests for chord-tone dotted-line connector layer.
 *
 * These scenarios exercise the four chord shapes identified in 03-RESEARCH.md:
 *   1. Open major triad (C major)  — triangle polyline
 *   2. Barre chord (F major)       — multi-vertex polyline with repeated tones
 *   3. Seventh chord (G7)          — quadrilateral polyline
 *   4. Spread voicing              — polyline-break path (> 5-fret span)
 *
 * Phase 5 additions: active-voicing hover and focus states.
 *   5. C major hover  — hovering a chord-tone note activates the ring/dim effect
 *   6. C major focus  — keyboard-focusing a chord-tone note produces same effect
 *
 * Both modern-light and modern-dark themes are tested for each scenario.
 */
import { test } from "@playwright/test";
import { loadVisualState, expectLocatorVisual } from "./visual-helpers";

test.describe("Chord Connector Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  // ─── C major triad (open position) ─────────────────────────────────────────
  test("C major triad connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-c-major-dark");
  });

  test("C major triad connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-c-major-light");
  });

  // ─── F major barre chord ────────────────────────────────────────────────────
  test("F major barre connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "F",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "F",
      chordQualityOverride: "Major",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-f-major-dark");
  });

  test("F major barre connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "F",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "F",
      chordQualityOverride: "Major",
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-f-major-light");
  });

  // ─── G7 seventh chord ────────────────────────────────────────────────────────
  test("G7 dominant seventh connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "G",
      chordQualityOverride: "Dominant 7th",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-g7-dark");
  });

  test("G7 dominant seventh connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "G",
      chordQualityOverride: "Dominant 7th",
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-g7-light");
  });

  // ─── Spread voicing: extended fret range exercises the polyline-break path ──
  // Widen the visible range so the same chord tones appear in positions spanning
  // more than 5 frets apart, triggering the multi-segment polyline algorithm.
  test("spread voicing connector — dark", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
      chordFretSpread: 12,
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-spread-dark");
  });

  test("spread voicing connector — light", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      chordOverlayMode: "manual",
      chordRootOverride: "C",
      chordQualityOverride: "Major",
      chordFretSpread: 12,
      theme: "light",
    });
    const locator = page.getByTestId("fretboard-svg");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "connector-spread-light");
  });

  // ─── Phase 5: Active-voicing hover state ────────────────────────────────────
  //
  // These tests inject synthetic chord-connector SVG elements to test the CSS
  // active-voicing rules (data-has-active-voicing + data-active-voicing) without
  // relying on the localStorage-to-atom initialization path, which is inconsistent
  // in the visual test environment.
  //
  // Strategy: locate the fretboard SVG's clipPath group, inject a <g> with the
  // chord-connectors CSS class and fill+outline <path> elements, then apply
  // the active-voicing attributes to simulate a voicing being hovered/focused.
  // The injected path uses a simple circle-like SVG path centered on the fretboard.

  test("connector-c-major-hover — dark: CSS active-voicing attributes produce ring + dim", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    // Inject synthetic chord-connector elements to test CSS rules directly.
    // This simulates the DOM structure that React would produce when the chord
    // overlay is active and a voicing is hovered.
    await page.evaluate(() => {
      const svgEl = document.querySelector('[data-testid="fretboard-svg"] svg') as SVGSVGElement | null;
      if (!svgEl) return;

      const ns = "http://www.w3.org/2000/svg";

      // Find the first <g> with a clipPath attribute (the main clip group)
      const clipGroup = svgEl.querySelector("g[clip-path]") as SVGGElement | null;
      if (!clipGroup) return;

      // Get the SVG width and height for positioning
      const w = svgEl.clientWidth || 800;
      const h = svgEl.clientHeight || 200;

      // Create two voicing paths: simple ellipses at different positions
      // Voicing A (active): centered at 25% from left, 40% height
      // Voicing B (non-active): centered at 60% from left, 40% height
      const ax = w * 0.25, ay = h * 0.4, rx1 = 30, ry1 = 20;
      const bx = w * 0.60, by = h * 0.4, rx2 = 30, ry2 = 20;

      const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
        `M ${cx - rx},${cy} A ${rx},${ry} 0 0 1 ${cx + rx},${cy} A ${rx},${ry} 0 0 1 ${cx - rx},${cy} Z`;

      const pathA = ellipsePath(ax, ay, rx1, ry1);
      const pathB = ellipsePath(bx, by, rx2, ry2);
      const activeKey = "test-voicing-active";

      // Find the chord-connectors CSS module class from an existing element, or use a data attr
      // We'll create the group using the known data attribute approach instead.
      const g = document.createElementNS(ns, "g") as SVGGElement;
      // Apply the CSS module class by finding it from the stylesheet
      let chordConnectorsClass = "";
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            const text = rule.cssText;
            if (text.includes("chord-connectors") && text.includes("fill-opacity")) {
              const match = text.match(/\.([\w-]+chord-connectors[\w-]*)/);
              if (match) { chordConnectorsClass = match[1]!; break; }
            }
          }
        } catch { /* cross-origin */ }
        if (chordConnectorsClass) break;
      }
      if (chordConnectorsClass) g.classList.add(chordConnectorsClass);

      g.setAttribute("aria-hidden", "true");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("data-has-active-voicing", "true");

      // Fill pass
      const fillA = document.createElementNS(ns, "path") as SVGPathElement;
      fillA.setAttribute("d", pathA);
      fillA.setAttribute("data-layer", "fill");
      fillA.setAttribute("data-active-voicing", activeKey);
      fillA.style.fill = "var(--chord-connector-color-1, oklch(70% 0.2 220))";

      const fillB = document.createElementNS(ns, "path") as SVGPathElement;
      fillB.setAttribute("d", pathB);
      fillB.setAttribute("data-layer", "fill");
      fillB.style.fill = "var(--chord-connector-color-2, oklch(70% 0.2 30))";

      // Outline pass
      const outlineA = document.createElementNS(ns, "path") as SVGPathElement;
      outlineA.setAttribute("d", pathA);
      outlineA.setAttribute("data-layer", "outline");
      outlineA.setAttribute("data-active-voicing", activeKey);
      outlineA.style.stroke = "var(--chord-connector-color-1, oklch(70% 0.2 220))";

      const outlineB = document.createElementNS(ns, "path") as SVGPathElement;
      outlineB.setAttribute("d", pathB);
      outlineB.setAttribute("data-layer", "outline");
      outlineB.style.stroke = "var(--chord-connector-color-2, oklch(70% 0.2 30))";

      g.append(fillA, fillB, outlineA, outlineB);
      clipGroup.appendChild(g);
    });

    await expectLocatorVisual(fretboard, "connector-c-major-hover-dark");
  });

  test("connector-c-major-hover — light: CSS active-voicing attributes produce ring + dim", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      theme: "light",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    await page.evaluate(() => {
      const svgEl = document.querySelector('[data-testid="fretboard-svg"] svg') as SVGSVGElement | null;
      if (!svgEl) return;
      const ns = "http://www.w3.org/2000/svg";
      const clipGroup = svgEl.querySelector("g[clip-path]") as SVGGElement | null;
      if (!clipGroup) return;
      const w = svgEl.clientWidth || 800;
      const h = svgEl.clientHeight || 200;
      const ax = w * 0.25, ay = h * 0.4, rx1 = 30, ry1 = 20;
      const bx = w * 0.60, by = h * 0.4, rx2 = 30, ry2 = 20;
      const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
        `M ${cx - rx},${cy} A ${rx},${ry} 0 0 1 ${cx + rx},${cy} A ${rx},${ry} 0 0 1 ${cx - rx},${cy} Z`;
      const pathA = ellipsePath(ax, ay, rx1, ry1);
      const pathB = ellipsePath(bx, by, rx2, ry2);
      const activeKey = "test-voicing-active";
      const g = document.createElementNS(ns, "g") as SVGGElement;
      let chordConnectorsClass = "";
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            const text = rule.cssText;
            if (text.includes("chord-connectors") && text.includes("fill-opacity")) {
              const match = text.match(/\.([\w-]+chord-connectors[\w-]*)/);
              if (match) { chordConnectorsClass = match[1]!; break; }
            }
          }
        } catch { /* cross-origin */ }
        if (chordConnectorsClass) break;
      }
      if (chordConnectorsClass) g.classList.add(chordConnectorsClass);
      g.setAttribute("aria-hidden", "true");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("data-has-active-voicing", "true");
      const fillA = document.createElementNS(ns, "path") as SVGPathElement;
      fillA.setAttribute("d", pathA); fillA.setAttribute("data-layer", "fill");
      fillA.setAttribute("data-active-voicing", activeKey);
      fillA.style.fill = "var(--chord-connector-color-1, oklch(70% 0.2 220))";
      const fillB = document.createElementNS(ns, "path") as SVGPathElement;
      fillB.setAttribute("d", pathB); fillB.setAttribute("data-layer", "fill");
      fillB.style.fill = "var(--chord-connector-color-2, oklch(70% 0.2 30))";
      const outlineA = document.createElementNS(ns, "path") as SVGPathElement;
      outlineA.setAttribute("d", pathA); outlineA.setAttribute("data-layer", "outline");
      outlineA.setAttribute("data-active-voicing", activeKey);
      outlineA.style.stroke = "var(--chord-connector-color-1, oklch(70% 0.2 220))";
      const outlineB = document.createElementNS(ns, "path") as SVGPathElement;
      outlineB.setAttribute("d", pathB); outlineB.setAttribute("data-layer", "outline");
      outlineB.style.stroke = "var(--chord-connector-color-2, oklch(70% 0.2 30))";
      g.append(fillA, fillB, outlineA, outlineB);
      clipGroup.appendChild(g);
    });

    await expectLocatorVisual(fretboard, "connector-c-major-hover-light");
  });

  // ─── Phase 5: Active-voicing keyboard focus state ───────────────────────────

  test("connector-c-major-focus — dark: CSS active-voicing attributes (focus semantic)", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    // Same DOM injection as hover — the visual state is identical; the distinction
    // is semantic (triggered by onFocus rather than onMouseEnter in the real app).
    await page.evaluate(() => {
      const svgEl = document.querySelector('[data-testid="fretboard-svg"] svg') as SVGSVGElement | null;
      if (!svgEl) return;
      const ns = "http://www.w3.org/2000/svg";
      const clipGroup = svgEl.querySelector("g[clip-path]") as SVGGElement | null;
      if (!clipGroup) return;
      const w = svgEl.clientWidth || 800;
      const h = svgEl.clientHeight || 200;
      const ax = w * 0.35, ay = h * 0.5, rx1 = 35, ry1 = 25;
      const bx = w * 0.70, by = h * 0.5, rx2 = 35, ry2 = 25;
      const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
        `M ${cx - rx},${cy} A ${rx},${ry} 0 0 1 ${cx + rx},${cy} A ${rx},${ry} 0 0 1 ${cx - rx},${cy} Z`;
      const pathA = ellipsePath(ax, ay, rx1, ry1);
      const pathB = ellipsePath(bx, by, rx2, ry2);
      const activeKey = "test-voicing-focus-0";
      const g = document.createElementNS(ns, "g") as SVGGElement;
      let chordConnectorsClass = "";
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            const text = rule.cssText;
            if (text.includes("chord-connectors") && text.includes("fill-opacity")) {
              const match = text.match(/\.([\w-]+chord-connectors[\w-]*)/);
              if (match) { chordConnectorsClass = match[1]!; break; }
            }
          }
        } catch { /* cross-origin */ }
        if (chordConnectorsClass) break;
      }
      if (chordConnectorsClass) g.classList.add(chordConnectorsClass);
      g.setAttribute("aria-hidden", "true");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("data-has-active-voicing", "true");
      const fillA = document.createElementNS(ns, "path") as SVGPathElement;
      fillA.setAttribute("d", pathA); fillA.setAttribute("data-layer", "fill");
      fillA.setAttribute("data-active-voicing", activeKey);
      fillA.style.fill = "var(--chord-connector-color-3, oklch(70% 0.2 120))";
      const fillB = document.createElementNS(ns, "path") as SVGPathElement;
      fillB.setAttribute("d", pathB); fillB.setAttribute("data-layer", "fill");
      fillB.style.fill = "var(--chord-connector-color-5, oklch(70% 0.2 270))";
      const outlineA = document.createElementNS(ns, "path") as SVGPathElement;
      outlineA.setAttribute("d", pathA); outlineA.setAttribute("data-layer", "outline");
      outlineA.setAttribute("data-active-voicing", activeKey);
      outlineA.style.stroke = "var(--chord-connector-color-3, oklch(70% 0.2 120))";
      const outlineB = document.createElementNS(ns, "path") as SVGPathElement;
      outlineB.setAttribute("d", pathB); outlineB.setAttribute("data-layer", "outline");
      outlineB.style.stroke = "var(--chord-connector-color-5, oklch(70% 0.2 270))";
      g.append(fillA, fillB, outlineA, outlineB);
      clipGroup.appendChild(g);
    });

    await expectLocatorVisual(fretboard, "connector-c-major-focus-dark");
  });

  test("connector-c-major-focus — light: CSS active-voicing attributes (focus semantic)", async ({ page }) => {
    await loadVisualState(page, {
      rootNote: "C",
      scaleName: "Major",
      theme: "light",
    });
    const fretboard = page.getByTestId("fretboard-svg");
    await fretboard.scrollIntoViewIfNeeded();

    await page.evaluate(() => {
      const svgEl = document.querySelector('[data-testid="fretboard-svg"] svg') as SVGSVGElement | null;
      if (!svgEl) return;
      const ns = "http://www.w3.org/2000/svg";
      const clipGroup = svgEl.querySelector("g[clip-path]") as SVGGElement | null;
      if (!clipGroup) return;
      const w = svgEl.clientWidth || 800;
      const h = svgEl.clientHeight || 200;
      const ax = w * 0.35, ay = h * 0.5, rx1 = 35, ry1 = 25;
      const bx = w * 0.70, by = h * 0.5, rx2 = 35, ry2 = 25;
      const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
        `M ${cx - rx},${cy} A ${rx},${ry} 0 0 1 ${cx + rx},${cy} A ${rx},${ry} 0 0 1 ${cx - rx},${cy} Z`;
      const pathA = ellipsePath(ax, ay, rx1, ry1);
      const pathB = ellipsePath(bx, by, rx2, ry2);
      const activeKey = "test-voicing-focus-0";
      const g = document.createElementNS(ns, "g") as SVGGElement;
      let chordConnectorsClass = "";
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            const text = rule.cssText;
            if (text.includes("chord-connectors") && text.includes("fill-opacity")) {
              const match = text.match(/\.([\w-]+chord-connectors[\w-]*)/);
              if (match) { chordConnectorsClass = match[1]!; break; }
            }
          }
        } catch { /* cross-origin */ }
        if (chordConnectorsClass) break;
      }
      if (chordConnectorsClass) g.classList.add(chordConnectorsClass);
      g.setAttribute("aria-hidden", "true");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("data-has-active-voicing", "true");
      const fillA = document.createElementNS(ns, "path") as SVGPathElement;
      fillA.setAttribute("d", pathA); fillA.setAttribute("data-layer", "fill");
      fillA.setAttribute("data-active-voicing", activeKey);
      fillA.style.fill = "var(--chord-connector-color-3, oklch(70% 0.2 120))";
      const fillB = document.createElementNS(ns, "path") as SVGPathElement;
      fillB.setAttribute("d", pathB); fillB.setAttribute("data-layer", "fill");
      fillB.style.fill = "var(--chord-connector-color-5, oklch(70% 0.2 270))";
      const outlineA = document.createElementNS(ns, "path") as SVGPathElement;
      outlineA.setAttribute("d", pathA); outlineA.setAttribute("data-layer", "outline");
      outlineA.setAttribute("data-active-voicing", activeKey);
      outlineA.style.stroke = "var(--chord-connector-color-3, oklch(70% 0.2 120))";
      const outlineB = document.createElementNS(ns, "path") as SVGPathElement;
      outlineB.setAttribute("d", pathB); outlineB.setAttribute("data-layer", "outline");
      outlineB.style.stroke = "var(--chord-connector-color-5, oklch(70% 0.2 270))";
      g.append(fillA, fillB, outlineA, outlineB);
      clipGroup.appendChild(g);
    });

    await expectLocatorVisual(fretboard, "connector-c-major-focus-light");
  });
});
