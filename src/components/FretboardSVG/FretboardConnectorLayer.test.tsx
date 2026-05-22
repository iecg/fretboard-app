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

describe("FretboardConnectorLayer — voicing selection primary/secondary", () => {
  it("marks only the matching polyline primary when selectedVoicingKey matches one", () => {
    const polylines = [
      makePolyline("0,5|1,5|2,5", "E"),
      makePolyline("1,7|2,7|3,7", "A"),
      makePolyline("3,10|4,10|5,10", "G"),
    ];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        selectedVoicingKey="1,7|2,7|3,7"
      />,
    );

    // Each voicing renders three layers (halo, fill, outline). The selected
    // voicing's three paths should be marked primary; the other 6 secondary.
    const primary = container.querySelectorAll('path[data-voicing-role="primary"]');
    const secondary = container.querySelectorAll('path[data-voicing-role="secondary"]');
    expect(primary.length).toBe(3);
    expect(secondary.length).toBe(6);

    // All primary paths belong to the A-shape voicing.
    primary.forEach((path) => {
      expect(path.getAttribute("data-caged-shape")).toBe("A");
    });
  });

  it("marks every polyline primary when selectedVoicingKey is null", () => {
    const polylines = [
      makePolyline("0,5|1,5|2,5", "E"),
      makePolyline("1,7|2,7|3,7", "A"),
    ];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        selectedVoicingKey={null}
      />,
    );

    const primary = container.querySelectorAll('path[data-voicing-role="primary"]');
    const secondary = container.querySelectorAll('path[data-voicing-role="secondary"]');
    // 2 voicings × 3 layers = 6 primary paths; 0 secondary.
    expect(primary.length).toBe(6);
    expect(secondary.length).toBe(0);
  });

  it("marks every polyline primary when selectedVoicingKey prop is omitted (defaults to null)", () => {
    const polylines = [
      makePolyline("0,5|1,5|2,5", "E"),
      makePolyline("1,7|2,7|3,7", "A"),
    ];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
      />,
    );

    const primary = container.querySelectorAll('path[data-voicing-role="primary"]');
    const secondary = container.querySelectorAll('path[data-voicing-role="secondary"]');
    expect(primary.length).toBe(6);
    expect(secondary.length).toBe(0);
  });

  it("marks every polyline secondary when selectedVoicingKey matches none", () => {
    // Documents the fallback: a stale selection key (e.g. chord just changed
    // before selectedCloseVoicingAtom resolved) dims everything rather than
    // crashing. In practice the atom resolves to candidates[0] when stale, so
    // this state is transient.
    const polylines = [
      makePolyline("0,5|1,5|2,5", "E"),
      makePolyline("1,7|2,7|3,7", "A"),
    ];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        selectedVoicingKey="nonexistent-key"
      />,
    );

    const primary = container.querySelectorAll('path[data-voicing-role="primary"]');
    const secondary = container.querySelectorAll('path[data-voicing-role="secondary"]');
    expect(primary.length).toBe(0);
    expect(secondary.length).toBe(6);
  });

  it("renders nothing when showChordConnectors is false even with matching selectedVoicingKey", () => {
    const polylines = [makePolyline("0,5|1,5|2,5", "E")];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        selectedVoicingKey="0,5|1,5|2,5"
        showChordConnectors={false}
      />,
    );

    expect(container.querySelector(".chord-connectors")).toBeNull();
  });
});
