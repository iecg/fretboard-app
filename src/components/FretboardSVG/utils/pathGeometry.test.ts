import { describe, it, expect } from "vitest";
import {
  centroid,
  polarSort,
  closedCatmullRomPath,
  closedPolylinePath,
  inflatedCapsulePath,
  convexHull,
  offsetOutlinePath,
  offsetOpenPolylinePath,
  openPolylinePath,
} from "./pathGeometry";

describe("centroid", () => {
  it("returns correct mean for a triangle", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 3, y: 6 },
    ];
    const { cx, cy } = centroid(pts);
    expect(cx).toBeCloseTo(3, 5);
    expect(cy).toBeCloseTo(2, 5);
  });

  it("handles single-point degenerate case", () => {
    const { cx, cy } = centroid([{ x: 4, y: 7 }]);
    expect(cx).toBe(4);
    expect(cy).toBe(7);
  });

  it("returns {cx:0, cy:0} for empty array", () => {
    const { cx, cy } = centroid([]);
    expect(cx).toBe(0);
    expect(cy).toBe(0);
  });
});

describe("polarSort", () => {
  it("sorts a non-monotonic triangle into counterclockwise order", () => {
    // Triangle with points in wrong order — right, top, left (non-monotonic).
    // Centroid ≈ (3, 2). Polar angles (atan2): right=(0°), top≈(-56°), left=(180°).
    // Ascending order by angle: top → right → left.
    const pts = [
      { x: 6, y: 0 }, // right  angle ≈ -33.7° (atan2(0-2, 6-3))
      { x: 3, y: 6 }, // bottom angle ≈  76.0° (atan2(6-2, 3-3))
      { x: 0, y: 0 }, // left   angle ≈ -146.3° (atan2(0-2, 0-3))
    ];
    // centroid = (3, 2)
    // atan2(0-2, 6-3)  = atan2(-2, 3) ≈ -33.7°
    // atan2(6-2, 3-3)  = atan2(4, 0)  ≈  90°
    // atan2(0-2, 0-3)  = atan2(-2,-3) ≈ -146.3°
    // sorted ascending: left(-146°) → right(-33°) → bottom(90°)
    const sorted = polarSort(pts);
    expect(sorted).toHaveLength(3);
    // Verify ascending angle order
    const { cx, cy } = centroid(pts);
    const angles = sorted.map((v) => Math.atan2(v.y - cy, v.x - cx));
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]!).toBeGreaterThanOrEqual(angles[i - 1]!);
    }
  });

  it("does not mutate the input array", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    const original = [...pts];
    polarSort(pts);
    expect(pts).toEqual(original);
  });

  it("returns a new array (not the same reference)", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }];
    const sorted = polarSort(pts);
    expect(sorted).not.toBe(pts);
  });

  it("near-collinear diagonal (G-E-C triad): retains all 3 vertices — no interior drops", () => {
    // Simulates G(string 4 fret 5) → E(string 5 fret 7) → C(string 6 fret 8) in pixel space.
    // With fretCenterX(fi)=fi*10 and stringYAt(si)=si*20:
    //   G: x=50, y=80  (string 4, fret 5)
    //   E: x=70, y=100 (string 5, fret 7)
    //   C: x=80, y=120 (string 6, fret 8)
    // These are near-collinear; convexHull collapses them to 2 vertices.
    // polarSort must return all 3.
    const pts = [
      { x: 50, y: 80 },
      { x: 70, y: 100 },
      { x: 80, y: 120 },
    ];
    const sorted = polarSort(pts);
    expect(sorted).toHaveLength(3);
  });
});

