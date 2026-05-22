// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FretboardConnectorLayer } from "./FretboardConnectorLayer";
import type { ChordConnectorVoicing } from "./hooks/useChordConnectorPolylines";
import type { CagedShape } from "@fretflow/core";

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
});
