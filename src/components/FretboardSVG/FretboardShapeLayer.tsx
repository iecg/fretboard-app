import { memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import type { ShapeAnimationMode } from "./motionPolicy";

interface SvgPolygon {
  points: string;
  color: string;
  key: string;
}

interface FretboardShapeLayerProps {
  svgPolygons: SvgPolygon[];
  animationMode?: ShapeAnimationMode;
}

export const FretboardShapeLayer = memo(({ svgPolygons, animationMode = "group" }: FretboardShapeLayerProps) => {
  const polygons = svgPolygons.map(({ points, color, key }) => (
    <polygon
      key={key}
      points={points}
      fill={color}
      stroke="none"
      style={{ pointerEvents: "none" }}
    />
  ));

  if (animationMode === "none") {
    return <g data-motion="none">{polygons}</g>;
  }

  return (
    <AnimatePresence>
      {svgPolygons.length > 0 && (
        <motion.g
          key="shape-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
          data-motion="group"
        >
          {polygons}
        </motion.g>
      )}
    </AnimatePresence>
  );
});
FretboardShapeLayer.displayName = "FretboardShapeLayer";
