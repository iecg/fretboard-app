import { expect, test } from "@playwright/test";
import { expectLocatorVisual, prepareVisualPage } from "./visual-helpers";

test.describe("Note Color Audit Visual", () => {
  test("note color audit matrix", async ({ page }) => {
    await page.goto("./?audit=note-colors");
    await prepareVisualPage(page, { width: 1280, height: 900 });

    const boxStyle = async (auditId: string) =>
      page.evaluate((id) => {
        const card = document.querySelector(`[data-audit-id="${id}"]`);
        const target = card?.querySelector("button, .chord-row-chip, .chord-row-legend-swatch");
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

    const labelStyles = async (
      auditId: string,
      selector = "button span, svg text, ul li span span, ul li > span:last-child",
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

      expect(inScale.backgroundColor).toBe(inactive.backgroundColor);
      expect(inScale.borderColor).toBe(scaleBorder);

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
      "light:chord-row:none:degree-off:row-chip-chord-root",
      "light:chord-row:none:degree-off:row-chip-chord-tone-in-scale",
      "light:chord-row:none:degree-off:row-chip-outside-chord",
    ]) {
      await expectLabels(auditId, white, "ul li span span, ul li > span:last-child");
    }

    for (const auditId of [
      "light:practice-pill:none:degree-off:inactive",
      "light:practice-pill:none:degree-off:in-scale",
      "light:degree-chip:none:degree-off:inactive",
      "light:degree-chip:none:degree-off:in-scale",
    ]) {
      await expectLabelsNot(auditId, white, "button span");
    }

    const locator = page.getByTestId("note-color-audit");
    await locator.scrollIntoViewIfNeeded();
    await expectLocatorVisual(locator, "note-color-audit-matrix");
  });
});
