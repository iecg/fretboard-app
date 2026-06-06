/**
 * Pure geometry helpers for chord-connector contour rendering.
 *
 * All functions are side-effect-free and React-independent so they can be
 * imported and tested directly without a DOM environment.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round a number to 2 decimal places for deterministic SVG path strings. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// offsetOutlinePath
// ---------------------------------------------------------------------------

/**
 * Returns an SVG path string outlining the Minkowski sum of `points` (CCW polygon)
 * and a circle of radius `radius`. Result has rounded convex corners and the same
 * winding direction as the input.
 *
 * @returns SVG path data starting with `M`, suitable for a `<path d=…>` attribute.
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
