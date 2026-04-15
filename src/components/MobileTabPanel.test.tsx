// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileTabPanel } from "./MobileTabPanel";

const defaultProps = {
  mobileTab: "theory" as const,
  setMobileTab: vi.fn(),
  theoryTabContent: <div>Theory Content</div>,
  viewTabContent: <div>View Content</div>,
};

describe("MobileTabPanel", () => {
  it("renders ToggleBar with 2 tabs", () => {
    render(<MobileTabPanel {...defaultProps} />);
    expect(screen.getByText("Theory")).toBeInTheDocument();
    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("shows theoryTabContent when mobileTab is theory", () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="theory" />);
    expect(screen.getByText("Theory Content")).toBeInTheDocument();
    expect(screen.queryByText("View Content")).not.toBeInTheDocument();
  });

  it("shows viewTabContent when mobileTab is view", () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="view" />);
    expect(screen.getByText("View Content")).toBeInTheDocument();
    expect(screen.queryByText("Theory Content")).not.toBeInTheDocument();
  });

  it("clicking Theory calls setMobileTab with theory", () => {
    const setMobileTab = vi.fn();
    render(<MobileTabPanel {...defaultProps} setMobileTab={setMobileTab} />);
    fireEvent.click(screen.getByText("Theory"));
    expect(setMobileTab).toHaveBeenCalledWith("theory");
  });

  it("clicking View calls setMobileTab with view", () => {
    const setMobileTab = vi.fn();
    render(
      <MobileTabPanel
        {...defaultProps}
        mobileTab="theory"
        setMobileTab={setMobileTab}
      />,
    );
    fireEvent.click(screen.getByText("View"));
    expect(setMobileTab).toHaveBeenCalledWith("view");
  });
});
