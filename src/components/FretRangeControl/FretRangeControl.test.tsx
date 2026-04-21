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

    it("uses ◀/▶ symbols by default", () => {
      render(<FretRangeControl {...defaultProps} layout="toolbar" />);
      const buttons = screen.getAllByRole("button");
      const symbols = buttons.map((b) => b.textContent);
      expect(symbols.filter((s) => s === "◀").length).toBe(2);
      expect(symbols.filter((s) => s === "▶").length).toBe(2);
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

    it("uses −/+ symbols by default", () => {
      render(<FretRangeControl {...defaultProps} layout="mobile" />);
      const buttons = screen.getAllByRole("button");
      const symbols = buttons.map((b) => b.textContent);
      expect(symbols.filter((s) => s === "−").length).toBe(2);
      expect(symbols.filter((s) => s === "+").length).toBe(2);
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
      const decrementBtns = screen.getAllByText("◀");
      fireEvent.click(decrementBtns[0]);
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
      const incrementBtns = screen.getAllByText("▶");
      fireEvent.click(incrementBtns[0]);
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
      const decrementBtns = screen.getAllByText("◀");
      fireEvent.click(decrementBtns[1]);
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
      const incrementBtns = screen.getAllByText("▶");
      fireEvent.click(incrementBtns[1]);
      expect(onEndChange).toHaveBeenCalledWith(13);
    });
  });

  describe("Disabled states", () => {
    it("start decrement disabled when startFret === 0", () => {
      render(
        <FretRangeControl {...defaultProps} startFret={0} layout="toolbar" />,
      );
      const decrementBtns = screen.getAllByText("◀");
      expect(decrementBtns[0]).toBeDisabled();
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
      const incrementBtns = screen.getAllByText("▶");
      expect(incrementBtns[0]).toBeDisabled();
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
      const decrementBtns = screen.getAllByText("◀");
      expect(decrementBtns[1]).toBeDisabled();
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
      const incrementBtns = screen.getAllByText("▶");
      expect(incrementBtns[1]).toBeDisabled();
    });
  });

  describe("Dashboard layout", () => {
    it("renders with Start/End labels", () => {
      render(<FretRangeControl {...defaultProps} layout="dashboard" />);
      expect(screen.getByText("Start")).toBeTruthy();
      expect(screen.getByText("End")).toBeTruthy();
    });

    it('shows "—" separator', () => {
      render(<FretRangeControl {...defaultProps} layout="dashboard" />);
      expect(screen.getByText("—")).toBeTruthy();
    });

    it("uses −/+ symbols by default", () => {
      render(<FretRangeControl {...defaultProps} layout="dashboard" />);
      const buttons = screen.getAllByRole("button");
      const symbols = buttons.map((b) => b.textContent);
      expect(symbols.filter((s) => s === "−").length).toBe(2);
      expect(symbols.filter((s) => s === "+").length).toBe(2);
    });
  });

  describe("Custom symbols", () => {
    it("overrides decrement and increment symbols via props", () => {
      render(
        <FretRangeControl
          {...defaultProps}
          layout="toolbar"
          decrementSymbol="<"
          incrementSymbol=">"
        />,
      );
      expect(screen.getAllByText("<").length).toBe(2);
      expect(screen.getAllByText(">").length).toBe(2);
    });
  });
});
