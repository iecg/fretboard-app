// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { MobileTabPanel } from "../MobileTabPanel/MobileTabPanel";
import {
  mobileTabAtom,
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
} from "../../store/atoms";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";

/** Minimal valid seeds to prevent rendering errors in inlined child components. */
const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [chordTypeAtom, null],
  [chordRootAtom, "C"],
] as const;

describe("MobileTabPanel/MobileTabPanel", () => {
  it("renders the tab content container", () => {
    renderWithAtoms(<MobileTabPanel />, [...BASE_SEEDS]);
    expect(screen.getByTestId("mobile-tab-content")).toBeInTheDocument();
  });

  it("shows theory tab content when mobileTab atom is 'theory'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "theory"],
    ]);
    // TheoryControls renders a Root note grid and Scale Family browser
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();
  });

  it("shows view tab content when mobileTab atom is 'view'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "view"],
    ]);
    // FingeringPatternControls renders a Fingering Pattern section
    expect(screen.getByText("Fingering Pattern")).toBeInTheDocument();
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
  });

  it("does not show theory content when on view tab", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "view"],
    ]);
    expect(screen.queryByText("Scale Family")).not.toBeInTheDocument();
  });
});
