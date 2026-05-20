import { describe, it, expect } from "vitest";
import {
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
  CHORD_CONNECTOR_RADIUS_FACTORS,
  clampConnectorRadiusToYBounds,
  resolveConnectorRadiusPx,
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
