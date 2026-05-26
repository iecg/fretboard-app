// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { beatsPerBarAtom, progressionLoopEnabledAtom, progressionPlayingAtom, progressionStepsAtom, progressionTempoBpmAtom } from "../../store/progressionAtoms";
import { TooltipProvider } from "../Tooltip/Tooltip";
import { HeaderTransportCluster } from "./HeaderTransportCluster";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
] as const;

describe("HeaderTransportCluster", () => {
  it("renders transport controls, status lights, and the position/tempo/scale readouts", async () => {
    const { container } = renderWithAtoms(<TooltipProvider delayDuration={0}><HeaderTransportCluster /></TooltipProvider>, [
      [progressionStepsAtom, fourStepProgression],
      [progressionTempoBpmAtom, 90],
      [beatsPerBarAtom, 4],
    ]);

    expect(screen.getByTestId("header-transport-cluster")).toBeTruthy();
    expect(screen.getByTestId("transport-bar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous chord" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next chord" })).toBeNull();
    expect(screen.getByRole("button", { name: "Loop progression" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop progression" })).toBeNull();
    expect(screen.queryByLabelText(/pause progression/i)).toBeNull();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.getByText("Loop")).toBeTruthy();
    expect(screen.getByText("Position")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.getByText("BPM")).toBeTruthy();
    // Scale readout shows only the headline — the parenthetical mode is dropped.
    expect(screen.getByText("C Major")).toBeTruthy();
    expect(screen.queryByText(/Ionian/)).toBeNull();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("transport controls still drive the playback atoms", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, fourStepProgression],
      [progressionLoopEnabledAtom, false],
    ]);
    renderWithStore(<TooltipProvider delayDuration={0}><HeaderTransportCluster /></TooltipProvider>, store);

    fireEvent.click(screen.getByRole("button", { name: "Loop progression" }));
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
    expect(store.get(progressionPlayingAtom)).toBe(true);
  });
});
