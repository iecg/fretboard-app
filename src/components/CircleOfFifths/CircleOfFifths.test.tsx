// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CircleOfFifths } from "../CircleOfFifths/CircleOfFifths";
import { CIRCLE_OF_FIFTHS, SCALES } from "@fretflow/core";
import { getCircleNoteLabels } from "@fretflow/core";
import { axe } from "../../test-utils/a11y";

describe("CircleOfFifths/CircleOfFifths", () => {
  const mockSetRootNote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCircle = (props: Partial<React.ComponentProps<typeof CircleOfFifths>> = {}) =>
    render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} {...props} />);

  describe("Rendering", () => {
    it("renders 12-slice SVG with correct viewBox", () => {
      renderCircle();
      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("viewBox")).toBe("-10 -10 280 280");
      expect(document.querySelectorAll("path").length).toBeGreaterThanOrEqual(12);
      expect(document.querySelectorAll("text").length).toBeGreaterThan(0);
    });
  });

  describe("Note selection", () => {
    it("calls setRootNote when a note is clicked", () => {
      renderCircle();
      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      expect(paths.length).toBeGreaterThan(0);
      fireEvent.click(paths[0]);
      expect(mockSetRootNote).toHaveBeenCalled();
    });

    it("highlights active root note across rerenders", () => {
      const { rerender } = renderCircle();
      expect(document.querySelectorAll("path.active").length).toBeGreaterThan(0);
      rerender(<CircleOfFifths rootNote="G" setRootNote={mockSetRootNote} />);
      expect(document.querySelectorAll("path.active").length).toBeGreaterThan(0);
    });

    it.each(CIRCLE_OF_FIFTHS)("renders %s as active root", (root) => {
      const { unmount } = renderCircle({ rootNote: root });
      expect(document.querySelectorAll("path.active").length).toBeGreaterThan(0);
      unmount();
    });
  });

  describe("Scale-aware display", () => {
    it.each([
      { root: "C", scale: "Major" },
      { root: "A", scale: "Natural Minor" },
      { root: "F", scale: "Lydian" },
      { root: "D", scale: "Dorian" },
    ])("renders for $root $scale", ({ root, scale }) => {
      renderCircle({ rootNote: root, scaleName: scale });
      expect(document.querySelector("svg")).toBeTruthy();
    });

    it("updates degrees when scale changes", () => {
      const { rerender } = renderCircle({ scaleName: "Major" });
      const before = Array.from(document.querySelectorAll("text")).map((el) => el.textContent).join("|");
      rerender(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} scaleName="Natural Minor" />);
      const after = Array.from(document.querySelectorAll("text")).map((el) => el.textContent).join("|");
      expect(after).not.toBe(before);
    });
  });

  describe("Accidentals", () => {
    it.each([true, false])("renders text elements with preferFlats=%s", (preferFlats) => {
      renderCircle({ preferFlats });
      expect(document.querySelectorAll("text").length).toBeGreaterThan(0);
    });

    it.each([["C"], ["C#"]])("switches between sharps and flats for %s", (root) => {
      const { rerender } = renderCircle({ rootNote: root, preferFlats: false });
      const before = Array.from(document.querySelectorAll("text")).map((el) => el.textContent).join("|");
      rerender(<CircleOfFifths rootNote={root} setRootNote={mockSetRootNote} preferFlats={true} />);
      const after = Array.from(document.querySelectorAll("text")).map((el) => el.textContent).join("|");
      expect(after).not.toBe(before);
    });
  });

  describe("Visual accuracy", () => {
    it("positions text labels and renders arc paths", () => {
      renderCircle();
      document.querySelectorAll("text").forEach((t) => {
        if (!t.hasAttribute("transform")) {
          expect(t.getAttribute("x")).toBeTruthy();
          expect(t.getAttribute("y")).toBeTruthy();
        }
      });
      document.querySelectorAll('path[class*="circle-slice"]').forEach((p) => {
        expect(p.getAttribute("d")).toMatch(/[A-Z]/);
      });
    });
  });

  describe("Interaction", () => {
    it("responds to sequential clicks", () => {
      renderCircle();
      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      fireEvent.click(paths[1]);
      fireEvent.click(paths[4]);
      fireEvent.click(paths[0]);
      expect(mockSetRootNote).toHaveBeenCalledTimes(3);
    });
  });

  describe("Accessibility", () => {
    it("exposes exactly 12 interactive slices with role=button", () => {
      renderCircle();
      // 12 interactive base slices + 1 non-interactive active-outline overlay = 13 total
      const interactivePaths = document.querySelectorAll('path[class*="circle-slice"][role="button"]');
      expect(interactivePaths.length).toBe(12);
    });
  });

  describe("CSS classes", () => {
    it("applies active class and updates it when root changes", () => {
      const { rerender } = renderCircle();
      const initial = document.querySelectorAll("path.active");
      expect(initial.length).toBeGreaterThan(0);
      expect(initial[0].getAttribute("class")).toContain("active");
      rerender(<CircleOfFifths rootNote="G" setRootNote={mockSetRootNote} />);
      expect(document.querySelectorAll("path.active").length).toBeGreaterThan(0);
    });
  });
});

