import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { NotePill } from "./NotePill";

describe("NotePill", () => {
  it("renders the note glyph and interval label", () => {
    render(<NotePill note="C" interval="b3" ariaLabel="toggle C" />);
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("b3")).toBeInTheDocument();
  });

  it("renders as a listitem containing the toggle button", () => {
    render(<NotePill note="C" ariaLabel="toggle C" />);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "toggle C" })).toBeInTheDocument();
  });

  it("omits the interval span when no interval is given", () => {
    const { container } = render(<NotePill note="C" ariaLabel="toggle C" />);
    // Only the note span is present inside the button.
    expect(container.querySelectorAll("button > span")).toHaveLength(1);
  });

  it("fires onToggle when clicked and reflects aria-pressed", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<NotePill note="C" ariaLabel="toggle C" pressed onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: "toggle C" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("is disabled when no onToggle handler is provided", () => {
    render(<NotePill note="C" ariaLabel="toggle C" />);
    expect(screen.getByRole("button", { name: "toggle C" })).toBeDisabled();
  });

  it("applies caller class names and data attributes", () => {
    const { container } = render(
      <NotePill
        note="C"
        ariaLabel="toggle C"
        onToggle={() => {}}
        itemClassName="role-item"
        pillClassName="role-pill"
        itemData={{ "data-in-scale": "true" }}
        pillData={{ "data-chord-root": "true" }}
      />,
    );
    expect(container.querySelector("li.role-item")).not.toBeNull();
    expect(container.querySelector('li[data-in-scale="true"]')).not.toBeNull();
    expect(container.querySelector('button.role-pill[data-chord-root="true"]')).not.toBeNull();
  });

  it("has no accessibility violations", async () => {
    // Rendered inside a <ul> — a NotePill is a list item by design.
    const { container } = render(
      <ul>
        <NotePill note="C" interval="R" ariaLabel="toggle C" onToggle={() => {}} />
      </ul>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders extra children after the interval", () => {
    render(
      <NotePill note="C" ariaLabel="toggle C">
        <span data-testid="resolve">→G</span>
      </NotePill>,
    );
    expect(screen.getByTestId("resolve")).toBeInTheDocument();
  });
});
