/**
 * Pure geometry helpers for chord-connector contour rendering.
 *
 * All functions are side-effect-free and React-independent so they can be
 * imported and tested directly without a DOM environment.
 */

/** A 2-D point in SVG pixel space. */
export interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round a number to 2 decimal places for deterministic SVG path strings. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// centroid
// ---------------------------------------------------------------------------

/**
 * Compute the geometric centroid (mean x, mean y) of an array of points.
 *
 * @param vertices - At least one point; if the array is empty the result is
 *                   `{ cx: 0, cy: 0 }`.
 * @returns The centroid as `{ cx, cy }`.
 */
export function centroid(vertices: Point[]): { cx: number; cy: number } {
  if (vertices.length === 0) return { cx: 0, cy: 0 };
  const cx = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
  const cy = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
  return { cx, cy };
}

// ---------------------------------------------------------------------------
// polarSort
// ---------------------------------------------------------------------------

/**
 * Sort a copy of `vertices` by polar angle around their centroid (ascending
 * from −π to +π, i.e. counter-clockwise starting from the 3-o'clock position).
 *
 * This ordering prevents self-intersection when the path closes — the closing
 * segment always traces the convex hull perimeter rather than crossing the
 * interior.
 *
 * **Does not mutate the input array.**
 *
 * @param vertices - The points to sort.
 * @returns A new array with the same points in polar order.
 */
