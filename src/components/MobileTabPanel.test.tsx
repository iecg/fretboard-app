// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { MobileTabPanel } from "./MobileTabPanel";
import {
  mobileTabAtom,
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
} from "../store/atoms";
import { type CagedShape } from "../shapes";
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

  it("calls onShapeClick when a CAGED shape is clicked in view tab", () => {
    const onShapeClick = vi.fn();
    renderWithAtoms(<MobileTabPanel onShapeClick={onShapeClick} />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "view"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);
    // FingeringPatternControls shows CAGED shape buttons when fingeringPattern=caged
    const eButton = screen.getByText("E");
    fireEvent.click(eButton);
    expect(onShapeClick).toHaveBeenCalledTimes(1);
  });
});
