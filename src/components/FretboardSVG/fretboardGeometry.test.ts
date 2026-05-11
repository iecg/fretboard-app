import { describe, it, expect } from "vitest";
import {
  getFretboardScale,
  getWireX,
  getFretCenterX,
  getFretColumnWidth,
  getTaperGeometry,
  getStringY,
} from "./fretboardGeometry";

describe("fretboardGeometry", () => {
  it("getFretboardScale calculates scale params", () => {
    const scale = getFretboardScale(0, 12, 1000, 30);
    expect(scale.openColumnWidth).toBeGreaterThan(0);
    expect(scale.scaleLeftAnchor).toBe(1);
    expect(scale.scalePx).toBeGreaterThan(0);
  });

  it("getWireX calculates relative x", () => {
    const wireX0 = getWireX(0, 0, 40, 1000, 1);
    expect(wireX0).toBe(40);
  });

  it("getFretCenterX calculates center x", () => {
    const x = getFretCenterX(0, 0, 40, 1000, 1);
    expect(x).toBe(20);
  });

  it("getFretColumnWidth calculates column width", () => {
    const w = getFretColumnWidth(0, 0, 40, 1000, 1);
    expect(w).toBe(40);
  });

  it("getTaperGeometry calculates taper path", () => {
    const taper = getTaperGeometry(0, 12, 24, 1000, 200);
    expect(taper.taperYLeft).toBeGreaterThan(0);
    expect(taper.taperPath).toContain("M 0");
  });

  it("getStringY calculates y coordinate", () => {
    // Strings sit centered within the playable box and offset by the
    // vertical inset; with inset=0 the result matches the legacy behavior.
    const y = getStringY(0, 0, 6, 1000, 200, 0);
    expect(y).toBeGreaterThan(0);
  });

  it("getStringY applies vertical inset", () => {
    const yNoInset = getStringY(0, 0, 6, 1000, 200, 0);
    const yWithInset = getStringY(0, 0, 6, 1000, 200, 30);
    // Adding an inset of 30 must shift every string down by exactly 30 px
    // without altering the spread between strings.
    expect(yWithInset - yNoInset).toBe(30);
  });
});
