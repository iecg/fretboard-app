// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";

const defaultProps = {
  startFret: 3,
  endFret: 12,
  onStartChange: vi.fn(),
  onEndChange: vi.fn(),
  maxFret: 24,
};

function getStartButtons() {
  return {
    decrement: screen.getByLabelText(/Decrease start fret/),
    increment: screen.getByLabelText(/Increase start fret/),
  };
}

function getEndButtons() {
  return {
    decrement: screen.getByLabelText(/Decrease end fret/),
    increment: screen.getByLabelText(/Increase end fret/),
  };
}

describe("FretRangeControl/FretRangeControl", () => {
  describe("Toolbar layout", () => {
    it("renders inline without Start/End labels", () => {
      render(<FretRangeControl {...defaultProps} layout="toolbar" />);
      expect(screen.queryByText("Start")).toBeNull();
      expect(screen.queryByText("End")).toBeNull();
    });

    it('shows "—" separator', () => {
      render(<FretRangeControl {...defaultProps} layout="toolbar" />);
      expect(screen.getByText("—")).toBeTruthy();
    });

    it("renders four stepper buttons (start ±, end ±)", () => {
      render(<FretRangeControl {...defaultProps} layout="toolbar" />);
      expect(getStartButtons().decrement).toBeInTheDocument();
      expect(getStartButtons().increment).toBeInTheDocument();
      expect(getEndButtons().decrement).toBeInTheDocument();
      expect(getEndButtons().increment).toBeInTheDocument();
    });
  });

  describe("Mobile layout", () => {
    it("renders stacked with Start/End labels", () => {
      render(<FretRangeControl {...defaultProps} layout="mobile" />);
      expect(screen.getByText("Start")).toBeTruthy();
      expect(screen.getByText("End")).toBeTruthy();
    });

    it("does not show separator", () => {
      render(<FretRangeControl {...defaultProps} layout="mobile" />);
      expect(screen.queryByText("—")).toBeNull();
    });
  });

  describe("Start fret callbacks", () => {
    it("calls onStartChange with max(0, startFret - 1) on decrement", () => {
      const onStartChange = vi.fn();
      render(
        <FretRangeControl
          {...defaultProps}
          startFret={3}
          onStartChange={onStartChange}
          layout="toolbar"
        />,
      );
      fireEvent.click(getStartButtons().decrement);
      expect(onStartChange).toHaveBeenCalledWith(2);
    });

    it("calls onStartChange with min(endFret - 1, startFret + 1) on increment", () => {
      const onStartChange = vi.fn();
      render(
        <FretRangeControl
          {...defaultProps}
          startFret={3}
          endFret={12}
          onStartChange={onStartChange}
          layout="toolbar"
        />,
      );
      fireEvent.click(getStartButtons().increment);
      expect(onStartChange).toHaveBeenCalledWith(4);
    });
  });

  describe("End fret callbacks", () => {
    it("calls onEndChange with max(startFret + 1, endFret - 1) on decrement", () => {
      const onEndChange = vi.fn();
      render(
        <FretRangeControl
          {...defaultProps}
          startFret={3}
          endFret={12}
          onEndChange={onEndChange}
          layout="toolbar"
        />,
      );
      fireEvent.click(getEndButtons().decrement);
      expect(onEndChange).toHaveBeenCalledWith(11);
    });

    it("calls onEndChange with min(maxFret, endFret + 1) on increment", () => {
      const onEndChange = vi.fn();
      render(
        <FretRangeControl
          {...defaultProps}
          startFret={3}
          endFret={12}
          maxFret={24}
          onEndChange={onEndChange}
          layout="toolbar"
        />,
      );
      fireEvent.click(getEndButtons().increment);
      expect(onEndChange).toHaveBeenCalledWith(13);
    });
  });

  describe("Disabled states", () => {
    it("start decrement disabled when startFret === 0", () => {
      render(
        <FretRangeControl {...defaultProps} startFret={0} layout="toolbar" />,
      );
      expect(getStartButtons().decrement).toBeDisabled();
    });

    it("start increment disabled when startFret === endFret - 1", () => {
      render(
        <FretRangeControl
          {...defaultProps}
          startFret={11}
          endFret={12}
          layout="toolbar"
        />,
      );
      expect(getStartButtons().increment).toBeDisabled();
    });

    it("end decrement disabled when endFret === startFret + 1", () => {
      render(
        <FretRangeControl
          {...defaultProps}
          startFret={3}
          endFret={4}
          layout="toolbar"
        />,
      );
      expect(getEndButtons().decrement).toBeDisabled();
    });

    it("end increment disabled when endFret === maxFret", () => {
      render(
        <FretRangeControl
          {...defaultProps}
          endFret={24}
          maxFret={24}
          layout="toolbar"
        />,
      );
      expect(getEndButtons().increment).toBeDisabled();
    });
  });

  describe("Dashboard layout", () => {
    it("renders with Start/End labels", () => {
      render(<FretRangeControl {...defaultProps} layout="dashboard" />);
      expect(screen.getByText("Start")).toBeTruthy();
      expect(screen.getByText("End")).toBeTruthy();
    });

    it("does not show separator (labels stack above steppers)", () => {
      render(<FretRangeControl {...defaultProps} layout="dashboard" />);
      expect(screen.queryByText("—")).toBeNull();
    });

    it("renders four stepper buttons", () => {
      render(<FretRangeControl {...defaultProps} layout="dashboard" />);
      expect(getStartButtons().decrement).toBeInTheDocument();
      expect(getStartButtons().increment).toBeInTheDocument();
      expect(getEndButtons().decrement).toBeInTheDocument();
      expect(getEndButtons().increment).toBeInTheDocument();
    });
  });
});
