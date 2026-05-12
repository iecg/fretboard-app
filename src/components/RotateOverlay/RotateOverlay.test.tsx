// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RotateOverlay } from "./RotateOverlay";

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
}

describe("RotateOverlay", () => {
  beforeEach(() => {
    // Default to desktop viewport
    setViewport(1920, 1200);
  });

  it("renders nothing when variant is not landscape-mobile (desktop)", () => {
    const { container } = render(<RotateOverlay />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing in portrait mobile", () => {
    setViewport(375, 667);
    const { container } = render(<RotateOverlay />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing on tablet", () => {
    setViewport(800, 600);
    const { container } = render(<RotateOverlay />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the overlay when in landscape-mobile", () => {
    // width <= 767 and height < width → landscape-mobile
    setViewport(667, 375);
    render(<RotateOverlay />);
    expect(
      screen.getByText("Please rotate your device to portrait mode"),
    ).toBeInTheDocument();
  });

  it("has the alert role for assistive technology", () => {
    setViewport(667, 375);
    render(<RotateOverlay />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("contains an SVG icon with aria-hidden", () => {
    setViewport(667, 375);
    const { container } = render(<RotateOverlay />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("passes axe accessibility checks", async () => {
    setViewport(667, 375);
    const { container } = render(<RotateOverlay />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
