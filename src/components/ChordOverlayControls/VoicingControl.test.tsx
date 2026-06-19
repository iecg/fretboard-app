// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms, renderWithStore, makeAtomStore } from "../../test-utils/renderWithAtoms";
import { VoicingControl } from "./VoicingControl";
import { voicingAtom } from "@fretflow/fretboard/store/chordOverlayAtoms";

describe("ChordOverlayControls/VoicingControl", () => {
  it("renders three options: Off / Full / Close", async () => {
    renderWithAtoms(<VoicingControl />);
    const combobox = screen.getByRole("combobox", { name: /voicing/i });
    expect(combobox).toBeInTheDocument();
    await userEvent.click(combobox);
    expect(screen.getByRole("option", { name: /Off/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Full/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Close/i })).toBeInTheDocument();
  });

  it("reflects the seeded voicing value in the trigger", () => {
    renderWithAtoms(<VoicingControl />, [[voicingAtom, "close"]]);
    const combobox = screen.getByRole("combobox", { name: /voicing/i });
    expect(combobox).toHaveTextContent(/Close/i);
  });

  it("writes to voicingAtom on change", async () => {
    const store = makeAtomStore([[voicingAtom, "full"]]);
    renderWithStore(<VoicingControl />, store);
    await userEvent.click(screen.getByRole("combobox", { name: /voicing/i }));
    await userEvent.click(screen.getByRole("option", { name: /Close/i }));
    expect(store.get(voicingAtom)).toBe("close");
  });
});
