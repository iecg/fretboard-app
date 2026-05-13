import { memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";

interface SvgPolygon {
  points: string;
  color: string;
  key: string;
}

interface FretboardShapeLayerProps {
  svgPolygons: SvgPolygon[];
}

export const FretboardShapeLayer = memo(({ svgPolygons }: FretboardShapeLayerProps) => {
  return (
    <AnimatePresence>
      {svgPolygons.map(({ points, color, key }) => (
        <motion.polygon
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
          points={points}
          fill={color}
          stroke="none"
          style={{ pointerEvents: "none" }}
        />
      ))}
    </AnimatePresence>
  );
});
FretboardShapeLayer.displayName = "FretboardShapeLayer";
