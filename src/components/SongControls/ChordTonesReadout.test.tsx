import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "../../test-utils/a11y";
import { ChordTonesReadout } from "./ChordTonesReadout";

describe("ChordTonesReadout", () => {
  it("renders each chord tone with its interval degree", () => {
    render(<ChordTonesReadout root="C" quality="M" displayRoot="C" preferFlats={false} label="Notes" />);
    const group = screen.getByRole("group", { name: "Notes" });
    const items = within(group).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("C");
    expect(items[0]).toHaveTextContent("R");
    expect(items[1]).toHaveTextContent("E");
    expect(items[1]).toHaveTextContent("3");
    expect(items[2]).toHaveTextContent("G");
    expect(items[2]).toHaveTextContent("5");
  });

  it("shows the flat seventh degree for a dominant 7 chord", () => {
    render(<ChordTonesReadout root="G" quality="7" displayRoot="C" preferFlats={false} label="Notes" />);
    // G7 = G B D F → R 3 5 ♭7
    expect(screen.getByText("♭7")).toBeInTheDocument();
  });

  it("renders nothing for an unknown chord quality", () => {
    const { container } = render(
      <ChordTonesReadout root="C" quality="not-a-chord" displayRoot="C" preferFlats={false} label="Notes" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ChordTonesReadout root="C" quality="m7" displayRoot="C" preferFlats={false} label="Notes" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