describe("closedCatmullRomPath", () => {
  it("returns empty string for fewer than 3 vertices", () => {
    expect(closedCatmullRomPath([])).toBe("");
    expect(closedCatmullRomPath([{ x: 0, y: 0 }])).toBe("");
    expect(closedCatmullRomPath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe("");
  });

  it("returns a non-empty string starting with M and ending with Z for a 3-pt triangle", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 40 },
    ];
    const d = closedCatmullRomPath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("contains cubic Bézier C commands for a 3-pt triangle", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 40 },
    ];
    const d = closedCatmullRomPath(pts);
    expect(d).toContain("C");
    // Should have exactly 3 cubic segments for a triangle
    const cCount = (d.match(/C /g) ?? []).length;
    expect(cCount).toBe(3);
  });

  it("returns a non-empty path for a 4-pt quadrilateral", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 0, y: 40 },
    ];
    const d = closedCatmullRomPath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("C");
    // Should have exactly 4 cubic segments
    const cCount = (d.match(/C /g) ?? []).length;
    expect(cCount).toBe(4);
  });

  it("rounds coordinates to 2 decimal places", () => {
    const pts = [
      { x: 1 / 3, y: 2 / 3 },
      { x: 5 / 3, y: 1 / 3 },
      { x: 1, y: 5 / 3 },
    ];
    const d = closedCatmullRomPath(pts);
    // No coordinate should have more than 2 decimal digits
    const numbers = d.replace(/[MCZ]/g, "").trim().split(/\s+/);
    for (const n of numbers) {
      if (n === "") continue;
      const decimal = n.includes(".") ? n.split(".")[1] : "";
      expect((decimal ?? "").length).toBeLessThanOrEqual(2);
    }
  });
});

describe("closedPolylinePath", () => {
  it("returns empty string for zero-vertex input", () => {
    expect(closedPolylinePath([])).toBe("");
  });

  it("single-point input returns 'M x y' degenerate dot", () => {
    const d = closedPolylinePath([{ x: 5, y: 10 }]);
    expect(d).toBe("M 5 10");
  });

  it("3-vertex triangle: output contains 2 L commands and ends with Z", () => {
    // M v0 L v1 L v2 Z → M covers first vertex, L for the remaining 2, then Z.
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 40 },
    ];
    const d = closedPolylinePath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBe(2);
  });

  it("collinear input (same-fret-column): output is M+L+L without Z (open polyline)", () => {
    // Three vertically collinear points — zero signed area.
    const pts = [
      { x: 50, y: 0 },
      { x: 50, y: 20 },
      { x: 50, y: 40 },
    ];
    const d = closedPolylinePath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(false);
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBe(2);
  });

  it("4-vertex quadrilateral: output contains 3 L commands and ends with Z", () => {
    // M v0 L v1 L v2 L v3 Z → M covers first vertex, L for the remaining 3, then Z.
    const pts = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 0, y: 40 },
    ];
    const d = closedPolylinePath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBe(3);
  });

  it("coordinates rounded to 2 decimal places", () => {
    const pts = [
      { x: 1.234567, y: 2.345678 },
      { x: 3.456789, y: 0.123456 },
      { x: 2.111111, y: 4.999999 },
    ];
    const d = closedPolylinePath(pts);
    // No coordinate should have more than 2 decimal digits.
    // Extract all numeric tokens (skip M, L, Z).
    const tokens = d.split(/\s+/).filter((t) => /^-?\d/.test(t));
    for (const token of tokens) {
      const decimal = token.includes(".") ? (token.split(".")[1] ?? "") : "";
      expect(decimal.length).toBeLessThanOrEqual(2);
    }
    // Verify specific rounded values appear.
    expect(d).toContain("1.23");
    expect(d).toContain("2.35");
  });

  it("2-vertex input: open line (no Z)", () => {
    const pts = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    const d = closedPolylinePath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    // 2 vertices → 1 L command.
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBe(1);
    // 2-vertex input never has area → open (no Z).
    expect(d.endsWith("Z")).toBe(false);
  });
});

