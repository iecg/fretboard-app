// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { axe } from "../../test-utils/a11y";

const sharedCSS = readFileSync(
  resolve(__dirname, "../shared/shared.module.css"),
  "utf-8",
);

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("ToggleBar/ToggleBar", () => {
  it("renders all option labels", () => {
    render(<ToggleBar options={options} value="a" onChange={vi.fn()} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
    expect(screen.getByText("Option C")).toBeInTheDocument();
  });

  it("calls onChange with correct value on click", () => {
    const onChange = vi.fn();
    render(<ToggleBar options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Option B"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("applies active class to the currently selected option", () => {
    render(<ToggleBar options={options} value="b" onChange={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).not.toHaveClass("active");
    expect(buttons[1]).toHaveClass("active");
    expect(buttons[2]).not.toHaveClass("active");
  });

  it("default variant applies toggle-group container class", () => {
    const { container } = render(
      <ToggleBar
        options={options}
        value="a"
        onChange={vi.fn()}
        variant="default"
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("toggle-group");
  });

  it("tabs variant applies mobile-tab-bar container class", () => {
    const { container } = render(
      <ToggleBar
        options={options}
        value="a"
        onChange={vi.fn()}
        variant="tabs"
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("mobile-tab-bar");
  });

  it("tabs variant applies mobile-tab class to buttons", () => {
    render(
      <ToggleBar
        options={options}
        value="a"
        onChange={vi.fn()}
        variant="tabs"
      />,
    );
    const tabs = screen.getAllByRole("tab");
    tabs.forEach((tab) => {
      expect(tab).toHaveClass("mobile-tab");
    });
  });

  it("default variant applies toggle-btn class to buttons", () => {
    render(
      <ToggleBar
        options={options}
        value="a"
        onChange={vi.fn()}
        variant="default"
      />,
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveClass("toggle-btn");
    });
  });

  it("shared toggle group keeps a 32px control height", () => {
    expect(sharedCSS).toMatch(/\.toggle-group\s*\{[^}]*height:\s*32px/s);
  });

  it("variant defaults to default when omitted", () => {
    const { container } = render(
      <ToggleBar options={options} value="a" onChange={vi.fn()} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("toggle-group");
    expect(wrapper).not.toHaveClass("mobile-tab-bar");
  });

  it("works with numeric values", () => {
    const numericOptions = [
      { value: 0, label: "All" },
      { value: 1, label: "1" },
      { value: 2, label: "2" },
    ];
    const onChange = vi.fn();
    render(
      <ToggleBar options={numericOptions} value={0} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText("1"));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  describe("overflow prop", () => {
    it("sets data-overflow='scroll' on the group div when overflow='scroll'", () => {
      const { container } = render(
        <ToggleBar options={options} value="a" onChange={vi.fn()} overflow="scroll" />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveAttribute("data-overflow", "scroll");
    });

    it("does not set data-overflow attribute when overflow prop is omitted", () => {
      const { container } = render(
        <ToggleBar options={options} value="a" onChange={vi.fn()} />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveAttribute("data-overflow");
    });
  });

  it("renders a disabled option as a disabled, non-clickable button", async () => {
    const onChange = vi.fn();
    render(
      <ToggleBar
        label="Inversion"
        value="root"
        onChange={onChange}
        options={[
          { value: "root", label: "Root" },
          { value: "3rd", label: "3rd", disabled: true },
        ]}
      />,
    );
    const thirdBtn = screen.getByRole("button", { name: "3rd" });
    expect(thirdBtn).toBeDisabled();
    await userEvent.click(thirdBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disabled option uses reduced opacity and not-allowed cursor", () => {
    render(
      <ToggleBar
        options={[{ value: "a", label: "A", disabled: true }]}
        value={undefined}
        onChange={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: "A" });
    expect(btn).toBeDisabled();
    // jsdom does not compute styles from CSS Modules. Verify the rule exists in
    // the source stylesheet — combined with the DOM-level disabled assertion,
    // this guarantees the rule fires in a real browser.
    expect(sharedCSS).toMatch(
      /\.toggle-btn:disabled[^{]*\{[^}]*cursor:\s*not-allowed/,
    );
    expect(sharedCSS).toMatch(
      /\.toggle-btn:disabled[^{]*\{[^}]*opacity:\s*var\(--disabled-opacity\)/,
    );
  });

  it.each([
    ["default", undefined],
    ["tabs", "tabs"],
    ["pip", "pip"],
  ] as const)("%s variant has no a11y violations", async (_label, variant) => {
    const { container } = render(
      <ToggleBar
        variant={variant}
        label="Display mode"
        options={[{ label: "A", value: "a" }, { label: "B", value: "b" }]}
        value="a"
        onChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders every option unpressed when value is undefined (Task 1)", () => {
    const onChange = vi.fn();
    render(
      <ToggleBar
        label="Cluster"
        value={undefined}
        onChange={onChange}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    for (const name of ["A", "B"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("disables every option button when top-level disabled=true", () => {
    const onChange = vi.fn();
    render(
      <ToggleBar
        value="a"
        onChange={onChange}
        options={options}
        disabled
      />,
    );
    for (const opt of options) {
      const btn = screen.getByRole("button", { name: opt.label });
      expect(btn).toBeDisabled();
    }
    fireEvent.click(screen.getByRole("button", { name: "Option B" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ToggleBar pip variant", () => {
  const opts = [
    { value: 0, label: "I" },
    { value: 1, label: "V" },
  ];

  it("renders a tablist with mono degree labels", () => {
    render(<ToggleBar variant="pip" options={opts} value={0} onChange={vi.fn()} label="nav" />);
    expect(screen.getByRole("tablist", { name: "nav" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the active pip with aria-selected", () => {
    render(<ToggleBar variant="pip" options={opts} value={1} onChange={vi.fn()} label="nav" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange with the selected value", () => {
    const onChange = vi.fn();
    render(<ToggleBar variant="pip" options={opts} value={0} onChange={onChange} label="nav" />);
    fireEvent.click(screen.getByText("V"));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
