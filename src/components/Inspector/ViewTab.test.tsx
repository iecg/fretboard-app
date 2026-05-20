import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { enharmonicDisplayAtom } from "../../store/audioAtoms";
import { fretStartAtom, fretEndAtom } from "../../store/layoutAtoms";
import { accidentalModeAtom } from "../../store/scaleAtoms";
import { scaleDegreeColorsEnabledAtom, displayFormatAtom } from "../../store/uiAtoms";
import { ViewTab } from "./ViewTab";

describe("ViewTab", () => {
  it("renders the Labels and Display group headers (Fingering moved to ScaleTab)", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.queryByText("Fingering")).not.toBeInTheDocument();
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
  });

  it("renders the fret range group (fingering pattern controls moved to ScaleTab)", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CAGED" })).not.toBeInTheDocument();
  });

  it("reflects atom-seeded fret start/end values in the steppers", () => {
    renderWithAtoms(<ViewTab />, [
      [fretStartAtom, 3],
      [fretEndAtom, 8],
    ]);
    const fretRange = screen.getByRole("group", { name: /fret range/i });
    expect(fretRange.textContent).toContain("3");
    expect(fretRange.textContent).toContain("8");
  });

  it("renders the accidentals and enharmonic controls", () => {
    renderWithAtoms(<ViewTab />, [
      [accidentalModeAtom, "flats"],
      [enharmonicDisplayAtom, "on"],
    ]);
    expect(screen.getByRole("group", { name: /accidentals/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /enharmonic display/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "♭" })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the accidental mode atom when an option is clicked", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[accidentalModeAtom, "auto"]]);
    await user.click(screen.getByRole("button", { name: "♯" }));
    expect(screen.getByRole("button", { name: "♯" })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the display format atom when a Note Labels option is clicked", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[displayFormatAtom, "notes"]]);
    await user.click(screen.getByRole("button", { name: "Intervals" }));
    expect(screen.getByRole("button", { name: "Intervals" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders the Degree Colors toggle bound to its atom", () => {
    renderWithAtoms(<ViewTab />, [
      [scaleDegreeColorsEnabledAtom, true],
    ]);
    expect(screen.getByRole("switch", { name: "Degree Colors" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("shows state word on the Degree Colors toggle", () => {
    renderWithAtoms(<ViewTab />, [
      [scaleDegreeColorsEnabledAtom, false],
    ]);
    expect(screen.getByText("Uniform")).toBeInTheDocument();
  });

  it("omits the Full Chords and Tap to Play toggles", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.queryByText("Full Chords")).not.toBeInTheDocument();
    expect(screen.queryByText("Tap to Play")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
  });

  it("no longer renders the fingering pattern controls (Task 6)", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.queryByRole("group", { name: /^position$/i })).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ViewTab />);
    const results = await axe(container, {
      rules: {
        // ToggleBar role="group" without aria-label is a known gap tracked separately
        "aria-allowed-role": { enabled: true },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
