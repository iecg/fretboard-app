import { describe, it, expect } from "vitest";
import { offsetOutlinePath } from "./pathGeometry";

/** Counts a literal SVG command (single uppercase or lowercase letter) in a path string. */
function commandCount(path: string, cmd: string): number {
  // Use word-boundary regex so 'A' doesn't match inside numbers etc.
  return (path.match(new RegExp(`\\b${cmd}\\b`, "g")) ?? []).length;
}

function expectClosedPath(d: string) {
  expect(d).not.toBe("");
  expect(d.startsWith("M")).toBe(true);
  expect(d.endsWith("Z")).toBe(true);
}

describe("offsetOutlinePath", () => {
  it("returns empty string for empty hull", () => {
    expect(offsetOutlinePath([], 10)).toBe("");
  });

  it.each<{ label: string; hull: { x: number; y: number }[]; r: number; aCount: number; arcCmd: "A" | "a"; lMin?: number; lExact?: number }>([
    { label: "1-point input → circle with two relative-arc commands", hull: [{ x: 50, y: 50 }], r: 20, aCount: 2, arcCmd: "a" },
    { label: "2-point capsule → 2 absolute arcs + 2 line segments", hull: [{ x: 50, y: 100 }, { x: 50, y: 200 }], r: 20, aCount: 2, arcCmd: "A", lExact: 2 },
    {
      label: "3-point triangle hull → 3 absolute arcs + ≥3 line segments",
      hull: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 86.6 }],
      r: 15, aCount: 3, arcCmd: "A", lMin: 3,
    },
  ])("$label", ({ hull, r, aCount, arcCmd, lMin, lExact }) => {
    const d = offsetOutlinePath(hull, r);
    expectClosedPath(d);
    expect(commandCount(d, arcCmd)).toBe(aCount);
    if (lExact !== undefined) expect(commandCount(d, "L")).toBe(lExact);
    if (lMin !== undefined) expect(commandCount(d, "L")).toBeGreaterThanOrEqual(lMin);
  });

  it("spot-check: vertical collinear hull (2-vertex capsule) has correct arc radius and geometry", () => {
    // Manually-collapsed 2-vertex hull matches what convexHull would produce
    // for three collinear vertical points (the two extremes).
    const hull = [
      { x: 100, y: 30 },
      { x: 100, y: 90 },
    ];

    const r = 19.8; // stringRowPx=36, r=36*0.55=19.8
    const d = offsetOutlinePath(hull, r);
    expect(d).not.toBe("");
    expect(d).toContain("A");

    // The capsule's horizontal extent (2r) should be approximately 2*19.8 = 39.6.
    // Arc endpoints are at x = 100 ± r = 80.2 and 119.8.
    expect(d).toContain("80.2");  // 100 - 19.8
    expect(d).toContain("119.8"); // 100 + 19.8
  });

  it.each<{ label: string; hull: { x: number; y: number }[]; r: number; aCount: number }>([
    { label: "CCW equilateral triangle r=30", hull: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: -86.60 }], r: 30, aCount: 3 },
    { label: "r=0 degenerate offset", hull: [{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 30, y: 60 }], r: 0, aCount: 3 },
    {
      label: "thin near-collinear triangle keeps all 3 corners (no interior drops)",
      // Pre-sorted CCW (by polar angle around the centroid).
      hull: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 5 }],
      r: 20, aCount: 3,
    },
  ])("3-vertex closed path with $aCount arcs: $label", ({ hull, r, aCount }) => {
    const d = offsetOutlinePath(hull, r);
    expectClosedPath(d);
    if (r > 0) expect(commandCount(d, "A")).toBe(aCount);
  });

  it("winding-agnostic: CW and CCW polygon both produce outward 3-arc contours", () => {
    const ccw = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: -86.6 }];
    const cw = [...ccw].reverse();
    for (const hull of [ccw, cw]) {
      const d = offsetOutlinePath(hull, 20);
      expectClosedPath(d);
      expect(commandCount(d, "A")).toBe(3);
    }
  });

  it("normals point OUTWARD: every coordinate in path is at least as far from centroid as the polygon vertices", () => {
    // Regression for the screen-coords winding bug: math-RH-perp `(dy, -dx)`
    // points inward for screen-CCW (math-CW) polygons unless the sign is
    // flipped. We verify by parsing the absolute coordinates out of the path
    // and checking each one is at least as far from the centroid as the
    // closest original vertex.
    //
    // Use a polygon whose shortest edge is comfortably longer than 2r to
    // guarantee no self-intersection — this isolates the winding bug from
    // any radius-clamping concerns.
    const triangle = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 173.2 },   // ~equilateral, side 200
    ];
    const r = 10;             // r << minEdgeLen / 2 = 100
    const cx = (0 + 200 + 100) / 3;
    const cy = (0 + 0 + 173.2) / 3;

    // Closest vertex distance from centroid (any one will do for this regular triangle).
    const minVertexDist = Math.min(
      ...triangle.map((v) => Math.hypot(v.x - cx, v.y - cy)),
    );

    for (const polygon of [triangle, [...triangle].reverse()]) {
      const d = offsetOutlinePath(polygon, r);
      // Extract every numeric pair from absolute commands (M/L/A endpoint).
      // SVG arc command form: A rx ry rotation large sweep x y
      const tokens = d.split(/\s+/);
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === "M" || t === "L") {
          const x = Number(tokens[i + 1]);
          const y = Number(tokens[i + 2]);
          if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
        } else if (t === "A") {
          // A rx ry rot large sweep x y → endpoint at offsets +5, +6
          const x = Number(tokens[i + 6]);
          const y = Number(tokens[i + 7]);
          if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
        }
      }
      expect(points.length).toBeGreaterThan(0);

      // Every offset point must be at least as far from centroid as the
      // closest original vertex (within a small floating-point tolerance).
      // If the normals were inward, offset points would be CLOSER to centroid.
      for (const p of points) {
        const dist = Math.hypot(p.x - cx, p.y - cy);
        expect(dist).toBeGreaterThan(minVertexDist - 1e-6);
      }
    }
  });
});
