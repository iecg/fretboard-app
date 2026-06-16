// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepperControl } from "../StepperControl/StepperControl";
import { axe } from "../../test-utils/a11y";

describe("StepperControl/StepperControl", () => {
  it("renders label when provided", () => {
    render(
      <StepperControl
        value={5}
        onChange={vi.fn()}
        min={0}
        max={10}
        label="Zoom"
      />,
    );
    expect(screen.getByText("Zoom")).toBeTruthy();
  });

  it("omits label span when label not provided", () => {
    const { container } = render(
      <StepperControl value={5} onChange={vi.fn()} min={0} max={10} />,
    );
    expect(container.querySelector(".section-label")).toBeNull();
  });

  it("uses formatValue for display and passes the current value", () => {
    const formatValue = vi.fn((z: number) => (z <= 100 ? "Auto" : `${z}%`));
    render(
      <StepperControl
        value={100}
        onChange={vi.fn()}
        min={100}
        max={300}
        formatValue={formatValue}
      />,
    );

    expect(formatValue).toHaveBeenCalledWith(100);
    expect(screen.getByText("Auto")).toBeTruthy();
  });

  it("decrement button calls onChange with value minus step", () => {
    const onChange = vi.fn();
    render(
      <StepperControl
        value={5}
        onChange={onChange}
        min={0}
        max={10}
        step={2}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /decrease/i }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("decrement button clamps to min", () => {
    const onChange = vi.fn();
    render(
      <StepperControl
        value={1}
        onChange={onChange}
        min={0}
        max={10}
        step={5}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /decrease/i }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("increment button calls onChange with value plus step", () => {
    const onChange = vi.fn();
    render(
      <StepperControl
        value={5}
        onChange={onChange}
        min={0}
        max={10}
        step={2}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("increment button clamps to max", () => {
    const onChange = vi.fn();
    render(
      <StepperControl
        value={9}
        onChange={onChange}
        min={0}
        max={10}
        step={5}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("decrement button disabled when value equals min", () => {
    render(<StepperControl value={0} onChange={vi.fn()} min={0} max={10} />);
    const decrementBtn = screen.getByRole("button", { name: /decrease/i });
    expect(decrementBtn).toBeDisabled();
  });

  it("increment button disabled when value equals max", () => {
    render(<StepperControl value={10} onChange={vi.fn()} min={0} max={10} />);
    const incrementBtn = screen.getByRole("button", { name: /increase/i });
    expect(incrementBtn).toBeDisabled();
  });

  it("mobile variant applies mobile class to container", () => {
    const { container } = render(
      <StepperControl
        value={5}
        onChange={vi.fn()}
        min={0}
        max={10}
        buttonVariant="mobile"
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("stepper-control");
    expect(wrapper.className).toContain("mobile");
  });

  it("does not set data-compact attribute (compact density is the default)", () => {
    const { container } = render(
      <StepperControl value={5} onChange={vi.fn()} min={0} max={10} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveAttribute("data-compact");
  });

  it("default step is 1 when not provided", () => {
    const onChange = vi.fn();
    render(<StepperControl value={5} onChange={onChange} min={0} max={10} />);
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("disables both inc/dec buttons when disabled=true (overriding bounds)", () => {
    const onChange = vi.fn();
    render(
      <StepperControl
        label="Tempo"
        value={5}
        min={0}
        max={10}
        onChange={onChange}
        disabled
      />,
    );
    const dec = screen.getByRole("button", { name: /decrease tempo/i });
    const inc = screen.getByRole("button", { name: /increase tempo/i });
    expect(dec).toBeDisabled();
    expect(inc).toBeDisabled();
    fireEvent.click(inc);
    fireEvent.click(dec);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <StepperControl label="Fret count" value={5} min={1} max={24} onChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("StepperControl groupId", () => {
  it("renders the group element with the given id and tabIndex=-1", () => {
    const { container } = render(
      <StepperControl
        value={100}
        onChange={() => {}}
        min={40}
        max={240}
        groupId="test-stepper"
        label="Tempo"
      />,
    );

    const group = container.querySelector("#test-stepper");
    expect(group).not.toBeNull();
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("tabindex")).toBe("-1");
  });

  it("does not set a tabIndex when no groupId is given", () => {
    const { container } = render(
      <StepperControl value={100} onChange={() => {}} min={40} max={240} label="Tempo" />,
    );

    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute("tabindex")).toBeNull();
  });
});
