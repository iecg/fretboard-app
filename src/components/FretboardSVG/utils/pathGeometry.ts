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
// enforceMinimumExtent
// ---------------------------------------------------------------------------

/**
 * Ensure a set of vertices has at least `minExtent` pixels of spread along its
 * short axis (the smaller of bbox width / bbox height).
 *
 * When the short dimension is below `minExtent` the function nudges every vertex
 * away from the centroid along that axis so the resulting bbox short dimension
 * equals exactly `minExtent`.  Points that already lie on or beyond the centroid
 * along that axis are pushed out; points on the other side are pushed inward
 * symmetrically.
 *
 * Returns the original array unchanged if the short dimension already meets or
 * exceeds `minExtent`.  **Does not mutate the input array.**
 *
 * This is a path-builder-agnostic pre-pass: whether the caller subsequently
 * routes to `closedCatmullRomPath` or `inflatedCapsulePath`, every contour gets
 * a guaranteed minimum readable width.
 *
 * @param vertices  - Polar-sorted control points.
 * @param minExtent - Minimum allowed short-axis span in pixels.
 * @returns A new array with the same length; coordinates rounded to 2 d.p.
 */
export function enforceMinimumExtent(vertices: Point[], minExtent: number): Point[] {
  if (vertices.length === 0 || minExtent <= 0) return vertices;

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  // Short axis is the one with the smaller span.
  const needsExpansionX = bboxW < minExtent;
  const needsExpansionY = bboxH < minExtent;

  // No expansion needed — return original reference to avoid allocation.
  if (!needsExpansionX && !needsExpansionY) return vertices;

  const { cx, cy } = centroid(vertices);

  return vertices.map((v) => {
    let nx = v.x;
    let ny = v.y;

    if (needsExpansionX) {
      // Push along x-axis: half the required span from the centroid.
      const halfTarget = minExtent / 2;
      const dx = v.x - cx;
      if (Math.abs(dx) < halfTarget) {
        // For vertices exactly on the centroid x (dx=0), use the perpendicular
        // offset (dy) as a tie-breaker: if dy >= 0, push x right; else push left.
        // This handles the all-on-same-fret case where all points share x=cx.
        const dy = v.y - cy;
        const sign = dx !== 0 ? Math.sign(dx) : dy >= 0 ? 1 : -1;
        nx = cx + sign * halfTarget;
      }
    }

    if (needsExpansionY) {
      const halfTarget = minExtent / 2;
      const dy = v.y - cy;
      if (Math.abs(dy) < halfTarget) {
        // Symmetric tie-breaker: use dx as secondary signal.
        const dx = v.x - cx;
        const sign = dy !== 0 ? Math.sign(dy) : dx >= 0 ? 1 : -1;
        ny = cy + sign * halfTarget;
      }
    }

    return { x: r2(nx), y: r2(ny) };
  });
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
