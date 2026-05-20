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
