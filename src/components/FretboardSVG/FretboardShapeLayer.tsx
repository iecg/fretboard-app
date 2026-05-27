import { memo, useRef, type ReactNode } from "react";
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

const renderStaticShapeGroup = (polygons: ReactNode) => (
  <g data-motion="none" data-render-path="static">
    {polygons}
  </g>
);

const renderAnimatedShapeGroup = (polygons: ReactNode, skipInitial: boolean) => (
  <motion.g
    key="shape-layer"
    initial={skipInitial ? false : { opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
    data-motion="group"
    data-render-path="animated"
  >
    {polygons}
  </motion.g>
);

export const FretboardShapeLayer = memo(({ svgPolygons, animationMode = "group" }: FretboardShapeLayerProps) => {
  const prevMode = useRef(animationMode);
  const skipInitial = prevMode.current === "none" && animationMode === "group";
  prevMode.current = animationMode;
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
    return renderStaticShapeGroup(polygons);
  }

  return (
    <AnimatePresence>
      {svgPolygons.length > 0 && (
        renderAnimatedShapeGroup(polygons, skipInitial)
      )}
    </AnimatePresence>
  );
});
FretboardShapeLayer.displayName = "FretboardShapeLayer";
