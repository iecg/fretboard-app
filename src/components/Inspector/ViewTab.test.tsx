import { describe, it, expect } from "vitest";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { screen } from "@testing-library/react";
import { ViewTab } from "./ViewTab";

describe("ViewTab", () => {
  it("renders the Scale Fingering group heading", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByText(/scale fingering/i)).toBeInTheDocument();
  });

  it("renders the Chord Voicing group heading", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByText(/chord voicing/i)).toBeInTheDocument();
  });

  it("exposes a data-inspector-tab attribute for layout selectors", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByTestId("view-tab")).toHaveAttribute(
      "data-inspector-tab",
      "view",
    );
  });
});
