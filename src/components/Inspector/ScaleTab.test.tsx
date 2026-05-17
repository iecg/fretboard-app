import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { ScaleTab } from "./ScaleTab";

describe("ScaleTab", () => {
  it("renders the Key, Theory, and Wheel column headers", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Key")).toBeInTheDocument();
    expect(screen.getByText("Theory")).toBeInTheDocument();
    expect(screen.getByText("Wheel")).toBeInTheDocument();
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
