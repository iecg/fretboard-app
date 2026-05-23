import { describe, it, expect } from "vitest";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewTab } from "./ViewTab";
import { scaleVisibleAtom } from "../../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../../store/chordOverlayAtoms";

describe("ViewTab", () => {
  describe("reference design grid alignment", () => {
    it("renders Scale and Chord control grids on the same 12-column system", () => {
      renderWithAtoms(<ViewTab />);
      const grids = document.querySelectorAll("[data-columns]");
      expect(Array.from(grids).map((grid) => grid.getAttribute("data-columns"))).toEqual([
        "12",
        "12",
      ]);
    });

    it("uses primary text color for Scale and Chord card names", () => {
      renderWithAtoms(<ViewTab />);
      const scaleHeading = document.getElementById("view-fingering-heading");
      const chordHeading = document.getElementById("view-voicing-heading");
      expect(scaleHeading?.className).toMatch(/cardName/);
      expect(chordHeading?.className).toMatch(/cardName/);
    });
  });

  it("renders the Scale group heading", () => {
    renderWithAtoms(<ViewTab />);
    // Heading text was shortened from "Scale Fingering" to "Scale" in Plan F
    // (the "Overlay" tab carries the context). Match the heading span by id.
    expect(document.getElementById("view-fingering-heading")).toHaveTextContent(
      /^scale$/i,
    );
  });

  it("renders the Chord group heading", () => {
    renderWithAtoms(<ViewTab />);
    // Heading text was shortened from "Chord Voicing" to "Chord" in Plan F.
    expect(document.getElementById("view-voicing-heading")).toHaveTextContent(
      /^chord$/i,
    );
  });

  it("exposes a data-inspector-tab attribute for layout selectors", () => {
    renderWithAtoms(<ViewTab />);
    expect(screen.getByTestId("view-tab")).toHaveAttribute(
      "data-inspector-tab",
      "view",
    );
  });

  describe("Show on Board switches in group headers", () => {
    it("Scale heading contains a Switch with accessible name 'Show on Board'", () => {
      renderWithAtoms(<ViewTab />);
      const fingeringSection = screen.getByRole("region", { name: /^scale$/i });
      const heading = within(fingeringSection).getByRole("heading");
      // The Switch is rendered inside the heading's container (GroupHeader right slot)
      // Use within the section to locate the first 'Show on Board' switch
      const switches = screen.getAllByRole("switch", { name: /show on board/i });
      expect(switches.length).toBeGreaterThanOrEqual(2);
      // The first switch is in the Scale section
      expect(fingeringSection).toContainElement(switches[0]);
      expect(heading).toBeInTheDocument();
    });

    it("Chord heading contains a Switch with accessible name 'Show on Board'", () => {
      renderWithAtoms(<ViewTab />);
      const voicingSection = screen.getByRole("region", { name: /^chord$/i });
      const switches = screen.getAllByRole("switch", { name: /show on board/i });
      expect(switches.length).toBeGreaterThanOrEqual(2);
      expect(voicingSection).toContainElement(switches[1]);
    });

    it("Scale 'Show on Board' switch reflects scaleVisibleAtom", () => {
      const store = makeAtomStore([[scaleVisibleAtom, false]]);
      renderWithStore(<ViewTab />, store);
      const fingeringSection = screen.getByRole("region", { name: /^scale$/i });
      const switches = within(fingeringSection).getAllByRole("switch", { name: /show on board/i });
      expect(switches[0]).not.toBeChecked();
    });

    it("toggling the Scale switch updates scaleVisibleAtom", async () => {
      const store = makeAtomStore([[scaleVisibleAtom, false]]);
      renderWithStore(<ViewTab />, store);
      const fingeringSection = screen.getByRole("region", { name: /^scale$/i });
      const sw = within(fingeringSection).getByRole("switch", { name: /show on board/i });
      await userEvent.click(sw);
      expect(store.get(scaleVisibleAtom)).toBe(true);
    });

    it("Chord 'Show on Board' switch reflects chordOverlayHiddenAtom (inverted)", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, true]]);
      renderWithStore(<ViewTab />, store);
      const voicingSection = screen.getByRole("region", { name: /^chord$/i });
      const sw = within(voicingSection).getByRole("switch", { name: /show on board/i });
      expect(sw).not.toBeChecked();
    });

    it("toggling the Chord switch updates chordOverlayHiddenAtom (inverted)", async () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      renderWithStore(<ViewTab />, store);
      const voicingSection = screen.getByRole("region", { name: /^chord$/i });
      const sw = within(voicingSection).getByRole("switch", { name: /show on board/i });
      await userEvent.click(sw);
      expect(store.get(chordOverlayHiddenAtom)).toBe(true);
    });
  });

  describe("Variant B sectioned cards", () => {
    it("Scale card reflects the master toggle via data-active", () => {
      const store = makeAtomStore([[scaleVisibleAtom, false]]);
      renderWithStore(<ViewTab />, store);
      const fingeringSection = screen.getByRole("region", { name: /^scale$/i });
      expect(fingeringSection).toHaveAttribute("data-active", "false");
    });

    it("Chord card reflects the master toggle via data-active", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, true]]);
      renderWithStore(<ViewTab />, store);
      const voicingSection = screen.getByRole("region", { name: /^chord$/i });
      expect(voicingSection).toHaveAttribute("data-active", "false");
    });

    it("Scale card flips to data-active='true' when scaleVisibleAtom is true", () => {
      const store = makeAtomStore([[scaleVisibleAtom, true]]);
      renderWithStore(<ViewTab />, store);
      const fingeringSection = screen.getByRole("region", { name: /^scale$/i });
      expect(fingeringSection).toHaveAttribute("data-active", "true");
    });
  });
});
