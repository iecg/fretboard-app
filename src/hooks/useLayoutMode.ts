import { useState, useEffect } from "react";
import { getResponsiveLayout, type ResponsiveLayout } from "../layout/responsive";

export default function useLayoutMode(): ResponsiveLayout {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(
    () => window.innerHeight,
  );

  useEffect(() => {
    const handler = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return getResponsiveLayout(viewportWidth, viewportHeight);
}
