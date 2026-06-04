export type { CagedShape, FullChordQuality } from "./templates";
export { CAGED_SHAPES, CAGED_SHAPE_COLORS, isMajorScale } from "./templates";

export type { FullChordMatch, FullChordMatchNote } from "./fullChordShapes";
export { getFullChordShapeMatches } from "./fullChordShapes";

export type { ShapeVertex, ShapePolygon, ShapeResult } from "./polygons";
export { getCagedCoordinates } from "./polygons";

export { findMainShape, getShapeCenterFret, isShapeOutOfView, hasWrappedNotes } from "./analytics";

export { get3NPSCoordinates } from "./threeNPS";

export type {
  Voicing, VoicingNote, VoicingType,
  GenerateVoicingsParams,
  CloseVoicingScoreWeights,
} from "./voicings";
export {
  generateVoicings, openStringMidi,
  scoreCloseVoicing, compareCloseVoicings,
  CLOSE_VOICING_SCORE_WEIGHTS, HIGH_NECK_THRESHOLD,
} from "./voicings";
