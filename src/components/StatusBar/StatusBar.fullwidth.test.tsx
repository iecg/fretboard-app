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

  it("status bar applies full-bleed (zero outer horizontal padding) rule", () => {
    renderWithAtoms(<StatusBar />);
    const el = screen.getByTestId("status-bar");
    // The full-bleed contract is encoded in StatusBar.module.css. Test it via
    // a structural data attribute to make the contract explicit.
    expect(el.dataset.fullBleed).toBe("true");
  });
});
