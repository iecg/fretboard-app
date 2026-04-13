// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabletPortraitPanel } from "./TabletPortraitPanel";

vi.mock("../CircleOfFifths", () => ({
  CircleOfFifths: ({
    rootNote,
    setRootNote,
    scaleName,
    useFlats,
  }: {
    rootNote: string;
    setRootNote: (note: string) => void;
    scaleName: string;
    useFlats: boolean;
  }) => (
    <button
      type="button"
      data-testid="circle-of-fifths"
      data-root-note={rootNote}
      data-scale-name={scaleName}
      data-use-flats={String(useFlats)}
      onClick={() => setRootNote("G")}
    />
  ),
}));

const defaultProps = {
  tabletTab: "settings" as const,
  setTabletTab: vi.fn(),
  settingsTabContent: <div>Settings Content</div>,
  scaleChordTabContent: <div>Scales Content</div>,
  rootNote: "C",
  setRootNote: vi.fn(),
  scaleName: "major",
  useFlats: false,
};

describe("TabletPortraitPanel", () => {
  it("renders both columns", () => {
    const { container } = render(<TabletPortraitPanel {...defaultProps} />);
    expect(
      container.querySelector(".tablet-portrait-settings-col"),
    ).toBeTruthy();
    expect(container.querySelector(".tablet-portrait-cof-col")).toBeTruthy();
  });

  it("shows settingsTabContent when tabletTab is settings", () => {
    render(<TabletPortraitPanel {...defaultProps} tabletTab="settings" />);
    expect(screen.getByText("Settings Content")).toBeTruthy();
    expect(screen.queryByText("Scales Content")).toBeNull();
  });

  it("shows scaleChordTabContent when tabletTab is scales", () => {
    render(<TabletPortraitPanel {...defaultProps} tabletTab="scales" />);
    expect(screen.getByText("Scales Content")).toBeTruthy();
    expect(screen.queryByText("Settings Content")).toBeNull();
  });

  it("tab switching calls setTabletTab", () => {
    const setTabletTab = vi.fn();
    render(
      <TabletPortraitPanel {...defaultProps} setTabletTab={setTabletTab} />,
    );
    fireEvent.click(screen.getByText("Scales"));
    expect(setTabletTab).toHaveBeenCalledWith("scales");
  });

  it("tab switching — clicking Controls calls setTabletTab with settings", () => {
    const setTabletTab = vi.fn();
    render(
      <TabletPortraitPanel
        {...defaultProps}
        tabletTab="scales"
        setTabletTab={setTabletTab}
      />,
    );
    fireEvent.click(screen.getByText("Controls"));
    expect(setTabletTab).toHaveBeenCalledWith("settings");
  });

  it("CoF receives and uses circle props", () => {
    const setRootNote = vi.fn();
    render(
      <TabletPortraitPanel
        {...defaultProps}
        rootNote="D"
        setRootNote={setRootNote}
        scaleName="Dorian"
        useFlats
      />,
    );
    const cof = screen.getByTestId("circle-of-fifths");
    expect(cof.getAttribute("data-root-note")).toBe("D");
    expect(cof.getAttribute("data-scale-name")).toBe("Dorian");
    expect(cof.getAttribute("data-use-flats")).toBe("true");

    fireEvent.click(cof);
    expect(setRootNote).toHaveBeenCalledWith("G");
  });

  // Accidentals control lives in SettingsOverlay, not this panel.
});
