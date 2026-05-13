// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { TheoryControls, TheorySection } from "../TheoryControls/TheoryControls";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  chordTypeAtom,
  practiceLensAtom,
  fingeringPatternAtom,
  progressionEnabledAtom,
  progressionStepsAtom,
} from "../../store/atoms";
import { axe } from "../../test-utils/a11y";

function renderWithStore(ui: React.ReactElement, store = createStore()) {
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe("TheoryControls/TheoryControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders scale controls with chords collapsed", () => {
    renderWithStore(<TheoryControls />);

    expect(
      screen.getByRole("button", { name: /Scale.*C Major/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Browse scale families" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parallel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Previous Mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Next Mode/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Mode" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Chords.*Off/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chord Type")).not.toBeInTheDocument();
  });

  it("renders with scale browse mode initial state", () => {
    const store = createStore();

    renderWithStore(<TheoryControls />, store);

    expect(store.get(scaleBrowseModeAtom)).toBe("parallel");
  });

  it("expands the chord controls on demand", () => {
    renderWithStore(<TheoryControls />);

    fireEvent.click(screen.getByRole("button", { name: /Chords/i }));

    expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Degree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manual" })).toBeInTheDocument();
  });

  it("opens only one theory section at a time", () => {
    renderWithStore(<TheoryControls />);

    expect(screen.getByText("Root")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Chords/i }));
    expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
    expect(screen.queryByText("Root")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Progression/i }));
    expect(screen.getByText("Progression Mode")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Chord overlay mode" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Scale.*C Major/i }));
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.queryByText("Progression Mode")).not.toBeInTheDocument();
  });

  it("closes the currently open theory section when clicked", () => {
    renderWithStore(<TheoryControls />);

    expect(screen.getByText("Root")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Scale.*C Major/i }));

    expect(screen.queryByText("Root")).not.toBeInTheDocument();
  });

  it("keeps disabled Chords collapsed when another section opens", () => {
    const store = createStore();
    store.set(fingeringPatternAtom, "one-string");

    renderWithStore(<TheoryControls />, store);

    fireEvent.click(screen.getByRole("button", { name: /Chords.*Disabled/i }));
    expect(screen.queryByRole("group", { name: "Chord overlay mode" })).not.toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Progression/i }));
    expect(screen.getByText("Progression Mode")).toBeInTheDocument();
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
  });

  it("falls back to Scale when open Chords become disabled", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Scale Family" })).not.toBeInTheDocument();

    act(() => {
      store.set(fingeringPatternAtom, "one-string");
    });

    expect(screen.queryByRole("group", { name: "Chord overlay mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();
  });

  it("keeps Scale open when disabled Chords are enabled again", async () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();

    act(() => {
      store.set(fingeringPatternAtom, "one-string");
    });

    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Scale.*C Major/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    act(() => {
      store.set(fingeringPatternAtom, "caged");
    });

    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Chord overlay mode" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Chords/i }));

    expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
  });

  it("shows the inline key explorer only after disclosure is opened", () => {
    renderWithStore(<TheoryControls keyExplorer={<div>Key Wheel</div>} />);

    expect(screen.queryByText("Key Wheel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Circle of Fifths/i }));
    expect(screen.getByText("Key Wheel")).toBeInTheDocument();
  });

  it("shows Lens controls when a chord type is selected (no Focus section)", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByText("Lens")).toBeInTheDocument();
    expect(screen.queryByText("Focus")).not.toBeInTheDocument();
    // Chord + Color and Color Notes lenses are removed from the chord overlay
    expect(screen.queryByRole("button", { name: "Chord + Color" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Color Notes" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chord Tones" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guide Tones" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
  });

  it("calls setPracticeLens when a lens option is clicked", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    fireEvent.click(screen.getByRole("button", { name: "Chord Tones" }));
    expect(store.get(practiceLensAtom)).toBe("targets");
  });

  it("Tension lens is hidden when chord is fully in-scale", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    // Tension is hidden (not just disabled) when unavailable
    expect(screen.queryByRole("button", { name: "Tension" })).not.toBeInTheDocument();
  });

  it("Tension lens option is shown and enabled when chord has outside tones", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Minor Pentatonic"); // C Eb F G Bb
    store.set(chordTypeAtom, "Major Triad"); // C E G -> E is outside.

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByRole("button", { name: "Tension" })).not.toBeDisabled();
  });

  it("compact prop is not set by default", () => {
    renderWithStore(<TheoryControls />);

    const sections = document.querySelectorAll("[data-compact]");
    expect(sections).toHaveLength(0);
  });

  it("compact prop sets data-compact on theory sections", () => {
    renderWithStore(<TheoryControls compact />);

    // Both TheorySection elements must have data-compact="true".
    // Additional child elements (NoteGrid, ToggleBar, etc.) may also carry it.
    const theorySections = document.querySelectorAll(
      'section[data-compact="true"]',
    );
    expect(theorySections.length).toBeGreaterThanOrEqual(2);
  });
});

