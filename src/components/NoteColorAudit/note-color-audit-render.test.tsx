import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        fill: isDark ? "dark-fill" : "light-fill",
        stroke: isDark ? "dark-stroke" : "light-stroke",
        "stroke-width": isDark ? "2.3px" : "3.6px",
        "stroke-dasharray": "none",
        opacity: "1",
        "background-color": isDark ? "dark-bg" : "light-bg",
        "border-color": isDark ? "dark-border" : "light-border",
        "border-width": "1px",
        "border-style": "solid",
        color: isDark ? "dark-label" : "light-label",
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

  it("settles light and dark readouts after the document-level audit theme is removed", async () => {
    const { container } = render(<NoteColorAudit />);

    document.documentElement.removeAttribute("data-theme");
    await flushAnimationFrame();
    await flushAnimationFrame();

    const lightCard = container.querySelector(
      '[data-audit-id="light:fretboard:none:degree-off:key-tonic"]',
    );
    const darkCard = container.querySelector(
      '[data-audit-id="dark:fretboard:none:degree-off:key-tonic"]',
    );

    expect(lightCard).toHaveTextContent("light-fill");
    expect(lightCard).toHaveTextContent("3.6px");
    expect(darkCard).toHaveTextContent("dark-fill");
    expect(darkCard).toHaveTextContent("2.3px");
    expect(darkCard).not.toHaveTextContent("light-fill");
    expect(darkCard).not.toHaveTextContent("3.6px");
  });

  it("prints label color readouts for each audit surface", async () => {
    const { container } = render(<NoteColorAudit />);

    document.documentElement.removeAttribute("data-theme");
    await flushAnimationFrame();
    await flushAnimationFrame();

    const fretboardCard = container.querySelector(
      '[data-audit-id="light:fretboard:none:degree-off:key-tonic"]',
    );
    const practiceCard = container.querySelector(
      '[data-audit-id="light:practice-pill:none:degree-off:chord-root"]',
    );
    const degreeCard = container.querySelector(
      '[data-audit-id="light:degree-chip:none:degree-on:degree-colored"]',
    );
    const chordRowCard = container.querySelector(
      '[data-audit-id="light:chord-row:none:degree-off:row-chip-chord-root"]',
    );
    const degreeRampCard = container.querySelector(
      '[data-audit-id="light:degree-ramp:none:degree-on:I"]',
    );

    expect(fretboardCard).toHaveTextContent("text fill");
    expect(fretboardCard).toHaveTextContent("text stroke");
    for (const card of [practiceCard, degreeCard, chordRowCard, degreeRampCard]) {
      expect(card).toHaveTextContent("label");
      expect(card).toHaveTextContent("light-label");
    }
  });
});
