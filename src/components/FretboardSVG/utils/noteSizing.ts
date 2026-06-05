import {
  NOTE_BUBBLE_RATIO,
  RADIUS_SCALE_CHORD_ROOT,
  STRING_SPREAD_LEFT_FRAC,
  STRING_OCCUPY_FRAC,
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

/** Radius floor near the nut — keeps labels legible at the tightest spacing. */
export const NOTE_TAPER_MIN_SCALE = 0.72;

/**
 * Desired clear gap between adjacent bubbles, as a fraction of a full bubble
 * diameter. Folded into `referenceSpacing` so the shrink kicks in slightly
 * before bubbles actually touch.
 */
export const NOTE_TAPER_GAP_FRACTION = 0.18;

/**
 * Per-note radius multiplier (∈ [minScale, 1]) that relieves bubble crowding
 * where the neck taper converges the strings toward the nut.
 *
 * Pure f(x): the scale depends only on the note's pixel x, via the local
 * vertical string spacing derived from the same taper model as
 * `fretboardGeometry.ts#getStringY`. Every note in a fret column therefore
 * shrinks by the same factor — no per-string jitter.
 *
 * The clamp-to-1 guarantees mid/high neck is pixel-identical: wherever local
 * spacing already exceeds a comfortable bubble (`referenceSpacing`), the scale
 * is exactly 1. Only the nut region — where strings are closer than one
 * bubble-plus-gap — dips below.
 *
 * Returns 1 for degenerate geometry so callers that omit layout info (e.g.
 * existing unit tests) are unaffected.
 */
export function taperAwareRadiusScale({
  x,
  neckWidthPx,
  neckHeight,
  numStrings,
  noteBubblePx,
  minScale = NOTE_TAPER_MIN_SCALE,
  gapFraction = NOTE_TAPER_GAP_FRACTION,
}: {
  x: number;
  neckWidthPx: number;
  neckHeight: number;
  numStrings: number;
  noteBubblePx: number;
  minScale?: number;
  gapFraction?: number;
}): number {
  if (neckWidthPx <= 0 || neckHeight <= 0 || numStrings < 2 || noteBubblePx <= 0) return 1;

  const xFrac = Math.max(0, Math.min(1, x / neckWidthPx));
  const spacingRatio =
    STRING_SPREAD_LEFT_FRAC + (1 - STRING_SPREAD_LEFT_FRAC) * xFrac;
  const maxSpacing = (neckHeight * STRING_OCCUPY_FRAC) / (numStrings - 1);
  const localSpacing = spacingRatio * maxSpacing;
  const referenceSpacing = noteBubblePx * (1 + gapFraction);

  const scale = localSpacing / referenceSpacing;
  return Math.max(minScale, Math.min(1, scale));
}
