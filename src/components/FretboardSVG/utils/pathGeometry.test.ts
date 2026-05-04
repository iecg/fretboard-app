import { describe, it, expect } from "vitest";
import {
  centroid,
  polarSort,
  enforceMinimumExtent,
  closedCatmullRomPath,
  inflatedCapsulePath,
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
});

describe("enforceMinimumExtent", () => {
  it("returns original array reference unchanged when short axis already meets minExtent", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 30, y: 60 },
    ];
    // bboxW=60, bboxH=60 — both exceed minExtent=18
    const result = enforceMinimumExtent(pts, 18);
    expect(result).toBe(pts); // same reference — no allocation
  });

  // Fixture A: all-on-same-fret triad (the user-reported bug case).
  // Three notes on the SAME fret column (x=100) on three adjacent strings
  // spaced 30px apart.  bboxW = 0 → short axis needs expansion to minExtent.
  it("Fixture A: all-on-same-fret triad — x-axis expanded to minExtent", () => {
    const pts = [
      { x: 100, y: 30 },
      { x: 100, y: 60 },
      { x: 100, y: 90 },
    ];
    const stringRowPx = 30;
    const minExtent = stringRowPx * 0.5; // 15px
    const result = enforceMinimumExtent(pts, minExtent);

    // Result must be a NEW array (not the same reference).
    expect(result).not.toBe(pts);
    expect(result).toHaveLength(3);

    // After expansion, x-axis span must be at least minExtent.
    const xs = result.map((v) => v.x);
    const xSpan = Math.max(...xs) - Math.min(...xs);
    expect(xSpan).toBeGreaterThanOrEqual(minExtent);

    // y-axis must remain unchanged (bboxH=60 already >= minExtent=15).
    const ys = result.map((v) => v.y);
    expect(Math.min(...ys)).toBeCloseTo(30, 1);
    expect(Math.max(...ys)).toBeCloseTo(90, 1);
  });

  // Fixture B: near-collinear non-degenerate triad — thin triangle that barely
  // passes the area threshold but whose short axis is still below minExtent.
  // Example: notes span 1 fret (x: 100→130, 30px) on 3 strings (y: 0→60, 60px).
  // bboxW=30, bboxH=60 — both axes already exceed a typical minExtent of 15px,
  // but suppose minExtent is set to 35px > bboxW=30 → x needs expansion.
  it("Fixture B: near-collinear non-degenerate thin triangle — short axis expanded", () => {
    const pts = [
      { x: 100, y: 0 },
      { x: 130, y: 30 },
      { x: 100, y: 60 },
    ];
    // minExtent > bboxW (30px) so x axis should be expanded.
    const minExtent = 36;
    const result = enforceMinimumExtent(pts, minExtent);

    expect(result).not.toBe(pts);
    const xs = result.map((v) => v.x);
    const xSpan = Math.max(...xs) - Math.min(...xs);
    expect(xSpan).toBeGreaterThanOrEqual(minExtent);

    // y-axis span (60px) already exceeds minExtent (36px) — unchanged.
    const ys = result.map((v) => v.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(60, 1);
  });

  it("expands BOTH axes when both are below minExtent (single-point degenerate)", () => {
    const pts = [{ x: 50, y: 50 }];
    const result = enforceMinimumExtent(pts, 20);
    // Single point: centroid = (50,50); dy=0 → pushed to +halfTarget on y; dx=0 → pushed to +halfTarget on x.
    expect(result[0]!.x).toBeCloseTo(50 + 10, 1); // halfTarget = 10
    expect(result[0]!.y).toBeCloseTo(50 + 10, 1);
  });

  it("returns empty array for empty input", () => {
    expect(enforceMinimumExtent([], 20)).toEqual([]);
  });

  it("returns original array unchanged when minExtent <= 0", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(enforceMinimumExtent(pts, 0)).toBe(pts);
    expect(enforceMinimumExtent(pts, -5)).toBe(pts);
  });

  it("does not mutate the input array", () => {
    const pts = [
      { x: 100, y: 30 },
      { x: 100, y: 60 },
      { x: 100, y: 90 },
    ];
    const original = pts.map((p) => ({ ...p }));
    enforceMinimumExtent(pts, 30);
    expect(pts).toEqual(original);
  });

  it("Fixture A expanded result produces a non-degenerate contour via inflatedCapsulePath", () => {
    // Regression: the all-on-same-fret triad must ultimately produce a path
    // that has both x-extent and y-extent > 0 after enforceMinimumExtent.
    const pts = [
      { x: 100, y: 30 },
      { x: 100, y: 60 },
      { x: 100, y: 90 },
    ];
    const stringRowPx = 36; // tablet row height
    const expanded = enforceMinimumExtent(pts, stringRowPx * 0.5);
    const d = inflatedCapsulePath(expanded, stringRowPx * 0.4);
    expect(d).toContain("A");
    // Confirm both axes span > 0 by checking the x range in expanded points.
    const xs = expanded.map((v) => v.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(stringRowPx * 0.5);
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