describe("getCircleNoteLabels mode behavior", () => {
  const labels = (note: string, root: string, preferFlats: boolean, mode: "auto" | "on" | "off") =>
    getCircleNoteLabels(note, root, preferFlats, SCALES["Major"], mode);

  it.each<[string, string, string, boolean, "auto" | "on" | "off", string, string | null]>([
    // mode = "auto"
    ["auto: sharp shows flat enharmonic", "A#", "C", false, "auto", "A♯", "B♭"],
    ["auto: natural has no enharmonic", "C", "C", false, "auto", "C", null],
    ["auto: respelled note shows original as enharmonic", "A#", "A#", true, "auto", "B♭", "A♯"],
    // mode = "on"
    ["on: sharp always shows flat enharmonic", "C#", "C", false, "on", "C♯", "D♭"],
    ["on: natural with no enharmonic shows primary only", "C", "C", false, "on", "C", null],
    ["on: flat-spelled primary shows sharp enharmonic", "A#", "A#", true, "on", "B♭", "A♯"],
    // mode = "off"
    ["off: sharp shows primary only", "A#", "C", false, "off", "A♯", null],
    ["off: respelled shows respelled primary only", "A#", "A#", true, "off", "B♭", null],
    ["off: natural shows primary only", "C", "C", false, "off", "C", null],
  ])("%s", (_label, note, root, preferFlats, mode, primary, enharmonic) => {
    const r = labels(note, root, preferFlats, mode);
    expect(r.primary).toBe(primary);
    expect(r.enharmonic).toBe(enharmonic);
  });

  it("on: every enharmonic pair shows both spellings", () => {
    const pairs: [string, string][] = [
      ["C#", "D♭"], ["D#", "E♭"], ["F#", "G♭"], ["G#", "A♭"], ["A#", "B♭"],
    ];
    for (const [note, enh] of pairs) {
      expect(labels(note, "C", false, "on").enharmonic).toBe(enh);
    }
  });

  it("on: all flat-spelled pairs show distinct enharmonics", () => {
    const flatPairs: [string, string, string][] = [
      ["C#", "D♭", "C♯"], ["D#", "E♭", "D♯"], ["F#", "G♭", "F♯"], ["G#", "A♭", "G♯"], ["A#", "B♭", "A♯"],
    ];
    for (const [note, expectedPrimary, expectedEnh] of flatPairs) {
      const r = labels(note, note, true, "on");
      expect(r.primary).toBe(expectedPrimary);
      expect(r.enharmonic).toBe(expectedEnh);
      expect(r.primary).not.toBe(r.enharmonic);
    }
  });

  it("on: no duplicate labels for any of the 12 chromatic notes", () => {
    for (const note of ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]) {
      const r = labels(note, "C", false, "on");
      if (r.enharmonic !== null) expect(r.primary).not.toBe(r.enharmonic);
    }
  });

  describe("Keyboard navigation & a11y", () => {
    const getSlices = () =>
      Array.from(
        document.querySelectorAll<SVGPathElement>(
          'path[class*="circle-slice"][role="button"]',
        ),
      );

    it("has no a11y violations", async () => {
      const { container } = render(
        <CircleOfFifths rootNote="C" setRootNote={() => {}} />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("exposes 12 slices as buttons with a single tab stop", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
      const slices = getSlices();
      expect(slices).toHaveLength(12);
      const focusable = slices.filter((s) => s.getAttribute("tabindex") === "0");
      expect(focusable).toHaveLength(1);
    });

    it.each([
      ["ArrowRight", "clockwise"],
      ["ArrowDown", "clockwise alias"],
    ])("%s moves focus %s", (key) => {
      render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
      const slices = getSlices();
      fireEvent.keyDown(slices[0], { key });
      expect(slices[1].getAttribute("tabindex")).toBe("0");
    });

    it.each([
      ["ArrowLeft"],
      ["ArrowUp"],
    ])("%s from index 0 wraps to index 11", (key) => {
      render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
      const slices = getSlices();
      fireEvent.keyDown(slices[0], { key });
      expect(slices[11].getAttribute("tabindex")).toBe("0");
    });

    it("ArrowRight from index 11 wraps to index 0", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
      const slices = getSlices();
      fireEvent.keyDown(slices[0], { key: "ArrowLeft" });
      fireEvent.keyDown(slices[11], { key: "ArrowRight" });
      expect(slices[0].getAttribute("tabindex")).toBe("0");
    });

    it("Home jumps focus to C (index 0); End jumps to B", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
      const slices = getSlices();
      fireEvent.keyDown(slices[0], { key: "ArrowRight" });
      fireEvent.keyDown(slices[1], { key: "Home" });
      expect(slices[0].getAttribute("tabindex")).toBe("0");
      expect(CIRCLE_OF_FIFTHS[0]).toBe("C");

      fireEvent.keyDown(slices[0], { key: "End" });
      const bIndex = CIRCLE_OF_FIFTHS.indexOf("B");
      expect(slices[bIndex].getAttribute("tabindex")).toBe("0");
    });

    it.each([
      ["Enter"],
      [" "],
    ])("%s activates the focused note", (key) => {
      const setRootNote = vi.fn();
      render(<CircleOfFifths rootNote="C" setRootNote={setRootNote} />);
      const slices = getSlices();
      fireEvent.keyDown(slices[2], { key });
      expect(setRootNote).toHaveBeenCalledWith(CIRCLE_OF_FIFTHS[2]);
    });
  });
});
