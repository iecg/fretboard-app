// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { FretboardLensOverlay } from "./FretboardLensOverlay";

// TopBandSummary pulls in motion/react; stub it for jsdom.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      const { children, ...rest } = props;
      return React.createElement(tag, { ...rest, ref }, children as React.ReactNode);
    });
  const cache = new Map<string, unknown>();
  return {
    motion: new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (!cache.has(prop)) cache.set(prop, passthrough(prop));
        return cache.get(prop);
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => null,
  };
});

describe("FretboardLensOverlay", () => {
  it("always renders the lens panel", () => {
    renderWithAtoms(<FretboardLensOverlay />, []);
    expect(screen.getByTestId("fretboard-lens-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("top-band-summary")).toBeInTheDocument();
  });

  it("tags the overlay with the current layout tier and variant", () => {
    renderWithAtoms(<FretboardLensOverlay />, []);
    const overlay = screen.getByTestId("fretboard-lens-overlay");
    expect(overlay).toHaveAttribute("data-layout-tier");
    expect(overlay).toHaveAttribute("data-layout-variant");
  });
});
