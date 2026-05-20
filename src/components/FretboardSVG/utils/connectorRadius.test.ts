import { describe, it, expect } from "vitest";
import {
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
  CHORD_CONNECTOR_RADIUS_FACTORS,
  clampConnectorRadiusToYBounds,
  resolveConnectorRadiusPx,
  applyConnectorRadiusFloor,
  computeChordConnectorRadiusPx,
} from "./connectorRadius";

describe("connectorRadius constants", () => {
  it("exposes the base radius factor", () => {
    expect(CHORD_CONNECTOR_BASE_RADIUS_FACTOR).toBe(0.42);
  });
  it("exposes density-keyed radius factors in monotonic order", () => {
    expect(CHORD_CONNECTOR_RADIUS_FACTORS.compact).toBeLessThan(
      CHORD_CONNECTOR_RADIUS_FACTORS.medium,
    );
    expect(CHORD_CONNECTOR_RADIUS_FACTORS.medium).toBeLessThan(
      CHORD_CONNECTOR_RADIUS_FACTORS.max,
    );
  });
});

describe("clampConnectorRadiusToYBounds", () => {
  it("returns the preferred radius when no bounds are supplied", () => {
    const r = clampConnectorRadiusToYBounds([{ x: 0, y: 50 }], 10);
    expect(r).toBe(10);
  });
  it("returns the preferred radius when bounds allow it", () => {
    const r = clampConnectorRadiusToYBounds(
      [{ x: 0, y: 50 }],
      10,
      { minY: 0, maxY: 100 },
    );
    expect(r).toBe(10);
  });
  it("shrinks the radius to fit between top vertex and minY bound", () => {
    const r = clampConnectorRadiusToYBounds(
      [{ x: 0, y: 5 }],
      40,
      { minY: 0, maxY: 100 },
    );
    expect(r).toBeLessThanOrEqual(5);
    expect(r).toBeGreaterThanOrEqual(0);
  });
  it("shrinks the radius to fit between bottom vertex and maxY bound", () => {
    const r = clampConnectorRadiusToYBounds(
      [{ x: 0, y: 95 }],
      40,
      { minY: 0, maxY: 100 },
    );
    expect(r).toBeLessThanOrEqual(5);
    expect(r).toBeGreaterThanOrEqual(0);
  });
  it("returns the preferred radius for empty vertex list", () => {
    const r = clampConnectorRadiusToYBounds([], 10, { minY: 0, maxY: 100 });
    expect(r).toBe(10);
  });
});

describe("resolveConnectorRadiusPx", () => {
  it("returns the preferred radius when edgeSafe is false", () => {
    const r = resolveConnectorRadiusPx({
      vertices: [{ x: 0, y: 5 }],
      preferredRadius: 40,
      yBounds: { minY: 0, maxY: 100 },
      edgeSafe: false,
    });
    expect(r).toBe(40);
  });
  it("clamps when edgeSafe is true", () => {
    const r = resolveConnectorRadiusPx({
      vertices: [{ x: 0, y: 5 }],
      preferredRadius: 40,
      yBounds: { minY: 0, maxY: 100 },
      edgeSafe: true,
    });
    expect(r).toBeLessThanOrEqual(5);
  });
});

describe("applyConnectorRadiusFloor", () => {
  it("returns the span radius when it exceeds the chord-root floor", () => {
    const stringRowPx = 40;
    const spanRadiusPx = 1000;
    expect(applyConnectorRadiusFloor(spanRadiusPx, stringRowPx)).toBe(
      spanRadiusPx,
    );
  });
  it("lifts to the floor when the span radius is below it", () => {
    const stringRowPx = 40;
    const result = applyConnectorRadiusFloor(0, stringRowPx);
    expect(result).toBeGreaterThan(0);
  });
  it("returns a finite value for plausible inputs", () => {
    expect(Number.isFinite(applyConnectorRadiusFloor(12, 40))).toBe(true);
  });
});

describe("computeChordConnectorRadiusPx", () => {
  it("returns a finite radius for representative inputs", () => {
    const r = computeChordConnectorRadiusPx([], 40, 0);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });
  it("adds non-negative offsetPx on top of the base", () => {
    const base = computeChordConnectorRadiusPx([], 40, 0);
    const bumped = computeChordConnectorRadiusPx([], 40, 5);
    expect(bumped).toBeCloseTo(base + 5, 6);
  });
  it("clamps negative offsetPx to 0", () => {
    const base = computeChordConnectorRadiusPx([], 40, 0);
    const negative = computeChordConnectorRadiusPx([], 40, -10);
    expect(negative).toBe(base);
  });
});
