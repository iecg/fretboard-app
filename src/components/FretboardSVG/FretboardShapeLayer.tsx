import { memo } from "react";
import { motion, AnimatePresence } from "motion/react";

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
          transition={{ duration: 0.25 }}
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
