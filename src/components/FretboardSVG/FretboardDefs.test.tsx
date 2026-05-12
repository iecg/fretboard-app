// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FretboardDefs } from "./FretboardDefs";
import { axe } from "../../test-utils/a11y";

function makeId(id: string) {
  return `test-${id}`;
}

describe("FretboardDefs", () => {
  const defaultProps = {
    svgDefId: makeId,
    neckWidthPx: 600,
    neckHeight: 200,
    taperPath: "M 0 5 L 600 0 L 600 200 L 0 195 Z",
  };

  it("has no accessibility violations", async () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders a <defs> element", () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    expect(container.querySelector("defs")).toBeTruthy();
  });

  it("renders the fretboard-wood gradient with prefixed id", () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    const grad = container.querySelector("#test-fretboard-wood");
    expect(grad).toBeTruthy();
    expect(grad!.tagName.toLowerCase()).toBe("lineargradient");
  });

  it("renders the fretboard-vignette gradient with prefixed id", () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    expect(container.querySelector("#test-fretboard-vignette")).toBeTruthy();
  });

  it("renders the fretboard-taper clipPath using taperPath", () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    const clip = container.querySelector("#test-fretboard-taper");
    expect(clip).toBeTruthy();
    expect(clip!.tagName.toLowerCase()).toBe("clippath");
    const path = clip!.querySelector("path");
    expect(path!.getAttribute("d")).toBe(defaultProps.taperPath);
  });

  it("renders the fretboard-svg-box clipPath sized to neckWidthPx and neckHeight", () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    const clip = container.querySelector("#test-fretboard-svg-box");
    expect(clip).toBeTruthy();
    const rect = clip!.querySelector("rect");
    expect(Number(rect!.getAttribute("width"))).toBe(defaultProps.neckWidthPx);
    expect(Number(rect!.getAttribute("height"))).toBe(defaultProps.neckHeight);
  });

  it("renders the string-shadow-blur filter sized to the neck dimensions", () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    const filter = container.querySelector("#test-string-shadow-blur");
    expect(filter).toBeTruthy();
    // width and height attributes account for the 8px padding
    expect(Number(filter!.getAttribute("width"))).toBe(defaultProps.neckWidthPx + 8);
    expect(Number(filter!.getAttribute("height"))).toBe(defaultProps.neckHeight + 8);
  });

  it("renders wood-grain filters for both dark and light mode", () => {
    const { container } = render(
      <svg>
        <FretboardDefs {...defaultProps} />
      </svg>,
    );
    expect(container.querySelector("#test-wood-grain-filter")).toBeTruthy();
    expect(container.querySelector("#test-wood-grain-filter-light")).toBeTruthy();
  });
});
