// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { ChordOverlayDock } from "../components/ChordOverlayDock";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
  practiceLensAtom,
} from "../store/atoms";
import { renderWithAtoms } from "./utils/renderWithAtoms";

describe("ChordOverlayDock", () => {
  beforeEach(() => {
    // practiceLensAtom is persisted via atomWithStorage — clear so prior
    // tests can't bleed a non-default lens into this suite.
    localStorage.clear();
  });

  it("renders the practice bar when a chord is active", () => {
    renderWithAtoms(<ChordOverlayDock />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(screen.getByRole("group", { name: /Practice cues/i })).toBeTruthy();
  });

  it("does not render a DegreeChipStrip (scale strip is owned elsewhere)", () => {
    const { container } = renderWithAtoms(<ChordOverlayDock />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    // The dock must not include a duplicate scale-degree chip strip.
    expect(
      container.querySelector('[aria-label="Scale degrees"]'),
    ).toBeNull();
    expect(screen.queryByRole("group", { name: "Scale degrees" })).toBeNull();
  });

  it("collapses to a single Land on group when the chord is fully in-scale (targets lens)", () => {
    renderWithAtoms(<ChordOverlayDock />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    // targets lens + fully in-scale chord → Land on equals Chord, so only
    // the Land on group is rendered.
    expect(screen.queryByText("Chord:")).toBeNull();
    expect(screen.getByText("Land on:")).toBeTruthy();
  });
});
