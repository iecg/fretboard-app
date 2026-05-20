import { describe, it, expect } from "vitest";
import {
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
  CHORD_CONNECTOR_RADIUS_FACTORS,
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
