export type NoteAnimationMode = "css" | "none";
export type ShapeAnimationMode = "group" | "none";
type ConnectorAnimationMode = "group" | "none";

export interface FretboardMotionPolicyInput {
  prefersReducedMotion: boolean;
  playbackActive: boolean;
}

export interface FretboardMotionPolicy {
  noteMode: NoteAnimationMode;
  shapeMode: ShapeAnimationMode;
  connectorMode: ConnectorAnimationMode;
}

/**
 * Resolves the animation policy for fretboard layers.
 *
 * - Notes: CSS transitions (cheap) or static (reduced motion).
 * - Shapes/connectors: single group-level fade or static.
 */
export function resolveFretboardMotionPolicy(
  input: FretboardMotionPolicyInput,
): FretboardMotionPolicy {
  if (input.prefersReducedMotion) {
    return { noteMode: "none", shapeMode: "none", connectorMode: "none" };
  }
  if (input.playbackActive) {
    return { noteMode: "css", shapeMode: "none", connectorMode: "none" };
  }
  return { noteMode: "css", shapeMode: "group", connectorMode: "group" };
}