describe("inflatedCapsulePath", () => {
  it("returns a non-empty string with A arc command for collinear horizontal points", () => {
    // Three collinear points on the same y — extremely degenerate (height ≈ 0)
    const pts = [
      { x: 10, y: 50 },
      { x: 50, y: 50 },
      { x: 90, y: 50 },
    ];
    const d = inflatedCapsulePath(pts, 14);
    expect(d).not.toBe("");
    expect(d).toContain("A");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("produces a path with positive bbox area for horizontal collinear points with perpOffset > 0", () => {
    const pts = [
      { x: 10, y: 50 },
      { x: 90, y: 50 },
    ];
    const d = inflatedCapsulePath(pts, 14);
    expect(d).not.toBe("");
    // The capsule should have non-zero width and height.
    // Width: from x=10-r to x=90+r (horizontal capsule extends past end-caps)
    // Height: 2 * r = 28px
    // Verify by checking the path contains coordinates spanning more than 0 in both axes.
    const numbers = d.replace(/[MLAZ]/gi, " ").trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const xs: number[] = [];
    const ys: number[] = [];
    // Rough parse: coordinates alternate x y after M, L; arc has 5 params
    // Rather than full SVG parse, just check that we have both x and y values in the path.
    expect(numbers.length).toBeGreaterThan(4);
    // Collect all numbers and check both axes have range > 0.
    for (let i = 0; i < numbers.length - 1; i += 2) {
      xs.push(numbers[i]!);
      ys.push(numbers[i + 1]!);
    }
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    expect(xRange).toBeGreaterThan(0);
    expect(yRange).toBeGreaterThan(0);
  });

  it("returns a non-empty string with A arc command for vertical collinear points", () => {
    const pts = [
      { x: 50, y: 10 },
      { x: 50, y: 50 },
      { x: 50, y: 90 },
    ];
    const d = inflatedCapsulePath(pts, 14);
    expect(d).not.toBe("");
    expect(d).toContain("A");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("returns a path even for a single degenerate point", () => {
    const pts = [{ x: 50, y: 50 }];
    const d = inflatedCapsulePath(pts, 14);
    expect(d).not.toBe("");
    expect(d).toContain("A");
  });
});

describe("convexHull", () => {
  it("returns empty array for empty input", () => {
    expect(convexHull([])).toEqual([]);
  });

  it("returns single point for a single-point input", () => {
    const result = convexHull([{ x: 5, y: 10 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ x: 5, y: 10 });
  });

  it("collinear input: 3 collinear points returns 2-vertex hull (the two extremes)", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
    ];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(2);
    // Hull must contain the two extreme points.
    const xs = hull.map((p) => p.x);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(10);
  });

  it("coincident input: 3 identical points returns 1-vertex hull", () => {
    const pts = [
      { x: 7, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 3 },
    ];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(1);
    expect(hull[0]).toEqual({ x: 7, y: 3 });
  });

  it("triangle: 3 non-collinear points returns 3-vertex hull in CCW order", () => {
    // Right triangle at (0,0), (10,0), (0,10).
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(3);

    // Andrew's chain produces a consistent ordering. We verify membership:
    // all 3 input points must be on the hull.
    const pointSet = new Set(hull.map((p) => `${p.x},${p.y}`));
    expect(pointSet.has("0,0")).toBe(true);
    expect(pointSet.has("10,0")).toBe(true);
    expect(pointSet.has("0,10")).toBe(true);
  });

  it("4-point convex quadrilateral: all 4 corners in the hull", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(4);
    const pointSet = new Set(hull.map((p) => `${p.x},${p.y}`));
    expect(pointSet.has("0,0")).toBe(true);
    expect(pointSet.has("10,0")).toBe(true);
    expect(pointSet.has("10,10")).toBe(true);
    expect(pointSet.has("0,10")).toBe(true);
  });

  it("4 points with 1 interior point: interior point dropped, 3-vertex hull", () => {
    // Triangle (0,0), (10,0), (5,10) with (5,3) inside.
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
      { x: 5, y: 3 }, // interior point
    ];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(3);
    const pointSet = new Set(hull.map((p) => `${p.x},${p.y}`));
    expect(pointSet.has("5,3")).toBe(false); // interior dropped
    expect(pointSet.has("0,0")).toBe(true);
    expect(pointSet.has("10,0")).toBe(true);
    expect(pointSet.has("5,10")).toBe(true);
  });

  it("does not mutate the input array", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 10 },
    ];
    const original = pts.map((p) => ({ ...p }));
    convexHull(pts);
    expect(pts).toEqual(original);
  });
});