export function polarSort(vertices: Point[]): Point[] {
  const { cx, cy } = centroid(vertices);
  return [...vertices].sort(
    (a, b) =>
      Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
}

// ---------------------------------------------------------------------------
// closedCatmullRomPath
// ---------------------------------------------------------------------------

/**
 * Convert an ordered array of vertices into a closed cubic Bézier SVG path
 * using the centripetal Catmull-Rom parameterisation (α = 0.5).
 *
 * For each segment from P[i] to P[i+1] (indices modulo N) the Bézier control
 * handles are:
 * ```
 *   H1 = P[i]     + 0.25 * (P[(i+1)%N] − P[(i−1+N)%N])
 *   H2 = P[(i+1)%N] − 0.25 * (P[(i+2)%N] − P[i])
 * ```
 *
 * The resulting path string is:
 * ```
 *   M P0 C H1 H2 P1 C H1' H2' P2 … Z
 * ```
 *
 * All coordinates are rounded to 2 decimal places so the string is
 * deterministic across floating-point environments (suitable for snapshot
 * tests).
 *
 * @param vertices - Polar-sorted control points (caller must pre-sort).
 *                   Returns `''` when `vertices.length < 3`.
 * @returns SVG path `d` attribute string starting with `M` and ending with `Z`.
 */
export function closedCatmullRomPath(vertices: Point[]): string {
  const N = vertices.length;
  if (N < 3) return "";

  const parts: string[] = [];

  // Move to the first vertex.
  const p0 = vertices[0]!;
  parts.push(`M ${r2(p0.x)} ${r2(p0.y)}`);

  for (let i = 0; i < N; i++) {
    const prev = vertices[(i - 1 + N) % N]!;
    const cur = vertices[i]!;
    const next = vertices[(i + 1) % N]!;
    const next2 = vertices[(i + 2) % N]!;

    const h1x = r2(cur.x + 0.25 * (next.x - prev.x));
    const h1y = r2(cur.y + 0.25 * (next.y - prev.y));
    const h2x = r2(next.x - 0.25 * (next2.x - cur.x));
    const h2y = r2(next.y - 0.25 * (next2.y - cur.y));

    parts.push(
      `C ${h1x} ${h1y} ${h2x} ${h2y} ${r2(next.x)} ${r2(next.y)}`,
    );
  }

  parts.push("Z");
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// convexHull
// ---------------------------------------------------------------------------

/**
 * Compute the convex hull of a set of 2-D points using Andrew's monotone-chain
 * algorithm.
 *
 * Returns the hull vertices in **counter-clockwise order**.
 *
 * Degenerate cases:
 * - Coincident points (all same coordinate) → 1-vertex hull (the single point).
 * - Collinear points → 2-vertex hull (the two extremes, i.e. the segment endpoints).
 * - Fewer than 1 point → empty array.
 *
 * **Does not mutate the input array.**
 *
 * @param vertices - The input points. Order does not matter.
 * @returns Hull vertices in CCW winding order.
 */
export function convexHull(vertices: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const n = vertices.length;
  if (n === 0) return [];
  if (n === 1) return [{ ...vertices[0]! }];

  // Deduplicate coincident points (within floating-point equality).
  const seen = new Set<string>();
  const unique: Array<{ x: number; y: number }> = [];
  for (const v of vertices) {
    const key = `${v.x},${v.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }
  if (unique.length === 1) return [{ ...unique[0]! }];

  // Sort by x, then by y as tiebreaker.
  const pts = [...unique].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

  // Cross product of vectors OA and OB.
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  // Build lower hull.
  const lower: Array<{ x: number; y: number }> = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull.
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half because it's repeated at the start of the other.
  lower.pop();
  upper.pop();

  const hull = [...lower, ...upper];

  // Degenerate: all points collinear → hull has ≤ 2 points. Return them as-is.
  // Degenerate: all points coincident → hull has 1 point.
  return hull;
}

// ---------------------------------------------------------------------------
// offsetOutlinePath
// ---------------------------------------------------------------------------

/**
 * Build an SVG path string for the offset outline (Minkowski sum with a disk of
 * radius `r`) of a polygon.
 *
 * Dispatches on `polygon.length`:
 * - **0** → empty string.
 * - **1** → circle of radius `r` centred at the single point (two-arc pattern).
 * - **2** → capsule connecting the two points with semicircular end-caps of radius `r`.
 * - **3+** → rounded polygon: each corner is a circular arc of radius `r`
 *   connecting the outward-offset endpoints of the two adjacent edges; straight
 *   line segments connect adjacent arcs along the offset edges.
 *
 * For the 3+ case the function is **winding-agnostic**: it computes the signed
 * area via the shoelace formula to determine whether the polygon is CW or CCW
 * in SVG screen coordinates (y-axis down), then selects the correct outward
 * normal direction automatically. Input may be CCW or CW; outward normal
 * direction is computed from the signed area.
 *
 * **Note on screen-vs-math winding:** in screen coords (y-axis flipped) the
 * shoelace formula's sign is inverted relative to math y-up convention. A
 * polygon whose shoelace area is **positive** in screen coords is **CCW in
 * math** terms — its math-right-hand perpendicular `(dy, -dx)` therefore
 * points outward. A negative shoelace area is **CW in math**, so the same
 * formula points inward and must be negated.
 *
 * All coordinates are rounded to 2 decimal places.
 *
 * @param polygon - Polygon vertices in any consistent winding order.
 * @param r       - Offset radius in pixels (≥ 0).
 * @returns SVG path `d` attribute string closed with `Z`, or `''` for empty input.
 */
export function offsetOutlinePath(polygon: Array<{ x: number; y: number }>, r: number): string {
  if (polygon.length === 0) return "";

  const rr = Math.max(r, 0);

  // --- 1-point: circle ---
  if (polygon.length === 1) {
    const cx = r2(polygon[0]!.x);
    const cy = r2(polygon[0]!.y);
    const ri = r2(rr);
    const diam = r2(2 * rr);
    // Standard two-arc circle pattern.
    return `M ${cx} ${cy} m ${r2(-rr)} 0 a ${ri} ${ri} 0 1,0 ${diam},0 a ${ri} ${ri} 0 1,0 ${r2(-diam)},0 Z`;
  }

  // --- 2-point: capsule ---
  if (polygon.length === 2) {
    const [p0, p1] = [polygon[0]!, polygon[1]!];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 1e-9) {
      // Coincident — treat as single point.
      const cx = r2(p0.x);
      const cy = r2(p0.y);
      const ri = r2(rr);
      const diam = r2(2 * rr);
      return `M ${cx} ${cy} m ${r2(-rr)} 0 a ${ri} ${ri} 0 1,0 ${diam},0 a ${ri} ${ri} 0 1,0 ${r2(-diam)},0 Z`;
    }

    // Perpendicular unit vector (right-hand of p0→p1, which is the outward
    // normal for the bottom edge of a CCW capsule).
    const nx = dy / len;
    const ny = -dx / len;

    // Four corners of the capsule rectangle.
    const ax = r2(p0.x + rr * nx);
    const ay = r2(p0.y + rr * ny);
    const bx = r2(p1.x + rr * nx);
    const by = r2(p1.y + rr * ny);
    const cx = r2(p1.x - rr * nx);
    const cy = r2(p1.y - rr * ny);
    const ex = r2(p0.x - rr * nx);
    const ey = r2(p0.y - rr * ny);
    const ri = r2(rr);

    return [
      `M ${ax} ${ay}`,
      `L ${bx} ${by}`,
      `A ${ri} ${ri} 0 0 1 ${cx} ${cy}`,
      `L ${ex} ${ey}`,
      `A ${ri} ${ri} 0 0 1 ${ax} ${ay}`,
      "Z",
    ].join(" ");
  }

  // --- 3+ point: rounded offset polygon ---
  const N = polygon.length;

  // Determine winding via the shoelace signed-area formula.
  // In SVG screen coords (y-axis down): twoA > 0 means CW visual / CCW math
  // (interior left of edge in math), twoA < 0 means CCW visual / CW math.
  //
  // The math-right-hand perpendicular (dy, -dx) of an edge points to the right
  // of the walker in y-up convention. For CCW-math polygons (twoA > 0 in screen
  // coords) the right-hand perpendicular points OUTWARD (interior on the left,
  // outside on the right). For CW-math polygons (twoA < 0 in screen coords) the
  // same formula points INWARD, so we negate it to get the outward direction.
  let twoA = 0;
  for (let i = 0; i < N; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % N]!;
    twoA += (a.x * b.y) - (b.x * a.y);
  }

  // Degenerate: all points collinear (zero area). Fall back to a capsule
  // spanning the two extreme points so the contour still envelopes all notes.
  if (Math.abs(twoA) < 1e-9) {
    // Find the two points that are farthest apart (extreme endpoints of the line).
    let maxDist = 0;
    let ep0 = polygon[0]!;
    let ep1 = polygon[N - 1]!;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = polygon[j]!.x - polygon[i]!.x;
        const dy = polygon[j]!.y - polygon[i]!.y;
        const d = dx * dx + dy * dy;
        if (d > maxDist) {
          maxDist = d;
          ep0 = polygon[i]!;
          ep1 = polygon[j]!;
        }
      }
    }
    return offsetOutlinePath([ep0, ep1], rr);
  }

  // In screen coords: twoA > 0 → CCW math → math-RH-perp is outward (use as-is).
  //                   twoA < 0 → CW math  → math-RH-perp is inward  (flip sign).
  const normalSign = twoA > 0 ? 1 : -1;

  // Compute outward unit normals for each edge i → (i+1).
  const normals: Array<{ nx: number; ny: number }> = [];
  for (let i = 0; i < N; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % N]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) {
      normals.push({ nx: 0, ny: 0 });
    } else {
      // Right-hand perpendicular of (a→b), flipped according to winding.
      normals.push({ nx: normalSign * (dy / len), ny: normalSign * (-dx / len) });
    }
  }

  // For each polygon vertex i:
  //   - incoming edge is (i-1) → i, with normal normals[(i-1+N)%N]
  //   - outgoing edge is i → (i+1), with normal normals[i]
  //
  // A_i = V[i] + r * incomingNormal  (arc start on incoming edge)
  // B_i = V[i] + r * outgoingNormal  (arc end / start of outgoing line)
  //
  // The arc sweeps from A_i to B_i around V[i] with radius r.
  // sweep-flag=1 produces a CW arc in SVG, which is the outward convex corner
  // when the polygon is CCW (normalSign=+1). When the polygon is CW
  // (normalSign=-1) the normals are already flipped, so sweep-flag=1 still
  // traces the correct outward arc.

  const parts: string[] = [];
  let first = true;

  for (let i = 0; i < N; i++) {
    const v = polygon[i]!;
    const inNorm = normals[(i - 1 + N) % N]!;
    const outNorm = normals[i]!;

    const ai_x = r2(v.x + rr * inNorm.nx);
    const ai_y = r2(v.y + rr * inNorm.ny);
    const bi_x = r2(v.x + rr * outNorm.nx);
    const bi_y = r2(v.y + rr * outNorm.ny);

    const ri = r2(rr);

    if (first) {
      parts.push(`M ${ai_x} ${ai_y}`);
      first = false;
    } else {
      parts.push(`L ${ai_x} ${ai_y}`);
    }

    // Arc from A_i to B_i around V[i], sweep-flag=1.
    parts.push(`A ${ri} ${ri} 0 0 1 ${bi_x} ${bi_y}`);

    // Line from B_i to A_{i+1} (start of next arc).
    const nextV = polygon[(i + 1) % N]!;
    const nextInNorm = normals[i]!; // incoming normal of next vertex = outgoing normal of current edge
    const nextAi_x = r2(nextV.x + rr * nextInNorm.nx);
    const nextAi_y = r2(nextV.y + rr * nextInNorm.ny);
    parts.push(`L ${nextAi_x} ${nextAi_y}`);
  }

  parts.push("Z");
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// offsetOpenPolylinePath
// ---------------------------------------------------------------------------

/**
 * Build an SVG path string for the Minkowski sum of an OPEN polyline with a
 * disk of radius `r`.
 *
 * The result is a closed "pill" that follows the polyline's vertex order
 * rather than its convex hull. This avoids the awkward acute-triangle
 * silhouette that `offsetOutlinePath(convexHull(...), r)` produces for
 * skinny 3-note voicings — instead the contour reads as a rounded tube
 * tracing the chord's voicing.
 *
 * Dispatches on the (deduplicated) vertex count:
 * - **0** → empty string.
 * - **1** → circle (delegates to `offsetOutlinePath`).
 * - **2** → capsule (delegates to `offsetOutlinePath`).
 * - **3+ collinear** → capsule between the two extreme vertices.
 * - **3+ non-collinear** → analytical perimeter:
 *     forward along "side A" (the math-RHS / screen-LHS normal of each edge),
 *     semicircular cap at the end vertex, backward along "side B"
 *     (the opposite normal), semicircular cap at the start vertex.
 *     Interior corners receive a round arc on the convex/outside side. The
 *     concave/inside side uses a bounded quadratic fillet around the
 *     intersection of the adjacent offset edge lines, matching a centered
 *     thick stroke while avoiding arcs that twist through the corner.
 *
 * Centering the inside corner on the offset-line intersection is essential:
 * an inside arc sweeps through the bend and can visibly twist the tube, while
 * a straight bevel chord can cut across both adjacent offset edges. The small
 * bounded fillet only rounds the local miter point.
 *
 * Inside/outside selection at an interior vertex `V_{i+1}` uses the screen
 * cross-product of the adjacent edges:
 *   - `cross > 0` → screen-right turn → side A (math-RHS / screen-LHS) is
 *     outside (sweep=1 arc on side A, sweep=0 arc on side B).
 *   - `cross < 0` → screen-left turn → side B is outside (sweep=1 arc on
 *     side B, sweep=0 arc on side A).
 *   - `|cross|` near zero → smooth bend, both sides emit a straight line.
 *
 * Coordinates are rounded to 2 decimal places for deterministic snapshotting.
 *
 * @param vertices - Open polyline vertex sequence in traversal order.
 *                   Caller is responsible for ordering (e.g., chord
 *                   connector passes vertices in string-index order so
 *                   the pill traces the voicing across strings).
 * @param r        - Offset radius in pixels (≥ 0).
 * @returns SVG path `d` attribute string closed with `Z`, or `''` for empty input.
 */
export function offsetOpenPolylinePath(
  vertices: Array<{ x: number; y: number }>,
  r: number,
): string {
  if (vertices.length === 0) return "";
  const rr = Math.max(r, 0);

  // Drop coincident adjacent vertices so degenerate edges don't poison the
  // normal computation. (Chord-connector inputs never coincide in practice,
  // but the function is exported for direct testing — defend at the boundary.)
  const filtered: Array<{ x: number; y: number }> = [];
  for (const v of vertices) {
    const prev = filtered[filtered.length - 1];
    if (!prev || Math.abs(v.x - prev.x) > 1e-9 || Math.abs(v.y - prev.y) > 1e-9) {
      filtered.push(v);
    }
  }

  // Single point / capsule fall through to the existing offsetOutlinePath
  // dispatch so the byte format is identical for those degenerate cases.
  if (filtered.length === 1) return offsetOutlinePath([filtered[0]!], rr);
  if (filtered.length === 2) return offsetOutlinePath([filtered[0]!, filtered[1]!], rr);

  const n = filtered.length;

  // Per-edge unit direction and side-A normal. Side-A = (e.y, -e.x) which is
  // the math-RHS perpendicular in math y-up convention, equivalent to the
  // screen-LHS of a screen walker (because y is flipped). For a CCW-math
  // perimeter this points outward — see offsetOutlinePath for the full
  // derivation.
  const edges: Array<{
    ex: number;
    ey: number;
    nx: number;
    ny: number;
  }> = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = filtered[i + 1]!.x - filtered[i]!.x;
    const dy = filtered[i + 1]!.y - filtered[i]!.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) {
      edges.push({ ex: 0, ey: 0, nx: 0, ny: 0 });
    } else {
      const ex = dx / len;
      const ey = dy / len;
      edges.push({ ex, ey, nx: ey, ny: -ex });
    }
  }

  // Collinear fallback: when every consecutive edge pair is parallel, the
  // hull is a segment and the natural offset is a capsule between the two
  // farthest vertices. Matches the legacy `offsetOutlinePath(convexHull(...),
  // r)` behavior for collinear inputs.
  let allCollinear = true;
  for (let i = 0; i < n - 2; i++) {
    const e0 = edges[i]!;
    const e1 = edges[i + 1]!;
    const cross = e0.ex * e1.ey - e0.ey * e1.ex;
    if (Math.abs(cross) > 1e-9) {
      allCollinear = false;
      break;
    }
  }
  if (allCollinear) {
    let maxDist = 0;
    let ep0 = filtered[0]!;
    let ep1 = filtered[n - 1]!;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = filtered[j]!.x - filtered[i]!.x;
        const dy = filtered[j]!.y - filtered[i]!.y;
        const d = dx * dx + dy * dy;
        if (d > maxDist) {
          maxDist = d;
          ep0 = filtered[i]!;
          ep1 = filtered[j]!;
        }
      }
    }
    return offsetOutlinePath([ep0, ep1], rr);
  }

  const parts: string[] = [];
  const ri = r2(rr);
  const clockwiseSweep = 1;
  const innerFilletPx = (
    join: { x: number; y: number } | null,
    inLimit: { x: number; y: number },
    outLimit: { x: number; y: number },
  ): number => {
    if (!join) return 0;
    const inDist = Math.hypot(join.x - inLimit.x, join.y - inLimit.y);
    const outDist = Math.hypot(join.x - outLimit.x, join.y - outLimit.y);
    return Math.min(rr * 0.55, 8, inDist * 0.45, outDist * 0.45);
  };

  const pushInnerFillet = (
    join: { x: number; y: number } | null,
    inLimit: { x: number; y: number },
    outLimit: { x: number; y: number },
    filletPx: number,
    fallback: { x: number; y: number },
  ): void => {
    if (!join || filletPx < 0.5) {
      const p = join ?? fallback;
      parts.push(`L ${r2(p.x)} ${r2(p.y)}`);
      return;
    }

    const inDist = Math.hypot(join.x - inLimit.x, join.y - inLimit.y);
    const outDist = Math.hypot(join.x - outLimit.x, join.y - outLimit.y);
    if (inDist < 1e-9 || outDist < 1e-9) {
      parts.push(`L ${r2(join.x)} ${r2(join.y)}`);
      return;
    }

    const before = {
      x: join.x + ((inLimit.x - join.x) / inDist) * filletPx,
      y: join.y + ((inLimit.y - join.y) / inDist) * filletPx,
    };
    const after = {
      x: join.x + ((outLimit.x - join.x) / outDist) * filletPx,
      y: join.y + ((outLimit.y - join.y) / outDist) * filletPx,
    };

    parts.push(`L ${r2(before.x)} ${r2(before.y)}`);
    parts.push(`Q ${r2(join.x)} ${r2(join.y)} ${r2(after.x)} ${r2(after.y)}`);
  };

  const offsetLineIntersection = (
    vertex: { x: number; y: number },
    edgeA: { ex: number; ey: number; nx: number; ny: number },
    edgeB: { ex: number; ey: number; nx: number; ny: number },
    side: 1 | -1,
  ): { x: number; y: number } | null => {
    const p = {
      x: vertex.x + rr * side * edgeA.nx,
      y: vertex.y + rr * side * edgeA.ny,
    };
    const q = {
      x: vertex.x + rr * side * edgeB.nx,
      y: vertex.y + rr * side * edgeB.ny,
    };
    const det = edgeA.ex * edgeB.ey - edgeA.ey * edgeB.ex;
    if (Math.abs(det) < 1e-9) return null;
    const qmpX = q.x - p.x;
    const qmpY = q.y - p.y;
    const t = (qmpX * edgeB.ey - qmpY * edgeB.ex) / det;
    return {
      x: p.x + t * edgeA.ex,
      y: p.y + t * edgeA.ey,
    };
  };

  // Start point on side A of the first edge.
  const startAx = filtered[0]!.x + rr * edges[0]!.nx;
  const startAy = filtered[0]!.y + rr * edges[0]!.ny;
  parts.push(`M ${r2(startAx)} ${r2(startAy)}`);

  // Forward pass on side A: V_0 → V_{n-1}.
  for (let i = 0; i < n - 1; i++) {
    const endEdgeX = filtered[i + 1]!.x + rr * edges[i]!.nx;
    const endEdgeY = filtered[i + 1]!.y + rr * edges[i]!.ny;

    if (i === n - 2) {
      parts.push(`L ${r2(endEdgeX)} ${r2(endEdgeY)}`);
    } else {
      const e0 = edges[i]!;
      const e1 = edges[i + 1]!;
      const cross = e0.ex * e1.ey - e0.ey * e1.ex;
      const nextX = filtered[i + 1]!.x + rr * e1.nx;
      const nextY = filtered[i + 1]!.y + rr * e1.ny;
      if (Math.abs(cross) < 1e-9) {
        // Smooth bend — incoming and outgoing offset points already coincide
        // up to numeric noise; emit a straight line as a no-op fallback.
        parts.push(`L ${r2(endEdgeX)} ${r2(endEdgeY)}`);
      } else if (cross > 0) {
        // Screen-right turn → side A is outside → round arc of radius r
        // around V_{i+1}, sweeping clockwise in SVG screen space.
        parts.push(`L ${r2(endEdgeX)} ${r2(endEdgeY)}`);
        parts.push(`A ${ri} ${ri} 0 0 ${clockwiseSweep} ${r2(nextX)} ${r2(nextY)}`);
      } else {
        // Screen-left turn → side A is inside. The boundary of a thick
        // centered stroke is rounded locally around the intersection of the
        // adjacent offset edge lines; drawing an arc here twists through the corner.
        const join = offsetLineIntersection(filtered[i + 1]!, e0, e1, 1);
        const inLimit = {
          x: filtered[i]!.x + rr * e0.nx,
          y: filtered[i]!.y + rr * e0.ny,
        };
        const outLimit = {
          x: filtered[i + 2]!.x + rr * e1.nx,
          y: filtered[i + 2]!.y + rr * e1.ny,
        };
        pushInnerFillet(
          join,
          inLimit,
          outLimit,
          innerFilletPx(join, inLimit, outLimit),
          { x: nextX, y: nextY },
        );
      }
    }
  }

  // Semicircular end cap at V_{n-1}: arc from side A to side B passing
  // through the direction the polyline was heading at the final edge.
  const endBx = filtered[n - 1]!.x - rr * edges[n - 2]!.nx;
  const endBy = filtered[n - 1]!.y - rr * edges[n - 2]!.ny;
  parts.push(`A ${ri} ${ri} 0 0 1 ${r2(endBx)} ${r2(endBy)}`);

  // Backward pass on side B: V_{n-1} → V_0.
  for (let i = n - 2; i >= 0; i--) {
    const startEdgeX = filtered[i]!.x - rr * edges[i]!.nx;
    const startEdgeY = filtered[i]!.y - rr * edges[i]!.ny;

    if (i === 0) {
      parts.push(`L ${r2(startEdgeX)} ${r2(startEdgeY)}`);
    } else {
      // Cross at V_i computed from forward edges (i-1, i) — intrinsic to
      // the geometry, independent of walk direction.
      const e0 = edges[i - 1]!;
      const e1 = edges[i]!;
      const cross = e0.ex * e1.ey - e0.ey * e1.ex;
      const prevX = filtered[i]!.x - rr * e0.nx;
      const prevY = filtered[i]!.y - rr * e0.ny;
      if (Math.abs(cross) < 1e-9) {
        parts.push(`L ${r2(startEdgeX)} ${r2(startEdgeY)}`);
      } else if (cross < 0) {
        // Screen-left turn → side B is outside → round arc on the convex
        // side, sweeping clockwise in SVG screen space.
        parts.push(`L ${r2(startEdgeX)} ${r2(startEdgeY)}`);
        parts.push(`A ${ri} ${ri} 0 0 ${clockwiseSweep} ${r2(prevX)} ${r2(prevY)}`);
      } else {
        // Screen-right turn → side B is inside. Use the offset-line
        // intersection as the local fillet control point so the inner
        // boundary stays centered and does not twist across the bend.
        const join = offsetLineIntersection(filtered[i]!, e0, e1, -1);
        const inLimit = {
          x: filtered[i + 1]!.x - rr * e1.nx,
          y: filtered[i + 1]!.y - rr * e1.ny,
        };
        const outLimit = {
          x: filtered[i - 1]!.x - rr * e0.nx,
          y: filtered[i - 1]!.y - rr * e0.ny,
        };
        pushInnerFillet(
          join,
          inLimit,
          outLimit,
          innerFilletPx(join, inLimit, outLimit),
          { x: prevX, y: prevY },
        );
      }
    }
  }

  // Semicircular start cap at V_0: arc back to the M anchor through the
  // direction opposite the first edge.
  parts.push(`A ${ri} ${ri} 0 0 1 ${r2(startAx)} ${r2(startAy)}`);
  parts.push("Z");

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// closedPolylinePath
// ---------------------------------------------------------------------------

/**
 * Emit a closed polyline path (M + L commands + Z) through the given vertices.
 *
 * For polygons with zero signed area (perfectly collinear N vertices), emit an
 * OPEN polyline (no Z) so the dashed stroke doesn't retrace itself.
 *
 * Coordinates are rounded to 2 decimal places.
 *
 * @param vertices - Vertex sequence in traversal order (caller provides ordering).
 * @returns SVG path-d string. Empty string for zero-vertex input. Single-point
 *          input returns "M x y" (a degenerate dot — caller should avoid this).
 */
export function closedPolylinePath(vertices: Array<{ x: number; y: number }>): string {
  if (vertices.length === 0) return "";
  if (vertices.length === 1) {
    const v = vertices[0]!;
    return `M ${r2(v.x)} ${r2(v.y)}`;
  }

  const parts: string[] = [];
  const first = vertices[0]!;
  parts.push(`M ${r2(first.x)} ${r2(first.y)}`);
  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i]!;
    parts.push(`L ${r2(v.x)} ${r2(v.y)}`);
  }

  // Compute signed area (shoelace formula) to detect collinear input.
  // In SVG screen coordinates (y-axis down): 2A ≠ 0 means non-degenerate polygon.
  let twoA = 0;
  const N = vertices.length;
  for (let i = 0; i < N; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % N]!;
    twoA += a.x * b.y - b.x * a.y;
  }

  // Append Z only for non-collinear polygons (3+ vertices with non-zero area).
  if (vertices.length >= 3 && Math.abs(twoA) > 1e-9) {
    parts.push("Z");
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// openPolylinePath
// ---------------------------------------------------------------------------

/**
 * Emit an OPEN polyline path (M + L commands, no Z) through the given vertices.
 * Caller is responsible for vertex ordering — typical use passes vertices in
 * string-index order so the polyline traverses the chord across strings.
 *
 * Coordinates rounded to 2 decimal places.
 *
 * @param vertices - vertex sequence in traversal order
 * @returns SVG path-d string. Empty string for zero-vertex input.
 */
export function openPolylinePath(vertices: Array<{ x: number; y: number }>): string {
  if (vertices.length === 0) return "";
  const first = vertices[0]!;
  if (vertices.length === 1) {
    return `M ${r2(first.x)} ${r2(first.y)}`;
  }
  const parts: string[] = [`M ${r2(first.x)} ${r2(first.y)}`];
  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i]!;
    parts.push(`L ${r2(v.x)} ${r2(v.y)}`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// inflatedCapsulePath
// ---------------------------------------------------------------------------

/**
 * Build an inflated capsule SVG path for degenerate voicings (e.g. all notes
 * on the same fret, or notes spread across a very thin line).
 *
 * The function computes the bounding box of the vertices, determines the
 * principal axis (horizontal when width ≥ height, vertical otherwise), and
 * emits a capsule whose two semicircular end-caps have radius `perpOffset`.
 *
 * The resulting path uses `M`, `L`, and `A` (arc) commands, so it always
 * contains the character `"A"` which callers can use as a structural assertion.
 *
 * All coordinates are rounded to 2 decimal places.
 *
 * @param vertices   - The voicing vertices (at least 1).
 * @param perpOffset - Half-width of the capsule (perpendicular inflation).
 * @returns SVG path `d` attribute string.
 */
export function inflatedCapsulePath(vertices: Point[], perpOffset: number): string {
  if (vertices.length === 0) return "";

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const w = maxX - minX;
  const h = maxY - minY;
  const r = r2(Math.max(perpOffset, 1)); // ensure non-zero radius

  if (w >= h) {
    // Horizontal capsule: left end-cap at minX, right at maxX.
    const midY = r2((minY + maxY) / 2);
    const lx = r2(minX);
    const rx = r2(maxX);
    const top = r2(midY - r);
    const bot = r2(midY + r);

    // Path: start at top-left → straight across top → right arc → straight back → left arc → close
    return [
      `M ${lx} ${top}`,
      `L ${rx} ${top}`,
      `A ${r} ${r} 0 0 1 ${rx} ${bot}`,
      `L ${lx} ${bot}`,
      `A ${r} ${r} 0 0 1 ${lx} ${top}`,
      "Z",
    ].join(" ");
  } else {
    // Vertical capsule: top end-cap at minY, bottom at maxY.
    const midX = r2((minX + maxX) / 2);
    const ty = r2(minY);
    const by = r2(maxY);
    const left = r2(midX - r);
    const right = r2(midX + r);

    return [
      `M ${left} ${ty}`,
      `A ${r} ${r} 0 0 1 ${right} ${ty}`,
      `L ${right} ${by}`,
      `A ${r} ${r} 0 0 1 ${left} ${by}`,
      "Z",
    ].join(" ");
  }
}
