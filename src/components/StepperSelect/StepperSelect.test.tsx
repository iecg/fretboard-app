// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepperSelect } from "./StepperSelect";

const DEFAULT_PROPS = {
  value: "Option A",
  options: [
    { value: "Option A", label: "Option A" },
    { value: "Option B", label: "Option B" },
  ],
  onChange: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  selectLabel: "Test Select",
  groupLabel: "Browse test options",
  previousLabel: "Previous option",
  nextLabel: "Next option",
};

describe("StepperSelect/StepperSelect", () => {
  describe("default rendering", () => {
    it("renders the group with the correct aria-label", () => {
      render(<StepperSelect {...DEFAULT_PROPS} />);
      expect(screen.getByRole("group", { name: "Browse test options" })).toBeInTheDocument();
    });

    it("renders previous and next buttons with correct aria-labels", () => {
      render(<StepperSelect {...DEFAULT_PROPS} />);
      expect(screen.getByRole("button", { name: "Previous option" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next option" })).toBeInTheDocument();
    });

    it("renders the select with the correct label", () => {
      render(<StepperSelect {...DEFAULT_PROPS} />);
      expect(screen.getByRole("combobox", { name: "Test Select" })).toBeInTheDocument();
    });

    it("does NOT set data-compact when compact is omitted", () => {
      render(<StepperSelect {...DEFAULT_PROPS} />);
      const group = screen.getByRole("group", { name: "Browse test options" });
      expect(group).not.toHaveAttribute("data-compact");
    });

    it("does NOT set data-compact when compact is false", () => {
      render(<StepperSelect {...DEFAULT_PROPS} compact={false} />);
      const group = screen.getByRole("group", { name: "Browse test options" });
      expect(group).not.toHaveAttribute("data-compact");
    });
  });

  describe("compact prop", () => {
    it("sets data-compact='true' on the root element when compact is true", () => {
      render(<StepperSelect {...DEFAULT_PROPS} compact />);
      const group = screen.getByRole("group", { name: "Browse test options" });
      expect(group).toHaveAttribute("data-compact", "true");
    });

    it("removes data-compact when compact is false", () => {
      render(<StepperSelect {...DEFAULT_PROPS} compact={false} />);
      const group = screen.getByRole("group", { name: "Browse test options" });
      expect(group).not.toHaveAttribute("data-compact");
    });
  });

  describe("disabled state", () => {
    it("disables both nav buttons when disabled=true", () => {
      render(<StepperSelect {...DEFAULT_PROPS} disabled />);
      expect(screen.getByRole("button", { name: "Previous option" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next option" })).toBeDisabled();
    });

    it("disables only previous button when previousDisabled=true", () => {
      render(<StepperSelect {...DEFAULT_PROPS} previousDisabled />);
      expect(screen.getByRole("button", { name: "Previous option" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next option" })).not.toBeDisabled();
    });

    it("disables only next button when nextDisabled=true", () => {
      render(<StepperSelect {...DEFAULT_PROPS} nextDisabled />);
      expect(screen.getByRole("button", { name: "Previous option" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Next option" })).toBeDisabled();
    });
  });
});
