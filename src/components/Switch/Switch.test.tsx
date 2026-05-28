import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("renders with role=switch and reflects the checked state", () => {
    render(<Switch checked={true} onChange={() => {}} label="Test switch" />);
    const sw = screen.getByRole("switch", { name: "Test switch" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("calls onChange with the inverse of checked when clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onChange={onChange} label="Test switch" />);
    await user.click(screen.getByRole("switch", { name: "Test switch" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles via Space key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onChange={onChange} label="Test switch" />);
    const sw = screen.getByRole("switch", { name: "Test switch" });
    await user.click(sw);
    sw.focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles via Enter key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={true} onChange={onChange} label="Test switch" />);
    const sw = screen.getByRole("switch", { name: "Test switch" });
    sw.focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not fire onChange when disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onChange={onChange} label="Test" disabled />);
    await user.click(screen.getByRole("switch"));
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
