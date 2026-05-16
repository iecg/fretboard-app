import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { PropGrid, Prop, GroupHeader, ToggleProp } from "./InspectorGrid";

describe("InspectorGrid", () => {
  it("PropGrid sets the grid template columns from the columns prop", () => {
    const { container } = render(
      <PropGrid columns={4}>
        <Prop label="A">a</Prop>
      </PropGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  it("PropGrid defaults to six columns", () => {
    const { container } = render(
      <PropGrid>
        <Prop label="A">a</Prop>
      </PropGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))");
  });

  it("Prop renders its label, children, and hint, and applies the span", () => {
    const { container } = render(
      <Prop label="Pattern" span={2} hint="Pick one">
        <button type="button">child</button>
      </Prop>,
    );
    expect(screen.getByText("Pattern")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "child" })).toBeInTheDocument();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    const cell = container.firstElementChild as HTMLElement;
    expect(cell.style.gridColumn).toBe("span 2");
  });

  it("GroupHeader renders its label text", () => {
    render(<GroupHeader>Fingering</GroupHeader>);
    expect(screen.getByText("Fingering")).toBeInTheDocument();
  });

  it("ToggleProp renders a switch bound to checked/onChange", async () => {
    const user = userEvent.setup();
    let value = false;
    const handleChange = (v: boolean) => {
      value = v;
    };
    const { rerender } = render(
      <ToggleProp label="Degree Colors" checked={value} onChange={handleChange} />,
    );
    const sw = screen.getByRole("switch", { name: "Degree Colors" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(value).toBe(true);
    rerender(<ToggleProp label="Degree Colors" checked={value} onChange={handleChange} />);
    expect(screen.getByRole("switch", { name: "Degree Colors" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("ToggleProp shows the status word when provided", () => {
    render(<ToggleProp label="Full Chords" checked onChange={() => {}} status="CAGED" />);
    expect(screen.getByText("CAGED")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <PropGrid columns={6}>
        <GroupHeader>Settings</GroupHeader>
        <Prop label="Volume" span={2}>
          <input type="range" aria-label="Volume" />
        </Prop>
        <ToggleProp label="Enabled" checked={true} onChange={() => {}} />
      </PropGrid>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
