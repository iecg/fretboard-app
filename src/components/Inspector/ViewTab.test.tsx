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
  fullChordsEnabledAtom,
  isMutedAtom,
  displayFormatAtom,
} from "../../store/atoms";
import { ViewTab } from "./ViewTab";

describe("ViewTab", () => {
  it("renders the Fingering, Labels, and Display group headers", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByText("Fingering")).toBeInTheDocument();
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
  });

  it("renders the fingering pattern control and the fret range group", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CAGED" })).toBeInTheDocument();
  });

  it("reflects atom-seeded fret start/end values in the steppers", () => {
    renderWithAtoms(<ViewTab />, [
      [fretStartAtom, 3],
      [fretEndAtom, 8],
    ]);
    expect(screen.getByRole("group", { name: /start fret/i }).textContent).toContain("3");
    expect(screen.getByRole("group", { name: /end fret/i }).textContent).toContain("8");
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

  it("renders the Display group toggles bound to their atoms", () => {
    renderWithAtoms(<ViewTab />, [
      [scaleDegreeColorsEnabledAtom, true],
      [fullChordsEnabledAtom, false],
      [isMutedAtom, false],
    ]);
    expect(screen.getByRole("switch", { name: "Degree Colors" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: "Full Chords" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    // Tap to Play is the inverse of isMuted — not muted → checked.
    expect(screen.getByRole("switch", { name: "Tap to Play" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("turns Tap to Play on (unmutes) when switched from a muted state", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ViewTab />, [[isMutedAtom, true]]);
    const tapToPlay = screen.getByRole("switch", { name: "Tap to Play" });
    expect(tapToPlay).toHaveAttribute("aria-checked", "false");
    await user.click(tapToPlay);
    expect(screen.getByRole("switch", { name: "Tap to Play" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ViewTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
