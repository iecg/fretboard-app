// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { createStore, Provider } from "jotai";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  displayFormatAtom,
  oneStringIndexAtom,
  doubleStopsIntervalAtom,
  box2x4StartFretAtom,
  box2x4PairAtom,
  box3x3StartFretAtom,
  box3x3TrioAtom,
  stackStartFretAtom,
  twoStringsPairAtom,
} from "../../store/atoms";
import { type CagedShape } from "../../shapes";
import { axe } from "../../test-utils/a11y";

describe("FingeringPatternControls/FingeringPatternControls", () => {
  it("renders all fingering pattern options", () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.getAllByText("None").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CAGED")).toBeInTheDocument();
    expect(screen.getByText("3NPS")).toBeInTheDocument();
  });

  it("updates fingering pattern on button click", () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    fireEvent.click(screen.getByText("CAGED"));
    expect(store.get(fingeringPatternAtom)).toBe("caged");
  });

  it('shows Shape section only when fingeringPattern === "caged"', () => {
    const store = createStore();
    const { rerender } = render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );

    act(() => {
      store.set(fingeringPatternAtom, "caged");
    });
    rerender(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.getAllByText("Shape").length).toBeGreaterThan(0);

    act(() => {
      store.set(fingeringPatternAtom, "none");
    });
    rerender(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.queryAllByText("Shape")).toHaveLength(0);
  });

  it('shows Position section only when fingeringPattern === "3nps"', () => {
    const store = createStore();
    const { rerender } = render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );

    act(() => {
      store.set(fingeringPatternAtom, "3nps");
    });
    rerender(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.getByText("Position")).toBeInTheDocument();

    act(() => {
      store.set(fingeringPatternAtom, "none");
    });
    rerender(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.queryByText("Position")).toBeNull();
  });

  it("handles shift-click multi-select for CAGED shapes", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "caged");
      store.set(cagedShapesAtom, new Set<CagedShape>(["C"]));
    });

    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );

    const aButton = screen.getByText("A");
    fireEvent.click(aButton, { shiftKey: true });

    const result = store.get(cagedShapesAtom);
    expect(result.has("C")).toBe(true);
    expect(result.has("A")).toBe(true);
  });

  it("updates display format when Intervals button clicked", () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    fireEvent.click(screen.getByText("Intervals"));
    expect(store.get(displayFormatAtom)).toBe("degrees");
  });

  describe("new fingering patterns", () => {
    it("renders all 9 fingering pattern options", () => {
      const store = createStore();
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getAllByText("None").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("CAGED")).toBeInTheDocument();
      expect(screen.getByText("3NPS")).toBeInTheDocument();
      expect(screen.getByText("1-String")).toBeInTheDocument();
      expect(screen.getByText("2-Strings")).toBeInTheDocument();
      expect(screen.getByText("Dbl Stops")).toBeInTheDocument();
      expect(screen.getByText("2×4 Box")).toBeInTheDocument();
      expect(screen.getByText("3×3 Box")).toBeInTheDocument();
      expect(screen.getByText("Stack")).toBeInTheDocument();
    });

    it('shows String section only when fingeringPattern === "one-string"', () => {
      const store = createStore();
      const { rerender } = render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      rerender(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getByText("String")).toBeInTheDocument();
      // Switching away hides it
      act(() => { store.set(fingeringPatternAtom, "none"); });
      rerender(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.queryByText("String")).toBeNull();
    });

    it('shows interval options when fingeringPattern === "double-stops"', () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "double-stops"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getByText("Interval")).toBeInTheDocument();
      expect(screen.getByText("3rds")).toBeInTheDocument();
      expect(screen.getByText("4ths")).toBeInTheDocument();
      expect(screen.getByText("5ths")).toBeInTheDocument();
      expect(screen.getByText("6ths")).toBeInTheDocument();
    });

    it('shows Start Fret and Strings controls for "box-2x4"', () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "box-2x4"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getAllByText("Start Fret").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Strings")).toBeInTheDocument();
    });

    it('shows only Start Fret for "stack" pattern', () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "stack"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getAllByText("Start Fret").length).toBeGreaterThanOrEqual(1);
      // No Strings label for stack
      expect(screen.queryByText("Strings")).toBeNull();
    });

    it("clicking 1-String sets fingeringPattern to one-string", () => {
      const store = createStore();
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByText("1-String"));
      expect(store.get(fingeringPatternAtom)).toBe("one-string");
    });

    it("clicking string button in one-string sub-control updates oneStringIndexAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // String buttons are labelled 1-6; default is 0 (string 1). Click "3" to set index 2.
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      expect(store.get(oneStringIndexAtom)).toBe(2);
    });

    it("clicking pair button in two-strings sub-control updates twoStringsPairAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "two-strings"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "3-4" }));
      expect(store.get(twoStringsPairAtom)).toBe(2);
    });

    it("clicking interval button in double-stops sub-control updates doubleStopsIntervalAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "double-stops"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "5ths" }));
      expect(store.get(doubleStopsIntervalAtom)).toBe(2);
    });

    it("clicking pair button in box-2x4 sub-control updates box2x4PairAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "box-2x4"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "4-5" }));
      expect(store.get(box2x4PairAtom)).toBe(3);
    });

    it("clicking trio button in box-3x3 sub-control updates box3x3TrioAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "box-3x3"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "2-4" }));
      expect(store.get(box3x3TrioAtom)).toBe(1);
    });

    it("stepper increment in box-2x4 updates box2x4StartFretAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "box-2x4"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // There are two steppers shown (one for Start Fret label, one inside StepperControl)
      // Click the increase button (aria-label contains "Increase")
      const increaseBtn = screen.getAllByRole("button", { name: /increase/i })[0];
      fireEvent.click(increaseBtn);
      expect(store.get(box2x4StartFretAtom)).toBe(1);
    });

    it("stepper increment in box-3x3 updates box3x3StartFretAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "box-3x3"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      const increaseBtn = screen.getAllByRole("button", { name: /increase/i })[0];
      fireEvent.click(increaseBtn);
      expect(store.get(box3x3StartFretAtom)).toBe(1);
    });

    it("stepper increment in stack updates stackStartFretAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "stack"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      const increaseBtn = screen.getByRole("button", { name: /increase/i });
      fireEvent.click(increaseBtn);
      expect(store.get(stackStartFretAtom)).toBe(1);
    });

    it("has no axe violations with one-string pattern active", async () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      const { container } = render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
