// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { createStore, Provider } from "jotai";
import { 
  fingeringPatternAtom, 
  cagedShapesAtom, 
  displayFormatAtom 
} from "../store/atoms";
import { type CagedShape } from "../shapes";

describe("FingeringPatternControls", () => {
  it("renders all fingering pattern options", () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.getByText("All")).toBeInTheDocument();
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
      store.set(fingeringPatternAtom, "all");
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
      store.set(fingeringPatternAtom, "all");
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
});
