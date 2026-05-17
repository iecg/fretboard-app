import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../test-utils/a11y";
import { NoteColorAudit } from "./NoteColorAudit";

function makeComputedStyle(values: Record<string, string>): CSSStyleDeclaration {
  return {
    getPropertyValue: (property: string) => values[property] ?? "",
  } as CSSStyleDeclaration;
}

describe("note color audit render readouts", () => {
  let rafCallbacks: Array<FrameRequestCallback | null>;
  let nextRafId: number;

  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 0;
    document.documentElement.setAttribute("data-theme", "modern-light");

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++nextRafId;
      rafCallbacks[id] = callback;
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafCallbacks[id] = null;
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
      const rootTheme = document.documentElement.getAttribute("data-theme");
      const panelTheme = element.closest("[data-theme]")?.getAttribute("data-theme");
      const effectiveTheme = rootTheme === "modern-light" ? rootTheme : panelTheme;
      const isDark = effectiveTheme === "modern-dark";

      return makeComputedStyle({
        fill: isDark ? "rgb(20, 30, 40)" : "rgb(234, 88, 12)",
        stroke: isDark ? "rgb(255, 154, 77)" : "rgb(180, 83, 9)",
        "stroke-width": isDark ? "2.3px" : "3.6px",
        "stroke-dasharray": "none",
        opacity: "1",
        "background-color": isDark ? "rgb(20, 30, 40)" : "rgb(243, 239, 232)",
        "border-color": isDark ? "rgb(255, 154, 77)" : "rgb(234, 88, 12)",
        "border-width": "1px",
        "border-style": "solid",
        color: isDark ? "rgb(245, 245, 247)" : "rgb(15, 23, 42)",
        "text-shadow": isDark ? "none" : "rgba(0, 0, 0, 0.55) 0px 1px 1px",
      });
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function flushAnimationFrame() {
    const callbacks = rafCallbacks;
    rafCallbacks = [];

    await act(async () => {
      callbacks.forEach((callback) => callback?.(performance.now()));
    });
  }

  async function renderAudit() {
    const rendered = render(<NoteColorAudit />);
    document.documentElement.removeAttribute("data-theme");
    await flushAnimationFrame();
    await flushAnimationFrame();

    return rendered;
  }

  it("settles light and dark readouts after the document-level audit theme is removed", async () => {
    const { container } = await renderAudit();

    const lightCard = container.querySelector(
      '[data-audit-id="light:fretboard:none:degree-off:key-tonic"]',
    );
    const darkCard = container.querySelector(
      '[data-audit-id="dark:fretboard:none:degree-off:key-tonic"]',
    );

    expect(lightCard).toHaveTextContent("rgb(234, 88, 12)");
    expect(lightCard).toHaveTextContent("3.6px");
    expect(darkCard).toHaveTextContent("rgb(20, 30, 40)");
    expect(darkCard).toHaveTextContent("2.3px");
    expect(darkCard).not.toHaveTextContent("rgb(234, 88, 12)");
    expect(darkCard).not.toHaveTextContent("3.6px");
  });

  it("prints label color readouts for each audit surface", async () => {
    const { container } = await renderAudit();

    const fretboardCard = container.querySelector(
      '[data-audit-id="light:fretboard:none:degree-off:key-tonic"]',
    );
    const practiceCard = container.querySelector(
      '[data-audit-id="light:practice-pill:none:degree-off:chord-root"]',
    );
    const degreeCard = container.querySelector(
      '[data-audit-id="light:degree-chip:none:degree-off:inactive"]',
    );
    const degreeRampCard = container.querySelector(
      '[data-audit-id="light:degree-ramp:none:degree-on:I"]',
    );

    expect(fretboardCard).toHaveTextContent("text fill");
    expect(fretboardCard).toHaveTextContent("text stroke");
    expect(fretboardCard).toHaveTextContent("text s-w");
    expect(fretboardCard).toHaveTextContent("label ctr");
    expect(fretboardCard).toHaveTextContent("ring ctr");
    for (const card of [practiceCard, degreeCard, degreeRampCard]) {
      expect(card).toHaveTextContent("label");
      expect(card).toHaveTextContent("rgb(15, 23, 42)");
      expect(card).toHaveTextContent("label shadow");
      expect(card).toHaveTextContent("label ctr");
      expect(card).toHaveTextContent("ring ctr");
    }
  });

  it("has no accessibility violations for the light audit panel", { timeout: 30_000 }, async () => {
    const { container } = await renderAudit();

    const lightPanel = container.querySelector('[aria-label="Light theme audit"]');
    expect(lightPanel).toBeTruthy();
    expect(await axe(lightPanel as HTMLElement)).toHaveNoViolations();
  });
});
