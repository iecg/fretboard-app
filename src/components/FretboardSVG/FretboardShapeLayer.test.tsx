// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FretboardShapeLayer } from "./FretboardShapeLayer";
import { axe } from "../../test-utils/a11y";

describe("FretboardShapeLayer", () => {
  it("has no accessibility violations", async () => {
    const polygons = [
      { key: "shape-A", points: "0,0 100,0 100,50 0,50", color: "red" },
    ];
    const { container } = render(
      <svg>
        <FretboardShapeLayer svgPolygons={polygons} />
      </svg>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders nothing when svgPolygons is empty", () => {
    const { container } = render(
      <svg>
        <FretboardShapeLayer svgPolygons={[]} />
      </svg>,
    );
    expect(container.querySelectorAll("polygon").length).toBe(0);
  });

  it("renders a polygon for each entry in svgPolygons", () => {
    const polygons = [
      { key: "shape-A", points: "0,0 100,0 100,50 0,50", color: "red" },
      { key: "shape-B", points: "10,10 90,10 90,40 10,40", color: "blue" },
    ];
    const { container } = render(
      <svg>
        <FretboardShapeLayer svgPolygons={polygons} />
      </svg>,
    );
    // motion/react may use svg <polygon> or equivalent elements
    const rendered = container.querySelectorAll("polygon");
    expect(rendered.length).toBe(2);
  });

  it("sets fill and points attributes on each polygon", () => {
    const polygons = [
      { key: "shape-C", points: "0,0 50,0 50,30 0,30", color: "#ff00ff" },
    ];
    const { container } = render(
      <svg>
        <FretboardShapeLayer svgPolygons={polygons} />
      </svg>,
    );
    const poly = container.querySelector("polygon")!;
    expect(poly.getAttribute("points")).toBe("0,0 50,0 50,30 0,30");
    expect(poly.getAttribute("fill")).toBe("#ff00ff");
  });

  it("sets pointerEvents to none on rendered polygons", () => {
    const polygons = [
      { key: "shape-D", points: "0,0 40,0 40,20 0,20", color: "green" },
    ];
    const { container } = render(
      <svg>
        <FretboardShapeLayer svgPolygons={polygons} />
      </svg>,
    );
    const poly = container.querySelector("polygon")!;
    // style.pointerEvents may be read differently in jsdom; check attribute or style
    const style = poly.getAttribute("style") ?? "";
    const pointerEvents = (poly as SVGElement).style?.pointerEvents;
    expect(style.includes("pointer-events: none") || pointerEvents === "none").toBe(true);
  });

  it("wraps polygons in one animated group instead of animating every polygon", () => {
    const { container } = render(
      <svg>
        <FretboardShapeLayer
          svgPolygons={[{ key: "shape-A", points: "0,0 100,0 100,50 0,50", color: "red" }]}
          animationMode="group"
        />
      </svg>,
    );

    expect(container.querySelector('g[data-motion="group"]')).toBeTruthy();
  });

  it("renders a static wrapper when group fades are disabled", () => {
    const { container } = render(
      <svg>
        <FretboardShapeLayer
          svgPolygons={[{ key: "shape-A", points: "0,0 100,0 100,50 0,50", color: "red" }]}
          animationMode="none"
        />
      </svg>,
    );

    expect(container.querySelector('g[data-motion="none"]')).toBeTruthy();
    expect(container.querySelector('g[data-motion="group"]')).toBeNull();
  });
});
