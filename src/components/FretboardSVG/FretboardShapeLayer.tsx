import { memo } from "react";

interface SvgPolygon {
  points: string;
  color: string;
  key: string;
}

interface FretboardShapeLayerProps {
  svgPolygons: SvgPolygon[];
}

export const FretboardShapeLayer = memo(({ svgPolygons }: FretboardShapeLayerProps) => {
  if (svgPolygons.length === 0) return null;
  return (
    <>
      {svgPolygons.map(({ points, color, key }) => (
        <polygon
          key={key}
          points={points}
          fill={color}
          stroke="none"
          style={{ pointerEvents: "none" }}
        />
      ))}
    </>
  );
});
FretboardShapeLayer.displayName = "FretboardShapeLayer";