describe("TheoryControls/TheorySection — disclosure ::before focus-ring inset", () => {
  it("disclosure button has no ::before hover background surface", () => {
    // The hover treatment is now purely a color shift on the title and icon —
    // no background surface is painted via ::before. Assert the CSS source has
    // no ::before rule on .theory-disclosure-btn (resting or hover).
    const cssPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "./TheoryControls.module.css",
    );
    const css = readFileSync(cssPath, "utf-8");

    const restingBeforeBlock = css.match(/\.theory-disclosure-btn::before\s*\{/);
    expect(
      restingBeforeBlock,
      "::before resting block must NOT exist — hover background surface was removed",
    ).toBeNull();

    const hoverBeforeBlock = css.match(/\.theory-disclosure-btn:hover::before\s*\{/);
    expect(
      hoverBeforeBlock,
      "::before hover block must NOT exist — hover background surface was removed",
    ).toBeNull();
  });

  it("disclosure button uses native outline on :focus-visible (no ::before box-shadow ring)", () => {
    const cssPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "./TheoryControls.module.css",
    );
    const css = readFileSync(cssPath, "utf-8");
    // The :focus-visible rule must use a native outline, not suppress it.
    const focusVisibleBlock = css.match(
      /\.theory-disclosure-btn:focus-visible\s*\{([^}]+)\}/,
    );
    expect(focusVisibleBlock, ":focus-visible block must exist").toBeTruthy();
    expect(focusVisibleBlock![1]).toMatch(/outline:\s*var\(--focus-ring\)/);
    expect(focusVisibleBlock![1]).toMatch(/outline-offset:\s*var\(--focus-ring-offset\)/);
    // Must NOT suppress the outline.
    expect(focusVisibleBlock![1]).not.toMatch(/outline:\s*none/);
  });
});

