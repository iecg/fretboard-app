// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { FieldHelpHeader } from "./FieldHelpHeader";

const help = { id: "test-field", content: "This is some help text." };

function Wrapper({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <FieldHelpHeader
      label="Test Label"
      help={help}
      isHelpOpen={open}
      onToggleHelp={() => setOpen((v) => !v)}
    />
  );
}

import React from "react";

describe("FieldHelpHeader", () => {
  it("renders with no accessibility violations when collapsed", async () => {
    const { container } = render(<Wrapper />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders with no accessibility violations when expanded", async () => {
    const { container } = render(<Wrapper defaultOpen />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders the label text", () => {
    render(<Wrapper />);
    expect(screen.getByText("Test Label")).toBeTruthy();
  });

  it("icon button has accessible name via aria-label", () => {
    render(<Wrapper />);
    expect(screen.getByLabelText("Show help for Test Label")).toBeTruthy();
  });

  it("aria-expanded is false when closed", () => {
    render(<Wrapper />);
    const btn = screen.getByLabelText("Show help for Test Label");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("aria-expanded toggles to true on click", () => {
    render(<Wrapper />);
    const btn = screen.getByLabelText("Show help for Test Label");
    fireEvent.click(btn);
    expect(screen.getByLabelText("Hide help for Test Label")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("popover content is visible when open", () => {
    render(<Wrapper defaultOpen />);
    expect(screen.getByText("This is some help text.")).toBeTruthy();
  });

  it("popover content is hidden when closed", () => {
    render(<Wrapper />);
    expect(screen.queryByText("This is some help text.")).toBeNull();
  });

  it("popover has the id that aria-controls references", () => {
    render(<Wrapper defaultOpen />);
    const btn = screen.getByLabelText("Hide help for Test Label");
    const controlsId = btn.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).toBeTruthy();
  });

  it("renders without help when no help prop is given", async () => {
    const { container } = render(
      <FieldHelpHeader
        label="No Help"
        isHelpOpen={false}
        onToggleHelp={() => {}}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("button is focusable via keyboard tab", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.tab();
    const btn = screen.getByLabelText("Show help for Test Label");
    expect(document.activeElement).toBe(btn);
  });
});
