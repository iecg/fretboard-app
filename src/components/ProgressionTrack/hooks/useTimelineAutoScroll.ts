import { useEffect, type RefObject } from "react";
import {
  AUTO_SCROLL_LEAD_FRACTION,
  computeAutoScrollDelta,
} from "./timelineAutoScroll";

/**
 * Keeps the active timeline block in view inside a horizontally scrollable
 * container. Fires only when `activeIndex` changes, so it never fights a manual
 * scroll between index changes (it follows playback advances and editor
 * selections, and yields to touch otherwise). No-ops when the container does
 * not horizontally overflow (desktop/tablet).
 */
export function useTimelineAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  activeIndex: number,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth) return;

    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;

    const containerRect = container.getBoundingClientRect();
    const blockRect = active.getBoundingClientRect();

    const delta = computeAutoScrollDelta(
      { left: containerRect.left, width: container.clientWidth },
      { left: blockRect.left, right: blockRect.right },
      AUTO_SCROLL_LEAD_FRACTION,
    );
    if (delta === null) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    container.scrollBy({
      left: delta,
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }, [containerRef, activeIndex]);
}
