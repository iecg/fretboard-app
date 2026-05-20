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

/**
 * Sort a copy of `vertices` by polar angle around their centroid (ascending
 * from −π to +π, i.e. counter-clockwise starting from the 3-o'clock position).
 * Does not mutate the input array.
 */
export function polarSort(vertices: Point[]): Point[] {
  if (vertices.length === 0) return [];
  const cx = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
  const cy = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
  return [...vertices].sort(
    (a, b) =>
      Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
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

// ---------------------------------------------------------------------------
// offsetOpenPolylinePath
// ---------------------------------------------------------------------------

/**
 * Returns an SVG path that traces both sides of an open polyline `points` offset
 * by `radius` on each side, with semicircular caps at the endpoints and quadratic
 * fillets at interior corners. Uses sweep-flag = 1 for convex fillets; callers
 * stroking the result rely on this orientation.
 *
 * @returns SVG path data starting with `M`, closed at the caps (no explicit `Z`).
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
