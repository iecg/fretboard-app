import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("renders with role=switch and reflects the checked state", () => {
    render(<Switch checked={true} onChange={() => {}} label="Test switch" />);
    const sw = screen.getByRole("switch", { name: "Test switch" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("calls onChange with the inverse of checked when clicked", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Test switch" />);
    fireEvent.click(screen.getByRole("switch", { name: "Test switch" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles via Space key", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Test switch" />);
    const sw = screen.getByRole("switch", { name: "Test switch" });
    sw.focus();
    fireEvent.keyDown(sw, { key: " ", code: "Space" });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles via Enter key", () => {
    const onChange = vi.fn();
    render(<Switch checked={true} onChange={onChange} label="Test switch" />);
    const sw = screen.getByRole("switch", { name: "Test switch" });
    sw.focus();
    fireEvent.keyDown(sw, { key: "Enter", code: "Enter" });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("ignores key repeat events to prevent rapid-fire toggles", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Test switch" />);
    const sw = screen.getByRole("switch", { name: "Test switch" });
    sw.focus();
    fireEvent.keyDown(sw, { key: " ", code: "Space", repeat: true });
    fireEvent.keyDown(sw, { key: "Enter", code: "Enter", repeat: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not fire onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Test" disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies the warm tone via data-tone", () => {
    render(<Switch checked={true} onChange={() => {}} label="Test" tone="warm" />);
    expect(screen.getByRole("switch").getAttribute("data-tone")).toBe("warm");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Switch checked={false} onChange={() => {}} label="Test switch" />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
