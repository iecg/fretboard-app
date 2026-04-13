// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileTabPanel } from "./MobileTabPanel";

const defaultProps = {
  mobileTab: "key" as const,
  setMobileTab: vi.fn(),
  keyTabContent: <div>Key Content</div>,
  scaleChordTabContent: <div>Scale Content</div>,
  settingsTabContent: <div>Settings Content</div>,
};

describe("MobileTabPanel", () => {
  it("renders ToggleBar with 3 tabs", () => {
    render(<MobileTabPanel {...defaultProps} />);
    expect(screen.getByText("Key")).toBeInTheDocument();
    expect(screen.getByText("Scales")).toBeInTheDocument();
    expect(screen.getByText("Controls")).toBeInTheDocument();
  });

  it("shows keyTabContent when mobileTab is key", () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="key" />);
    expect(screen.getByText("Key Content")).toBeInTheDocument();
    expect(screen.queryByText("Scale Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings Content")).not.toBeInTheDocument();
  });

  it("shows scaleChordTabContent when mobileTab is scale", () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="scale" />);
    expect(screen.getByText("Scale Content")).toBeInTheDocument();
    expect(screen.queryByText("Key Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings Content")).not.toBeInTheDocument();
  });

  it("shows settingsTabContent when mobileTab is fretboard", () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="fretboard" />);
    expect(screen.getByText("Settings Content")).toBeInTheDocument();
    expect(screen.queryByText("Key Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Scale Content")).not.toBeInTheDocument();
  });

  it("tab switching — clicking Scales calls setMobileTab with scale", () => {
    const setMobileTab = vi.fn();
    render(<MobileTabPanel {...defaultProps} setMobileTab={setMobileTab} />);
    fireEvent.click(screen.getByText("Scales"));
    expect(setMobileTab).toHaveBeenCalledWith("scale");
  });

  it("tab switching — clicking Key calls setMobileTab with key", () => {
    const setMobileTab = vi.fn();
    render(
      <MobileTabPanel
        {...defaultProps}
        mobileTab="fretboard"
        setMobileTab={setMobileTab}
      />,
    );
    fireEvent.click(screen.getByText("Key"));
    expect(setMobileTab).toHaveBeenCalledWith("key");
  });

  it("tab switching — clicking Controls calls setMobileTab with fretboard", () => {
    const setMobileTab = vi.fn();
    render(
      <MobileTabPanel
        {...defaultProps}
        mobileTab="key"
        setMobileTab={setMobileTab}
      />,
    );
    fireEvent.click(screen.getByText("Controls"));
    expect(setMobileTab).toHaveBeenCalledWith("fretboard");
  });
});
