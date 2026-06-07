// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpDiagram } from "./HelpDiagram";
import type { DiagramId } from "../helpContent";

const IDS: DiagramId[] = [
  "layoutMap",
  "noteRoleLegend",
  "shapes",
  "voiceLeading",
  "shortcutTable",
];

describe("HelpModal/diagrams/HelpDiagram", () => {
  it.each(IDS)("renders the %s diagram without error", (id) => {
    const { container } = render(<HelpDiagram id={id} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders SVG diagrams with an img role", () => {
    render(<HelpDiagram id="layoutMap" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders the shortcut table with one row per shortcut", () => {
    const { container } = render(<HelpDiagram id="shortcutTable" />);
    expect(container.querySelectorAll("tr")).toHaveLength(11);
  });
});
