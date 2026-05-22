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
});
