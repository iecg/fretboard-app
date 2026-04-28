// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "../../test-utils/a11y";
import { FieldHelpHeader } from "./FieldHelpHeader";

const help = { id: "test-field", content: "This is some help text." };

describe("FieldHelpHeader", () => {
  it("renders the label text", () => {
    render(<FieldHelpHeader label="Test Label" />);
    expect(screen.getByText("Test Label")).toBeTruthy();
  });

  it("renders no help button (help text is rendered inline below the field)", () => {
    render(<FieldHelpHeader label="Test Label" help={help} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not render the help content (the surrounding section renders it)", () => {
    render(<FieldHelpHeader label="Test Label" help={help} />);
    expect(screen.queryByText(help.content)).toBeNull();
  });

  it("ignores legacy popover-state props without crashing", () => {
    render(
      <FieldHelpHeader
        label="Test Label"
        help={help}
        isHelpOpen={true}
        onToggleHelp={() => {}}
      />,
    );
    expect(screen.getByText("Test Label")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders with no accessibility violations", async () => {
    const { container } = render(
      <FieldHelpHeader label="Test Label" help={help} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
