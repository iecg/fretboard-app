import {
  NOTE_BUBBLE_RATIO,
  RADIUS_SCALE_CHORD_ROOT,
} from "@fretflow/core";

export const SQUIRCLE_RADIUS_REDUCTION_PX = 3;
export const CIRCLE_RADIUS_REDUCTION_PX = 2;
export const CHORD_ROOT_HALO_RADIUS_PX = 3.5;

/**
 * The glow underlay is a blurred circle drawn behind the note shape. A squircle
 * fills its whole r×r box (reaching r at the cardinal edges), so a circle of the
 * same radius sits entirely under the opaque squircle fill and the glow can't be
 * seen. Enlarge the underlay for squircles so a soft halo reads around the shape.
 * Circle / diamond / hexagon shapes are narrower than r at their diagonals, so
 * the glow already peeks through there — they keep the shape radius.
 */
export const GLOW_RADIUS_SCALE_SQUIRCLE = 1.3;

export function glowUnderlayRadiusPx(radiusPx: number, isSquircle: boolean): number {
  return isSquircle ? radiusPx * GLOW_RADIUS_SCALE_SQUIRCLE : radiusPx;
}

export function reduceSquircleRadius(radiusPx: number): number {
  return Math.max(0, radiusPx - SQUIRCLE_RADIUS_REDUCTION_PX);
}

export function reduceCircleRadius(radiusPx: number): number {
  return Math.max(0, radiusPx - CIRCLE_RADIUS_REDUCTION_PX);
}

export function chordRootVisualRadiusPx(stringRowPx: number): number {
  const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
  return reduceSquircleRadius(noteBubblePx * 0.5 * RADIUS_SCALE_CHORD_ROOT);
}

const SQUIRCLE_K = 0.91;

export function squirclePath(cx: number, cy: number, r: number): string {
  const k = SQUIRCLE_K * r;
  return `M${cx + r} ${cy}C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy}C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}Z`;
}
