// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { createStore, Provider } from "jotai";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { fingeringPatternAtom, cagedShapesAtom, oneStringIndexAtom, oneStringIntervalAtom, twoStringsPairAtom, twoStringsIntervalAtom } from "../../store/fingeringAtoms";
import { type CagedShape } from "@fretflow/core";
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

  it('shows 3NPS Position sub-control only when fingeringPattern === "3nps"', () => {
    const store = createStore();
    const { rerender } = render(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );

    // "Position" cluster label is always present after Task 5 refactor.
    // The 3NPS sub-control adds a Position ToggleBar (1-7 positions); verify it
    // by checking for the "7" button which only appears in that sub-control.
    act(() => {
      store.set(fingeringPatternAtom, "3nps");
    });
    rerender(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.getByRole("button", { name: "7" })).toBeInTheDocument();

    act(() => {
      store.set(fingeringPatternAtom, "none");
    });
    rerender(
      <Provider store={store}>
        <FingeringPatternControls />
      </Provider>
    );
    expect(screen.queryByRole("button", { name: "7" })).toBeNull();
  });

  it("renders Position and String study clusters (Task 5)", () => {
    renderWithAtoms(<FingeringPatternControls />);
    // ToggleBar applies the label as role="group" aria-label
    expect(screen.getByRole("group", { name: /^position$/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /string study/i })).toBeInTheDocument();
  });

  it("selecting Position clears String study selection (Task 5)", () => {
    renderWithAtoms(<FingeringPatternControls />, [[fingeringPatternAtom, "one-string"]]);
    // 1-String is initially pressed
    const oneString = screen.getByRole("button", { name: /^1-String$/ });
    expect(oneString).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /^CAGED$/ }));

    // CAGED becomes pressed; 1-String unpresses
    expect(screen.getByRole("button", { name: /^CAGED$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^1-String$/ })).toHaveAttribute("aria-pressed", "false");
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
      // "String" appears as both a Prop label and the LabeledSelect's hidden label span.
      expect(screen.getAllByText("String").length).toBeGreaterThanOrEqual(1);
      // Switching away hides both
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

    it("one-string string chooser is a LabeledSelect (combobox) defaulting to String 1", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // String chooser is now a LabeledSelect (combobox), not individual buttons.
      // Default index 0 → selected label "String 1".
      const combobox = screen.getByRole("combobox", { name: /^String$/i });
      expect(combobox).toHaveTextContent("String 1");
    });

    it("two-strings pair chooser is a LabeledSelect (combobox) defaulting to Strings 1-2", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "two-strings"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // Pair chooser is now a LabeledSelect (combobox), not individual buttons.
      // Default pair 0 → selected label "Strings 1-2".
      const combobox = screen.getByRole("combobox", { name: /^Strings$/i });
      expect(combobox).toHaveTextContent("Strings 1-2");
    });

    it('shows both Strings and Interval sub-controls when fingeringPattern === "two-strings"', () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "two-strings"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // "Strings" appears as both a Prop label and the LabeledSelect's hidden label span,
      // so use getAllByText and assert at least one is in the document.
      expect(screen.getAllByText("Strings").length).toBeGreaterThanOrEqual(1);
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

    it("pair select shows 'Strings 1-2' as default when interval is Off (adjacent topology)", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "two-strings");
        store.set(twoStringsIntervalAtom, 0); // Off → adjacent pairs
        store.set(twoStringsPairAtom, 0);
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // Pair chooser is now a LabeledSelect; default pair 0 → "Strings 1-2"
      const combobox = screen.getByRole("combobox", { name: /^Strings$/i });
      expect(combobox).toHaveTextContent("Strings 1-2");
    });

    it("pair select shows 'Strings 1-3' when interval is 6ths (skip-one topology)", () => {
      const store = createStore();
      act(() => {
        store.set(fingeringPatternAtom, "two-strings");
        store.set(twoStringsIntervalAtom, 3); // 6ths → skip-one
        store.set(twoStringsPairAtom, 0);
      });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      // Skip-one topology: pair 0 → "Strings 1-3"
      const combobox = screen.getByRole("combobox", { name: /^Strings$/i });
      expect(combobox).toHaveTextContent("Strings 1-3");
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

    it("1-String pattern renders a Connectors ToggleBar with 2 buttons (Off / On)", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      expect(screen.getByText("Connectors")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Off" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "On" })).toBeInTheDocument();
      // Old per-class buttons must be gone
      expect(screen.queryByRole("button", { name: "3rds" })).toBeNull();
      expect(screen.queryByRole("button", { name: "4ths" })).toBeNull();
      expect(screen.queryByRole("button", { name: "6ths" })).toBeNull();
    });

    it("clicking On in one-string Connectors toggle updates oneStringIntervalAtom to 1", () => {
      const store = createStore();
      act(() => { store.set(fingeringPatternAtom, "one-string"); });
      render(
        <Provider store={store}>
          <FingeringPatternControls />
        </Provider>
      );
      fireEvent.click(screen.getByRole("button", { name: "On" }));
      expect(store.get(oneStringIntervalAtom)).toBe(1);
    });

    it("clicking Off in one-string Connectors toggle updates oneStringIntervalAtom to 0", () => {
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
      fireEvent.click(screen.getByRole("button", { name: "Off" }));
      expect(store.get(oneStringIntervalAtom)).toBe(0);
    });

    it("shows connector hint in one-string when interval is On", () => {
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
      expect(screen.getByText("Shows consecutive scale steps (2nds)")).toBeInTheDocument();
    });

    it("does not show connector hint in one-string when interval is Off", () => {
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
      expect(screen.queryByText("Shows consecutive scale steps (2nds)")).toBeNull();
    });

    describe("Task 6.4 — LabeledSelect string-set UX", () => {
      it("one-string: string chooser is a LabeledSelect (combobox role) with options String 1–6", () => {
        const store = createStore();
        act(() => { store.set(fingeringPatternAtom, "one-string"); });
        render(
          <Provider store={store}>
            <FingeringPatternControls />
          </Provider>
        );
        // The Radix Select trigger has role="combobox"
        const combobox = screen.getByRole("combobox", { name: /^String$/i });
        expect(combobox).toBeInTheDocument();
        // The options are labelled "String 1" through "String 6" (in the Radix portal)
        // They are available as options in the listbox when the select is opened
        // We can verify via aria: the selected value text should show "String 1" by default
        expect(combobox).toHaveTextContent("String 1");
      });

      it("one-string: selecting a different option updates oneStringIndexAtom", async () => {
        const store = createStore();
        act(() => {
          store.set(fingeringPatternAtom, "one-string");
          store.set(oneStringIndexAtom, 0);
        });
        render(
          <Provider store={store}>
            <FingeringPatternControls />
          </Provider>
        );
        // Open the Radix Select portal and click "String 3" (index 2)
        await userEvent.click(screen.getByRole("combobox", { name: /^String$/i }));
        await userEvent.click(screen.getByRole("option", { name: "String 3" }));
        expect(store.get(oneStringIndexAtom)).toBe(2);
      });

      it("two-strings: pair chooser is a LabeledSelect (combobox role) with options Strings 1-2 etc.", () => {
        const store = createStore();
        act(() => {
          store.set(fingeringPatternAtom, "two-strings");
          store.set(twoStringsIntervalAtom, 0); // adjacent topology → "Strings N-(N+1)"
          store.set(twoStringsPairAtom, 0);
        });
        render(
          <Provider store={store}>
            <FingeringPatternControls />
          </Provider>
        );
        const combobox = screen.getByRole("combobox", { name: /^Strings$/i });
        expect(combobox).toBeInTheDocument();
        // Pair 0 with adjacent topology → "Strings 1-2"
        expect(combobox).toHaveTextContent("Strings 1-2");
      });

      it("two-strings skip-one (6ths): pair chooser shows skip-one options (Strings 1-3 etc.)", () => {
        const store = createStore();
        act(() => {
          store.set(fingeringPatternAtom, "two-strings");
          store.set(twoStringsIntervalAtom, 3); // 6ths → skip-one
          store.set(twoStringsPairAtom, 0);
        });
        render(
          <Provider store={store}>
            <FingeringPatternControls />
          </Provider>
        );
        const combobox = screen.getByRole("combobox", { name: /^Strings$/i });
        expect(combobox).toBeInTheDocument();
        // Default pair 0 → "Strings 1-3" for skip-one topology
        expect(combobox).toHaveTextContent("Strings 1-3");
      });

      it("two-strings: selecting a different pair option updates twoStringsPairAtom", async () => {
        const store = createStore();
        act(() => {
          store.set(fingeringPatternAtom, "two-strings");
          store.set(twoStringsIntervalAtom, 0); // adjacent topology
          store.set(twoStringsPairAtom, 0);
        });
        render(
          <Provider store={store}>
            <FingeringPatternControls />
          </Provider>
        );
        // Open the Radix Select portal and click "Strings 3-4" (pair index 2)
        await userEvent.click(screen.getByRole("combobox", { name: /^Strings$/i }));
        await userEvent.click(screen.getByRole("option", { name: "Strings 3-4" }));
        expect(store.get(twoStringsPairAtom)).toBe(2);
      });
    });
  });
});
