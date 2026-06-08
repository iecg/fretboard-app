// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpDiagram } from "./HelpDiagram";
import type { DiagramId } from "../helpContent";

const IDS: DiagramId[] = [
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

  it("renders the shapes diagram as labelled mini-neck images", () => {
    render(<HelpDiagram id="shapes" />);
    // One <svg role="img"> per mini-neck (CAGED box + 3NPS).
    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(2);
  });

  it("renders the shortcut table with one row per shortcut", () => {
    const { container } = render(<HelpDiagram id="shortcutTable" />);
    expect(container.querySelectorAll("tr")).toHaveLength(13);
  });
});
