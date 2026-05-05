import { expect, test } from "@playwright/test";
import { expectLocatorVisual, prepareVisualPage } from "./visual-helpers";

test.describe("Note Color Audit Visual", () => {
  test("note color audit matrix", async ({ page }) => {
    await page.goto("./?audit=note-colors");
    // Keep viewport comfortably above compact-height threshold (899px) so
    // Linux scrollbar/layout jitter can't flip to desktop-stacked mid-capture.
    await prepareVisualPage(page, { width: 1280, height: 920 });

    const boxStyle = async (auditId: string) =>
      page.evaluate((id) => {
        const card = document.querySelector(`[data-audit-id="${id}"]`);
        const target = card?.querySelector("button");
        if (!target) throw new Error(`Missing audit target: ${id}`);
        const computed = getComputedStyle(target);
        const before = getComputedStyle(target, "::before");
        return {
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          opacity: computed.opacity,
          beforeBackgroundColor: before.backgroundColor,
        };
      }, auditId);

    const fretboardShapeStyle = async (auditId: string) =>
      page.evaluate((id) => {
        const card = document.querySelector(`[data-audit-id="${id}"]`);
        if (!card) throw new Error(`Missing audit card: ${id}`);
        const target =
          card.querySelector("svg g :is(circle, rect, polygon):not([style])") ??
          card.querySelector("svg g :is(circle, rect, polygon)");
        if (!target) throw new Error(`Missing fretboard shape for: ${id}`);
        const computed = getComputedStyle(target);
        return {
          fill: computed.fill,
          stroke: computed.stroke,
        };
      }, auditId);

    const labelStyles = async (
      auditId: string,
      selector = "button span, svg text, li > span",
    ) =>
      page.evaluate(({ id, labelSelector }) => {
        const card = document.querySelector(`[data-audit-id="${id}"]`);
        if (!card) throw new Error(`Missing audit card: ${id}`);
        const labels = Array.from(card.querySelectorAll(labelSelector)).filter((element) =>
          element.textContent?.trim(),
        );

        return labels.map((element) => {
          const computed = getComputedStyle(element);
          return {
            text: element.textContent?.trim(),
            color: computed.color,
            fill: computed.fill,
            stroke: computed.stroke,
          };
        });
      }, { id: auditId, labelSelector: selector });

    const roleColor = async (auditId: string, token: string) =>
      page.evaluate(
        ({ id, tokenName }) => {
          const card = document.querySelector(`[data-audit-id="${id}"]`);
          const scope = card?.closest("[data-theme]") ?? document.documentElement;
          const raw = getComputedStyle(scope).getPropertyValue(tokenName).trim();
          const probe = document.createElement("span");
          probe.style.color = raw;
          scope.append(probe);
          const normalized = getComputedStyle(probe).color;
          probe.remove();
          return normalized;
        },
        { id: auditId, tokenName: token },
      );

    const readoutValue = async (auditId: string, label: string) =>
      page.evaluate(
        ({ id, metric }) => {
          const card = document.querySelector(`[data-audit-id="${id}"]`);
          if (!card) throw new Error(`Missing audit card: ${id}`);
          const rows = Array.from(card.querySelectorAll("dl div"));
          for (const row of rows) {
            const dt = row.querySelector("dt")?.textContent?.trim();
            if (dt === metric) {
              return row.querySelector("dd")?.textContent?.trim() ?? "";
            }
          }
          throw new Error(`Missing readout metric ${metric} for ${id}`);
        },
        { id: auditId, metric: label },
      );

    const waitForSettledReadout = async (auditId: string, label: string) => {
      const timeout = 5000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const value = await readoutValue(auditId, label);
        if (!value.startsWith("pending")) return value;
        await page.waitForTimeout(50);
      }
      throw new Error(`Timeout waiting for settled readout ${label} on ${auditId}`);
    };

    const expectLabels = async (auditId: string, color: string, selector?: string) => {
      const labels = await labelStyles(auditId, selector);
      expect(labels.length, `expected labels for ${auditId}`).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.color, `${auditId} ${label.text}`).toBe(color);
      }
    };

    const expectLabelsNot = async (auditId: string, color: string, selector?: string) => {
      const labels = await labelStyles(auditId, selector);
      expect(labels.length, `expected labels for ${auditId}`).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.color, `${auditId} ${label.text}`).not.toBe(color);
      }
    };

    const expectSvgText = async (auditId: string, fill: string) => {
      const labels = await labelStyles(auditId);
      expect(labels.length, `expected svg text for ${auditId}`).toBeGreaterThan(0);
      expect(labels[0]?.fill).toBe(fill);
    };

    const white = "rgb(255, 255, 255)";

    for (const theme of ["light", "dark"] as const) {
      const inactive = await boxStyle(`${theme}:practice-pill:none:degree-off:inactive`);
      const inScale = await boxStyle(`${theme}:practice-pill:none:degree-off:in-scale`);
      const scaleBorder = await roleColor(
        `${theme}:practice-pill:none:degree-off:in-scale`,
        "--role-scale-border",
      );

      if (theme === "light") {
        expect(inScale.backgroundColor).toBe(inactive.backgroundColor);
        expect(inScale.borderColor).toBe(scaleBorder);
      } else {
        expect(inScale.backgroundColor).not.toBe(inactive.backgroundColor);
        expect(inScale.borderColor).not.toBe(scaleBorder);
      }

      const chordRootOff = await boxStyle(`${theme}:practice-pill:none:degree-off:chord-root`);
      const chordRootOn = await boxStyle(`${theme}:practice-pill:none:degree-on:chord-root`);
      expect(chordRootOn.borderColor).toBe(chordRootOff.borderColor);
      expect(chordRootOn.backgroundColor).not.toBe(chordRootOff.backgroundColor);

      const colorNote = await boxStyle(
        `${theme}:degree-chip:none:degree-on:degree-colored-color-note`,
      );
      const colorToneRing = await roleColor(
        `${theme}:degree-chip:none:degree-on:degree-colored-color-note`,
        "--role-color-tone-ring",
      );
      expect(colorNote.backgroundColor).toBe(colorToneRing);
      expect(colorNote.beforeBackgroundColor).not.toBe(colorNote.backgroundColor);
      expect(colorNote.beforeBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    }

    expect((await boxStyle("light:practice-pill:none:degree-off:hidden")).opacity).toBe(
      "0.55",
    );
    expect((await boxStyle("light:degree-chip:none:degree-off:hidden")).opacity).toBe(
      "0.55",
    );
    expect((await boxStyle("dark:practice-pill:none:degree-off:hidden")).opacity).toBe(
      "0.4",
    );
    expect((await boxStyle("dark:degree-chip:none:degree-off:hidden")).opacity).toBe("0.4");

    for (const auditId of [
      "light:fretboard:none:degree-off:key-tonic",
      "light:practice-pill:none:degree-off:chord-root",
      "light:degree-chip:none:degree-on:degree-colored",
      "light:degree-ramp:none:degree-on:I",
      "dark:fretboard:none:degree-off:key-tonic",
      "dark:practice-pill:none:degree-off:chord-root",
      "dark:degree-chip:none:degree-on:degree-colored",
      "dark:degree-ramp:none:degree-on:I",
    ]) {
      await expect(page.locator(`[data-audit-id="${auditId}"]`)).toContainText("label ctr");
      await expect(page.locator(`[data-audit-id="${auditId}"]`)).toContainText("ring ctr");
    }

    await expectSvgText("light:fretboard:none:degree-off:key-tonic", white);
    await expectSvgText("light:fretboard:none:degree-off:chord-root", white);
    await expectSvgText("light:fretboard:guide-tones:degree-off:guide-tone-emphasis", white);
    await expectSvgText("light:fretboard:tension:degree-off:outside-tension-emphasis", white);
    await expectSvgText("light:fretboard:none:degree-on:key-tonic", white);

    for (const auditId of [
      "light:practice-pill:none:degree-off:chord-root",
      "light:practice-pill:none:degree-off:guide-tone",
      "light:practice-pill:none:degree-off:tension",
      "light:practice-pill:none:degree-off:root-tension",
      "light:practice-pill:none:degree-on:degree-colored-in-scale",
      "light:practice-pill:none:degree-on:chord-root",
    ]) {
      await expectLabels(auditId, white, "button span");
    }

    for (const auditId of [
      "light:degree-chip:none:degree-on:degree-colored",
      "light:degree-chip:none:degree-on:degree-colored-color-note",
      "light:degree-ramp:none:degree-on:I",
      "light:degree-ramp:none:degree-on:IV",
      "light:degree-ramp:none:degree-on:VI",
      "light:degree-ramp:none:degree-on:VII",
      "light:degree-ramp:none:degree-on:b5",
    ]) {
      await expectLabels(auditId, white, "button span");
    }

    for (const auditId of [
      "light:practice-pill:none:degree-off:inactive",
      "light:practice-pill:none:degree-off:in-scale",
      "light:degree-chip:none:degree-off:inactive",
      "light:degree-chip:none:degree-off:in-scale",
    ]) {
      await expectLabelsNot(auditId, white, "button span");
    }

    const lightGuidePill = await boxStyle("light:practice-pill:none:degree-off:guide-tone");
    const lightTensionPill = await boxStyle("light:practice-pill:none:degree-off:tension");
    expect(lightGuidePill.backgroundColor).not.toBe(lightTensionPill.backgroundColor);

    const lightInScaleFretboard = await fretboardShapeStyle(
      "light:fretboard:none:degree-off:chord-tone-in-scale",
    );
    const lightOutsideFretboard = await fretboardShapeStyle(
      "light:fretboard:none:degree-off:chord-tone-outside-scale",
    );
    expect(lightInScaleFretboard.fill).not.toBe(lightOutsideFretboard.fill);

    const degreeRampIds = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
    const degreeRampFills = await Promise.all(
      degreeRampIds.map(async (id) => {
        const state = await boxStyle(`light:degree-ramp:none:degree-on:${id}`);
        return state.backgroundColor;
      }),
    );
    expect(new Set(degreeRampFills).size).toBe(degreeRampIds.length);
    const blueNoteRamp = await boxStyle("light:degree-ramp:none:degree-on:b5");
    expect(blueNoteRamp.beforeBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    const darkGuidePill = await boxStyle("dark:practice-pill:none:degree-off:guide-tone");
    const darkTensionPill = await boxStyle("dark:practice-pill:none:degree-off:tension");
    const darkRootPill = await boxStyle("dark:practice-pill:none:degree-off:chord-root");
    expect(darkGuidePill.backgroundColor).not.toBe(darkTensionPill.backgroundColor);
    expect(darkTensionPill.backgroundColor).not.toBe(darkRootPill.backgroundColor);

    const darkGuideFretboard = await fretboardShapeStyle(
      "dark:fretboard:guide-tones:degree-off:guide-tone-emphasis",
    );
    const darkTensionFretboard = await fretboardShapeStyle(
      "dark:fretboard:tension:degree-off:outside-tension-emphasis",
    );
    expect(darkGuideFretboard.fill).not.toBe(darkTensionFretboard.fill);

    const darkFretboardDegreeCtr = await waitForSettledReadout(
      "dark:fretboard:none:degree-on:key-tonic",
      "label ctr",
    );
    expect(darkFretboardDegreeCtr.startsWith("fail")).toBe(false);

    const darkDegreeRampVICtr = await waitForSettledReadout(
      "dark:degree-ramp:none:degree-on:VI",
      "label ctr",
    );
    expect(darkDegreeRampVICtr.startsWith("warn")).toBe(false);
    expect(darkDegreeRampVICtr.startsWith("fail")).toBe(false);

    const darkInactivePillCtr = await waitForSettledReadout(
      "dark:practice-pill:none:degree-off:inactive",
      "label ctr",
    );
    expect(darkInactivePillCtr.startsWith("fail")).toBe(false);

    const locator = page.getByTestId("note-color-audit");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "note-color-audit-matrix");
  });
});
