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

  it("renders the Progression tab even when progressionEnabledAtom is false", () => {
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, false]]);
    expect(screen.getByRole("tab", { name: "Progression" })).toBeInTheDocument();
  });

  it("renders the Progression tab when progressionEnabledAtom is true", () => {
    renderWithAtoms(<Inspector />, [[progressionEnabledAtom, true]]);
    expect(screen.getByRole("tab", { name: "Progression" })).toBeInTheDocument();
  });

  it("renders the View tab body by default", () => {
    renderInspector();
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("view");
    expect(screen.getByText("Fingering")).toBeInTheDocument();
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
    expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
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

  it("defaults to top placement with no tab icons visible", () => {
    const { container } = renderInspector();
    const root = container.querySelector('[role="tablist"]')?.closest("[data-placement]");
    expect(root?.getAttribute("data-placement")).toBe("top");
  });

  it("renders bottom placement with a data-placement attribute when placement is bottom", () => {
    const { container } = renderWithAtoms(<Inspector placement="bottom" />);
    const root = container.querySelector('[role="tablist"]')?.closest("[data-placement]");
    expect(root?.getAttribute("data-placement")).toBe("bottom");
  });

  it("renders the Inspector panel label on the top placement", () => {
    renderWithAtoms(<Inspector placement="top" />);
    expect(screen.getByText("Inspector")).toBeInTheDocument();
  });

  it("does not render the panel label on the bottom placement", () => {
    renderWithAtoms(<Inspector placement="bottom" />);
    expect(screen.queryByText("Inspector")).toBeNull();
  });

  it("renders an aria-hidden icon span inside every tab trigger", () => {
    renderWithAtoms(<Inspector placement="bottom" />);
    for (const name of ["View", "Scale", "Chord", "Progression"]) {
      const trigger = screen.getByRole("tab", { name });
      const icon = trigger.querySelector('[aria-hidden="true"]');
      expect(icon).not.toBeNull();
    }
  });

  it("keeps keyboard arrow navigation working in bottom placement", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<Inspector placement="bottom" />);
    screen.getByRole("tab", { name: "View" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Scale" }).getAttribute("aria-selected")).toBe("true");
  });
});
