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
} from "./voicings";
export {
  generateVoicings, openStringMidi,
} from "./voicings";

export {
  fretPositionMm,
  voicingWidthMm,
  filterByHandSpan,
  HAND_SPAN_THRESHOLDS_MM,
  type HandSize,
} from "./handSpan";
