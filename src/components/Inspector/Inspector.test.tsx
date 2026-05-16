import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { progressionEnabledAtom, progressionStepsAtom, rootNoteAtom, scaleNameAtom } from "../../store/atoms";
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

  it("hides the Progression tab when progressionEnabledAtom is false", () => {
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, false]]);
    expect(screen.queryByRole("tab", { name: "Progression" })).toBeNull();
  });

  it("shows the Progression tab when progressionEnabledAtom is true", () => {
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, true]]);
    expect(screen.getByRole("tab", { name: "Progression" })).toBeInTheDocument();
  });

  it("renders the View tab body by default", () => {
    renderInspector();
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("view");
    expect(screen.getByText(/fingering pattern/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /fret range/i })).toBeInTheDocument();
  });

  it("switches to the Scale tab body when the Scale tab is selected", async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole("tab", { name: "Scale" }));
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("scale");
    expect(screen.getByText(/^root$/i)).toBeInTheDocument();
  });

  it("switches to the Chord tab body when the Chord tab is selected", async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole("tab", { name: "Chord" }));
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("chord");
    expect(screen.getByText(/chord mode/i)).toBeInTheDocument();
  });

  it("populates the Progression tab body with the ProgressionControls editor", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<Inspector />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [
        progressionStepsAtom,
        [{ id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }],
      ],
    ]);

    await user.click(screen.getByRole("tab", { name: /progression/i }));

    expect(
      screen.getByRole("switch", { name: "Progression mode" }),
    ).toBeInTheDocument();
  });
});
