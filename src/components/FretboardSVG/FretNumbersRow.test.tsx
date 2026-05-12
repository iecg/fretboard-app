// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FretNumbersRow } from "./FretNumbersRow";

const defaultProps = {
  totalColumns: 4,
  startFret: 1,
  maxFret: 13,
  neckWidthPx: 600,
  fretColumnWidth: () => 50,
};

describe("FretNumbersRow", () => {
  it("renders a container div with aria-hidden", () => {
    const { container } = render(<FretNumbersRow {...defaultProps} />);
    const div = container.firstChild as HTMLElement;
    expect(div.tagName.toLowerCase()).toBe("div");
    expect(div.getAttribute("aria-hidden")).toBe("true");
  });

  it("sets the container width from neckWidthPx", () => {
    const { container } = render(<FretNumbersRow {...defaultProps} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe("600px");
  });

  it("renders totalColumns + 1 span elements", () => {
    const { container } = render(<FretNumbersRow {...defaultProps} />);
    const spans = container.querySelectorAll("span");
    // totalColumns=4 → 5 spans
    expect(spans.length).toBe(5);
  });

  it("shows fret numbers for frets > 0 and < maxFret", () => {
    const { container } = render(<FretNumbersRow {...defaultProps} />);
    const spans = Array.from(container.querySelectorAll("span"));
    const texts = spans.map((s) => s.textContent);
    // startFret=1, totalColumns=4, maxFret=13 → frets 1-5 displayed
    expect(texts).toContain("1");
    expect(texts).toContain("5");
  });

  it("shows empty string for fret 0", () => {
    const props = { ...defaultProps, startFret: 0 };
    const { container } = render(<FretNumbersRow {...props} />);
    const spans = Array.from(container.querySelectorAll("span"));
    // First span is for fret 0 — should be empty
    expect(spans[0].textContent).toBe("");
  });

  it("shows empty string for fret at maxFret boundary", () => {
    const props = { ...defaultProps, startFret: 10, totalColumns: 2, maxFret: 12 };
    const { container } = render(<FretNumbersRow {...props} />);
    const spans = Array.from(container.querySelectorAll("span"));
    // frets 10, 11, 12 → fret 12 === maxFret → empty
    const lastSpan = spans[spans.length - 1];
    expect(lastSpan.textContent).toBe("");
  });

  it("applies fretColumnWidth to each span's width style", () => {
    const fretColumnWidth = (idx: number) => idx * 10 + 20;
    const props = { ...defaultProps, fretColumnWidth };
    const { container } = render(<FretNumbersRow {...props} />);
    const spans = Array.from(container.querySelectorAll("span"));
    spans.forEach((span, i) => {
      const fretIndex = defaultProps.startFret + i;
      expect(span.style.width).toBe(`${fretColumnWidth(fretIndex)}px`);
    });
  });
});
