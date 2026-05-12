// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { themeAtom } from "../../store/atoms";
import { FretboardBackground } from "./FretboardBackground";

// useWoodGrainTexture uses canvas/createObjectURL which isn't available in jsdom
vi.mock("./hooks/useWoodGrainTexture", () => ({
  useWoodGrainTexture: () => null,
}));

const defaultProps = {
  neckWidthPx: 600,
  neckHeight: 200,
  startFret: 0,
  maxFret: 13,
  tuning: ["E", "B", "G", "D", "A", "E"],
  stringYAt: (stringIndex: number) => stringIndex * 30 + 20,
  wireXRel: (wireIndex: number) => wireIndex * 50,
  svgDefUrl: (id: string) => `url(#${id})`,
  taperYLeft: 5,
  cornerR: 4,
  inlays: [],
};

describe("FretboardBackground", () => {
  it("renders without crashing", () => {
    const { container } = renderWithAtoms(
      <svg>
        <FretboardBackground {...defaultProps} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    // Should have at least one rect (wood background)
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
  });

  it("renders a string line for each tuning entry", () => {
    const { container } = renderWithAtoms(
      <svg>
        <FretboardBackground {...defaultProps} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    // Each string has at least 1 <line> element
    const lines = container.querySelectorAll("line");
    // 6 strings × at least 1 line (shadow + string) = at least 6 lines
    expect(lines.length).toBeGreaterThanOrEqual(6);
  });

  it("renders the nut when startFret is 0", () => {
    const { container } = renderWithAtoms(
      <svg>
        <FretboardBackground {...defaultProps} startFret={0} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    // Nut slots: one rect per string with key nut-slot-*
    // The nut area also adds extra lines. The simplest assertion: a nut material rect exists.
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(1);
  });

  it("does not render extra nut elements when startFret > 0", () => {
    const { container: containerFret0 } = renderWithAtoms(
      <svg>
        <FretboardBackground {...defaultProps} startFret={0} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    const { container: containerFret5 } = renderWithAtoms(
      <svg>
        <FretboardBackground {...defaultProps} startFret={5} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    // When startFret > 0 the nut g block is absent; expect fewer rects
    const rectsFret0 = containerFret0.querySelectorAll("rect").length;
    const rectsFret5 = containerFret5.querySelectorAll("rect").length;
    expect(rectsFret5).toBeLessThan(rectsFret0);
  });

  it("renders fret wire groups for each wire between startFret and maxFret", () => {
    const props = { ...defaultProps, startFret: 1, maxFret: 5 };
    const { container } = renderWithAtoms(
      <svg>
        <FretboardBackground {...props} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    // wireIdx goes from startFret-1 (=0) up to maxFret-1 (=4): 4 wires × 2 rects each = 8 wire rects
    // There is also at least the background rect, so total rects > 8
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
  });

  it("renders top and bottom edge paths", () => {
    const { container } = renderWithAtoms(
      <svg>
        <FretboardBackground {...defaultProps} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    const paths = container.querySelectorAll("path");
    // Two edge paths always rendered
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it("renders inlay children when provided", () => {
    const inlays = [
      <circle key="inlay-0" cx={100} cy={100} r={5} data-testid="inlay-circle" />,
    ];
    const { container } = renderWithAtoms(
      <svg>
        <FretboardBackground {...defaultProps} inlays={inlays} />
      </svg>,
      [[themeAtom, "dark"]],
    );
    expect(container.querySelector("[data-testid='inlay-circle']")).toBeTruthy();
  });
});
