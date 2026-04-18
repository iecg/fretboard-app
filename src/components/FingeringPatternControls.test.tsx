// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { type CagedShape } from "../shapes";

let defaultProps: React.ComponentProps<typeof FingeringPatternControls>;

describe("FingeringPatternControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps = {
      fingeringPattern: "all",
      setFingeringPattern: vi.fn(),
      cagedShapes: new Set<CagedShape>(["C", "A", "G", "E", "D"]),
      setCagedShapes: vi.fn(),
      npsPosition: 1,
      setNpsPosition: vi.fn(),
      displayFormat: "notes",
      setDisplayFormat: vi.fn(),
    };
  });

  it("renders all fingering pattern options", () => {
    render(<FingeringPatternControls {...defaultProps} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("CAGED")).toBeInTheDocument();
    expect(screen.getByText("3NPS")).toBeInTheDocument();
  });

  it("calls setFingeringPattern on button click", () => {
    const setFingeringPattern = vi.fn();
    render(
      <FingeringPatternControls
        {...defaultProps}
        setFingeringPattern={setFingeringPattern}
      />,
    );
    fireEvent.click(screen.getByText("CAGED"));
    expect(setFingeringPattern).toHaveBeenCalledWith("caged");
  });

  it('shows Shape section only when fingeringPattern === "caged"', () => {
    const { rerender } = render(
      <FingeringPatternControls
        {...defaultProps}
        fingeringPattern="caged"
        cagedShapes={new Set<CagedShape>(["C"])}
      />,
    );
    expect(screen.getAllByText("Shape").length).toBeGreaterThan(0);

    rerender(
      <FingeringPatternControls {...defaultProps} fingeringPattern="all" />,
    );
    expect(screen.queryAllByText("Shape")).toHaveLength(0);
  });

  it('shows Position section only when fingeringPattern === "3nps"', () => {
    const { rerender } = render(
      <FingeringPatternControls {...defaultProps} fingeringPattern="3nps" />,
    );
    expect(screen.getByText("Position")).toBeInTheDocument();

    rerender(
      <FingeringPatternControls {...defaultProps} fingeringPattern="all" />,
    );
    expect(screen.queryByText("Position")).toBeNull();
  });

  it("handles shift-click multi-select for CAGED shapes", () => {
    const setCagedShapes = vi.fn();
    render(
      <FingeringPatternControls
        {...defaultProps}
        fingeringPattern="caged"
        cagedShapes={new Set<CagedShape>(["C"])}
        setCagedShapes={setCagedShapes}
      />,
    );
    const aButton = screen.getByText("A");
    fireEvent.click(aButton, { shiftKey: true });

    expect(setCagedShapes).toHaveBeenCalledTimes(1);
    const updater = setCagedShapes.mock.calls[0][0];
    expect(typeof updater).toBe("function");
    const result = updater(new Set<CagedShape>(["C"]));
    expect(result.has("C")).toBe(true);
    expect(result.has("A")).toBe(true);
  });

  it("calls setDisplayFormat when Intervals button clicked", () => {
    const setDisplayFormat = vi.fn();
    render(
      <FingeringPatternControls
        {...defaultProps}
        setDisplayFormat={setDisplayFormat}
      />,
    );
    fireEvent.click(screen.getByText("Intervals"));
    expect(setDisplayFormat).toHaveBeenCalledWith("degrees");
  });
});
