// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { progressionTempoBpmAtom } from "../../store/progressionAtoms";
import { TempoReadout } from "./TempoReadout";

describe("TempoReadout", () => {
  it("renders the BPM value from the tempo atom", () => {
    renderWithAtoms(<TempoReadout />, [[progressionTempoBpmAtom, 96]]);
    expect(screen.getByTestId("header-tempo")).toHaveTextContent("96");
    expect(screen.getByTestId("header-tempo")).toHaveTextContent(/BPM/);
  });

  it("merges a caller className onto the chip root", () => {
    renderWithAtoms(<TempoReadout className="extra" />, [
      [progressionTempoBpmAtom, 120],
    ]);
    const value = screen.getByTestId("header-tempo");
    expect(value.parentElement?.className).toContain("extra");
  });
});
