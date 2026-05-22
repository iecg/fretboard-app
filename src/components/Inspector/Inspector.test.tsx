import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { Inspector } from "./Inspector";

describe("Inspector v2.0", () => {
  it("does not render the panelLabel kicker", () => {
    renderWithAtoms(<Inspector />);
    expect(screen.queryByText("Inspector")).not.toBeInTheDocument();
  });

  it("renders exactly two tab triggers: View and Song", () => {
    renderWithAtoms(<Inspector />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent(/view/i);
    expect(tabs[1]).toHaveTextContent(/song/i);
  });

  it("defaults to the View tab", () => {
    renderWithAtoms(<Inspector />);
    expect(screen.getByTestId("view-tab")).toBeVisible();
  });
});
