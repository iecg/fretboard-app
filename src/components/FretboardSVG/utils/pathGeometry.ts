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
