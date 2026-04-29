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
import { axe } from "../../test-utils/a11y";

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

  it("shows scales tab content when mobileTab atom is 'scales'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "scales"],
    ]);
    // Card renders the section heading
    expect(screen.getByRole("heading", { level: 2, name: /^Scales$/i })).toBeInTheDocument();
    // ScaleSelector renders a Root note grid and Scale Family browser
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();
  });

  it("shows chords tab content when mobileTab atom is 'chords'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "chords"],
    ]);
    // Card renders the section heading
    expect(screen.getByRole("heading", { level: 2, name: /^Chords$/i })).toBeInTheDocument();
    // ChordOverlayControls renders Chord Mode section
    expect(screen.getByText("Chord Mode")).toBeInTheDocument();
  });

  it("shows cof tab content when mobileTab atom is 'cof'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "cof"],
    ]);
    expect(screen.getByRole("heading", { level: 2, name: /^Key$/i })).toBeInTheDocument();
  });

  it("shows view tab content when mobileTab atom is 'view'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "view"],
    ]);
    // Card renders the section heading
    expect(screen.getByRole("heading", { level: 2, name: /View/i })).toBeInTheDocument();
    // FingeringPatternControls renders a Fingering Pattern section
    expect(screen.getByText("Fingering Pattern")).toBeInTheDocument();
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
  });

  it("does not show scales content when on view tab", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "view"],
    ]);
    expect(screen.queryByText("Scale Family")).not.toBeInTheDocument();
  });

  it.each([
    ["scales"],
    ["chords"],
    ["cof"],
    ["view"],
  ] as const)(
    "has no accessibility violations on %s tab",
    async (tab) => {
      const { container } = renderWithAtoms(<MobileTabPanel />, [
        ...BASE_SEEDS,
        [mobileTabAtom, tab],
      ]);
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
