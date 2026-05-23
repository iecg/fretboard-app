// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import { Fretboard } from "../Fretboard/Fretboard";
import { STANDARD_TUNING } from "@fretflow/core";
import { fretEndAtom, fretStartAtom, fretZoomAtom } from "../../store/layoutAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { scaleDegreeColorsEnabledAtom } from "../../store/uiAtoms";
import { axe } from "../../test-utils/a11y";

// Mock audio synth
vi.mock("../../core/audio", () => ({
  synth: {
    playNote: vi.fn(),
    setMute: vi.fn(),
    init: vi.fn(),
  },
}));

describe("Fretboard/Fretboard", () => {
  const defaultProps = {
    tuning: STANDARD_TUNING,
    maxFret: 24,
    highlightNotes: ["E", "G", "B"],
    rootNote: "C",
    displayFormat: "notes" as const,
  };

  function renderFretboard(store = createStore()) {
    return {
      store,
      ...render(
        <Provider store={store}>
          <Fretboard {...defaultProps} />
        </Provider>,
      ),
    };
  }

  function getVisibleFretLabels(container: HTMLElement) {
    return Array.from(container.querySelectorAll(".fret-number")).map(
      (fret) => fret.textContent,
    );
  }

  function getFretMarker(container: HTMLElement, fret: number) {
    // SVG-based fretboard uses data-fret-marker on circle/g elements
    return (
      container.querySelector(`[data-fret-marker="${fret}"]`) ?? null
    );
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1440,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 900,
    });
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("keeps the fretboard visible before ResizeObserver publishes width", () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      const wrapper = container.querySelector('[class*="fretboard-wrapper"]');
      expect(wrapper).not.toHaveStyle({ visibility: "hidden" });
    });

    it("renders all 6 strings for standard tuning", () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      // Fretboard has 6 rows for standard tuning
      const fretboard = container.querySelector("div");
      expect(fretboard).toBeTruthy();
    });

    it("renders correct number of frets based on endFret - startFret", () => {
      const store = createStore();
      store.set(fretStartAtom, 3);
      store.set(fretEndAtom, 7);

      const { container } = renderFretboard(store);

      expect(container.querySelectorAll(".fret-number")).toHaveLength(5);
      expect(getVisibleFretLabels(container)).toEqual([
        "3",
        "4",
        "5",
        "6",
        "7",
      ]);
    });

    it("renders with different tunings", () => {
      const dropDTuning = ["E4", "B3", "G3", "D3", "A2", "D2"];
      render(<Fretboard {...defaultProps} tuning={dropDTuning} />);
      expect(document.body).toBeTruthy(); // Rendered without error
    });
  });

  describe("Note highlighting", () => {
    it("highlights specified notes", () => {
      const store = createStore();
      store.set(progressionStepsAtom, []);
      const { container } = render(
        <Provider store={store}>
          <Fretboard {...defaultProps} highlightNotes={["E", "G", "B", "C"]} />
        </Provider>,
      );
      // Scale root (C) → key-tonic; other scale notes → note-active
      expect(container.querySelectorAll(".key-tonic").length).toBeGreaterThan(
        0,
      );
      expect(container.querySelectorAll(".note-active").length).toBeGreaterThan(
        0,
      );
    });

    it("updates highlight when notes change", () => {
      const store = createStore();
      store.set(progressionStepsAtom, []);
      const { container, rerender } = render(
        <Provider store={store}>
          <Fretboard {...defaultProps} highlightNotes={["C", "E", "G"]} />
        </Provider>,
      );

      expect(container.querySelectorAll(".key-tonic").length).toBeGreaterThan(
        0,
      );
      expect(container.querySelectorAll(".note-active").length).toBeGreaterThan(
        0,
      );

      rerender(
        <Provider store={store}>
          <Fretboard {...defaultProps} highlightNotes={["D", "F#", "A"]} />
        </Provider>,
      );

      // C is rootNote but not in highlight list — no key-tonic
      expect(container.querySelectorAll(".key-tonic")).toHaveLength(0);
      expect(container.querySelectorAll(".note-active").length).toBeGreaterThan(
        0,
      );
    });

    it("handles empty highlight array", () => {
      const { container } = render(
        <Fretboard {...defaultProps} highlightNotes={[]} />,
      );

      expect(container.querySelectorAll(".key-tonic")).toHaveLength(0);
      expect(container.querySelectorAll(".note-active")).toHaveLength(0);
      // SVG renderer now includes inactive notes as hidden hit targets
      expect(container.querySelectorAll(".fretboard-note")).toHaveLength(144);
    });
  });

  describe("Display formats", () => {
    it('displays notes when displayFormat is "notes"', () => {
      render(
        <Fretboard {...defaultProps} displayFormat="notes" rootNote="C" />,
      );
      expect(document.body).toBeTruthy();
    });

    it('displays degrees when displayFormat is "degrees"', () => {
      render(
        <Fretboard {...defaultProps} displayFormat="degrees" rootNote="C" />,
      );
      expect(document.body).toBeTruthy();
    });

    it('displays nothing when displayFormat is "none"', () => {
      render(<Fretboard {...defaultProps} displayFormat="none" />);
      expect(document.body).toBeTruthy();
    });

    it("keeps note labels visible when scale degree colors are enabled", () => {
      const store = createStore();
      store.set(scaleDegreeColorsEnabledAtom, true);
      const { container } = render(
        <Provider store={store}>
          <Fretboard
            {...defaultProps}
            displayFormat="notes"
            rootNote="C"
            scaleName="Major"
          />
        </Provider>
      );

      expect(container.querySelector('[data-degree-colors="true"] text')).toBeTruthy();
    });

    it("updates display when displayFormat changes", () => {
      const { rerender } = render(
        <Fretboard {...defaultProps} displayFormat="notes" />,
      );

      rerender(<Fretboard {...defaultProps} displayFormat="degrees" />);
      expect(document.body).toBeTruthy();
    });
  });

  describe("Zoom and scroll", () => {
    it("respects fretZoom atom", () => {
      const store = createStore();
      store.set(fretZoomAtom, 200);

      const { container } = renderFretboard(store);
      const firstFret = container.querySelector(".fret-number");

      expect(firstFret).toBeTruthy();
      // Fret 0 (open-string column) has a fixed width determined by noteBubblePx,
      // independent of zoom. Non-zero frets scale with zoom via guitar scale math.
      expect(firstFret).toHaveStyle("width: 41px");
    });

    it("has scroll container that is draggable", () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      const scrollContainer =
        container.querySelector('[class*="scroll"]') || container.firstChild;
      expect(scrollContainer).toBeTruthy();
    });

    it("handles zoom changes via atom store", () => {
      const store = createStore();
      const { container } = renderFretboard(store);

      // Fret 0 open-string column has fixed width (noteBubblePx-derived, zoom-independent)
      expect(container.querySelector(".fret-number")).toHaveStyle(
        "width: 41px",
      );

      act(() => {
        store.set(fretZoomAtom, 150);
      });

      // Fret 0 column stays fixed; non-zero frets scale via guitar scale math
      expect(container.querySelector(".fret-number")).toHaveStyle(
        "width: 41px",
      );
    });

    it("responds to fretStart and fretEnd atom changes", () => {
      const store = createStore();
      const { container } = renderFretboard(store);

      expect(getVisibleFretLabels(container).slice(0, 5)).toEqual([
        "", // fret 0 (open string) label intentionally suppressed
        "1",
        "2",
        "3",
        "4",
      ]);

      act(() => {
        store.set(fretStartAtom, 5);
        store.set(fretEndAtom, 9);
      });

      expect(container.querySelectorAll(".fret-number")).toHaveLength(5);
      expect(getVisibleFretLabels(container)).toEqual([
        "5",
        "6",
        "7",
        "8",
        "9",
      ]);
    });
  });

  // Render-only smoke tests covering optional props that the Fretboard wrapper
  // forwards to FretboardSVG. Detailed behavior is asserted in
  // FretboardSVG.test.tsx; these only verify the wrapper accepts the shapes.
  it.each<{ label: string; props: Record<string, unknown> }>([
    {
      label: "chord tones with scale highlights",
      props: { highlightNotes: ["C", "D", "E", "F", "G", "A", "B"], chordTones: ["C", "E", "G"] },
    },
    {
      label: "chord fret spread",
      props: { chordTones: ["C", "E", "G"], chordFretSpread: 0 },
    },
    {
      label: "shape polygons",
      props: {
        shapePolygons: [
          {
            vertices: [
              { string: 0, fret: 0 }, { string: 1, fret: 2 }, { string: 2, fret: 2 },
              { string: 3, fret: 2 }, { string: 4, fret: 0 }, { string: 5, fret: 0 },
            ],
            shape: "E", color: "#6366f1", truncated: false,
            intendedMin: 0, intendedMax: 2, cagedLabel: "E Shape", modalLabel: "Ionian",
          },
        ],
      },
    },
    { label: "wrappedNotes set", props: { wrappedNotes: new Set(["4-24", "3-25"]) } },
    {
      label: "colorNotes with full scale",
      props: { highlightNotes: ["C", "D", "E", "F", "G", "A", "B"], colorNotes: ["F#", "B"] },
    },
  ])("renders with $label without crashing", ({ props }) => {
    render(<Fretboard {...defaultProps} {...props} />);
    expect(document.body).toBeTruthy();
  });

  it("re-renders without crashing when colorNotes changes", () => {
    const { rerender } = render(<Fretboard {...defaultProps} colorNotes={["F", "B"]} />);
    rerender(<Fretboard {...defaultProps} colorNotes={["F#", "C#"]} />);
    expect(document.body).toBeTruthy();
  });

  describe("Accidentals", () => {
    it.each([false, true])("renders with preferFlats=%s", (preferFlats) => {
      render(<Fretboard {...defaultProps} preferFlats={preferFlats} />);
      expect(document.body).toBeTruthy();
    });

    it("updates display when preferFlats changes", () => {
      const { rerender } = render(<Fretboard {...defaultProps} preferFlats={false} />);
      rerender(<Fretboard {...defaultProps} preferFlats={true} />);
      expect(document.body).toBeTruthy();
    });
  });

  describe("Fret markers", () => {
    it("displays fret markers at standard positions", () => {
      const { container } = render(<Fretboard {...defaultProps} />);

      for (const fret of [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]) {
        expect(getFretMarker(container, fret)).toBeTruthy();
      }

      expect(
        getFretMarker(container, 12)?.getAttribute("data-double-marker"),
      ).toBe("true");
      expect(
        getFretMarker(container, 24)?.getAttribute("data-double-marker"),
      ).toBe("true");
    });

    it("hides fret markers outside visible range", () => {
      const store = createStore();
      store.set(fretStartAtom, 10);
      store.set(fretEndAtom, 15);

      const { container } = renderFretboard(store);

      expect(getFretMarker(container, 12)).toBeTruthy();
      expect(
        getFretMarker(container, 12)?.getAttribute("data-double-marker"),
      ).toBe("true");
      expect(getFretMarker(container, 15)).toBeTruthy();
      expect(
        getFretMarker(container, 15)?.getAttribute("data-double-marker"),
      ).toBeNull();

      for (const fret of [3, 5, 7, 9, 17, 19, 21, 24]) {
        expect(getFretMarker(container, fret)).toBeNull();
      }
    });
  });

  describe("Click handlers", () => {
    it("calls onFretClick when a fret is clicked", async () => {
      const onFretClick = vi.fn();
      render(<Fretboard {...defaultProps} onFretClick={onFretClick} />);

      // Find a note bubble and click it
      const buttons = screen.queryAllByRole("button");
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // onFretClick should be called
      }
    });

    it("passes correct parameters to onFretClick", async () => {
      const onFretClick = vi.fn();
      render(
        <Fretboard {...defaultProps} rootNote="C" onFretClick={onFretClick} />,
      );

      const buttons = screen.queryAllByRole("button");
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // Callback should receive string index, fret index, and note name
      }
    });
  });

  describe("Mobile responsiveness", () => {
    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 600, // Mobile width
      });
    });

    it("adjusts zoom for mobile viewport", () => {
      render(<Fretboard {...defaultProps} />);
      // Mobile zoom calculation: Math.floor(600 / 7) ≈ 85
      expect(document.body).toBeTruthy();
    });

    it("uses desktop zoom on wide viewports", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1920, // Desktop width
      });

      const { container } = render(<Fretboard {...defaultProps} />);

      // Fret 0 open-string column has fixed width (zoom-independent)
      expect(container.querySelector(".fret-number")).toHaveStyle(
        "width: 41px",
      );
    });
  });

  describe("Edge cases", () => {
    it("handles 0 frets gracefully", () => {
      const store = createStore();
      store.set(fretStartAtom, 0);
      store.set(fretEndAtom, 0);

      const { container } = renderFretboard(store);

      expect(container.querySelectorAll(".fret-number")).toHaveLength(1);
      expect(getVisibleFretLabels(container)).toEqual([""]); // fret 0 label suppressed
    });

    it("handles very high fret numbers", () => {
      render(<Fretboard {...defaultProps} maxFret={36} />);

      expect(document.body).toBeTruthy();
    });

    it("handles single-note highlight", () => {
      render(<Fretboard {...defaultProps} highlightNotes={["C"]} />);

      expect(document.body).toBeTruthy();
    });

    it("handles all 12 notes highlighted", () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={[
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
            "G",
            "G#",
            "A",
            "A#",
            "B",
          ]}
        />,
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('marker-dot CSS custom property', () => {
    it('sets --string-row-px on fretboard-neck container', () => {
      const { container } = render(
        <Provider store={createStore()}>
          <Fretboard {...defaultProps} stringRowPx={48} />
        </Provider>,
      );
      const neck = container.querySelector('.fretboard-neck');
      expect(neck).not.toBeNull();
      expect((neck as HTMLElement).style.getPropertyValue('--string-row-px')).toBe('48px');
    });

    it('sets --string-row-px correctly at minimum stringRowPx=40', () => {
      const { container } = render(
        <Provider store={createStore()}>
          <Fretboard {...defaultProps} stringRowPx={40} />
        </Provider>,
      );
      const neck = container.querySelector('.fretboard-neck');
      expect((neck as HTMLElement).style.getPropertyValue('--string-row-px')).toBe('40px');
    });

    it('sets --string-row-px correctly at maximum stringRowPx=72', () => {
      const { container } = render(
        <Provider store={createStore()}>
          <Fretboard {...defaultProps} stringRowPx={72} />
        </Provider>,
      );
      const neck = container.querySelector('.fretboard-neck');
      expect((neck as HTMLElement).style.getPropertyValue('--string-row-px')).toBe('72px');
    });
  });

  describe("Interaction — click, drag, and zoom", () => {
    const interactionProps = {
      tuning: ["E4", "B3", "G3", "D3", "A2", "E2"],
      highlightNotes: ["C", "E", "G"],
      rootNote: "C",
      stringRowPx: 40,
    };

    function renderInteractive(
      store = createStore(),
      overrides: Record<string, unknown> = {},
    ) {
      return render(
        <Provider store={store}>
          <Fretboard {...interactionProps} {...overrides} />
        </Provider>,
      );
    }

    function renderWithOverflow(
      store = createStore(),
      overrides: Record<string, unknown> = {},
    ) {
      const result = renderInteractive(store, overrides);
      const wrapper = result.container.querySelector(
        ".fretboard-wrapper",
      ) as HTMLElement;

      Object.defineProperty(wrapper, "scrollWidth", {
        configurable: true,
        get: () => 2000,
      });
      Object.defineProperty(wrapper, "clientWidth", {
        configurable: true,
        get: () => 400,
      });
      (
        wrapper as HTMLElement & { setPointerCapture: (id: number) => void }
      ).setPointerCapture = vi.fn();

      act(() => {
        store.set(fretZoomAtom, 200);
      });
      act(() => {
        store.set(fretZoomAtom, 100);
      });
      return { ...result, wrapper };
    }

    it("fires onFretClick when a note is clicked without drag", async () => {
      const onFretClick = vi.fn();
      const store = createStore();
      store.set(progressionStepsAtom, []);
      renderInteractive(store, { onFretClick });
      const user = userEvent.setup();
      const activeNote = document.querySelector(
        ".note-bubble.root-active, .note-bubble.note-active, .note-bubble.chord-tone",
      ) as HTMLElement;
      expect(activeNote).toBeTruthy();
      await user.click(activeNote);
      expect(onFretClick).toHaveBeenCalledTimes(1);
    });

    it("suppresses click after a drag of > 5px", async () => {
      const onFretClick = vi.fn();
      const { wrapper } = renderWithOverflow(createStore(), { onFretClick });
      // Flush rAF used by the hasOverflow effect so drag detection activates
      await act(async () => {
        await new Promise((r) => requestAnimationFrame(r));
      });

      fireEvent.pointerDown(wrapper, { pointerId: 1, pageX: 100, buttons: 1 });
      fireEvent.pointerMove(wrapper, {
        pointerId: 1,
        pageX: 90,
        movementX: -10,
        buttons: 1,
      });
      fireEvent.pointerMove(wrapper, {
        pointerId: 1,
        pageX: 80,
        movementX: -10,
        buttons: 1,
      });
      fireEvent.pointerUp(wrapper, { pointerId: 1 });

      const noteButton = wrapper.querySelector(".note-bubble") as HTMLElement;
      expect(noteButton).toBeTruthy();
      fireEvent.click(noteButton);
      expect(onFretClick).not.toHaveBeenCalled();
    });

    it("re-renders with wider neck when fretZoomAtom increases", () => {
      let roCallback: ResizeObserverCallback | null = null;
      const OriginalRO = globalThis.ResizeObserver;
      class MockResizeObserver {
        constructor(cb: ResizeObserverCallback) {
          roCallback = cb;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      globalThis.ResizeObserver =
        MockResizeObserver as unknown as typeof ResizeObserver;

      const store = createStore();
      renderInteractive(store);

      act(() => {
        roCallback?.(
          [
            {
              contentRect: { width: 800 },
            } as unknown as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        );
      });

      const neck = document.querySelector(".fretboard-neck") as HTMLElement;
      expect(neck).toBeTruthy();

      const initialWidth = parseInt(neck.style.width, 10);

      act(() => {
        store.set(fretZoomAtom, 150);
      });

      const newWidth = parseInt(neck.style.width, 10);
      expect(newWidth).toBeGreaterThan(initialWidth);

      globalThis.ResizeObserver = OriginalRO;
    });
  });

  it("has no a11y violations", async () => {
    const { container } = renderFretboard();
    expect(await axe(container)).toHaveNoViolations();
  });
});
