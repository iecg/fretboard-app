import { describe, it, expect } from "vitest";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewTab } from "./ViewTab";
import { scaleVisibleAtom } from "../../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../../store/chordOverlayAtoms";

describe("ViewTab", () => {
  it("renders the Scale Fingering group heading", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByText(/scale fingering/i)).toBeInTheDocument();
  });

  it("renders the Chord Voicing group heading", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByText(/chord voicing/i)).toBeInTheDocument();
  });

  it("exposes a data-inspector-tab attribute for layout selectors", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByTestId("view-tab")).toHaveAttribute(
      "data-inspector-tab",
      "view",
    );
  });

  describe("Show on Board switches in group headers", () => {
    it("Scale Fingering heading contains a Switch with accessible name 'Show on Board'", () => {
      renderWithAtoms(<ViewTab />);
      const fingeringSection = screen.getByRole("region", { name: /scale fingering/i });
      const heading = within(fingeringSection).getByRole("heading");
      // The Switch is rendered inside the heading's container (GroupHeader right slot)
      // Use within the section to locate the first 'Show on Board' switch
      const switches = screen.getAllByRole("switch", { name: /show on board/i });
      expect(switches.length).toBeGreaterThanOrEqual(2);
      // The first switch is in the Scale Fingering section
      expect(fingeringSection).toContainElement(switches[0]);
      expect(heading).toBeInTheDocument();
    });

    it("Chord Voicing heading contains a Switch with accessible name 'Show on Board'", () => {
      renderWithAtoms(<ViewTab />);
      const voicingSection = screen.getByRole("region", { name: /chord voicing/i });
      const switches = screen.getAllByRole("switch", { name: /show on board/i });
      expect(switches.length).toBeGreaterThanOrEqual(2);
      expect(voicingSection).toContainElement(switches[1]);
    });

    it("Scale Fingering 'Show on Board' switch reflects scaleVisibleAtom", () => {
      const store = makeAtomStore([[scaleVisibleAtom, false]]);
      renderWithStore(<ViewTab />, store);
      const fingeringSection = screen.getByRole("region", { name: /scale fingering/i });
      const switches = within(fingeringSection).getAllByRole("switch", { name: /show on board/i });
      expect(switches[0]).not.toBeChecked();
    });

    it("toggling the Scale Fingering switch updates scaleVisibleAtom", async () => {
      const store = makeAtomStore([[scaleVisibleAtom, false]]);
      renderWithStore(<ViewTab />, store);
      const fingeringSection = screen.getByRole("region", { name: /scale fingering/i });
      const sw = within(fingeringSection).getByRole("switch", { name: /show on board/i });
      await userEvent.click(sw);
      expect(store.get(scaleVisibleAtom)).toBe(true);
    });

    it("Chord Voicing 'Show on Board' switch reflects chordOverlayHiddenAtom (inverted)", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, true]]);
      renderWithStore(<ViewTab />, store);
      const voicingSection = screen.getByRole("region", { name: /chord voicing/i });
      const sw = within(voicingSection).getByRole("switch", { name: /show on board/i });
      expect(sw).not.toBeChecked();
    });

    it("toggling the Chord Voicing switch updates chordOverlayHiddenAtom (inverted)", async () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      renderWithStore(<ViewTab />, store);
      const voicingSection = screen.getByRole("region", { name: /chord voicing/i });
      const sw = within(voicingSection).getByRole("switch", { name: /show on board/i });
      await userEvent.click(sw);
      expect(store.get(chordOverlayHiddenAtom)).toBe(true);
    });
  });
});
