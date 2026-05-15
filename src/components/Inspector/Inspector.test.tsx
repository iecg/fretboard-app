import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { Inspector } from "./Inspector";

function renderInspector() {
  return renderWithAtoms(<Inspector />);
}

describe("Inspector", () => {
  it("renders View, Scale, and Chord tabs", () => {
    renderInspector();
    expect(screen.getByRole("tab", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Scale" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chord" })).toBeInTheDocument();
  });

  it("activates View tab by default", () => {
    renderInspector();
    expect(screen.getByRole("tab", { name: "View" }).getAttribute("aria-selected")).toBe("true");
  });

  it("renders one tabpanel for the active tab and tags it with the tab id", () => {
    renderInspector();
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("data-tab-id")).toBe("view");
  });

  it("clicking Scale tab makes it active and deactivates View tab", async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole("tab", { name: "Scale" }));
    expect(screen.getByRole("tab", { name: "Scale" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "View" }).getAttribute("aria-selected")).toBe("false");
  });

  it("hides the Progression tab when progressionEnabledAtom is false", async () => {
    const { progressionEnabledAtom } = await import("../../store/atoms");
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, false]]);
    expect(screen.queryByRole("tab", { name: "Progression" })).toBeNull();
  });

  it("shows the Progression tab when progressionEnabledAtom is true", async () => {
    const { progressionEnabledAtom } = await import("../../store/atoms");
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, true]]);
    expect(screen.getByRole("tab", { name: "Progression" })).toBeInTheDocument();
  });
});
