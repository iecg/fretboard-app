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

const CONNECTOR_BOUNDARY_GUARD_PX = 1;

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
