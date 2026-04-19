import { useEffect, type RefObject } from "react";
import { getFocusableElements } from "../utils/dom";

interface UseFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>;
  active: boolean;
  onEscape: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}

export function useFocusTrap({
  containerRef,
  active,
  onEscape,
  restoreFocusRef,
}: UseFocusTrapOptions): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    let rafId: number | undefined = requestAnimationFrame(() => {
      rafId = undefined;
      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const focusable = getFocusableElements(container);
        if (focusable.length === 0) return;

        const focused = document.activeElement as HTMLElement;
        const idx = focusable.indexOf(focused);

        if (event.shiftKey) {
          // Shift+Tab: backward cycling
          const prevIdx = idx <= 0 ? focusable.length - 1 : idx - 1;
          focusable[prevIdx].focus();
        } else {
          // Tab: forward cycling
          const nextIdx = idx >= focusable.length - 1 ? 0 : idx + 1;
          focusable[nextIdx].focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef?.current?.focus();
    };
  }, [active, onEscape, containerRef, restoreFocusRef]);
}