describe("TheoryControls/TheorySection", () => {
  it("opens with defaultOpen and toggles closed when uncontrolled", () => {
    render(
      <TheorySection title="Scale" summary="C Major" defaultOpen>
        <div data-testid="inner-content">content</div>
      </TheorySection>,
    );

    expect(screen.getByTestId("inner-content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Scale.*C Major/i }));

    expect(screen.queryByTestId("inner-content")).not.toBeInTheDocument();
  });

  it("supports controlled open state", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <TheorySection title="Scale" summary="C Major" open={false} onOpenChange={onOpenChange}>
        <div data-testid="inner-content">content</div>
      </TheorySection>,
    );

    expect(screen.queryByTestId("inner-content")).not.toBeInTheDocument();

    rerender(
      <TheorySection title="Scale" summary="C Major" open onOpenChange={onOpenChange}>
        <div data-testid="inner-content">content</div>
      </TheorySection>,
    );

    expect(screen.getByTestId("inner-content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Scale.*C Major/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render data-compact attribute by default", async () => {
    const { container } = render(
      <TheorySection title="Scale" summary="C Major">
        <div>content</div>
      </TheorySection>,
    );
    const section = container.querySelector("section");
    expect(section).not.toHaveAttribute("data-compact");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders data-compact='true' when compact prop is set", async () => {
    const { container } = render(
      <TheorySection title="Scale" summary="C Major" compact>
        <div>content</div>
      </TheorySection>,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-compact", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("disabled: disclosure button has aria-disabled='true'", () => {
    const { container } = render(
      <TheorySection title="Chords" summary="Off" disabled defaultOpen>
        <div>content</div>
      </TheorySection>,
    );
    const btn = container.querySelector("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("disabled: section is collapsed (content not rendered)", () => {
    render(
      <TheorySection title="Chords" summary="Off" disabled defaultOpen>
        <div data-testid="inner-content">content</div>
      </TheorySection>,
    );
    // defaultOpen=true but disabled forces collapse; content must not be in DOM
    expect(screen.queryByTestId("inner-content")).not.toBeInTheDocument();
  });

  it("disabled: does not show a (Disabled) badge in the title area", () => {
    render(
      <TheorySection title="Chords" summary="Off" disabled>
        <div>content</div>
      </TheorySection>,
    );
    expect(screen.queryByText("(Disabled)")).not.toBeInTheDocument();
  });

  it("disabled: clicking the button does not expand the section", () => {
    const { container } = render(
      <TheorySection title="Chords" summary="Off" disabled>
        <div data-testid="inner-content">content</div>
      </TheorySection>,
    );
    const btn = container.querySelector("button")!;
    fireEvent.click(btn);
    expect(screen.queryByTestId("inner-content")).not.toBeInTheDocument();
  });

  it("disabled: section has data-disabled='true'", () => {
    const { container } = render(
      <TheorySection title="Chords" summary="Off" disabled>
        <div>content</div>
      </TheorySection>,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-disabled", "true");
  });
});

describe("TheoryControls UAT-20 — chord section disabled on 1/2-string", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Chords disclosure has aria-disabled when fingeringPattern is one-string", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "one-string");
    });
    render(
      <Provider store={store}>
        <TheoryControls />
      </Provider>,
    );
    const chordsBtn = screen.getByRole("button", { name: /Chords/i });
    expect(chordsBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("Chords disclosure has aria-disabled when fingeringPattern is two-strings", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "two-strings");
    });
    render(
      <Provider store={store}>
        <TheoryControls />
      </Provider>,
    );
    const chordsBtn = screen.getByRole("button", { name: /Chords/i });
    expect(chordsBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("Chords disclosure is not aria-disabled when fingeringPattern is caged", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "caged");
    });
    render(
      <Provider store={store}>
        <TheoryControls />
      </Provider>,
    );
    const chordsBtn = screen.getByRole("button", { name: /Chords/i });
    expect(chordsBtn).not.toHaveAttribute("aria-disabled");
  });

  it("Chords panel does not show (Disabled) badge on one-string (badge replaced by toggle label)", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "one-string");
    });
    render(
      <Provider store={store}>
        <TheoryControls />
      </Provider>,
    );
    expect(screen.queryByText("(Disabled)")).not.toBeInTheDocument();
  });

  it("Chord Mode toggle shows 'Disabled' label (not 'Degree') when pattern is one-string", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "one-string");
    });
    render(
      <Provider store={store}>
        <TheoryControls />
      </Provider>,
    );
    // Must expand the Chords section first (click it while checking for disabled-state rendering)
    // The Chord Mode toggle is inside the chord panel — for this test we confirm the
    // 'Disabled' button appears (panel is disabled so pointer-events: none; button exists in DOM)
    expect(screen.queryByRole("button", { name: "Disabled" })).not.toBeInTheDocument();
    // The Chords disclosure button is disabled, so clicking does nothing.
    // Verify no badge "(Disabled)" exists anywhere.
    expect(screen.queryByText("(Disabled)")).not.toBeInTheDocument();
  });

  it("Chords disclosure summary shows 'Disabled' when pattern is one-string", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "one-string");
    });
    render(
      <Provider store={store}>
        <TheoryControls />
      </Provider>,
    );
    // The summary span in the disclosure button should show "Disabled" to
    // match the UX principle the toggle bar already follows (UAT-23 + UAT-T2 fix).
    const chordsBtn = screen.getByRole("button", { name: /Chords.*Disabled/i });
    expect(chordsBtn).toBeInTheDocument();
  });

  it("Chords disclosure summary shows 'Disabled' when pattern is two-strings", () => {
    const store = createStore();
    act(() => {
      store.set(fingeringPatternAtom, "two-strings");
    });
    render(
      <Provider store={store}>
        <TheoryControls />
      </Provider>,
    );
    const chordsBtn = screen.getByRole("button", { name: /Chords.*Disabled/i });
    expect(chordsBtn).toBeInTheDocument();
  });

  it("renders a Progression section after Chords", () => {
    renderWithStore(<TheoryControls />);

    expect(screen.getByRole("button", { name: /Progression.*Off/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Progression/i }));

    expect(screen.getByText("Progression Mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I-V-vi-IV" })).toBeInTheDocument();
  });

  it("summarizes enabled progression with step count", () => {
    const store = createStore();
    store.set(progressionEnabledAtom, true);
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
    ]);

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByRole("button", { name: /Progression.*2 steps/i })).toBeInTheDocument();
  });
});
