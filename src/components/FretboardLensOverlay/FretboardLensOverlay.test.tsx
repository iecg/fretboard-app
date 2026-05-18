// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { progressionEnabledAtom } from "../../store/atoms";
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
  it("renders the lens panel in scale mode (progression off)", () => {
    renderWithAtoms(<FretboardLensOverlay />, [[progressionEnabledAtom, false]]);
    expect(screen.getByTestId("fretboard-lens-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("top-band-summary")).toBeInTheDocument();
  });

  it("renders nothing in progression mode (progression on)", () => {
    const { container } = renderWithAtoms(<FretboardLensOverlay />, [
      [progressionEnabledAtom, true],
    ]);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("fretboard-lens-overlay")).toBeNull();
  });

  it("tags the overlay with the current layout tier", () => {
    renderWithAtoms(<FretboardLensOverlay />, [[progressionEnabledAtom, false]]);
    expect(screen.getByTestId("fretboard-lens-overlay")).toHaveAttribute(
      "data-layout-tier",
    );
  });
});
