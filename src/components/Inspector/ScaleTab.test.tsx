import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeAtomStore,
  renderWithAtoms,
  renderWithStore,
} from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { ScaleTab } from "./ScaleTab";

describe("ScaleTab", () => {
  it("renders the Fingering group header and Key/Circle of Fifths columns", () => {
    renderWithAtoms(<ScaleTab />);
    const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headers).toEqual(["Fingering", "Key", "Circle of Fifths"]);
  });

  it("renders a single grouped scale combobox with the 4 expected groups", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const combobox = screen.getByRole("combobox", { name: /scale/i });
    expect(combobox).toBeInTheDocument();
    await user.click(combobox);
    for (const label of [
      "Major modes",
      "Pentatonics",
      "Blues",
      "Harmonic / Melodic",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders the scale selector — root chips", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Root")).toBeInTheDocument();
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

  it("changing the scale via the grouped select remaps progression-step degree labels", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [
        progressionStepsAtom,
        [
          {
            id: "x",
            degree: "ii",
            duration: { value: 1, unit: "bar" },
            qualityOverride: null,
            manualRoot: null,
          },
        ],
      ],
    ]);
    renderWithStore(<ScaleTab />, store);

    expect(store.get(progressionStepsAtom)[0]!.degree).toBe("ii");

    const combobox = screen.getByRole("combobox", { name: /scale/i });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Phrygian" }));

    // Phrygian's ordinal-1 (ii) → "II" (Major Triad on Db). If the UI bypasses
    // setScaleNameAtom, the degree stays "ii" and this fails.
    await waitFor(() => {
      expect(store.get(progressionStepsAtom)[0]!.degree).toBe("II");
    });
    expect(store.get(scaleNameAtom)).toBe("Phrygian");
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
