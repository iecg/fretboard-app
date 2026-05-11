import {
  NOTE_BUBBLE_RATIO,
  RADIUS_SCALE_CHORD_ROOT,
} from "@fretflow/core";

export const SQUIRCLE_RADIUS_REDUCTION_PX = 1;
export const CHORD_ROOT_HALO_RADIUS_PX = 3.5;

export function reduceSquircleRadius(radiusPx: number): number {
  return Math.max(0, radiusPx - SQUIRCLE_RADIUS_REDUCTION_PX);
}

export function chordRootVisualRadiusPx(stringRowPx: number): number {
  const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
  return reduceSquircleRadius(noteBubblePx * 0.5 * RADIUS_SCALE_CHORD_ROOT);
}
