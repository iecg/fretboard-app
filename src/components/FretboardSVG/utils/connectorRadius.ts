/**
 * Uniform base radius factor for chord-connector outlines. All voicings
 * share this base; differentiation comes only from conflict offsets.
 */
export const CHORD_CONNECTOR_BASE_RADIUS_FACTOR = 0.42;

/**
 * Legacy per-span factors. Interval connectors still use `compact`.
 */
export const CHORD_CONNECTOR_RADIUS_FACTORS = {
  compact: 0.34,
  medium: 0.38,
  max: 0.42,
} as const;

export interface ConnectorYBounds {
  minY: number;
  maxY: number;
}

interface ConnectorVertex {
  x: number;
  y: number;
}

import { chordRootVisualRadiusPx } from "./noteSizing";

const CONNECTOR_BOUNDARY_GUARD_PX = 1;
const CHORD_CONNECTOR_MIN_HALO_PX = 2;

export function clampConnectorRadiusToYBounds(
  vertices: ConnectorVertex[],
  preferredRadius: number,
  yBounds?: ConnectorYBounds,
): number {
  if (!yBounds || vertices.length === 0) return preferredRadius;

  let minVertexY = Infinity;
  let maxVertexY = -Infinity;
  for (const vertex of vertices) {
    if (vertex.y < minVertexY) minVertexY = vertex.y;
    if (vertex.y > maxVertexY) maxVertexY = vertex.y;
  }

  const availableRadius = Math.min(
    minVertexY - yBounds.minY,
    yBounds.maxY - maxVertexY,
  ) - CONNECTOR_BOUNDARY_GUARD_PX;

  return Math.max(0, Math.min(preferredRadius, availableRadius));
}

export function resolveConnectorRadiusPx({
  vertices,
  preferredRadius,
  yBounds,
  edgeSafe,
}: {
  vertices: ConnectorVertex[];
  preferredRadius: number;
  yBounds?: ConnectorYBounds;
  edgeSafe: boolean;
}): number {
  return edgeSafe
    ? clampConnectorRadiusToYBounds(vertices, preferredRadius, yBounds)
    : preferredRadius;
}

/**
 * Largest chord-tier marker radius (chord tones / diatonic / root) as drawn by
 * `getNoteVisuals` — `RADIUS_CHORD` scaled against the half-row. The connector
 * band half-width must clear this so tight vertical voicings near the nut don't
 * vanish behind their own markers.
 */
const CHORD_TONE_MARKER_RADIUS_FACTOR = 0.95;

function chordToneMarkerRadiusPx(stringRowPx: number): number {
  return (stringRowPx / 2) * CHORD_TONE_MARKER_RADIUS_FACTOR;
}

/**
 * Lift a raw span-based connector radius above the chord-tier marker's outer
 * edge plus a small halo so the contour never collapses inside the note bubble.
 * Shared by chord connectors and interval connectors.
 *
 * The floor is keyed to the *chord-tone* marker radius (the largest marker a
 * voicing draws), not the chord-root squircle alone — for tight voicings near
 * the nut the band half-width would otherwise be smaller than the chord-tone
 * markers and the band + center line would hide entirely behind them.
 *
 * Computed in pixel space (rather than as a factor of `stringRowPx`) so the
 * halo gap is constant across the adaptive row-height range — at large row
 * heights the relative gap shrinks, which matches the intent that the floor
 * is a "minimum visible separation" rather than a proportional adjustment.
 */
export function applyConnectorRadiusFloor(
  spanRadiusPx: number,
  stringRowPx: number,
): number {
  const markerFloor =
    chordToneMarkerRadiusPx(stringRowPx) + CHORD_CONNECTOR_MIN_HALO_PX;
  const squircleFloor =
    chordRootVisualRadiusPx(stringRowPx) + CHORD_CONNECTOR_MIN_HALO_PX;
  return Math.max(spanRadiusPx, markerFloor, squircleFloor);
}

/**
 * Compute the effective connector contour radius for one voicing.
 *
 * All voicings share a single uniform base radius so non-overlapping
 * connectors look identical. Conflict offsets are added on top only
 * when two voicings geometrically overlap.
 */
export function computeChordConnectorRadiusPx(
  stringRowPx: number,
  offsetPx: number,
): number {
  const flooredRadius = applyConnectorRadiusFloor(
    stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
    stringRowPx,
  );
  return flooredRadius + Math.max(offsetPx, 0);
}
