// From templates
export type { CagedShape } from "./templates";
export { CAGED_SHAPES, CAGED_SHAPE_COLORS, isMajorScale } from "./templates";

// From polygons
export type { ShapeVertex, ShapePolygon, ShapeResult } from "./polygons";
export { getCagedCoordinates } from "./polygons";

// From analytics
export { findMainShape, getShapeCenterFret, isShapeOutOfView, hasWrappedNotes } from "./analytics"; // exported for external consumers

// From threeNPS
export { get3NPSCoordinates } from "./threeNPS";
