import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { ScaleTab } from "./ScaleTab";

describe("ScaleTab", () => {
  it("renders the scale selector (root chips + family selector)", () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText(/^root$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/^scale family$/i, {
        selector: "span[class*='section-label']",
      }),
    ).toBeInTheDocument();
  });

  it("lazy-loads and renders the Circle of Fifths", async () => {
    renderWithAtoms(<ScaleTab />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: /circle of fifths/i }),
      ).toBeInTheDocument();
    });
  });
});
