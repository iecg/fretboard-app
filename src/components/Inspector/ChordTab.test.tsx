import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { ChordTab } from "./ChordTab";

describe("ChordTab", () => {
  it("renders ChordOverlayControls", () => {
    renderWithAtoms(<ChordTab />);
    expect(screen.getByText(/chord mode/i)).toBeInTheDocument();
  });

  it("tags its root container with data-inspector-tab=chord", () => {
    const { container } = renderWithAtoms(<ChordTab />);
    expect(container.querySelector('[data-inspector-tab="chord"]')).not.toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ChordTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
