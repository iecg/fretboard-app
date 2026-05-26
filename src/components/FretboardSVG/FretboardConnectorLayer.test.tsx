// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ChordConnectorVoicing } from "./hooks/useChordConnectorPolylines";
import type { CagedShape } from "@fretflow/core";

// Capture AnimatePresence modes observed during render
const animatePresenceModes: string[] = [];
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    AnimatePresence: (props: { mode?: string; children?: React.ReactNode }) => {
      if (props.mode) animatePresenceModes.push(props.mode);
      return <>{props.children}</>;
    },
    motion: {
      ...actual.motion,
      // Ensure motion.g renders valid SVG <g> so tests can query paths
      g: (props: React.SVGProps<SVGGElement> & { children?: React.ReactNode }) => (
        <g {...props}>{props.children}</g>
      ),
    },
  };
});

// Import after mocking motion/react
import { FretboardConnectorLayer } from "./FretboardConnectorLayer";

// Stub polyline: just enough for the renderer to emit three <path> elements
// (halo + fill + outline) per voicing.
const makePolyline = (voicingKey: string, shape?: CagedShape): ChordConnectorVoicing => ({
  paths: { fill: "M0,0 L10,0", outline: "M0,0 L10,0" },
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  paletteIndex: 0,
  shape,
  voicingKey,
});

// Wrap rendered output in an <svg> so the <g>/<path> elements are valid SVG.
const renderInSvg = (ui: React.ReactNode) =>
  render(<svg>{ui}</svg>);

const BASE_PROPS = {
  intervalPolylines: [],
  connectorSource: "full-chord" as const,
  chordRoot: "C",
  chordTones: ["C", "E", "G"],
  showChordConnectors: true,
  connectorMotionMode: "none" as const,
  clipPathUrl: "url(#test-clip)",
};

describe("FretboardConnectorLayer", () => {
  it("renders every polyline uniformly when chord connectors are shown", () => {
    const polylines = [
      makePolyline("0,5|1,5|2,5", "E"),
      makePolyline("1,7|2,7|3,7", "A"),
      makePolyline("3,10|4,10|5,10", "G"),
    ];

    const { container } = renderInSvg(
      <FretboardConnectorLayer {...BASE_PROPS} chordPolylines={polylines} />,
    );

    // 3 voicings × 3 layers (halo, fill, outline) = 9 paths total.
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(9);

    // No primary/secondary class assignment, no data-voicing-role attribute.
    for (const path of paths) {
      expect(path.classList.contains("chord-connector--primary")).toBe(false);
      expect(path.classList.contains("chord-connector--secondary")).toBe(false);
      expect(path.getAttribute("data-voicing-role")).toBeNull();
    }
  });

  it("renders nothing when showChordConnectors is false", () => {
    const polylines = [makePolyline("0,5|1,5|2,5", "E")];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        showChordConnectors={false}
      />,
    );

    expect(container.querySelector(".chord-connectors")).toBeNull();
  });

  it("updates and replaces the rendered paths in the DOM when chordPolylines change", () => {
    const polylines1 = [makePolyline("0,5|1,5|2,5", "E")];
    const polylines2 = [makePolyline("1,7|2,7|3,7", "A")];

    const { rerender, container } = renderInSvg(
      <FretboardConnectorLayer {...BASE_PROPS} chordPolylines={polylines1} />,
    );

    expect(container.querySelector("[data-caged-shape='E']")).toBeInTheDocument();
    expect(container.querySelector("[data-caged-shape='A']")).toBeNull();

    rerender(
      <svg>
        <FretboardConnectorLayer {...BASE_PROPS} chordPolylines={polylines2} />
      </svg>,
    );

    expect(container.querySelector("[data-caged-shape='E']")).toBeNull();
    expect(container.querySelector("[data-caged-shape='A']")).toBeInTheDocument();
  });

  it("uses sync mode so entering and exiting connector groups crossfade", () => {
    const polylines = [makePolyline("0,5|1,5|2,5", "E")];

    renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        connectorMotionMode="group"
      />,
    );

    expect(animatePresenceModes).toContain("sync");
    expect(animatePresenceModes).not.toContain("wait");
  });
});
