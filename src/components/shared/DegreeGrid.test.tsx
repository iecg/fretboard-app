import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DegreeGrid } from "./DegreeGrid";

describe("DegreeGrid", () => {
  const baseProps = {
    scaleName: "Major",
    tonicNote: "C",
    selectedNote: "C",
    onSelectInKey: vi.fn(),
    onSelectBorrowed: vi.fn(),
    useFlats: false,
  };

  it("renders 12 cells (one per chromatic note)", () => {
    render(<DegreeGrid {...baseProps} />);
    const cells = screen.getAllByRole("button");
    expect(cells).toHaveLength(12);
  });

  it("shows in-key notes with their Roman numeral (i, IV, V, …)", () => {
    render(<DegreeGrid {...baseProps} />);
    const c = screen.getByRole("button", { name: /^C/ });
    expect(c).toHaveTextContent("I");
  });

  it("shows borrowed notes with ♭/♯-prefixed numerals and a muted style", () => {
    render(<DegreeGrid {...baseProps} />);
    const cSharp = screen.getByRole("button", { name: /^C#|C♯/ });
    expect(cSharp).toHaveAttribute("data-in-key", "false");
    expect(cSharp.textContent).toMatch(/[♭♯]/);
  });

  it("calls onSelectInKey when an in-key cell is clicked", () => {
    const onSelectInKey = vi.fn();
    render(<DegreeGrid {...baseProps} onSelectInKey={onSelectInKey} />);
    fireEvent.click(screen.getByRole("button", { name: /^F\s/i }));
    expect(onSelectInKey).toHaveBeenCalledWith("F", "IV");
  });

  it("calls onSelectBorrowed when a borrowed cell is clicked", () => {
    const onSelectBorrowed = vi.fn();
    render(<DegreeGrid {...baseProps} onSelectBorrowed={onSelectBorrowed} />);
    fireEvent.click(screen.getByRole("button", { name: /^C#|C♯/ }));
    expect(onSelectBorrowed).toHaveBeenCalledWith("C#", "♭ii");
  });

  describe("borrowed numerals across modes", () => {
    it("labels A Natural Minor's borrowed cells with parent-major-relative numerals", () => {
      const onSelectBorrowed = vi.fn();
      render(
        <DegreeGrid
          {...baseProps}
          scaleName="Natural Minor"
          tonicNote="A"
          selectedNote="A"
          onSelectBorrowed={onSelectBorrowed}
        />,
      );
      // In A Natural Minor: in-key = A B C D E F G;
      // borrowed offsets {1,4,6,9,11} → A#, C#, D#, F#, G#.
      const cases: Array<[string, string]> = [
        ["A#", "♭ii"],
        ["C#", "iii"],
        ["D#", "♯iv"],
        ["F#", "vi"],
        ["G#", "vii"],
      ];
      for (const [note, expectedNumeral] of cases) {
        const btn = screen.getByRole("button", {
          name: new RegExp(`${expectedNumeral} `),
        });
        expect(btn).toHaveAttribute("data-in-key", "false");
        expect(btn.textContent).toContain(expectedNumeral);
        fireEvent.click(btn);
        expect(onSelectBorrowed).toHaveBeenCalledWith(note, expectedNumeral);
      }
    });

    it("labels D Dorian's borrowed cells with parent-major-relative numerals", () => {
      render(
        <DegreeGrid
          {...baseProps}
          scaleName="Dorian"
          tonicNote="D"
          selectedNote="D"
        />,
      );
      // In D Dorian: in-key = D E F G A B C;
      // borrowed offsets {1,4,6,8,11} → D#, F#, G#, A#, C#.
      const expected: Record<string, string> = {
        "D#": "♭ii",
        "F#": "iii",
        "G#": "♯iv",
        "A#": "♭vi",
        "C#": "vii",
      };
      for (const [note, numeral] of Object.entries(expected)) {
        const btn = screen.getByRole("button", {
          name: new RegExp(`^${numeral} `),
        });
        expect(btn).toHaveAttribute("data-in-key", "false");
        expect(btn.textContent).toContain(numeral);
        expect(btn.getAttribute("aria-label")).toContain(note.replace("#", "♯"));
      }
    });

    it("never renders a raw integer numeral as a borrowed label", () => {
      render(
        <DegreeGrid
          {...baseProps}
          scaleName="Natural Minor"
          tonicNote="A"
          selectedNote="A"
        />,
      );
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        // The numeral span never contains a raw single-digit fallback.
        expect(btn.textContent).not.toMatch(/\b\d{1,2}\b/);
      }
    });
  });
});
