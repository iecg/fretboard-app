// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { TheoryControls } from "./TheoryControls";

function makeProps(): ComponentProps<typeof TheoryControls> {
  return {
    rootNote: "C",
    setRootNote: vi.fn(),
    scaleName: "Major",
    setScaleName: vi.fn(),
    chordType: null,
    setChordType: vi.fn(),
    chordRoot: "C",
    setChordRoot: vi.fn(),
    linkChordRoot: true,
    setLinkChordRoot: vi.fn(),
    hideNonChordNotes: false,
    setHideNonChordNotes: vi.fn(),
    chordIntervalFilter: "All",
    setChordIntervalFilter: vi.fn(),
    useFlats: false,
  };
}

describe("TheoryControls", () => {
  it("renders root, family, and mode selectors with chord overlay collapsed", () => {
    render(<TheoryControls {...makeProps()} />);

    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Scale Family: Major Modes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mode: Major \(Ionian\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chord Overlay/i })).toBeInTheDocument();
    expect(screen.queryByText("Chord Type")).not.toBeInTheDocument();
  });

  it("switches families using the scale family drawer", () => {
    const props = makeProps();
    render(<TheoryControls {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Scale Family:/i }));
    fireEvent.click(screen.getByText("Pentatonic"));

    expect(props.setScaleName).toHaveBeenCalledWith("Minor Pentatonic");
  });

  it("switches the active mode using the member drawer", () => {
    const props = makeProps();
    render(<TheoryControls {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Mode:/i }));
    fireEvent.click(screen.getByText("Dorian"));

    expect(props.setScaleName).toHaveBeenCalledWith("Dorian");
  });

  it("expands the chord overlay controls on demand", () => {
    render(<TheoryControls {...makeProps()} />);

    fireEvent.click(screen.getByRole("button", { name: /Chord Overlay/i }));

    expect(screen.getByText("Chord Type")).toBeInTheDocument();
  });

  it("shows the inline key explorer only after disclosure is opened", () => {
    render(
      <TheoryControls {...makeProps()} keyExplorer={<div>Key Wheel</div>} />,
    );

    expect(screen.queryByText("Key Wheel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Circle of Fifths/i }));
    expect(screen.getByText("Key Wheel")).toBeInTheDocument();
  });
});
