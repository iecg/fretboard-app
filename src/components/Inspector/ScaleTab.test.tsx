import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
import { ScaleTab } from "./ScaleTab";

describe("ScaleTab", () => {
  it("renders the Fingering group header and Key/Circle of Fifths/Theory columns", () => {
    renderWithAtoms(<ScaleTab />);
    const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headers).toEqual(["Fingering", "Key", "Circle of Fifths", "Theory"]);
  });

  it("renders the scale selector — root chips and the scale family picker", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("Scale Family", { selector: "span[class*='propLabel']" })).toBeInTheDocument();
  });

  it("renders the Theory facts readout", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Degrees")).toBeInTheDocument();
  });

  it("lazy-loads and renders the Circle of Fifths", async () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: /circle of fifths/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders the fingering pattern controls (Task 6)", () => {
    renderWithAtoms(<ScaleTab />);
    // FingeringPatternControls renders a Position ToggleBar with role=group aria-label="Position"
    expect(screen.getByRole("group", { name: /^position$/i })).toBeInTheDocument();
  });

  it("renders a visibility switch bound to scaleVisibleAtom", () => {
    renderWithAtoms(<ScaleTab />);
    const sw = screen.getByRole("switch", { name: /scale layer/i });
    expect(sw).toBeChecked();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: /circle of fifths/i }),
      ).toBeInTheDocument();
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