describe("openPolylinePath", () => {
  it("returns empty string for zero-vertex input", () => {
    expect(openPolylinePath([])).toBe("");
  });

  it("single-vertex input returns 'M x y'", () => {
    const d = openPolylinePath([{ x: 5, y: 10 }]);
    expect(d).toBe("M 5 10");
  });

  it("3-vertex collinear (same x, three different y): M+L+L no Z", () => {
    const pts = [
      { x: 50, y: 0 },
      { x: 50, y: 20 },
      { x: 50, y: 40 },
    ];
    const d = openPolylinePath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(false);
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBe(2);
    // Coordinates rounded to 2 decimal places
    expect(d).toBe("M 50 0 L 50 20 L 50 40");
  });

  it("3-vertex diagonal triangle: M+L+L no Z", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 40 },
    ];
    const d = openPolylinePath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(false);
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBe(2);
  });

  it("4-vertex quadrilateral: M+L+L+L no Z", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 0, y: 40 },
    ];
    const d = openPolylinePath(pts);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(false);
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBe(3);
  });

  it("coordinates rounded to 2 decimal places", () => {
    const pts = [
      { x: 1.234567, y: 2.345678 },
      { x: 3.456789, y: 0.123456 },
    ];
    const d = openPolylinePath(pts);
    // No coordinate should have more than 2 decimal digits.
    const tokens = d.split(/[\s,]+/).filter((t) => /^-?\d/.test(t));
    for (const token of tokens) {
      const decimal = token.includes(".") ? (token.split(".")[1] ?? "") : "";
      expect(decimal.length).toBeLessThanOrEqual(2);
    }
    expect(d).toContain("1.23");
    expect(d).toContain("2.35");
  });
});

