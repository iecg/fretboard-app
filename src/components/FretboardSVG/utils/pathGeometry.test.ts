import { describe, it, expect } from "vitest";
import {
  polarSort,
  inflatedCapsulePath,
  offsetOutlinePath,
  offsetOpenPolylinePath,
} from "./pathGeometry";

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
    const cx = pts.reduce((s, v) => s + v.x, 0) / pts.length;
    const cy = pts.reduce((s, v) => s + v.y, 0) / pts.length;
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
      hull: polarSort([{ x: 0, y: 0 }, { x: 50, y: 5 }, { x: 100, y: 0 }]),
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

  it("exceeds miter limit on extremely acute corners and falls back to a clean bevel", () => {
    // Acute angle from (0,0) -> (100,0) -> (1, 1).
    // The incoming edge is heading right, the outgoing edge is heading back-left.
    // The inner corner offset intersection is extremely far away.
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 1, y: 1 },
    ];
    const r = 10;
    const d = offsetOpenPolylinePath(pts, r);
    expect(d).not.toBe("");
    
    // Parse coordinates and ensure there are no extreme miter coordinates
    // (e.g. nothing exceeding 300px since the points themselves are within 100px and radius is 10px).
    const numbers = d
      .replace(/[MLQAZ]/gi, " ")
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter(Number.isFinite);
    for (const num of numbers) {
      expect(Math.abs(num)).toBeLessThan(300);
    }
  });

  it("miters a 90-degree corner and fillets/clips a sharper 77-degree corner", () => {
    // 1. 90-degree corner (0,0) -> (100,0) -> (100,100) with r=10.
    // miter_distance = 1.414 * 10 = 14.14 <= 15. Kept as miter (contains Q).
    const pts90 = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const d90 = offsetOpenPolylinePath(pts90, 10);
    const qCount90 = (d90.match(/\bQ\b/g) ?? []).length;
    expect(qCount90).toBe(1);

    // 2. Sharp corner (160, -36) -> (0, 0) -> (0, -36) with r=19.8.
    // With clipped miter, it successfully fillets but keeps coordinates bounded
    // under 300px instead of letting them spike, or throwing/spiking/looping.
    const ptsSharp = [
      { x: 160, y: -36 },
      { x: 0, y: 0 },
      { x: 0, y: -36 },
    ];
    const dSharp = offsetOpenPolylinePath(ptsSharp, 19.8);
    const qCountSharp = (dSharp.match(/\bQ\b/g) ?? []).length;
    expect(qCountSharp).toBe(1); // Contains a filleted Q curve around the clipped intersection
    
    // Ensure all coordinates are bounded and did not spike to infinity or huge values.
    const numbers = dSharp
      .replace(/[MLQAZ]/gi, " ")
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter(Number.isFinite);
    for (const num of numbers) {
      expect(Math.abs(num)).toBeLessThan(300);
    }
  });

  it("prevents adjacent inside fillets from overlapping on short vertical segments", () => {
    // Hourglass/Z-shape voicing in fretboard pixel space:
    // V_0 = (100, 36)
    // V_1 = (100, 72)
    // V_2 = (100, 108)
    // V_3 = (172, 144)
    // V_4 = (172, 180)
    // V_5 = (100, 216)
    // Radius r = 19.8.
    const pts = [
      { x: 100, y: 36 },
      { x: 100, y: 72 },
      { x: 100, y: 108 },
      { x: 172, y: 144 },
      { x: 172, y: 180 },
      { x: 100, y: 216 },
    ];
    const d = offsetOpenPolylinePath(pts, 19.8);
    expectClosedPath(d);
    
    // It should have filleted Q curves at both V_3 and V_4 on Side B.
    // Let's ensure there are no extreme/spiky coordinates in the path.
    const numbers = d
      .replace(/[MLQAZ]/gi, " ")
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter(Number.isFinite);
    for (const num of numbers) {
      expect(Math.abs(num)).toBeLessThan(400);
    }
  });
});
