// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render } from "@testing-library/react";
import type { ChordConnectorVoicing } from "./hooks/useChordConnectorPolylines";
import type { CagedShape } from "@fretflow/core";

// Stub polyline: just enough for the renderer to emit the ribbon <path> elements
// (halo + fill + spine) per voicing.
const makePolyline = (voicingKey: string, shape?: CagedShape, dashed = false): ChordConnectorVoicing => ({
  paths: { fill: "M0,0 L10,0", outline: "M0,0 L10,0" },
  spinePath: "M 0 0 L 10 0",
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  paletteIndex: 0,
  dashed,
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
  pass: "below" as const,
};

// Capture AnimatePresence modes observed during render (scoped to these tests)
const animatePresenceModes: string[] = [];

// Ensure the captured modes are cleared after each test
afterEach(() => {
  animatePresenceModes.length = 0;
});

// Mock motion/react in a scope owned by these tests so the
// observed modes are local to this test file.
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

describe("FretboardConnectorLayer", () => {
  // Import the module under test after installing the mock.
  let FretboardConnectorLayer: typeof import("./FretboardConnectorLayer").FretboardConnectorLayer;
  beforeAll(async () => {
    const mod = await import("./FretboardConnectorLayer");
    FretboardConnectorLayer = mod.FretboardConnectorLayer;
  });

  it("renders every polyline uniformly when chord connectors are shown", () => {
    const polylines = [
      makePolyline("0,5|1,5|2,5", "E"),
      makePolyline("1,7|2,7|3,7", "A"),
      makePolyline("3,10|4,10|5,10", "G"),
    ];

    // pass="below": line-only connector = halo + spine per voicing (2 layers × 3 voicings = 6 paths)
    const { container: belowContainer } = renderInSvg(
      <FretboardConnectorLayer {...BASE_PROPS} pass="below" chordPolylines={polylines} />,
    );
    const belowPaths = belowContainer.querySelectorAll("path");
    expect(belowPaths.length).toBe(6);
    for (const path of belowPaths) {
      expect(path.getAttribute("data-layer")).toMatch(/^(halo|spine)$/);
      expect(path.classList.contains("chord-connector--primary")).toBe(false);
      expect(path.classList.contains("chord-connector--secondary")).toBe(false);
      expect(path.getAttribute("data-voicing-role")).toBeNull();
    }
    // The ribbon spine renders below the notes; no boundary outline edges.
    expect(belowContainer.querySelector('path[data-layer="spine"]')).toBeTruthy();
    expect(belowContainer.querySelector('path[data-layer="outline"]')).toBeNull();

    // pass="above": chord connectors render nothing above the notes.
    const { container: aboveContainer } = renderInSvg(
      <FretboardConnectorLayer {...BASE_PROPS} pass="above" chordPolylines={polylines} />,
    );
    expect(aboveContainer.querySelectorAll("path").length).toBe(0);
  });

  it("emits data-dash='true' on the spine of a dashed voicing", () => {
    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        pass="below"
        chordPolylines={[makePolyline("0,0|1,2|2,4", undefined, true)]}
      />,
    );
    expect(
      container.querySelector('path[data-layer="spine"][data-dash="true"]'),
    ).not.toBeNull();
  });

  it("paints dashed spines on top of solid spines where voicings overlap", () => {
    // Dashed voicing is listed FIRST; without z-ordering it would render under
    // the solid one. The renderer must reorder so the dashed spine paints last.
    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        pass="below"
        chordPolylines={[
          makePolyline("0,0|1,2|2,4", undefined, true), // dashed
          makePolyline("0,5|1,5|2,5", undefined, false), // solid
        ]}
      />,
    );
    const spines = [...container.querySelectorAll('path[data-layer="spine"]')];
    const dashedIdx = spines.findIndex((p) => p.getAttribute("data-dash") === "true");
    const solidIdx = spines.findIndex((p) => p.getAttribute("data-dash") === null);
    // Later in document order = painted on top in SVG.
    expect(dashedIdx).toBeGreaterThan(solidIdx);
  });

  it("omits data-dash on a solid voicing", () => {
    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        pass="below"
        chordPolylines={[makePolyline("0,0|1,2|2,4", undefined, false)]}
      />,
    );
    expect(container.querySelector('path[data-layer="spine"][data-dash]')).toBeNull();
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

  it("marks the animated connector wrapper explicitly when group fades are enabled", () => {
    const polylines = [makePolyline("0,5|1,5|2,5", "E")];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        connectorMotionMode="group"
      />,
    );

    expect(container.querySelector('g[data-motion="group"]')).toBeTruthy();
    expect(container.querySelector('g[data-render-path="animated"]')).toBeTruthy();
  });

  it("enters with a fade by default (group mode, not playing)", () => {
    const polylines = [makePolyline("0,5|1,5|2,5", "E")];
    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        connectorMotionMode="group"
      />,
    );
    expect(container.querySelector('g[data-render-path="animated"]')?.getAttribute("data-enter")).toBe("fade");
  });

  it("enters instantly during playback so the connector swaps in sync with the chord", () => {
    const polylines = [makePolyline("0,5|1,5|2,5", "E")];
    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        connectorMotionMode="group"
        playbackActive
      />,
    );
    expect(container.querySelector('g[data-render-path="animated"]')?.getAttribute("data-enter")).toBe("instant");
  });

  it("renders a static connector wrapper when group fades are disabled", () => {
    const polylines = [makePolyline("0,5|1,5|2,5", "E")];

    const { container } = renderInSvg(
      <FretboardConnectorLayer
        {...BASE_PROPS}
        chordPolylines={polylines}
        connectorMotionMode="none"
      />,
    );

    expect(container.querySelector('g[data-motion="none"]')).toBeTruthy();
    expect(container.querySelector('g[data-render-path="static"]')).toBeTruthy();
    expect(container.querySelector('g[data-motion="group"]')).toBeNull();
  });
});