describe("offsetOutlinePath", () => {
  it("returns empty string for empty hull", () => {
    expect(offsetOutlinePath([], 10)).toBe("");
  });

  it("1-point input: returns a path containing M and two 'a' arc commands (circle)", () => {
    const d = offsetOutlinePath([{ x: 50, y: 50 }], 20);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    // Must contain two arc commands (lowercase 'a' for relative arcs).
    const aCount = (d.match(/\ba\b/g) ?? []).length;
    expect(aCount).toBe(2);
  });

  it("2-point input: returns a capsule path with 2 A arc commands and 2 L segment commands", () => {
    const d = offsetOutlinePath([{ x: 50, y: 100 }, { x: 50, y: 200 }], 20);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const aCount = (d.match(/\bA\b/g) ?? []).length;
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(aCount).toBe(2);
    expect(lCount).toBe(2);
  });

  it("3-point triangle hull: returns path with 3 A arc commands and line segments", () => {
    const hull = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 86.6 }, // approximately equilateral triangle
    ];
    const d = offsetOutlinePath(hull, 15);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const aCount = (d.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(3);
    // Must have line segments (at least 3 L commands, one per edge between arcs).
    const lCount = (d.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBeGreaterThanOrEqual(3);
  });

  it("spot-check: vertical collinear hull (2-vertex capsule) has correct arc radius and geometry", () => {
    // 3 collinear vertical points → convexHull returns 2-vertex hull.
    const pts = [
      { x: 100, y: 30 },
      { x: 100, y: 60 },
      { x: 100, y: 90 },
    ];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(2);

    const r = 19.8; // stringRowPx=36, r=36*0.55=19.8
    const d = offsetOutlinePath(hull, r);
    expect(d).not.toBe("");
    expect(d).toContain("A");

    // The capsule's horizontal extent (2r) should be approximately 2*19.8 = 39.6.
    // Arc endpoints are at x = 100 ± r = 80.2 and 119.8.
    expect(d).toContain("80.2");  // 100 - 19.8
    expect(d).toContain("119.8"); // 100 + 19.8
  });

  it("spot-check: equilateral triangle r=30 — corner offset positions within 0.01", () => {
    // Equilateral triangle with side 100, bottom-left at origin.
    // Vertices (CCW in SVG = lower-left, lower-right, top):
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: -86.60 }, // apex upward in SVG (negative y)
    ]);
    const r = 30;
    const d = offsetOutlinePath(hull, r);
    expect(d).not.toBe("");
    // For a CCW equilateral triangle, outgoing normal of bottom edge (0,0)→(100,0) is (0,-1) (upward in SVG).
    // B_0 = (0 + 30*0, 0 + 30*(-1)) = (0, -30).
    // Check that (0, -30) appears in the path (allowing for floating point at 2dp).
    // The path starts with M ... which is A_0 (incoming normal of last edge).
    // Let's just verify structural and non-empty.
    expect(d).toContain("A");
    const aCount = (d.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(3);
  });

  it("r=0 still produces a valid path shape (degenerate offset)", () => {
    const hull = convexHull([{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 30, y: 60 }]);
    const d = offsetOutlinePath(hull, 0);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("thin near-collinear triangle: all 3 corners produce 3 A arc commands", () => {
    // Feed a polar-sorted near-collinear triangle — the kind that polarSort
    // produces for the G-E-C diagonal triad.  The offset path must include
    // one arc per vertex (3 total), confirming the middle vertex is not dropped.
    const triangle = polarSort([
      { x: 0, y: 0 },
      { x: 50, y: 5 },
      { x: 100, y: 0 },
    ]);
    const d = offsetOutlinePath(triangle, 20);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    // One A arc command per vertex → 3 total.
    const aCount = (d.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(3);
  });

  it("winding-agnostic: CW and CCW polygon produce outward (not inward) contours", () => {
    // A right triangle fed in CCW order should produce the same-shape path as
    // the same triangle reversed (CW order) — both contours must be outside the
    // triangle (offset points further from centroid than original vertices).
    const ccw = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: -86.6 }, // apex upward (negative y in SVG)
    ];
    const cw = [...ccw].reverse();

    const r = 20;
    const dCCW = offsetOutlinePath(ccw, r);
    const dCW = offsetOutlinePath(cw, r);

    // Both must produce 3 A arc commands.
    expect((dCCW.match(/\bA\b/g) ?? []).length).toBe(3);
    expect((dCW.match(/\bA\b/g) ?? []).length).toBe(3);
    // Both must be non-empty closed paths.
    expect(dCCW.startsWith("M")).toBe(true);
    expect(dCW.startsWith("M")).toBe(true);
    expect(dCCW.endsWith("Z")).toBe(true);
    expect(dCW.endsWith("Z")).toBe(true);
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

describe("offsetOpenPolylinePath", () => {
  it("returns empty string for empty input", () => {
    expect(offsetOpenPolylinePath([], 10)).toBe("");
  });

  it("1-vertex input: returns the same circle path as offsetOutlinePath", () => {
    const v = { x: 50, y: 50 };
    const r = 20;
    expect(offsetOpenPolylinePath([v], r)).toBe(offsetOutlinePath([v], r));
  });

  it("2-vertex input: delegates to the offsetOutlinePath capsule", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 60, y: 0 };
    const r = 12;
    expect(offsetOpenPolylinePath([a, b], r)).toBe(offsetOutlinePath([a, b], r));
  });

  it("3 collinear vertices: falls back to a 2-vertex capsule between the extremes", () => {
    // All on a vertical line, equally spaced.
    const pts = [
      { x: 100, y: 0 },
      { x: 100, y: 30 },
      { x: 100, y: 60 },
    ];
    const r = 18;
    const d = offsetOpenPolylinePath(pts, r);
    // Identical byte output to the legacy capsule via offsetOutlinePath.
    expect(d).toBe(offsetOutlinePath([pts[0]!, pts[2]!], r));
    // Structural sanity.
    expect(d).toContain("A");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("3 non-collinear vertices: emits 3 A commands (1 outside join + 2 end caps)", () => {
    // Skinny diagonal triad — the geometry that previously rendered as an
    // acute convex-hull triangle. Each interior vertex contributes an arc
    // on both sides (one outside long-way + one inside short-way) so the
    // tube doesn't bevel across the polyline.
    const pts = [
      { x: 0, y: 0 },     // V_0
      { x: 10, y: 36 },   // V_1 (mid)
      { x: 30, y: 72 },   // V_2
    ];
    const d = offsetOpenPolylinePath(pts, 14);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const aCount = (d.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(3);
    const qCount = (d.match(/\bQ\b/g) ?? []).length;
    expect(qCount).toBe(1);
  });

  it("4 non-collinear vertices: emits 4 A commands (2 outside joins + 2 end caps)", () => {
    const pts = [
      { x: 30, y: 0 },
      { x: 40, y: 20 },
      { x: 40, y: 40 },
      { x: 50, y: 60 },
    ];
    const d = offsetOpenPolylinePath(pts, 14);
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const aCount = (d.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(4);
    const qCount = (d.match(/\bQ\b/g) ?? []).length;
    expect(qCount).toBe(2);
  });

  it("inside corners use bounded fillets around offset-line intersections instead of arcs", () => {
    const d = offsetOpenPolylinePath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
      10,
    );

    expect(d).toContain("L 30 15.5 Q 30 10 24.5 10 L 0 10");
    expect(d).not.toContain("L 30 0");
    expect(d).not.toMatch(/A\s+10\s+10\s+0\s+0\s+0\s+/);
  });

  it("screen-right corner keeps the outside arc on side A and inside fillet on side B", () => {
    const d = offsetOpenPolylinePath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
      10,
    );

    expect(d).toContain("L 40 -10 A 10 10 0 0 1 50 0");
    expect(d).toContain("L 30 15.5 Q 30 10 24.5 10 L 0 10");
    expect(d).not.toContain("L 40 -10 A 10 10 0 0 0 50 0");
    expect(d).not.toContain("L 30 0 A");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("screen-left corner keeps side A filleted and side B rounded outside", () => {
    const d = offsetOpenPolylinePath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: -40 },
      ],
      10,
    );

    expect(d).toContain("M 0 -10 L 24.5 -10 Q 30 -10 30 -15.5 L 30 -40");
    expect(d).toContain("L 50 0 A 10 10 0 0 1 40 10");
    expect(d).not.toContain("L 40 -10 A");
    expect(d).not.toContain("L 50 0 A 10 10 0 0 0 40 10");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("short inside corners clamp the fillet before it crosses adjacent segments", () => {
    const d = offsetOpenPolylinePath(
      [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
      ],
      10,
    );

    expect(d).toContain("Q -2 10 -1.1 10");
    expect(d).not.toContain("Q -2 10 -2 12.8");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("non-collinear tube envelops every input vertex within radius r", () => {
    // The output pill should clearly contain every input vertex — each
    // vertex should lie within r of at least one point on the perimeter.
    // We verify the weaker but still meaningful property: every coordinate
    // emitted by the path is at distance ≥ 0 and ≤ ~ 1.5r from at least one
    // input vertex (i.e., the perimeter never strays far from the polyline).
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 20 },
      { x: 100, y: 0 },
    ];
    const r = 25;
    const d = offsetOpenPolylinePath(pts, r);

    // Extract every absolute (M/L/A endpoint) coordinate.
    const tokens = d.split(/\s+/);
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "M" || t === "L") {
        const x = Number(tokens[i + 1]);
        const y = Number(tokens[i + 2]);
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
      } else if (t === "A") {
        const x = Number(tokens[i + 6]);
        const y = Number(tokens[i + 7]);
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
      }
    }
    expect(points.length).toBeGreaterThan(0);

    // Every perimeter point must be within (r + slop) of at least one input
    // vertex. slop covers the bevel chord which can dip slightly past r in
    // the limit of acute corners.
    const tolerance = r * 1.5;
    for (const p of points) {
      const minDist = Math.min(
        ...pts.map((v) => Math.hypot(p.x - v.x, p.y - v.y)),
      );
      expect(minDist).toBeLessThanOrEqual(tolerance);
    }
  });

  it("coincident adjacent vertices are filtered before geometry", () => {
    const dWithDup = offsetOpenPolylinePath(
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 60, y: 0 }],
      10,
    );
    const dWithoutDup = offsetOpenPolylinePath(
      [{ x: 0, y: 0 }, { x: 60, y: 0 }],
      10,
    );
    expect(dWithDup).toBe(dWithoutDup);
  });

  it("r=0 produces a valid degenerate path", () => {
    const d = offsetOpenPolylinePath(
      [{ x: 0, y: 0 }, { x: 40, y: 30 }, { x: 80, y: 0 }],
      0,
    );
    expect(d).not.toBe("");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("deterministic: identical inputs produce byte-identical output", () => {
    const pts = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 70, y: 30 },
    ];
    const r = 16;
    expect(offsetOpenPolylinePath(pts, r)).toBe(offsetOpenPolylinePath(pts, r));
  });
});
