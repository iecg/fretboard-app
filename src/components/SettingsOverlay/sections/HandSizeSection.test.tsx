import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import {
  makeAtomStore,
  renderWithStore,
  renderWithAtoms,
} from "../../../test-utils/renderWithAtoms";
import { handSizeAtom } from "../../../store/settingsAtoms";
import HandSizeSection from "./HandSizeSection";

describe("HandSizeSection", () => {
  it("renders three options: Small / Medium / Large", () => {
    renderWithAtoms(<HandSizeSection />);
    expect(screen.getByRole("button", { name: /small/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /large/i })).toBeInTheDocument();
  });

  it("writes to handSizeAtom on click", () => {
    const store = makeAtomStore();
    renderWithStore(<HandSizeSection />, store);
    fireEvent.click(screen.getByRole("button", { name: /small/i }));
    expect(store.get(handSizeAtom)).toBe("small");
    fireEvent.click(screen.getByRole("button", { name: /large/i }));
    expect(store.get(handSizeAtom)).toBe("large");
  });
});
