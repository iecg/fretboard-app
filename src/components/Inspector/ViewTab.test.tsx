import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { fretStartAtom, fretEndAtom } from "../../store/atoms";
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

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ViewTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
