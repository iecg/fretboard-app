import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
import { Inspector } from "./Inspector";

function renderInspector() {
  return renderWithAtoms(<Inspector />);
}

describe("Inspector", () => {
  it("renders three tabs: Scale, Chord, Song", () => {
    renderInspector();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /scale/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /chord/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /song/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /view/i })).not.toBeInTheDocument();
  });

  it("renders Scale, Chord, and Song tabs", () => {
    renderInspector();
    expect(screen.getByRole("tab", { name: "Scale" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chord" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Song" })).toBeInTheDocument();
  });

  it("activates Scale tab by default", () => {
    renderInspector();
    expect(screen.getByRole("tab", { name: "Scale" }).getAttribute("aria-selected")).toBe("true");
  });

  it("renders one tabpanel for the active tab and tags it with the tab id", () => {
    renderInspector();
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("data-tab-id")).toBe("scale");
  });

  it("clicking Chord tab makes it active and deactivates Scale tab", async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole("tab", { name: "Chord" }));
    expect(screen.getByRole("tab", { name: "Chord" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Scale" }).getAttribute("aria-selected")).toBe("false");
  });

  it("renders the Song tab", () => {
    renderWithAtoms(<Inspector />, []);
    expect(screen.getByRole("tab", { name: "Song" })).toBeInTheDocument();
  });

  it("renders the Scale tab body by default", () => {
    renderInspector();
    expect(screen.getByRole("tabpanel").getAttribute("data-tab-id")).toBe("scale");
    // Scale tab holds root note and scale controls.
    expect(screen.getByText(/^root$/i)).toBeInTheDocument();
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
    // Phase 2.5: the Mode toggle is gone; the Chord tab exposes a Chord Type
    // group instead. The unified write surface lives in the active step.
    expect(screen.getByRole("group", { name: "Chord Type" })).toBeInTheDocument();
  });

  it("populates the Song tab body with the ProgressionControls editor", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<Inspector />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [
        progressionStepsAtom,
        [{ id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }],
      ],
    ]);

    await user.click(screen.getByRole("tab", { name: /song/i }));

    expect(
      screen.getByRole("combobox", { name: "Preset" }),
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
    for (const name of ["Scale", "Chord", "Song"]) {
      const trigger = screen.getByRole("tab", { name });
      const icon = trigger.querySelector('[aria-hidden="true"]');
      expect(icon).not.toBeNull();
    }
  });

  it("keeps keyboard arrow navigation working in bottom placement", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<Inspector placement="bottom" />);
    screen.getByRole("tab", { name: "Scale" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Chord" }).getAttribute("aria-selected")).toBe("true");
  });
});
