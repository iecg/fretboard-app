import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { StatusBar } from "./StatusBar";

describe("StatusBar full-width (v2.0)", () => {
  it("renders without a max-width container", () => {
    renderWithAtoms(<StatusBar />);
    const el = screen.getByTestId("status-bar");
    const computed = getComputedStyle(el);
    const max = computed.maxWidth;
    expect(["none", "", "100%"]).toContain(max);
  });
});
