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
  // In SVG screen coords (y-axis down): 2A > 0 means CW traversal, 2A < 0 means CCW.
  // We need CCW winding for the right-hand perpendicular to point outward.
  // If the polygon is CW (2A > 0), negate the normals (use left-hand perpendicular).
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

  // normalSign = +1 when polygon is CCW (right-hand perp is outward),
  //              -1 when polygon is CW  (left-hand perp is outward).
  const normalSign = twoA < 0 ? 1 : -1;

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
