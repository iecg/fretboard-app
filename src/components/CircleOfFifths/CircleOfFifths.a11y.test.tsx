// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CircleOfFifths } from "./CircleOfFifths";
import { CIRCLE_OF_FIFTHS } from "@fretflow/core";
import { axe } from "../../test-utils/a11y";

const getSlices = () =>
  Array.from(
    document.querySelectorAll<SVGPathElement>(
      'path[class*="circle-slice"][role="button"]',
    ),
  );

describe("CircleOfFifths keyboard navigation", () => {
  it("has no a11y violations", async () => {
    const { container } = render(
      <CircleOfFifths rootNote="C" setRootNote={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes 12 slices as buttons with a single tab stop", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    expect(slices).toHaveLength(12);
    const focusable = slices.filter((s) => s.getAttribute("tabindex") === "0");
    expect(focusable).toHaveLength(1);
  });

  it("ArrowRight moves focus clockwise", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[0], { key: "ArrowRight" });
    expect(slices[1].getAttribute("tabindex")).toBe("0");
  });

  it("ArrowDown moves focus clockwise (alias)", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[0], { key: "ArrowDown" });
    expect(slices[1].getAttribute("tabindex")).toBe("0");
  });

  it("ArrowLeft from index 0 wraps to index 11", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[0], { key: "ArrowLeft" });
    expect(slices[11].getAttribute("tabindex")).toBe("0");
  });

  it("ArrowUp from index 0 wraps to index 11 (alias)", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[0], { key: "ArrowUp" });
    expect(slices[11].getAttribute("tabindex")).toBe("0");
  });

  it("ArrowRight from index 11 wraps to index 0", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    // step focus to index 11 first
    fireEvent.keyDown(slices[0], { key: "ArrowLeft" });
    fireEvent.keyDown(slices[11], { key: "ArrowRight" });
    expect(slices[0].getAttribute("tabindex")).toBe("0");
  });

  it("Home jumps focus to C (index 0)", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[0], { key: "ArrowRight" });
    fireEvent.keyDown(slices[1], { key: "Home" });
    expect(slices[0].getAttribute("tabindex")).toBe("0");
    expect(CIRCLE_OF_FIFTHS[0]).toBe("C");
  });

  it("End jumps focus to B", () => {
    render(<CircleOfFifths rootNote="C" setRootNote={() => {}} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[0], { key: "End" });
    const bIndex = CIRCLE_OF_FIFTHS.indexOf("B");
    expect(slices[bIndex].getAttribute("tabindex")).toBe("0");
  });

  it("Enter activates the focused note", () => {
    const setRootNote = vi.fn();
    render(<CircleOfFifths rootNote="C" setRootNote={setRootNote} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[2], { key: "Enter" });
    expect(setRootNote).toHaveBeenCalledWith(CIRCLE_OF_FIFTHS[2]);
  });

  it("Space activates the focused note", () => {
    const setRootNote = vi.fn();
    render(<CircleOfFifths rootNote="C" setRootNote={setRootNote} />);
    const slices = getSlices();
    fireEvent.keyDown(slices[3], { key: " " });
    expect(setRootNote).toHaveBeenCalledWith(CIRCLE_OF_FIFTHS[3]);
  });
});
