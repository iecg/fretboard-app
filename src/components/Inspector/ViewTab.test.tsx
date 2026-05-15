import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  fretStartAtom,
  fretEndAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  scaleDegreeColorsEnabledAtom,
} from "../../store/atoms";
import { ViewTab } from "./ViewTab";

describe("ViewTab", () => {
  it("renders the fingering pattern controls and the fret range group", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
    expect(screen.getByText(/fingering pattern/i)).toBeInTheDocument();
  });

  it("reflects atom-seeded fret start/end values in the steppers", () => {
    renderWithAtoms(<ViewTab />, [
      [fretStartAtom, 3],
      [fretEndAtom, 8],
    ]);
    const startGroup = screen.getByRole("group", { name: /start fret/i });
    expect(startGroup.textContent).toContain("3");
    const endGroup = screen.getByRole("group", { name: /end fret/i });
    expect(endGroup.textContent).toContain("8");
  });

  it("renders the accidentals, enharmonic, and scale-degree-color controls", () => {
    renderWithAtoms(<ViewTab />, [
      [accidentalModeAtom, "flats"],
      [enharmonicDisplayAtom, "on"],
      [scaleDegreeColorsEnabledAtom, true],
    ]);
    expect(screen.getByRole("group", { name: /accidentals/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /enharmonic display/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /scale degree colors/i })).toBeInTheDocument();
    // Seeded accidental mode "flats" → the ♭ option button is pressed.
    expect(screen.getByRole("button", { name: "♭" })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the accidental mode atom when an option is clicked", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[accidentalModeAtom, "auto"]]);
    await user.click(screen.getByRole("button", { name: "♯" }));
    expect(screen.getByRole("button", { name: "♯" })).toHaveAttribute("aria-pressed", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ViewTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
