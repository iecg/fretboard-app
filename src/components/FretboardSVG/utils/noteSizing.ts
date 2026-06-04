import {
  NOTE_BUBBLE_RATIO,
  RADIUS_SCALE_CHORD_ROOT,
} from "@fretflow/core";

export const SQUIRCLE_RADIUS_REDUCTION_PX = 3;
export const CIRCLE_RADIUS_REDUCTION_PX = 2;

/**
 * The glow underlay is a blurred circle drawn behind the note shape. Circle and
 * diamond shapes are narrower than r at their diagonals, so the soft halo
 * already peeks through there — the underlay keeps the shape radius.
 */
export function glowUnderlayRadiusPx(radiusPx: number): number {
  return radiusPx;
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
