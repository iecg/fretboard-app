import { describe, it, expect } from "vitest";
import { computeAutoScrollDelta } from "./timelineAutoScroll";

const LEAD = 0.15;

describe("computeAutoScrollDelta", () => {
  const view = { left: 0, width: 300 }; // lead zone = 45px

  it("returns null when the block is comfortably in view", () => {
    expect(computeAutoScrollDelta(view, { left: 100, right: 160 }, LEAD)).toBeNull();
  });

  it("returns a negative delta to scroll left when the block is past the left lead", () => {
    expect(computeAutoScrollDelta(view, { left: 20, right: 80 }, LEAD)).toBe(-25);
  });

  it("returns a positive delta to scroll right when the block is past the right lead", () => {
    expect(computeAutoScrollDelta(view, { left: 230, right: 290 }, LEAD)).toBe(35);
  });

  it("accounts for the container's own left offset", () => {
    expect(
      computeAutoScrollDelta({ left: 50, width: 300 }, { left: 60, right: 120 }, LEAD),
    ).toBe(-35);
  });
});
