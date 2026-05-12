// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FretboardHitTargetLayer } from "./FretboardHitTargetLayer";
import type { NoteData } from "./hooks/useNoteData";
import { axe } from "../../test-utils/a11y";

function makeNote(overrides: Partial<NoteData> = {}): NoteData {
  return {
    stringIndex: 0,
    fretIndex: 5,
    noteName: "C",
    octave: 4,
    noteClass: "note-active",
    displayValue: "C",
    applyDimOpacity: false,
    applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
    isHidden: false,
    isTension: false,
    isGuideTone: false,
    ...overrides,
  };
}

const defaultProps = {
  noteData: [makeNote()],
  fretCenterX: (fretIndex: number) => fretIndex * 50,
  stringYAt: (stringIndex: number) => stringIndex * 30 + 20,
  noteBubblePx: 32,
  noteFontPx: 12,
  neckWidthPx: 600,
  neckHeight: 200,
};

describe("FretboardHitTargetLayer", () => {
  it("renders a container div with absolute positioning", () => {
    const { container } = render(<FretboardHitTargetLayer {...defaultProps} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.position).toBe("absolute");
    expect(div.style.top).toBe("0px");
    expect(div.style.left).toBe("0px");
  });

  it("renders one button per note in noteData", () => {
    const noteData = [makeNote(), makeNote({ stringIndex: 1, fretIndex: 7 })];
    const { container } = render(
      <FretboardHitTargetLayer {...defaultProps} noteData={noteData} />,
    );
    expect(container.querySelectorAll("button").length).toBe(2);
  });

  it("sets aria-label with display value, string number, fret, and role", () => {
    const { container } = render(<FretboardHitTargetLayer {...defaultProps} />);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe(
      "C on string 1, fret 5, scale tone",
    );
  });

  it("includes role in aria-label for each noteClass", () => {
    const cases: Array<[NoteData["noteClass"], string | null]> = [
      ["root-active", "root"],
      ["chord-tone", "chord tone"],
      ["note-blue", "blue note"],
      ["note-active", "scale tone"],
      ["note-scale-only", "scale tone"],
      ["chord-outside", "chord outside"],
      ["note-inactive", null],
    ];
    for (const [noteClass, expectedRole] of cases) {
      const noteData = [makeNote({ noteClass })];
      const { container } = render(
        <FretboardHitTargetLayer {...defaultProps} noteData={noteData} />,
      );
      const label = container.querySelector("button")!.getAttribute("aria-label")!;
      if (expectedRole) {
        expect(label).toContain(`, ${expectedRole}`);
      } else {
        expect(label).toBe("C on string 1, fret 5");
      }
    }
  });

  it("is disabled when no onNoteClick provided", () => {
    const { container } = render(<FretboardHitTargetLayer {...defaultProps} />);
    const btn = container.querySelector("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("is enabled and calls onNoteClick when handler is provided", () => {
    const onNoteClick = vi.fn();
    const { container } = render(
      <FretboardHitTargetLayer
        {...defaultProps}
        onNoteClick={onNoteClick}
      />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onNoteClick).toHaveBeenCalledTimes(1);
    expect(onNoteClick).toHaveBeenCalledWith(0, 5, "C");
  });

  it("sets data-note-role on non-inactive notes", () => {
    const { container } = render(<FretboardHitTargetLayer {...defaultProps} />);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("data-note-role")).toBe("note-active");
  });

  it("omits data-note-role on inactive notes", () => {
    const noteData = [makeNote({ noteClass: "note-inactive" })];
    const { container } = render(
      <FretboardHitTargetLayer {...defaultProps} noteData={noteData} />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("data-note-role")).toBeNull();
  });

  it("sets aria-hidden and tabIndex=-1 on hidden notes", () => {
    const noteData = [makeNote({ isHidden: true })];
    const { container } = render(
      <FretboardHitTargetLayer {...defaultProps} noteData={noteData} />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("aria-hidden")).toBe("true");
    expect(btn.tabIndex).toBe(-1);
  });

  it("sets data-note-tension on tension notes", () => {
    const noteData = [makeNote({ isTension: true })];
    const { container } = render(
      <FretboardHitTargetLayer {...defaultProps} noteData={noteData} />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("data-note-tension")).toBeTruthy();
  });

  it("sets data-note-guide-tone on guide tone notes", () => {
    const noteData = [makeNote({ isGuideTone: true })];
    const { container } = render(
      <FretboardHitTargetLayer {...defaultProps} noteData={noteData} />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("data-note-guide-tone")).toBeTruthy();
  });

  it("sets opacity:0 so buttons are invisible hit targets", () => {
    const { container } = render(<FretboardHitTargetLayer {...defaultProps} />);
    const btn = container.querySelector("button")!;
    expect(btn.style.opacity).toBe("0");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<FretboardHitTargetLayer {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
