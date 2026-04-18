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
    viewMode: "compare",
    setViewMode: vi.fn(),
    focusPreset: "all",
    setFocusPreset: vi.fn(),
    customMembers: [],
    setCustomMembers: vi.fn(),
    availableFocusPresets: ["all", "rootless", "custom"],
    chordMembers: [],
    hasOutsideChordMembers: false,
    useFlats: false,
  };
}

describe("TheoryControls", () => {
  it("renders root, family, and browse controls with chord overlay collapsed", () => {
    render(<TheoryControls {...makeProps()} />);

    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Scale Family" }),
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
      screen.getByRole("combobox", { name: "Mode" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chord Overlay/i })).toBeInTheDocument();
    expect(screen.queryByText("Chord Type")).not.toBeInTheDocument();
  });

  it("switches families using the scale family select", () => {
    const props = makeProps();
    render(<TheoryControls {...props} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Scale Family" }), {
      target: { value: "Pentatonic" },
    });

    expect(props.setScaleName).toHaveBeenCalledWith("Minor Pentatonic");
  });

  it("switches the active mode using the browse select in parallel mode", () => {
    const props = makeProps();
    render(<TheoryControls {...props} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), {
      target: { value: "C Dorian" },
    });

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

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), {
      target: { value: "D Dorian (2nd Mode)" },
    });

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
      screen.getByRole("combobox", { name: "Variant" }),
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

  it("shows View and Focus controls when a chord type is selected", () => {
    const props = makeProps();
    render(
      <TheoryControls
        {...props}
        chordType="Major Triad"
        availableFocusPresets={["all", "rootless", "custom"]}
        chordMembers={[
          { name: "root", semitone: 0, note: "C" },
          { name: "3", semitone: 4, note: "E" },
          { name: "5", semitone: 7, note: "G" },
        ]}
      />,
    );

    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scale + Chord" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chord Only" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rootless" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("calls setViewMode when a view option is clicked", () => {
    const props = makeProps();
    render(
      <TheoryControls
        {...props}
        chordType="Major Triad"
        availableFocusPresets={["all", "rootless", "custom"]}
        chordMembers={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Chord Only" }));
    expect(props.setViewMode).toHaveBeenCalledWith("chord");
  });

  it("calls setFocusPreset when a focus option is clicked", () => {
    const props = makeProps();
    render(
      <TheoryControls
        {...props}
        chordType="Major Triad"
        availableFocusPresets={["all", "rootless", "custom"]}
        chordMembers={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rootless" }));
    expect(props.setFocusPreset).toHaveBeenCalledWith("rootless");
  });

  it("shows custom member toggles when focusPreset is custom", () => {
    const props = makeProps();
    render(
      <TheoryControls
        {...props}
        chordType="Major Triad"
        focusPreset="custom"
        availableFocusPresets={["all", "rootless", "custom"]}
        chordMembers={[
          { name: "root", semitone: 0, note: "C" },
          { name: "3", semitone: 4, note: "E" },
          { name: "5", semitone: 7, note: "G" },
        ]}
      />,
    );

    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Root" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
  });

  it("Outside view option is disabled when hasOutsideChordMembers is false", () => {
    render(
      <TheoryControls
        {...makeProps()}
        chordType="Major Triad"
        availableFocusPresets={["all", "rootless", "custom"]}
        chordMembers={[]}
        hasOutsideChordMembers={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Outside" })).toBeDisabled();
  });

  it("Outside view option is enabled when hasOutsideChordMembers is true", () => {
    render(
      <TheoryControls
        {...makeProps()}
        chordType="Major Triad"
        availableFocusPresets={["all", "rootless", "custom"]}
        chordMembers={[]}
        hasOutsideChordMembers={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Outside" })).not.toBeDisabled();
  });
});
