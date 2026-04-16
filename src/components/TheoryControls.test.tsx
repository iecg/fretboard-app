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
    scaleBrowseMode: "parallel",
    setScaleBrowseMode: vi.fn(),
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
  it("renders root, family, and browse controls with chord overlay collapsed", () => {
    render(<TheoryControls {...makeProps()} />);

    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Scale Family: Major Modes/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parallel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Previous Mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Next Mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mode: C Major \(Ionian\)/i }),
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

  it("switches the active mode using the browse drawer in parallel mode", () => {
    const props = makeProps();
    render(<TheoryControls {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Mode:/i }));
    fireEvent.click(screen.getByText("C Dorian"));

    expect(props.setScaleName).toHaveBeenCalledWith("Dorian");
    expect(props.setRootNote).toHaveBeenCalledWith("C");
  });

  it("switches root and mode together when relative browsing is active", () => {
    const props = makeProps();
    render(
      <TheoryControls
        {...props}
        rootNote="C"
        scaleName="Major"
        scaleBrowseMode="relative"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Mode:/i }));
    fireEvent.click(screen.getByText("D Dorian (2nd Mode)"));

    expect(props.setRootNote).toHaveBeenCalledWith("D");
    expect(props.setScaleName).toHaveBeenCalledWith("Dorian");
  });

  it("hides the browse-mode toggle for variant families", () => {
    render(
      <TheoryControls
        {...makeProps()}
        scaleName="Minor Pentatonic"
        scaleBrowseMode="relative"
      />,
    );

    expect(screen.queryByRole("button", { name: "Parallel" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Variant: C Minor Pentatonic/i }),
    ).toBeInTheDocument();
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
