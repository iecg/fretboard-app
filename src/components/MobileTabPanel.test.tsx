// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { MobileTabPanel } from "./MobileTabPanel";
import {
  mobileTabAtom,
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
} from "../store/atoms";
import {
  renderWithAtoms,
  makeAtomStore,
  renderWithStore,
} from "../__tests__/utils/renderWithAtoms";

/** Minimal valid seeds to prevent rendering errors in inlined child components. */
const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [chordTypeAtom, null],
  [chordRootAtom, "C"],
] as const;

describe("MobileTabPanel", () => {
  it("renders ToggleBar with 2 tabs", () => {
    renderWithAtoms(<MobileTabPanel />, [...BASE_SEEDS]);
    expect(screen.getByText("Theory")).toBeInTheDocument();
    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("shows theory tab content when mobileTab atom is 'theory'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "theory"],
    ]);
    // TheoryControls renders a Root note grid and Scale Family selector
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
    expect(screen.queryByRole("combobox", { name: "Scale Family" })).not.toBeInTheDocument();
  });

  it("switching to View tab updates mobileTabAtom", () => {
    const store = makeAtomStore([...BASE_SEEDS, [mobileTabAtom, "theory"]]);
    renderWithStore(<MobileTabPanel />, store);
    fireEvent.click(screen.getByText("View"));
    expect(store.get(mobileTabAtom)).toBe("view");
  });

  it("switching to Theory tab updates mobileTabAtom", () => {
    const store = makeAtomStore([...BASE_SEEDS, [mobileTabAtom, "view"]]);
    renderWithStore(<MobileTabPanel />, store);
    fireEvent.click(screen.getByText("Theory"));
    expect(store.get(mobileTabAtom)).toBe("theory");
  });

});
