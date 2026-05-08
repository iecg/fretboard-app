// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FretboardSVG } from "./FretboardSVG";
import { getFretboardNotes, STANDARD_TUNING } from "../../core/guitar";
import { axe } from "../../test-utils/a11y";

const BASE_PROPS = {
  effectiveZoom: 49,
  neckWidthPx: 49 * 13,
  startFret: 0,
  endFret: 12,
  stringRowPx: 40,
  fretboardLayout: getFretboardNotes(STANDARD_TUNING, 24),
  tuning: STANDARD_TUNING,
  highlightNotes: ["C", "E", "G"],
  rootNote: "C",
};

const getSvgNotes = () =>
  Array.from(
    document.querySelectorAll<SVGGElement>('g[class*="fretboard-note"]'),
  );

describe("FretboardNoteLayer a11y", () => {
  it("has no a11y violations", async () => {
    const { container } = render(<FretboardSVG {...BASE_PROPS} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes each note as a button with role and aria-label", () => {
    render(<FretboardSVG {...BASE_PROPS} onNoteClick={() => {}} />);
    const notes = getSvgNotes();
    expect(notes.length).toBeGreaterThan(0);
    notes.forEach((g) => {
      expect(g.getAttribute("role")).toBe("button");
      const label = g.getAttribute("aria-label") || "";
      // Format: "<note name><octave> — <role>"
      expect(label).toMatch(/^[A-G][#♯♭b]?\d\s—\s.+$/);
    });
  });

  it("aria-label includes the correct octave for the open low E string (E2)", () => {
    render(<FretboardSVG {...BASE_PROPS} highlightNotes={["E"]} onNoteClick={() => {}} />);
    const labels = getSvgNotes()
      .map((g) => g.getAttribute("aria-label") || "")
      .filter(Boolean);
    expect(labels.some((l) => l.startsWith("E2 — "))).toBe(true);
    // High E string open is E4
    expect(labels.some((l) => l.startsWith("E4 — "))).toBe(true);
  });

  it("sets tabIndex=0 when onNoteClick is provided", () => {
    render(<FretboardSVG {...BASE_PROPS} onNoteClick={() => {}} />);
    const notes = getSvgNotes();
    const focusable = notes.filter((g) => g.getAttribute("tabindex") === "0");
    expect(focusable.length).toBeGreaterThan(0);
  });

  it("sets tabIndex=-1 when onNoteClick is omitted", () => {
    render(<FretboardSVG {...BASE_PROPS} />);
    const notes = getSvgNotes();
    expect(notes.length).toBeGreaterThan(0);
    notes.forEach((g) => {
      expect(g.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("invokes onNoteClick on Enter and Space", () => {
    const onNoteClick = vi.fn();
    render(<FretboardSVG {...BASE_PROPS} onNoteClick={onNoteClick} />);
    const notes = getSvgNotes();
    fireEvent.keyDown(notes[0], { key: "Enter" });
    fireEvent.keyDown(notes[0], { key: " " });
    expect(onNoteClick).toHaveBeenCalledTimes(2);
  });

  it("does not invoke onNoteClick on unrelated keys", () => {
    const onNoteClick = vi.fn();
    render(<FretboardSVG {...BASE_PROPS} onNoteClick={onNoteClick} />);
    const notes = getSvgNotes();
    fireEvent.keyDown(notes[0], { key: "a" });
    fireEvent.keyDown(notes[0], { key: "Tab" });
    expect(onNoteClick).not.toHaveBeenCalled();
  });

  it("invokes onNoteClick on click", () => {
    const onNoteClick = vi.fn();
    render(<FretboardSVG {...BASE_PROPS} onNoteClick={onNoteClick} />);
    const notes = getSvgNotes();
    fireEvent.click(notes[0]);
    expect(onNoteClick).toHaveBeenCalledTimes(1);
  });
});
