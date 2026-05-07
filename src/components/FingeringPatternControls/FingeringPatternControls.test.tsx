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
  oneStringIntervalAtom,
  twoStringsPairAtom,
  twoStringsIntervalAtom,
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

  describe("fingering patterns", () => {
    it("renders exactly 5 fingering pattern options", () => {
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
      // Dropped patterns must not appear
      expect(screen.queryByText("Dbl Stops")).toBeNull();
      expect(screen.queryByText("2×4 Box")).toBeNull();
      expect(screen.queryByText("3×3 Box")).toBeNull();
      expect(screen.queryByText("Stack")).toBeNull();
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

    it('shows both Strings and Interval sub-controls when fingeringPattern === "two-strings"', () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "two-strings"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getByText("Strings")).toBeInTheDocument();
      expect(screen.getByText("Interval")).toBeInTheDocument();
    });

    it("interval sub-control has 4 options: Off, 3rds, 4ths, 6ths (5ths dropped — UAT-14/R05)", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "two-strings"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // "Off" appears in the interval sub-control (also in "None" for pattern bar but that's ok)
      expect(screen.getByRole("button", { name: "Off" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "3rds" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "4ths" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "6ths" })).toBeInTheDocument();
      // 5ths dropped; replaced by 6ths with skip-one topology
      expect(screen.queryByRole("button", { name: "5ths" })).toBeNull();
    });

    it("does not show 'Pair members connected' hint when interval is Off (0)", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "two-strings");
        store.set(twoStringsIntervalAtom, 0);
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.queryByText("Pair members connected")).toBeNull();
    });

    it("shows 'Pair members connected' hint when interval is non-Off", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "two-strings");
        store.set(twoStringsIntervalAtom, 1);
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getByText("Pair members connected")).toBeInTheDocument();
    });

    it("clicking interval button updates twoStringsIntervalAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "two-strings"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "6ths" }));
      expect(store.get(twoStringsIntervalAtom)).toBe(3);
    });

    it("pair toggle bar shows 5 buttons (adjacent) when interval is Off/3rds/4ths", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "two-strings");
        store.set(twoStringsIntervalAtom, 0); // Off
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // Adjacent pair buttons: 1-2, 2-3, 3-4, 4-5, 5-6
      expect(screen.getByRole("button", { name: "1-2" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "5-6" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "1-3" })).toBeNull();
    });

    it("pair toggle bar shows 4 buttons (skip-one) when interval is 6ths", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "two-strings");
        store.set(twoStringsIntervalAtom, 3); // 6ths
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // Skip-one pair buttons: 1-3, 2-4, 3-5, 4-6
      expect(screen.getByRole("button", { name: "1-3" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "4-6" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "1-2" })).toBeNull();
      expect(screen.queryByRole("button", { name: "5-6" })).toBeNull();
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

    it("1-String pattern renders an Interval ToggleBar with 4 buttons (Off / 3rds / 4ths / 6ths)", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getByText("Interval")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Off" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "3rds" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "4ths" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "6ths" })).toBeInTheDocument();
    });

    it("clicking interval button in one-string sub-control updates oneStringIntervalAtom", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "3rds" }));
      expect(store.get(oneStringIntervalAtom)).toBe(1);
    });

    it("clicking 6ths in one-string interval sub-control sets oneStringIntervalAtom to 3", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "6ths" }));
      expect(store.get(oneStringIntervalAtom)).toBe(3);
    });

    it("shows 'Pair members connected' hint in one-string when interval is non-Off", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "one-string");
        store.set(oneStringIntervalAtom, 1);
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getByText("Pair members connected")).toBeInTheDocument();
    });

    it("does not show 'Pair members connected' hint in one-string when interval is Off", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "one-string");
        store.set(oneStringIntervalAtom, 0);
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.queryByText("Pair members connected")).toBeNull();
    });
  });
});
