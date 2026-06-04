import { memo, useLayoutEffect, useState, type ReactNode } from "react";
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
  const [prevMode, setPrevMode] = useState(animationMode);
  const skipInitial = prevMode === "none" && animationMode === "group";

  useLayoutEffect(() => {
    setPrevMode(animationMode);
  }, [animationMode]);
  // All active-shape region shading uses a single neutral tint so it never
  // competes with the role-based note colors (amber home / teal guide / rest).
  // The per-CAGED `color` is intentionally ignored here; the per-shape tokens
  // stay defined for a future opt-in "show all positions" overview.
  const polygons = svgPolygons.map(({ points, key }) => (
    <polygon
      key={key}
      points={points}
      fill="var(--fb-region-tint)"
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
