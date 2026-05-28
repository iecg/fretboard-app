import { useEffect, useMemo, useState } from "react";
import { getResponsiveLayout, type ResponsiveLayout } from "../layout/responsive";

interface ViewportState {
  width: number;
  height: number;
}

export default function useLayoutMode(): ResponsiveLayout {
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    let rafId: number | null = null;

    const commit = () => {
      rafId = null;
      setViewport((prev) => {
        const next = { width: window.innerWidth, height: window.innerHeight };
        return prev.width === next.width && prev.height === next.height
          ? prev
          : next;
      });
    };

    const handleResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(commit);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return useMemo(
    () => getResponsiveLayout(viewport.width, viewport.height),
    [viewport],
  );
}
